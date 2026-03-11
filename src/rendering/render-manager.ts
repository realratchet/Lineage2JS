import { WebGLRenderer, PerspectiveCamera, Vector2, Scene, Mesh, BoxGeometry, Raycaster, Vector3, Frustum, Matrix4, Object3D, Box3, SphereGeometry, MeshBasicMaterial, Camera, Color, Sprite, SpriteMaterial, AdditiveBlending, PlaneGeometry, AnimationMixer, CameraHelper, Fog, MathUtils, WebGLRenderTarget, RGBAFormat, LinearFilter, Sphere, Group } from "three";
import { UGlowPass } from "./postprocessing/uglow-pass";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import GLOBAL_UNIFORMS from "@client/materials/global-uniforms";
import Player from "@client/player";
import RAPIER from "@dimforge/rapier3d";
import type { ICollidable } from "@client/objects/objects";
import Stats from "./stats";
import Visualizer, { VisualizerMode } from "./visualizer";
import EnvColor from "@client/rendering/env-color";
import L2Environment, { FogBlendState, interpolateFogInfoColor, interpolateFogInfoSkyColor, interpolateFogInfoHazeColor, interpolateFogInfoCloudColor, interpolateFogInfoHazeColors } from "@client/rendering/l2-env";
import SkyRenderer from "./sky-renderer";
import Terrain from "../objects/terrain";
import { ColorByte } from "@client/utils/color-byte";
import EnvInfo from "@client/rendering/env-info";
import AudioManager from "@client/rendering/audio-manager";
import * as dat from "dat.gui";

const gui = new dat.GUI({ autoPlace: false, width: 300 });
Object.assign(gui.domElement.style, {
    position: "fixed",
    top: "0px",
    right: "0px",
    zIndex: "10000"
});
document.body.appendChild(gui.domElement);
const guiFolders = {
    world: gui.addFolder("World")
};
guiFolders.world.open();

const stats = new (Stats as any)(0);

stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const tmpBox = new Box3();
const dirForward = new Vector3(), dirRight = new Vector3(), cameraVelocity = new Vector3();
const tmpColorByte = new ColorByte();
const tmpColorByte_2 = new ColorByte();
const tmpColorByte_3 = new ColorByte(); // For sky color blending
const tmpColorByte_4 = new ColorByte(); // For haze color blending
const tmpColorByte_5 = new ColorByte(); // For cloud color blending

const DEFAULT_FAR = 100_000_000;
const DEFAULT_CLEAR_COLOR = 0x0c0c0c;
const DEFAULT_HORIZONTAL_FOV = 60; // Matches user.ini DefaultFOV/DesiredFOV (was 90 from l2.ini)

type ZoneObject = import("../objects/zone-object").ZoneObject;
type SectorObject = import("../objects/zone-object").SectorObject;



class RenderManager {
    public readonly renderer: THREE.WebGLRenderer;
    public readonly viewport: HTMLViewportElement;
    public getDomElement() { return this.renderer.domElement; }
    public readonly camera = new PerspectiveCamera(DEFAULT_HORIZONTAL_FOV, 1, 0.1, DEFAULT_FAR);
    public readonly scene = new Scene();
    public readonly objectGroup = new Object3D();
    public readonly lastSize = new Vector2();
    public readonly controls: { orbit: OrbitControls, fps: PointerLockControls } = { orbit: null, fps: null };
    public needsUpdate: boolean = true;
    public isPersistentRendering: boolean = true;
    public readonly raycaster = new Raycaster();
    public speedCameraFPS = 5;
    public readonly mixer = new AnimationMixer(this.scene);

    public readonly skyRenderer = new SkyRenderer();
    private uGlowPass: UGlowPass;
    private mainRenderTarget: WebGLRenderTarget;

    public bspHelperCamera: PerspectiveCamera | null = null;
    public bspHelperCameraHelper: CameraHelper | null = null;
    public bspHelperActive: boolean = false;
    public frustumCullingEnabled: boolean = true;
    public readonly visualizer: Visualizer;

