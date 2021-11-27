import MeshStaticMaterial from "@client/materials/mesh-static-material/mesh-static-material";
import _decodeTexture from "./texture-decoder";
import { Color, Vector3, DoubleSide, FrontSide, Matrix3 } from "three";

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
            map: isUsingMap ? decodeMaterial(info.transform.map).uniforms : null,
            transform: {
                matrix: new Matrix3().fromArray(info.transform.matrix),
                rate: info.transform.rate,
            }
        })
    };
}

function decodeModifier(info: IBaseMaterialModifierDecodeInfo): IDecodedParameter {
    switch (info.modifierType) {
        case "fadeColor": return decodeFadeColorModifier(info as IFadeColorDecodeInfo);
        case "panTexture": return decodeTexPannerModifer(info as ITexPannerDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${info.materialType}`);
    }
}

function decodeShader(info: IShaderDecodeInfo) {
    return new MeshStaticMaterial({
        diffuse: info.diffuse ? decodeMaterial(info.diffuse) : null,
        opacity: info.opacity ? decodeMaterial(info.opacity) : null,
        specular: info.specular ? decodeMaterial(info.specular) : null,
        specularMask: info.specularMask ? decodeMaterial(info.specularMask) : null,
        side: info.doubleSide ? DoubleSide : FrontSide,
        blendingMode: info.blendingMode,
        transparent: info.transparent,
        depthWrite: info.depthWrite,
        visible: info.visible
    });
}

function decodeTexture(info: ITextureDecodeInfo) {
    return {
        uniforms: _decodeTexture(info),
        defines: {},
        isUsingMap: true
    };
}

function decodeMaterial(info: IBaseMaterialDecodeInfo): any {
    switch (info.materialType) {
        case "shader": return decodeShader(info as IShaderDecodeInfo);
        case "texture": return decodeTexture(info as ITextureDecodeInfo);
        case "modifier": return decodeModifier(info as IBaseMaterialModifierDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${info.materialType}`);
    }
}

export default decodeMaterial;
export { decodeMaterial };