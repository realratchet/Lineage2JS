import { Color, CustomBlending, DoubleSide, NormalBlending, OneFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, ZeroFactor, DstColorFactor, SrcColorFactor, SrcAlphaFactor, ShaderMaterial, UniformsUtils, UniformsLib } from "three";
import VERTEX_SHADER from "./shader/shader-particle.vs";
import FRAGMENT_SHADER from "./shader/shader-particle.fs";
import { appendGlobalUniforms } from "../global-uniforms";

class ParticleMaterial extends ShaderMaterial {
    constructor({ map, blendingMode, opacity, name }: ParticleMaterialInitSettings_T) {

        const uniforms = appendGlobalUniforms(UniformsUtils.merge([
            UniformsLib.common,
            UniformsLib.fog
        ]));

        uniforms.map.value = map.uniforms.map.texture;
        if (opacity !== undefined) uniforms.opacity.value = opacity;
        uniforms.diffuse.value = new Color(0xffffff);
        uniforms.alphaTest.value = 1e-3;

        const defines: Record<string, any> = { USE_MAP: "", USE_FOG: "", USE_ALPHATEST: "" };
        const { blending, blendSrc, blendDst, isAdditive } = getPartcileBlendingSettings(blendingMode);

        if (isAdditive) {
            defines.USE_ADDITIVE_FOG = "";
        }

        super({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            uniforms,
            defines,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            blending,
            blendSrc,
            blendDst
        });

        (this as any).isParticleMaterial = true;

        this.name = name;
    }
}

class AnimatedParticleMaterial extends ShaderMaterial {
    protected framerate: number;
    protected sprites: GD.IDecodedParameter[];
    public readonly isUpdatable = true;

    constructor({ blendingMode, opacity, name, framerate, sprites }: ParticleMaterialInitSettings_T) {

        const uniforms = appendGlobalUniforms(UniformsUtils.merge([
            UniformsLib.common,
            UniformsLib.fog
        ]));

        uniforms.map.value = sprites[0].uniforms.map.texture;
        if (opacity !== undefined) uniforms.opacity.value = opacity;
        uniforms.diffuse.value = new Color(0xffffff);
        uniforms.alphaTest.value = 1e-3;

        const defines: Record<string, any> = { USE_MAP: "", USE_FOG: "", USE_ALPHATEST: "" };
        const { blending, blendSrc, blendDst, isAdditive } = getPartcileBlendingSettings(blendingMode);

        if (isAdditive) {
            defines.USE_ADDITIVE_FOG = "";
        }

        super({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            uniforms,
            defines,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            blending,
            blendSrc,
            blendDst
        });

        (this as any).isParticleMaterial = true;

        this.framerate = framerate;
        this.name = name;
        this.sprites = sprites;
    }

    public update(time: number) {

        const frameCount = this.sprites.length;

        if (frameCount <= 1) return;

        const framerate = this.framerate;
        const activeFrameIndex = Math.floor(time / framerate) % frameCount;

        this.uniforms.map.value = this.sprites[activeFrameIndex].uniforms.map.texture;
    }
}

export default ParticleMaterial;
export { ParticleMaterial, AnimatedParticleMaterial };

function getPartcileBlendingSettings(blendingMode: GD.ParticleBlendModes_T) {
    switch (blendingMode as string) {
        case "normal": return { blending: NormalBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor };
        case "alpha": return { blending: NormalBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor };
        case "modulate": return {
            blending: CustomBlending,
            blendSrc: DstColorFactor,
            blendDst: SrcColorFactor
        };
        case "translucent": return {
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneMinusSrcColorFactor,
            isAdditive: true
        };
        case "alphaModulate": return {
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneMinusSrcAlphaFactor,
            isAdditive: true
        };
        case "darken": return {
            blending: CustomBlending,
            blendSrc: ZeroFactor,
            blendDst: OneMinusSrcColorFactor
        };
        case "brighten": return {
            blending: CustomBlending,
            blendSrc: SrcAlphaFactor, // UE2 FB_Brighten
            blendDst: OneFactor,
            isAdditive: true
        };
        default:
            debugger;
            throw new Error(`Unknown blending mode: ${blendingMode}`);
    }
}

type ParticleMaterialInitSettings_T = {
    map?: any,
    sprites?: any[],
    framerate?: number,
    blendingMode: GD.ParticleBlendModes_T,
    opacity: number,
    name: string
};