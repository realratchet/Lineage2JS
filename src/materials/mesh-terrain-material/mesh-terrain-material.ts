import { ShaderMaterial, Uniform, Color, Matrix3 } from "three";

import VERTEX_SHADER from "./shader/shader-mesh-terrain.vs";
import FRAGMENT_SHADER from "./shader/shader-mesh-terrain.fs";

class MeshTerrainMaterial extends ShaderMaterial {
    // @ts-ignore
    constructor(info: MeshTerrainMaterialParameters) {
        const defines: GenericObjectContainer_T<any> = {};
        const uniforms: GenericObjectContainer_T<Uniform> = {
            alphaTest: new Uniform(1e-3),
            diffuse: new Uniform(new Color(1, 1, 1)),
            opacity: new Uniform(1),
            uvTransform: new Uniform(new Matrix3()),
            transformSpecular: new Uniform(null),
            layer1: new Uniform(null),
            layer2: new Uniform(null),
            layer3: new Uniform(null),
            layer4: new Uniform(null),
            layer5: new Uniform(null),
            layer6: new Uniform(null),
            layer7: new Uniform(null),
            layer8: new Uniform(null),
            layer9: new Uniform(null),
            layer10: new Uniform(null),
            layer11: new Uniform(null),
        };

        info.layers.forEach((layer, i) => {
            if (!layer.map && !layer.alphaMap) return;

            defines[`USE_UV${i === 0 ? "" : i + 1}`] = "";
            defines[`USE_LAYER_${i + 1}`] = "";

            const u = uniforms[`layer${i + 1}`].value = { map: {}, alphaMap: {} };

            // if (i > 0) debugger;

            if (layer.map) {
                defines[`USE_LAYER_${i + 1}_DIFFUSE`] = "";
                Object.assign(u.map, layer.map.uniforms.map);
            }

            if (layer.alphaMap) {
                // if(!layer.map) debugger;

                defines[`USE_LAYER_${i + 1}_OPACITY`] = "";
                Object.assign(u.alphaMap, layer.alphaMap.uniforms.map);
            }

            // if (layer.alphaMap) {
            //     defines[`USE_ALPHA_MAP${i === 0 ? "" : `${i + 1}`}`] = "";
            //     Object.assign(uniforms[`alphaMap${i === 0 ? "" : i + 1}`].value = {}, layer.alphaMap.uniforms);
            // }

            // if (i > 0) debugger;

            // if(i === 2) debugger;
        });

        super({
            defines,
            uniforms,
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER
        });
    }
}

export default MeshTerrainMaterial;
export { MeshTerrainMaterial };

type MeshTerrainMaterialParameters = {
    layers: { map: IDecodedParameter, alphaMap: IDecodedParameter }[]
};