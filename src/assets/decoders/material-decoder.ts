import MeshStaticMaterial from "@client/materials/mesh-static-material/mesh-static-material";
import _decodeTexture from "./texture-decoder";
import { Color, DoubleSide, FrontSide, Matrix3 } from "three";
import MeshTerrainMaterial from "@client/materials/mesh-terrain-material/mesh-terrain-material";

const cacheTextures = new WeakMap<ITextureDecodeInfo, MapData_T>();

function fetchTexture(info: ITextureDecodeInfo): MapData_T {
    if (cacheTextures.has(info))
        return cacheTextures.get(info);

    const data = _decodeTexture(info);

    cacheTextures.set(info, data);

    return data;
}

function decodeFadeColorModifier(library: IDecodeLibrary, info: IFadeColorDecodeInfo): IDecodedParameter {
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

function decodeTexPannerModifer(library: IDecodeLibrary, info: ITexPannerDecodeInfo): IDecodedParameter {
    const isUsingMap = info.transform.map !== null;

    return {
        isUsingMap,
        transformType: "pan",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME: ""
        },
        uniforms: Object.assign({
            map: isUsingMap ? fetchTexture(library.materials[info.transform.map] as ITextureDecodeInfo) : null,
            transform: {
                matrix: new Matrix3().fromArray(info.transform.matrix),
                rate: info.transform.rate,
            }
        })
    };
}

function _decodeModifier(library: IDecodeLibrary, info: IBaseMaterialModifierDecodeInfo): IDecodedParameter {
    switch (info.modifierType) {
        case "fadeColor": return decodeFadeColorModifier(library, info as IFadeColorDecodeInfo);
        case "panTexture": return decodeTexPannerModifer(library, info as ITexPannerDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${info.materialType}`);
    }
}

function decodeParameter(library: IDecodeLibrary, info: IBaseMaterialDecodeInfo): IDecodedParameter {
    if (!info) return null;

    switch (info.materialType) {
        case "modifier": return _decodeModifier(library, info as IBaseMaterialModifierDecodeInfo);
        case "texture": return {
            uniforms: { map: fetchTexture(info as ITextureDecodeInfo) },
            defines: {},
            isUsingMap: true,
            transformType: "none"
        }
        default: throw new Error(`Unsupported decoder parameter: ${info.materialType}`);
    }
}

function decodeShader(library: IDecodeLibrary, info: IShaderDecodeInfo): MeshStaticMaterial {
    return new MeshStaticMaterial({
        diffuse: decodeParameter(library, library.materials[info.diffuse]),
        opacity: decodeParameter(library, library.materials[info.opacity]),
        specular: decodeParameter(library, library.materials[info.specular]),
        specularMask: decodeParameter(library, library.materials[info.specularMask]),
        side: info.doubleSide ? DoubleSide : FrontSide,
        blendingMode: info.blendingMode,
        transparent: info.transparent,
        depthWrite: info.depthWrite,
        visible: info.visible
    });
}

function decodeTexture(library: IDecodeLibrary, info: ITextureDecodeInfo): MeshStaticMaterial {
    return new MeshStaticMaterial({
        diffuse: decodeParameter(library, info),
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

function decodeModifier(library: IDecodeLibrary, info: IBaseMaterialModifierDecodeInfo): MeshStaticMaterial {
    debugger;
    throw new Error("Does this ever happen?");
}

function decodeGroup(library: IDecodeLibrary, info: IMaterialGroupDecodeInfo): MeshStaticMaterial[] {
    return info.materials.map(info => decodeMaterial(library, library.materials[info]) as MeshStaticMaterial);
}

function decodeTerrain(library: IDecodeLibrary, info: IMaterialTerrainDecodeInfo): any {
    return new MeshTerrainMaterial({
        layers: info.layers.map(map => {
            return map ? decodeParameter(library, library.materials[map]) : null
        })
    });
}

function decodeMaterial(library: IDecodeLibrary, info: IBaseMaterialDecodeInfo): MeshStaticMaterial | MeshStaticMaterial[] {
    if (!info) return null;
    switch (info.materialType) {
        case "group": return decodeGroup(library, info as IMaterialGroupDecodeInfo);
        case "shader": return decodeShader(library, info as IShaderDecodeInfo);
        case "texture": return decodeTexture(library, info as ITextureDecodeInfo);
        case "modifier": return decodeModifier(library, info as IBaseMaterialModifierDecodeInfo);
        case "terrain": return decodeTerrain(library, info as IMaterialTerrainDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${info.materialType}`);
    }
}

export default decodeMaterial;
export { decodeMaterial };