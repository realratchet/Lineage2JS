import { ShaderMaterial, Uniform, Color, Matrix3, DoubleSide, DataTexture, RGFormat } from "three";

import VERTEX_SHADER from "./shader/shader-mesh-terrain.vs";
import FRAGMENT_SHADER from "./shader/shader-mesh-terrain.fs";
import { appendGlobalUniforms } from "../global-uniforms";

class MeshTerrainMaterial extends ShaderMaterial {
    // @ts-ignore
    constructor(info: MeshTerrainMaterialParameters) {
        // const tex = (function () {
        //     const width = 512;
        //     const height = 512;

        //     const size = width * height;
        //     const data = new Uint8Array(2 * size);
        //     const color = new Color(0xffffff);

        //     const r = Math.floor(color.r * 255);
        //     const g = Math.floor(color.g * 255);
        //     // const b = Math.floor(color.b * 255);

        //     for (let i = 0; i < size; i++) {

        //         const stride = i * 2;

        //         data[stride] = r;
        //         data[stride + 1] = g;
        //         // data[stride + 2] = b;
        //         // data[stride + 3] = 255;

        //     }

        //     // used the buffer to create a DataTexture

        //     const texture = new DataTexture(data, width, height, RGFormat);
        //     texture.needsUpdate = true;

        //     return texture;
        // })();

        const defines: GenericObjectContainer_T<any> = {
            USE_FOG: "",
            USE_UV_TEXTURE: "",
            UV_COUNT: info.uvs.size.height,
            MASK_UV_INDEX: info.uvs.size.height - 1
        };

        const uniforms: GenericObjectContainer_T<Uniform> = appendGlobalUniforms({
            alphaTest: new Uniform(1e-3),
            diffuse: new Uniform(new Color(1, 1, 1)),
            opacity: new Uniform(1),
            uvTransform: new Uniform(new Matrix3()),
            transformSpecular: new Uniform(null),
            uvs: new Uniform(info.uvs),
            layer0: new Uniform(null),
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
        });

        const splitFragmentShader = FRAGMENT_SHADER.split("\n");

        const pragmaSearchParams = "#pragma params_include_layers"
        const pragmaSearch = "#pragma include_layers";

        const paramsIndex = splitFragmentShader.findIndex(x => x.includes(pragmaSearchParams));
        const wsParams = new Array(splitFragmentShader[paramsIndex].indexOf(pragmaSearchParams)).fill(" ").join("");

        let layerIndex = splitFragmentShader.findIndex(x => x.includes(pragmaSearch));
        const ws = new Array(splitFragmentShader[layerIndex].indexOf(pragmaSearch)).fill(" ").join("");

        const paramsCode: string[] = [], layerCode: string[] = [];

        let needsPreamble = false;
        let needsOpacityPreamble = false;

        let done = false;

        info.layers.forEach((layer, i) => {
            if (!layer.map) return;

            // if (done) return;

            // debugger;

            // done = true;

            needsPreamble = true;

            const u = uniforms[`layer${i}`].value = { map: {}, alphaMap: {} };

            defines[`USE_LAYER_${i}`] = "";

            if (layer.alphaMap) {
                needsOpacityPreamble = true;
                defines[`USE_LAYER_${i}_OPACITY`] = "";

                layerCode.push(`${ws}layerMask = texture2D(layer${i}.alphaMap.texture, vUv[MASK_UV_INDEX]);`);
                paramsCode.push(`${wsParams}uniform MaskedLayerData layer${i};`);

                Object.assign(u.alphaMap, layer.alphaMap.uniforms.map);
            } else {
                layerCode.push(`${ws}layerMask = vec4(1.0);`);
                paramsCode.push(`${wsParams}uniform LayerData layer${i};`);
            }

            // debugger;s


            layerCode.push(`${ws}layer = vec4(texture2D(layer${i}.map.texture, vUv[${i}]).rgb, 1.0) * layerMask.r;`)
            layerCode.push(`${ws}texelDiffuse = addLayer(layer, texelDiffuse);`);
            layerCode.push("");

            Object.assign(u.map, layer.map.uniforms.map);

        });

        // debugger;

        if (needsPreamble) {
            const preamble = [
                `${wsParams}struct TextureData {`,
                `${wsParams}    sampler2D texture;`,
                `${wsParams}    vec2 size;`,
                `${wsParams}};`,
                "",
                `${wsParams}struct LayerData {`,
                `${wsParams}    TextureData map;`,
                `${wsParams}};`,
                ""
            ];

            if (needsOpacityPreamble) {
                preamble.push(
                    `${wsParams}struct MaskedLayerData {`,
                    `${wsParams}    TextureData map;`,
                    `${wsParams}    TextureData alphaMap;`,
                    `${wsParams}};`,
                    ""
                );
            }

            paramsCode.unshift(...preamble);
        }

        splitFragmentShader.splice(paramsIndex, 1, ...paramsCode);

        // debugger;

        layerIndex = splitFragmentShader.findIndex(x => x.includes(pragmaSearch))
        splitFragmentShader.splice(layerIndex, 1, ...layerCode);

        // debugger;

        const fragmentShader = splitFragmentShader.join("\n")

        // debugger;

        // info.layers.forEach((layer, i) => {
        //     if (!layer.map && !layer.alphaMap) return;

        //     defines[`USE_UV${i === 0 ? "" : `_${i + 1}`}`] = "";
        //     defines[`USE_LAYER_${i + 1}`] = "";

        //     const u = uniforms[`layer${i + 1}`].value = { map: {}, alphaMap: {} };

        //     // if (i > 0) debugger;

        //     if (layer.map) {
        //         defines[`USE_LAYER_${i + 1}_DIFFUSE`] = "";
        //         Object.assign(u.map, layer.map.uniforms.map);
        //     }

        //     if (layer.alphaMap) {
        //         // if(!layer.map) debugger;

        //         defines[`USE_LAYER_${i + 1}_OPACITY`] = "";
        //         Object.assign(u.alphaMap, layer.alphaMap.uniforms.map);
        //     }

        //     // if (layer.alphaMap) {
        //     //     defines[`USE_ALPHA_MAP${i === 0 ? "" : `${i + 1}`}`] = "";
        //     //     Object.assign(uniforms[`alphaMap${i === 0 ? "" : i + 1}`].value = {}, layer.alphaMap.uniforms);
        //     // }

        //     // if (i > 0) debugger;

        //     // if(i === 2) debugger;
        // });

        super({
            defines,
            uniforms,
            transparent: true,
            vertexShader: VERTEX_SHADER,
            fragmentShader: fragmentShader,
            side: DoubleSide
        });
    }
}

export default MeshTerrainMaterial;
export { MeshTerrainMaterial };

type MeshTerrainMaterialParameters = {
    uvs: MapData_T,
    layers: { map: IDecodedParameter, alphaMap: IDecodedParameter }[]
};