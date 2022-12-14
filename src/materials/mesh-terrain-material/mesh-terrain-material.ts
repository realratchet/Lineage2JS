import { ShaderMaterial, Uniform, Color, Matrix3, DoubleSide, DataTexture, RGFormat, OneFactor, CustomBlending } from "three";

import VERTEX_SHADER from "./shader/shader-mesh-terrain.vs";
import FRAGMENT_SHADER from "./shader/shader-mesh-terrain.fs";
import { appendGlobalUniforms } from "../global-uniforms";

class MeshTerrainMaterial extends ShaderMaterial {
    // @ts-ignore
    constructor(info: MeshTerrainMaterialParameters) {
        const defines: Record<string, any> = {
            USE_FOG: "",
            USE_UV_TEXTURE: "",
            UV_COUNT: info.uvs.size.height,
            MASK_UV_INDEX: info.uvs.size.height - 1
        };

        const uniforms: Record<string, Uniform> = appendGlobalUniforms({
            alphaTest: new Uniform(1e-3),
            diffuse: new Uniform(new Color(1, 1, 1)),
            opacity: new Uniform(1),
            uvTransform: new Uniform(new Matrix3()),
            transformSpecular: new Uniform(null),
            uvs: new Uniform(info.uvs)
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

        let isFirst = false;

        info.layers.forEach((layer, i) => {
            if (!layer.map) return;

            needsPreamble = true;

            const u = uniforms[`layer${i}`] = new Uniform({ map: {}, alphaMap: {} });

            defines[`USE_LAYER_${i}`] = "";


            if (layer.alphaMap) {
                needsOpacityPreamble = true;
                defines[`USE_LAYER_${i}_OPACITY`] = "";

                layerCode.push(`${ws}layerMask = texture2D(layer${i}.alphaMap.texture, vUv[MASK_UV_INDEX]);`);
                paramsCode.push(`${wsParams}uniform MaskedLayerData layer${i};`);

                Object.assign(u.value.alphaMap, layer.alphaMap.uniforms.map);
                layer.alphaMap.uniforms.map.texture.premultiplyAlpha = true;
                layer.alphaMap.uniforms.map.texture.needsUpdate = true;
            } else {
                layerCode.push(`${ws}layerMask = vec4(1.0);`);
                paramsCode.push(`${wsParams}uniform LayerData layer${i};`);
            }

            layerCode.push(`${ws}layer = vec4(texture2D(layer${i}.map.texture, vUv[${i}]).rgb, layerMask.r);`)
            if (!isFirst) {
                layerCode.push(`${ws}texelDiffuse = addLayer(layer, texelDiffuse);`);
            } else {
                layerCode.push(`${ws}texelDiffuse = layer;`);
                isFirst = true;
            }
            layerCode.push("");

            layer.map.uniforms.map.texture.premultiplyAlpha = true;
            layer.map.uniforms.map.texture.needsUpdate = true;

            Object.assign(u.value.map, layer.map.uniforms.map);
        });

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

        layerIndex = splitFragmentShader.findIndex(x => x.includes(pragmaSearch))
        splitFragmentShader.splice(layerIndex, 1, ...layerCode);

        const fragmentShader = splitFragmentShader.join("\n")

        super({
            defines,
            uniforms,
            vertexShader: VERTEX_SHADER,
            fragmentShader: fragmentShader
        });
    }
}

export default MeshTerrainMaterial;
export { MeshTerrainMaterial };

type MeshTerrainMaterialParameters = {
    uvs: MapData_T,
    layers: { map: IDecodedParameter, alphaMap: IDecodedParameter }[]
};