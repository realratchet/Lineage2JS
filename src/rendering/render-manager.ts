import "./ue2-conventions";
import "../materials/shader-chunks/register-chunks";
import { WebGLRenderer, PerspectiveCamera, Vector2, Scene, Mesh, BoxGeometry, Raycaster, Vector3, Frustum, Matrix4, Object3D, Box3, SphereGeometry, MeshBasicMaterial, Camera, Color, Sprite, SpriteMaterial, AdditiveBlending, PlaneGeometry, AnimationMixer, AnimationClip, CameraHelper, Fog, MathUtils, WebGLRenderTarget, RGBAFormat, LinearFilter, Sphere, Group, Quaternion } from "three";
import { UGlowPass } from "./postprocessing/uglow-pass";
import { ZUpOrbitControls as OrbitControls } from "./camera/controllers/zup-orbit-controls";
import { ZUpPointerLockControls } from "./camera/controllers/zup-pointer-lock-controls";
import GLOBAL_UNIFORMS from "@client/materials/global-uniforms";
import Player from "@client/player";
import type BaseActor from "@client/base-actor";
import RAPIER from "@dimforge/rapier3d";
import type { ICollidable } from "@client/objects/objects";
import Stats from "./stats";
import Visualizer, { VisualizerMode, EmitterDebugInfo } from "./visualizer";
import EnvColor from "@client/rendering/env-color";
import L2Environment, { FogBlendState, interpolateFogInfoColor, interpolateFogInfoSkyColor, interpolateFogInfoHazeColor, interpolateFogInfoCloudColor, interpolateFogInfoHazeColors } from "@client/rendering/l2-env";
import SkyRenderer from "./sky-renderer";
import UnderWaterEffect from "./under-water-effect";
import Terrain from "../objects/terrain";
import { ColorByte } from "@client/utils/color-byte";
import EnvInfo from "@client/rendering/env-info";
import AudioManager from "@client/rendering/audio-manager";
import * as dat from "dat.gui";
import type AssetManager from "@client/assets/asset-manager";
import InstancedSpriteBatcher from "@client/objects/emitters/instanced-sprite-batcher";
import MovableObject from "@client/objects/movable-object";
import RotatingObject from "@client/objects/rotating-object";
import DisplayGammaPass, { GAMMA_STEPS } from "./display-gamma";
import ColliderOverlay from "./collider-overlay";
import CollisionWorld, { CollisionBackend_T } from "@client/physics/collision-world";
import LitSkinnedMesh from "@client/objects/lit-skinned-mesh";
import ShadowProjector from "@client/objects/shadow-projector";
import type DynamicLight from "@client/objects/dynamic-light";
import { NUM_ACTOR_LIGHTS } from "@client/materials/mesh-static-material/mesh-static-material";

const gui = new dat.GUI({ autoPlace: false, width: 300 });
Object.assign(gui.domElement.style, {
    position: "fixed",
    top: "0px",
    right: "0px",
    zIndex: "10000"
});
document.body.appendChild(gui.domElement);
const guiFolders = {
    world: gui.addFolder("World"),
    quality: gui.addFolder("Quality")
};
guiFolders.world.open();

const stats = new (Stats as any)(0);

stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

function getCollisionBackend(): CollisionBackend_T {
    const backend = new URLSearchParams(location.search).get("collisionBackend") || "ue";

    if (backend !== "ue" && backend !== "rapier" && backend !== "compare") throw new Error(`Unknown collision backend '${backend}'.`);

    return backend;
}

const tmpBox = new Box3();
const tmpCamDir = new Vector3();
const tmpFarPoint = new Vector3();
const tmpPawnWorldPos = new Vector3();
const tmpPawnSunAmbient = new ColorByte();
const arrPawnLights: DynamicLight[] = [];
const tmpShadowDirection = new Vector3(0, 0, -1);
const arrShadowCasters: THREE.Object3D[] = [];
const PAWN_LIGHTING_RADIUS = 24; // FDynamicActor::BoundingSphere stand-in, sized to the pawn collision cylinder
const tmpOrbitFollowTarget = new Vector3();
const tmpOrbitFollowDelta = new Vector3();
const tmpMouseIntersection = new Vector3();
const tmpPickBounds = new Box3();
const tmpSimDirection = new Vector3();
const tmpBillboardUp = new Vector3();
const tmpBillboardFront = new Vector3();
const tmpBillboardRight = new Vector3();
const arrBSPGroups: Object3D[] = [];
const arrBSPIntersections: THREE.Intersection[] = [];
// off-screen emitters (in range but outside the frustum) simulate at this rate instead
// of a hard freeze, so particle state doesn't go stale and pop when re-entering view
// Two maintenance ticks keep offscreen loops alive without dominating visible frames.
const OFFSCREEN_EMITTER_HZ = 2;
const OFFSCREEN_EMITTER_INTERVAL_MS = 1000 / OFFSCREEN_EMITTER_HZ;
// Lineage II configures UE2's MinDesiredFrameRate to 35. UE2 raises bDropDetail
// below that rate, then bAggressiveLOD another 5 FPS lower.
const MIN_DESIRED_FRAME_RATE = 35;
const AGGRESSIVE_LOD_FRAME_RATE = MIN_DESIRED_FRAME_RATE - 5;
// AEmitter::Render (0x8a2ae0): GL2ActorCR * 32768.0 * 0.0625.
const CLIPPING_RANGE_SCALE = 2048;
const DROP_DETAIL_FRAME_TIME_MS = 1000 / MIN_DESIRED_FRAME_RATE;
const AGGRESSIVE_LOD_FRAME_TIME_MS = 1000 / AGGRESSIVE_LOD_FRAME_RATE;
const MAX_OFFSCREEN_EMITTER_UPDATES = 32;
const DROP_DETAIL_OFFSCREEN_EMITTER_UPDATES = 8;
const dirForward = new Vector3(), dirRight = new Vector3(), cameraVelocity = new Vector3();
const tmpColorByte = new ColorByte();
const tmpColorByte_2 = new ColorByte();
const tmpColorByte_3 = new ColorByte(); // For sky color blending
const tmpColorByte_4 = new ColorByte(); // For haze color blending
const tmpColorByte_5 = new ColorByte(); // For cloud color blending

const DEFAULT_FAR = 100_000_000;
const DEFAULT_CLEAR_COLOR = 0x0c0c0c;
const DEFAULT_HORIZONTAL_FOV = 60; // Matches user.ini DefaultFOV/DesiredFOV (was 90 from l2.ini)
const CLICK_MAX_MOVEMENT_SQ = 16;
const SIMULATED_PAWN_COUNT = 10;
const SIMULATED_PAWN_LIFETIME = 15000;
const SIMULATED_PAWN_TURN_INTERVAL = 1000;
const SIMULATED_PAWN_CONCURRENCY = 3;

type ZoneObject = import("../objects/zone-object").ZoneObject;
type SectorObject = import("../objects/zone-object").SectorObject;
type SimulatedPawn_T = { pawn: BaseActor, expires: number, nextTurn: number };
type SectorMaterialBinding_T = { object: THREE.Mesh, material: THREE.Material, materialIndex: number, textureQueue: THREE.Texture[] };
type SectorWarmup_T = {
    sector: SectorObject,
    materialQueue: SectorMaterialBinding_T[],
    warmedTextures: Set<THREE.Texture>,
    lightingQueue: any[],
    fallbackMaterials: Set<THREE.Material>,
    releaseEmitters: boolean
};

const frozenUpdateMatrixWorld = function () { };

// undoes addSector's early freeze once live content attaches, or its matrixWorld never updates again
function unfreezeAncestors(node: THREE.Object3D): void {
    for (let n = node.parent; n; n = n.parent)
        if (n.updateMatrixWorld === frozenUpdateMatrixWorld)
            n.updateMatrixWorld = Object3D.prototype.updateMatrixWorld;
}

function findVisibleMaterialBinding(bindings: SectorMaterialBinding_T[], cacheVisibleMaterials: WeakMap<THREE.Mesh, Set<number>>): number {
    for (let i = bindings.length - 1; i >= 0; i--) {
        const binding = bindings[i];
        if (!binding.object.visible) continue;
        if (binding.materialIndex < 0) return i;

        let visibleMaterials = cacheVisibleMaterials.get(binding.object);

        if (!visibleMaterials) {
            visibleMaterials = new Set(binding.object.geometry.groups.map(group => group.materialIndex));
            cacheVisibleMaterials.set(binding.object, visibleMaterials);
        }

        if (visibleMaterials.has(binding.materialIndex)) return i;
    }

    return -1;
}

// overrides updateMatrixWorld to a no-op, but only once every child under a node is static too
function freezeStaticSubtree(node: THREE.Object3D): boolean {
    if ((node as any).isMovableObject) {
        (node as MovableObject).freezeMover();
        return false;
    }

    if ((node as any).isRotatingObject) return false;

    node.matrixAutoUpdate = false;

    if ((node as any).particlePool) return false;

    let allChildrenFrozen = true;

    for (const child of node.children)
        if (!freezeStaticSubtree(child)) allChildrenFrozen = false;

    if (allChildrenFrozen) node.updateMatrixWorld = frozenUpdateMatrixWorld;

    return allChildrenFrozen;
}

// never touch the emitter's own .visible here - scene.traverseVisible skips it before the callback, permanently stranding it out of future traversal even once back in range
function freezeEmitterParticles(emitter: any) {
    for (const p of emitter.particlePool) {
        p.visible = false;
        p.updateMatrixWorld = frozenUpdateMatrixWorld;
    }

    // instanced sprite emitters render from one shared mesh - particlePool.visible above doesn't touch it
    if (emitter.instancedMesh) {
        emitter.instancedMesh.visible = false;
    }
}

