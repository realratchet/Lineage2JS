import MeshStaticMaterial from "@client/materials/mesh-static-material/mesh-static-material";
import _decodeTexture from "./texture-decoder";
import { Color, DoubleSide, FrontSide, Matrix3, MeshBasicMaterial, Vector2, Vector3, DataTexture, RGBAFormat } from "three";
import MeshTerrainMaterial from "@client/materials/mesh-terrain-material/mesh-terrain-material";
import DecodeLibrary from "../unreal/decode-library";
import { buildTransformStage } from "@client/materials/mesh-static-material/transform-stage";

const cacheTextures = new WeakMap<GD.ITextureDecodeInfo, GD.MapData_T>();
type WeakCacheEntry_T<T extends object> = { deref(): T | undefined };
const WeakRefConstructor = (globalThis as any).WeakRef;

function getWeakCacheValue<T extends object>(cache: Map<string, WeakCacheEntry_T<T>>, key: string): T | undefined {
    const value = cache.get(key)?.deref();

    if (!value) cache.delete(key);
    return value;
}

function setWeakCacheValue<T extends object>(cache: Map<string, WeakCacheEntry_T<T>>, key: string, value: T): void {
    cache.set(key, WeakRefConstructor ? new WeakRefConstructor(value) : { deref: () => value });
}

const cacheTexturesByName = new Map<string, WeakCacheEntry_T<GD.MapData_T>>();

// static meshes reuse one material instance per (info, vertexColors, instanced) combo,
// per-section duplicates otherwise dominate the draw loop with redundant uniform uploads
const cacheStaticMaterials = new WeakMap<GD.IBaseMaterialDecodeInfo, Map<string, THREE.Material | THREE.Material[]>>();
const cacheStaticMaterialsByName = new Map<string, WeakCacheEntry_T<Map<string, THREE.Material | THREE.Material[]>>>();
const canonicalStaticMaterials = new Map<string, WeakCacheEntry_T<THREE.Material>>();
const dynamicUniformNames = new Set([
    "ambientLightColor", "cameraBillboardRight", "cameraBillboardUp", "directionalLights",
    "directionalLightShadows", "fogColor", "fogDensity", "fogFar", "fogNear", "globalTimeSeconds",
    "hemisphereLights", "ltc_1", "ltc_2", "pointLights", "pointLightShadows", "rectAreaLights",
    "spotLights", "spotLightShadows"
]);

function serializeMaterialValue(value: any, seen: WeakSet<object>): any {
    if (value === null || value === undefined || typeof value !== "object") return value;
    if (value.isTexture) return `texture:${value.uuid}`;
    if (value.isColor) return [value.r, value.g, value.b];
    if (value.isVector2) return [value.x, value.y];
    if (value.isVector3) return [value.x, value.y, value.z];
    if (value.isVector4) return [value.x, value.y, value.z, value.w];
    if (value.isMatrix3 || value.isMatrix4) return value.elements;
    if (ArrayBuffer.isView(value)) return `${value.constructor.name}:${value.byteLength}`;
    if (seen.has(value)) return null;

    seen.add(value);

    if (Array.isArray(value)) return value.map(entry => serializeMaterialValue(entry, seen));

    const result: Record<string, any> = {};

    Object.keys(value).sort().forEach(key => {
        result[key] = serializeMaterialValue(value[key], seen);
    });

    return result;
}

function getCanonicalStaticMaterialKey(material: any): string {
    const uniforms: Record<string, any> = {};

    Object.keys(material.uniforms || {}).sort().forEach(name => {
        if (!dynamicUniformNames.has(name))
            uniforms[name] = serializeMaterialValue(material.uniforms[name].value, new WeakSet());
    });

    return JSON.stringify({
        name: material.name,
        defines: material.defines,
        uniforms,
        sprites: serializeMaterialValue(material.sprites, new WeakSet()),
        vertexColors: material.vertexColors,
        side: material.side,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
        depthTest: material.depthTest,
        blending: material.blending,
        blendSrc: material.blendSrc,
        blendDst: material.blendDst,
        blendEquation: material.blendEquation,
        premultipliedAlpha: material.premultipliedAlpha
    });
}

