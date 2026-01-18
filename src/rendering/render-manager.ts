import { WebGLRenderer, PerspectiveCamera, Vector2, Scene, Mesh, BoxGeometry, Raycaster, Vector3, Frustum, Matrix4, FogExp2, Object3D, Box3, SphereGeometry, MeshBasicMaterial, Camera, Color, Sprite, SpriteMaterial, AdditiveBlending, MultiplyBlending, SubtractiveBlending, PlaneGeometry, AnimationMixer, CameraHelper, Fog, MathUtils } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import GLOBAL_UNIFORMS from "@client/materials/global-uniforms";
import Player from "@client/player";
import RAPIER from "@dimforge/rapier3d";
import type { ICollidable } from "@client/objects/objects";
import Stats from "./stats";
import Visualizer, { VisualizerMode } from "./visualizer";
import EnvColor from "@client/rendering/env-color";
import L2Environment, { FogBlendState, interpolateFogInfoColor, interpolateFogInfoSkyColor } from "@client/rendering/l2-env";
import SkyRenderer from "./sky-renderer";
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
import { ColorByte } from "@client/utils/color-byte";
const tmpColorByte = new ColorByte();
const tmpColorByte_2 = new ColorByte();
const tmpColorByte_3 = new ColorByte(); // For sky color blending