function getEmitterPhase(emitter: any) {
    if (emitter.detailPhase !== undefined) return emitter.detailPhase;

    let hash = 2166136261;
    for (let i = 0; i < emitter.uuid.length; i++) {
        hash ^= emitter.uuid.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return emitter.detailPhase = hash >>> 0;
}

function shouldUpdateOffscreenEmitter(emitter: any, currentTime: number) {
    if (!emitter.isOffscreenThrottled) {
        emitter.isOffscreenThrottled = true;
        emitter.offscreenSince = currentTime;
        emitter.nextOffscreenUpdate = currentTime + OFFSCREEN_EMITTER_INTERVAL_MS + getEmitterPhase(emitter) % OFFSCREEN_EMITTER_INTERVAL_MS;
        return true;
    }

    // Native UE2 stops ticking a ParticleEmitter after SecondsBeforeInactive.
    // Stock UE2 defaults it to one second, while Lineage II defaults it to zero
    // (disabled), in which case the low maintenance cadence continues.
    const inactiveTimeout = emitter.secondsBeforeInactive ?? 0;
    if (inactiveTimeout > 0 && currentTime - emitter.offscreenSince > inactiveTimeout * 1000)
        return false;

    if (currentTime < emitter.nextOffscreenUpdate) return false;

    const missedIntervals = Math.floor((currentTime - emitter.nextOffscreenUpdate) / OFFSCREEN_EMITTER_INTERVAL_MS) + 1;
    emitter.nextOffscreenUpdate += missedIntervals * OFFSCREEN_EMITTER_INTERVAL_MS;

    return true;
}

function shouldUpdateVisibleEmitter(emitter: any, detailFrame: number, dropDetail: boolean, aggressiveLod: boolean, simDue: boolean) {
    if (!simDue && emitter.instancedMesh?.visible && !emitter.isOffscreenThrottled) return false;

    if (!dropDetail || !emitter.instancedMesh?.visible || emitter.isOffscreenThrottled) return true;

    const phase = getEmitterPhase(emitter) + detailFrame;
    // UE2's drop-detail xEmitter path retains roughly 65% of the normal particle
    // budget. Keep all particles drawn here, but distribute an equivalent amount
    // of simulation work across frames. Aggressive LOD lowers that to one half.
    return aggressiveLod ? (phase & 1) === 0 : phase % 3 !== 0;
}

class RenderManager {
    public readonly renderer: THREE.WebGLRenderer;
    public readonly viewport: HTMLViewportElement;
    public getDomElement() { return this.renderer.domElement; }
    public readonly camera = new PerspectiveCamera(DEFAULT_HORIZONTAL_FOV, 1, 0.1, DEFAULT_FAR);
    public readonly scene = new Scene();
    public readonly objectGroup = new Object3D();
    public readonly lastSize = new Vector2();
    public readonly controls: { orbit: OrbitControls, fps: ZUpPointerLockControls } = { orbit: null, fps: null };
    public needsUpdate: boolean = true;
    public isPersistentRendering: boolean = true;
    public readonly raycaster = new Raycaster();
    public speedCameraFPS = 5;
    public readonly mixer = new AnimationMixer(this.scene);
    public readonly skyRenderer = new SkyRenderer();
    public readonly underWaterEffect = new UnderWaterEffect();

    protected assetManager: AssetManager;
    protected uGlowPass: UGlowPass;
    protected mainRenderTarget: WebGLRenderTarget;
    protected displayGammaPass: DisplayGammaPass;
    protected displayGammaEnabled: boolean = false;

    public bspHelperCamera: PerspectiveCamera | null = null;
    public bspHelperCameraHelper: CameraHelper | null = null;
    public bspHelperActive: boolean = false;
    public frustumCullingEnabled: boolean = true;
    public readonly visualizer: Visualizer;
    private readonly manuallyHiddenEmitterUuids: Set<string> = new Set();
    protected readonly particleBatcher = new InstancedSpriteBatcher();
    protected readonly visibleWorldBatchEmitters: any[] = [];
    protected readonly neighborVisibilitySectors: SectorObject[] = [];
    protected neighborVisibilityCursor = 0;
    protected emitterDetailFrame = 0;
    protected emitterSimDue = true;
    protected dropDetail = false;
    protected aggressiveLod = false;
    protected readonly movableObjects = new Set<MovableObject>();
    protected readonly activeMovableObjects = new Set<MovableObject>();
    protected readonly waitingMovableObjects = new Map<MovableObject, number>();
    protected readonly rotatingObjects = new Set<RotatingObject>();
    protected readonly simulatedPawns = new Set<SimulatedPawn_T>();
    protected simCharGroups: GD.ICharacterGroup[] = null;
    protected readonly lastMoverTriggerPosition = new Vector3(Infinity, Infinity, Infinity);
    protected lastRenderOrderSector: SectorObject | null = null;

    protected environment: L2Environment;
    protected activeFogId: string | null = null;

    protected shiftTimeDown: number = 0;
    protected readonly sectors = new Map<number, Map<number, SectorObject>>();

    protected readonly pendingSectorWarmups: SectorWarmup_T[] = [];
    protected static readonly TEXTURE_WARMUP_FRAME_MS = 2;
    protected static readonly MATERIAL_RESTORES_PER_FRAME = 8;

    // deferred shader link/compile error reporting, see processShaderDiagnostics
    protected readonly pendingShaderChecks: any[] = [];
    protected readonly seenPrograms = new WeakSet<object>();
    protected parallelShaderCompileExt: any = undefined; // resolved lazily, null if unsupported
    protected readonly dirKeys = { left: false, right: false, up: false, down: false, shift: false };
    protected isOrbitControls = true;
    protected isPrimaryMouseDown = false;
    protected hasMouseDragged = false;
    protected readonly mouseDownPosition = new Vector2();
    protected lastRender: number = 0;
    protected readonly _lastListenerPos = new Vector3(Infinity, Infinity, Infinity);
    protected readonly _lastListenerQuat = new Quaternion(0, 0, 0, 0);
    protected pixelRatio: number = global.devicePixelRatio;
    protected readonly frustum = new Frustum();
    protected readonly lastProjectionScreenMatrix = new Matrix4();

    public readonly player = new Player(this);
    protected readonly shadowProjector = new ShadowProjector();
    protected readonly colliderOverlay = new ColliderOverlay();
    protected showColliders = false;
    protected characterGroup = 1;
    protected characterFace = 0;
    protected characterHair = 0;
    protected characterHairColour = 0;
    protected followPlayer = false;
    protected characterArmor: GD.ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 };

    protected readonly sun: THREE.Mesh;
    protected readonly sunCam: THREE.Camera;

    public readonly physicsWorld: RAPIER.World;
    public readonly collisionWorld: CollisionWorld;

    protected activeSector = 0;
    protected sectorBounds = new Array<THREE.Box3>();
    protected currentSectorIndex: THREE.Vector2 | null = null;
    public readonly globalSky = new Group();
    public readonly audioManager: AudioManager = new AudioManager();
    protected activeMusicId: number = -1;

    public envConfig = {
        showLevel: true,
        fogPreset: "4",
        moverPosition: 0
    };

    public constructor(viewport: HTMLViewportElement, assetManager: AssetManager) {
        this.viewport = viewport;
        this.assetManager = assetManager;
        this.renderer = new WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
            premultipliedAlpha: false,
            logarithmicDepthBuffer: true,
            alpha: true,
        });

        this.renderer.debug.checkShaderErrors = false; // profiled at ~90ms/sector; processShaderDiagnostics polls KHR_parallel_shader_compile instead

        // Initialize Native Bloom System
        this.mainRenderTarget = new WebGLRenderTarget(256, 256, {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
            stencilBuffer: false
        });
        this.mainRenderTarget.texture.name = "RenderManager.mainTarget";

        this.uGlowPass = new UGlowPass(new Vector2(256, 256));
        this.uGlowPass.renderToScreen = true;

        this.displayGammaPass = new DisplayGammaPass(256, 256, this.renderer.capabilities.isWebGL2 ? 4 : 0);

        guiFolders.quality.add(this.envConfig, "fogPreset", {
            "1 (2k-8k)": "1",
            "2 (3k-10k)": "2",
            "3 (4k-12k)": "3",
            "4 (5k-14k)": "4",
            "5 (8k-20k)": "5"
        }).name("Fog Range");

        guiFolders.world.add(this.envConfig, "showLevel")
            .name("Show Level")
            .onChange(v => {
                this.objectGroup.visible = v;
            });

        guiFolders.world.add(this, "showColliders")
            .name("Show Colliders")
            .onChange(v => this.setCollidersVisible(v));

        guiFolders.world.add(this.envConfig, "moverPosition", 0, 1, 0.01)
            .name("Door Position")
            .onChange(v => {
                this.activeMovableObjects.clear();
                this.waitingMovableObjects.clear();
                this.movableObjects.forEach(mover => mover.setPosition(v));
                this.needsUpdate = true;
            });

        const skyFolder = gui.addFolder("Sky Layers");
        skyFolder.add(this.skyRenderer.config, "celestials").name("Celestials");
        skyFolder.add(this.skyRenderer.config, "haze1").name("Haze");
        skyFolder.add(this.skyRenderer.config, "starsClouds").name("Stars/Clouds");
        // skyFolder.add(this.skyRenderer.config, "haze2").name("Haze 2 (Dome)");

        const audioFolder = gui.addFolder("Audio");
        audioFolder.add(this.audioManager, "musicVolume", 0, 1, 0.01).name("Music Volume");
        audioFolder.add(this.audioManager, "ambientVolume", 0, 1, 0.01).name("Ambient Volume");
        audioFolder.open();

        this.renderer.autoClear = false;

        this.renderer.setClearColor(DEFAULT_CLEAR_COLOR);
        this.camera.up.set(0, 0, 1);
        this.controls.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.fps = new ZUpPointerLockControls(this.camera, this.renderer.domElement);
        this.camera.position.set(0, 15, 5);
        this.camera.lookAt(0, 0, 0);
        this.scene.add(new Mesh(new BoxGeometry()));

        this.objectGroup.name = "SectorGroup"
        this.scene.add(this.objectGroup);
        this.scene.add(this.colliderOverlay);
        this.scene.add(this.underWaterEffect);
        this.objectGroup.add(this.particleBatcher.root);

        // Create visualizer system (will be recreated when sector changes)
        this.visualizer = new Visualizer(this.scene);
        this.wireEmitterVisibilityHandlers();

        this.physicsWorld = new RAPIER.World(new Vector3(0, 0, -9.8 * 100));
        this.collisionWorld = new CollisionWorld(this.physicsWorld, getCollisionBackend());


        // lightmapped water
        // this.camera.position.set(2187.089541437192, -1232.1649850535432, 110751.03244741965);
        // this.controls.target.set(2183.2765321590364, -3123.9848865795666, 111582.45872830588);


        // // tower planes
        // this.camera.position.set(16317.62354947573, -11492.261077168214, 114151.68197851974);
        // this.controls.orbit.target.set(17908.226612501945, -11639.21923814191, 114223.45684942426);

        // blinking roof
        // this.camera.position.set(20532.18926265955, -11863.06999059111, 117553.43156512016);
        // this.controls.target.set(20532.191127608294, -9998.087698878093, 117553.4315763069);

        // rotating crystal
        // this.camera.position.set(12503.665976183796, -1081.0665384462375, 116917.6052756099);
        // this.controls.target.set(11939.418010659865, -1153.9097602263002, 116384.32683375604);

        // this.camera.position.set(10484.144790506707, -597.9622026194365, 114224.52489243896);
        // this.controls.target.set(17301.599545134217, -3594.4818114739037, 114022.41226029034);

        // // elven ruins colon
        // this.camera.position.set(-113512.77219040602, 235526.6777673793, -3451.3266495528937);
        // this.controls.orbit.target.set(-113585.56931966537, 235592.2972700526, -3471.192671814631);

        // // elven ruins light fixture with two lights
        // this.camera.position.set(-114663.6589876172, -3794.0658040717663, 235906.27471226442);
        // this.controls.orbit.target.set(-114748.37491935505, -3810.9831230352693, 235855.90592005264);

        // // tower ceiling fixture (too red)
        // this.camera.position.set(17589.39507123414, -5841.085927319365, 116621.38351101281);
        // this.controls.orbit.target.set(17611.91280729978, -5819.704399240179, 116526.32678153258);

        // tower outside
        // this.camera.position.set(13202.948810614555, 114479.97315173852, -3573.003864493672);
        // this.controls.orbit.target.set(13298.353862721668, 114463.56670278899, -3547.92988464792);

        // // cruma doors
        // this.camera.position.set(17635.92785265722, 110567.1123199521, -6404.763840433224);
        // this.controls.orbit.target.set(17642.91796377946, 110666.86770886739, -6404.736843065529);

        // // execution grounds necropolis
        // this.camera.position.set(39685.67263674792, -2453.9874334636006, 145466.98825143554);
        // this.controls.orbit.target.set(39689.71781138217, -2528.306592105407, 145400.2027798047);

        // // cruma top
        // this.camera.position.set(17493.974642555284, 20660.858986037056, 112602.20721151105);
        // this.controls.orbit.target.set(17494.774633985846, 20560.86218601999, 112602.20697106984);

        // // talking island
        // this.camera.position.set(-94565.5599208028, 241247.1267543205, -2757.6753131407077);
        // this.controls.orbit.target.set(-94641.92540931691, 241183.01219001279, -2765.2670723330143);

        // // cruma colons
        // this.camera.position.set(15177.670008783623, -1250.655953785669, 110435.92329177055);
        // this.controls.orbit.target.set(15196.267093016691, -1310.1615119775258, 110520.73820444682);

        // // ti - should have terrain light
        // this.camera.position.set(-82762.45963652806, -3191.734390136169, 243599.79809435847);
        // this.controls.orbit.target.set(-82695.39500085678, -3262.698174694781, 243530.66588287643);

        // // world origin
        // this.camera.position.set(20, 20, 20);
        // this.controls.orbit.target.set(0, 0, 0);

        // // look player
        // this.camera.position.set(-87021.22448304677, -3660.4757138727023, 240008.2840185369);
        // this.controls.orbit.target.set(-87086.51708877791, -3685.930229617832, 239936.94718888338);

        // // ti church
        // this.camera.position.set(-85586.61119566132, -2490.4046838818504, 243228.59559104982);
        // this.controls.orbit.target.set(-85561.73216987512, -2537.9950047641682, 243312.95313626213);

        // // ti emitter
        // this.camera.position.set(-85696.00014079512, -3058.804150841089, 242023.70085962766);
        // this.controls.orbit.target.set(-85624.11634173596, -3062.40244455436, 241954.27628389848);

        // // should see moon
        // this.camera.position.set(18345, -3583, 115670);
        // this.controls.orbit.target.set(18443.62146027629, -3569.731060885415, 115660.11350275649);

        // // seam
        // this.camera.position.set(-93965.70166078406, -933.6590151180576, 245523.81285369548);
        // this.controls.orbit.target.set(-94050.79558721324, -982.1451458289137, 245503.61090295907);

        // // horrible performance
        // this.camera.position.set(13773.791753219824, -3153.232327352311, 122575.56746151186);
        // this.controls.orbit.target.set(13761.929509381232, -3152.8878889174143, 122674.86080737793);

        // // gludin can shouldn't see TI
        // this.camera.position.set(-90330.83499953813, -1207.7678030803706, 146939.94639475344);
        // this.controls.orbit.target.set(-90359.97311195015, -1202.9687177995381, 147035.4866437877);

        // // dion castle entrance
        // this.camera.position.set(22052.797714747463, 159177.43425453003, -2671.964680416157);
        // this.controls.orbit.target.set(22051.027404387085, 159277.34078819313, -2668.0212640478444);

        // // ruins floaties
        // this.camera.position.set(-12399.707502148249, 140833.20344635643, -3689.855733687225);
        // this.controls.orbit.target.set(-12493.044965894152, 140869.09225839243, -3690.188948525243);

        // // heine fountain
        // this.camera.position.set(112055.37149242389, 220146.2276990017, -3588.410935323853);
        // this.controls.orbit.target.set(111955.37806611139, 220146.29848444465, -3587.266521191006);

        // // heine gondolas (L2MovementTag movables)
        // this.camera.position.set(112647.60327885527, 217944.6616276716, -3567.649639418127);
        // this.controls.orbit.target.set(112555.89831315387, 217948.10425167627, -3607.378062564142);

        // // catacombs hanging fire bowls (L2MovementTag movables)
        // this.camera.position.set(-50336.06572467676, 81322.44437284899, -4586.177393335977);
        // this.controls.orbit.target.set(-50419.82278206141, 81376.9776969517, -4589.47464985799);

        // // d.elf village emitters
        // this.camera.position.set(12158.026449046782, 20754.01777389806, -4161.473395142065);
        // this.controls.orbit.target.set(12138.27794879715, 20656.34094915463, -4153.152659241246);

        // // mother tree, sprites out of place
        // this.camera.position.set(49328.8568559967, 42729.35547846491, -2762.193021570927);
        // this.controls.orbit.target.set(49252.46811535074, 42664.84372426251, -2760.462740595816);

        // // negropolis near delf forest
        // this.camera.position.set(-48757.64540781602, 81179.19605056658, -4673.552599009336);
        // this.controls.orbit.target.set(-48856.90593897058, 81180.50046917332, -4685.620964557865);

        // // tower of incolsence missing floor piece
        // this.camera.position.set(113246.97446580934, 15207.952910975075, 11869.48379043878);
        // this.controls.orbit.target.set(113312.05364404147, 15251.799469956664, 11807.498470998573);

        // // tree leaf alpha sorting
        // this.camera.position.set(73459.19761207198, 92466.6152928568, -2799.239596681226);
        // this.controls.orbit.target.set(73507.4944756768, 92379.14544429531, -2803.294045912458);

        // this.camera.position.set(-160498.80097106379, 147444.77329136943, -2160.401920637207);
        // this.controls.orbit.target.set(-160411.158574305, 147397.90024984805, -2171.4349741089036);

        // // neighbor sector's water plane floating in front of trees
        // this.camera.position.set(-75102.0413513907, 254532.21528121945, -2647.6340093257513);
        // this.controls.orbit.target.set(-75022.26420482268, 254592.21245772878, -2653.629482315672);

        // // same bug, different sector
        // this.camera.position.set(-94267.46807869655, 90614.94062961312, -2563.8085497287193);
        // this.controls.orbit.target.set(-94325.95049631658, 90695.2733064729, -2575.054342624675);

        // cruma bad light (stale Region -> zoneNumber 0 ambient bug, fixed in un-static-mesh-actor.ts)
        // this.camera.position.set(19547.91987263343, 116964.69226804674, -11334.275986974659);
        // this.controls.orbit.target.set(19646.060323410617, 116958.96763240216, -11352.59757173109);

        // // heine stitching issue
        // this.camera.position.set(124282.49579416064, 229057.06415321256, -2057.6773374747354);
        // this.controls.orbit.target.set(124220.88761327372, 229098.19906750278, -2124.851371700324);

        this.camera.position.set(-87021.22448304677, 240008.2840185369, -3660.4757138727023);
        this.controls.orbit.target.set(-87086.51708877791, 239936.94718888338, -3685.930229617832);

        this.camera.lookAt(this.controls.orbit.target);
        this.controls.orbit.update();

        viewport.appendChild(this.renderer.domElement);

        viewport.addEventListener("mousedown", this.onHandleMouseDown.bind(this));
        viewport.addEventListener("mousemove", this.onHandleMouseMove.bind(this));
        viewport.addEventListener("mouseup", this.onHandleMouseUp.bind(this));
        window.addEventListener("keydown", this.onHandleKeyDown.bind(this));
        window.addEventListener("keyup", this.onHandleKeyUp.bind(this));
        this.controls.fps.addEventListener("lock", this.onPointerControlsLocked.bind(this));
        this.controls.fps.addEventListener("unlock", this.onPointerControlsUnlocked.bind(this));

        if (!this.isOrbitControls) {
            this.controls.orbit.enabled = false;
            this.controls.fps.lock();
        }

        this.scene.add(this.player);
        this.player.name = "Player";
        // this.player.visible = false;
        // this.player.position.set(-87063.33997244012, -3257.2213744465607, 239964.66910649382);   // outside village
        // this.player.position.set(-87063.33997244012, -3637.2213744465607, 239964.66910649382);   // outside village
        this.player.position.set(-87063.33997244012, 239964.66910649382, -3637.2213744465607);   // outside village
        // this.player.position.set(-85824.17160558623, -2420.568413807578+100, 247100.09013224754); // on the hill

        addResizeListeners(this);
    }

    public setEnv(env: EnvInfo): this {
        const environment = this.environment = new L2Environment(env);
        const self = this;

        const timeState = {
            get time() { return environment.getTimeOfDay(); },
            set time(v) {
                environment.setTimeOfDay(v);
                self.needsUpdate = true;
            },
            get timeScale() { return environment.getTimeScale(); },
            set timeScale(v) {
                environment.setTimeScale(v);
                self.needsUpdate = true;
            }
        };

        guiFolders.world.add(timeState, "time", 0, 24, 0.01)
            .name("Time")
            .listen();
        guiFolders.world.add(timeState, "timeScale", 0, 100, 0.01)
            .name("Time Scale");

        const envSignsSkyState = {
            get signsSky() { return environment.getActiveEnv(); },
            set signsSky(v) {
                environment.setActiveEnv(Number(v) as 0 | 1 | 2);
                self.needsUpdate = true;
            }
        };

        guiFolders.world.add(envSignsSkyState, "signsSky", { "Normal": 0, "Dusk": 1, "Dawn": 2 })
            .name("Signs Sky");

        return this;
    }

    public debugPrintCamera() {
        console.log([
            `this.camera.position.set(${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z});`,
            `this.controls.orbit.target.set(${this.controls.orbit.target.x}, ${this.controls.orbit.target.y}, ${this.controls.orbit.target.z});`
        ].join("\n"));
    }

    public takeScreenshot() {
        this.renderer.domElement.toBlob((blob) => {
            if (!blob) return;

            window.open(URL.createObjectURL(blob), "_blank");
        }, "image/jpeg", 0.98);
    }

    public onPointerControlsLocked() {
        this.isOrbitControls = false;
        this.controls.orbit.enabled = false;

        Object.keys(this.dirKeys).forEach((k: "up" | "left" | "right" | "down" | "shift") => this.dirKeys[k] = false);

    }

    public onPointerControlsUnlocked() {
        this.isOrbitControls = true;
        this.controls.orbit.enabled = true;
        this.controls.fps.getDirection(this.controls.orbit.target).multiplyScalar(100).add(this.camera.position);
        this.controls.orbit.update();
        Object.keys(this.dirKeys).forEach((k: "up" | "left" | "right" | "down" | "shift") => this.dirKeys[k] = false);
    }

    public toScreenSpaceCoords(point: Vector2) {
        const bounds = this.renderer.domElement.getBoundingClientRect();

        return new Vector2(
            (point.x - bounds.left) / bounds.width * 2 - 1,
            1 - (point.y - bounds.top) / bounds.height * 2
        );
    }

    public onHandleKeyDown(event: KeyboardEvent) {
        if (document.activeElement?.tagName === "INPUT")
            return;

        // Handle F1 separately to prevent browser help (must be before switch)
        if (event.key === "F1" || event.code === "F1") {
            event.preventDefault();
            event.stopPropagation();
            this.toggleBSPHelperCamera();
            return;
        }

        // Handle F2 to toggle frustum culling
        if (event.key === "F2" || event.code === "F2") {
            event.preventDefault();
            event.stopPropagation();
            this.frustumCullingEnabled = !this.frustumCullingEnabled;
            console.log(`Frustum culling is now: ${this.frustumCullingEnabled}`);
            return;
        }

        // Handle F3 to toggle visualizer
        if (event.key === "F3" || event.code === "F3") {
            event.preventDefault();
            event.stopPropagation();
            this.visualizer.toggle();
            const currentSector = this.getSector(this.camera.position);
            if (currentSector && this.visualizer.isEnabled()) {
                const cameraPos = this.bspHelperActive && this.bspHelperCamera ? this.bspHelperCamera.position : this.camera.position;
                const cameraFrustum = this.bspHelperActive && this.bspHelperCamera
                    ? new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(this.bspHelperCamera.projectionMatrix, this.bspHelperCamera.matrixWorldInverse))
                    : this.frustum;

                // Create a map with only the current sector
                const currentSectorMap = new Map<number, Map<number, SectorObject>>();
                if (currentSector.index) {
                    const sectorXMap = new Map<number, SectorObject>();
                    sectorXMap.set(currentSector.index.y, currentSector);
                    currentSectorMap.set(currentSector.index.x, sectorXMap);
                }

                if (this.visualizer.getMode() === VisualizerMode.Portals) {
                    this.visualizer.updatePortals(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Zones) {
                    this.visualizer.updateZones(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Leaves) {
                    this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
                } else if (this.visualizer.getMode() === VisualizerMode.Fogs) {
                    this.visualizer.updateFogs(currentSectorMap, this.activeFogId || undefined);
                }

                if (this.visualizer.getMode() !== VisualizerMode.Fogs) {
                    this.visualizer.updateFogs(currentSectorMap, this.activeFogId || undefined);
                }
            }
            return;
        }

        // Handle F4 to cycle visualizer modes
        if (event.key === "F4" || event.code === "F4") {
            event.preventDefault();
            event.stopPropagation();
            this.visualizer.nextMode();
            const currentSector = this.getSector(this.camera.position);
            if (currentSector && this.visualizer.isEnabled()) {
                const cameraPos = this.bspHelperActive && this.bspHelperCamera ? this.bspHelperCamera.position : this.camera.position;
                const cameraFrustum = this.bspHelperActive && this.bspHelperCamera
                    ? new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(this.bspHelperCamera.projectionMatrix, this.bspHelperCamera.matrixWorldInverse))
                    : this.frustum;

                // Create a map with only the current sector
                const currentSectorMap = new Map<number, Map<number, SectorObject>>();
                if (currentSector.index) {
                    const sectorXMap = new Map<number, SectorObject>();
                    sectorXMap.set(currentSector.index.y, currentSector);
                    currentSectorMap.set(currentSector.index.x, sectorXMap);
                }

                if (this.visualizer.getMode() === VisualizerMode.Portals) {
                    this.visualizer.updatePortals(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Zones) {
                    this.visualizer.updateZones(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Leaves) {
                    this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
                } else if (this.visualizer.getMode() === VisualizerMode.Fogs) {
                    this.visualizer.updateFogs(currentSectorMap, this.activeFogId || undefined);
                }

                if (this.visualizer.getMode() !== VisualizerMode.Fogs) {
                    this.visualizer.updateFogs(currentSectorMap, this.activeFogId || undefined);
                }
            }
            return;
        }

        // Handle F5 to cycle leaf visualizer detail (Auto / PerLeaf / PerZone)
        if (event.key === "F5" || event.code === "F5") {
            event.preventDefault();
            event.stopPropagation();
            this.visualizer.nextLeafDetail();

            // If we're currently in Leaves mode and visualizer is enabled, refresh the visualization immediately.
            const currentSector = this.getSector(this.camera.position);
            if (currentSector && this.visualizer.getMode() === VisualizerMode.Leaves && this.visualizer.isEnabled()) {
                const cameraPos = this.bspHelperActive && this.bspHelperCamera ? this.bspHelperCamera.position : this.camera.position;
                const cameraFrustum = this.bspHelperActive && this.bspHelperCamera
                    ? new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(this.bspHelperCamera.projectionMatrix, this.bspHelperCamera.matrixWorldInverse))
                    : this.frustum;

                // Create a map with only the current sector
                const currentSectorMap = new Map<number, Map<number, SectorObject>>();
                if (currentSector.index) {
                    const sectorXMap = new Map<number, SectorObject>();
                    sectorXMap.set(currentSector.index.y, currentSector);
                    currentSectorMap.set(currentSector.index.x, sectorXMap);
                }

                this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
            }
            return;
        }

        switch (event.key.toLowerCase()) {
            case "1":
                this.cancelMusic();
                this.camera.position.set(13202.948810614555, 114479.97315173852, -3573.003864493672);
                this.controls.orbit.target.set(13298.353862721668, 114463.56670278899, -3547.92988464792);
                this.controls.orbit.update();
                break;
            case "2":
                this.cancelMusic();
                this.camera.position.set(17046.05501814811, 117471.20102308583, -12013.89353241769);
                this.controls.orbit.target.set(17083.7099694609, 117384.69022352276, -11980.75765759009);
                this.controls.orbit.update();
                break;
            case "3":
                this.cancelMusic();
                this.camera.position.set(15242.674545699758, 110436.41811293362, -12078.741557239728);
                this.controls.orbit.target.set(15174.047463755987, 110487.88810239462, -12027.349302874225);
                this.controls.orbit.update();
                break;
            case "4":
                this.cancelMusic();
                this.camera.position.set(12918.803737500606, 109998.28664096774, -11769.26992456535);
                this.controls.orbit.target.set(12961.940094338941, 110631.6332572824, -11789.664021556502);
                this.controls.orbit.update();
                break;
            case "5":
                this.cancelMusic();
                this.camera.position.set(23756.20212599347, 116491.99214326135, -8869.681711370744);
                this.controls.orbit.target.set(23753.308437823456, 116591.94542046914, -8868.697361740096);
                this.controls.orbit.update();
                break;
            case "6":
                this.cancelMusic();
                this.camera.position.set(17436.46445202629, 109469.23150265992, -6351.127037466889);
                this.controls.orbit.target.set(18965.828211115713, 106770.89206042158, -6064.126549127763);
                this.controls.orbit.update();
                break;
            case "+": this.nextSector(); break;
            case "-": this.prevSector(); break;
            case "w": if (!this.isOrbitControls) this.dirKeys.up = true; break;
            case "a": if (!this.isOrbitControls) this.dirKeys.left = true; break;
            case "d": if (!this.isOrbitControls) this.dirKeys.right = true; break;
            case "s": if (!this.isOrbitControls) this.dirKeys.down = true; break;
            case "shift": if (!this.isOrbitControls) {
                this.shiftTimeDown = Date.now();
                this.dirKeys.shift = true;
            } break;
            case "t": this.player.teleportTo(this.camera.position); break;

        }
    }

    protected cancelMusic() {
        this.activeMusicId = null;
        this.audioManager.cancelMusic();
    }

    protected setSector(index: number) {
        const sector = this.sectorBounds[index];

        this.cancelMusic();
        this.camera.position.copy(sector.max);
        this.controls.orbit.target.copy(sector.min).sub(sector.max).setLength(100).add(sector.max);
        this.controls.orbit.update();

        this.activeSector = index;
    }

    protected nextSector() {
        if (this.sectorBounds.length <= 0) return;

        this.setSector((this.activeSector + 1) % this.sectorBounds.length);
    }

    protected prevSector() {
        if (this.sectorBounds.length <= 0) return;

        this.setSector(this.activeSector === 0 ? (this.sectorBounds.length - 1) : (this.activeSector - 1))
    }

    public onHandleKeyUp(event: KeyboardEvent) {
        switch (event.key.toLowerCase()) {
            case "c":
                if (this.isOrbitControls) this.controls.fps.lock();
                else this.controls.fps.unlock();
                break;
            case "w": if (!this.isOrbitControls) this.dirKeys.up = false; break;
            case "a": if (!this.isOrbitControls) this.dirKeys.left = false; break;
            case "d": if (!this.isOrbitControls) this.dirKeys.right = false; break;
            case "s": if (!this.isOrbitControls) this.dirKeys.down = false; break;
            case "shift": if (!this.isOrbitControls) this.dirKeys.shift = false; break;
        }
    }

    protected movePlayerTo(position: Vector3) {
        this.player.goTo(position);
    }

    public onHandleMouseDown(event: MouseEvent) {
        if (event.button !== 0 || !this.isOrbitControls) return;

        this.isPrimaryMouseDown = true;
        this.hasMouseDragged = false;
        this.mouseDownPosition.set(event.clientX, event.clientY);
    }

    public onHandleMouseMove(event: MouseEvent) {
        if (!this.isPrimaryMouseDown || this.hasMouseDragged) return;

        const dx = event.clientX - this.mouseDownPosition.x;
        const dy = event.clientY - this.mouseDownPosition.y;

        if (dx * dx + dy * dy > CLICK_MAX_MOVEMENT_SQ) this.hasMouseDragged = true;
    }

    public onHandleMouseUp(event: MouseEvent) {
        if (event.button !== 0) return;

        const dx = event.clientX - this.mouseDownPosition.x;
        const dy = event.clientY - this.mouseDownPosition.y;
        const isClick = this.isPrimaryMouseDown && !this.hasMouseDragged && dx * dx + dy * dy <= CLICK_MAX_MOVEMENT_SQ;

        this.isPrimaryMouseDown = false;

        if (!isClick || !this.isOrbitControls) return;

        try {
            const position = new Vector2(event.clientX, event.clientY);
            const ssPosition = this.toScreenSpaceCoords(position);

            this.raycaster.setFromCamera(ssPosition, this.camera);

            const pickDistance = this.getPickDistance(this.raycaster.ray.origin, this.raycaster.ray.direction);
            const physicsIntersection = pickDistance > 0 ? this.collisionWorld.rayCheck(this.raycaster.ray.origin, this.raycaster.ray.direction, pickDistance, this.player.getCollider(), this.player.getRigidbody()) : null;

            if (physicsIntersection) {
                tmpMouseIntersection.copy(physicsIntersection.location);
                this.movePlayerTo(tmpMouseIntersection);

                console.log(physicsIntersection.actor, physicsIntersection);
            } else if (pickDistance > 0) {
                // UInteraction::ScreenToWorld (0x855ee0) deprojects to a direction, not a hit location
                this.movePlayerTo(tmpMouseIntersection.copy(this.raycaster.ray.direction).multiplyScalar(pickDistance).add(this.raycaster.ray.origin));
            }

            this.pickBSPNode(physicsIntersection ? physicsIntersection.distance : pickDistance);
        } catch (e) {
            console.error(e);
        }
    }

    // camera.far is the depth-buffer far, not a world distance; clip the pick to loaded sectors
    protected getPickDistance(origin: Vector3, direction: Vector3): number {
        if (this.sectorBounds.length === 0) return this.camera.far;

        tmpPickBounds.makeEmpty();

        for (const bounds of this.sectorBounds) tmpPickBounds.union(bounds);

        let near = 0, far = this.camera.far;

        for (let axis = 0; axis < 3; axis++) {
            const delta = direction.getComponent(axis);
            const start = origin.getComponent(axis);
            const min = tmpPickBounds.min.getComponent(axis);
            const max = tmpPickBounds.max.getComponent(axis);

            if (Math.abs(delta) < 1e-12) {
                if (start < min || start > max) return 0;
                continue;
            }

            let a = (min - start) / delta, b = (max - start) / delta;

            if (a > b) [a, b] = [b, a];

            near = Math.max(near, a);
            far = Math.min(far, b);

            if (near > far) return 0;
        }

        return far;
    }

    protected pickBSPNode(maxDistance: number) {
        arrBSPGroups.length = 0;
        arrBSPIntersections.length = 0;

        this.sectors.forEach(column => column.forEach(sector => {
            if (sector.bspGroup) arrBSPGroups.push(sector.bspGroup);
        }));

        if (arrBSPGroups.length === 0) return;

        const prevFar = this.raycaster.far;

        this.raycaster.far = maxDistance;
        this.raycaster.intersectObjects(arrBSPGroups, true, arrBSPIntersections);
        this.raycaster.far = prevFar;

        if (arrBSPIntersections.length === 0) return;

        const intersection = arrBSPIntersections[0];
        const geometry = (intersection.object as THREE.Mesh).geometry;
        const nodeIndexAttr = geometry.attributes.nodeIndex;

        if (!nodeIndexAttr) return;

        const indexAttr = geometry.index;
        const vertexIndex = indexAttr ? indexAttr.getX(intersection.faceIndex * 3) : intersection.faceIndex * 3;

        console.log(intersection, `Node ID: ${nodeIndexAttr.getX(vertexIndex)}`);
    }

    public setSize(width: number, height: number, updateStyle?: boolean) {
        this.pixelRatio = global.devicePixelRatio;

        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(width, height, updateStyle);

        this.lastSize.set(width, height);
    }

    protected onHandleResize(): void {
        const oldStyle = this.getDomElement().style.display;
        this.getDomElement().style.display = "none";
        const { width, height } = this.viewport.getBoundingClientRect();

        const aspect = width / height;
        this.camera.aspect = aspect;

        // Convert horizontal FOV to vertical FOV for Three.js PerspectiveCamera
        // Formula: vFOV = 2 * atan(tan(hFOV / 2) / aspect)
        const hFOV = MathUtils.degToRad(DEFAULT_HORIZONTAL_FOV);
        const vFOV = 2 * Math.atan(Math.tan(hFOV / 2) / aspect);
        this.camera.fov = MathUtils.radToDeg(vFOV);

        if (this.bspHelperCamera) {
            this.bspHelperCamera.aspect = aspect;
            this.bspHelperCamera.fov = this.camera.fov;
            this.bspHelperCamera.updateProjectionMatrix();
        }

        this.camera.updateProjectionMatrix();
        this.setSize(width, height);

        const pixelRatio = this.pixelRatio;
        // Use client dims * pixelRatio for render targets
        const targetWidth = Math.floor(width); // setSize handles ratio internally usually, but here width is bounding rect width. 
        // Wait, setSize at 547 uses renderer.setSize(width, height).
        // renderer.setSize updates the canvas. 
        // RenderTargets need exact pixel size.
        const rtWidth = width * pixelRatio;
        const rtHeight = height * pixelRatio;

        this.mainRenderTarget.setSize(rtWidth, rtHeight);
        this.uGlowPass.setSize(rtWidth, rtHeight);
        this.displayGammaPass.setSize(rtWidth, rtHeight);
        this.getDomElement().style.display = oldStyle;
        this.needsUpdate = true;
    }

    protected onHandleRender(currentTime: number): void {
        const deltaTime = currentTime - this.lastRender;
        const isFrameDirty = this.isPersistentRendering || this.needsUpdate;

        if (isFrameDirty) {
            stats.begin();
            this._preRender(currentTime, deltaTime);
            this._doRender(currentTime, deltaTime);
            this._postRender(currentTime, deltaTime);
            stats.end();
            this.needsUpdate = false;
        }

        this.lastRender = currentTime;

        requestAnimationFrame(this.onHandleRender.bind(this));
    }

    public enableZoneCulling = true;

    public getSectorId(position: THREE.Vector3): [number, number] {
        const sectorSize = 256 * 128;
        const sectorX = Math.floor(position.x / sectorSize) + 20;
        const sectorY = Math.floor(position.y / sectorSize) + 18;

        return [sectorX, sectorY];
    }

    public getSector(position: THREE.Vector3): SectorObject | null {
        return this.getSectorByCoords(...this.getSectorId(position));
    }

    public getSectorByCoords(sectorX: number, sectorY: number): SectorObject | null {
        if (!this.sectors.has(sectorX))
            return null;

        const xsect = this.sectors.get(sectorX);

        if (!xsect.has(sectorY))
            return null;

        return xsect.get(sectorY);
    }

    // F4 Emitters HUD feed, nearest first - capped since each entry redraws a canvas-texture label
    private static readonly EMITTER_DEBUG_MAX = 80;

    public collectEmitterDebugInfo(): EmitterDebugInfo[] {
        const cameraPosition = this.camera.position;
        const currentSector = this.getSector(cameraPosition);
        const results: EmitterDebugInfo[] = [];

        this.scene.traverse(obj => {
            const emitter = obj as any;
            if (!emitter.particlePool) return;

            // only the sector the camera is actually in, not streamed-in neighbors
            let sectorParent = emitter.parent;
            while (sectorParent && !sectorParent.isSectorObject) sectorParent = sectorParent.parent;
            if (sectorParent !== currentSector) return;

            const worldPos = new Vector3().setFromMatrixPosition(emitter.matrixWorld);
            const isVisible = emitter.visible && (emitter.instancedMesh
                ? !!emitter.instancedMesh.visible
                : (emitter.particlePool as any[]).some((p: any) => p.visible));

            results.push({
                uuid: emitter.uuid,
                name: emitter.name || emitter.uuid,
                type: emitter.constructor?.name ?? "Emitter",
                worldPos,
                distance: worldPos.distanceTo(cameraPosition),
                activeCount: emitter.activeCount ?? 0,
                maxParticles: emitter.maxParticles ?? 0,
                isDisabled: !!emitter.isDisabled,
                isVisible,
                isManuallyHidden: this.manuallyHiddenEmitterUuids.has(emitter.uuid),
                parentUuid: emitter.parent?.uuid ?? "",
                parentName: emitter.parent?.name || "?",
            });
        });

        results.sort((a, b) => a.distance - b.distance);
        return results.slice(0, RenderManager.EMITTER_DEBUG_MAX);
    }

    // The BSP offscreen freeze only ever touches instancedMesh.visible/particle.visible, never the emitter's own .visible, so this sticks.
    public setEmitterVisible(uuid: string, visible: boolean): void {
        if (visible) this.manuallyHiddenEmitterUuids.delete(uuid);
        else this.manuallyHiddenEmitterUuids.add(uuid);

        const obj = this.scene.getObjectByProperty("uuid", uuid);
        if (obj) obj.visible = visible;
        this.needsUpdate = true;
    }

    public setAllEmittersVisible(visible: boolean): void {
        this.scene.traverse(obj => {
            if (!(obj as any).particlePool) return;
            if (visible) this.manuallyHiddenEmitterUuids.delete(obj.uuid);
            else this.manuallyHiddenEmitterUuids.add(obj.uuid);
            obj.visible = visible;
        });
        this.needsUpdate = true;
    }

    public async addCharacterControls(): Promise<void> {
        const groups = await this.assetManager.getCharGroups();
        const state = { group: this.characterGroup, face: this.characterFace, hair: this.characterHair, hairColour: this.characterHairColour, chest: this.characterArmor.chest, legs: this.characterArmor.legs, gloves: this.characterArmor.gloves, boots: this.characterArmor.boots };
        const groupOptions: Record<string, number> = {};
        const folder = gui.addFolder("Character");

        for (const group of groups)
            groupOptions[group.name] = group.index;

        let faceControl: dat.GUIController = null;
        let hairControl: dat.GUIController = null;
        let hairColourControl: dat.GUIController = null;
        let armorControls: dat.GUIController[] = [];

        const applyCharacter = () => this.assetManager.loadCharacter(this, this.characterGroup, this.characterFace, this.characterHair, this.characterHairColour, this.characterArmor);

        const buildArmorControls = () => {
            const group = groups[this.characterGroup];

            armorControls.forEach(control => folder.remove(control));
            armorControls = [];

            for (const slot of Object.keys(this.characterArmor) as (keyof GD.ICharacterArmorSelection)[]) {
                const options: Record<string, number> = { None: 0 };

                for (const item of group.armor[slot])
                    options[item.label] = item.id;

                state[slot] = this.characterArmor[slot];
                armorControls.push(folder.add(state, slot, options).name(slot[0].toUpperCase() + slot.slice(1)).onChange(async v => {
                    this.characterArmor[slot] = Number(v);
                    await applyCharacter();
                }));
            }
        };

        // a style only ships some of the colours, so the colour options get rebuilt whenever the style changes
        const buildColourControl = () => {
            const colours = groups[this.characterGroup].hairColours[this.characterHair];

            if (hairColourControl) folder.remove(hairColourControl);

            state.hairColour = this.characterHairColour = colours.includes(this.characterHairColour) ? this.characterHairColour : colours[0];

            hairColourControl = folder.add(state, "hairColour", colours).name("Hair Color").onChange(async v => {
                this.characterHairColour = Number(v);
                await applyCharacter();
            });
        };

        const buildVariantControls = () => {
            const group = groups[this.characterGroup];

            if (faceControl) folder.remove(faceControl);
            if (hairControl) folder.remove(hairControl);

            state.face = this.characterFace = Math.min(this.characterFace, group.faceVariants - 1);
            state.hair = this.characterHair = group.hairStyles.includes(this.characterHair) ? this.characterHair : group.hairStyles[0];

            const faceOptions = Array.from({ length: group.faceVariants }, (_, i) => i);

            faceControl = folder.add(state, "face", faceOptions).name("Face").onChange(async v => {
                this.characterFace = Number(v);
                await applyCharacter();
            });

            hairControl = folder.add(state, "hair", group.hairStyles).name("Hair").onChange(async v => {
                this.characterHair = Number(v);
                buildColourControl();
                await applyCharacter();
            });

            buildColourControl();
            buildArmorControls();
        };

        folder.add(state, "group", groupOptions).name("Character").onChange(async v => {
            this.characterGroup = Number(v);
            this.characterArmor = { chest: 0, legs: 0, gloves: 0, boots: 0 };
            buildVariantControls();
            await applyCharacter();
        });

        folder.add(this, "followPlayer").name("Follow Player").onChange(() => this.needsUpdate = true);
        folder.add({ simulate: () => this.simulatePawns() }, "simulate").name("Simulate Pawns");

        buildVariantControls();
        folder.open();
    }

    public addClippingRangeControls(): void {
        const clippingRange = this.assetManager.userConfig.clippingRange;

        guiFolders.quality.add(clippingRange, "actor", 1, 12, 0.5)
            .name("Emitter Range")
            .onChange(() => {
                this.sectors.forEach(column => column.forEach(sector => (sector as any).visibilityCacheInitialized = false));
                this.needsUpdate = true;
            });
    }

    public addDisplayGammaControls(): void {
        const display = this.assetManager.userConfig.display;
        display.gamma = 0;

        const steps = GAMMA_STEPS.reduce((acc, g) => (acc[g.toFixed(1)] = g, acc), { "off": 0 } as Record<string, number>);

        guiFolders.quality.add(display, "gamma", steps)
            .name("Gamma")
            .onChange(v => {
                display.gamma = parseFloat(v as any);
                this.displayGammaEnabled = display.gamma !== 0;

                if (this.displayGammaEnabled) this.displayGammaPass.setRamp(display);

                this.needsUpdate = true;
            });
    }

    private wireEmitterVisibilityHandlers(): void {
        this.visualizer.setEmitterVisibilityHandlers(
            (uuid, visible) => this.setEmitterVisible(uuid, visible),
            (visible) => this.setAllEmittersVisible(visible)
        );
    }

    protected scheduleMovableObject(mover: MovableObject, nextUpdate: number): void {
        this.activeMovableObjects.delete(mover);
        this.waitingMovableObjects.delete(mover);

        if (nextUpdate === 0) this.activeMovableObjects.add(mover);
        else if (nextUpdate > 0) this.waitingMovableObjects.set(mover, nextUpdate);
    }

    protected updateMovableObjects(currentTime: number): void {
        if (!this.lastMoverTriggerPosition.equals(this.camera.position)) {
            this.lastMoverTriggerPosition.copy(this.camera.position);

            this.movableObjects.forEach(mover => {
                const nextUpdate = mover.tryTrigger(currentTime, this.camera.position);

                if (nextUpdate !== null) this.scheduleMovableObject(mover, nextUpdate);
            });
        }

        for (const [mover, wakeTime] of Array.from(this.waitingMovableObjects)) {
            if (currentTime >= wakeTime)
                this.scheduleMovableObject(mover, mover.updateMover(currentTime));
        }

        for (const mover of Array.from(this.activeMovableObjects))
            this.scheduleMovableObject(mover, mover.updateMover(currentTime));
    }

    public async simulatePawns(count: number = SIMULATED_PAWN_COUNT) {
        const groups = this.simCharGroups || (this.simCharGroups = await this.assetManager.getCharGroups());
        let next = 0;

        // a character decode is seconds long and ten at once starves the worker pool, so they load
        // a few at a time and each pawn enters the world as soon as its own model is ready
        const worker = async () => {
            while (next < count) {
                const index = next++;
                const group = groups[Math.floor(Math.random() * groups.length)];
                const hair = group.hairStyles[Math.floor(Math.random() * group.hairStyles.length)];
                const colours = group.hairColours[hair];
                const armor: GD.ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 };
                const pawn = new Player(this);

                for (const slot of Object.keys(armor) as (keyof GD.ICharacterArmorSelection)[]) {
                    const items = group.armor[slot];

                    armor[slot] = items.length > 0 && Math.random() < 0.75 ? items[Math.floor(Math.random() * items.length)].id : 0;
                }

                pawn.name = `SimPawn${index}`;

                await this.assetManager.loadCharacter(this, group.index, Math.floor(Math.random() * group.faceVariants), hair, colours[Math.floor(Math.random() * colours.length)], armor, pawn);

                this.scene.add(pawn);
                pawn.position.copy(this.controls.orbit.target);
                pawn.updateMatrixWorld(true);
                this.registerCollider(pawn);
                pawn.ignoreOverlappingActors(Array.from(this.simulatedPawns, entry => entry.pawn).concat(this.player));
                this.simulatedPawns.add({ pawn, expires: performance.now() + SIMULATED_PAWN_LIFETIME, nextTurn: 0 });
                this.needsUpdate = true;
            }
        };

        await Promise.all(Array.from({ length: SIMULATED_PAWN_CONCURRENCY }, worker));
    }

    protected updateSimulatedPawns(currentTime: number, deltaTime: number): void {
        for (const entry of Array.from(this.simulatedPawns)) {
            if (currentTime >= entry.expires) {
                this.unregisterCollider(entry.pawn);
                entry.pawn.release();
                this.scene.remove(entry.pawn);
                this.simulatedPawns.delete(entry);
                continue;
            }

            if (currentTime < entry.nextTurn) continue;

            entry.nextTurn = currentTime + SIMULATED_PAWN_TURN_INTERVAL;

            const angle = Math.random() * Math.PI * 2;

            entry.pawn.moveInDirection(tmpSimDirection.set(Math.cos(angle), Math.sin(angle), 0));
        }

        for (const entry of this.simulatedPawns) entry.pawn.update(this, currentTime, deltaTime / 1000);

        if (this.simulatedPawns.size > 0) this.needsUpdate = true;
    }

    protected updateRotatingObjects(deltaTime: number): void {
        this.rotatingObjects.forEach(object => object.updateRotation(deltaTime));
    }

    protected updateSectorRenderOrder(activeSector: SectorObject | null): void {
        if (activeSector === this.lastRenderOrderSector) return;

        this.lastRenderOrderSector = activeSector;

        // batch meshes (and BSP section meshes - their geometry is baked in world space, so matrixWorld
        // is the identity origin and three's per-object z-sort is meaningless) project the sector origin
        // for depth, so cross-sector transparent order rides on groupOrder - camera sector draws last
        this.sectors.forEach(row => row.forEach(sector => {
            const order = sector === activeSector ? 0 : -1;
            if (sector.staticMeshGroup) sector.staticMeshGroup.renderOrder = order;
            if (sector.bspGroup) sector.bspGroup.renderOrder = order;
        }));
    }

    // pawns move freely across sector boundaries, so unlike StaticMeshActor (leaf-baked at decode
    // time into whichever sector's grid cell it fell in) their portal/leaf visibility has to be
    // resolved live against wherever they currently are, not the sector they happen to be parented under
    protected updatePawnVisibility(): void {
        this.sectors.forEach(row => row.forEach(sector => {
            for (const pawn of sector.pawns.children) {
                pawn.getWorldPosition(tmpPawnWorldPos);

                const containingSector = this.getSector(tmpPawnWorldPos);

                if (!containingSector) {
                    pawn.visible = false;
                    continue;
                }

                const leafIndex = containingSector.findPositionLeaf(tmpPawnWorldPos);

                pawn.visible = leafIndex !== null && containingSector.visibleLeaves.has(leafIndex);
            }
        }));
    }

    // actor meshes carry no baked lighting stream, they take the ambient of whatever zone they
    // stand in plus hardware lights (USkeletalMeshInstance::Render, UnSkeletalMesh.cpp line 4908)
    protected updatePawnLighting(): void {
        const sunAmbient = this.environment.getAmbientPlaneActorLightHalved(tmpPawnSunAmbient);

        this.sectors.forEach(row => row.forEach(sector => {
            for (const pawn of sector.pawns.children)
                if (pawn.visible) this.updateActorLighting(pawn, sunAmbient);
        }));

        this.updateActorLighting(this.player, sunAmbient);
        this.updatePawnShadow();

        for (const entry of this.simulatedPawns)
            this.updateActorLighting(entry.pawn, sunAmbient);
    }

    // AShadowProjector::UpdateLightInfo (0x9363d0): the sun by day, straight overhead otherwise -
    // never the actor's own lights. lowpoly: player only, upgrade when NPCs cast
    protected updatePawnShadow(): void {
        const timeOfDay = this.environment.getTimeOfDay();

        this.player.getWorldPosition(tmpPawnWorldPos);

        const sector = this.getSector(tmpPawnWorldPos);
        // the env sun, not the pawn's own light list - retail takes it globally and only drops to
        // straight overhead when it is not day
        const sun = sector && timeOfDay >= 7 && timeOfDay < 23 ? sector.lightList.find(light => light.isSunlight) : null;

        if (sun) tmpShadowDirection.copy(sun.lightDirection).normalize();
        else tmpShadowDirection.set(0, 0, -1);

        // z is forced to at least half of x so a grazing sun cannot rake the shadow across the world
        const minVertical = Math.abs(tmpShadowDirection.x) * 0.5;

        if (minVertical >= Math.abs(tmpShadowDirection.z))
            tmpShadowDirection.z = tmpShadowDirection.z < 0 ? -minVertical : minVertical;

        arrShadowCasters.length = 0;
        arrShadowCasters.push(this.player);

        for (const entry of this.simulatedPawns) arrShadowCasters.push(entry.pawn);

        if (sector) for (const pawn of sector.pawns.children) arrShadowCasters.push(pawn);

        this.shadowProjector.update(this.renderer, this.player, arrShadowCasters, tmpShadowDirection);
    }

    protected updateActorLighting(actor: THREE.Object3D, sunAmbient: ColorByte): void {
        actor.getWorldPosition(tmpPawnWorldPos);

        const sector = this.getSector(tmpPawnWorldPos);

        if (!sector) return;

        const zoneIndex = sector.findPositionZone(tmpPawnWorldPos);
        const zoneInfo = zoneIndex === null ? null : sector.bspZones[zoneIndex]?.zoneInfo;
        const lights = sector.getRelevantLights(tmpPawnWorldPos, PAWN_LIGHTING_RADIUS, arrPawnLights, NUM_ACTOR_LIGHTS, !!zoneInfo?.isSunAffected);

        actor.traverse(object => {
            if ((object as LitSkinnedMesh).isLitSkinnedMesh)
                (object as LitSkinnedMesh).updateActorLighting(zoneInfo, lights, sunAmbient);
        });
    }

    protected _updateObjects(currentTime: number, deltaTime: number) {
        this.visibleWorldBatchEmitters.length = 0;
        this.neighborVisibilitySectors.length = 0;
        this.dropDetail = deltaTime > DROP_DETAIL_FRAME_TIME_MS;
        this.aggressiveLod = deltaTime > AGGRESSIVE_LOD_FRAME_TIME_MS;
        this.emitterDetailFrame = (this.emitterDetailFrame + 1) % 6;

        const offscreenEmitterUpdateLimit = this.aggressiveLod
            ? 0
            : this.dropDetail
                ? DROP_DETAIL_OFFSCREEN_EMITTER_UPDATES
                : MAX_OFFSCREEN_EMITTER_UPDATES;
        let offscreenEmitterUpdates = 0;

        GLOBAL_UNIFORMS.globalTimeSeconds.value = currentTime / 1000;

        const ambientSun = this.environment.getAmbientPlaneStaticMeshSunLightHalved(tmpColorByte);
        const sunColor = this.environment.getBaseColorPlaneStaticMeshSunLightScaled(tmpColorByte_2);
        (GLOBAL_UNIFORMS.staticMeshSunAmbient.value as Vector3).set(
            (ambientSun.r + sunColor.r) / 255,
            (ambientSun.g + sunColor.g) / 255,
            (ambientSun.b + sunColor.b) / 255
        );

        // camera-facing billboard basis, computed once and shared as a uniform (was per-particle in sprite-emitter.ts's onBeforeRender)
        {
            const camera = this.camera;
            const projUp = tmpBillboardUp.copy(camera.up).normalize();
            const projFront = tmpBillboardFront.set(0, 0, 1).applyQuaternion(camera.quaternion).normalize();
            const projRight = tmpBillboardRight.crossVectors(projFront, projUp).normalize();
            projUp.crossVectors(projRight, projFront).normalize();
            (GLOBAL_UNIFORMS.cameraBillboardRight.value as Vector3).copy(projRight);
            (GLOBAL_UNIFORMS.cameraBillboardUp.value as Vector3).copy(projUp);
        }

        // Update helper camera: copy from main camera if inactive, otherwise keep frozen
        if (this.bspHelperCamera) {
            if (!this.bspHelperActive) {
                // Helper is inactive: copy main camera properties for culling
                this.bspHelperCamera.position.copy(this.camera.position);
                this.bspHelperCamera.rotation.copy(this.camera.rotation);
                this.bspHelperCamera.updateMatrixWorld(true);
                if (this.bspHelperCameraHelper) {
                    this.bspHelperCameraHelper.visible = false;
                }
            } else {
                // Helper is active: keep frozen, make helper visible
                if (this.bspHelperCameraHelper) {
                    this.bspHelperCameraHelper.visible = true;
                }
            }
            // Update helper visual indicator
            if (this.bspHelperCameraHelper) {
                this.bspHelperCameraHelper.update();
            }
        }


        // NEW: Update BSP section visibility based on camera position (UE2-style culling)
        // Use helper camera position only when active (frozen), otherwise use main camera
        const bspCullingCamera = (this.bspHelperCamera && this.bspHelperActive) ? this.bspHelperCamera : this.camera;
        const bspCullingPosition = bspCullingCamera.position;

        // Pass 1: Visibility updates
        // UE2: DistanceFogEnd IS the far clip plane — no padding needed
        const fogFar = (this.scene.fog as Fog)?.far || DEFAULT_FAR;
        const fogSphere = new Sphere(bspCullingPosition, fogFar);

        // Build culling frustum from camera (Z-buffer far stays at DEFAULT_FAR for depth precision)
        this.frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(bspCullingCamera.projectionMatrix, bspCullingCamera.matrixWorldInverse));

        // UE2: BoundingPlanes[4] = FPlane(ViewOrigin + Z * FarClip, Z)
        // Override the frustum's far plane at fogFar for visibility culling only
        // This is separate from camera.far (depth buffer) — no Z-fighting artifacts
        // THREE.js frustum plane indices: 0=right, 1=left, 2=bottom, 3=top, 4=far, 5=near
        {
            tmpCamDir.set(0, 0, -1).applyQuaternion(bspCullingCamera.quaternion);
            tmpFarPoint.copy(bspCullingPosition).addScaledVector(tmpCamDir, fogFar);
            this.frustum.planes[4].setFromNormalAndCoplanarPoint(tmpCamDir.negate(), tmpFarPoint);
        }

        // static meshes clip at the same distance as fog/terrain, no padding (isRangeIgnored is the real per-actor exemption)
        // TODO: Clip static meshes against [ClippingRange] StaticMesh instead of fog.
        const STATIC_MESH_CLIPPING_RANGE = 1;
        const staticMeshCullDist = fogFar * STATIC_MESH_CLIPPING_RANGE;
        const staticMeshCullDistSq = staticMeshCullDist * staticMeshCullDist;

        const emitterCullDist = this.assetManager.userConfig.clippingRange.actor * CLIPPING_RANGE_SCALE;
        const emitterCullDistSq = emitterCullDist * emitterCullDist;

        const activeSector = this.getSector(bspCullingPosition);

        this.updateSectorRenderOrder(activeSector);

        this.scene.traverse((object: THREE.Object3D) => {
            if ((object as any).isSectorObject) {
                const sector = object as SectorObject;
                const isCameraInSector = activeSector === sector;
                const wasVisible = sector.visible;

                // fog-range z-culling, never the active sector
                if (!isCameraInSector) {
                    if (!fogSphere.intersectsBox(sector.worldBounds)) {
                        sector.visible = false;
                        return;
                    }
                }

                sector.visible = true;

                const topLevelOnly = !isCameraInSector;

                if (isCameraInSector || !wasVisible || !(sector as any).visibilityCacheInitialized) {
                    sector.updateVisibility(this.environment, bspCullingPosition, this.frustum, this.frustumCullingEnabled, topLevelOnly, staticMeshCullDistSq, emitterCullDistSq);
                } else {
                    this.neighborVisibilitySectors.push(sector);
                }
            }
        });

        if (this.neighborVisibilitySectors.length > 0) {
            const index = this.neighborVisibilityCursor++ % this.neighborVisibilitySectors.length;
            this.neighborVisibilitySectors[index].updateVisibility(
                this.environment,
                bspCullingPosition,
                this.frustum,
                this.frustumCullingEnabled,
                true,
                staticMeshCullDistSq,
                emitterCullDistSq
            );
        }

        this.updatePawnVisibility();
        this.updatePawnLighting();

        // Pass 2: Object & Material updates (active sector only — skip distant sectors)
        this.scene.traverseVisible(child => {
            if ((child as any).isUpdatable) {
                // Find the nearest sector for objects that need lighting updates
                let sector: SectorObject | null = null;
                let parent = child.parent;
                while (parent) {
                    if ((parent as any).isSectorObject) {
                        sector = parent as SectorObject;
                        break;
                    }
                    parent = parent.parent;
                }

                // Skip lighting updates for objects in non-active (distant) sectors,
                // except objects that were never lit at all (freshly streamed sectors)
                if (sector && sector !== activeSector && !(child as any).needsInitialLighting) {
                    // emitters outside the camera's sector still simulate, just throttled to OFFSCREEN_EMITTER_HZ
                    if ((child as any).particlePool) {
                        const wasOffscreen = !!(child as any).isOffscreenThrottled;
                        const isMaintenanceDue = shouldUpdateOffscreenEmitter(child, currentTime);
                        if (offscreenEmitterUpdates < offscreenEmitterUpdateLimit && isMaintenanceDue) {
                            offscreenEmitterUpdates++;
                            (child as any).updateMatrixWorld = Object3D.prototype.updateMatrixWorld;
                            (child as any).update(currentTime);
                            freezeEmitterParticles(child);
                        } else if (!wasOffscreen) {
                            // A budgeted-out first maintenance tick must still stop the
                            // emitter's previous visible state from being submitted.
                            freezeEmitterParticles(child);
                        }

                        (child as any).updateMatrixWorld = frozenUpdateMatrixWorld;
                    }
                    return;
                }

                // within the active sector, reuse zone-object.ts's BSP visibility (Pass 1 fills visibleEmitterUuids) instead of a standalone frustum test
                if ((child as any).particlePool) {
                    const emitterUuid = (child as any).emitterActorUuid;
                    const isVisible = !!sector && emitterUuid !== undefined && sector.visibleEmitterUuids.has(emitterUuid);

                    if (!isVisible) {
                        // throttle instead of freezing outright so particle state doesn't go stale and pop back in once visible
                        const wasOffscreen = !!(child as any).isOffscreenThrottled;
                        const isMaintenanceDue = shouldUpdateOffscreenEmitter(child, currentTime);
                        if (offscreenEmitterUpdates < offscreenEmitterUpdateLimit && isMaintenanceDue) {
                            offscreenEmitterUpdates++;
                            (child as any).updateMatrixWorld = Object3D.prototype.updateMatrixWorld;
                            (child as any).update(currentTime);
                            freezeEmitterParticles(child);
                        } else if (!wasOffscreen) {
                            freezeEmitterParticles(child);
                        }

                        (child as any).updateMatrixWorld = frozenUpdateMatrixWorld; // between ticks, already hidden by the last tick's freeze
                        return;
                    }

                    const shouldUpdate = shouldUpdateVisibleEmitter(
                        child,
                        this.emitterDetailFrame,
                        this.dropDetail,
                        this.aggressiveLod,
                        this.emitterSimDue
                    );
                    (child as any).isOffscreenThrottled = false;
                    (child as any).updateMatrixWorld = Object3D.prototype.updateMatrixWorld;

                    if (!shouldUpdate) {
                        const mesh = (child as any).instancedMesh;
                        if (mesh?.visible && mesh.isWorldBatchCandidate)
                            this.visibleWorldBatchEmitters.push(child);
                        return;
                    }
                }

                if (sector && 'computeLighting' in child) {
                    (child as any).update(sector, this.environment);
                } else {
                    (child as any).update(currentTime);
                }

                if ((child as any).particlePool) {
                    const mesh = (child as any).instancedMesh;
                    if (mesh?.visible && mesh.isWorldBatchCandidate)
                        this.visibleWorldBatchEmitters.push(child);

                    const pendingSounds = (child as any).pendingSounds;
                    if (pendingSounds.length) {
                        for (const snd of pendingSounds)
                            this.audioManager.playOneShotSound(snd.soundDataUri, snd.position, snd.volume, snd.pitch, snd.refDistance, snd.maxDistance);
                        pendingSounds.length = 0;
                    }
                }
            }

            if ((child as THREE.Mesh).isMesh) {
                const mat = (child as THREE.Mesh).material;
                if (mat) {
                    const materials = (mat as any).isMaterial ? [mat] : (mat as any);
                    (materials as THREE.Material[]).forEach(m => {
                        if (m && (m as any).isUpdatable) {
                            (m as any).update(currentTime);
                        }
                    });
                }
            }

            if ((child as any).isSkinnedMesh && !(child as any).hasStartedAnimation) {
                const meshAnimations = (child as any).meshAnimations as Record<string, AnimationClip>;
                const clip = meshAnimations?.["Wait"] ?? Object.values(meshAnimations ?? {})[0];

                if (clip) this.mixer.clipAction(clip, child).play();

                (child as any).hasStartedAnimation = true;
            }
        });

        this.particleBatcher.update(this.visibleWorldBatchEmitters, this.camera);

        this._updateEnvironment();
    }

    protected _updateEnvironment() {
        const env = this.environment;
        if (!env) return;

        // base sky color from timeenv, blended with L2FogInfo later
        const targetSkyColor = env.getSkyColor(tmpColorByte);

        // fog defaults from Env.int [FOG] StartRange1=1.0 (2000u), EndRange1=4.0 (8000u)
        // range scale factor 2048, derived from trace: 2.5 * 2048 = 5120
        const presetIndex = parseInt(String(this.envConfig.fogPreset).split(" ")[0]);
        const range = env.getEnv().fog.ranges[presetIndex - 1]; // 0-based array

        let targetFogStart = 2000;
        let targetFogEnd = 8000;

        if (range) {
            targetFogStart = range.x * 2048;
            targetFogEnd = range.y * 2048;
        } else {
            const defRange = env.getEnv().fog.ranges[0];
            if (defRange) {
                targetFogStart = defRange.x * 2048;
                targetFogEnd = defRange.y * 2048;
            }
        }

        let targetFogColor = env.getHazeColor(tmpColorByte_2); // Default to Haze

        // targetFogStart = 1;
        // targetFogEnd = 10

        // zone overrides
        const sector = this.getSector(this.camera.position);
        // base haze gradient from EnvLight (via indexHaze), L2FogInfo blending modifies it in range
        const blendedHazeColors: ColorByte[] = env.getHazeGradient();
        let skyVisibility = 1.0;

        // Initialize with default baseline colors from Env.int
        const targetCloudColors: ColorByte[] = [
            env.getCloudColor(0, new ColorByte()),
            env.getCloudColor(1, new ColorByte()),
            env.getCloudColor(2, new ColorByte())
        ];

        if (sector) {
            const zoneIndex = sector.findPositionZone(this.camera.position);
            const zone = sector.zones.children[zoneIndex] as ZoneObject;

            if (zone && zone.fog) {
                if (zone.isSunAffected) {
                    const zR = zone.fog.color.r * 255;
                    const zG = zone.fog.color.g * 255;
                    const zB = zone.fog.color.b * 255;

                    targetFogColor.set(
                        (targetFogColor.r + zR) * 0.5,
                        (targetFogColor.g + zG) * 0.5,
                        (targetFogColor.b + zB) * 0.5
                    );
                } else {
                    targetFogColor.set(zone.fog.color.r * 255, zone.fog.color.g * 255, zone.fog.color.b * 255);
                }
            }

            // Sky color accumulators
            let accSkyR = 0, accSkyG = 0, accSkyB = 0, totalSkyWeight = 0;
            // Haze/Cloud accumulators
            let accHazeR = 0, accHazeG = 0, accHazeB = 0, totalHazeWeight = 0;
            let accCloudR = [0, 0, 0], accCloudG = [0, 0, 0], accCloudB = [0, 0, 0], totalCloudWeight = [0, 0, 0];

            // Fog accumulators (Standard spatial weight)
            let accStart = 0, accEnd = 0, accR = 0, accG = 0, accB = 0, totalFogWeight = 0;

            // Haze Array accumulators (for vertical gradient)
            let accHArrR: number[] = [], accHArrG: number[] = [], accHArrB: number[] = [];

            let totalHArrWeight = 0;

            const presetIndex = this.envConfig.fogPreset;
            const timeOfDay = env.getTimeOfDay();

            // Collect fogInfos from current sector and 8 neighbor sectors to handle cross-sector ranges
            const fogInfosAll: any[] = [];
            const sectorSize = 256 * 128;
            const currentX = Math.floor(this.camera.position.x / sectorSize) + 20;
            const currentY = Math.floor(this.camera.position.y / sectorSize) + 18;

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const s = this.getSectorByCoords(currentX + dx, currentY + dy);
                    if (s && s.fogInfos) {
                        for (const fi of s.fogInfos) {
                            if (!fogInfosAll.includes(fi)) {
                                fogInfosAll.push(fi);
                            }
                        }
                    }
                }
            }
            const fogInfos = fogInfosAll;

            this.activeFogId = null;
            let minFogDist = Infinity;
            const bspCullingCamera = (this.bspHelperCamera && this.bspHelperActive) ? this.bspHelperCamera : this.camera;
            const fogRefPosition = bspCullingCamera.position;

            let maxHArrLen = 0;
            const activeInfos: { fogInfo: any, weight: number, hArr: ColorByte[] }[] = [];

            // closest active fog wins
            fogInfos.forEach(fogInfo => {
                const visibleMask = sector.lastZoneMask;
                if (fogInfo.zoneMask && visibleMask && !(fogInfo.zoneMask & visibleMask)) {
                    return;
                }

                const affectRange = fogInfo.affectRange;
                if (!affectRange) return;

                const outer = Math.max(affectRange.A, affectRange.B);
                const dist = fogRefPosition.distanceTo(fogInfo.position);

                if (dist <= outer) {
                    if (dist < minFogDist) {
                        minFogDist = dist;
                        this.activeFogId = fogInfo.uuid;
                    }
                }
            });

            fogInfos.forEach(fogInfo => {
                const isActive = fogInfo.uuid === this.activeFogId;
                if (!isActive) return;

                const weight = 1.0;
                const timeOfDay = env.getTimeOfDay();

                const hArr = interpolateFogInfoHazeColors(timeOfDay, fogInfo.colors);
                if (hArr.length > 0) {
                    maxHArrLen = Math.max(maxHArrLen, hArr.length);
                }

                activeInfos.push({ fogInfo, weight, hArr });
            });

            activeInfos.forEach(({ fogInfo, weight, hArr }) => {
                let range = (fogInfo as any)[`fogRange${presetIndex}`] as { A: number, B: number };
                if (!range || (range.A === 0 && range.B === 0)) {
                    range = fogInfo.fogRange1;
                }
                if (!range) return;

                const fogColor = interpolateFogInfoColor(timeOfDay, fogInfo.colors, tmpColorByte);
                const skyColor = interpolateFogInfoSkyColor(timeOfDay, fogInfo.colors, tmpColorByte_3);
                const hazeColor = interpolateFogInfoHazeColor(timeOfDay, fogInfo.colors, tmpColorByte_4);
                const cloudColors = [
                    interpolateFogInfoCloudColor(timeOfDay, fogInfo.colors, tmpColorByte_5, 0),
                    interpolateFogInfoCloudColor(timeOfDay, fogInfo.colors, new ColorByte(), 1),
                    interpolateFogInfoCloudColor(timeOfDay, fogInfo.colors, new ColorByte(), 2)
                ];

                // EnvInfo ranges are kilounits (x2048), FogInfo zone ranges are already units
                accStart += range.A * weight;
                accEnd += range.B * weight;
                accR += fogColor.r * weight;
                accG += fogColor.g * weight;
                accB += fogColor.b * weight;
                totalFogWeight += weight;

                // alpha 0 in assets means fallback to 255 (fully opaque)
                const skyAlpha = skyColor.a === 0 ? 255 : skyColor.a;
                const skyWeight = weight * (skyAlpha / 255);
                accSkyR += skyColor.r * skyWeight;
                accSkyG += skyColor.g * skyWeight;
                accSkyB += skyColor.b * skyWeight;
                totalSkyWeight += skyWeight;

                const hAlpha = hazeColor.a === 0 ? 255 : hazeColor.a;
                const hazeWeight = weight * (hAlpha / 255);
                accHazeR += hazeColor.r * hazeWeight;
                accHazeG += hazeColor.g * hazeWeight;
                accHazeB += hazeColor.b * hazeWeight;
                totalHazeWeight += hazeWeight;

                cloudColors.forEach((c, idx) => {
                    if (!c) return;
                    const cAlpha = c.a === 0 ? 255 : c.a;
                    const weightC = weight * (cAlpha / 255);
                    accCloudR[idx] += c.r * weightC;
                    accCloudG[idx] += c.g * weightC;
                    accCloudB[idx] += c.b * weightC;
                    totalCloudWeight[idx] += weightC;
                });

                if (hArr.length > 0) {
                    for (let i = 0; i < maxHArrLen; i++) {
                        const color = hArr[i] || hArr[hArr.length - 1];
                        accHArrR[i] = (accHArrR[i] || 0) + color.r * weight;
                        accHArrG[i] = (accHArrG[i] || 0) + color.g * weight;
                        accHArrB[i] = (accHArrB[i] || 0) + color.b * weight;
                    }
                    totalHArrWeight += weight;
                }
            });

            // Calculate Sky Visibility (Suppressed by bClearToFogColor)
            // If zones with bClearToFogColor are active, sky visibility should drop
            skyVisibility = 1.0;
            activeInfos.forEach(({ fogInfo, weight }) => {
                if ((fogInfo as any).useFogColorClear) {
                    skyVisibility = Math.max(0, skyVisibility - weight);
                }
            });

            if (this.activeFogId) {
                // If a zone fog is active, it completely overrides the global fog palette
                targetFogStart = accStart / totalFogWeight;
                targetFogEnd = accEnd / totalFogWeight;
                targetFogColor.set(
                    accR / totalFogWeight,
                    accG / totalFogWeight,
                    accB / totalFogWeight,
                    255
                );
            } else {
                // No active zone fog - already has default values from Env.int
            }

            if (totalSkyWeight > 0 && this.activeFogId) {
                targetSkyColor.set(
                    accSkyR / totalSkyWeight,
                    accSkyG / totalSkyWeight,
                    accSkyB / totalSkyWeight,
                    255
                );
            }

            // Calculate final Cloud Colors (Blended result of Baseline + Regional Overrides)
            targetCloudColors.forEach((tc, idx) => {
                const baseCloud = env.getCloudColor(idx, new ColorByte());
                tc.copy(baseCloud);
                if (this.activeFogId && totalCloudWeight[idx] > 0) {
                    // Engine logic: Whichever wins provides the complete palette for that component
                    // If the active fog has an override for this index, it completely overrides baseline
                    const r = accCloudR[idx] / totalCloudWeight[idx];
                    const g = accCloudG[idx] / totalCloudWeight[idx];
                    const b = accCloudB[idx] / totalCloudWeight[idx];
                    tc.set(r, g, b, 255);
                }
            });

            if (totalHArrWeight > 0) {
                // high weight prioritizes regional color, reduces global bleed
                const haW = totalHArrWeight >= 0.95 ? 1.0 : Math.min(totalHArrWeight, 1.0);
                for (let i = 0; i < blendedHazeColors.length; i++) {
                    const baseColor = blendedHazeColors[i];
                    if (accHArrR[i] !== undefined) {
                        baseColor.set(
                            MathUtils.lerp(baseColor.r, accHArrR[i] / totalHArrWeight, haW),
                            MathUtils.lerp(baseColor.g, accHArrG[i] / totalHArrWeight, haW),
                            MathUtils.lerp(baseColor.b, accHArrB[i] / totalHArrWeight, haW),
                            baseColor.a
                        );
                    }
                }
            }

            // Restore Haze Color Blending (for modulatedHazeBase/tmpColorByte_4)
            if (totalHazeWeight > 0) {
                const hW = totalHazeWeight >= 0.95 ? 1.0 : Math.min(totalHazeWeight, 1.0);
                tmpColorByte_4.set(
                    MathUtils.lerp(255, accHazeR / totalHazeWeight, hW), // 255 is base (White) assumption if no fog color used
                    MathUtils.lerp(255, accHazeG / totalHazeWeight, hW),
                    MathUtils.lerp(255, accHazeB / totalHazeWeight, hW),
                    255
                );
            } else {
                // Default to White (Identity) so base haze colors are visible
                tmpColorByte_4.set(255, 255, 255, 255);
            }
        }

        const waterVolume = sector ? sector.getWaterVolumeAt(this.camera.position) : null;

        this.underWaterEffect.setVolume(waterVolume, env.getEnv().waterVolume.cellophaneColor);

        if (waterVolume) {
            if (waterVolume.fog) {
                targetFogColor.set(waterVolume.fog.color[0], waterVolume.fog.color[1], waterVolume.fog.color[2], 255);
                targetFogStart = waterVolume.fog.start;
                targetFogEnd = waterVolume.fog.end;
            } else {
                const waterEnv = env.getEnv().waterVolume;

                targetFogColor.copy(waterEnv.fogColor);
                targetFogStart = waterEnv.fogStart;
                targetFogEnd = waterEnv.fogEnd;
            }

            skyVisibility = 0;
        }

        // Initialize with default Sky Color as fallback
        const targetClearColor = targetSkyColor.clone();

        // If useFogColorClear is active for the current weighted zone state, 
        // we should clear to the fog color instead.
        // We use the skyVisibility (which is derived from bClearToFogColor weights)
        // to blend between Sky Color and Fog Color for a smooth transition.
        if (skyVisibility < 1.0) {
            // Linear blend: 1.0 Visibility = Pure Sky, 0.0 Visibility = Pure Fog
            targetClearColor.lerp(targetFogColor, 1.0 - skyVisibility);
        }

        this.skyRenderer.update(this.camera, env, targetSkyColor, tmpColorByte_4, blendedHazeColors, targetCloudColors, targetFogColor, targetFogStart, targetFogEnd, sector, targetClearColor, skyVisibility);

        const clearColorThree = new Color().setRGB(targetClearColor.r / 255, targetClearColor.g / 255, targetClearColor.b / 255);
        this.renderer.setClearColor(clearColorThree);

        // Update Scene Fog (Always use targetFogColor for 3D fogging)
        const fogColorThree = new Color().setRGB(targetFogColor.r / 255, targetFogColor.g / 255, targetFogColor.b / 255);
        if (!this.scene.fog || !(this.scene.fog as any).isFog) {
            this.scene.fog = new Fog(fogColorThree, targetFogStart, targetFogEnd);
        } else {
            const sceneFog = this.scene.fog as Fog;
            sceneFog.color.copy(fogColorThree);
            sceneFog.near = targetFogStart;
            sceneFog.far = targetFogEnd;
        }

        GLOBAL_UNIFORMS.fogColor.value.copy(fogColorThree);
        if (GLOBAL_UNIFORMS.fogNear) GLOBAL_UNIFORMS.fogNear.value = targetFogStart;
        if (GLOBAL_UNIFORMS.fogFar) GLOBAL_UNIFORMS.fogFar.value = targetFogEnd;
    }


    protected nextPhysicsTick: number;

    protected _preRender(currentTime: number, deltaTime: number) {
        this.assetManager.tick(this);
        this.processSectorWarmups();
        this.processShaderDiagnostics();
        this.mixer.update(deltaTime / 1000);

        const timeScale = this.environment.getTimeScale();

        if (timeScale !== 0) {
            const t = this.environment.getTimeOfDay();
            const dt = deltaTime / 100000 * timeScale;

            const nt = (t + dt) % 24;

            this.environment.setTimeOfDay(nt);
            this.needsUpdate = true;
        }

        this.lastProjectionScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.lastProjectionScreenMatrix);

        this.underWaterEffect.update(this.camera, deltaTime);

        if (!this.isOrbitControls) {
            let forwardVelocity = 0, sidewaysVelocity = 0;
            const camSpeed = this.speedCameraFPS * (this.dirKeys.shift ? (
                Math.min(500, Math.max(Math.pow(2, Math.log10((Date.now() - this.shiftTimeDown) * 0.25)), 2))
            ) : 1);

            // if (this.dirKeys.shift)
            //     console.log("Camspeed:", camSpeed, Date.now() - this.shiftTimeDown)

            if (this.dirKeys.left) sidewaysVelocity -= 1;
            if (this.dirKeys.right) sidewaysVelocity += 1;

            if (this.dirKeys.up) forwardVelocity += 1;
            if (this.dirKeys.down) forwardVelocity -= 1;

            dirForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion).multiplyScalar(forwardVelocity);
            // Negated: the final image is mirrored horizontally (see ue2-conventions.ts),
            // so strafing along the camera's true local +X would otherwise visibly
            // move the view in the opposite screen direction.
            dirRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(-sidewaysVelocity);

            cameraVelocity.addVectors(dirForward, dirRight).setLength(camSpeed);

            this.camera.position.add(cameraVelocity);
        }

        // const sector = this.scene.children[1].children[0].children[0] as any;

        // // debugger;

        // const zoneIndex = sector.findPositionZone(this.camera.position);
        // // sector.children.forEach((ch: any) => ch.visible = false);
        // // sector.children[zoneIndex].visible = true;

        // const bspZone = sector.bspZones[zoneIndex];
        // const connectivityFlags = bspZone.connectivity

        // for (let i = 0, len = sector.bspZones.length, flag = 1n; i < len; i++, flag = flag << 1n) {
        //     const flagValue = connectivityFlags & flag;
        //     const isZoneVisible = Boolean(flagValue).valueOf();

        //     sector.zones.children[i].visible = isZoneVisible;
        // }

        this.emitterSimDue = this.nextPhysicsTick <= currentTime;
        this.player.update(this, currentTime, deltaTime / 1000);

        this.updateMovableObjects(currentTime);
        this.updateRotatingObjects(deltaTime);
        this.updateSimulatedPawns(currentTime, deltaTime);

        // nothing reads the rapier world under the analytical backend
        const stepsRapier = this.collisionWorld.usesRapier();
        let physicsTicks = 0;

        while (this.nextPhysicsTick <= currentTime && physicsTicks++ < 8) {
            if (stepsRapier) this.physicsWorld.step();
            this.nextPhysicsTick += 1000 / 30;
        }

        if (this.nextPhysicsTick <= currentTime)
            this.nextPhysicsTick = currentTime + 1000 / 30;

        if (this.isOrbitControls && this.followPlayer) {
            this.player.getCameraTargetPosition(tmpOrbitFollowTarget);
            tmpOrbitFollowDelta.copy(tmpOrbitFollowTarget).sub(this.controls.orbit.target);
            this.camera.position.add(tmpOrbitFollowDelta);
            this.controls.orbit.target.copy(tmpOrbitFollowTarget);
            this.controls.orbit.update();
            this.camera.updateMatrixWorld();
            this.lastProjectionScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
            this.frustum.setFromProjectionMatrix(this.lastProjectionScreenMatrix);
        }

        this.audioManager.update(currentTime);

        this._updateObjects(currentTime, deltaTime);

        const activeSector = this.getSector(this.camera.position);
        const musicInfo = activeSector ? activeSector.getMusicIdAt(this.camera.position) : { musicId: -1, isLooped: false, isForced: false };
        const musicId = musicInfo.musicId ?? -1;

        if (musicId !== this.activeMusicId) {
            this.activeMusicId = musicId;

            if (musicId >= 0) {
                console.log(`[Music] Playing track ${musicId} (forced: ${musicInfo.isForced})`);
                this.audioManager.playMusic(musicId, musicInfo.isLooped, musicInfo.isForced, currentTime);
            } else {
                console.log(`[Music] Letting current track finish (left music volume)`);
                this.audioManager.letTrackFinish();
            }
        }

        // Ambient sound spatial update, after UALAudioSubsystem::Update in the retail alaudio.dll
        {
            const camPos = this.camera.position;
            const timeOfDay = this.environment.getTimeOfDay(); // 0-24 hours
            const isDaytime = timeOfDay >= 6 && timeOfDay < 18;
            const isSubmerged = !!(activeSector && activeSector.getWaterVolumeAt(camPos));
            const activeIds = this.audioManager.activeAmbientSoundIds;
            const audibleSounds = new Map<string, number>();
            const candidates: { uuid: string, snd: GD.IAmbientSoundObjectDecodeInfo, priority: number }[] = [];

            for (const [, sectorYMap] of this.sectors) {
                for (const [, sector] of sectorYMap) {
                    if (!sector.ambientSounds) continue;
                    for (const snd of sector.ambientSounds) {
                        if (snd.soundType === "day" && !isDaytime) continue;
                        if (snd.soundType === "night" && isDaytime) continue;
                        if (snd.soundType === "water" && !isSubmerged) continue;

                        const dx = snd.position[0] - camPos.x;
                        const dy = snd.position[1] - camPos.y;
                        const dz = snd.position[2] - camPos.z;
                        const distSq = dx * dx + dy * dy + dz * dz;
                        const maxDistSq = snd.maxDistance * snd.maxDistance;

                        if (distSq > maxDistSq) continue;

                        // SoundPriority: Volume * Clamp(1 - distSq / Square(GAudioMaxRadiusMultiplier*Radius), 0.01, 1)
                        const priority = snd.volume * Math.min(Math.max(1 - distSq / maxDistSq, 0.01), 1);

                        audibleSounds.set(snd.uuid, priority);

                        if (activeIds.has(snd.uuid)) continue;
                        if (!snd.looping && !this.audioManager.rollAmbientTrigger(snd.uuid, snd.soundDataUri, snd.randomChance, currentTime)) continue;

                        candidates.push({ uuid: snd.uuid, snd, priority });
                    }
                }
            }

            // A playing ambient is never dropped for merely ranking below the newcomers
            for (const id of activeIds) {
                const priority = audibleSounds.get(id);

                if (priority === undefined) this.audioManager.stopAmbientSound(id);
                else this.audioManager.setAmbientPriority(id, priority);
            }

            candidates.sort((a, b) => b.priority - a.priority);

            for (const { uuid, snd, priority } of candidates) {
                const placed = this.audioManager.playAmbientSound(
                    uuid,
                    snd.soundName,
                    snd.soundDataUri,
                    snd.position,
                    snd.volume,
                    snd.pitch,
                    snd.refDistance,
                    snd.maxDistance,
                    snd.looping,
                    priority
                );

                if (!placed) break;
            }

            // Update listener position from camera - AudioParam writes cross to the
            // audio thread, skip them while the camera is still
            if (!this._lastListenerPos.equals(camPos) || !this._lastListenerQuat.equals(this.camera.quaternion)) {
                this._lastListenerPos.copy(camPos);
                this._lastListenerQuat.copy(this.camera.quaternion);

                const fwd = this.camera.getWorldDirection(new Vector3());
                const up = new Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
                this.audioManager.updateListenerPosition(
                    camPos.x, camPos.y, camPos.z,
                    fwd.x, fwd.y, fwd.z,
                    up.x, up.y, up.z,
                );
            }
        }

        this.renderer.clear();
    }

    protected _doRender(_currentTime: number, _deltaTime: number) {
        // // Redirect to Main Target for Bloom
        // i think bloom pass is only enabled when shader rendering used which is off by default
        // this.renderer.setRenderTarget(this.mainRenderTarget);

        if (this.displayGammaEnabled) this.renderer.setRenderTarget(this.displayGammaPass.getTarget());

        // Render Sky (Background)
        this.renderer.clear();

        // bProjectActor=False - the sky pass shares the global projector uniforms, mute it for the pass
        const shadowActive = GLOBAL_UNIFORMS.shadowActive.value;

        GLOBAL_UNIFORMS.shadowActive.value = 0;
        this.skyRenderer.render(this.renderer);
        GLOBAL_UNIFORMS.shadowActive.value = shadowActive;

        this.renderer.clearDepth();

        // Check for sector change and recreate visualizer if needed
        const currentSector = this.getSector(this.camera.position);
        if (currentSector) {
            const sectorIndex = currentSector.index;
            if (this.currentSectorIndex === null ||
                !sectorIndex.equals(this.currentSectorIndex)) {
                // Sector changed - recreate visualizer
                const wasEnabled = this.visualizer.isEnabled();
                const currentMode = this.visualizer.getMode();

                // Remove old visualizer
                this.visualizer.destroy();
                this.scene.remove(this.visualizer.getGroup());
                this.scene.remove(this.visualizer.getFogGroup());
                this.scene.remove(this.visualizer.getEmitterLabelGroup());

                // Create new visualizer
                (this as any).visualizer = new Visualizer(this.scene);
                this.wireEmitterVisibilityHandlers();

                // Restore state
                this.visualizer.setMode(currentMode);
                if (wasEnabled && !this.visualizer.isEnabled()) {
                    this.visualizer.toggle();
                } else if (!wasEnabled && this.visualizer.isEnabled()) {
                    this.visualizer.toggle();
                }

                this.currentSectorIndex = sectorIndex.clone();
            }
        } else {
            // No sector - clear tracking
            if (this.currentSectorIndex !== null) {
                this.currentSectorIndex = null;
            }
        }

        // Update visualizer based on camera position (use bspHelperCamera if active)
        // Only visualize the current sector
        if (currentSector) {
            const cameraPos = this.bspHelperActive && this.bspHelperCamera ? this.bspHelperCamera.position : this.camera.position;

            // Create a map with only the current sector
            const currentSectorMap = new Map<number, Map<number, SectorObject>>();
            if (currentSector.index) {
                const sectorXMap = new Map<number, SectorObject>();
                sectorXMap.set(currentSector.index.y, currentSector);
                currentSectorMap.set(currentSector.index.x, sectorXMap);
            }

            if (this.visualizer.isEnabled()) {
                const cameraFrustum = this.bspHelperActive && this.bspHelperCamera
                    ? new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(this.bspHelperCamera.projectionMatrix, this.bspHelperCamera.matrixWorldInverse))
                    : this.frustum;

                if (this.visualizer.getMode() === VisualizerMode.Portals) {
                    this.visualizer.updatePortals(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Zones) {
                    this.visualizer.updateZones(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Leaves) {
                    this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
                } else if (this.visualizer.getMode() === VisualizerMode.Fogs) {
                    this.visualizer.updateFogs(currentSectorMap, this.activeFogId || undefined);
                }
            }
        }

        // Always update HUD in Fogs/Audio mode to prevent stale data when transitioning between sectors or leaving them
        if (this.visualizer.isEnabled()) {
            // Capture raw source colors from the active fog if available
            let activeFogColors: import("./visualizer").FogSourceColors | undefined;
            if (this.activeFogId) {
                const s = this.getSector(this.camera.position);
                const fogInfo = s?.fogInfos?.find(fi => fi.uuid === this.activeFogId);
                if (fogInfo) {
                    const timeOfDay = this.environment.getTimeOfDay();
                    activeFogColors = {
                        fog: interpolateFogInfoColor(timeOfDay, fogInfo.colors, new ColorByte()),
                        sky: interpolateFogInfoSkyColor(timeOfDay, fogInfo.colors, new ColorByte()),
                        cloud: interpolateFogInfoCloudColor(timeOfDay, fogInfo.colors, new ColorByte(), 0),
                        haze: interpolateFogInfoHazeColor(timeOfDay, fogInfo.colors, new ColorByte())
                    };
                }
            }
            // Capture global environment colors
            const globalEnvColors: import("./visualizer").GlobalEnvColors = {
                fog: this.environment.getFogColor(new ColorByte()),
                sky: this.environment.getSkyColor(new ColorByte()),
                cloud1: this.environment.getCloudColor(0, new ColorByte()),
                cloud2: this.environment.getCloudColor(1, new ColorByte()),
                cloud3: this.environment.getCloudColor(2, new ColorByte()),
                sun: this.environment.getSunColor(new ColorByte()),
                haze: this.environment.getHazeColor(new ColorByte())
            };

            // Capture active zone fog data
            let zoneFogData: import("./visualizer").ZoneFogData | undefined;
            const sector = this.getSector(this.camera.position);
            if (sector) {
                const zoneIndex = sector.findPositionZone(this.camera.position);
                if (zoneIndex !== null && sector.bspZones && sector.bspZones[zoneIndex]) {
                    const zoneData = sector.bspZones[zoneIndex];
                    const zi = zoneData.zoneInfo;
                    if (zi) {
                        zoneFogData = {
                            isFogZone: !!zi.isFogZone,
                            color: zi.fog ? new ColorByte().set(zi.fog.color[0] * 255, zi.fog.color[1] * 255, zi.fog.color[2] * 255, 255) : new ColorByte().set(0, 0, 0, 0),
                            start: zi.fog ? zi.fog.start : 0,
                            end: zi.fog ? zi.fog.end : 0
                        };
                    }
                }
            }

            if (this.visualizer.getMode() === VisualizerMode.Fogs) {
                this.visualizer.updateHUD(activeFogColors, globalEnvColors, zoneFogData);
            } else if (this.visualizer.getMode() === VisualizerMode.Audio) {
                const musicState = this.audioManager.getMusicState();
                const ambientSounds = this.audioManager.getAmbientSounds();
                this.visualizer.updateAudioHUD(musicState, ambientSounds, _currentTime, this.camera.position);
            } else if (this.visualizer.getMode() === VisualizerMode.Emitters) {
                this.visualizer.updateEmitters(this.collectEmitterDebugInfo());
            }
        }

        this.renderer.autoClear = false;

        // Render World
        this.renderer.render(this.scene, this.camera);

        this.underWaterEffect.renderCellophane(this.renderer);

        // // Apply Native Bloom (Sun/Glow) -> Screen
        // this.uGlowPass.render(this.renderer, null, this.mainRenderTarget);

        // this.renderer.setRenderTarget(null);

        if (this.displayGammaEnabled) this.displayGammaPass.render(this.renderer);
    }

    protected _postRender(_currentTime: number, _deltaTime: number) { }

    public startRendering() {
        const currentTime = performance.now();

        this.scene.updateMatrixWorld(true);
        this.collectColliders();
        this.physicsWorld.timestep = 1 / 30;
        this.physicsWorld.step();
        this.lastRender = currentTime;
        this.nextPhysicsTick = currentTime + 1000 / 30;
        this.stitchTerrains();

        this.onHandleRender(currentTime);
    }

    protected readonly collidables = new Set<ICollidable>();

    protected collectColliders() {
        this.registerColliders(this.scene);
    }

    protected setCollidersVisible(visible: boolean) {
        this.showColliders = visible;
        this.colliderOverlay.visible = visible;

        if (visible) this.colliderOverlay.rebuild(this.collectPhysicsColliders());

        this.needsUpdate = true;
    }

    protected collectPhysicsColliders(): RAPIER.Collider[] {
        const colliders: RAPIER.Collider[] = [];

        this.physicsWorld.colliders.forEach(collider => colliders.push(collider));

        return colliders;
    }

    protected registerColliders(root: Object3D) {
        root.updateMatrixWorld(true);
        root.traverse((object: ICollidable) => {
            if ((object as any).isTerrainBatch)
                for (const terrain of (object as any).sectors) this.registerCollider(terrain);

            this.registerCollider(object);
        });

        if (this.showColliders) this.colliderOverlay.rebuild(this.collectPhysicsColliders());
    }

    protected registerCollider(object: ICollidable) {
        if (!object.isCollidable || this.collidables.has(object)) return;

        const collider = object.createCollider(this.physicsWorld);
        const colliders = object.getColliders ? object.getColliders() : [collider];

        this.collidables.add(object);
        this.collisionWorld.register(object, colliders);
    }

    protected unregisterColliders(root: Object3D) {
        root.traverse((object: ICollidable) => {
            if ((object as any).isTerrainBatch)
                for (const terrain of (object as any).sectors) this.unregisterCollider(terrain);

            this.unregisterCollider(object);
        });

        if (this.showColliders) this.colliderOverlay.rebuild(this.collectPhysicsColliders());
    }

    protected unregisterCollider(object: ICollidable) {
        if (!this.collidables.has(object)) return;

        const collider = object.getCollider();
        const colliders = object.getColliders ? object.getColliders() : [collider];
        const rigidbody = object.getRigidbody();

        this.collidables.delete(object);
        this.collisionWorld.unregister(colliders);

        if (rigidbody) this.physicsWorld.removeRigidBody(rigidbody);
        else for (const collider of colliders)
            if (collider) this.physicsWorld.removeCollider(collider, false);

        // removed handles are dead; createCollider must not hand the cached set back on re-stream
        if (object.releaseCollider) object.releaseCollider();
    }

    public setSky(sector: SectorObject) {
        this.skyRenderer.initSkyLevel(this.environment.getEnv(), sector);
    }

    public getLoadedSectors() {
        const activeSectors: SectorObject[] = [];

        for (const secs of this.sectors.values()) {
            for (const sec of secs.values()) {
                activeSectors.push(sec);
            }
        }

        return activeSectors;
    }

    public addSector(sector: SectorObject) {
        if (sector.index) {
            if (!this.sectors.has(sector.index.x))
                this.sectors.set(sector.index.x, new Map());

            this.sectors.get(sector.index.x).set(sector.index.y, sector);
        }

        sector.traverse(child => {
            if ((child as any).isRotatingObject) {
                this.rotatingObjects.add(child as RotatingObject);
                return;
            }

            if (!(child as any).isMovableObject) return;

            const mover = child as MovableObject;

            this.movableObjects.add(mover);
            mover.setPosition(this.envConfig.moverPosition);
        });
        this.lastMoverTriggerPosition.set(Infinity, Infinity, Infinity);
        this.lastRenderOrderSector = null;

        sector.worldBounds.setFromObject(sector);
        this.sectorBounds.push(sector.worldBounds);

        this.objectGroup.add(sector);
        this.registerColliders(sector);
        this.stitchTerrains();

        setLightingGate(sector, false);

        if (sector.staticMeshGroup) {
            setEmitterWarmupGate(sector, false);
        }

        this.queueSectorWarmup(sector, sector, !!sector.staticMeshGroup);

        sector.updateMatrixWorld(true);
        freezeStaticSubtree(sector);

        // Update visualizer if enabled (only show current sector)
        const currentSector = this.getSector(this.camera.position);
        if (currentSector && this.visualizer.isEnabled()) {
            const cameraPos = this.bspHelperActive && this.bspHelperCamera ? this.bspHelperCamera.position : this.camera.position;
            const cameraFrustum = this.bspHelperActive && this.bspHelperCamera
                ? new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(this.bspHelperCamera.projectionMatrix, this.bspHelperCamera.matrixWorldInverse))
                : this.frustum;

            // Create a map with only the current sector
            const currentSectorMap = new Map<number, Map<number, SectorObject>>();
            if (currentSector.index) {
                const sectorXMap = new Map<number, SectorObject>();
                sectorXMap.set(currentSector.index.y, currentSector);
                currentSectorMap.set(currentSector.index.x, sectorXMap);
            }

            if (this.visualizer.getMode() === VisualizerMode.Portals) {
                this.visualizer.updatePortals(currentSectorMap, cameraPos);
            } else if (this.visualizer.getMode() === VisualizerMode.Zones) {
                this.visualizer.updateZones(currentSectorMap, cameraPos);
            } else if (this.visualizer.getMode() === VisualizerMode.Leaves) {
                this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
            }
        }
    }

    protected processSectorWarmups() {
        let jobIndex = -1;
        let jobDistance = Infinity;
        const cacheVisibleMaterials = new WeakMap<THREE.Mesh, Set<number>>();

        for (let i = 0; i < this.pendingSectorWarmups.length; i++) {
            if (findVisibleMaterialBinding(this.pendingSectorWarmups[i].materialQueue, cacheVisibleMaterials) < 0) continue;

            const distance = this.pendingSectorWarmups[i].sector.worldBounds.distanceToPoint(this.camera.position);

            if (distance >= jobDistance) continue;

            jobIndex = i;
            jobDistance = distance;
        }

        const visibleOnly = jobIndex >= 0;

        if (!visibleOnly) {
            for (let i = 0; i < this.pendingSectorWarmups.length; i++) {
                const distance = this.pendingSectorWarmups[i].sector.worldBounds.distanceToPoint(this.camera.position);

                if (distance >= jobDistance) continue;

                jobIndex = i;
                jobDistance = distance;
            }
        }

        const job = jobIndex < 0 ? null : this.pendingSectorWarmups[jobIndex];
        if (!job) return;

        const deadline = performance.now() + RenderManager.TEXTURE_WARMUP_FRAME_MS;
        let restoredMaterials = 0;

        while (job.materialQueue.length > 0 && restoredMaterials < RenderManager.MATERIAL_RESTORES_PER_FRAME) {
            const bindingIndex = visibleOnly ? findVisibleMaterialBinding(job.materialQueue, cacheVisibleMaterials) : job.materialQueue.length - 1;
            if (bindingIndex < 0) return;

            const binding = job.materialQueue[bindingIndex];

            while (binding.textureQueue.length > 0) {
                const texture = binding.textureQueue.pop();

                if (job.warmedTextures.has(texture)) continue;

                this.renderer.initTexture(texture);
                job.warmedTextures.add(texture);

                if (binding.textureQueue.length > 0 && performance.now() >= deadline) return;
            }

            job.materialQueue.splice(bindingIndex, 1);
            if (binding.materialIndex < 0) binding.object.material = binding.material;
            else (binding.object.material as THREE.Material[])[binding.materialIndex] = binding.material;

            restoredMaterials++;
            if (performance.now() >= deadline) return;
        }

        if (job.materialQueue.length > 0) return;

        if (job.lightingQueue.length > 0) {
            job.lightingQueue.pop().lightingGate = true;
            return;
        }

        this.pendingSectorWarmups.splice(jobIndex, 1);
        job.fallbackMaterials.forEach(material => material.dispose());

        if (job.releaseEmitters)
            setEmitterWarmupGate(job.sector, true);

        (job.sector as any).visibilityCacheInitialized = false;
    }

    protected queueSectorWarmup(sector: SectorObject, root: THREE.Object3D, releaseEmitters: boolean) {
        const job = stageSectorWarmup(sector, root, releaseEmitters);

        if (job.materialQueue.length > 0 || job.lightingQueue.length > 0) {
            this.pendingSectorWarmups.push(job);
            return;
        }

        setLightingGate(root, true);
        if (releaseEmitters) setEmitterWarmupGate(sector, true);
    }

    // polls COMPLETION_STATUS_KHR instead of gl.getProgramInfoLog directly - see checkShaderErrors above
    protected processShaderDiagnostics() {
        if (this.parallelShaderCompileExt === undefined)
            this.parallelShaderCompileExt = this.renderer.extensions.get("KHR_parallel_shader_compile") ?? null;

        for (const program of (this.renderer.info as any).programs ?? []) {
            if (this.seenPrograms.has(program)) continue;

            this.seenPrograms.add(program);
            this.pendingShaderChecks.push(program);
        }

        if (this.pendingShaderChecks.length === 0) return;

        const ext = this.parallelShaderCompileExt;
        if (!ext) return; // no non-blocking way to know when it's safe to check - leave queued

        const gl = this.renderer.getContext() as WebGL2RenderingContext;

        for (let i = this.pendingShaderChecks.length - 1; i >= 0; i--) {
            const program = this.pendingShaderChecks[i];

            if (!gl.getProgramParameter(program.program, ext.COMPLETION_STATUS_KHR)) continue; // still compiling, retry next frame

            this.pendingShaderChecks.splice(i, 1);
            reportShaderErrors(gl, program);
        }
    }

    // called before staticMeshGroup exists, so addSector's own gating can't cover this
    public gateParticleWarmup(sector: SectorObject, allowed: boolean) {
        setEmitterWarmupGate(sector, allowed);
    }

    // repeats addSector's staticMeshGroup-scoped bookkeeping once decodeSectorStaticMeshes runs
    public attachStaticMeshGroup(sector: SectorObject) {
        sector.staticMeshGroup.traverse(child => {
            if ((child as any).isRotatingObject) {
                this.rotatingObjects.add(child as RotatingObject);
                return;
            }

            if (!(child as any).isMovableObject) return;

            const mover = child as MovableObject;

            this.movableObjects.add(mover);
            mover.setPosition(this.envConfig.moverPosition);
        });

        sector.worldBounds.setFromObject(sector);

        sector.staticMeshGroup.updateMatrixWorld(true);
        this.registerColliders(sector.staticMeshGroup);
        if (!freezeStaticSubtree(sector.staticMeshGroup)) unfreezeAncestors(sector.staticMeshGroup);

        setLightingGate(sector.staticMeshGroup, false);
        this.queueSectorWarmup(sector, sector.staticMeshGroup, true);
    }

    /**
     * Inverse of addSector: unregisters the sector, removes it from the scene and
     * re-stitches the remaining terrains. GPU resources are NOT freed - the sector can
     * be re-added as is; call disposeSector once it is certain not to return.
     */
    public removeSector(sector: SectorObject) {
        if (sector.index)
            this.sectors.get(sector.index.x)?.delete(sector.index.y);

        const boundsIndex = this.sectorBounds.indexOf(sector.worldBounds);
        if (boundsIndex >= 0) this.sectorBounds.splice(boundsIndex, 1);

        sector.traverse(child => {
            if ((child as any).isRotatingObject) {
                this.rotatingObjects.delete(child as RotatingObject);
                return;
            }

            if (!(child as any).isMovableObject) return;

            const mover = child as MovableObject;

            this.movableObjects.delete(mover);
            this.activeMovableObjects.delete(mover);
            this.waitingMovableObjects.delete(mover);
        });

        this.unregisterColliders(sector);
        this.objectGroup.remove(sector);
        this.stitchTerrains();

        for (let i = this.pendingSectorWarmups.length - 1; i >= 0; i--) {
            const job = this.pendingSectorWarmups[i];
            if (job.sector !== sector) continue;

            restoreSectorMaterials(job);
            this.pendingSectorWarmups.splice(i, 1);
        }
    }

    public disposeSector(sector: SectorObject) {
        const soundCache = (sector as any).decodeLibrary?.soundBlobCache as Map<string, { uri: string }>;

        if (soundCache) {
            for (const entry of soundCache.values()) {
                if (!entry.uri) continue;

                this.audioManager.releaseSound(entry.uri);
                URL.revokeObjectURL(entry.uri);
                entry.uri = null;
            }
        }

        disposeSectorResources(sector);
    }

    /**
     * Toggle BSP helper camera for debugging visibility culling.
     * Press F1 to toggle between active/inactive states:
     * - Inactive (default): Helper camera follows main camera, helper invisible
     * - Active: Helper camera frozen at last position, helper visible for debugging
     */
    public toggleBSPHelperCamera() {
        if (!this.bspHelperCamera) {
            // Create helper camera if it doesn't exist
            this.bspHelperCamera = new PerspectiveCamera(this.camera.fov, this.camera.aspect, 0.1, DEFAULT_FAR);
            this.bspHelperCamera.position.copy(this.camera.position);
            this.bspHelperCamera.rotation.copy(this.camera.rotation);
            this.bspHelperCamera.updateMatrixWorld(true);

            // Create visual helper to see where the camera is
            this.bspHelperCameraHelper = new CameraHelper(this.bspHelperCamera);
            this.bspHelperCameraHelper.name = "BSPHelperCameraHelper";
            this.bspHelperCameraHelper.visible = false; // Hidden by default (inactive state)
            this.scene.add(this.bspHelperCameraHelper);

            this.bspHelperActive = false;
        } else {
            // Toggle active/inactive state
            this.bspHelperActive = !this.bspHelperActive;

            if (this.bspHelperActive) {
                // Freeze at current position and show helper
                if (this.bspHelperCameraHelper) {
                    this.bspHelperCameraHelper.visible = true;
                }
            } else {
                // Resume following main camera and hide helper
                this.bspHelperCamera.position.copy(this.camera.position);
                this.bspHelperCamera.rotation.copy(this.camera.rotation);
                this.bspHelperCamera.updateMatrixWorld(true);
                if (this.bspHelperCameraHelper) {
                    this.bspHelperCameraHelper.visible = false;
                }
            }
        }
        this.needsUpdate = true;
    }

    public setGlobalSkyObject(sky: THREE.Group) {
        this.globalSky.clear();
        this.globalSky.add(sky);
        this.globalSky.updateMatrixWorld(true);
    }

    public stitchTerrains() {
        const terrains: Terrain[] = [];
        this.scene.traverse(child => {
            if ((child as any).isTerrain) {
                terrains.push(child as Terrain);
            } else if ((child as any).isTerrainBatch) {
                const batchSectors = (child as any).sectors as Terrain[];
                if (batchSectors) {
                    batchSectors.forEach(s => terrains.push(s));
                }
            }
        });

        if (terrains.length < 2) return;

        const result = Terrain.stitchAll(terrains);

        (window as any).terrainDebug = result;

        // a settled boundary re-stitches to identical heights, so rebuilding every terrain's
        // trimesh here cost ~160ms per sector add/remove; only the moved edges need it
        for (const terrain of result.modified) {
            this.unregisterCollider(terrain);
            terrain.refreshCollisionGeometry();
            this.registerCollider(terrain);
        }
    }
}

