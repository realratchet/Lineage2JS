import { ShaderMaterial, Uniform, Color, Matrix3, FrontSide, DataTexture, RGFormat, OneFactor, OneMinusSrcAlphaFactor, CustomBlending, LinearFilter } from "three";

import VERTEX_SHADER from "./shader/shader-mesh-terrain.vs";
import FRAGMENT_SHADER from "./shader/shader-mesh-terrain.fs";
import { appendGlobalUniforms } from "../global-uniforms";
import type { IDecodedParameter } from "@l2js/engine/contracts/material";
import type { MapData_T } from "@l2js/engine/contracts/texture";

const SAMPLERS_PER_LAYER = 2;
const SAMPLERS_RESERVED = 1;

let maxTextureUnits = 16;

export function setTerrainTextureUnits(units: number) { maxTextureUnits = units; }

export class MeshTerrainMaterial extends ShaderMaterial {
    public readonly isTerrainMaterial = true;
    public readonly passes: MeshTerrainMaterial[] = [];

    public static create(info: MeshTerrainMaterialParameters): MeshTerrainMaterial {
        const layers = info.layers.map((layer, index) => ({ layer, index })).filter(({ layer }) => layer.map && layer.alphaMap);
        const perPass = Math.floor((maxTextureUnits - SAMPLERS_RESERVED) / SAMPLERS_PER_LAYER);

        if (layers.length <= perPass) return new MeshTerrainMaterial(info, layers.map(({ index }) => index), false);

        const base = new MeshTerrainMaterial(info, layers.slice(0, perPass).map(({ index }) => index), false);

        for (let start = perPass; start < layers.length; start += perPass)
            base.passes.push(new MeshTerrainMaterial(info, layers.slice(start, start + perPass).map(({ index }) => index), true));

        return base;
    }

    // @ts-ignore
    protected constructor(info: MeshTerrainMaterialParameters, layerIndices: number[], isOverlay: boolean) {
        const defines: Record<string, any> = {
            USE_FOG: "",
            USE_UV_TEXTURE: "",
            UV_COUNT: info.uvs.size.y,
            MASK_UV_INDEX: info.uvs.size.y - 1
        };

        if (isOverlay) defines.TERRAIN_OVERLAY = "";

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
        const wsParams = " ".repeat(splitFragmentShader[paramsIndex].indexOf(pragmaSearchParams));

        let layerIndex = splitFragmentShader.findIndex(x => x.includes(pragmaSearch));
        const ws = " ".repeat(splitFragmentShader[layerIndex].indexOf(pragmaSearch));

        const paramsCode: string[] = [], layerCode: string[] = [];

        let needsPreamble = false;
        let needsOpacityPreamble = false;

        let isFirst = false;

        if (isOverlay) layerCode.push(`${ws}vec3 overlayColor = vec3(0.0);`, `${ws}float overlayAlpha = 0.0;`, "");

        layerIndices.forEach(i => {
            const layer = info.layers[i];

            needsPreamble = true;

            const u = uniforms[`layer${i}`] = new Uniform({ map: {}, alphaMap: {} });

            defines[`USE_LAYER_${i}`] = "";


            needsOpacityPreamble = true;
            defines[`USE_LAYER_${i}_OPACITY`] = "";

            layerCode.push(`${ws}layerMask = texture2D(layer${i}.alphaMap.texture, vUv[MASK_UV_INDEX]);`);
            paramsCode.push(`${wsParams}uniform MaskedLayerData layer${i};`);

            Object.assign(u.value.alphaMap, layer.alphaMap.uniforms.map);
            layer.alphaMap.uniforms.map.texture.premultiplyAlpha = true;
            layer.alphaMap.uniforms.map.texture.needsUpdate = true;

            layerCode.push(`${ws}layer = vec4(texture2D(layer${i}.map.texture, vUv[${i + 1}]).rgb, layerMask.r);`)
            if (isOverlay) {
                layerCode.push(`${ws}overlayColor = layer.rgb * layer.a + overlayColor * (1.0 - layer.a);`);
                layerCode.push(`${ws}overlayAlpha = layer.a + overlayAlpha * (1.0 - layer.a);`);
            } else if (isFirst) {
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

        if (isOverlay) layerCode.push(`${ws}texelDiffuse = vec4(overlayAlpha > 0.0 ? overlayColor / overlayAlpha : vec3(0.0), overlayAlpha);`);

        splitFragmentShader.splice(paramsIndex, 1, ...paramsCode);

        layerIndex = splitFragmentShader.findIndex(x => x.includes(pragmaSearch))
        splitFragmentShader.splice(layerIndex, 1, ...layerCode);

        const fragmentShader = splitFragmentShader.join("\n")

        super({
            defines,
            uniforms,
            vertexShader: VERTEX_SHADER,
            fragmentShader: fragmentShader,
            side: FrontSide
        });

        if (isOverlay) {
            this.transparent = true;
            this.premultipliedAlpha = true; // Premultiply after fog to preserve the single-pass fog weight.
            this.depthWrite = false;
            this.blending = CustomBlending;
            this.blendSrc = OneFactor;
            this.blendDst = OneMinusSrcAlphaFactor;
        }
    }
}

export default MeshTerrainMaterial;

type MeshTerrainMaterialParameters = {
    uvs: MapData_T,
    layers: { map: IDecodedParameter, alphaMap: IDecodedParameter }[]
};