function canonicalizeStaticMeshMaterials(materials: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
    const source = materials instanceof Array ? materials : [materials];
    const canonical = source.map(material => {
        if (!(material as any)?.isStaticMeshMaterial) return material;

        const key = getCanonicalStaticMaterialKey(material);
        const cached = getWeakCacheValue(canonicalStaticMaterials, key);

        if (cached) return cached;

        setWeakCacheValue(canonicalStaticMaterials, key, material);
        return material;
    });

    return materials instanceof Array ? canonical : canonical[0];
}

function decodeStaticMeshMaterial(library: DecodeLibrary, info: GD.IBaseMaterialDecodeInfo, vertexColors: boolean, instanced: boolean, sway: boolean, terrainDecoration: boolean = false): THREE.Material | THREE.Material[] {
    if (!info) return null;

    const name = info.name;
    let variants = name ? getWeakCacheValue(cacheStaticMaterialsByName, name) : cacheStaticMaterials.get(info);

    if (!variants) {
        variants = new Map();
        cacheStaticMaterials.set(info, variants);
        if (name) setWeakCacheValue(cacheStaticMaterialsByName, name, variants);
    }

    const key = (vertexColors ? "v" : "") + (instanced ? "i" : "") + (sway ? "s" : "") + (terrainDecoration ? "d" : "");

    if (variants.has(key)) return variants.get(key);

    const materials = decodeMaterial(library, info);

    (materials instanceof Array ? materials : [materials]).forEach((mat: any) => {
        if (!mat) return;
        if (instanced) mat.setInstanced?.();
        if (sway) mat.setSway?.();
        if (terrainDecoration) mat.setTerrainDecoration?.();
        if (vertexColors) mat.vertexColors = true;
    });

    variants.set(key, materials);

    return materials;
}

let emptyMapData: GD.MapData_T;

function fetchTexture(library: DecodeLibrary, info: GD.ITextureDecodeInfo): GD.MapData_T {
    const name = info?.name;
    const namedTexture = name ? getWeakCacheValue(cacheTexturesByName, name) : undefined;

    if (namedTexture) return namedTexture;

    if (cacheTextures.has(info))
        return cacheTextures.get(info);

    if (!emptyMapData) {
        emptyMapData = {
            texture: new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat),
            size: new Vector2(1, 1)
        };
        emptyMapData.texture.name = "EmptyTexture";
        emptyMapData.texture.needsUpdate = true;
    }

    const data = (info as any).materialType !== "empty" ? _decodeTexture(library, info) : emptyMapData;

    cacheTextures.set(info, data);
    if (name) setWeakCacheValue(cacheTexturesByName, name, data);

    return data;
}

function fetchMapTexture(library: DecodeLibrary, info: GD.IBaseMaterialDecodeInfo): GD.MapData_T {
    if (!info || info.materialType === "empty") return fetchTexture(library, info as GD.ITextureDecodeInfo);
    return decodeParameter(library, info)?.uniforms?.map ?? null;
}

function fetchTransformedMap(library: DecodeLibrary, materialIndex: string | null): { map: GD.MapData_T | null, innerTransforms: any[] } {
    if (materialIndex === null) return { map: null, innerTransforms: [] };

    const info = library.materials[materialIndex] as GD.IBaseMaterialDecodeInfo;
    if (!info || info.materialType === "empty") return { map: fetchMapTexture(library, info), innerTransforms: [] };

    const decoded = decodeParameter(library, info);
    if (!decoded) return { map: null, innerTransforms: [] };

    const nestedTransforms = decoded.uniforms.innerTransforms ?? [];

    // Env maps replace the coordinate source and carry no transform matrix.
    if (decoded.transformType === "none" || decoded.transformType === "envMap" || decoded.transformType === "envMapWorld")
        return { map: decoded.uniforms.map, innerTransforms: nestedTransforms };

    return {
        map: decoded.uniforms.map,
        innerTransforms: [...nestedTransforms, buildTransformStage(decoded.transformType as "pan" | "rotate" | "oscillate", decoded.uniforms.transform)]
    };
}

