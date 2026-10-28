import { DepthFormat, DepthStencilFormat, DepthTexture, FloatType, Scene, UnsignedInt248Type, UnsignedIntType, UnsignedShortType, WebGLRenderer, Material, Object3D, Camera } from "three";
import Nameplate from "./nameplate";

export class NameplateDepth {
    protected readonly renderer: WebGLRenderer;
    protected readonly gl: WebGL2RenderingContext;
    protected readonly arrNameplates: Nameplate[] = [];
    protected framebuffer: WebGLFramebuffer = null;
    protected texture: DepthTexture = null;
    protected source: WebGLFramebuffer = undefined;
    protected width = 0;
    protected height = 0;
    protected active = false;
    protected copied = false;
    protected readonly contextRestored = () => {
        this.framebuffer = null;
        this.texture = null;
        this.source = undefined;
    };

    public constructor(renderer: WebGLRenderer) {
        this.renderer = renderer;
        this.gl = renderer.getContext();
        renderer.domElement.addEventListener("webglcontextrestored", this.contextRestored);
    }

    public begin(scene: Scene) {
        this.arrNameplates.length = 0;
        this.copied = false;
        for (const object of scene.children) {
            if ((object as any).isNameplate && object.visible && (object as Nameplate).material.visible) this.arrNameplates.push(object as Nameplate);
        }
        this.active = this.arrNameplates.length > 0;
    }

    public beforeRender(material: Material, object: Object3D) {
        if (!this.active) return;

        if ((object as any).isNameplate) (object as Nameplate).setOpaqueDepth(this.copied ? this.texture : null, this.width, this.height);
        else if (material.transparent && material.depthWrite && !this.copied) {
            this.capture();
            this.copied = true;
        }
    }

    protected capture() {
        const gl = this.gl, source = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        const target = this.renderer.getRenderTarget(), width = target ? target.width : gl.drawingBufferWidth, height = target ? target.height : gl.drawingBufferHeight;
        if (!source) throw new Error(`Nameplate depth requires an offscreen framebuffer`);
        try {
            if (this.source !== source || this.width !== width || this.height !== height) {
                const previous = gl.getParameter(gl.RENDERBUFFER_BINDING);
                let format: number = gl.DEPTH_COMPONENT24;
                try {
                    const type = gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE);
                    if (type !== gl.RENDERBUFFER) throw new Error(`Nameplate depth source must have a depth renderbuffer`);

                    gl.bindRenderbuffer(gl.RENDERBUFFER, gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME));
                    format = gl.getRenderbufferParameter(gl.RENDERBUFFER, gl.RENDERBUFFER_INTERNAL_FORMAT);
                } finally {
                    gl.bindRenderbuffer(gl.RENDERBUFFER, previous);
                }
                if (this.texture) this.texture.dispose();
                let type: number;
                switch (format) {
                    case gl.DEPTH_COMPONENT16: type = UnsignedShortType; break;
                    case gl.DEPTH_COMPONENT24: type = UnsignedIntType; break;
                    case gl.DEPTH_COMPONENT32F: type = FloatType; break;
                    case gl.DEPTH24_STENCIL8: type = UnsignedInt248Type; break;
                    case gl.DEPTH32F_STENCIL8: type = FloatType; break;
                    default: throw new Error(`Unsupported nameplate depth format '${format}'`);
                }
                this.texture = new DepthTexture(width, height, type);
                this.texture.format = format === gl.DEPTH24_STENCIL8 || format === gl.DEPTH32F_STENCIL8 ? DepthStencilFormat : DepthFormat;
                this.texture.needsUpdate = true;
                this.renderer.initTexture(this.texture);
                if (!this.framebuffer) this.framebuffer = gl.createFramebuffer();
                gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffer);
                gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.renderer.properties.get(this.texture).__webglTexture, 0);
                gl.drawBuffers([gl.NONE]);
                if (gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Nameplate depth framebuffer is incomplete`);
                this.source = source;
                this.width = width;
                this.height = height;
            }
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffer);
            gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
        } finally {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, source);
        }
    }

    public finishWorld() {
        if (!this.active || this.copied) return;

        this.capture();
        this.copied = true;
    }

    public render(scene: Scene, camera: Camera) {
        if (!this.active) return;

        const autoClear = this.renderer.autoClear;

        try {
            this.renderer.autoClear = false;
            this.renderer.render(scene, camera);
        } finally {
            this.renderer.autoClear = autoClear;
            this.end();
        }
    }

    public end() {
        this.active = false;
        for (const nameplate of this.arrNameplates) nameplate.setOpaqueDepth(null, 0, 0);
        this.arrNameplates.length = 0;
    }

    public dispose() {
        this.renderer.domElement.removeEventListener("webglcontextrestored", this.contextRestored);
        if (this.framebuffer) this.gl.deleteFramebuffer(this.framebuffer);
        if (this.texture) this.texture.dispose();
        this.framebuffer = null;
        this.texture = null;
        this.source = undefined;
    }
}

export default NameplateDepth;
