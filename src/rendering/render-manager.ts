import "./ue2-conventions";
import "../materials/shader-chunks/register-chunks";
import { WebGLRenderer, PerspectiveCamera, Vector2, Scene, Mesh, BoxGeometry, Vector3, Frustum, Matrix4, Object3D, Box3, SphereGeometry, MeshBasicMaterial, Camera, Color, Sprite, SpriteMaterial, AdditiveBlending, PlaneGeometry, AnimationMixer, AnimationClip, CameraHelper, Fog, MathUtils, WebGLRenderTarget, RGBAFormat, LinearFilter, Sphere, Group, Quaternion } from "three";
import { UGlowPass } from "./postprocessing/uglow-pass";
import GLOBAL_UNIFORMS from "../materials/global-uniforms";
import Player from "../player";
import type BaseActor from "../base-actor";
import Visualizer, { VisualizerMode, EmitterDebugInfo } from "./visualizer";
import EnvColor from "./env-color";
import L2Environment, { FogBlendState, interpolateFogInfoColor, interpolateFogInfoSkyColor, interpolateFogInfoHazeColor, interpolateFogInfoCloudColor, interpolateFogInfoHazeColors } from "./l2-env";
import SkyRenderer from "./sky-renderer";
import Terrain from "../objects/terrain";
import { ColorByte } from "../utils/color-byte";
import EnvInfo from "./env-info";
import AudioManager from "../audio/audio-manager";
import type AssetManager from "../assets/asset-manager";
import InstancedSpriteBatcher from "../objects/emitters/instanced-sprite-batcher";
import type MovableObject from "../objects/movable-object";
import DisplayGammaPass from "./display-gamma";
import ColliderOverlay from "./collider-overlay";
import type PhysicsManager from "../physics/physics-manager";
import LitSkinnedMesh from "../objects/lit-skinned-mesh";
import ShadowProjector from "../objects/shadow-projector";
import type DynamicLight from "../objects/dynamic-light";
import { NUM_ACTOR_LIGHTS } from "../materials/mesh-static-material/mesh-static-material";
import type { ZoneObject, SectorObject } from "../objects/zone-object";
import { IEngineComponent, IObject } from "../game/components";
import type GameManager from "../game/game-manager";
import type UIManager from "../game/ui-manager";
import type InputManager from "../game/input-manager";
import type WaterEffectsComponent from "../physics/components/water-effects-component";
import EffectLifetimeComponent from "./components/effect-lifetime-component";
import PawnRenderableComponent from "./components/pawn-renderable-component";
import AmbientSoundComponent from "../audio/components/ambient-sound-component";

const tmpBox = new Box3();
const tmpCamDir = new Vector3();
const tmpFarPoint = new Vector3();
const tmpPawnWorldPos = new Vector3();
const tmpPawnSunAmbient = new ColorByte();
const arrPawnLights: DynamicLight[] = [];
const arrLightingObjects: THREE.Object3D[] = [];
const tmpShadowDirection = new Vector3(0, 0, -1);
const arrShadowCasters: THREE.Object3D[] = [];
const PAWN_LIGHTING_RADIUS = 24; // FDynamicActor::BoundingSphere stand-in, sized to the pawn collision cylinder
const tmpViewShakePosition = new Vector3();
const tmpViewShakeQuaternion = new Quaternion();
const tmpViewShakeDirection = new Vector3();
const tmpBillboardUp = new Vector3();
const tmpBillboardFront = new Vector3();
const tmpBillboardRight = new Vector3();
const arrBSPGroups: Object3D[] = [];
const arrBSPIntersections: THREE.Intersection[] = [];
// AEmitter::Render (0x8a2ae0): GL2ActorCR * 32768.0 * 0.0625.
const CLIPPING_RANGE_SCALE = 2048;
const tmpColorByte = new ColorByte();
const tmpColorByte_2 = new ColorByte();
const tmpColorByte_3 = new ColorByte();
const tmpColorByte_4 = new ColorByte();
const tmpColorByte_5 = new ColorByte();

const DEFAULT_FAR = 100_000_000;
const DEFAULT_CLEAR_COLOR = 0x0c0c0c;
const DEFAULT_HORIZONTAL_FOV = 60; // Matches user.ini DefaultFOV/DesiredFOV (was 90 from l2.ini)

type ViewShakeState_T = {
    type: GD.IAnimationViewShakeNotifyDecodeInfo["shakeType"];
    direction: Vector3;
    remainingTime: number;
    target: number;
    savedTarget: number;
    phase: number;
    rate: number;
    repeats: number;
    countLimit: number;
};
const PAWN_LIGHTING_MOVE_DISTANCE_SQ = 144;

type PawnLightingState_T = {
    position: Vector3,
    lightingPosition: Vector3,
    sector: SectorObject | null,
    lightingSector: SectorObject | null,
    leafIndex: number | null,
    lightingLeafIndex: number | null,
    zoneIndex: number | null,
    lightingZoneIndex: number | null,
    envVersion: number,
    ambientR: number,
    ambientG: number,
    ambientB: number,
    lights: DynamicLight[]
};
type Disposable_T = { dispose(): void };
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

function checkViewShake(state: ViewShakeState_T): void {
    const crossed = state.target > 0 ? state.phase >= state.target : state.phase <= state.target;

    if (!crossed) return;

    state.phase = state.target;

    if (state.repeats <= 1) {
        state.target = 0;
        state.phase = 0;
        state.rate = 0;
        return;
    }

    if (state.target <= 0) state.target *= -1;
    else switch (state.type) {
        case "damage": state.target *= 1 / (state.countLimit - state.repeats) - 1; break;
        case "down": state.target *= 1 / state.repeats - 1; break;
        case "up":
        case "upDown": state.target *= -1.1; break;
    }

    state.repeats -= 1;
    state.rate *= -1;
}

function updateViewShake(state: ViewShakeState_T, deltaTime: number): boolean {
    if (deltaTime === 0 || state.remainingTime === 0) return false;

    state.remainingTime -= deltaTime;

    if (state.remainingTime <= 0.0001) return false;

    if (state.rate !== 0) {
        state.phase = (Math.trunc(state.phase) + Math.trunc(deltaTime * state.rate)) & 0xffff;
        if (state.phase >= 0x8000) state.phase -= 0x10000;

        if (state.type === "upDown" && state.target > state.savedTarget) {
            state.type = "down";
            state.target = state.savedTarget;
            state.countLimit = Math.trunc(state.repeats + 2);
        }

        if (state.type === "damage" || state.type === "up" || state.type === "down" || state.type === "upDown") checkViewShake(state);
    }

    return true;
}

class RenderManager implements IEngineComponent<GameManager> {
    public readonly renderer: THREE.WebGLRenderer;
    public readonly viewport: HTMLViewportElement;
    public getDomElement() { return this.renderer.domElement; }
    public readonly camera = new PerspectiveCamera(DEFAULT_HORIZONTAL_FOV, 1, 0.1, DEFAULT_FAR);
    public readonly scene = new Scene();
    public readonly objectGroup = new Object3D();
    public readonly lastSize = new Vector2();
    public needsUpdate: boolean = true;
    public isPersistentRendering: boolean = true;
    public readonly mixer = new AnimationMixer(this.scene);
    public readonly skyRenderer = new SkyRenderer();

