import MeshStaticMaterial from "@client/materials/mesh-static-material/mesh-static-material";
import _decodeTexture from "./texture-decoder";
import { Color, DoubleSide, FrontSide, Matrix3, MeshBasicMaterial, Vector2, Vector3 } from "three";
import MeshTerrainMaterial from "@client/materials/mesh-terrain-material/mesh-terrain-material";
import DecodeLibrary from "../unreal/decode-library";
import ParticleMaterial from "@client/materials/particle-material";

const cacheTextures = new WeakMap<GD.ITextureDecodeInfo, GD.MapData_T>();

function fetchTexture(library: DecodeLibrary, info: GD.ITextureDecodeInfo): GD.MapData_T {
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

function decodeTexPannerModifer(library: DecodeLibrary, info: GD.ITexPannerDecodeInfo, overrideMaterial?: string): GD.IDecodedParameter {
    const materialIndex = overrideMaterial !== undefined ? overrideMaterial : info.transform.map;
    const isUsingMap = materialIndex !== null;

    if (isUsingMap && !library.materials[materialIndex!!]) {
        console.warn(`[MaterialDecoder] PanTexture map not found in library: ${materialIndex}`);
    }

    return {
        isUsingMap,
        transformType: "pan",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME: ""
        },
        uniforms: {
            map: isUsingMap ? fetchTexture(library, library.materials[materialIndex] as GD.ITextureDecodeInfo) : null,
            transform: {
                matrix: new Matrix3().fromArray(info.transform.matrix),
                rate: Array.isArray(info.transform.rate) ? new Vector2().fromArray(info.transform.rate) : info.transform.rate,
                map: materialIndex
            }
        }
    };
}

