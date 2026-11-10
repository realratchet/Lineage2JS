import { CustomBlending, OneFactor, ZeroFactor, type ShaderMaterial } from "three";

export function isOrderIndependentAdditive(material: any): material is ShaderMaterial {
    return material?.isInstancedParticleMaterial === true
        && material.blending === CustomBlending
        && material.blendSrc === OneFactor
        && material.blendDst === OneFactor
        && material.blendSrcAlpha === ZeroFactor
        && material.blendDstAlpha === OneFactor;
}