    protected uGlowPass: UGlowPass;
    protected mainRenderTarget: WebGLRenderTarget;
    protected displayGammaPass: DisplayGammaPass;
    protected displayGammaEnabled: boolean = false;

    public bspHelperCamera: PerspectiveCamera | null = null;
    public bspHelperCameraHelper: CameraHelper | null = null;
    public bspHelperActive: boolean = false;
    public frustumCullingEnabled: boolean = true;
    public readonly visualizer: Visualizer;
    protected readonly manuallyHiddenEmitterUuids: Set<string> = new Set();
    protected readonly particleBatcher = new InstancedSpriteBatcher();
    protected readonly visibleWorldBatchEmitters: any[] = [];
    protected readonly neighborVisibilitySectors: SectorObject[] = [];
    protected neighborVisibilityCursor = 0;
    protected readonly deferredMixerOperations: (() => void)[] = [];
    protected readonly pawnRenderables = new Set<PawnRenderableComponent>();
    protected isUpdatingMixer = false;
    protected pawnLightingStates = new WeakMap<THREE.Object3D, PawnLightingState_T>();
    protected lastRenderOrderSector: SectorObject | null = null;

    protected environment: L2Environment;
    protected activeFogId: string | null = null;

    protected readonly sectors = new Map<number, Map<number, SectorObject>>();
    protected readonly arrLoadedSectors: SectorObject[] = [];

    protected readonly pendingSectorWarmups: SectorWarmup_T[] = [];
    protected static readonly TEXTURE_WARMUP_FRAME_MS = 2;
    protected static readonly MATERIAL_RESTORES_PER_FRAME = 8;

    // deferred shader link/compile error reporting, see processShaderDiagnostics
    protected readonly pendingShaderChecks: any[] = [];
    protected readonly seenPrograms = new WeakSet<object>();
    protected parallelShaderCompileExt: any = undefined; // resolved lazily, null if unsupported
    protected isRendering = false;
    protected isRenderingFrame = false;
    protected readonly _lastListenerPos = new Vector3(Infinity, Infinity, Infinity);
    protected readonly _lastListenerQuat = new Quaternion(0, 0, 0, 0);
    protected pixelRatio: number = global.devicePixelRatio;
    protected readonly frustum = new Frustum();
    protected readonly lastProjectionScreenMatrix = new Matrix4();
    protected readonly viewShakeStates: ViewShakeState_T[] = [];
    protected viewShakeDelta = 1 / 60;
    protected readonly screenFadeElement = document.createElement("div");
    protected screenFadeStartedAt = -1;
    protected screenFadeOutDuration = 0;
    protected screenBlackOutDuration = 0;
    protected screenFadeInDuration = 0;
    protected screenFadeColorAlpha = 1;
    protected manPhysics: PhysicsManager = null;
    protected manUI: UIManager = null;
    protected manInput: InputManager = null;

    public readonly player = new Player(this);
    public readonly waterEffects = this.player.getComponent<WaterEffectsComponent>("waterEffects");
    protected readonly shadowProjector = new ShadowProjector();
    protected readonly colliderOverlay = new ColliderOverlay();
    protected showColliders = false;

    protected readonly sun: THREE.Mesh;
    protected readonly sunCam: THREE.Camera;

    protected get physicsManager(): PhysicsManager { return this.manPhysics || (this.manPhysics = this.manGame.getComponent("physics")); }
    protected get inputManager(): InputManager { return this.manInput || (this.manInput = this.manGame.getComponent("input")); }
    protected sectorBounds = new Array<THREE.Box3>();
    protected currentSectorIndex: THREE.Vector2 | null = null;
    public readonly globalSky = new Group();
    public readonly audioManager: AudioManager = new AudioManager();
    protected activeMusicId: number = -1;

    protected manGame: GameManager;
    public setParent(parent: GameManager): this {
        this.manGame = parent;
        this.manUI = parent.getComponent("ui");

        return this;
    }
    public getParent(): GameManager { return this.manGame; }

