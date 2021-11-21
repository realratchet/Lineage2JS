import { ShaderMaterial, Uniform, Matrix3 } from "three";

import VERTEX_SHADER from "./shader/shader-uv.vs";
import FRAGMENT_SHADER from "./shader/shader-uv.fs";

class MeshUVMaterial extends ShaderMaterial {
    constructor() {
        super({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            defines: {
                "USE_UV": ""
            },
            uniforms: {
                uvTransform: new Uniform(new Matrix3())
            }
        });
    }
}

export default MeshUVMaterial;
export { MeshUVMaterial };