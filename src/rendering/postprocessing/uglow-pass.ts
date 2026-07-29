import {
    WebGLRenderTarget,
    ShaderMaterial,
    UniformsUtils,
    Vector2,
    Scene,
    Camera,
    Mesh,
    PlaneGeometry,
    LinearFilter,
    RGBAFormat,
    FloatType
} from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";

/**
 * UGlowPass replicates the UE2 UGlowEffect post-processing system.
 * It uses an aggressive RGB cutoff for the bright pass (0.993 threshold)
 * as identified in the game's IDA traces and env.int configuration.
 */
class UGlowPass extends Pass {
    private renderTargetBright: WebGLRenderTarget;
    private renderTargetBlurH: WebGLRenderTarget;
    private renderTargetBlurV: WebGLRenderTarget;

    private materialBright: ShaderMaterial;
    private materialBlurH: ShaderMaterial;
    private materialBlurV: ShaderMaterial;
    public materialCombine: ShaderMaterial;

    private fsQuad: FullScreenQuad;

    constructor(resolution: Vector2) {
        super();

        const resX = Math.round(resolution.x / 4);
        const resY = Math.round(resolution.y / 4);

        const pars = { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat, generateMipmaps: false };
        this.renderTargetBright = new WebGLRenderTarget(resX, resY, pars);
        this.renderTargetBright.texture.name = "UGlowPass.bright";
        this.renderTargetBlurH = new WebGLRenderTarget(resX, resY, pars);
        this.renderTargetBlurH.texture.name = "UGlowPass.blurH";
        this.renderTargetBlurV = new WebGLRenderTarget(resX, resY, pars);
        this.renderTargetBlurV.texture.name = "UGlowPass.blurV";

        // 1. Bright Pass Shader (GlowType=2: RGB Cutoff)
        this.materialBright = new ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                rgbCutoff: { value: 0.993 }, // IDA: 0.993
                bloomScale: { value: 4.0 }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float rgbCutoff;
                uniform float bloomScale;
                varying vec2 vUv;
                void main() {
                    vec4 texel = texture2D(tDiffuse, vUv);
                    // UE2 cutoff is Max(RGB) > cutoff, bloomScale applies in the combine pass because byte renderTargets clamp to 1.0
                    if (max(texel.r, max(texel.g, texel.b)) > rgbCutoff) {
                        gl_FragColor = texel;
                        gl_FragColor.a = 1.0;
                    } else {
                        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Alpha 1.0 for safety
                    }
                }
            `
        });

        // 2. Blur Shaders (Using 16-sample-ish kernel logic from DownFilter16/BlurRender)
        // Simplified Gaussian for Three.js implementation
        this.materialBlurH = new ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                resolution: { value: new Vector2(resX, resY) }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getBlurFragmentShader(true)
        });

        this.materialBlurV = new ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                resolution: { value: new Vector2(resX, resY) }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getBlurFragmentShader(false)
        });

        // 3. Combine Shader
        this.materialCombine = new ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tBloom: { value: null },
                opacity: { value: 64 / 255 }, // FinalBlendOpacity=64
                bloomScale: { value: 4.0 }, // BloomScale=4.0
                debugMode: { value: 0 } // 0=Final, 1=BrightPass, 2=Blur
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform sampler2D tBloom;
                uniform float opacity;
                uniform float bloomScale;
                uniform int debugMode;
                varying vec2 vUv;
                void main() {
                    vec4 base = texture2D(tDiffuse, vUv);
                    vec4 bloom = texture2D(tBloom, vUv);
                    
                    if (debugMode == 1) {
                        // Visualize Bright Pass (via Bloom texture)
                        // If we see pixels here, the threshold passed.
                        if (length(bloom.rgb) > 0.01) {
                            gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); // Solid GREEN for bloom
                        } else {
                            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                        }
                    } else if (debugMode == 2) {
                        // Visualize Mix
                        gl_FragColor = mix(base, bloom * bloomScale, 0.5);
                    } else {
                        // Additive mix
                        // Apply bloomScale here to avoid clamping in byte buffers
                        gl_FragColor = base + (bloom * bloomScale * opacity);
                    }
                }
            `
        });

        this.fsQuad = new FullScreenQuad(null);
    }

    private getVertexShader(): string {
        return `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
    }

    private getBlurFragmentShader(horizontal: boolean): string {
        // Increased spread factor from 1.0 to 1.5 for wider blur ("more blurred")
        const spread = 1.5;
        return `
            uniform sampler2D tDiffuse;
            uniform vec2 resolution;
            varying vec2 vUv;
            void main() {
                vec2 off = (1.0 / resolution) * ${horizontal ? "vec2(1.0, 0.0)" : "vec2(0.0, 1.0)"} * ${spread};
                vec4 sum = vec4(0.0);
                sum += texture2D(tDiffuse, vUv - off * 4.0) * 0.051;
                sum += texture2D(tDiffuse, vUv - off * 3.0) * 0.0918;
                sum += texture2D(tDiffuse, vUv - off * 2.0) * 0.12245;
                sum += texture2D(tDiffuse, vUv - off * 1.0) * 0.1531;
                sum += texture2D(tDiffuse, vUv) * 0.1633;
                sum += texture2D(tDiffuse, vUv + off * 1.0) * 0.1531;
                sum += texture2D(tDiffuse, vUv + off * 2.0) * 0.12245;
                sum += texture2D(tDiffuse, vUv + off * 3.0) * 0.0918;
                sum += texture2D(tDiffuse, vUv + off * 4.0) * 0.051;
                gl_FragColor = sum;
            }
        `;
    }

    render(renderer: any, writeBuffer: any, readBuffer: any) {
        const oldLogarithmicDepthBuffer = renderer.capabilities.logarithmicDepthBuffer;
        // Post-processing doesn't need logarithmic depth

        // 1. Bright Pass
        this.materialBright.uniforms.tDiffuse.value = readBuffer.texture;
        renderer.setRenderTarget(this.renderTargetBright);
        renderer.clear(); // Explicit clear
        this.fsQuad.material = this.materialBright;
        this.fsQuad.render(renderer);

        // 2. Blur Horizontal
        this.materialBlurH.uniforms.tDiffuse.value = this.renderTargetBright.texture;
        renderer.setRenderTarget(this.renderTargetBlurH);
        renderer.clear(); // Explicit clear
        this.fsQuad.material = this.materialBlurH;
        this.fsQuad.render(renderer);

        // 3. Blur Vertical
        this.materialBlurV.uniforms.tDiffuse.value = this.renderTargetBlurH.texture;
        renderer.setRenderTarget(this.renderTargetBlurV);
        renderer.clear(); // Explicit clear
        this.fsQuad.material = this.materialBlurV;
        this.fsQuad.render(renderer);

        // 4. Combine
        this.materialCombine.uniforms.tDiffuse.value = readBuffer.texture;
        this.materialCombine.uniforms.tBloom.value = this.renderTargetBlurV.texture;
        this.materialCombine.uniforms.bloomScale.value = this.materialBright.uniforms.bloomScale.value; // Sync param

        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
            this.fsQuad.material = this.materialCombine;
            this.fsQuad.render(renderer);
        } else {
            renderer.setRenderTarget(writeBuffer);
            if (this.clear) renderer.clear();
            this.fsQuad.material = this.materialCombine;
            this.fsQuad.render(renderer);
        }
    }

    setSize(width: number, height: number) {
        const resX = Math.round(width / 4);
        const resY = Math.round(height / 4);
        this.renderTargetBright.setSize(resX, resY);
        this.renderTargetBlurH.setSize(resX, resY);
        this.renderTargetBlurV.setSize(resX, resY);
        this.materialBlurH.uniforms.resolution.value.set(resX, resY);
        this.materialBlurV.uniforms.resolution.value.set(resX, resY);
    }
}

export { UGlowPass };