    public constructor(viewport: HTMLViewportElement) {
        this.viewport = viewport;
        this.renderer = new WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
            premultipliedAlpha: false,
            logarithmicDepthBuffer: true,
            alpha: true,
        });

        this.renderer.debug.checkShaderErrors = false; // profiled at ~90ms/sector; processShaderDiagnostics polls KHR_parallel_shader_compile instead

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

        this.renderer.autoClear = false;

        this.renderer.setClearColor(DEFAULT_CLEAR_COLOR);
        this.camera.up.set(0, 0, 1);
        this.camera.position.set(0, 15, 5);
        this.camera.lookAt(0, 0, 0);
        this.scene.add(new Mesh(new BoxGeometry()));

        this.objectGroup.name = "SectorGroup"
        this.scene.add(this.objectGroup);
        this.scene.add(this.colliderOverlay);
        this.scene.add(this.waterEffects.underWaterEffect);
        this.objectGroup.add(this.particleBatcher.root);
        this.mixer.addEventListener("finished", (event: any) => {
            let object = event.action.getRoot() as Object3D;

            while (object && !(object as any).isActor) object = object.parent;
            if (object) (object as BaseActor).onAnimationFinished(event.action);
        });

        this.visualizer = new Visualizer(this.scene);
        this.wireEmitterVisibilityHandlers();

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

        // player
        this.camera.position.set(-87021.22448304677, 240008.2840185369, -3660.4757138727023);

        // // audio regression
        // this.camera.position.set(19254.357244041046, 145494.0525086215, -3056.262971968217);
        // this.controls.orbit.target.set(19259.976684368154, 145593.79108779877, -3051.7200968751245);

        // // bad colon lights in EG catacombs
        // this.camera.position.set(43373.971750954406, 144251.6743031877, -5272.650685379844);
        // this.controls.orbit.target.set(43402.97624528142, 144358.5101364896, -5277.364565211859);

        this.camera.lookAt(-87086.51708877791, 239936.94718888338, -3685.930229617832);

        viewport.appendChild(this.renderer.domElement);

        Object.assign(this.screenFadeElement.style, {
            position: "fixed",
            inset: "0px",
            pointerEvents: "none",
            opacity: "0",
            zIndex: "9999"
        });
        viewport.appendChild(this.screenFadeElement);

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
        this.environment = new L2Environment(env);

        return this;
    }

    public getEnvironment(): L2Environment { return this.environment; }

    public takeScreenshot() {
        this.renderer.domElement.toBlob((blob) => {
            if (!blob) return;

            window.open(URL.createObjectURL(blob), "_blank");
        }, "image/jpeg", 0.98);
    }

    public toggleFrustumCulling(): void {
        this.frustumCullingEnabled = !this.frustumCullingEnabled;
        console.log(`Frustum culling is now: ${this.frustumCullingEnabled}`);
    }

    public toggleVisualizer(): void {
        this.visualizer.toggle();
        this.refreshVisualizer();
    }

    public nextVisualizerMode(): void {
        this.visualizer.nextMode();
        this.refreshVisualizer();
    }

    public nextVisualizerLeafDetail(): void {
        this.visualizer.nextLeafDetail();
        this.refreshVisualizer(true);
    }

    protected refreshVisualizer(leavesOnly: boolean = false): void {
        const currentSector = this.getSector(this.camera.position);

        if (!currentSector || !this.visualizer.isEnabled()) return;
        if (leavesOnly && this.visualizer.getMode() !== VisualizerMode.Leaves) return;

        const cameraPos = this.bspHelperActive && this.bspHelperCamera ? this.bspHelperCamera.position : this.camera.position;
        const cameraFrustum = this.bspHelperActive && this.bspHelperCamera
            ? new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(this.bspHelperCamera.projectionMatrix, this.bspHelperCamera.matrixWorldInverse))
            : this.frustum;
        const currentSectorMap = new Map<number, Map<number, SectorObject>>();

        if (currentSector.index) {
            const sectorXMap = new Map<number, SectorObject>();

            sectorXMap.set(currentSector.index.y, currentSector);
            currentSectorMap.set(currentSector.index.x, sectorXMap);
        }

        if (leavesOnly) this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
        else {
            switch (this.visualizer.getMode()) {
                case VisualizerMode.Portals: this.visualizer.updatePortals(currentSectorMap, cameraPos); break;
                case VisualizerMode.Zones: this.visualizer.updateZones(currentSectorMap, cameraPos); break;
                case VisualizerMode.Leaves: this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled); break;
                case VisualizerMode.Fogs: this.visualizer.updateFogs(currentSectorMap, this.activeFogId || undefined); break;
            }

            if (this.visualizer.getMode() !== VisualizerMode.Fogs) this.visualizer.updateFogs(currentSectorMap, this.activeFogId || undefined);
        }

        this.needsUpdate = true;
    }

    public cancelMusic(): void {
        this.activeMusicId = null;
        this.audioManager.cancelMusic();
    }

    public getSectorBounds(): readonly Box3[] { return this.sectorBounds; }

    public updateCameraMatrices(): void {
        this.camera.updateMatrixWorld();
        this.lastProjectionScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.lastProjectionScreenMatrix);
    }


    public pickBSPNode(raycaster: THREE.Raycaster, maxDistance: number) {
        arrBSPGroups.length = 0;
        arrBSPIntersections.length = 0;

        for (const column of this.sectors.values())
            for (const sector of column.values())
                if (sector.bspGroup) arrBSPGroups.push(sector.bspGroup);

        if (arrBSPGroups.length === 0) return;

        const prevFar = raycaster.far;

        raycaster.far = maxDistance;
        raycaster.intersectObjects(arrBSPGroups, true, arrBSPIntersections);
        raycaster.far = prevFar;

        if (arrBSPIntersections.length === 0) return;

        const intersection = arrBSPIntersections[0];
        const geometry = (intersection.object as THREE.Mesh).geometry;
        const nodeIndexAttr = geometry.attributes.nodeIndex;

        if (!nodeIndexAttr) return;

        const indexAttr = geometry.index;
        const vertexIndex = indexAttr ? indexAttr.getX(intersection.faceIndex * 3) : intersection.faceIndex * 3;

        // console.log(intersection, `Node ID: ${nodeIndexAttr.getX(vertexIndex)}`);
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
        const rtWidth = width * pixelRatio;
        const rtHeight = height * pixelRatio;

        this.mainRenderTarget.setSize(rtWidth, rtHeight);
        this.uGlowPass.setSize(rtWidth, rtHeight);
        this.displayGammaPass.setSize(rtWidth, rtHeight);
        this.getDomElement().style.display = oldStyle;
        this.needsUpdate = true;
    }

    public enableZoneCulling = true;

    public screenFadeBlink(info: GD.IAnimationScreenFadeNotifyDecodeInfo): void {
        // UGameEngine::ScreenFadeBlink (L2.exe 0x825650) rejects a blink while either fade state is active.
        if (this.screenFadeStartedAt >= 0) return;

        const color = info.fadeOutColor;

        this.screenFadeOutDuration = Math.max(0, info.fadeOutDuration);
        this.screenBlackOutDuration = Math.max(0, info.blackOutDuration);
        this.screenFadeInDuration = Math.max(0, info.fadeInDuration);
        this.screenFadeColorAlpha = color[3] / 255;
        this.screenFadeElement.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        this.screenFadeStartedAt = performance.now();
        this.needsUpdate = true;
    }

    public addViewShake(actor: BaseActor, info: GD.IAnimationViewShakeNotifyDecodeInfo): void {
        const direction = new Vector3().fromArray(info.shakeVector);

        if (direction.lengthSq() === 0) direction.set(Math.random(), Math.random(), 0);
        direction.normalize();
        direction.z = 0;
        direction.normalize();

        const sourcePosition = actor.getWorldPosition(new Vector3());
        const distance = this.player.position.distanceTo(sourcePosition);
        const intensity = sourcePosition.lengthSq() !== 0 && info.shakeRange !== 0 ? info.shakeIntensity / Math.cosh(distance / info.shakeRange) : info.shakeIntensity;
        const frameRate = 1 / this.viewShakeDelta;
        const frameScale = frameRate < 30 ? frameRate / 30 : 1;
        const repeats = info.shakeCount * frameScale;
        const target = info.shakeType === "upDown" ? 1 : intensity;

        this.viewShakeStates.push({
            type: info.shakeType,
            direction,
            remainingTime: 5 + info.shakeCount * this.viewShakeDelta,
            target,
            savedTarget: intensity,
            phase: 0,
            rate: info.shakeIntensity * 50,
            repeats,
            countLimit: Math.trunc(Math.max(direction.x * frameScale, direction.y * frameScale, direction.z * frameScale, repeats) + 2)
        });
        this.needsUpdate = true;
    }

    protected updateScreenFade(currentTime: number): void {
        if (this.screenFadeStartedAt < 0) return;

        let time = currentTime - this.screenFadeStartedAt;
        let opacity: number;

        if (time < this.screenFadeOutDuration) {
            opacity = this.screenFadeOutDuration > 0 ? time / this.screenFadeOutDuration : 1;
        } else {
            time -= this.screenFadeOutDuration;

            if (time < this.screenBlackOutDuration) {
                opacity = 1;
            } else {
                time -= this.screenBlackOutDuration;

                if (time < this.screenFadeInDuration) opacity = this.screenFadeInDuration > 0 ? 1 - time / this.screenFadeInDuration : 0;
                else {
                    opacity = 0;
                    this.screenFadeStartedAt = -1;
                }
            }
        }

        this.screenFadeElement.style.opacity = `${opacity * this.screenFadeColorAlpha}`;
    }

    protected applyViewShake(_currentTime: number): boolean {
        if (this.viewShakeStates.length === 0) return false;

        tmpViewShakePosition.copy(this.camera.position);
        tmpViewShakeQuaternion.copy(this.camera.quaternion);

        let pitch = 0, yaw = 0;

        for (let i = this.viewShakeStates.length - 1; i >= 0; i--) {
            const state = this.viewShakeStates[i];

            if (!updateViewShake(state, this.viewShakeDelta)) {
                this.viewShakeStates.splice(i, 1);
                continue;
            }

            pitch += Math.trunc(Math.abs(state.direction.y) * state.phase);
            yaw += Math.trunc(Math.abs(state.direction.x) * state.phase);
        }

        tmpViewShakeDirection.set(0, 0, -1).applyQuaternion(this.camera.quaternion);

        const currentYaw = Math.atan2(tmpViewShakeDirection.y, tmpViewShakeDirection.x);
        const currentPitch = Math.atan2(tmpViewShakeDirection.z, Math.hypot(tmpViewShakeDirection.x, tmpViewShakeDirection.y));
        const nextYaw = currentYaw + yaw / 32768 * Math.PI;
        const nextPitch = currentPitch + pitch / 32768 * Math.PI;
        const cosPitch = Math.cos(nextPitch);

        tmpViewShakeDirection.set(Math.cos(nextYaw) * cosPitch, Math.sin(nextYaw) * cosPitch, Math.sin(nextPitch)).add(this.camera.position);
        this.camera.lookAt(tmpViewShakeDirection);

        this.camera.updateMatrixWorld();

        return true;
    }

    protected restoreViewShake(): void {
        this.camera.position.copy(tmpViewShakePosition);
        this.camera.quaternion.copy(tmpViewShakeQuaternion);
        this.camera.updateMatrixWorld();
    }

    public getSectorId(position: THREE.Vector3): [number, number] {
        const sectorSize = 256 * 128;
        const sectorX = Math.floor(position.x / sectorSize) + 20;
        const sectorY = Math.floor(position.y / sectorSize) + 18;

        return [sectorX, sectorY];
    }

    public getSector(position: THREE.Vector3): SectorObject | null {
        return this.getSectorByCoords(...this.getSectorId(position));
    }

    public isSectorCollisionReady(position: THREE.Vector3): boolean {
        const sector = this.getSector(position);

        return !!sector && !!sector.staticMeshGroup;
    }

    public getSectorByCoords(sectorX: number, sectorY: number): SectorObject | null {
        if (!this.sectors.has(sectorX))
            return null;

        const xsect = this.sectors.get(sectorX);

        if (!xsect.has(sectorY))
            return null;

        return xsect.get(sectorY);
    }

    protected static readonly EMITTER_DEBUG_MAX = 80;

    public collectEmitterDebugInfo(): EmitterDebugInfo[] {
        const cameraPosition = this.camera.position;
        const currentSector = this.getSector(cameraPosition);
        const results: EmitterDebugInfo[] = [];

        this.scene.traverse(obj => {
            const emitter = obj as any;
            if (!emitter.particlePool) return;

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

    public setLevelVisible(visible: boolean): void { this.objectGroup.visible = visible; }

    public onFollowPlayerChanged(follow: boolean): void {
        if (!follow) this.viewShakeStates.length = 0;
        this.needsUpdate = true;
    }

    public invalidateSectorVisibility(): void {
        for (const column of this.sectors.values())
            for (const sector of column.values())
                (sector as any).visibilityCacheInitialized = false;

        this.needsUpdate = true;
    }

    public setDisplayGamma(display: any, value: unknown): void {
        display.gamma = parseFloat(value as any);
        this.displayGammaEnabled = display.gamma !== 0;

        if (this.displayGammaEnabled) this.displayGammaPass.setRamp(display);

        this.needsUpdate = true;
    }

    protected wireEmitterVisibilityHandlers(): void {
        this.visualizer.setEmitterVisibilityHandlers(
            (uuid, visible) => this.setEmitterVisible(uuid, visible),
            (visible) => this.setAllEmittersVisible(visible)
        );
    }

    public addPawn(pawn: BaseActor): void {
        this.scene.add(pawn);
        pawn.updateMatrixWorld(true);
        this.physicsManager.addPawn(pawn);
        pawn.beginPlay();
        this.needsUpdate = true;
    }

    public addTransientEffect(effect: Object3D, owner: BaseActor = null): void {
        if (!(effect as any).isGameObject) throw new Error(`Transient effect '${effect.name}' is not a game object.`);

        const object = effect as Object3D & IObject;

        if (!object.findComponent("effectLifetime")) object.addComponent(new EffectLifetimeComponent(this));

        this.scene.add(effect);
        this.physicsManager.registerSimulationObjects(effect);

        const spawnSound = (effect as any).spawnSound as (GD.IEmitterSpawnSoundDecodeInfo & { dataUri: string }) | null;

        if (spawnSound) {
            effect.getWorldPosition(tmpPawnWorldPos);
            this.audioManager.playOneShotSound(spawnSound.dataUri, tmpPawnWorldPos, spawnSound.volume / 255, 1, spawnSound.radius, spawnSound.radius * 100);
        }

        if (owner) owner.gainScriptChild(effect);
        this.needsUpdate = true;
    }

    public removeTransientEffect(effect: Object3D): void {
        const base = (effect as any).scriptBase as BaseActor;
        const owner = (effect as any).scriptOwner as BaseActor;

        if (base) base.detachBoneObject(effect);
        if (owner) owner.loseScriptChild(effect);

        this.physicsManager.unregisterSimulationObjects(effect);
        effect.removeFromParent();

        effect.traverse(child => {
            const mesh = child as any;

            if (!mesh.isMesh) return;

            const materials = mesh.material instanceof Array ? mesh.material : [mesh.material];

            for (const material of materials) material.dispose();
            if (mesh.isInstancedSpriteMesh) mesh.geometry.dispose();
        });

        (effect as Object3D & IObject).detachComponents();

        this.needsUpdate = true;
    }

    public removePawn(pawn: BaseActor): void {
        if (!this.physicsManager.removePawn(pawn)) return;

        pawn.removeFromParent();

        if (this.isUpdatingMixer) this.deferredMixerOperations.push(() => pawn.release());
        else pawn.release();

        this.needsUpdate = true;
    }

    protected runDeferredMixerOperations(): void {
        for (const operation of this.deferredMixerOperations) operation();

        this.deferredMixerOperations.length = 0;
    }

    public spawnNpc(selector: string | number, position: Vector3 = null): Promise<BaseActor> {
        return this.manGame.getComponent("asset").spawnNpc(this, selector, position);
    }

    public listNpcs(): Promise<GD.INpcDefinition[]> {
        return this.manGame.getComponent("asset").listNpcs();
    }

    public registerPawnRenderable(component: PawnRenderableComponent): void { this.pawnRenderables.add(component); }
    public unregisterPawnRenderable(component: PawnRenderableComponent): void { this.pawnRenderables.delete(component); }

    protected updatePawnPresentation(currentTime: number, deltaTime: number): void {
        for (const component of this.pawnRenderables)
            component.getParent().updatePresentation(currentTime, deltaTime / 1000);
    }

    protected updateSectorRenderOrder(activeSector: SectorObject | null): void {
        if (activeSector === this.lastRenderOrderSector) return;

        this.lastRenderOrderSector = activeSector;

        this.sectors.forEach(row => row.forEach(sector => {
            const order = sector === activeSector ? 0 : -1;
            if (sector.staticMeshGroup) sector.staticMeshGroup.renderOrder = order;
            if (sector.bspGroup) sector.bspGroup.renderOrder = order;
        }));
    }

    protected updatePawnVisibility(): void {
        for (const component of this.pawnRenderables) {
            const pawn = component.getParent();

            pawn.visible = !this.frustumCullingEnabled || this.frustum.intersectsSphere(component.getRenderSphere());
        }

        this.sectors.forEach(row => row.forEach(sector => {
            for (const pawn of sector.pawns.children) {
                const state = this.resolvePawnLocation(pawn);

                if (!state.sector) {
                    pawn.visible = false;
                    continue;
                }

                pawn.visible = state.leafIndex !== null && state.sector.visibleLeaves.has(state.leafIndex);
            }
        }));
    }

    // USkeletalMeshInstance::Render, UnSkeletalMesh.cpp line 4908: zone ambient plus hardware lights.
    protected updatePawnLighting(): void {
        const sunAmbient = this.environment.getAmbientPlaneActorLightHalved(tmpPawnSunAmbient);

        for (const row of this.sectors.values())
            for (const sector of row.values())
                for (const pawn of sector.pawns.children)
                    if (pawn.visible) this.updateActorLighting(pawn, sunAmbient);

        this.updatePawnShadow();

        for (const component of this.pawnRenderables)
            this.updateActorLighting(component.getParent(), sunAmbient);
    }

    // AShadowProjector::UpdateLightInfo 0x9363d0: daylight sun or straight down, never actor lights.
    protected updatePawnShadow(): void {
        const timeOfDay = this.environment.getTimeOfDay();

        this.player.getWorldPosition(tmpPawnWorldPos);

        const sector = this.getSector(tmpPawnWorldPos);
        let sun: DynamicLight = null;

        if (sector && timeOfDay >= 7 && timeOfDay < 23)
            for (const light of sector.lightList)
                if (light.isSunlight) {
                    sun = light;
                    break;
                }

        if (sun) tmpShadowDirection.copy(sun.lightDirection).normalize();
        else tmpShadowDirection.set(0, 0, -1);

        const minVertical = Math.abs(tmpShadowDirection.x) * 0.5;

        if (minVertical >= Math.abs(tmpShadowDirection.z))
            tmpShadowDirection.z = tmpShadowDirection.z < 0 ? -minVertical : minVertical;

        arrShadowCasters.length = 0;
        for (const component of this.pawnRenderables) arrShadowCasters.push(component.getParent());

        if (sector) for (const pawn of sector.pawns.children) arrShadowCasters.push(pawn);

        this.shadowProjector.update(this.renderer, this.player, arrShadowCasters, tmpShadowDirection);
    }

    public invalidatePawnLighting(actor: THREE.Object3D): void {
        this.pawnLightingStates.delete(actor);
    }

    protected getPawnLightingState(actor: THREE.Object3D): PawnLightingState_T {
        let state = this.pawnLightingStates.get(actor);

        if (state) return state;

        state = {
            position: new Vector3(NaN, NaN, NaN),
            lightingPosition: new Vector3(NaN, NaN, NaN),
            sector: null,
            lightingSector: null,
            leafIndex: null,
            lightingLeafIndex: null,
            zoneIndex: null,
            lightingZoneIndex: null,
            envVersion: -1,
            ambientR: -1,
            ambientG: -1,
            ambientB: -1,
            lights: []
        };

        this.pawnLightingStates.set(actor, state);

        return state;
    }

    protected resolvePawnLocation(actor: THREE.Object3D): PawnLightingState_T {
        const state = this.getPawnLightingState(actor);

        actor.getWorldPosition(tmpPawnWorldPos);

        if (state.position.equals(tmpPawnWorldPos) && state.sector) return state;

        state.position.copy(tmpPawnWorldPos);
        state.sector = this.getSector(tmpPawnWorldPos);
        state.leafIndex = state.sector ? state.sector.findPositionLeaf(tmpPawnWorldPos) : null;
        state.zoneIndex = state.sector ? state.sector.findPositionZone(tmpPawnWorldPos) : null;

        return state;
    }

    protected updateActorLighting(actor: THREE.Object3D, sunAmbient: ColorByte): void {
        const state = this.resolvePawnLocation(actor);
        const sector = state.sector;

        if (!sector) return;

        const zoneInfo = state.zoneIndex === null ? null : sector.bspZones[state.zoneIndex]?.zoneInfo;
        const moved = state.lightingPosition.distanceToSquared(state.position) >= PAWN_LIGHTING_MOVE_DISTANCE_SQ;
        const locationChanged = state.lightingSector !== sector || state.lightingLeafIndex !== state.leafIndex || state.lightingZoneIndex !== state.zoneIndex;
        const envVersion = this.environment.getEnvVersion();
        const ambientChanged = state.envVersion !== envVersion || state.ambientR !== sunAmbient.r || state.ambientG !== sunAmbient.g || state.ambientB !== sunAmbient.b;
        let relevantLightsChanged = false;
        let relevantLightUpdated = false;

        for (const light of state.lights)
            relevantLightUpdated = relevantLightUpdated || light.needsUpdate;

        if (moved || locationChanged) {
            sector.getRelevantLights(state.position, PAWN_LIGHTING_RADIUS, arrPawnLights, NUM_ACTOR_LIGHTS, !!zoneInfo?.isSunAffected);
            relevantLightsChanged = state.lights.length !== arrPawnLights.length;

            for (let i = 0, len = arrPawnLights.length; i < len; i++) {
                relevantLightsChanged = relevantLightsChanged || state.lights[i] !== arrPawnLights[i];
                relevantLightUpdated = relevantLightUpdated || arrPawnLights[i].needsUpdate;
            }

            state.lights.length = 0;
            state.lights.push(...arrPawnLights);

            state.lightingPosition.copy(state.position);
            state.lightingSector = sector;
            state.lightingLeafIndex = state.leafIndex;
            state.lightingZoneIndex = state.zoneIndex;
        }

        if (!locationChanged && !ambientChanged && !relevantLightsChanged && !relevantLightUpdated) return;

        arrLightingObjects.length = 0;
        arrLightingObjects.push(actor);

        while (arrLightingObjects.length > 0) {
            const object = arrLightingObjects.pop()!;

            for (const child of object.children) arrLightingObjects.push(child);

            if ((object as LitSkinnedMesh).isLitSkinnedMesh)
                (object as LitSkinnedMesh).updateActorLighting(zoneInfo, state.lights, sunAmbient);
        }

        state.envVersion = envVersion;
        state.ambientR = sunAmbient.r;
        state.ambientG = sunAmbient.g;
        state.ambientB = sunAmbient.b;
    }

    protected _updateObjects(currentTime: number) {
        this.visibleWorldBatchEmitters.length = 0;
        this.neighborVisibilitySectors.length = 0;

        GLOBAL_UNIFORMS.globalTimeSeconds.value = currentTime / 1000;

        const ambientSun = this.environment.getAmbientPlaneStaticMeshSunLightHalved(tmpColorByte);
        const sunColor = this.environment.getBaseColorPlaneStaticMeshSunLightScaled(tmpColorByte_2);
        (GLOBAL_UNIFORMS.staticMeshSunAmbient.value as Vector3).set(
            (ambientSun.r + sunColor.r) / 255,
            (ambientSun.g + sunColor.g) / 255,
            (ambientSun.b + sunColor.b) / 255
        );

        {
            const camera = this.camera;
            const projUp = tmpBillboardUp.copy(camera.up).normalize();
            const projFront = tmpBillboardFront.set(0, 0, 1).applyQuaternion(camera.quaternion).normalize();
            const projRight = tmpBillboardRight.crossVectors(projFront, projUp).normalize();
            projUp.crossVectors(projRight, projFront).normalize();
            (GLOBAL_UNIFORMS.cameraBillboardRight.value as Vector3).copy(projRight);
            (GLOBAL_UNIFORMS.cameraBillboardUp.value as Vector3).copy(projUp);
        }

        if (this.bspHelperCamera) {
            if (!this.bspHelperActive) {
                this.bspHelperCamera.position.copy(this.camera.position);
                this.bspHelperCamera.rotation.copy(this.camera.rotation);
                this.bspHelperCamera.updateMatrixWorld(true);
                if (this.bspHelperCameraHelper) {
                    this.bspHelperCameraHelper.visible = false;
                }
            } else {
                if (this.bspHelperCameraHelper) {
                    this.bspHelperCameraHelper.visible = true;
                }
            }
            if (this.bspHelperCameraHelper) {
                this.bspHelperCameraHelper.update();
            }
        }


        const bspCullingCamera = (this.bspHelperCamera && this.bspHelperActive) ? this.bspHelperCamera : this.camera;
        const bspCullingPosition = bspCullingCamera.position;

        const fogFar = (this.scene.fog as Fog)?.far || DEFAULT_FAR;
        const fogSphere = new Sphere(bspCullingPosition, fogFar);

        this.frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(bspCullingCamera.projectionMatrix, bspCullingCamera.matrixWorldInverse));

        // UE2: BoundingPlanes[4] = FPlane(ViewOrigin + Z * FarClip, Z)
        {
            tmpCamDir.set(0, 0, -1).applyQuaternion(bspCullingCamera.quaternion);
            tmpFarPoint.copy(bspCullingPosition).addScaledVector(tmpCamDir, fogFar);
            this.frustum.planes[4].setFromNormalAndCoplanarPoint(tmpCamDir.negate(), tmpFarPoint);
        }

        // TODO: Clip static meshes against [ClippingRange] StaticMesh instead of fog.
        const STATIC_MESH_CLIPPING_RANGE = 1;
        const staticMeshCullDist = fogFar * STATIC_MESH_CLIPPING_RANGE;
        const staticMeshCullDistSq = staticMeshCullDist * staticMeshCullDist;
        const assetMan = this.manGame.getComponent("asset");
        const emitterCullDist = assetMan.userConfig.clippingRange.actor * CLIPPING_RANGE_SCALE;
        const emitterCullDistSq = emitterCullDist * emitterCullDist;

        const activeSector = this.getSector(bspCullingPosition);

        this.physicsManager.setActiveSector(activeSector);
        this.physicsManager.setTriggerPosition(this.camera.position);
        this.updateSectorRenderOrder(activeSector);

        this.scene.traverse((object: THREE.Object3D) => {
            if ((object as any).isSectorObject) {
                const sector = object as SectorObject;
                const isCameraInSector = activeSector === sector;
                const wasVisible = sector.visible;

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

        this.scene.traverseVisible(child => {
            if ((child as any).isUpdatable) {
                let sector: SectorObject | null = null;
                let parent = child.parent;
                while (parent) {
                    if ((parent as any).isSectorObject) {
                        sector = parent as SectorObject;
                        break;
                    }
                    parent = parent.parent;
                }

                if ((child as any).particlePool) {
                    if (sector && sector !== activeSector && !(child as any).needsInitialLighting) return;

                    const emitterUuid = (child as any).emitterActorUuid;
                    const isVisible = (child as any).isActorAttachedEmitter || (!!sector && emitterUuid !== undefined && sector.visibleEmitterUuids.has(emitterUuid));

                    if (!isVisible) return;

                    const mesh = (child as any).instancedMesh;
                    if (mesh?.visible && mesh.isWorldBatchCandidate)
                        this.visibleWorldBatchEmitters.push(child);

                    const pendingSounds = (child as any).pendingSounds;
                    if (pendingSounds.length) {
                        if (sector) for (const snd of pendingSounds)
                            this.audioManager.playOneShotSound(sector.getSoundUri(snd.soundName), snd.position, snd.volume, snd.pitch, snd.refDistance, snd.maxDistance);
                        pendingSounds.length = 0;
                    }
                } else if (sector && sector !== activeSector && !(child as any).needsInitialLighting) return;
                else if (sector && 'computeLighting' in child) (child as any).update(sector, this.environment);
                else (child as any).update(currentTime);
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

        const targetSkyColor = env.getSkyColor(tmpColorByte);

        const presetIndex = parseInt(String(this.manUI.fogPreset).split(" ")[0]);
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

        let targetFogColor = env.getHazeColor(tmpColorByte_2);

        // targetFogStart = 1;
        // targetFogEnd = 10

        const sector = this.getSector(this.camera.position);
        const blendedHazeColors: ColorByte[] = env.getHazeGradient();
        let skyVisibility = 1.0;

        const targetCloudColors: ColorByte[] = [
            env.getCloudColor(0, new ColorByte()),
            env.getCloudColor(1, new ColorByte()),
            env.getCloudColor(2, new ColorByte())
        ];

        if (sector) {
            const zoneIndex = sector.findPositionZone(this.camera.position);
            const cameraZoneMask = 1n << BigInt(zoneIndex);
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

            let accSkyR = 0, accSkyG = 0, accSkyB = 0, totalSkyWeight = 0;
            let accHazeR = 0, accHazeG = 0, accHazeB = 0, totalHazeWeight = 0;
            let accCloudR = [0, 0, 0], accCloudG = [0, 0, 0], accCloudB = [0, 0, 0], totalCloudWeight = [0, 0, 0];

            let accStart = 0, accEnd = 0, accR = 0, accG = 0, accB = 0, totalFogWeight = 0;

            let accHArrR: number[] = [], accHArrG: number[] = [], accHArrB: number[] = [];

            let totalHArrWeight = 0;

            const presetIndex = this.manUI.fogPreset;
            const timeOfDay = env.getTimeOfDay();

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

            fogInfos.forEach(fogInfo => {
                if (fogInfo.zoneMask && !(fogInfo.zoneMask & cameraZoneMask)) {
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

                accStart += range.A * weight;
                accEnd += range.B * weight;
                accR += fogColor.r * weight;
                accG += fogColor.g * weight;
                accB += fogColor.b * weight;
                totalFogWeight += weight;

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

            skyVisibility = 1.0;
            activeInfos.forEach(({ fogInfo, weight }) => {
                if ((fogInfo as any).useFogColorClear) {
                    skyVisibility = Math.max(0, skyVisibility - weight);
                }
            });

            if (this.activeFogId) {
                targetFogStart = accStart / totalFogWeight;
                targetFogEnd = accEnd / totalFogWeight;
                targetFogColor.set(
                    accR / totalFogWeight,
                    accG / totalFogWeight,
                    accB / totalFogWeight,
                    255
                );
            }

            if (totalSkyWeight > 0 && this.activeFogId) {
                targetSkyColor.set(
                    accSkyR / totalSkyWeight,
                    accSkyG / totalSkyWeight,
                    accSkyB / totalSkyWeight,
                    255
                );
            }

            targetCloudColors.forEach((tc, idx) => {
                const baseCloud = env.getCloudColor(idx, new ColorByte());
                tc.copy(baseCloud);
                if (this.activeFogId && totalCloudWeight[idx] > 0) {
                    const r = accCloudR[idx] / totalCloudWeight[idx];
                    const g = accCloudG[idx] / totalCloudWeight[idx];
                    const b = accCloudB[idx] / totalCloudWeight[idx];
                    tc.set(r, g, b, 255);
                }
            });

            if (totalHArrWeight > 0) {
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

            if (totalHazeWeight > 0) {
                const hW = totalHazeWeight >= 0.95 ? 1.0 : Math.min(totalHazeWeight, 1.0);
                tmpColorByte_4.set(
                    MathUtils.lerp(255, accHazeR / totalHazeWeight, hW), // 255 is base (White) assumption if no fog color used
                    MathUtils.lerp(255, accHazeG / totalHazeWeight, hW),
                    MathUtils.lerp(255, accHazeB / totalHazeWeight, hW),
                    255
                );
            } else tmpColorByte_4.set(255, 255, 255, 255);
        }

        const waterVolume = sector ? sector.getWaterVolumeAt(this.camera.position) : null;

        this.waterEffects.underWaterEffect.setVolume(waterVolume, env.getEnv().waterVolume.cellophaneColor);
        this.audioManager.setUnderwater(!!waterVolume);

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

        const targetClearColor = targetSkyColor.clone();

        if (skyVisibility < 1.0)
            targetClearColor.lerp(targetFogColor, 1.0 - skyVisibility);

        this.skyRenderer.update(this.camera, env, targetSkyColor, tmpColorByte_4, blendedHazeColors, targetCloudColors, targetFogColor, targetFogStart, targetFogEnd, sector, targetClearColor, skyVisibility);

        const clearColorThree = new Color().setRGB(targetClearColor.r / 255, targetClearColor.g / 255, targetClearColor.b / 255);
        this.renderer.setClearColor(clearColorThree);

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

    public onBeforeEngineTick(currentTime: number, deltaTime: number): void {
        this.isRenderingFrame = this.isRendering && (this.isPersistentRendering || this.needsUpdate);

        if (!this.isRenderingFrame) return;

        this.manUI.beginFrame();
        this.updateScreenFade(currentTime);

        this.manGame.getComponent("asset").tick(this);
        this.processSectorWarmups();
        this.processShaderDiagnostics();
        this.viewShakeDelta = deltaTime / 1000;

        this.isUpdatingMixer = true;
        try {
            this.mixer.update(deltaTime / 1000);
        } finally {
            this.isUpdatingMixer = false;
            this.runDeferredMixerOperations();
        }

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

        const timeOfDay = this.environment.getTimeOfDay();

        // UL2NEnvManager::IsDay (L2.exe 0x7b7320): 6.0 <= time <= 24.0.
        this.waterEffects.setUnderWaterState(this.camera.position, timeOfDay >= 6 && timeOfDay <= 24);
        this.waterEffects.underWaterEffect.updatePresentation(this.camera);

        this.inputManager.updateCamera();

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

        this.updatePawnPresentation(currentTime, deltaTime);

        this.inputManager.updateFollowPlayer();

        this.audioManager.update(currentTime);

        this._updateObjects(currentTime);

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

        {
            const camPos = this.camera.position;
            const timeOfDay = this.environment.getTimeOfDay();
            const isDaytime = timeOfDay >= 6 && timeOfDay < 18;
            const isSubmerged = !!(activeSector && activeSector.getWaterVolumeAt(camPos));

            this.audioManager.updateAmbientSounds(currentTime, camPos.x, camPos.y, camPos.z, isDaytime, isSubmerged);

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

    public onEngineTick(currentTime: number, _deltaTime: number): void {
        if (!this.isRenderingFrame) return;

        const viewShakeActive = this.applyViewShake(currentTime);

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

        const currentSector = this.getSector(this.camera.position);
        if (currentSector) {
            const sectorIndex = currentSector.index;
            if (this.currentSectorIndex === null ||
                !sectorIndex.equals(this.currentSectorIndex)) {
                const wasEnabled = this.visualizer.isEnabled();
                const currentMode = this.visualizer.getMode();

                this.visualizer.destroy();
                this.scene.remove(this.visualizer.getGroup());
                this.scene.remove(this.visualizer.getFogGroup());
                this.scene.remove(this.visualizer.getEmitterLabelGroup());

                (this as any).visualizer = new Visualizer(this.scene);
                this.wireEmitterVisibilityHandlers();

                this.visualizer.setMode(currentMode);
                if (wasEnabled && !this.visualizer.isEnabled()) {
                    this.visualizer.toggle();
                } else if (!wasEnabled && this.visualizer.isEnabled()) {
                    this.visualizer.toggle();
                }

                this.currentSectorIndex = sectorIndex.clone();
            }
        } else if (this.currentSectorIndex !== null) this.currentSectorIndex = null;

        if (currentSector) {
            const cameraPos = this.bspHelperActive && this.bspHelperCamera ? this.bspHelperCamera.position : this.camera.position;

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
                this.visualizer.updateAudioHUD(musicState, ambientSounds, currentTime, this.camera.position);
            } else if (this.visualizer.getMode() === VisualizerMode.Emitters) {
                this.visualizer.updateEmitters(this.collectEmitterDebugInfo());
            }
        }

        this.renderer.autoClear = false;

        // Render World
        this.renderer.render(this.scene, this.camera);

        this.waterEffects.underWaterEffect.renderCellophane(this.renderer);

        // // Apply Native Bloom (Sun/Glow) -> Screen
        // this.uGlowPass.render(this.renderer, null, this.mainRenderTarget);

        // this.renderer.setRenderTarget(null);

        if (this.displayGammaEnabled) this.displayGammaPass.render(this.renderer);

        if (viewShakeActive) this.restoreViewShake();
    }

    public onAfterEngineTick(_currentTime: number, _deltaTime: number): void {
        if (!this.isRenderingFrame) return;

        this.manUI.endFrame();
        this.needsUpdate = this.viewShakeStates.length > 0 || this.screenFadeStartedAt >= 0;
        this.isRenderingFrame = false;
    }

    public startTicking(_currentTime: number): void {
        this.scene.updateMatrixWorld(true);
        this.physicsManager.registerSimulationObjects(this.scene);
        this.updateColliderOverlay();
        this.stitchTerrains();
        this.isRendering = true;
        this.needsUpdate = true;
    }

    public setCollidersVisible(visible: boolean): void {
        this.showColliders = visible;
        this.colliderOverlay.visible = visible;

        this.updateColliderOverlay();

        this.needsUpdate = true;
    }

    protected updateColliderOverlay(): void {
        if (this.showColliders) this.colliderOverlay.rebuild(this.physicsManager.getColliders());
    }

    public setSky(sector: SectorObject) {
        this.skyRenderer.initSkyLevel(this.environment.getEnv(), sector);
    }

    public getLoadedSectors(): readonly SectorObject[] { return this.arrLoadedSectors; }

    public addSector(sector: SectorObject) {
        if (sector.index) {
            if (!this.sectors.has(sector.index.x))
                this.sectors.set(sector.index.x, new Map());

            const column = this.sectors.get(sector.index.x);

            if (column.has(sector.index.y) || this.arrLoadedSectors.includes(sector))
                throw new Error(`Sector '${sector.index.x}_${sector.index.y}' is already loaded.`);

            column.set(sector.index.y, sector);
            this.arrLoadedSectors.push(sector);
        }

        if (sector.ambientSounds && sector.getComponents("ambientSound").length === 0)
            for (const info of sector.ambientSounds)
                sector.addComponent(new AmbientSoundComponent(this.audioManager, info, sector.getSoundUri(info.soundName)));

        retainSectorResources(sector, sector);
        this.pawnLightingStates = new WeakMap();
        this.lastRenderOrderSector = null;

        sector.worldBounds.setFromObject(sector);
        this.sectorBounds.push(sector.worldBounds);

        this.objectGroup.add(sector);
        this.physicsManager.registerSimulationObjects(sector);
        this.updateColliderOverlay();
        this.stitchTerrains();

        setLightingGate(sector, false);

        if (sector.staticMeshGroup) {
            this.physicsManager.setEmitterWarmupGate(sector, false);
        }

        this.queueSectorWarmup(sector, sector, !!sector.staticMeshGroup);

        sector.updateMatrixWorld(true);
        freezeStaticSubtree(sector);

        const currentSector = this.getSector(this.camera.position);
        if (currentSector && this.visualizer.isEnabled()) {
            const cameraPos = this.bspHelperActive && this.bspHelperCamera ? this.bspHelperCamera.position : this.camera.position;
            const cameraFrustum = this.bspHelperActive && this.bspHelperCamera
                ? new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(this.bspHelperCamera.projectionMatrix, this.bspHelperCamera.matrixWorldInverse))
                : this.frustum;

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
            this.physicsManager.setEmitterWarmupGate(job.sector, true);

        (job.sector as any).visibilityCacheInitialized = false;
    }

    protected queueSectorWarmup(sector: SectorObject, root: THREE.Object3D, releaseEmitters: boolean) {
        const job = stageSectorWarmup(sector, root, releaseEmitters);

        if (job.materialQueue.length > 0 || job.lightingQueue.length > 0) {
            this.pendingSectorWarmups.push(job);
            return;
        }

        setLightingGate(root, true);
        if (releaseEmitters) this.physicsManager.setEmitterWarmupGate(sector, true);
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

    // repeats addSector's staticMeshGroup-scoped bookkeeping once decodeSectorStaticMeshes runs
    public attachStaticMeshGroup(sector: SectorObject) {
        retainSectorResources(sector, sector.staticMeshGroup);

        sector.worldBounds.setFromObject(sector);

        sector.staticMeshGroup.updateMatrixWorld(true);
        this.physicsManager.registerSimulationObjects(sector.staticMeshGroup);
        this.updateColliderOverlay();
        if (!freezeStaticSubtree(sector.staticMeshGroup)) unfreezeAncestors(sector.staticMeshGroup);

        setLightingGate(sector.staticMeshGroup, false);
        this.queueSectorWarmup(sector, sector.staticMeshGroup, true);
    }

    public removeSector(sector: SectorObject) {
        this.pawnLightingStates = new WeakMap();

        if (sector.index)
            this.sectors.get(sector.index.x)?.delete(sector.index.y);

        const sectorIndex = this.arrLoadedSectors.indexOf(sector);

        if (sectorIndex >= 0) this.arrLoadedSectors.splice(sectorIndex, 1);

        const boundsIndex = this.sectorBounds.indexOf(sector.worldBounds);
        if (boundsIndex >= 0) this.sectorBounds.splice(boundsIndex, 1);

        for (const component of sector.getComponents<AmbientSoundComponent>("ambientSound")) sector.removeComponent(component);

        this.physicsManager.unregisterSimulationObjects(sector);
        this.updateColliderOverlay();
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

        releaseSectorResources(sector);
    }

    public toggleBSPHelperCamera() {
        if (!this.bspHelperCamera) {
            this.bspHelperCamera = new PerspectiveCamera(this.camera.fov, this.camera.aspect, 0.1, DEFAULT_FAR);
            this.bspHelperCamera.position.copy(this.camera.position);
            this.bspHelperCamera.rotation.copy(this.camera.rotation);
            this.bspHelperCamera.updateMatrixWorld(true);

            this.bspHelperCameraHelper = new CameraHelper(this.bspHelperCamera);
            this.bspHelperCameraHelper.name = "BSPHelperCameraHelper";
            this.bspHelperCameraHelper.visible = false;
            this.scene.add(this.bspHelperCameraHelper);

            this.bspHelperActive = false;
        } else {
            this.bspHelperActive = !this.bspHelperActive;

            if (this.bspHelperActive) {
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

        // Rebuilding settled terrain trimeshes cost roughly 160ms per sector change.
        for (const terrain of result.modified) this.physicsManager.refreshCollider(terrain);

        this.updateColliderOverlay();
    }
}

function addResizeListeners(manager: RenderManager) {
    global.addEventListener("resize", (manager as any).onHandleResize.bind(manager));
    (manager as any).onHandleResize();
}

// Name-keyed material caches share resources across neighbouring sectors.
const resourceRefs = new Map<Disposable_T, number>();

function collectMaterialResources(material: THREE.Material, target: Set<Disposable_T>) {
    // Uniform textures may be nested under transform chains and sprite-sheet slots.
    const textures = new Set<THREE.Texture>();

    collectMaterialTextures(material, textures, new WeakSet());
    for (const texture of textures) target.add(texture);

    target.add(material);
}

function collectSectorResources(root: THREE.Object3D, target: Set<Disposable_T>) {
    root.traverse(child => {
        const mesh = child as THREE.Mesh;

        if (!(mesh as any).isMesh && !(child as any).isLine && !(child as any).isPoints) return;

        if (mesh.geometry) target.add(mesh.geometry);

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        for (const material of materials) {
            if (!material) continue;

            collectMaterialResources(material, target);
        }
    });
}

function collectCelestialResources(sector: SectorObject, target: Set<Disposable_T>) {
    for (const celestial of sector.celestials) {
        if (celestial.sprite?.isTexture) target.add(celestial.sprite);

        const materials = Array.isArray(celestial.material) ? celestial.material : [celestial.material];

        for (const material of materials) {
            if (!material) continue;

            collectMaterialResources(material, target);
        }
    }
}

// Retain twice safely because progressive static meshes arrive after the sector root.
function retainSectorResources(sector: SectorObject, root: THREE.Object3D) {
    const resources = new Set<Disposable_T>();

    collectSectorResources(root, resources);

    if (root === sector) collectCelestialResources(sector, resources);

    for (const resource of resources) {
        if (sector.retainedResources.has(resource)) continue;

        sector.retainedResources.add(resource);
        resourceRefs.set(resource, (resourceRefs.get(resource) ?? 0) + 1);
    }
}

function releaseSectorResources(sector: SectorObject) {
    for (const resource of sector.retainedResources) {
        const refs = (resourceRefs.get(resource) ?? 1) - 1;

        if (refs > 0) {
            resourceRefs.set(resource, refs);
            continue;
        }

        resourceRefs.delete(resource);
        resource.dispose();
    }

    sector.retainedResources.clear();
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

export default RenderManager;
export { RenderManager };
