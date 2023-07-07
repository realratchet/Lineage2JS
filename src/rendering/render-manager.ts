import { WebGLRenderer, PerspectiveCamera, Vector2, Scene, Mesh, BoxBufferGeometry, Raycaster, Vector3, Frustum, Matrix4, FogExp2, Object3D, Box3, SphereBufferGeometry, MeshBasicMaterial, Camera, Color, Sprite, SpriteMaterial, AdditiveBlending, MultiplyBlending, SubtractiveBlending, PlaneBufferGeometry, AnimationMixer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import GLOBAL_UNIFORMS from "@client/materials/global-uniforms";
import Player from "@client/player";
import timeOfDay from "@client/assets/unreal/un-time-of-day-helper";
import RAPIER from "@dimforge/rapier3d";
import type { ICollidable } from "@client/objects/objects";
import Stats from "./stats";

const stats = new (Stats as any)(0);

stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
// document.body.appendChild(stats.dom);

const tmpBox = new Box3();
const dirForward = new Vector3(), dirRight = new Vector3(), cameraVelocity = new Vector3();

const DEFAULT_FAR = 100_000;
const DEFAULT_CLEAR_COLOR = 0x0c0c0c;

type ZoneObject = import("../objects/zone-object").ZoneObject;
type SectorObject = import("../objects/zone-object").SectorObject;

class RenderManager {
    public readonly renderer: THREE.WebGLRenderer;
    public readonly viewport: HTMLViewportElement;
    public getDomElement() { return this.renderer.domElement; }
    public readonly camera = new PerspectiveCamera(75, 1, 0.1, DEFAULT_FAR);
    public readonly scene = new Scene();
    public readonly objectGroup = new Object3D();
    public readonly lastSize = new Vector2();
    public readonly controls: { orbit: OrbitControls, fps: PointerLockControls } = { orbit: null, fps: null };
    public needsUpdate: boolean = true;
    public isPersistentRendering: boolean = true;
    public readonly raycaster = new Raycaster();
    public speedCameraFPS = 5;
    public readonly mixer = new AnimationMixer(this.scene);

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

    constructor(viewport: HTMLViewportElement) {
        this.viewport = viewport;
        this.renderer = new WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
            premultipliedAlpha: false,
            logarithmicDepthBuffer: true,
            alpha: true,
        });

        this.renderer.autoClear = false;

        this.renderer.setClearColor(DEFAULT_CLEAR_COLOR);
        this.controls.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.fps = new PointerLockControls(this.camera, this.renderer.domElement);
        this.camera.position.set(0, 5, 15);
        this.camera.lookAt(0, 0, 0);
        this.scene.add(new Mesh(new BoxBufferGeometry()));

        this.objectGroup.name = "SectorGroup"
        this.scene.add(this.objectGroup);

        this.sun = new Mesh(new PlaneBufferGeometry(), new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending }));
        this.sunCam = new Camera();

        this.physicsWorld = new RAPIER.World(new Vector3(0, -9.8 * 100, 0));

        // this.scene.add(this.sun);

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
        // this.camera.position.set(-113423.1583509125, -3347.4875149571467, 235975.71810164873);
        // this.controls.orbit.target.set(-113585.15625, -3498.14697265625, 235815.328125);

        // // // tower ceiling fixture (too red)
        // this.camera.position.set(17589.39507123414, -5841.085927319365, 116621.38351101281);
        // this.controls.orbit.target.set(17611.91280729978, -5819.704399240179, 116526.32678153258);

        // tower outside
        this.camera.position.set(14620.304790735074, -3252.6686447271395, 113939.32109701027);
        this.controls.orbit.target.set(19313.26359342052, -1077.117687144737, 114494.24459571407);

        // // execution grounds necropolis
        // this.camera.position.set(39685.67263674792, -2453.9874334636006, 145466.98825143554);
        // this.controls.orbit.target.set(39689.71781138217, -2528.306592105407, 145400.2027798047);

        // // cruma top
        // this.camera.position.set(17493.974642555284, 20660.858986037056, 112602.20721151105);
        // this.controls.orbit.target.set(17494.774633985846, 20560.86218601999, 112602.20697106984);

        // // talking island
        this.camera.position.set(-81557.82679558189, -2819.5704971954897, 242774.90441893184);
        this.controls.orbit.target.set(-81647.1623503648, -2864.2521455152955, 242770.13902754657);

        // // world origin
        // this.camera.position.set(20, 20, 20);
        // this.controls.orbit.target.set(0, 0, 0);

        // look player
        this.camera.position.set(-87021.22448304677, -3660.4757138727023, 240008.2840185369);
        this.controls.orbit.target.set(-87086.51708877791, -3685.930229617832, 239936.94718888338);

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
        this.player.position.set(-87063.33997244012, -3637.2213744465607, 239964.66910649382);   // outside village
        // this.player.position.set(-84272.02537263982, -3730.723876953125, 245391.89904573155);    // near church
        // this.player.position.set(-85824.17160558623, -2420.568413807578+100, 247100.09013224754); // on the hill

        addResizeListeners(this);
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
        } catch (e) { }
    }

    public setSize(width: number, height: number, updateStyle?: boolean) {
        this.pixelRatio = global.devicePixelRatio;

        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(width, height, updateStyle);

        this.lastSize.set(width, height);
    }

    protected async onHandleResize(): Promise<void> {
        const oldStyle = this.getDomElement().style.display;
        this.getDomElement().style.display = "none";
        const { width, height } = this.viewport.getBoundingClientRect();

        this.camera.aspect = width / height;
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

        this.scene.traverse((object: THREE.Object3D) => {

            if ((object as ZoneObject).isZoneObject) {

                // const inBounds = (object as ZoneObject).boundsRender.containsPoint(this.camera.position);

                // if (inBounds) fog = (object as ZoneObject).fog;

                // // if (!(object as ZoneObject).update(this.enableZoneCulling, this.frustum)) return;

                (object as THREE.Object3D).traverseVisible(object => {
                    if ((object as any).isUpdatable)
                        (object as any).update(currentTime);

                    if ((object as THREE.Mesh).isMesh)
                        (((((object as THREE.Mesh).material as THREE.Material).isMaterial)
                            ? [(object as THREE.Mesh).material]
                            : (object as THREE.Mesh).material) as THREE.Material[])
                            .forEach(mat => {
                                if (mat && (mat as any).isUpdatable)
                                    (mat as any).update(currentTime);
                            });
                });
            }
        });

        let fog: THREE.Fog;

        const sector = this.getSector(this.camera.position);

        if (sector) {
            const zoneIndex = sector.findPositionZone(this.camera.position);
            const zone = sector.zones.children[zoneIndex] as ZoneObject;
            fog = zone?.fog ?? null;
        }

        GLOBAL_UNIFORMS.globalTime.value = globalTime;

        const oldFar = this.camera.far;

        if (fog) {
            GLOBAL_UNIFORMS.fogColor.value.copy(fog.color);
            GLOBAL_UNIFORMS.fogNear.value = fog.near;
            GLOBAL_UNIFORMS.fogFar.value = fog.far;

            this.renderer.setClearColor(fog.color);
            this.camera.far = fog.far * 1.2;
        } else {
            GLOBAL_UNIFORMS.fogColor.value.setHex(DEFAULT_CLEAR_COLOR);
            GLOBAL_UNIFORMS.fogNear.value = DEFAULT_FAR * 10;
            GLOBAL_UNIFORMS.fogFar.value = DEFAULT_FAR * 10 + 1;

            this.renderer.setClearColor(DEFAULT_CLEAR_COLOR);
            this.camera.far = DEFAULT_FAR;
        }

        if (this.camera.far !== oldFar) this.camera.updateProjectionMatrix();

        // this.scene.fog = new FogExp2(0xff00ff, 0.1);
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

            if (this.dirKeys.shift)
                console.log("Camspeed:", camSpeed, Date.now() - this.shiftTimeDown)

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
        this._updateSun();

        this.renderer.clear();
    }

    protected _updateSun() {
        const sector = this.getSector(this.camera.position);

        if (sector) {
            const sunMaterial = sector.sunTexture;
            (this.sun.material as THREE.MeshBasicMaterial).map = sunMaterial.texture;
        }

        // debugger;

        const radius = 3000;
        const multiplier = (2 * Math.PI) / 24;
        const px = (radius * Math.cos(Math.PI + multiplier * 9));
        const py = (radius * Math.sin(Math.PI + multiplier * 9));

        this.sun.position.copy(this.camera.position);
        this.sun.position.z += py;
        this.sun.position.y += px;

        // this.sun.material.color.setRGB(255 / 255, 219 / 255, 151 / 255);
        this.sun.scale.set(10000 * 0.5, 10000 * 0.5, 10000 * 0.5);
        this.sun.lookAt(this.camera.position);

        // this.renderer.setClearColor(new Color(66 / 255, 124 / 255, 176 / 255));

        this.sun.updateMatrixWorld(true);
    }

    protected _doRender(currentTime: number, deltaTime: number) {
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
    }
}

export default RenderManager;
export { RenderManager }

function addResizeListeners(manager: RenderManager) {
    global.addEventListener("resize", (manager as any).onHandleResize.bind(manager));
    (manager as any).onHandleResize();
}