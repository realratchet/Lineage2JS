import { DoubleSide, ShaderMaterial, UniformsUtils, UniformsLib } from "three";
import VERTEX_SHADER from "./shader/shader-particle-instanced.vs";
import FRAGMENT_SHADER from "./shader/shader-particle-instanced.fs";
import { appendGlobalUniforms } from "../global-uniforms";
import { fixParticleTextureSampling, getPartcileBlendingSettings } from "./particle-material";

class InstancedParticleMaterial extends ShaderMaterial {
    public isUpdatable = false;

    constructor({ map, blendingMode, name, usesSubdivision }: InstancedParticleMaterialInitSettings_T) {

        const uniforms = appendGlobalUniforms(UniformsUtils.merge([
            UniformsLib.fog
        ]));

        uniforms.map = { value: map?.uniforms.map.texture ?? null };
        fixParticleTextureSampling(uniforms.map.value, usesSubdivision === true);
        uniforms.alphaTest = { value: 1e-3 };

        const defines: Record<string, any> = { USE_FOG: "", USE_ALPHATEST: "" };

        if (uniforms.map.value) {
            defines.USE_MAP = "";
        }
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
        (this as any).isInstancedParticleMaterial = true;

        this.isUpdatable = (uniforms.map.value as any)?.isUpdatable === true;
        this.name = name;
    }

    public update(time: number) {
        (this.uniforms.map.value as any)?.update(time);
    }
}

export default InstancedParticleMaterial;
export { InstancedParticleMaterial };

type InstancedParticleMaterialInitSettings_T = {
    map?: any,
    blendingMode: GD.ParticleBlendModes_T,
    name: string,
    usesSubdivision?: boolean
};
