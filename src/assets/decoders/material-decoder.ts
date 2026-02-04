import MeshStaticMaterial from "@client/materials/mesh-static-material/mesh-static-material";
import _decodeTexture from "./texture-decoder";
import { Color, DoubleSide, FrontSide, Matrix3, MeshBasicMaterial, Vector3, Vector4 } from "three";
import MeshTerrainMaterial from "@client/materials/mesh-terrain-material/mesh-terrain-material";
import DecodeLibrary from "../unreal/decode-library";
import ParticleMaterial from "@client/materials/particle-material";

const cacheTextures = new WeakMap<GD.ITextureDecodeInfo, MapData_T>();

function fetchTexture(library: DecodeLibrary, info: GD.ITextureDecodeInfo): MapData_T {
    if (cacheTextures.has(info))
        return cacheTextures.get(info);

    const data = _decodeTexture(library, info);

    cacheTextures.set(info, data);

    return data;
}

function decodeFadeColorModifier(library: DecodeLibrary, info: GD.IFadeColorDecodeInfo): GD.IDecodedParameter {
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

function decodeTexPannerModifer(library: DecodeLibrary, info: GD.ITexPannerDecodeInfo): GD.IDecodedParameter {
    const isUsingMap = info.transform.map !== null;

    return {
        isUsingMap,
        transformType: "pan",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME: ""
        },
        uniforms: Object.assign({
            map: isUsingMap ? fetchTexture(library, library.materials[info.transform.map] as GD.ITextureDecodeInfo) : null,
            transform: {
                matrix: new Matrix3().fromArray(info.transform.matrix),
                rate: info.transform.rate,
            }
        })
    };
}

function decodeTexRotatorModifer(library: DecodeLibrary, info: GD.ITexRotatorDecodeInfo): GD.IDecodedParameter {
    const isUsingMap = info.transform.map !== null;

    return {
        isUsingMap,
        transformType: "rotate",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME: ""
        },
        uniforms: {
            map: isUsingMap ? fetchTexture(library, library.materials[info.transform.map] as GD.ITextureDecodeInfo) : null,
            transform: {
                matrix: new Matrix3().fromArray(info.transform.matrix),
                rotation: [info.transform.rotation[0], info.transform.rotation[1], info.transform.rotation[2]],
                offsetU: info.transform.offsetU,
                offsetV: info.transform.offsetV,
                type: info.transform.type === "fixed" ? 0 : info.transform.type === "rotating" ? 1 : 2
            }
        }
    };
}

function decodeTexOscillatorModifer(library: DecodeLibrary, info: GD.ITexOscillatorDecodeInfo): GD.IDecodedParameter {
    const isUsingMap = info.transform.map !== null;

    return {
        isUsingMap,
        transformType: "oscillate",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME: ""
        },
        uniforms: {
            map: isUsingMap ? fetchTexture(library, library.materials[info.transform.map] as GD.ITextureDecodeInfo) : null,
            transform: {
                matrix: new Matrix3().fromArray(info.transform.matrix),
                rateU: info.transform.rateU,
                rateV: info.transform.rateV,
                phaseU: info.transform.phaseU,
                phaseV: info.transform.phaseV,
                amplitudeU: info.transform.amplitudeU,
                amplitudeV: info.transform.amplitudeV,
                typeU: info.transform.typeU === "pan" ? 0 : info.transform.typeU === "stretch" ? 1 : info.transform.typeU === "stretchRepeat" ? 2 : 3,
                typeV: info.transform.typeV === "pan" ? 0 : info.transform.typeV === "stretch" ? 1 : info.transform.typeV === "stretchRepeat" ? 2 : 3,
                offsetU: info.transform.offsetU,
                offsetV: info.transform.offsetV
            }
        }
    };
}

function decodeTexEnvMapModifer(library: DecodeLibrary, info: GD.ITexEnvMapDecodeInfo): GD.IDecodedParameter {
    const isUsingMap = info.map !== null;

    return {
        isUsingMap,
        transformType: "envMap" as any, // Not yet in transformType union
        defines: {
            USE_DIFFUSE: "",
            USE_ENVMAP: ""
        },
        uniforms: {
            map: isUsingMap ? fetchTexture(library, library.materials[info.map] as GD.ITextureDecodeInfo) : null,
            envMapType: info.envMapType
        }
    };
}

function decodeColorModifier(library: DecodeLibrary, info: GD.IColorModifierDecodeInfo): GD.IDecodedParameter {
    const parameter = decodeParameter(library, library.materials[info.material]);
    const [r, g, b, a] = info.modifierColor;

    if (parameter) {
        parameter.uniforms.modifierColor = new Vector4(r, g, b, a);
        parameter.defines.USE_COLOR_MODIFIER = "";
    }

    return parameter;
}

