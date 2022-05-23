import { WebGLRenderer, PerspectiveCamera, Vector2, Scene, Mesh, BoxBufferGeometry, Intersection, Raycaster, Box3, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class RenderManager {
    public readonly renderer: WebGLRenderer;
    public readonly viewport: HTMLViewportElement;
    public getDomElement() { return this.renderer.domElement; }
    public readonly camera = new PerspectiveCamera(75, 1, 0.1, 100000);
    public readonly scene = new Scene();
    public readonly lastSize: Vector2 = new Vector2();
    public readonly controls: OrbitControls;
    public needsUpdate: boolean = true;
    public isPersistentRendering: boolean = true;
    public readonly raycaster = new Raycaster();

    protected lastRender: number = 0;
    protected pixelRatio: number = global.devicePixelRatio;

    constructor(viewport: HTMLViewportElement) {
        this.viewport = viewport;
        this.renderer = new WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
            // premultipliedAlpha: false,
            alpha: true
        });

        viewport.addEventListener("mouseup", this.onHandleMouseUp.bind(this));
        window.addEventListener("keydown", this.onHandleKeyDown.bind(this));

        this.renderer.setClearColor(0x000000);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.camera.position.set(0, 5, 15);
        this.camera.lookAt(0, 0, 0);
        this.scene.add(new Mesh(new BoxBufferGeometry()));


        // lightmapped water
        // this.camera.position.set(2187.089541437192, -1232.1649850535432, 110751.03244741965);
        // this.controls.target.set(2183.2765321590364, -3123.9848865795666, 111582.45872830588);

        // tower planes
        this.camera.position.set(16317.62354947573, -11492.261077168214, 114151.68197851974);
        this.controls.target.set(17908.226612501945, -11639.21923814191, 114223.45684942426);

        // blinking roof
        // this.camera.position.set(20532.18926265955, -11863.06999059111, 117553.43156512016);
        // this.controls.target.set(20532.191127608294, -9998.087698878093, 117553.4315763069);

        // rotating crystal
        // this.camera.position.set(12503.665976183796, -1081.0665384462375, 116917.6052756099);
        // this.controls.target.set(11939.418010659865, -1153.9097602263002, 116384.32683375604);

        this.camera.position.set(10484.144790506707, -597.9622026194365, 114224.52489243896);
        this.controls.target.set(17301.599545134217, -3594.4818114739037, 114022.41226029034);
        this.controls.update();

        viewport.appendChild(this.renderer.domElement);

        addResizeListeners(this);

        global.getSceneSize = () => {
            return new Box3().setFromObject(this.scene.children[1]).getSize(new Vector3());
        }
    }

    public toScreenSpaceCoords(point: Vector2) {
        const { width, height } = this.renderer.getSize(new Vector2());

        return new Vector2(
            point.x / width * 2 - 1,
            1 - point.y / height * 2
        );
    }

    public onHandleKeyDown(event: KeyboardEvent) {
        switch (event.key) {
            case "1":
                this.camera.position.set(14620.304790735074, -3252.6686447271395, 113939.32109701027);
                this.controls.target.set(19313.26359342052, -1077.117687144737, 114494.24459571407);
                this.controls.update();
                break;
            case "2":
                this.camera.position.set(17635.20575146492, -11784.939422516854, 116150.5713219522);
                this.controls.target.set(18067.654677822546, -10987.479065394222, 113781.22799780089);
                this.controls.update();
                break;
            case "3":
                this.camera.position.set(15072.881710902564, -11862.167696361777, 110387.91067628124);
                this.controls.target.set(14711.102749053878, -11434.303788147914, 110872.50292405237);
                this.controls.update();
                break;
            case "4":
                this.camera.position.set(12918.803737500606, -11769.26992456535, 109998.28664096774);
                this.controls.target.set(12961.940094338941, -11789.664021556502, 110631.6332572824);
                this.controls.update();
                break;
            case "5":
                this.camera.position.set(23756.20212599347, -8869.681711370744, 116491.99214326135);
                this.controls.target.set(23706.65317650355, -9178.136467533635, 118330.62193563695);
                this.controls.update();
                break;
            case "6":
                this.camera.position.set(17436.46445202629, -6351.127037466889, 109469.23150265992);
                this.controls.target.set(18965.828211115713, -6064.126549127763, 106770.89206042158);
                this.controls.update();
                break;
        }
    }

    public onHandleMouseUp(event: MouseEvent) {
        try {
            // debugger;

            const position = new Vector2(event.pageX, event.pageY);
            const ssPosition = this.toScreenSpaceCoords(position);
            const intersections: Intersection[] = [];

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
        const deltaTime = currentTime - this.lastRender

        const isFrameDirty = this.isPersistentRendering || this.needsUpdate;

        if (isFrameDirty) {
            this._preRender(currentTime, deltaTime);
            this._doRender(currentTime, deltaTime);
            this._postRender(currentTime, deltaTime);
            this.needsUpdate = false;
        }

        requestAnimationFrame(this.onHandleRender.bind(this));
    }

    protected _preRender(currentTime: number, deltaTime: number) {
        this.renderer.clear();
        this.scene.traverse((object: any) => {

            if (object.material) {
                const materials = object.material instanceof Array ? object.material : [object.material];

                materials.forEach((material: any) => {
                    if (material?.uniforms?.globalTime) {
                        material.uniforms.globalTime.value = currentTime / 600;
                    }
                });

            }
        });
    }

    protected _doRender(currentTime: number, deltaTime: number) {
        this.renderer.render(this.scene, this.camera);
    }

    protected _postRender(currentTime: number, deltaTime: number) {

    }

    public startRendering() { this.onHandleRender(0); }
}

export default RenderManager;
export { RenderManager }

function addResizeListeners(manager: RenderManager) {
    global.addEventListener("resize", (manager as any).onHandleResize.bind(manager));
    (manager as any).onHandleResize();
}