export default RenderManager;
export { RenderManager }

function addResizeListeners(manager: RenderManager) {
    global.addEventListener("resize", (manager as any).onHandleResize.bind(manager));
    (manager as any).onHandleResize();
}

/**
 * Frees GPU resources owned by a sector: geometries, materials and their textures
 * (both direct texture slots and shader uniforms). Textures and geometries are never
 * shared across sectors - every sector decodes from its own library - so disposing
 * everything under it is safe. dispose() is idempotent, shared-within-sector
 * resources getting disposed twice is fine.
 */
function disposeSectorResources(sector: SectorObject) {
    sector.traverse(child => {
        const mesh = child as THREE.Mesh;

        if (!(mesh as any).isMesh && !(child as any).isLine && !(child as any).isPoints) return;

        mesh.geometry?.dispose();

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        for (const material of materials) {
            if (!material) continue;

            // a one-level uniform scan misses everything a transform chain nests
            // (uniforms.shDiffuse.value.map.texture) and every sprite sheet slot
            const textures = new Set<THREE.Texture>();

            collectMaterialTextures(material, textures, new WeakSet());
            for (const texture of textures) texture.dispose();

            material.dispose();
        }
    });

    for (const celestial of sector.celestials) {
        if (celestial.sprite?.isTexture) celestial.sprite.dispose();

        const materials = Array.isArray(celestial.material) ? celestial.material : [celestial.material];
        for (const material of materials) {
            if (!material) continue;

            // MeshStaticMaterial textures nest several levels deep (uniforms.shDiffuse.value.map.texture)
            if ((material as any).uniforms) {
                const textures = new Set<THREE.Texture>();
                collectTexturesDeep((material as any).uniforms, textures, new WeakSet());
                for (const texture of textures) texture.dispose();
            }

            material.dispose();
        }
    }
}

