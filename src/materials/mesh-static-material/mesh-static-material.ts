import { ShaderMaterial, Uniform, Matrix3, MeshBasicMaterialParameters, Color, Texture, MultiplyOperation, Combine, UniformsUtils, UniformsLib, ShaderLib } from "three";

import VERTEX_SHADER from "./shader/shader-mesh-static.vs";
import FRAGMENT_SHADER from "./shader/shader-mesh-static.fs";

class MeshStaticMaterial extends ShaderMaterial {

    public readonly isMeshBasicMaterial = true;
    public color = new Color(0xffffff); // emissive

    public map?: Texture = null;

    public lightMap: Texture = null;
    public lightMapIntensity: number = 1.0;

    public aoMap?: Texture = null;
    public aoMapIntensity: number = 1.0;

    public specularMap?: Texture = null;

    public alphaMap?: Texture = null;

    public envMap?: Texture = null;
    public combine: Combine = MultiplyOperation;
    public reflectivity: number = 1;
    public refractionRatio: number = 0.98;

    public wireframe: boolean = false;
    public wireframeLinewidth: number = 1;
    public wireframeLinecap: "round" = 'round';
    public wireframeLinejoin: "round" = 'round';

    constructor(parameters: MeshStaticMaterialParameters) {
        super({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            defines: {
            },
            uniforms: UniformsUtils.merge([{}, ShaderLib.basic.uniforms, {
                map2: new Uniform(null),
            }])
        });


        this.setValues(parameters);
    }
}

export default MeshStaticMaterial;
export { MeshStaticMaterial };

type MeshStaticMaterialParameters = MeshBasicMaterialParameters & {
    
};