    protected environment: L2Environment;
    protected activeFogId: string | null = null;

    protected shiftTimeDown: number = 0;
    protected readonly sectors = new Map<number, Map<number, SectorObject>>();
    protected readonly dirKeys = { left: false, right: false, up: false, down: false, shift: false };
    protected isOrbitControls = true;
    protected lastRender: number = 0;
    protected pixelRatio: number = global.devicePixelRatio;
    protected readonly frustum = new Frustum();
    protected readonly lastProjectionScreenMatrix = new Matrix4();

    public readonly player = new Player(this);

    protected readonly sun: THREE.Mesh;
    protected readonly sunCam: THREE.Camera;

    public readonly physicsWorld: RAPIER.World;

    protected activeSector = 0;
    protected sectorBounds = new Array<THREE.Box3>();
    protected currentSectorIndex: THREE.Vector2 | null = null;
    public readonly globalSky = new Group();
    public readonly audioManager: AudioManager = new AudioManager();
    protected activeMusicId: number = -1;

    public envConfig = {
        showLevel: true,
        fogPreset: "4"
    };

    public constructor(viewport: HTMLViewportElement) {
        this.viewport = viewport;
        this.renderer = new WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
            premultipliedAlpha: false,
            logarithmicDepthBuffer: true,
            alpha: true,
        });

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

        guiFolders.world.add(this.envConfig, "fogPreset", {
            "1 (2k-8k)": "1",
            "2 (3k-10k)": "2",
            "3 (4k-12k)": "3",
            "4 (5k-14k)": "4",
            "5 (8k-20k)": "5"
        });

        guiFolders.world.add(this.envConfig, "showLevel")
            .name("Show Level")
            .onChange(v => {
                this.objectGroup.visible = v;
            });

        const skyFolder = gui.addFolder("Sky Layers");
        skyFolder.add(this.skyRenderer.config, "celestials").name("Celestials");
        skyFolder.add(this.skyRenderer.config, "haze1").name("Haze");
        skyFolder.add(this.skyRenderer.config, "starsClouds").name("Stars/Clouds");
        // skyFolder.add(this.skyRenderer.config, "haze2").name("Haze 2 (Dome)");

        skyFolder.open();

        const audioFolder = gui.addFolder("Audio");
        audioFolder.add(this.audioManager, "musicVolume", 0, 1, 0.01).name("Music Volume");
        audioFolder.add(this.audioManager, "ambientVolume", 0, 1, 0.01).name("Ambient Volume");
        audioFolder.open();

        this.renderer.autoClear = false;

        this.renderer.setClearColor(DEFAULT_CLEAR_COLOR);
        this.controls.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.fps = new PointerLockControls(this.camera, this.renderer.domElement);
        this.camera.position.set(0, 5, 15);
        this.camera.lookAt(0, 0, 0);
        this.scene.add(new Mesh(new BoxGeometry()));

        this.objectGroup.name = "SectorGroup"
        this.scene.add(this.objectGroup);

        // Create visualizer system (will be recreated when sector changes)
        this.visualizer = new Visualizer(this.scene);

        this.physicsWorld = new RAPIER.World(new Vector3(0, -9.8 * 100, 0));


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

        // elven ruins colon
        this.camera.position.set(-113423.1583509125, -3347.4875149571467, 235975.71810164873);
        this.controls.orbit.target.set(-113585.15625, -3498.14697265625, 235815.328125);

        // // elven ruins light fixture with two lights
        // this.camera.position.set(-114663.6589876172, -3794.0658040717663, 235906.27471226442);
        // this.controls.orbit.target.set(-114748.37491935505, -3810.9831230352693, 235855.90592005264);

        // // tower ceiling fixture (too red)
        // this.camera.position.set(17589.39507123414, -5841.085927319365, 116621.38351101281);
        // this.controls.orbit.target.set(17611.91280729978, -5819.704399240179, 116526.32678153258);

        // tower outside
        this.camera.position.set(13202.948810614555, -3573.003864493672, 114479.97315173852);
        this.controls.orbit.target.set(13298.353862721668, -3547.92988464792, 114463.56670278899);

        // // execution grounds necropolis
        // this.camera.position.set(39685.67263674792, -2453.9874334636006, 145466.98825143554);
        // this.controls.orbit.target.set(39689.71781138217, -2528.306592105407, 145400.2027798047);

        // // cruma top
        // this.camera.position.set(17493.974642555284, 20660.858986037056, 112602.20721151105);
        // this.controls.orbit.target.set(17494.774633985846, 20560.86218601999, 112602.20697106984);

        // talking island
        // this.camera.position.set(-81557.82679558189, -2819.5704971954897, 242774.90441893184);
        // this.controls.orbit.target.set(-81647.1623503648, -2864.2521455152955, 242770.13902754657);

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

        this.camera.lookAt(this.controls.orbit.target);
        this.controls.orbit.update();

        viewport.appendChild(this.renderer.domElement);

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
        this.player.position.set(-84272.02537263982, -3730.723876953125, 245391.89904573155);    // near church
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
            .name("Time");
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
        const { width, height } = this.renderer.getSize(new Vector2());

        return new Vector2(
            point.x / width * 2 - 1,
            1 - point.y / height * 2
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

                if (this.visualizer.getMode() === VisualizerMode.Portals) { // Portals
                    this.visualizer.updatePortals(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Zones) { // Zones
                    this.visualizer.updateZones(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Leaves) { // Leaves
                    this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
                } else if (this.visualizer.getMode() === VisualizerMode.Fogs) { // Fogs
                    this.visualizer.updateFogs(currentSectorMap, this.activeFogId || undefined);
                }

                // Overlay fogs if in other modes
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

                if (this.visualizer.getMode() === VisualizerMode.Portals) { // Portals
                    this.visualizer.updatePortals(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Zones) { // Zones
                    this.visualizer.updateZones(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Leaves) { // Leaves
                    this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
                } else if (this.visualizer.getMode() === VisualizerMode.Fogs) { // Fogs
                    this.visualizer.updateFogs(currentSectorMap, this.activeFogId || undefined);
                }

                // Overlay fogs if in other modes
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
            if (currentSector && this.visualizer.getMode() === 3 && this.visualizer.isEnabled()) {
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
                this.camera.position.set(13202.948810614555, -3573.003864493672, 114479.97315173852);
                this.controls.orbit.target.set(13298.353862721668, -3547.92988464792, 114463.56670278899);
                this.controls.orbit.update();
                break;
            case "2":
                this.cancelMusic();
                this.camera.position.set(17046.05501814811, -12013.89353241769, 117471.20102308583);
                this.controls.orbit.target.set(17083.7099694609, -11980.75765759009, 117384.69022352276);
                this.controls.orbit.update();
                break;
            case "3":
                this.cancelMusic();
                this.camera.position.set(15242.674545699758, -12078.741557239728, 110436.41811293362);
                this.controls.orbit.target.set(15174.047463755987, -12027.349302874225, 110487.88810239462);
                this.controls.orbit.update();
                break;
            case "4":
                this.cancelMusic();
                this.camera.position.set(12918.803737500606, -11769.26992456535, 109998.28664096774);
                this.controls.orbit.target.set(12961.940094338941, -11789.664021556502, 110631.6332572824);
                this.controls.orbit.update();
                break;
            case "5":
                this.cancelMusic();
                this.camera.position.set(23756.20212599347, -8869.681711370744, 116491.99214326135);
                this.controls.orbit.target.set(23753.308437823456, -8868.697361740096, 116591.94542046914);
                this.controls.orbit.update();
                break;
            case "6":
                this.cancelMusic();
                this.camera.position.set(17436.46445202629, -6351.127037466889, 109469.23150265992);
                this.controls.orbit.target.set(18965.828211115713, -6064.126549127763, 106770.89206042158);
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

    public onHandleMouseUp(event: MouseEvent) {
        if (event.button !== 0 || !this.isOrbitControls) return;

        try {
            const position = new Vector2(event.pageX, event.pageY);
            const ssPosition = this.toScreenSpaceCoords(position);
            const intersections: THREE.Intersection[] = [];

            this.raycaster.setFromCamera(ssPosition, this.camera);
            this.raycaster.intersectObject(this.scene, true, intersections);

            if (intersections.length === 0) return;

            const intersection = intersections[0];

            const collidable = intersections.find(i => (i.object as any).isCollidable);

            if (collidable)
                // this.player.getRigidbody().setTranslation(
                //     new Vector3().addVectors(intersection.point, new Vector3(0, 100 * 1, 0)),
                //     true
                // );
                this.player.goTo(collidable.point);

            console.log(intersection);

            if ((intersection.object as any).isMesh) {
                const mesh = intersection.object as THREE.Mesh;
                const geometry = mesh.geometry;
                if (geometry.attributes.nodeIndex) {
                    const nodeIndexAttr = geometry.attributes.nodeIndex;
                    const indexAttr = geometry.index;
                    let vertexIndex;

                    if (indexAttr) {
                        vertexIndex = indexAttr.getX(intersection.faceIndex! * 3);
                    } else {
                        vertexIndex = intersection.faceIndex! * 3;
                    }

                    const nodeIndex = nodeIndexAttr.getX(vertexIndex);
                    console.log(`Node ID: ${nodeIndex}`);
                }
            }
        } catch (e) {
            console.error(e);
        }
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

    public getSector(position: THREE.Vector3): SectorObject | null {
        const sectorSize = 256 * 128;
        const sectorX = Math.floor(position.x / sectorSize) + 20;
        const sectorY = Math.floor(position.z / sectorSize) + 18;

        return this.getSectorByCoords(sectorX, sectorY);
    }

    public getSectorByCoords(sectorX: number, sectorY: number): SectorObject | null {
        if (!this.sectors.has(sectorX))
            return null;

        const xsect = this.sectors.get(sectorX);

        if (!xsect.has(sectorY))
            return null;

        return xsect.get(sectorY);
    }



    protected _updateObjects(currentTime: number) {
        const globalTime = currentTime / 600;
        GLOBAL_UNIFORMS.globalTime.value = globalTime;

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
            const camDir = new Vector3(0, 0, -1).applyQuaternion(bspCullingCamera.quaternion);
            const farPoint = bspCullingPosition.clone().add(camDir.multiplyScalar(fogFar));
            this.frustum.planes[4].setFromNormalAndCoplanarPoint(camDir.clone().negate(), farPoint);
        }

        // Distance culling for static mesh actors: fogFar × ClippingRange.StaticMesh (default 4.0 from l2.ini)
        const STATIC_MESH_CLIPPING_RANGE = 4;
        const staticMeshCullDist = fogFar * STATIC_MESH_CLIPPING_RANGE;
        const staticMeshCullDistSq = staticMeshCullDist * staticMeshCullDist;

        const activeSector = this.getSector(bspCullingPosition);

        this.scene.traverse((object: THREE.Object3D) => {
            if ((object as any).isSectorObject) {
                const sector = object as SectorObject;
                const isCameraInSector = activeSector === sector;

                // 1. Z-Culling: If outside fog range, hide entire sector
                // NEVER cull the active sector
                if (!isCameraInSector) {
                    if (!fogSphere.intersectsBox(sector.worldBounds)) {
                        sector.visible = false;
                        return;
                    }
                }

                sector.visible = true;

                // 2. Zone Visibility: If camera is not in the sector, only show top level
                const topLevelOnly = !isCameraInSector;

                sector.updateVisibility(this.environment, bspCullingPosition, this.frustum, this.frustumCullingEnabled, topLevelOnly, staticMeshCullDistSq);
            }
        });

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

                // Skip lighting updates for objects in non-active (distant) sectors
                if (sector && sector !== activeSector) return;

                if (sector && 'computeLighting' in child) {
                    (child as any).update(sector, this.environment);
                } else {
                    (child as any).update(currentTime);
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
        });

        this._updateEnvironment();
    }

    protected _updateEnvironment() {
        const env = this.environment;
        if (!env) return;

        // 1. Get Base Sky Color (from timeenv - will be blended with L2FogInfo later)
        const targetSkyColor = env.getSkyColor(tmpColorByte);

        // 2. Get Fog Settings
        // Default Fog Settings (from Env.int [FOG] StartRange1=1.0 (2000u), EndRange1=4.0 (8000u))

        // Fix: Load Fog Presets Dynamically from EnvInfo (Env.int)
        // Scaling Factor: 2048 (Derived from Trace: 2.5 * 2048 = 5120)
        const presetIndex = parseInt(String(this.envConfig.fogPreset).split(" ")[0]);
        const range = env.getEnv().fog.ranges[presetIndex - 1]; // 0-based array

        // Default or Fallback
        let targetFogStart = 2000;
        let targetFogEnd = 8000;

        if (range) {
            targetFogStart = range.x * 2048;
            targetFogEnd = range.y * 2048;
        } else {
            // Fallback to Preset 1 if invalid
            const defRange = env.getEnv().fog.ranges[0];
            if (defRange) {
                targetFogStart = defRange.x * 2048;
                targetFogEnd = defRange.y * 2048;
            }
        }

        let targetFogColor = env.getHazeColor(tmpColorByte_2); // Default to Haze

        // targetFogStart = 1;
        // targetFogEnd = 10

        // 3. Zone Overrides
        const sector = this.getSector(this.camera.position);
        // Initialize with base haze gradient from EnvLight (via indexHaze)
        // L2FogInfo blending will modify these values if in range
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

            if (zone && zone.isFogZone && zone.fog) {
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
            const currentY = Math.floor(this.camera.position.z / sectorSize) + 18;

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

            // First pass: Find the closest active fog (closest wins logic)
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

            // Second pass: Use only the active fog if one was found, otherwise fallback to default
            // Note: The user requested "closest wins", so we only process the active one.
            fogInfos.forEach(fogInfo => {
                const isActive = fogInfo.uuid === this.activeFogId;
                if (!isActive) return;

                const weight = 1.0; // The closest one wins with full weight
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

                // 1. Fog Blending
                // Ranges in EnvInfo are KiloUnits (scaled by 2048), but FogInfo (Zones) are already Units
                accStart += range.A * weight;
                accEnd += range.B * weight;
                accR += fogColor.r * weight;
                accG += fogColor.g * weight;
                accB += fogColor.b * weight;
                totalFogWeight += weight;

                // 2. Sky Blending
                // Alpha 0 in assets usually means fallback to 255 (fully opaque)
                const skyAlpha = skyColor.a === 0 ? 255 : skyColor.a;
                const skyWeight = weight * (skyAlpha / 255);
                accSkyR += skyColor.r * skyWeight;
                accSkyG += skyColor.g * skyWeight;
                accSkyB += skyColor.b * skyWeight;
                totalSkyWeight += skyWeight;

                // 3. Haze Blending
                const hAlpha = hazeColor.a === 0 ? 255 : hazeColor.a;
                const hazeWeight = weight * (hAlpha / 255);
                accHazeR += hazeColor.r * hazeWeight;
                accHazeG += hazeColor.g * hazeWeight;
                accHazeB += hazeColor.b * hazeWeight;
                totalHazeWeight += hazeWeight;

                // 4. Cloud Blending (Calculated for all 3 indices)
                cloudColors.forEach((c, idx) => {
                    if (!c) return;
                    const cAlpha = c.a === 0 ? 255 : c.a;
                    const weightC = weight * (cAlpha / 255);
                    accCloudR[idx] += c.r * weightC;
                    accCloudG[idx] += c.g * weightC;
                    accCloudB[idx] += c.b * weightC;
                    totalCloudWeight[idx] += weightC;
                });

                // 5. Haze Array Blending
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

            // 5. Apply Haze Array Blending to the final gradient
            if (totalHArrWeight > 0) {
                // Aggressive override: If weight is high, prioritize regional color (reduces global bleed)
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
            dirRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(sidewaysVelocity);

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

        if (this.nextPhysicsTick <= currentTime) {
            // this.physicsWorld.step();
            // this.player.update(this, currentTime, deltaTime);

            // console.log(this.player.position);

            this.nextPhysicsTick = currentTime + 1000 / 30;
        }

        this.audioManager.update(currentTime);

        const desiredPosition = new Vector3().copy(this.player.getRigidbody().translation() as THREE.Vector3).add(new Vector3(0, -this.player.getColliderSize().y * 0.5 - this.player.getStepHeight(), 0));

        this.player.position.lerp(desiredPosition, 0.1);

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

        // Ambient sound spatial update (UE2: MAX_AUDIOCHANNELS=32, priority-sorted by distance)
        {
            const MAX_AMBIENT_CHANNELS = 24; // leave headroom for music/effects
            const camPos = this.camera.position;
            const timeOfDay = this.environment.getTimeOfDay(); // 0-24 hours
            const isDaytime = timeOfDay >= 6 && timeOfDay < 18;
            const candidates: { uuid: string, snd: GD.IAmbientSoundObjectDecodeInfo, distSq: number }[] = [];

            for (const [, sectorYMap] of this.sectors) {
                for (const [, sector] of sectorYMap) {
                    if (!sector.ambientSounds) continue;
                    for (const snd of sector.ambientSounds) {
                        // L2 AmbientSoundType: 0=Always, 1=Day, 2=Night, 3=Water
                        if (snd.soundType === 1 && !isDaytime) continue; // Day-only sound at night
                        if (snd.soundType === 2 && isDaytime) continue;  // Night-only sound during day

                        const dx = snd.position[0] - camPos.x;
                        const dy = snd.position[1] - camPos.y;
                        const dz = snd.position[2] - camPos.z;
                        const distSq = dx * dx + dy * dy + dz * dz;
                        if (distSq <= snd.maxDistance * snd.maxDistance) {
                            candidates.push({ uuid: snd.uuid, snd, distSq });
                        }
                    }
                }
            }

            // Sort by distance (closest = highest priority), take only top N
            candidates.sort((a, b) => a.distSq - b.distSq);
            const inRangeSounds = new Map<string, GD.IAmbientSoundObjectDecodeInfo>();
            for (let i = 0; i < Math.min(candidates.length, MAX_AMBIENT_CHANNELS); i++) {
                inRangeSounds.set(candidates[i].uuid, candidates[i].snd);
            }

            // Stop sounds no longer in range or below priority cutoff
            for (const id of this.audioManager.activeAmbientSoundIds) {
                if (!inRangeSounds.has(id)) {
                    this.audioManager.stopAmbientSound(id);
                }
            }

            // Start sounds newly in range
            for (const [id, snd] of inRangeSounds) {
                this.audioManager.playAmbientSound(
                    id,
                    snd.soundName,
                    snd.soundDataUri,
                    snd.position,
                    snd.volume,
                    snd.pitch,
                    snd.refDistance,
                    snd.maxDistance,
                    snd.randomDelay,
                    snd.looping,
                    currentTime
                );
            }

            // Update listener position from camera
            const fwd = this.camera.getWorldDirection(new Vector3());
            const up = new Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
            this.audioManager.updateListenerPosition(
                camPos.x, camPos.y, camPos.z,
                fwd.x, fwd.y, fwd.z,
                up.x, up.y, up.z,
            );
        }

        this.renderer.clear();
    }

    protected _doRender(_currentTime: number, _deltaTime: number) {
        // // Redirect to Main Target for Bloom
        // i think bloom pass is only enabled when shader rendering used which is off by default
        // this.renderer.setRenderTarget(this.mainRenderTarget);

        // Render Sky (Background)
        this.renderer.clear();
        this.skyRenderer.render(this.renderer);
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

                // Create new visualizer
                (this as any).visualizer = new Visualizer(this.scene);

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

                if (this.visualizer.getMode() === VisualizerMode.Portals) { // Portals
                    this.visualizer.updatePortals(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Zones) { // Zones
                    this.visualizer.updateZones(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === VisualizerMode.Leaves) { // Leaves
                    this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
                } else if (this.visualizer.getMode() === VisualizerMode.Fogs) { // Fogs
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
            }
        }

        this.renderer.autoClear = false;

        // Render World
        this.renderer.render(this.scene, this.camera);

        // // Apply Native Bloom (Sun/Glow) -> Screen
        // this.uGlowPass.render(this.renderer, null, this.mainRenderTarget);

        // this.renderer.setRenderTarget(null);
    }

    protected _postRender(_currentTime: number, _deltaTime: number) { }

    public startRendering() {
        this.physicsWorld.step();
        this.nextPhysicsTick = 3000;
        this.scene.updateMatrixWorld(true);

        this.collectColliders();
        this.stitchTerrains();

        this.onHandleRender(0);
    }

    protected readonly collidables: ICollidable[] = [];
    public readonly colliderMap = new WeakMap<RAPIER.Collider, ICollidable>()

    protected collectColliders() {
        this.scene.traverse((obj: ICollidable) => {
            if (!obj.isCollidable) return;

            // if (this.collidables.length > 1) return;

            this.collidables.push(obj);
            this.colliderMap.set(obj.createCollider(this.physicsWorld), obj);
        });

        // debugger;

        // this.collidables.push(this.player.createCollider(this.physicsWorld));
    }

    public setSky(sector: SectorObject) {
        this.skyRenderer.initSkyLevel(this.environment.getEnv(), sector);

        // Add GUI specific for Moons
        if (this.skyRenderer.moons.length > 0) {
            const moonFolder = guiFolders.world.addFolder("Moons");

            if (this.skyRenderer.moons.length > 1) {
                const moonConfig = { activeMoon: 0 };
                const moonIndices: Record<string, number> = {};
                this.skyRenderer.moons.forEach((m, i) => {
                    const name = m.data.objectName || `Moon ${i + 1}`;
                    moonIndices[name] = i;
                });

                moonFolder.add(moonConfig, "activeMoon", moonIndices)
                    .name("Active Moon")
                    .onChange((value) => {
                        this.skyRenderer.setActiveMoon(parseInt(value as string));
                    });
            }

            moonFolder.close();
        }

    }



    public addSector(sector: SectorObject) {
        if (sector.index) {
            if (!this.sectors.has(sector.index.x))
                this.sectors.set(sector.index.x, new Map());

            this.sectors.get(sector.index.x).set(sector.index.y, sector);
        }

        const sectorBounds = new Box3().setFromObject(sector);
        sector.worldBounds.copy(sectorBounds);
        this.sectorBounds.push(sectorBounds);

        this.objectGroup.add(sector);
        this.stitchTerrains();

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

            if (this.visualizer.getMode() === 1) { // Portals
                this.visualizer.updatePortals(currentSectorMap, cameraPos);
            } else if (this.visualizer.getMode() === 2) { // Zones
                this.visualizer.updateZones(currentSectorMap, cameraPos);
            } else if (this.visualizer.getMode() === 3) { // Leaves
                this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
            }
        }
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
            } else if ((child as any).userData?.isTerrainBatch) {
                const batchSectors = (child as any).userData.sectors as Terrain[];
                if (batchSectors) {
                    batchSectors.forEach(s => terrains.push(s));
                }
            }
        });

        if (terrains.length < 2) return;

        (window as any).terrainDebug = Terrain.stitchAll(terrains);
    }
}

export default RenderManager;
export { RenderManager }

function addResizeListeners(manager: RenderManager) {
    global.addEventListener("resize", (manager as any).onHandleResize.bind(manager));
    (manager as any).onHandleResize();
}