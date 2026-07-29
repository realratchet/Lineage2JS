import { WebGLRenderTarget, WebGLRenderer, ShaderMaterial, LinearFilter, RGBAFormat } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";

const GAMMA_STEPS = [1.2, 1.0, 0.8, 0.6, 0.4];

// C4 D3DDrv.dll UpdateGamma RVA 0x12190: (Contrast+.5)*pow(i/255,1/Gamma)*65535 + (Brightness-.5)*32768 - Contrast*32768 + 16384
class DisplayGammaPass {
    protected readonly target: WebGLRenderTarget;
    protected readonly material: ShaderMaterial;
    protected readonly fsQuad: FullScreenQuad;

    public constructor(width: number, height: number, samples: number) {

        this.target = new WebGLRenderTarget(width, height, { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat, samples });
        this.target.texture.name = "DisplayGammaPass.target";

        // the world render leaves autoClear off, so the blit must not depth-test against a stale buffer
        this.material = new ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            uniforms: {
                tDiffuse: { value: null },
                exponent: { value: 1.25 },
                scale: { value: 1.2 },
                offset: { value: (0.8 - 0.7) * 32768 / 65535 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float exponent;
                uniform float scale;
                uniform float offset;
                varying vec2 vUv;
                void main() {
                    vec4 texel = texture2D(tDiffuse, vUv);
                    gl_FragColor = vec4(clamp(scale * pow(texel.rgb, vec3(exponent)) + offset, 0.0, 1.0), texel.a);
                }
            `
        });

        this.fsQuad = new FullScreenQuad(this.material);
    }

    public setRamp({ brightness, contrast, gamma }: GA.IDisplayConfig) {
        this.material.uniforms.exponent.value = 1 / gamma;
        this.material.uniforms.scale.value = contrast + 0.5;
        this.material.uniforms.offset.value = (brightness - contrast) * 32768 / 65535;
    }

    public getTarget() { return this.target; }

    public setSize(width: number, height: number) { this.target.setSize(width, height); }

    public render(renderer: WebGLRenderer) {
        this.material.uniforms.tDiffuse.value = this.target.texture;

        renderer.setRenderTarget(null);
        this.fsQuad.render(renderer);
    }
}

export default DisplayGammaPass;
export { DisplayGammaPass, GAMMA_STEPS };