function decodeFadeColorModifier(library: DecodeLibrary, info: GD.IFadeColorDecodeInfo): GD.IDecodedParameter {
    const [r1, g1, b1,] = info.fadeColors.color1;
    const [r2, g2, b2,] = info.fadeColors.color2;
    const period = info.fadeColors.period;
    const phase = info.fadeColors.phase ?? 0;
    const fadeType = info.fadeColors.fadeType === "sinusoidal" ? 1 : 0;

    return {
        uniforms: {
            fadeColors: {
                color1: new Color(r1, g1, b1),
                color2: new Color(r2, g2, b2),
                period,
                phase,
                fadeType
            }
        },
        defines: {
            USE_FADE: "",
            USE_GLOBAL_TIME_SECONDS: ""
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

    const resolved = isUsingMap ? fetchTransformedMap(library, materialIndex) : { map: null, innerTransforms: [] };

    return {
        isUsingMap,
        transformType: "pan",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME_SECONDS: ""
        },
        uniforms: {
            map: resolved.map,
            transform: {
                matrix: new Matrix3().fromArray(info.transform.matrix),
                rate: Array.isArray(info.transform.rate) ? new Vector2().fromArray(info.transform.rate) : info.transform.rate,
                map: materialIndex
            },
            innerTransforms: resolved.innerTransforms,
            numInnerTransforms: resolved.innerTransforms.length
        }
    };
}

function decodeTexRotatorModifer(library: DecodeLibrary, info: GD.ITexRotatorDecodeInfo, overrideMaterial?: string): GD.IDecodedParameter {
    const materialIndex = overrideMaterial !== undefined ? overrideMaterial : info.transform.map;
    const isUsingMap = materialIndex !== null;

    const resolved = isUsingMap ? fetchTransformedMap(library, materialIndex) : { map: null, innerTransforms: [] };

    return {
        isUsingMap,
        transformType: "rotate",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME_SECONDS: ""
        },
        uniforms: {
            map: resolved.map,
            transform: {
                matrix: new Matrix3().fromArray(info.transform.matrix),
                rotation: [info.transform.rotation[0], info.transform.rotation[1], info.transform.rotation[2]],
                offsetU: info.transform.offsetU,
                offsetV: info.transform.offsetV,
                type: info.transform.type === "fixed" ? 0 : info.transform.type === "rotating" ? 1 : 2,
                oscillationRate: info.transform.oscillationRate,
                oscillationAmplitude: info.transform.oscillationAmplitude,
                oscillationPhase: info.transform.oscillationPhase
            },
            innerTransforms: resolved.innerTransforms,
            numInnerTransforms: resolved.innerTransforms.length
        }
    };
}

function decodeTexOscillatorModifer(library: DecodeLibrary, info: GD.ITexOscillatorDecodeInfo, overrideMaterial?: string): GD.IDecodedParameter {
    const materialIndex = overrideMaterial !== undefined ? overrideMaterial : info.transform.map;
    const isUsingMap = materialIndex !== null;

    const resolved = isUsingMap ? fetchTransformedMap(library, materialIndex) : { map: null, innerTransforms: [] };

    return {
        isUsingMap,
        transformType: "oscillate",
        defines: {
            USE_DIFFUSE: "",
            USE_GLOBAL_TIME_SECONDS: ""
        },
        uniforms: {
            map: resolved.map,
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
            },
            innerTransforms: resolved.innerTransforms,
            numInnerTransforms: resolved.innerTransforms.length
        }
    };
}