// procedural maps nest several levels deep (uniforms.shDiffuse.value.map.texture), needs a real walk
function collectTexturesDeep(value: any, textures: Set<THREE.Texture>, seen: WeakSet<object>): void {
    if (!value || typeof value !== "object") return;
    if (value.isTexture) { textures.add(value); return; }
    if (seen.has(value)) return;

    seen.add(value);

    for (const nested of Object.values(value)) collectTexturesDeep(nested, textures, seen);
}

function collectMaterialTextures(material: THREE.Material, textures: Set<THREE.Texture>, seen: WeakSet<object>): void {
    for (const value of Object.values(material)) {
        if ((value as THREE.Texture)?.isTexture) textures.add(value as THREE.Texture);
    }

    if ((material as any).uniforms) collectTexturesDeep((material as any).uniforms, textures, seen);
    if ((material as any).sprites) collectTexturesDeep((material as any).sprites, textures, seen);
}

function stageSectorWarmup(sector: SectorObject, root: THREE.Object3D, releaseEmitters: boolean): SectorWarmup_T {
    const materialQueue: SectorMaterialBinding_T[] = [];
    const lightingQueue: any[] = [];
    const fallbackCache = new Map<string, MeshBasicMaterial>();

    root.traverse(child => {
        if ("computeLighting" in child) lightingQueue.push(child);

        if ((child as any).isTerrainBatch) {
            for (const terrainSector of (child as any).sectors ?? [])
                lightingQueue.push(terrainSector);
        }

        const mesh = child as THREE.Mesh;

        if (!(mesh as any).isMesh) return;

        for (let parent = child.parent; parent && parent !== root.parent; parent = parent.parent)
            if ((parent as any).particlePool) return;

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const materialTextures = new Array<THREE.Texture[]>(materials.length);

        for (let i = 0; i < materials.length; i++) {
            const material = materials[i];
            if (!material) continue;

            const textures = new Set<THREE.Texture>();
            collectMaterialTextures(material, textures, new WeakSet());
            if (textures.size === 0) continue;

            materialTextures[i] = Array.from(textures);
        }

        if (!materialTextures.some(Boolean)) return;

        const vertexColors = !!mesh.geometry?.getAttribute("color");
        const fallback = materials.map((material, materialIndex) => {
            if (!material || !materialTextures[materialIndex]) return material;

            const key = [material.visible, material.side, material.transparent, material.depthTest, material.depthWrite, material.blending, vertexColors].join(":");
            let fallbackMaterial = fallbackCache.get(key);

            if (!fallbackMaterial) {
                fallbackMaterial = new MeshBasicMaterial({ color: 0x777777, side: material.side, transparent: material.transparent, opacity: material.transparent ? 0.5 : 1, depthTest: material.depthTest, depthWrite: material.depthWrite, vertexColors });
                fallbackMaterial.visible = material.visible;
                fallbackMaterial.blending = material.blending;
                (fallbackMaterial as any).isSectorFallbackMaterial = true;
                fallbackCache.set(key, fallbackMaterial);
            }

            return fallbackMaterial;
        });

        if (Array.isArray(mesh.material)) {
            for (let i = 0; i < materials.length; i++)
                if (fallback[i] !== materials[i])
                    materialQueue.push({ object: mesh, material: materials[i], materialIndex: i, textureQueue: materialTextures[i] });
        } else if (fallback[0] !== materials[0]) {
            materialQueue.push({ object: mesh, material: materials[0], materialIndex: -1, textureQueue: materialTextures[0] });
        }

        mesh.material = Array.isArray(mesh.material) ? fallback : fallback[0];
    });

    return { sector, materialQueue, warmedTextures: new Set(), lightingQueue, fallbackMaterials: new Set(fallbackCache.values()), releaseEmitters };
}

