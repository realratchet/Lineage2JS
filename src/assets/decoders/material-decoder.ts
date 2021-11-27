import MeshStaticMaterial from "@client/materials/mesh-static-material/mesh-static-material";
import _decodeTexture from "./texture-decoder";
import { Color, Vector3, DoubleSide, FrontSide } from "three";

function decodeModifier(info: IBaseMaterialModifierDecodeInfo): {
    uniforms: { [key: string]: any },
    defines: { [key: string]: any },
    isUsingMap: boolean
} {
    switch (info.modifierType) {
        case "fadeColor": {
            const [r1, g1, b1,] = (info as IFadeColorDecodeInfo).fadeColors.color1;
            const [r2, g2, b2,] = (info as IFadeColorDecodeInfo).fadeColors.color2;
            const period = (info as IFadeColorDecodeInfo).fadeColors.period;

            return {
                uniforms: {
                    fadeColors: {
                        color1: new Color(r1, g1, b1),
                        color2: new Color(r2, g2, b2),
                        period
                    }
                },
                defines: {
                    USE_UV: "",
                    USE_FADE: "",
                    USE_GLOBAL_TIME: ""
                },
                isUsingMap: false
            };
        }
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
        transparent: info.transparent,
        depthWrite: info.depthWrite,
        visible: info.visible
    });
}

function decodeTexture(info: ITextureDecodeInfo) {
    return {
        uniforms: {
            map: _decodeTexture(info)
        },
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