function decodeTexEnvMapModifer(library: DecodeLibrary, info: GD.ITexEnvMapDecodeInfo): GD.IDecodedParameter {
    const isUsingMap = info.map !== null;

    return {
        isUsingMap,
        // UTexEnvMap::GetMatrix 0x879c90 only selects world/camera reflection coordinates.
        transformType: info.envMapType === "world" ? "envMapWorld" : "envMap",
        defines: {
            USE_DIFFUSE: "",
            USE_ENVMAP: ""
        },
        uniforms: {
            map: isUsingMap ? fetchMapTexture(library, library.materials[info.map]) : null
        }
    };
}

function decodeFinalBlendModifier(library: DecodeLibrary, info: GD.IFinalBlendDecodeInfo, overrideMaterial?: string): GD.IDecodedParameter {
    const materialIndex = overrideMaterial !== undefined ? overrideMaterial : info.material;
    return decodeParameter(library, library.materials[materialIndex]);
}

// three.js only exposes vUv/vUv2 - anything past channel 1 isn't supported
function decodeTexCoordSourceModifier(library: DecodeLibrary, info: GD.ITexCoordSourceDecodeInfo): GD.IDecodedParameter {
    const parameter = decodeParameter(library, library.materials[info.material]);

    if (!parameter) return parameter;

    if (info.uvIndex !== 0 && info.uvIndex !== 1) {
        debugger;
        throw new Error(`Unsupported texture coordinate channel: ${info.uvIndex}`);
    }

    parameter.uvIndex = info.uvIndex;

    return parameter;
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
        case "finalBlend": param = decodeFinalBlendModifier(library, info as GD.IFinalBlendDecodeInfo, overrideMaterial); break;
        case "texCoordSource": param = decodeTexCoordSourceModifier(library, info as GD.ITexCoordSourceDecodeInfo); break;
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
        case "combiner":
            // Combiners nested in a single map slot can't run their own blend - approximate with material1
            param = decodeParameter(library, library.materials[(info as GD.ICombinerDecodeInfo).material1]); break;
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
    // D3DTSS_COLOROP = D3DTOP_BLENDCURRENTALPHA (L2.dusk_and_dawn.trace call 9416187, TextureStageState2)
    const useSelfIllumination = !info.specular && !!info.selfIllumination && !!info.selfIlluminationMask;

    return new MeshStaticMaterial({
        diffuse: decodeParameter(library, library.materials[info.diffuse]),
        opacity: decodeParameter(library, library.materials[info.opacity]),
        specular: decodeParameter(library, library.materials[useSelfIllumination ? info.selfIllumination : info.specular]),
        specularMask: decodeParameter(library, library.materials[useSelfIllumination ? info.selfIlluminationMask : info.specularMask]),
        side: info.doubleSide ? DoubleSide : FrontSide,
        blendingMode: info.blendingMode,
        transparent: info.transparent,
        alphaTest: info.transparent && info.alphaTest === 0 ? 1e-6 : info.alphaTest,
        depthWrite: info.depthWrite,
        depthTest: info.depthTest,
        visible: info.visible,
        modulateStaticLighting2X: info.modulateStaticLighting2X,
        selfIllumination: useSelfIllumination
    });
}

