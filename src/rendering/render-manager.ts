import { WebGLRenderer, PerspectiveCamera, Vector2 } from "three";

class RenderManager {
    public readonly renderer: WebGLRenderer;
    public readonly viewport: HTMLViewportElement;
    public getDomElement() { return this.renderer.domElement; }
    public readonly camera = new PerspectiveCamera(75);
    public readonly lastSize: Vector2 = new Vector2();
    public needsUpdate: boolean = true;
    public isPersistentRendering: boolean = true;

    protected lastRender: number = 0;
    protected pixelRatio: number = global.devicePixelRatio;

    constructor(viewport: HTMLViewportElement) {
        this.viewport = viewport;
        this.renderer = new WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
            alpha: true
        });

        viewport.appendChild(this.renderer.domElement);

        addResizeListeners(this);
    }

    public setSize(width: number, height: number, updateStyle?: boolean) {
        this.pixelRatio = global.devicePixelRatio;

        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(width, height, updateStyle);

        this.lastSize.set(width, height);
    }

    public async onHandleResize(): Promise<void> {
        const oldStyle = this.getDomElement().style.display;
        this.getDomElement().style.display = "none";
        const { width, height } = this.viewport.getBoundingClientRect();

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.setSize(width, height);
        this.getDomElement().style.display = oldStyle;
        this.needsUpdate = true;
    }

    public async onHandleRender(currentTime: number): Promise<void> {
        const deltaTime = currentTime - this.lastRender

        const isFrameDirty = this.isPersistentRendering || this.needsUpdate;

        if (isFrameDirty) {
            this._preRender(currentTime, deltaTime);
            this._doRender(currentTime, deltaTime);
            this._postRender(currentTime, deltaTime);
            this.needsUpdate = false;
        }
    }

    protected _preRender(currentTime: number, deltaTime: number) {

    }

    protected _doRender(currentTime: number, deltaTime: number) {

    }

    protected _postRender(currentTime: number, deltaTime: number) {

    }
}

export default RenderManager;
export { RenderManager }

function addResizeListeners(manager: RenderManager) {
    global.addEventListener("resize", manager.onHandleResize.bind(manager));
    manager.onHandleResize();
}