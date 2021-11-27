import { ShaderMaterial, Uniform, Matrix3, Color, Texture, MultiplyOperation, Combine, UniformsUtils, UniformsLib, ShaderLib, Side, FrontSide, Vector2, DoubleSide } from "three";

import VERTEX_SHADER from "./shader/shader-mesh-static.vs";
import FRAGMENT_SHADER from "./shader/shader-mesh-static.fs";
import decodeMaterial from "@client/assets/decoders/material-decoder";

class MeshStaticMaterial extends ShaderMaterial {
    // @ts-ignore
    constructor(info: IShaderDecodeInfo) {
        // const hasMapDiffuse = "mapDiffuse" in parameters && parameters.mapDiffuse !== null && parameters.mapDiffuse !== undefined;
        // const hasMapSpecularMask = "mapSpecularMask" in parameters && parameters.mapSpecularMask !== null && parameters.mapSpecularMask !== undefined;
        // const hasMapOpacity = "mapOpacity" in parameters && parameters.mapOpacity !== null && parameters.mapOpacity !== undefined;
        // const hasAlphaTest = "alphaTest" in parameters && parameters.alphaTest !== null && parameters.alphaTest !== undefined;
        // const hasSide = "side" in parameters && parameters.side !== null && parameters.side !== undefined;
        // const hasDepthWrite = "depthWrite" in parameters && parameters.depthWrite !== null && parameters.depthWrite !== undefined;
        // const hasTransparent = "transparent" in parameters && parameters.transparent !== null && parameters.transparent !== undefined;
        // const hasFadeColors = "fadeColors" in parameters && parameters.fadeColors !== null && parameters.fadeColors !== undefined;
        // const hasVisible = "visible" in parameters && parameters.visible !== null && parameters.visible !== undefined;
        // const hasTransformedTexture = "transformedTexture" in parameters && parameters.transformedTexture !== null && parameters.transformedTexture !== undefined;

        const defines: { [key: string]: any } = {};
        const uniforms: { [key: string]: Uniform } = {
            // mapDiffuse: new Uniform(null),
            // mapSpecular: new Uniform(null),
            // mapSpecularMask: new Uniform(null),
            // mapOpacity: new Uniform(null),
            alphaTest: new Uniform(1e-3),
            globalTime: new Uniform(0),
            diffuse: new Uniform(new Color(1, 1, 1)),
            opacity: new Uniform(1),
            uvTransform: new Uniform(new Matrix3()),
            transformSpecular: new Uniform(null),

            shDiffuse: new Uniform(null),
            shSpecular: new Uniform(null),
            shSpecularMask: new Uniform(null)
        };

        if (info.diffuse) {
            const params = info.diffuse;

            defines["USE_DIFFUSE"] = "";
            Object.assign(uniforms["shDiffuse"].value = {}, params.uniforms);
            Object.assign(defines, params.defines);
            if (params.isUsingMap) {
                defines["USE_UV"] = "";
                defines["USE_MAP_DIFFUSE"] = "";
            }
        }

        if (info.opacity) {
            debugger;
            // uniforms["mapOpacity"].value = decodeMaterial(info.opacity);
            // defines["USE_UV"] = "";
            // defines["USE_MAP_DIFFUSE"] = "";
            // defines["USE_MAP_OPACITY"] = "";
            // defines["USE_ALPHATEST"] = "";
        }

        if (info.specular) {
            // debugger;
            const params = info.specular;

            defines["USE_SPECULAR"] = "";
            Object.assign(uniforms["shSpecular"].value = {}, params.uniforms);
            Object.assign(defines, params.defines);
            if (params.isUsingMap) {
                defines["USE_UV"] = "";
                defines["USE_MAP_SPECULAR"] = "";
            }

            // debugger;
        }

        if (info.specularMask) {
            const params = info.specularMask;

            defines["USE_SPECULAR_MASK"] = "";
            Object.assign(uniforms["shSpecularMask"].value = {}, params.uniforms);
            Object.assign(defines, params.defines);
            if (params.isUsingMap) {
                defines["USE_UV"] = "";
                defines["USE_MAP_SPECULAR_MASK"] = "";
            }
        }

        debugger;

        // if (hasTransformedTexture) {
        //     defines["USE_GLOBAL_TIME"] = "";
        //     defines["USE_MAP_SPECULAR"] = "";
        //     defines["USE_TRANSFORMED_SPECULAR"] = "";

        //     if (parameters.transformedTexture.transformPan)
        //         defines["USE_SPECULAR_PAN"] = "";

        //     if (parameters.transformedTexture.transformRotate)
        //         defines["USE_SPECULAR_ROTATE"] = "";
        // }

        // if (hasMapDiffuse || hasMapSpecularMask || hasMapOpacity) {
        //     if (hasMapDiffuse) defines["USE_MAP_DIFFUSE"] = "";
        //     if (hasMapSpecularMask) {
        //         defines["USE_MAP_SPECULAR_MASK"] = "";

        //         if (hasFadeColors) {
        //             defines["USE_FADE"] = "";
        //             defines["USE_GLOBAL_TIME"] = "";
        //         }
        //     }

        //     if (hasMapOpacity) {
        //         // uniforms.diffuse.value.setHex(0xff00ff);
        //         defines["USE_MAP_OPACITY"] = "";
        //         defines["USE_ALPHATEST"] = "";
        //     }

        //     defines["USE_UV"] = "";
        // }

        super({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            defines,
            uniforms,
            side: info.side,
            transparent: info.transparent,
            depthWrite: info.depthWrite,
            visible: info.visible
        });
    }
}

export default MeshStaticMaterial;
export { MeshStaticMaterial };

type MeshStaticMaterialParameters = {
    mapDiffuse?: Texture,
    mapSpecularMask?: Texture,
    mapOpacity?: Texture,
    alphaTest?: number,
    side?: Side,
    depthWrite?: boolean,
    transparent?: boolean,
    fadeColors?: {
        color1: Color,
        color2: Color,
        period: number
    },
    visible?: boolean,
    transformedTexture?: {
        transformPan: boolean,
        transformRotate: boolean,
        texture: Texture,
        matrix: Matrix3,
        rate: number
    }
};