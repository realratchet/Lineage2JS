import { CustomBlending, DstColorFactor, NoBlending, NormalBlending, OneFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, SrcAlphaFactor, SrcColorFactor, ZeroFactor, type ShaderMaterial } from "three";
import type { ParticleBlendModes_T } from "@l2js/engine/contracts/emitter";

export function isOrderIndependentAdditive(material: any): material is ShaderMaterial {
    return material?.isInstancedParticleMaterial === true
        && material.blending === CustomBlending
        && material.blendSrc === OneFactor
        && material.blendDst === OneFactor
        && material.blendSrcAlpha === ZeroFactor
        && material.blendDstAlpha === OneFactor;
}

// Preserve destination alpha for later transparent compositing.
const preserveDestinationAlpha = { blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor };

// SetParticleMaterial in the leaked source, separate from AActor::Style.
const particleBlending: Record<ParticleBlendModes_T, ParticleBlendingSettings_T> = {
    normal: { blending: NoBlending }, // PTDS_Regular: ONE, ZERO
    alpha: { blending: NormalBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor }, // PTDS_AlphaBlend
    modulate: { blending: CustomBlending, blendSrc: DstColorFactor, blendDst: SrcColorFactor, ...preserveDestinationAlpha }, // PTDS_Modulated
    translucent: { blending: CustomBlending, blendSrc: OneFactor, blendDst: OneFactor, ...preserveDestinationAlpha, isAdditive: true }, // PTDS_Translucent
    alphaModulate: { blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, ...preserveDestinationAlpha, isAdditive: true }, // PTDS_AlphaModulate
    darken: { blending: CustomBlending, blendSrc: ZeroFactor, blendDst: OneMinusSrcColorFactor, ...preserveDestinationAlpha, isAdditive: true }, // PTDS_Darken: D3DDrv.dll RVA 0xa583..0xa626 overrides fog to FColor(0, 0, 0, 0).
    brighten: { blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcColorFactor, ...preserveDestinationAlpha, isAdditive: true } // PTDS_Brighten
};

export function getPartcileBlendingSettings(blendingMode: ParticleBlendModes_T, defines: Record<string, any>) {
    if (!Object.hasOwn(particleBlending, blendingMode)) {
        debugger;
        throw new Error(`Unknown blending mode: ${blendingMode}`);
    }

    const { isAdditive, ...settings } = particleBlending[blendingMode];
    if (isAdditive) defines.USE_ADDITIVE_FOG = "";

    return settings;
}

type ParticleBlendingSettings_T = { blending: THREE.Blending, blendSrc?: THREE.BlendingDstFactor, blendDst?: THREE.BlendingDstFactor, blendSrcAlpha?: THREE.BlendingDstFactor, blendDstAlpha?: THREE.BlendingDstFactor, isAdditive?: boolean };
