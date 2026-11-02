import { MeshBasicMaterial, Vector4, type Vector2, type WebGLRenderer } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";

const tmpScissor = new Vector4();

export class WideScreenBars { // FPlayerSceneNode::Render 0x1062611a: bRenderWide draws FSolidColorTexture(0,0,0,0xc0) through FinalBlend FB_AlphaBlend as tiles (0,0,X,Y*0.1) and (0,Y*0.9,X,Y)
    protected readonly quad = new FullScreenQuad(new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0xc0 / 255, depthTest: false, depthWrite: false }));

    public render(renderer: WebGLRenderer, size: Vector2) {
        const target = renderer.getRenderTarget(), scale = target ? target.width / size.x : 1, height = size.y * scale;
        const top = Math.ceil(height * Math.fround(0.1) - 0.5), bottom = height - Math.ceil(height * Math.fround(0.9) - 0.5);
        const isScissorTest = target ? target.scissorTest : renderer.getScissorTest();

        if (target) tmpScissor.copy(target.scissor);
        else renderer.getScissor(tmpScissor);

        this.setScissor(renderer, 0, height - top, size.x * scale, top, true);
        this.quad.render(renderer);
        this.setScissor(renderer, 0, 0, size.x * scale, bottom, true);
        this.quad.render(renderer);
        this.setScissor(renderer, tmpScissor.x, tmpScissor.y, tmpScissor.z, tmpScissor.w, isScissorTest);
    }

    protected setScissor(renderer: WebGLRenderer, x: number, y: number, w: number, h: number, isScissor: boolean) {
        const target = renderer.getRenderTarget();

        if (!target) {
            renderer.setScissor(x, y, w, h);
            renderer.setScissorTest(isScissor);
            return;
        }

        target.scissor.set(x, y, w, h);
        target.scissorTest = isScissor;
        renderer.setRenderTarget(target);
    }
}

export default WideScreenBars;
