import { Uniform, UniformsLib, UniformsUtils } from "three";

const GLOBAL_UNIFORMS = Object.freeze(UniformsUtils.merge([
    UniformsLib.fog, {
        globalTime: new Uniform(0),
    }
]) as UniformMap_T);

function appendGlobalUniforms(uniforms: UniformMap_T): UniformMap_T {
    for (let [k, v] of Object.entries(GLOBAL_UNIFORMS))
        uniforms[k] = v;

    return uniforms;
}

export default GLOBAL_UNIFORMS;
export { appendGlobalUniforms, GLOBAL_UNIFORMS };

type UniformMap_T = GenericObjectContainer_T<Uniform>;