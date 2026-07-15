import { Uniform, UniformsLib, UniformsUtils, Vector3 } from "three";

const GLOBAL_UNIFORMS = Object.freeze(UniformsUtils.merge([
    UniformsLib.fog, {
        globalTime: new Uniform(0),
        // camera-facing billboard basis (world-space), recomputed once per frame in
        // render-manager.ts instead of once per particle - every instanced sprite
        // emitter's shader reads the same pair of vectors instead of each particle
        // doing its own quaternion/matrix work on the CPU
        cameraBillboardRight: new Uniform(new Vector3(1, 0, 0)),
        cameraBillboardUp: new Uniform(new Vector3(0, 1, 0)),
    }
]) as UniformMap_T);

function appendGlobalUniforms(uniforms: UniformMap_T): UniformMap_T {
    for (let [k, v] of Object.entries(GLOBAL_UNIFORMS))
        uniforms[k] = v;

    return uniforms;
}

export default GLOBAL_UNIFORMS;
export { appendGlobalUniforms, GLOBAL_UNIFORMS };

type UniformMap_T = Record<string, Uniform>;