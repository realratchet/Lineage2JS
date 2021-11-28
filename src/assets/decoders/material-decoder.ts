import MeshStaticMaterial from "@client/materials/mesh-static-material/mesh-static-material";
import _decodeTexture from "./texture-decoder";
import { Color, DoubleSide, FrontSide, Matrix3 } from "three";

function decodeFadeColorModifier(info: IFadeColorDecodeInfo): IDecodedParameter {
    const [r1, g1, b1,] = info.fadeColors.color1;
    const [r2, g2, b2,] = info.fadeColors.color2;
    const period = info.fadeColors.period;

    return {
        uniforms: {
            fadeColors: {
                color1: new Color(r1, g1, b1),
                color2: new Color(r2, g2, b2),
                period
            }
        },
        defines: {
            USE_FADE: "",
            USE_GLOBAL_TIME: ""
        },
        transformType: "none",
        isUsingMap: false
    };
}

function decodeTexPannerModifer(info: ITexPannerDecodeInfo): IDecodedParameter {
    const isUsingMap = info.transform.map !== null;


    return {
        isUsingMap,
        transformType: "pan",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME: ""
        },
        uniforms: Object.assign({
            map: isUsingMap ? _decodeTexture(info.transform.map) : null,
            transform: {
                matrix: new Matrix3().fromArray(info.transform.matrix),
                rate: info.transform.rate,
            }
        })
    };
}

function _decodeModifier(info: IBaseMaterialModifierDecodeInfo): IDecodedParameter {
    switch (info.modifierType) {
        case "fadeColor": return decodeFadeColorModifier(info as IFadeColorDecodeInfo);
        case "panTexture": return decodeTexPannerModifer(info as ITexPannerDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${info.materialType}`);
    }
}

function decodeParameter(info: IBaseMaterialDecodeInfo): IDecodedParameter {
    if (!info) return null;

    switch (info.materialType) {
        case "modifier": return _decodeModifier(info as IBaseMaterialModifierDecodeInfo);
        case "texture": return {
            uniforms: { map: _decodeTexture(info as ITextureDecodeInfo) },
            defines: {},
            isUsingMap: true,
            transformType: "none"
        }
        default: throw new Error(`Unsupported decoder parameter: ${info.materialType}`);
    }
}

function decodeShader(info: IShaderDecodeInfo): MeshStaticMaterial {
    return new MeshStaticMaterial({
        diffuse: decodeParameter(info.diffuse),
        opacity: decodeParameter(info.opacity),
        specular: decodeParameter(info.specular),
        specularMask: decodeParameter(info.specularMask),
        side: info.doubleSide ? DoubleSide : FrontSide,
        blendingMode: info.blendingMode,
        transparent: info.transparent || !!info.opacity,
        depthWrite: info.depthWrite,
        visible: info.visible
    });
}

function decodeTexture(info: ITextureDecodeInfo): MeshStaticMaterial {
    return new MeshStaticMaterial({
        diffuse: decodeParameter(info),
        opacity: null,
        specular: null,
        specularMask: null,
        side: DoubleSide,
        blendingMode: "normal",
        transparent: false,
        depthWrite: true,
        visible: true
    });
}

function decodeModifier(info: IBaseMaterialModifierDecodeInfo): MeshStaticMaterial {
    debugger;

    return null;
}

function decodeMaterial(info: IBaseMaterialDecodeInfo): MeshStaticMaterial {
    if (!info) return null;
    switch (info.materialType) {
        case "shader": return decodeShader(info as IShaderDecodeInfo);
        case "texture": return decodeTexture(info as ITextureDecodeInfo);
        case "modifier": return decodeModifier(info as IBaseMaterialModifierDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${info.materialType}`);
    }
}

export default decodeMaterial;
export { decodeMaterial };