function _decodeModifier(library: DecodeLibrary, info: GD.IBaseMaterialModifierDecodeInfo): GD.IDecodedParameter {
    switch (info.modifierType) {
        case "fadeColor": return decodeFadeColorModifier(library, info as GD.IFadeColorDecodeInfo);
        case "panTexture": return decodeTexPannerModifer(library, info as GD.ITexPannerDecodeInfo);
        case "rotateTexture": return decodeTexRotatorModifer(library, info as GD.ITexRotatorDecodeInfo);
        case "oscillateTexture": return decodeTexOscillatorModifer(library, info as GD.ITexOscillatorDecodeInfo);
        case "envMapTexture": return decodeTexEnvMapModifer(library, info as GD.ITexEnvMapDecodeInfo);
        case "colorModifier": return decodeColorModifier(library, info as GD.IColorModifierDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${info.materialType}`);
    }
}

function decodeParameter(library: DecodeLibrary, info: GD.IBaseMaterialDecodeInfo): GD.IDecodedParameter {
    if (!info) return null;

    switch (info.materialType) {
        case "sprite":
            const decodedSprites = (info as GD.IAnimatedSpriteDecodeInfo).sprites.map(info => fetchTexture(library, info));

            return {
                uniforms: { map: decodedSprites[0] },
                sprites: decodedSprites,
                framerate: (info as GD.IAnimatedSpriteDecodeInfo).framerate,
                defines: {},
                isUsingMap: true,
                isSprite: true,
                transformType: "none"
            } as GD.IDecodedSpriteParameter;
        case "modifier": return _decodeModifier(library, info as GD.IBaseMaterialModifierDecodeInfo);
        case "texture": return {
            uniforms: { map: fetchTexture(library, info as GD.ITextureDecodeInfo) },
            defines: {},
            isUsingMap: true,
            transformType: "none"
        }
        default: throw new Error(`Unsupported decoder parameter: ${info.materialType}`);
    }
}

function decodeCombiner(library: DecodeLibrary, info: GD.ICombinerDecodeInfo): MeshStaticMaterial {
    const material1 = decodeParameter(library, library.materials[info.material1]);
    const material2 = decodeParameter(library, library.materials[info.material2]);

    return new MeshStaticMaterial({
        diffuse: material1,
        opacity: null,
        specular: decodeParameter(library, library.materials[info.mask]),
        specularMask: null,
        side: FrontSide,
        blendingMode: "normal",
        transparent: true,
        depthWrite: true,
        visible: true,
        combiner: {
            combineMode: info.combineMode,
            material1,
            material2,
            invertMask: info.invertMask,
            alphaFrom1: info.alphaFrom1,
            alphaFrom2: info.alphaFrom2
        }
    });
}

function decodeShader(library: DecodeLibrary, info: GD.IShaderDecodeInfo): MeshStaticMaterial {
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

function decodeTexture(library: DecodeLibrary, info: GD.ITextureDecodeInfo): MeshStaticMaterial {
    return new MeshStaticMaterial({
        diffuse: decodeParameter(library, info),
        opacity: null,
        specular: null,
        specularMask: null,
        side: info.twoSided ? DoubleSide : FrontSide,
        blendingMode: "normal",
        transparent: false,
        depthWrite: true,
        visible: true
    });
}

function decodeModifier(library: DecodeLibrary, info: GD.IBaseMaterialModifierDecodeInfo): MeshStaticMaterial {
    return new MeshBasicMaterial({ color: 0xff00ff }) as any;
}

function decodeGroup(library: DecodeLibrary, info: GD.IMaterialGroupDecodeInfo): MeshStaticMaterial[] {
    return info.materials.map(info => decodeMaterial(library, library.materials[info]) as MeshStaticMaterial);
}

function decodeTerrainSegment(library: DecodeLibrary, info: GD.IMaterialTerrainSegmentDecodeInfo) {
    const terrainMaterial = library.materials[info.terrainMaterial] as GD.IMaterialTerrainDecodeInfo;
    const uvs = fetchTexture(library, info.uvs);

    return new MeshTerrainMaterial({
        uvs,
        layers: terrainMaterial.layers.map(({ map, alphaMap }) => {
            return {
                map: map ? decodeParameter(library, library.materials[map]) : null,
                alphaMap: alphaMap ? decodeParameter(library, library.materials[alphaMap]) : null
            };
        })
    });
}

// function decodeTerrain(library: DecodeLibrary, info: IMaterialTerrainDecodeInfo) {
//     return new MeshTerrainMaterial({
//         layers: info.layers.map(({ map, alphaMap }) => {
//             return {
//                 map: map ? decodeParameter(library, library.materials[map]) : null,
//                 alphaMap: alphaMap ? decodeParameter(library, library.materials[alphaMap]) : null
//             };
//         })
//     });
// }

function decodeLightmapped(library: DecodeLibrary, info: ILightmappedDecodeInfo) {
    return (decodeMaterial(library, library.materials[info["material"]]) as MeshStaticMaterial)
        .setLightmap(fetchTexture(library, library.materials[info["lightmap"]] as GD.ITextureDecodeInfo));
}

function applyModAmbient(library: DecodeLibrary, material: MeshStaticMaterial, { color = [1, 1, 1], brightness }: GD.ILightAmbientMaterialModifier) {
    material.enableAmbient({
        color: new Color().fromArray(color),
        brightness
    });
}

function applyModDirectional(library: DecodeLibrary, material: MeshStaticMaterial, { color = [1, 1, 1], brightness, direction }: GD.ILightDirectionalMaterialModifier) {
    material.enableDirectionalAmbient({
        color: new Color().fromArray(color),
        direction: new Vector3().fromArray(direction),
        brightness
    });
}

function applyModLighting(library: DecodeLibrary, material: MeshStaticMaterial, modifier: GD.IBaseLightingMaterialModifier) {
    switch (modifier.mode) {
        case "Ambient": applyModAmbient(library, material, modifier as GD.ILightAmbientMaterialModifier); break;
        case "Directional": applyModDirectional(library, material, modifier as GD.ILightDirectionalMaterialModifier); break;
    }
}

function applyModifiers(library: DecodeLibrary, material: MeshStaticMaterial, modifiers: GD.IMaterialModifier[]) {
    modifiers.forEach(mod => {
        switch (mod.type) {
            case "Lighting": applyModLighting(library, material, mod as GD.IBaseLightingMaterialModifier); break;
        }
    });
}

function decodeInstancedMaterial(library: DecodeLibrary, info: GD.IMaterialInstancedDecodeInfo) {
    const materials = decodeMaterial(library, library.materials[info.baseMaterial]);
    const modifiers = info.modifiers.map(uuid => library.materialModifiers[uuid]);

    (materials instanceof Array ? materials : [materials])
        .filter(x => x)
        .forEach(material => applyModifiers(library, material as MeshStaticMaterial, modifiers));

    return materials;
}

function decodeSolidColor(library: DecodeLibrary, info: ISolidMaterialDecodeInfo): import("three").Material | import("three").Material[] {
    return new MeshBasicMaterial({
        color: info["solidColor"]
    });
}

function decodeParticleMaterial(library: DecodeLibrary, info: IParticleMaterialDecodeInfo): THREE.Material | THREE.Material[] {
    const baseMaterial = library.materials[info.material];
    const { blendingMode, opacity } = info;

    function decodeTexture(library: DecodeLibrary, info: ITextureDecodeInfo): any {
        return {
            name: info.name,
            type: "texture",
            map: decodeParameter(library, info),
            blendingMode,
            opacity
        };
    }

    function decodeSprite(library: DecodeLibrary, info: IAnimatedSpriteDecodeInfo): any {
        return {
            name: info.name,
            type: "sprite",
            sprites: info.sprites.map(v => decodeParameter(library, v)),
            framerate: info.framerate,
            blendingMode,
            opacity
        };
    }

    function decodeMaterial(library: DecodeLibrary, info: IBaseMaterialDecodeInfo): THREE.Material | THREE.Material[] {
        switch (info.materialType) {
            case "texture": return decodeTexture(library, info as GD.ITextureDecodeInfo);
            case "sprite": return decodeSprite(library, info as GD.IAnimatedSpriteDecodeInfo);
            default: throw new Error(`Unknown decodable type: ${info.materialType}`);
        }
    }

    function decodeGroup(library: DecodeLibrary, info: IMaterialGroupDecodeInfo): MeshStaticMaterial[] {
        return info.materials.map(info => decodeMaterial(library, library.materials[info]) as MeshStaticMaterial);
    }

    switch (baseMaterial.materialType) {
        case "group": return decodeGroup(library, baseMaterial as GD.IMaterialGroupDecodeInfo);
        case "texture": return decodeMaterial(library, baseMaterial as GD.ITextureDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${baseMaterial.materialType}`);
    }
}

