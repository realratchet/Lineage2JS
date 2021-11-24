import { ShaderMaterial, Uniform, Matrix3, MeshBasicMaterialParameters, Color, Texture, MultiplyOperation, Combine, UniformsUtils, UniformsLib, ShaderLib, Side, FrontSide } from "three";

import VERTEX_SHADER from "./shader/shader-mesh-static.vs";
import FRAGMENT_SHADER from "./shader/shader-mesh-static.fs";

class MeshStaticMaterial extends ShaderMaterial {
    // @ts-ignore
    constructor(parameters: MeshStaticMaterialParameters) {
        const hasMapDiffuse = "mapDiffuse" in parameters && parameters.mapDiffuse !== null && parameters.mapDiffuse !== undefined;
        const hasMapSpecularMask = "mapSpecularMask" in parameters && parameters.mapSpecularMask !== null && parameters.mapSpecularMask !== undefined;
        const hasMapOpacity = "mapOpacity" in parameters && parameters.mapOpacity !== null && parameters.mapOpacity !== undefined;
        const hasAlphaTest = "alphaTest" in parameters && parameters.alphaTest !== null && parameters.alphaTest !== undefined;
        const hasSide = "side" in parameters && parameters.side !== null && parameters.side !== undefined;
        const hasDepthWrite = "depthWrite" in parameters && parameters.depthWrite !== null && parameters.depthWrite !== undefined;
        const hasTransparent = "transparent" in parameters && parameters.transparent !== null && parameters.transparent !== undefined;
        const hasFadeColors = "fadeColors" in parameters && parameters.fadeColors !== null && parameters.fadeColors !== undefined;
        const hasVisible = "visible" in parameters && parameters.visible !== null && parameters.visible !== undefined;
        const hasTransformedTexture = "transformedTexture" in parameters && parameters.transformedTexture !== null && parameters.transformedTexture !== undefined;

        const defines: { [key: string]: any } = {};
        const uniforms: { [key: string]: Uniform } = {
            mapDiffuse: new Uniform(hasMapDiffuse ? parameters.mapDiffuse : null),
            mapSpecularMask: new Uniform(hasMapSpecularMask ? parameters.mapSpecularMask : null),
            mapOpacity: new Uniform(hasMapOpacity ? parameters.mapOpacity : null),
            alphaTest: new Uniform((hasAlphaTest ? parameters.alphaTest : 0) + 1e-3),
            globalTime: new Uniform(0),
            fadeColors: new Uniform(hasFadeColors ? parameters.fadeColors : null),
            diffuse: new Uniform(new Color(1, 1, 1)),
            opacity: new Uniform(1),
            uvTransform: new Uniform(new Matrix3())
        };

        if(hasTransformedTexture) {
            defines["USE_GLOBAL_TIME"] = "";
            defines["USE_TRANSFORMED_TEXTURE"] = "";
        }

        if (hasMapDiffuse || hasMapSpecularMask || hasMapOpacity) {
            if (hasMapDiffuse) defines["USE_MAP_DIFFUSE"] = "";
            if (hasMapSpecularMask) {
                defines["USE_MAP_SPECULAR_MASK"] = "";

                if (hasFadeColors) {
                    defines["USE_FADE"] = "";
                    defines["USE_GLOBAL_TIME"] = "";
                }
            }

            if (hasMapOpacity) {
                // uniforms.diffuse.value.setHex(0xff00ff);
                defines["USE_MAP_OPACITY"] = "";
                defines["USE_ALPHATEST"] = "";
            }

            defines["USE_UV"] = "";
        }

        super({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            defines,
            uniforms,
            side: hasSide ? parameters.side : FrontSide,
            transparent: hasTransparent ? parameters.transparent : false,
            depthWrite: hasDepthWrite ? parameters.depthWrite : true,
            visible: hasVisible ? parameters.visible : true
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
        texture: Texture,
        matrix: Matrix3,
        rate: number
    }
};