import { CustomBlending, DepthTexture, DoubleSide, OneFactor, ShaderMaterial, Vector2, WebGLRenderTarget, ZeroFactor, type Camera, type Scene, type WebGLRenderer } from "three";
import FRAGMENT_SHADER from "../materials/particle-material/shader/shader-particle-refraction.fs";

export type RefractionMaterial_T = ShaderMaterial & { refractionMask: ShaderMaterial };

export function setParticleRefraction(material: ShaderMaterial, scale: [number, number], instanced: boolean) {
    if (instanced) material.defines.REFRACTION_INSTANCED = "";
    material.fragmentShader = FRAGMENT_SHADER;
    material.uniforms.refractionScene = { value: null };
    material.uniforms.refractionScale = { value: new Vector2(...scale) };
    material.blending = CustomBlending;
    material.blendSrc = OneFactor;
    material.blendDst = ZeroFactor;
    material.blendSrcAlpha = ZeroFactor;
    material.blendDstAlpha = OneFactor;
    material.forceSinglePass = true;

    const mask = new ShaderMaterial({
        vertexShader: material.vertexShader, fragmentShader: FRAGMENT_SHADER,
        uniforms: material.uniforms, defines: { ...material.defines, REFRACTION_MASK: "" },
        side: DoubleSide, depthWrite: false, blending: CustomBlending,
        blendSrc: ZeroFactor, blendDst: OneFactor, blendSrcAlpha: OneFactor, blendDstAlpha: ZeroFactor
    });
    (material as RefractionMaterial_T).refractionMask = mask;
    material.addEventListener("dispose", () => mask.dispose());
}

const clearColor = new Float32Array(4);

export class ParticleRefraction {
    protected target: WebGLRenderTarget = null;
    protected frame = -1;

    public prepare(renderer: WebGLRenderer, scene: Scene, camera: Camera, material: RefractionMaterial_T) {
        if (this.frame !== renderer.info.render.frame) {
            this.capture(renderer, scene, camera);
            this.frame = renderer.info.render.frame;
        }
        material.uniforms.refractionScene.value = this.target.texture;
    }

    protected capture(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
        const gl = renderer.getContext() as WebGL2RenderingContext, source = renderer.getRenderTarget();
        const width = source ? source.width : gl.drawingBufferWidth, height = source ? source.height : gl.drawingBufferHeight;
        const stencil = source ? source.stencilBuffer : true;
        const depth = source?.depthTexture;
        if (!this.target || this.target.stencilBuffer !== stencil || this.target.depthTexture?.type !== depth?.type) {
            this.dispose();
            this.target = new WebGLRenderTarget(width, height, { stencilBuffer: stencil });
            if (depth) {
                this.target.depthTexture = new DepthTexture(width, height, depth.type);
                this.target.depthTexture.format = depth.format;
            }
        } else this.target.setSize(width, height);

        const framebuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
        try {
            renderer.setRenderTarget(this.target);
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
            gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);

            renderer.state.buffers.color.setMask(true);
            gl.colorMask(false, false, false, true);
            gl.clearBufferfv(gl.COLOR, 0, clearColor);
            gl.colorMask(true, true, true, true);

            for (const { object, geometry, material, group } of renderer.renderLists.get(scene, 0).transparent) {
                const mask = (material as RefractionMaterial_T).refractionMask;
                if (!mask || !object.layers.test(camera.layers)) continue;
                object.onBeforeRender(renderer, scene, camera, geometry, material, group);
                object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
                mask.depthTest = material.depthTest;
                renderer.renderBufferDirect(camera, scene, geometry, mask, object, group as any);
            }
        } finally {
            renderer.setRenderTarget(source);
        }
    }

    public dispose() {
        this.target?.dispose();
        this.target = null;
        this.frame = -1;
    }
}

export default ParticleRefraction;