function restoreSectorMaterials(job: SectorWarmup_T): void {
    for (const binding of job.materialQueue) {
        if (binding.materialIndex < 0) binding.object.material = binding.material;
        else (binding.object.material as THREE.Material[])[binding.materialIndex] = binding.material;
    }

    job.materialQueue.length = 0;
    job.fallbackMaterials.forEach(material => material.dispose());
}

// emitters live under sector.zones, not staticMeshGroup - always walk the whole sector
function setEmitterWarmupGate(sector: SectorObject, allowed: boolean) {
    sector.traverse(child => {
        if ((child as any).particlePool) (child as any).warmupGate = allowed;
    });
}

// merged Terrain sectors aren't in the scene graph anymore, so isTerrainBatch's .sectors needs gating directly
function setLightingGate(root: THREE.Object3D, allowed: boolean) {
    root.traverse(child => {
        if ("computeLighting" in child) (child as any).lightingGate = allowed;

        if ((child as any).isTerrainBatch) {
            for (const terrainSector of (child as any).sectors ?? [])
                terrainSector.lightingGate = allowed;
        }
    });
}

// mirrors the check three's WebGLProgram itself does behind renderer.debug.checkShaderErrors
function reportShaderErrors(gl: WebGL2RenderingContext, program: any) {
    if (gl.getProgramParameter(program.program, gl.LINK_STATUS)) return;

    console.error(
        `[shader] link error in '${program.name}' (cacheKey=${program.cacheKey}):\n` +
        `Program Info Log: ${gl.getProgramInfoLog(program.program)}\n` +
        `Vertex Shader Log: ${gl.getShaderInfoLog(program.vertexShader)}\n` +
        `Fragment Shader Log: ${gl.getShaderInfoLog(program.fragmentShader)}`
    );
}
