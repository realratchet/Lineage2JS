import { AdditiveBlending, CustomBlending, DoubleSide, MeshBasicMaterial, NormalBlending, OneFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, SrcAlphaFactor } from "three";


class ParticleMaterial extends MeshBasicMaterial {
    constructor({ map, blendingMode, opacity }: ParticleMaterialInitSettings_T) {

        super({
            map: map.uniforms.map.texture,
            opacity,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            ...getPartcileBlendingSettings(blendingMode)
        });
    }
}

export default ParticleMaterial;
export { ParticleMaterial };

function getPartcileBlendingSettings(blendingMode: ParticleBlendModes_T) {
    switch (blendingMode) {
        case "normal": return { blending: NormalBlending };
        case "alpha": return {
            blending: CustomBlending,
            blendSrc: SrcAlphaFactor,
            blendDst: OneMinusSrcAlphaFactor,
        };
        case "brighten": return { blending: AdditiveBlending };
        case "translucent": return {
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneMinusSrcColorFactor
        }
        default: console.warn("Unknown blending mode:", blendingMode); return {};
    }
}