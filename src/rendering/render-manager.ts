import ZoneObject from "../zone-object";
import { WebGLRenderer, PerspectiveCamera, Vector2, Scene, Mesh, BoxBufferGeometry, Raycaster, Vector3, Frustum, Matrix4, FogExp2 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import GLOBAL_UNIFORMS from "@client/materials/global-uniforms";

const dirForward = new Vector3(), dirRight = new Vector3(), cameraVelocity = new Vector3();
const DEFAULT_FAR = 100_000;
const DEFAULT_CLEAR_COLOR = 0x0c0c0c;

class RenderManager {
    public readonly renderer: WebGLRenderer;
    public readonly viewport: HTMLViewportElement;
    public getDomElement() { return this.renderer.domElement; }
    public readonly camera = new PerspectiveCamera(75, 1, 0.1, DEFAULT_FAR);
    public readonly scene = new Scene();
    public readonly lastSize: Vector2 = new Vector2();
    public readonly controls: { orbit: OrbitControls, fps: PointerLockControls } = {} as any;
    public needsUpdate: boolean = true;
    public isPersistentRendering: boolean = true;
    public readonly raycaster = new Raycaster();
    public speedCameraFPS = 50;

    protected readonly dirKeys = { left: false, right: false, up: false, down: false, shift: false };
    protected isOrbitControls = true;
    protected lastRender: number = 0;
    protected pixelRatio: number = global.devicePixelRatio;
    protected readonly frustum = new Frustum();
    protected readonly lastProjectionScreenMatrix = new Matrix4();

    constructor(viewport: HTMLViewportElement) {
        this.viewport = viewport;
        this.renderer = new WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
            premultipliedAlpha: false,
            logarithmicDepthBuffer: true,
            alpha: true
        });

        this.renderer.setClearColor(DEFAULT_CLEAR_COLOR);
        this.controls.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.fps = new PointerLockControls(this.camera, this.renderer.domElement);
        this.camera.position.set(0, 5, 15);
        this.camera.lookAt(0, 0, 0);
        this.scene.add(new Mesh(new BoxBufferGeometry()));

        // lightmapped water
        // this.camera.position.set(2187.089541437192, -1232.1649850535432, 110751.03244741965);
        // this.controls.target.set(2183.2765321590364, -3123.9848865795666, 111582.45872830588);


        // // tower planes
        // this.camera.position.set(16317.62354947573, -11492.261077168214, 114151.68197851974);
        // this.camera.lookAt(17908.226612501945, -11639.21923814191, 114223.45684942426)
        // this.controls.orbit.target.set(17908.226612501945, -11639.21923814191, 114223.45684942426);
        // // this.controls.fps.lookAt(17908.226612501945, -11639.21923814191, 114223.45684942426);

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
        // this.camera.lookAt(-113585.15625, -3498.14697265625, 235815.328125);
        // this.controls.orbit.target.set(-113585.15625, -3498.14697265625, 235815.328125);

        // // // tower ceiling fixture
        // this.camera.position.set(17589.39507123414, -5841.085927319365, 116621.38351101281);
        // this.camera.lookAt(17611.91280729978, -5819.704399240179, 116526.32678153258);
        // this.controls.orbit.target.set(17611.91280729978, -5819.704399240179, 116526.32678153258);

        // tower outside
        this.camera.position.set(14620.304790735074, -3252.6686447271395, 113939.32109701027);
        this.camera.lookAt(19313.26359342052, -1077.117687144737, 114494.24459571407);
        this.controls.orbit.target.set(19313.26359342052, -1077.117687144737, 114494.24459571407);

        // // execution grounds necropolis
        // this.camera.position.set(39685.67263674792, -2453.9874334636006, 145466.98825143554);
        // this.camera.lookAt(39689.71781138217, -2528.306592105407, 145400.2027798047);
        // this.controls.orbit.target.set(39689.71781138217, -2528.306592105407, 145400.2027798047);

        // // cruma top
        // this.camera.position.set(17493.974642555284, 20660.858986037056, 112602.20721151105);
        // this.camera.lookAt(17494.774633985846, 20560.86218601999, 112602.20697106984);
        // this.controls.orbit.target.set(17494.774633985846, 20560.86218601999, 112602.20697106984);

        this.controls.orbit.update();
        // this.controls.fps.update(0);


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
            case "w": if (!this.isOrbitControls) this.dirKeys.up = true; break;
            case "a": if (!this.isOrbitControls) this.dirKeys.left = true; break;
            case "d": if (!this.isOrbitControls) this.dirKeys.right = true; break;
            case "s": if (!this.isOrbitControls) this.dirKeys.down = true; break;
            case "shift": if (!this.isOrbitControls) this.dirKeys.shift = true; break;
        }
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
        try {
            const position = new Vector2(event.pageX, event.pageY);
            const ssPosition = this.toScreenSpaceCoords(position);
            const intersections: THREE.Intersection[] = [];

            this.raycaster.setFromCamera(ssPosition, this.camera);
            this.raycaster.intersectObject(this.scene, true, intersections);

            if (intersections.length === 0) return;

            const intersection = intersections[0];

            console.log(intersection.object);
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
            this._preRender(currentTime, deltaTime);
            this._doRender(currentTime, deltaTime);
            this._postRender(currentTime, deltaTime);
            this.needsUpdate = false;
        }

        this.lastRender = currentTime;

        requestAnimationFrame(this.onHandleRender.bind(this));
    }

    public enableZoneCulling = true;

    protected _updateObjects(currentTime: number, deltaTime: number) {
        let fog: THREE.Fog;

        const globalTime = currentTime / 600;

        this.scene.traverse((object: THREE.Object3D) => {

            if ((object as ZoneObject).isZoneObject) {

                const inBounds = (object as ZoneObject).boundsRender.containsPoint(this.camera.position);

                if (inBounds) fog = (object as ZoneObject).fog;

                if (!(object as ZoneObject).update(this.enableZoneCulling, this.frustum)) return;

                (object as THREE.Object3D).traverseVisible(object => {
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

    protected _preRender(currentTime: number, deltaTime: number) {
        this.lastProjectionScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.lastProjectionScreenMatrix);

        if (!this.isOrbitControls) {
            let forwardVelocity = 0, sidewaysVelocity = 0;
            const camSpeed = this.speedCameraFPS * (this.dirKeys.shift ? 2 : 1);

            if (this.dirKeys.left) sidewaysVelocity -= 1;
            if (this.dirKeys.right) sidewaysVelocity += 1;

            if (this.dirKeys.up) forwardVelocity += 1;
            if (this.dirKeys.down) forwardVelocity -= 1;

            dirForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion).multiplyScalar(forwardVelocity);
            dirRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(sidewaysVelocity);

            cameraVelocity.addVectors(dirForward, dirRight).setLength(camSpeed);

            this.camera.position.add(cameraVelocity);
        }

        this.renderer.clear();
        this._updateObjects(currentTime, deltaTime);
    }

    protected _doRender(currentTime: number, deltaTime: number) {
        this.renderer.render(this.scene, this.camera);
    }

    protected _postRender(currentTime: number, deltaTime: number) { }

    public startRendering() { this.onHandleRender(0); }
}

export default RenderManager;
export { RenderManager }

function addResizeListeners(manager: RenderManager) {
    global.addEventListener("resize", (manager as any).onHandleResize.bind(manager));
    (manager as any).onHandleResize();
}