function decodeTexture(library: DecodeLibrary, info: GD.ITextureDecodeInfo): MeshStaticMaterial {
    const isMasked = info.isMasked;
    const isAlpha = info.isAlphaTexture;

    return new MeshStaticMaterial({
        diffuse: decodeParameter(library, info),
        opacity: null,
        specular: null,
        specularMask: null,
        side: info.twoSided ? DoubleSide : FrontSide,
        blendingMode: isMasked ? "masked" : "normal",
        transparent: isMasked || isAlpha,
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
    else if (info.modifierType === "finalBlend") materialIndex = (info as GD.IFinalBlendDecodeInfo).material;

    const baseMaterial = library.materials[materialIndex] as GD.IBaseMaterialDecodeInfo;
    const isShader = baseMaterial?.materialType === "shader";
    const shader = baseMaterial as GD.IShaderDecodeInfo;

    const isColorMod = info.modifierType === "colorModifier";
    const colorMod = info as GD.IColorModifierDecodeInfo;

    const isFinalBlend = info.modifierType === "finalBlend";
    const finalBlend = info as GD.IFinalBlendDecodeInfo;

    return new MeshStaticMaterial({
        diffuse: _decodeModifier(library, info, isShader ? shader.diffuse : materialIndex),
        opacity: isShader ? _decodeModifier(library, info, shader.opacity) : ((isColorMod && colorMod.alphaBlend) ? _decodeModifier(library, info, materialIndex) : null),
        specular: isShader ? _decodeModifier(library, info, shader.specular) : null,
        specularMask: isShader ? _decodeModifier(library, info, shader.specularMask) : null,
        side: (isColorMod && colorMod.doubleSide) ? DoubleSide : (isFinalBlend ? (finalBlend.doubleSide ? DoubleSide : FrontSide) : ((info as GD.IBaseMaterialDecodeInfo).color ? DoubleSide : FrontSide)),
        blendingMode: isFinalBlend ? finalBlend.blendingMode : (isShader ? shader.blendingMode ?? "normal" : "normal"),
        transparent: isFinalBlend ? finalBlend.transparent : (isColorMod ? colorMod.alphaBlend : (isShader ? shader.transparent : false)),
        depthWrite: isFinalBlend ? finalBlend.depthWrite : (isShader ? shader.depthWrite : true),
        depthTest: isFinalBlend ? finalBlend.depthTest : (isShader ? shader.depthTest ?? true : true),
        modifyFramebufferBlending: isFinalBlend,
        visible: isShader ? shader.visible : true,
        alphaTest: isFinalBlend ? (finalBlend.alphaTest ? finalBlend.alphaRef : 0) : (isShader ? shader.alphaTest : 0)
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
    const baseMaterial = info.material ? library.materials[info.material] : null;
    const { blendingMode, opacity } = info;

    // particle materials are plain init-settings objects, the empty fallback must match that shape
    function decodeEmpty(): any {
        return { name: "empty", type: "texture", map: null, blendingMode, opacity };
    }

    if (!info.material) return decodeEmpty();
    if (!baseMaterial) throw new Error(`Particle material '${info.material}' not found`);

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
        if (!info) return decodeEmpty();

        switch (info.materialType) {
            case "texture": return decodeTexture(library, info as GD.ITextureDecodeInfo);
            case "sprite": return decodeSprite(library, info as GD.IAnimatedSpriteDecodeInfo);
            case "empty": return decodeEmpty();
            // particles can't render full shaders, approximate with the shader's diffuse map
            case "shader": {
                const shader = info as GD.IShaderDecodeInfo;
                return decodeMaterial(library, shader.diffuse ? library.materials[shader.diffuse] : null);
            }
            default: throw new Error(`Unknown decodable type: ${info.materialType}`);
        }
    }

    function decodeGroup(library: DecodeLibrary, info: GD.IMaterialGroupDecodeInfo): MeshStaticMaterial[] {
        return info.materials.map(info => decodeMaterial(library, library.materials[info]) as MeshStaticMaterial);
    }

    switch (baseMaterial.materialType) {
        case "group": return decodeGroup(library, baseMaterial as GD.IMaterialGroupDecodeInfo);
        default: return decodeMaterial(library, baseMaterial);
    }
}

function decodeMaterial(library: DecodeLibrary, info: GD.IBaseMaterialDecodeInfo): THREE.Material | THREE.Material[] {
    if (!info) {
        console.warn("Undefined material used!");
        return new MeshBasicMaterial({ color: 0xff00ff });
    }

    const material = ((): THREE.Material | THREE.Material[] => {
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
    })();

    if (info.name && material) {
        if (Array.isArray(material)) {
            material.forEach(m => { if (m && !m.name) m.name = info.name; });
        } else {
            material.name = info.name;
        }
    }

    return material;
}

export default decodeMaterial;
export { canonicalizeStaticMeshMaterials, decodeMaterial, decodeStaticMeshMaterial };
