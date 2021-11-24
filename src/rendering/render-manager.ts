import { WebGLRenderer, PerspectiveCamera, Vector2, Scene, Mesh, BoxBufferGeometry, Intersection, Raycaster } from "three";
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

        this.renderer.setClearColor(0x000000);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.camera.position.set(0, 5, 15);
        this.camera.lookAt(0, 0, 0);
        this.scene.add(new Mesh(new BoxBufferGeometry()));

        this.camera.position.set(16317.62354947573, -11492.261077168214, 114151.68197851974);
        this.controls.target.set(17908.226612501945, -11639.21923814191, 114223.45684942426);
        // this.camera.position.set(10484.144790506707, -597.9622026194365, 114224.52489243896);
        // this.controls.target.set(17301.599545134217, -3594.4818114739037, 114022.41226029034);
        this.controls.update();

        viewport.appendChild(this.renderer.domElement);

        addResizeListeners(this);
    }

    public toScreenSpaceCoords(point: Vector2) {
        const { width, height } = this.renderer.getSize(new Vector2());

        return new Vector2(
            point.x / width * 2 - 1,
            1 - point.y / height * 2
        );
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