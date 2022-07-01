import MeshStaticMaterial from "@client/materials/mesh-static-material/mesh-static-material";
import _decodeTexture from "./texture-decoder";
import { Color, DoubleSide, FrontSide, Matrix3, Vector3 } from "three";
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
        layers: info.layers.map(({ map, alphaMap }) => {
            return {
                map: map ? decodeParameter(library, library.materials[map]) : null,
                alphaMap: alphaMap ? decodeParameter(library, library.materials[alphaMap]) : null
            };
        })
    });
}

function decodeLightmapped(library: IDecodeLibrary, info: ILightmappedDecodeInfo) {
    return (decodeMaterial(library, library.materials[info["material"]]) as MeshStaticMaterial)
        .setLightmap(fetchTexture(library.materials[info["lightmap"]] as ITextureDecodeInfo));
}

function applyModAmbient(library: IDecodeLibrary, material: MeshStaticMaterial, { color = [1, 1, 1], brightness }: ILightAmbientMaterialModifier) {
    material.enableAmbient({
        color: new Color().fromArray(color),
        brightness
    });
}

function applyModDirectional(library: IDecodeLibrary, material: MeshStaticMaterial, { color = [1, 1, 1], direction, brightness }: ILightDirectionalMaterialModifier) {
    material.enableDirectionalAmbient({
        color: new Color().fromArray(color),
        direction: new Vector3().fromArray(direction),
        brightness
    });
}

function applyModLighting(library: IDecodeLibrary, material: MeshStaticMaterial, modifier: IBaseLightingMaterialModifier) {
    switch (modifier.lightType) {
        case "Ambient": applyModAmbient(library, material, modifier as ILightAmbientMaterialModifier); break;
        case "Directional": applyModDirectional(library, material, modifier as ILightDirectionalMaterialModifier); break;
        default: throw new Error(`Unknown modifier type: ${modifier.type}`);
    }
}

function applyModifiers(library: IDecodeLibrary, material: MeshStaticMaterial, modifiers: IMaterialModifier[]) {
    modifiers.forEach(mod => {
        switch (mod.type) {
            case "Lighting": applyModLighting(library, material, mod as IBaseLightingMaterialModifier); break;
            default: throw new Error(`Unknown modifier type: ${mod.type}`);
        }
    });
}

function decodeInstancedMaterial(library: IDecodeLibrary, info: IMaterialInstancedDecodeInfo) {
    const materials = decodeMaterial(library, library.materials[info.baseMaterial]);
    const modifiers = info.modifiers.map(uuid => library.materialModifiers[uuid]);

    (materials instanceof Array ? materials : [materials])
        .filter(x => x)
        .forEach(material => applyModifiers(library, material, modifiers));

    return materials;
}

function decodeMaterial(library: IDecodeLibrary, info: IBaseMaterialDecodeInfo): MeshStaticMaterial | MeshStaticMaterial[] {
    if (!info) return null;
    switch (info.materialType) {
        case "group": return decodeGroup(library, info as IMaterialGroupDecodeInfo);
        case "shader": return decodeShader(library, info as IShaderDecodeInfo);
        case "texture": return decodeTexture(library, info as ITextureDecodeInfo);
        case "modifier": return decodeModifier(library, info as IBaseMaterialModifierDecodeInfo);
        case "terrain": return decodeTerrain(library, info as IMaterialTerrainDecodeInfo);
        case "lightmapped": return decodeLightmapped(library, info as ILightmappedDecodeInfo);
        case "instance": return decodeInstancedMaterial(library, info as IMaterialInstancedDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${info.materialType}`);
    }
}

export default decodeMaterial;
export { decodeMaterial };