function decodeMaterial(library: DecodeLibrary, info: GD.IBaseMaterialDecodeInfo): THREE.Material | THREE.Material[] {
    // return new MeshBasicMaterial({ color: Math.floor(Math.random() * 0xffffff) })

    if (!info) return new MeshBasicMaterial({ color: 0xff00ff });

    switch (info.materialType) {
        case "group": return decodeGroup(library, info as GD.IMaterialGroupDecodeInfo);
        case "shader": return decodeShader(library, info as GD.IShaderDecodeInfo);
        case "texture": return decodeTexture(library, info as GD.ITextureDecodeInfo);
        case "modifier": return decodeModifier(library, info as GD.IBaseMaterialModifierDecodeInfo);
        // case "terrain": return decodeTerrain(library, info as GD.IMaterialTerrainDecodeInfo);
        case "lightmapped": return decodeLightmapped(library, info as GD.ILightmappedDecodeInfo);
        case "instance": return decodeInstancedMaterial(library, info as GD.IMaterialInstancedDecodeInfo);
        case "terrainSegment": return decodeTerrainSegment(library, info as GD.IMaterialTerrainSegmentDecodeInfo);
        case "solid": return decodeSolidColor(library, info as GD.ISolidMaterialDecodeInfo);
        case "particle": return decodeParticleMaterial(library, info as GD.IParticleMaterialDecodeInfo);
        case "combiner": return decodeCombiner(library, info as GD.ICombinerDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${info.materialType}`);
    }


}

export default decodeMaterial;
export { decodeMaterial };

