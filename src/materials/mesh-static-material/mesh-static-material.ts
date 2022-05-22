import { ShaderMaterial, Uniform, Matrix3, Color, CustomBlending, SrcAlphaFactor, OneMinusSrcAlphaFactor } from "three";

import VERTEX_SHADER from "./shader/shader-mesh-static.vs";
import FRAGMENT_SHADER from "./shader/shader-mesh-static.fs";

type SupportedShaderParams_T = "shDiffuse" | "shOpacity" | "shSpecular" | "shSpecularMask";
type ApplyParams_T = {
    name: SupportedShaderParams_T,
    parameters: IDecodedParameter,
    uniforms: { [key: string]: Uniform },
    defines: { [key: string]: any }
}

function applyParameters({ name, parameters, uniforms, defines }: ApplyParams_T): void {

    let defName;

    switch (name) {
        case "shDiffuse": defName = "DIFFUSE"; break;
        case "shOpacity": defName = "OPACITY"; break;
        case "shSpecular": defName = "SPECULAR"; break;
        case "shSpecularMask": defName = "SPECULAR_MASK"; break;
    }

    defines[`USE_${defName}`] = "";

    Object.assign(uniforms[name].value = {}, parameters.uniforms);
    Object.assign(defines, parameters.defines);

    if (parameters.isUsingMap) {
        defines["USE_UV"] = "";
        defines[`USE_MAP_${defName}`] = "";

        if (parameters.transformType !== "none") {
            defines["PAN"] = 0;
            defines["ROTATE"] = 1;
            defines[`USE_MAP_${defName}_TRANSFORM`] = parameters.transformType.toUpperCase();
        }
    }
}

class MeshStaticMaterial extends ShaderMaterial {
    // @ts-ignore
    constructor(info: MeshStaticMaterialParameters) {
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
            alphaTest: new Uniform(1e-3),
            globalTime: new Uniform(0),
            diffuse: new Uniform(new Color(1, 1, 1)),
            opacity: new Uniform(1),
            uvTransform: new Uniform(new Matrix3()),
            transformSpecular: new Uniform(null),

            shDiffuse: new Uniform(null),
            shOpacity: new Uniform(null),
            shSpecular: new Uniform(null),
            shSpecularMask: new Uniform(null)
        };

        function apply(name: SupportedShaderParams_T, parameters: IDecodedParameter) {
            if (!parameters) return;

            applyParameters({
                name,
                defines,
                uniforms,
                parameters
            });
        }

        apply("shDiffuse", info.diffuse);
        apply("shOpacity", info.opacity);
        apply("shSpecular", info.specular);
        apply("shSpecularMask", info.specularMask);

        if (info.opacity) {
            defines["USE_ALPHATEST"] = "";
        }

        // debugger;

        // debugger;

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
            visible: info.visible,
            // wireframe: true
        });

        switch (info.blendingMode) {
            case "normal":
            case "masked":
                this.blending = CustomBlending;
                this.blendSrc = SrcAlphaFactor;
                this.blendDst = OneMinusSrcAlphaFactor;
                this.alphaTest = 0;
                break;
            default: console.warn("Unknown blending mode:", info.blendingMode); break;
        }
    }
}

export default MeshStaticMaterial;
export { MeshStaticMaterial };

type MeshStaticMaterialParameters = {
    diffuse: IDecodedParameter,
    opacity: IDecodedParameter,
    specular: IDecodedParameter,
    specularMask: IDecodedParameter,
    side: THREE.Side,
    blendingMode: SupportedBlendingTypes_T,
    transparent: boolean,
    depthWrite: boolean,
    visible: boolean
};