const DEFAULT_FAR = 100_000;
const DEFAULT_CLEAR_COLOR = 0x0c0c0c;
const DEFAULT_HORIZONTAL_FOV = 60;

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

    public bspHelperCamera: PerspectiveCamera | null = null;
    public bspHelperCameraHelper: CameraHelper | null = null;
    public bspHelperActive: boolean = false;
    public frustumCullingEnabled: boolean = true;
    public readonly visualizer: Visualizer;

    protected environment: L2Environment;

    protected shiftTimeDown: number;
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


    public envConfig = {
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

        guiFolders.world.add(this.envConfig, "fogPreset", {
            "1 (2k-8k)": "1",
            "2 (3k-10k)": "2",
            "3 (4k-12k)": "3",
            "4 (5k-14k)": "4",
            "5 (8k-20k)": "5"
        });

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

        // // // tower ceiling fixture (too red)
        // this.camera.position.set(17589.39507123414, -5841.085927319365, 116621.38351101281);
        // this.controls.orbit.target.set(17611.91280729978, -5819.704399240179, 116526.32678153258);

        // // tower outside
        this.camera.position.set(14620.304790735074, -3252.6686447271395, 113939.32109701027);
        this.controls.orbit.target.set(19313.26359342052, -1077.117687144737, 114494.24459571407);

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
        this.camera.position.set(-82762.45963652806, -3191.734390136169, 243599.79809435847);
        this.controls.orbit.target.set(-82695.39500085678, -3262.698174694781, 243530.66588287643);

        // // world origin
        // this.camera.position.set(20, 20, 20);
        // this.controls.orbit.target.set(0, 0, 0);

        // // look player
        // this.camera.position.set(-87021.22448304677, -3660.4757138727023, 240008.2840185369);
        // this.controls.orbit.target.set(-87086.51708877791, -3685.930229617832, 239936.94718888338);

        // // ti church
        // this.camera.position.set(-85586.61119566132, -2490.4046838818504, 243228.59559104982);
        // this.controls.orbit.target.set(-85561.73216987512, -2537.9950047641682, 243312.95313626213);

        // should see moon
        // this.camera.position.set(18126.590453715344, -3521.039633507794, 115584.07279848716);
        // this.controls.orbit.target.set(18218.654368394516, -3487.7660069524377, 115563.64973824144);

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

    public setEnvColors(envColors: { [key in 0 | 1 | 2]: EnvColor }): this {
        const environment = this.environment = new L2Environment(envColors);
        const self = this;

        const timeState = {
            get time() { return environment.getTimeOfDay(); },
            set time(v) {
                environment.setTimeOfDay(v);
                self.needsUpdate = true;
            }
        };

        guiFolders.world.add(timeState, "time", 0, 24, 0.01)
            .name("Time");

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

    private skyZone: any = null;

    public setSkyZone(skyZone: any) {
        this.skyZone = skyZone;
    }

    public debugPrintCamera() {
        console.log([
            `this.camera.position.set(${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z});`,
            `this.controls.orbit.target.set(${this.controls.orbit.target.x}, ${this.controls.orbit.target.y}, ${this.controls.orbit.target.z});`
        ].join("\n"));
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

                if (this.visualizer.getMode() === 1) { // Portals
                    this.visualizer.updatePortals(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === 2) { // Zones
                    this.visualizer.updateZones(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === 3) { // Leaves
                    this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
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

                if (this.visualizer.getMode() === 1) { // Portals
                    this.visualizer.updatePortals(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === 2) { // Zones
                    this.visualizer.updateZones(currentSectorMap, cameraPos);
                } else if (this.visualizer.getMode() === 3) { // Leaves
                    this.visualizer.updateLeaves(currentSectorMap, cameraPos, cameraFrustum, this.frustumCullingEnabled);
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
                this.camera.position.set(14620.304790735074, -3252.6686447271395, 113939.32109701027);
                this.controls.orbit.target.set(19313.26359342052, -1077.117687144737, 114494.24459571407);
                this.controls.orbit.update();
                break;
            case "2":
                this.camera.position.set(17635.20575146492, -11784.939422516854, 116150.5713219522);
                this.controls.orbit.target.set(18067.654677822546, -10987.479065394222, 113781.22799780089);
                this.controls.orbit.update();
                break;
            case "3":
                this.camera.position.set(15072.881710902564, -11862.167696361777, 110387.91067628124);
                this.controls.orbit.target.set(14711.102749053878, -11434.303788147914, 110872.50292405237);
                this.controls.orbit.update();
                break;
            case "4":
                this.camera.position.set(12918.803737500606, -11769.26992456535, 109998.28664096774);
                this.controls.orbit.target.set(12961.940094338941, -11789.664021556502, 110631.6332572824);
                this.controls.orbit.update();
                break;
            case "5":
                this.camera.position.set(23756.20212599347, -8869.681711370744, 116491.99214326135);
                this.controls.orbit.target.set(23706.65317650355, -9178.136467533635, 118330.62193563695);
                this.controls.orbit.update();
                break;
            case "6":
                this.camera.position.set(17436.46445202629, -6351.127037466889, 109469.23150265992);
                this.controls.orbit.target.set(18965.828211115713, -6064.126549127763, 106770.89206042158);
                this.controls.orbit.update();
                break;
            case "+":
                this.nextSector();
                break;
            case "-":
                this.prevSector();
                break;
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

    protected setSector(index: number) {
        const sector = this.sectorBounds[index];

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

    public getSector(position: THREE.Vector3) {
        const sectorSize = 256 * 128;
        const sectorX = Math.floor(position.x / sectorSize) + 20;
        const sectorY = Math.floor(position.z / sectorSize) + 18;

        if (!this.sectors.has(sectorX))
            return null;

        const xsect = this.sectors.get(sectorX);

        if (!xsect.has(sectorY))
            return null;

        return xsect.get(sectorY);
    }



    protected _updateObjects(currentTime: number, deltaTime: number) {
        const globalTime = currentTime / 600;
        const oldFar = this.camera.far;

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

        // Update frustum for BSP culling
        this.frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(bspCullingCamera.projectionMatrix, bspCullingCamera.matrixWorldInverse));

        this.scene.traverse((object: THREE.Object3D) => {

            if ((object as SectorObject).isSectorObject)
                (object as SectorObject).updateVisibility(this.environment, bspCullingPosition, this.frustum, this.frustumCullingEnabled);
            else if ((object as ZoneObject).isZoneObject) {

                // const inBounds = (object as ZoneObject).boundsRender.containsPoint(this.camera.position);

                // if (inBounds) fog = (object as ZoneObject).fog;

                // // if (!(object as ZoneObject).update(this.enableZoneCulling, this.frustum)) return;

                const parentZones = object.parent;
                const sector = (parentZones && parentZones.parent && (parentZones.parent as any).isSectorObject)
                    ? (parentZones.parent as SectorObject)
                    : null;

                (object as THREE.Object3D).traverseVisible(child => {
                    if ((child as any).isUpdatable) {
                        // LitActorMesh (and Terrain) need Sector + Env to update lighting
                        // We check for 'computeLighting' as a heuristic for these objects
                        if (sector && 'computeLighting' in child) {
                            (child as any).update(sector, this.environment);
                        } else {
                            (child as any).update(currentTime);
                        }
                    }

                    if ((child as THREE.Mesh).isMesh)
                        (((((child as THREE.Mesh).material as THREE.Material).isMaterial)
                            ? [(child as THREE.Mesh).material]
                            : (child as THREE.Mesh).material) as THREE.Material[])
                            .forEach(mat => {
                                if (mat && (mat as any).isUpdatable)
                                    (mat as any).update(currentTime);
                            });
                });
            }
        });

        if (this.camera.far !== oldFar) this.camera.updateProjectionMatrix();

        this._updateEnvironment();
    }

    protected _updateEnvironment() {
        const env = this.environment;
        if (!env) return;

        this.skyRenderer.update(this.camera, env, this.skyZone);

        // 1. Get Base Sky Color (from timeenv - will be blended with L2FogInfo later)
        const targetSkyColor = env.getSkyColor(tmpColorByte);

        // 2. Get Fog Settings
        // Default Fog Settings (from Env.int [FOG] StartRange1=1.0 (2000u), EndRange1=4.0 (8000u))
        let targetFogStart = 2000;
        let targetFogEnd = 8000;

        switch (String(this.envConfig.fogPreset)) {
            case "2": targetFogStart = 3000; targetFogEnd = 10000; break;
            case "3": targetFogStart = 4000; targetFogEnd = 12000; break;
            case "4": targetFogStart = 5000; targetFogEnd = 14000; break;
            case "5": targetFogStart = 8000; targetFogEnd = 20000; break;
            case "1": default: targetFogStart = 2000; targetFogEnd = 8000; break;
        }
        let targetFogColor = env.getHazeColor(tmpColorByte_2); // Default to Haze

        // targetFogStart = 1;
        // targetFogEnd = 10

        // 3. Zone Overrides
        const sector = this.getSector(this.camera.position);
        if (sector) {
            const zoneIndex = sector.findPositionZone(this.camera.position);
            const zone = sector.zones.children[zoneIndex] as ZoneObject;

            if (zone && zone.fog) {
                if (zone.isFogZone && zone.isSunAffected) {
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

            // Check for L2FogInfo overrides (Priority over Zone/Global)
            // Use 'some' to stop after finding the first active fog info (optimization)
            // REPLACED with Weighted Mixing logic
            let accStart = 0;
            let accEnd = 0;
            let accR = 0;
            let accG = 0;
            let accB = 0;
            // Sky color accumulators (for L2FogInfo skyColor blending)
            let accSkyR = 0;
            let accSkyG = 0;
            let accSkyB = 0;
            let totalWeight = 0;

            const presetIndex = this.envConfig.fogPreset;

            // Iterate over optimized fogInfos array directly
            const fogInfos = sector.fogInfos || [];
            fogInfos.forEach(fogInfo => {
                // if ((child as any).isFogInfo) {
                //    const fogInfo = child as FogInfoObject;

                // Zone Mask Check (Visibility Culling)
                // If fogInfo has a zoneMask, check if it intersects with the currently visible zone mask
                const visibleMask = sector.lastZoneMask;
                if (fogInfo.zoneMask && visibleMask && !(fogInfo.zoneMask & visibleMask)) {
                    return; // FogInfo is in a zone not currently visible/connected
                }

                const affectRange = fogInfo.affectRange;
                if (!affectRange) return;

                const inner = Math.min(affectRange.A, affectRange.B);
                const outer = Math.max(affectRange.A, affectRange.B);

                const dist = this.camera.position.distanceTo(fogInfo.position);

                if (dist > outer) return;

                // Calculate weight: 1.0 inside Inner, linear falloff to 0.0 at Outer
                let weight = 1.0;
                if (outer > inner) {
                    if (dist > inner) {
                        weight = 1.0 - ((dist - inner) / (outer - inner));
                    }
                } else {
                    // Inner >= Outer, strict cutoff (weight 1 or 0)
                    weight = 1.0;
                }

                if (weight <= 0) return;

                // Fetch params
                let range = fogInfo[`fogRange${presetIndex}` as keyof FogInfoObject] as { A: number, B: number };
                if (!range || (range.A === 0 && range.B === 0)) {
                    range = fogInfo.fogRange1;
                }
                if (!range) return;

                // Time-based color interpolation (matches UE2/L2 behavior)
                const timeOfDay = env.getTimeOfDay();
                const fogColor = interpolateFogInfoColor(timeOfDay, fogInfo.colors, tmpColorByte);
                const cR = fogColor.r, cG = fogColor.g, cB = fogColor.b;

                // Also get sky color from L2FogInfo
                const skyColor = interpolateFogInfoSkyColor(timeOfDay, fogInfo.colors, tmpColorByte_3);

                // Accumulate fog
                accStart += range.A * weight;
                accEnd += range.B * weight;
                accR += cR * weight;
                accG += cG * weight;
                accB += cB * weight;
                // Accumulate sky
                accSkyR += skyColor.r * weight;
                accSkyG += skyColor.g * weight;
                accSkyB += skyColor.b * weight;
                totalWeight += weight;
            });

            if (totalWeight > 0) {
                // If weight > 1, blend fog infos first
                const finalStart = accStart / totalWeight;
                const finalEnd = accEnd / totalWeight;
                const finalR = accR / totalWeight;
                const finalG = accG / totalWeight;
                const finalB = accB / totalWeight;

                // Blend with global/zone target
                const blendFactor = Math.min(totalWeight, 1.0);

                targetFogStart = MathUtils.lerp(targetFogStart, finalStart, blendFactor);
                targetFogEnd = MathUtils.lerp(targetFogEnd, finalEnd, blendFactor);

                targetFogColor.set(
                    MathUtils.lerp(targetFogColor.r, finalR, blendFactor),
                    MathUtils.lerp(targetFogColor.g, finalG, blendFactor),
                    MathUtils.lerp(targetFogColor.b, finalB, blendFactor)
                );

                // Blend sky color from L2FogInfo
                const finalSkyR = accSkyR / totalWeight;
                const finalSkyG = accSkyG / totalWeight;
                const finalSkyB = accSkyB / totalWeight;

                targetSkyColor.set(
                    MathUtils.lerp(targetSkyColor.r, finalSkyR, blendFactor),
                    MathUtils.lerp(targetSkyColor.g, finalSkyG, blendFactor),
                    MathUtils.lerp(targetSkyColor.b, finalSkyB, blendFactor)
                );
            }
        }

        // 4. Apply final sky color to scene background
        // this.scene.background = new Color().setRGB(targetSkyColor.r / 255, targetSkyColor.g / 255, targetSkyColor.b / 255);

        // 4. Update Header/Global State (Interpolate)
        // For now, snap to target values. TODO: Add interpolation for smooth transitions.
        const fogColorThree = new Color().setRGB(targetFogColor.r / 255, targetFogColor.g / 255, targetFogColor.b / 255);

        // Update Scene Fog
        if (!this.scene.fog || !(this.scene.fog as any).isFog) {
            this.scene.fog = new Fog(fogColorThree, targetFogStart, targetFogEnd);
        } else {
            const sceneFog = this.scene.fog as Fog;
            sceneFog.color.copy(fogColorThree);
            sceneFog.near = targetFogStart;
            sceneFog.far = targetFogEnd;
        }

        // Update Shader Uniforms
        GLOBAL_UNIFORMS.fogColor.value.copy(fogColorThree);
        if (GLOBAL_UNIFORMS.fogNear) GLOBAL_UNIFORMS.fogNear.value = targetFogStart;
        if (GLOBAL_UNIFORMS.fogFar) GLOBAL_UNIFORMS.fogFar.value = targetFogEnd;

        // Clear Color matches Fog for seamless horizon
        this.renderer.setClearColor(fogColorThree);
    }


    protected nextPhysicsTick: number;

    protected _preRender(currentTime: number, deltaTime: number) {
        this.mixer.update(deltaTime / 1000);

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

        const desiredPosition = new Vector3().copy(this.player.getRigidbody().translation() as THREE.Vector3).add(new Vector3(0, -this.player.getColliderSize().y * 0.5 - this.player.getStepHeight(), 0));

        this.player.position.lerp(desiredPosition, 0.1);

        this._updateObjects(currentTime, deltaTime);

        this.renderer.clear();
    }

    protected _doRender(currentTime: number, deltaTime: number) {
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
                this.scene.remove(this.visualizer.getGroup());

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
        if (this.visualizer.isEnabled() && currentSector) {
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

        // this.renderer.render(this.sun, this.camera);
        this.renderer.render(this.scene, this.camera);
    }

    protected _postRender(currentTime: number, deltaTime: number) { }

    public startRendering() {
        this.physicsWorld.step();
        this.nextPhysicsTick = 3000;
        this.scene.updateMatrixWorld(true);

        this.collectColliders();

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

    public addSector(sector: SectorObject) {
        if (sector.index) {
            if (!this.sectors.has(sector.index.x))
                this.sectors.set(sector.index.x, new Map());

            this.sectors.get(sector.index.x).set(sector.index.y, sector);
        }

        this.sectorBounds.push(new Box3().setFromObject(sector));

        this.objectGroup.add(sector);

        // Initialize sky renderer with celestials from sector (if any)
        if (sector.celestials && sector.celestials.length > 0) {
            this.skyRenderer.initFromSector(sector.celestials);
        }

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
}

export default RenderManager;
export { RenderManager }

function addResizeListeners(manager: RenderManager) {
    global.addEventListener("resize", (manager as any).onHandleResize.bind(manager));
    (manager as any).onHandleResize();
}