function decodeTexRotatorModifer(library: DecodeLibrary, info: GD.ITexRotatorDecodeInfo, overrideMaterial?: string): GD.IDecodedParameter {
    const materialIndex = overrideMaterial !== undefined ? overrideMaterial : info.transform.map;
    const isUsingMap = materialIndex !== null;

    return {
        isUsingMap,
        transformType: "rotate",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME: ""
        },
        uniforms: {
            map: isUsingMap ? fetchTexture(library, library.materials[materialIndex] as GD.ITextureDecodeInfo) : null,
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

function decodeTexOscillatorModifer(library: DecodeLibrary, info: GD.ITexOscillatorDecodeInfo, overrideMaterial?: string): GD.IDecodedParameter {
    const materialIndex = overrideMaterial !== undefined ? overrideMaterial : info.transform.map;
    const isUsingMap = materialIndex !== null;

    return {
        isUsingMap,
        transformType: "oscillate",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME: ""
        },
        uniforms: {
            map: isUsingMap ? fetchTexture(library, library.materials[materialIndex] as GD.ITextureDecodeInfo) : null,
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

function decodeColorModifier(library: DecodeLibrary, info: GD.IColorModifierDecodeInfo, overrideMaterial?: string): GD.IDecodedParameter {
    const materialIndex = overrideMaterial !== undefined ? overrideMaterial : info.material;
    const parameter = decodeParameter(library, library.materials[materialIndex]);
    let [r, g, b, a] = info.modifierColor;

    // Normalize if values are in 0-255 range
    if (r > 1 || g > 1 || b > 1 || a > 1) {
        r /= 255; g /= 255; b /= 255; a /= 255;
    }

    // Fix potential zero alpha issue if color is valid
    if (a === 0 && (r > 0 || g > 0 || b > 0)) {
        a = 1.0;
    }

    // Fallback: If completely zero, assume default white/opaque (fixes invisible sky)
    if (r === 0 && g === 0 && b === 0 && a === 0) {
        r = 1.0; g = 1.0; b = 1.0; a = 1.0;
    }

    if (parameter) {
        parameter.uniforms.diffuse = new Color(r, g, b);
        parameter.uniforms.opacity = a;
    }

    return parameter;
}

function _decodeModifier(library: DecodeLibrary, info: GD.IBaseMaterialModifierDecodeInfo, overrideMaterial?: string): GD.IDecodedParameter {
    let param: GD.IDecodedParameter;
    switch (info.modifierType) {
        case "fadeColor": param = decodeFadeColorModifier(library, info as GD.IFadeColorDecodeInfo); break;
        case "panTexture": param = decodeTexPannerModifer(library, info as GD.ITexPannerDecodeInfo, overrideMaterial); break;
        case "rotateTexture": param = decodeTexRotatorModifer(library, info as GD.ITexRotatorDecodeInfo, overrideMaterial); break;
        case "oscillateTexture": param = decodeTexOscillatorModifer(library, info as GD.ITexOscillatorDecodeInfo, overrideMaterial); break;
        case "envMapTexture": param = decodeTexEnvMapModifer(library, info as GD.ITexEnvMapDecodeInfo); break;
        case "colorModifier": param = decodeColorModifier(library, info as GD.IColorModifierDecodeInfo, overrideMaterial); break;
        default: throw new Error(`Unknown modifier type: ${info.modifierType}`);
    }

    if (param && param.uniforms && param.uniforms.map) {
        param.isUsingMap = true;
    }
    return param;
}

function decodeParameter(library: DecodeLibrary, info: GD.IBaseMaterialDecodeInfo): GD.IDecodedParameter {
    if (!info) return null;

    let param: GD.IDecodedParameter;

    switch (info.materialType) {
        case "sprite":
            const decodedSprites = (info as GD.IAnimatedSpriteDecodeInfo).sprites.map(info => fetchTexture(library, info));

            param = {
                uniforms: { map: decodedSprites[0] },
                sprites: decodedSprites,
                framerate: (info as GD.IAnimatedSpriteDecodeInfo).framerate,
                defines: {},
                isUsingMap: true,
                isSprite: true,
                transformType: "none"
            } as GD.IDecodedSpriteParameter;
            break;
        case "modifier": param = _decodeModifier(library, info as GD.IBaseMaterialModifierDecodeInfo); break;
        case "texture": param = {
            uniforms: { map: fetchTexture(library, info as GD.ITextureDecodeInfo) },
            defines: {},
            isUsingMap: true,
            transformType: "none"
        }; break;
        case "shader":
            // Shaders nested in modifiers (like ColorModifier) should return the diffuse parameter
            param = decodeParameter(library, library.materials[(info as GD.IShaderDecodeInfo).diffuse]); break;
        default: throw new Error(`Unsupported decoder parameter: ${info.materialType}`);
    }

    if (param && param.uniforms && param.uniforms.map) {
        param.isUsingMap = true;
    }

    return param;
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
        depthTest: true,
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
        depthTest: info.depthTest,
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
        depthTest: true,
        visible: true
    });
}

function decodeModifier(library: DecodeLibrary, info: GD.IBaseMaterialModifierDecodeInfo): MeshStaticMaterial {
    let materialIndex: string = null;

    if (info.modifierType === "colorModifier") materialIndex = (info as GD.IColorModifierDecodeInfo).material;
    else if (info.modifierType === "envMapTexture") materialIndex = (info as GD.ITexEnvMapDecodeInfo).map;
    else if (info.modifierType === "panTexture") materialIndex = (info as GD.ITexPannerDecodeInfo).transform.map;
    else if (info.modifierType === "rotateTexture") materialIndex = (info as GD.ITexRotatorDecodeInfo).transform.map;
    else if (info.modifierType === "oscillateTexture") materialIndex = (info as GD.ITexOscillatorDecodeInfo).transform.map;

    const baseMaterial = library.materials[materialIndex] as GD.IBaseMaterialDecodeInfo;
    const isShader = baseMaterial?.materialType === "shader";
    const shader = baseMaterial as GD.IShaderDecodeInfo;

    const isColorMod = info.modifierType === "colorModifier";
    const colorMod = info as GD.IColorModifierDecodeInfo;

    return new MeshStaticMaterial({
        diffuse: _decodeModifier(library, info, isShader ? shader.diffuse : materialIndex),
        opacity: isShader ? _decodeModifier(library, info, shader.opacity) : ((isColorMod && colorMod.alphaBlend) ? _decodeModifier(library, info, materialIndex) : null),
        specular: isShader ? _decodeModifier(library, info, shader.specular) : null,
        specularMask: isShader ? _decodeModifier(library, info, shader.specularMask) : null,
        side: (isColorMod && colorMod.doubleSide) ? DoubleSide : ((info as GD.IBaseMaterialDecodeInfo).color ? DoubleSide : FrontSide),
        blendingMode: shader.blendingMode ?? "normal",
        transparent: isColorMod ? colorMod.alphaBlend : (isShader ? shader.transparent : false),
        depthWrite: isShader ? shader.depthWrite : true,
        depthTest: isShader ? shader.depthTest ?? true : true,
        visible: isShader ? shader.visible : true
    });
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

function decodeLightmapped(library: DecodeLibrary, info: GD.ILightmappedDecodeInfo) {
    return (decodeMaterial(library, library.materials[info["material"]]) as MeshStaticMaterial)
        .setLightmap(fetchTexture(library, library.materials[info["lightmap"]] as GD.ITextureDecodeInfo));
}

function applyModAmbient(library: DecodeLibrary, material: MeshStaticMaterial, { color = [1, 1, 1], brightness }: GD.ILightAmbientMaterialModifier) {
    material.enableAmbient({
        vector: new Color().fromArray(color),
        brightness
    });
}

function applyModDirectional(library: DecodeLibrary, material: MeshStaticMaterial, { color = [1, 1, 1], brightness, direction }: GD.ILightDirectionalMaterialModifier) {
    material.enableDirectionalAmbient({
        vector: new Color().fromArray(color),
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

function decodeSolidColor(library: DecodeLibrary, info: GD.ISolidMaterialDecodeInfo): import("three").Material | import("three").Material[] {
    return new MeshBasicMaterial({
        color: info["solidColor"]
    });
}

function decodeEmptyMaterial(): MeshStaticMaterial {
    const material = new MeshStaticMaterial({
        diffuse: null,
        opacity: null,
        specular: null,
        specularMask: null,
        side: FrontSide,
        blendingMode: "normal",
        transparent: false,
        depthWrite: true,
        depthTest: true,
        visible: true
    });

    material.uniforms.diffuse.value.setHex(0xa3a3a3);

    return material;
}

function decodeParticleMaterial(library: DecodeLibrary, info: GD.IParticleMaterialDecodeInfo): THREE.Material | THREE.Material[] {
    const baseMaterial = library.materials[info.material];
    const { blendingMode, opacity } = info;

    function decodeTexture(library: DecodeLibrary, info: GD.ITextureDecodeInfo): any {
        return {
            name: info.name,
            type: "texture",
            map: decodeParameter(library, info),
            blendingMode,
            opacity
        };
    }

    function decodeSprite(library: DecodeLibrary, info: GD.IAnimatedSpriteDecodeInfo): any {
        return {
            name: info.name,
            type: "sprite",
            sprites: info.sprites.map(v => decodeParameter(library, v)),
            framerate: info.framerate,
            blendingMode,
            opacity
        };
    }

    function decodeMaterial(library: DecodeLibrary, info: GD.IBaseMaterialDecodeInfo): THREE.Material | THREE.Material[] {
        switch (info.materialType) {
            case "texture": return decodeTexture(library, info as GD.ITextureDecodeInfo);
            case "sprite": return decodeSprite(library, info as GD.IAnimatedSpriteDecodeInfo);
            default: throw new Error(`Unknown decodable type: ${info.materialType}`);
        }
    }

    function decodeGroup(library: DecodeLibrary, info: GD.IMaterialGroupDecodeInfo): MeshStaticMaterial[] {
        return info.materials.map(info => decodeMaterial(library, library.materials[info]) as MeshStaticMaterial);
    }

    switch (baseMaterial.materialType) {
        case "group": return decodeGroup(library, baseMaterial as GD.IMaterialGroupDecodeInfo);
        case "texture": return decodeMaterial(library, baseMaterial as GD.ITextureDecodeInfo);
        default: throw new Error(`Unknown decodable type: ${baseMaterial.materialType}`);
    }
}

function decodeMaterial(library: DecodeLibrary, info: GD.IBaseMaterialDecodeInfo): THREE.Material | THREE.Material[] {
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
        case "empty": return decodeEmptyMaterial();
        default: throw new Error(`Unknown decodable type: ${info.materialType}`);
    }


}

export default decodeMaterial;
export { decodeMaterial };

