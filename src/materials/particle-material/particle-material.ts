import { Color, ClampToEdgeWrapping, CustomBlending, DoubleSide, LinearFilter, NoBlending, NormalBlending, OneFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, ZeroFactor, DstColorFactor, SrcColorFactor, SrcAlphaFactor, ShaderMaterial, UniformsUtils, UniformsLib, Vector4 } from "three";
import VERTEX_SHADER from "./shader/shader-particle.vs";
import FRAGMENT_SHADER from "./shader/shader-particle.fs";
import { appendGlobalUniforms } from "../global-uniforms";
import type { ParticleBlendModes_T } from "@l2js/engine/contracts/emitter";
import type { IDecodedParameter } from "@l2js/engine/contracts/material";

// Billboard quads never need to tile, so always clamp. Mip-disable is opt-in
// (atlas-cropped textures only) since low mips blend neighboring atlas cells.
export function fixParticleTextureSampling(texture: any, disableMipmaps: boolean = false) {
    if (!texture) return;
    let changed = false;
    if (texture.wrapS !== ClampToEdgeWrapping || texture.wrapT !== ClampToEdgeWrapping) {
        texture.wrapS = ClampToEdgeWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        changed = true;
    }
    if (disableMipmaps && texture.minFilter !== LinearFilter && texture.mipmaps?.length > 1) {
        texture.minFilter = LinearFilter;
        changed = true;
    }
    if (changed) texture.needsUpdate = true;
}

class ParticleMaterial extends ShaderMaterial {
    public isUpdatable = false;

    constructor({ map, blendingMode, opacity, name, usesSubdivision }: ParticleMaterialInitSettings_T) {

        const uniforms = appendGlobalUniforms(UniformsUtils.merge([
            UniformsLib.common,
            UniformsLib.fog
        ]));

        uniforms.map.value = map?.uniforms.map.texture ?? null; // missing textures still simulate
        fixParticleTextureSampling(uniforms.map.value, usesSubdivision === true);
        if (opacity !== undefined) uniforms.opacity.value = opacity;
        uniforms.diffuse.value = new Color(0xffffff);
        uniforms.alphaTest.value = 1e-3;
        uniforms.uvOffsetScale = { value: new Vector4(0, 0, 1, 1) };

        const defines: Record<string, any> = { USE_FOG: "", USE_ALPHATEST: "" };

        if (uniforms.map.value) {
            defines.USE_MAP = "";
        }
        const { isAdditive, ...blendingSettings } = getPartcileBlendingSettings(blendingMode);

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
            ...blendingSettings
        });

        (this as any).isParticleMaterial = true;

        this.isUpdatable = (uniforms.map.value as any)?.isUpdatable === true;
        this.name = name;
    }

    public update(time: number) {
        (this.uniforms.map.value as any)?.update(time);
    }
}

class AnimatedParticleMaterial extends ShaderMaterial {
    protected framerate: number;
    protected sprites: IDecodedParameter[];
    public readonly isUpdatable = true;

    constructor({ blendingMode, opacity, name, framerate, sprites }: ParticleMaterialInitSettings_T) {

        const uniforms = appendGlobalUniforms(UniformsUtils.merge([
            UniformsLib.common,
            UniformsLib.fog
        ]));

        uniforms.map.value = sprites[0].uniforms.map.texture;
        fixParticleTextureSampling(uniforms.map.value);
        if (opacity !== undefined) uniforms.opacity.value = opacity;
        uniforms.diffuse.value = new Color(0xffffff);
        uniforms.alphaTest.value = 1e-3;
        uniforms.uvOffsetScale = { value: new Vector4(0, 0, 1, 1) };

        const defines: Record<string, any> = { USE_MAP: "", USE_FOG: "", USE_ALPHATEST: "" };
        const { isAdditive, ...blendingSettings } = getPartcileBlendingSettings(blendingMode);

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
            ...blendingSettings
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
        fixParticleTextureSampling(this.uniforms.map.value);
    }
}

export default ParticleMaterial;
export { ParticleMaterial, AnimatedParticleMaterial };

// Particle-specific blend table (SetParticleMaterial in the leaked source), separate from AActor::Style.
export function getPartcileBlendingSettings(blendingMode: ParticleBlendModes_T) {
    // UE2 renders these modes into a backbuffer whose alpha is irrelevant. Our
    // transparent intermediate target uses alpha for later compositing, so custom
    // RGB blends must leave destination alpha alone. Applying e.g. Darken's
    // ZERO/ONE_MINUS_SRC_COLOR to alpha punches a rectangular transparent hole.
    const preserveDestinationAlpha = {
        blendSrcAlpha: ZeroFactor,
        blendDstAlpha: OneFactor
    };

    switch (blendingMode as string) {
        case "normal": return { blending: NoBlending }; // PTDS_Regular: ONE, ZERO
        case "alpha": return { blending: NormalBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor }; // PTDS_AlphaBlend
        // PTDS_Modulated: DST_COLOR, SRC_COLOR.
        case "modulate": return {
            blending: CustomBlending,
            blendSrc: DstColorFactor,
            blendDst: SrcColorFactor,
            ...preserveDestinationAlpha
        };
        // PTDS_Translucent: ONE, ONE - pure additive, alpha ignored.
        case "translucent": return {
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneFactor,
            ...preserveDestinationAlpha,
            isAdditive: true
        };
        // PTDS_AlphaModulate: ONE, ONE_MINUS_SRC_ALPHA.
        case "alphaModulate": return {
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneMinusSrcAlphaFactor,
            ...preserveDestinationAlpha,
            isAdditive: true
        };
        // PTDS_Darken: ZERO, ONE_MINUS_SRC_COLOR.
        case "darken": return {
            blending: CustomBlending,
            blendSrc: ZeroFactor,
            blendDst: OneMinusSrcColorFactor,
            ...preserveDestinationAlpha
        };
        // PTDS_Brighten: ONE, ONE_MINUS_SRC_COLOR (screen blend).
        case "brighten": return {
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneMinusSrcColorFactor,
            ...preserveDestinationAlpha,
            isAdditive: true
        };
        default:
            debugger;
            throw new Error(`Unknown blending mode: ${blendingMode}`);
    }
}

export type ParticleMaterialInitSettings_T = {
    type: "sprite" | "texture",
    map?: any,
    sprites?: any[],
    framerate?: number,
    blendingMode: ParticleBlendModes_T,
    opacity: number,
    name: string,
    usesSubdivision?: boolean
};
