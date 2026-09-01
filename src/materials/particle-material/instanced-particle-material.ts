import { DoubleSide, FrontSide, ShaderMaterial, UniformsUtils, UniformsLib, Vector3 } from "three";
import VERTEX_SHADER from "./shader/shader-particle-instanced.vs";
import FRAGMENT_SHADER from "./shader/shader-particle-instanced.fs";
import { appendGlobalUniforms } from "../global-uniforms";
import { fixParticleTextureSampling, getPartcileBlendingSettings } from "./particle-material";
import type { ParticleBlendModes_T, SpriteDirections_T } from "@l2js/engine";

class InstancedParticleMaterial extends ShaderMaterial {
    public isUpdatable = false;

    constructor({ map, blendingMode, name, usesSubdivision, spriteDirection, projectionNormal }: InstancedParticleMaterialInitSettings_T) {

        const uniforms = appendGlobalUniforms(UniformsUtils.merge([
            UniformsLib.fog
        ]));

        uniforms.map = { value: map?.uniforms.map.texture ?? null };
        fixParticleTextureSampling(uniforms.map.value, usesSubdivision === true);
        uniforms.alphaTest = { value: 1e-3 };
        uniforms.particleProjectionNormal = { value: projectionNormal?.clone() ?? new Vector3(0, 0, 1) };

        const defines: Record<string, any> = { USE_FOG: "", USE_ALPHATEST: "" };

        if (uniforms.map.value) {
            defines.USE_MAP = "";
        }
        if (spriteDirection === "normal") {
            defines.USE_FIXED_NORMAL = "";
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
            // Camera billboards continuously face the viewer, so rendering their
            // back face only duplicates every transparent draw in three r143.
            side: spriteDirection === "camera" ? FrontSide : DoubleSide,
            ...blendingSettings
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
    blendingMode: ParticleBlendModes_T,
    name: string,
    usesSubdivision?: boolean,
    spriteDirection?: SpriteDirections_T,
    projectionNormal?: Vector3
};
