import * as THREE from "three";

type ExtendsUObject<T> = T & C.UObject;


declare global {
    namespace L2JS {
        namespace Client {
            namespace Rendering {

            }

            namespace Assets {
                export type UPackage = import("@unreal/un-package").UPackage;
                export type UNativePackage = import("@unreal/un-package").UNativePackage;
                export type UCorePackage = import("@unreal/un-package").UCorePackage;
                export type UEnginePackage = import("@unreal/un-package").UEnginePackage;

                export type ULevel = import("@unreal/un-level").ULevel;
                export type ULevelInfo = import("@unreal/un-level-info").ULevelInfo;

                export type UModel = import("@unreal/model/un-model").UModel;
                export type UTerrainLayer = import("@unreal/un-terrain-layer").UTerrainLayer;
                export type UTerrainSector = import("@unreal/un-terrain-sector").UTerrainSector;

                export type FLeaf = import("@unreal/un-leaf").FLeaf;

                export type FVector = import("@unreal/un-vector").FVector;
                export type FCoords = import("@unreal/un-coords").FCoords;
                export type FRotator = import("@unreal/un-rotator").FRotator;
                export type FQuaternion = import("@unreal/un-quaternion").FQuaternion;
                export type FPlane = import("@unreal/un-plane").FPlane;
                export type FBox = import("@unreal/un-box").FBox;
                export type FMatrix = import("@unreal/un-matrix").FMatrix;
                export type FColor = import("@unreal/un-color").FColor;
                export type FScale = import("@unreal/un-scale").FScale;
                export type FRange = import("@unreal/un-range").FRange;
                export type FRangeVector = import("@unreal/un-range").FRangeVector;

                export type UPlatte = import("@unreal/un-palette").UPlatte;
                export type UTexture = ExtendsUObject<import("@unreal/un-texture").UTexture>;

                export type UTextureModifyInfo = import("@unreal/un-texture-modify-info").UTextureModifyInfo;
                export type FStaticLightmapTexture = import("@unreal/model/un-multilightmap-texture").FStaticLightmapTexture;

                export type NativeClientTypes_T =
                    | C.NativeTypes_T
                    | "NMovableSunLight"
                    | "NSun"
                    | "NMoon"
                    | "L2FogInfo"
                    | "L2SeamlessInfo"
                    | "L2NTimeLight"
                    | "L2NEnvLight"
                    | "SceneManager"
                    | "MovableStaticMeshActor"
                    | "Combiner"
                    | "VertexColor";

                export type USound = import("@unreal/un-sound").USound;
                export type UAmbientSoundObject = import("@unreal/un-ambient-sound").UAmbientSoundObject;

                export type UNSun = import("@unreal/un-nsun").UNSun;
                export type UNMoon = import("@unreal/un-nmoon").UNMoon;

                export type UPolys = import("@unreal/un-polys").UPolys;
                export type PolyFlags_T = import("@unreal/un-polys").PolyFlags_T;

                export type UBrush = import("@unreal/un-brush").UBrush;

                export type UMaterial = import("@unreal/un-material").UMaterial;
                export type UShader = import("@unreal/un-material").UShader;

                export type AActor = import("@unreal/un-aactor").UAActor;

                export type AInfo = import("@unreal/un-info").AInfo;
                export type FFogInfo = import("@unreal/un-fog-info").FFogInfo;
                export type FZoneInfo = import("@unreal/un-zone-info").FZoneInfo;
                export type ATerrainInfo = import("@unreal/un-terrain-info").ATerrainInfo;

                export type UEmitter = import("@unreal/un-emitter").UEmitter;

                export type UStaticMesh = import("@unreal/static-mesh/un-static-mesh").UStaticMesh;
                export type UStaticMeshActor = import("@unreal/static-mesh/un-static-mesh-actor").UStaticMeshActor;
                export type UStaticMeshInstance = import("@unreal/static-mesh/un-static-mesh-instance").UStaticMeshInstance;
                export type UStaticMeshMaterial = import("@unreal/un-material").UStaticMeshMaterial;

                export type FTIntMap = import("@unreal/un-tint-map").FTIntMap;
                export type UDecoLayer = import("@unreal/un-deco-layer").UDecoLayer;

                export type UPointRegion = import("@unreal/un-point-region").UPointRegion;

                export type UPhysicsVolume = import("@unreal/un-physics-volume").UPhysicsVolume;

                export type SupportedBlendingTypes_T = "normal" | "masked" | "modulate" | "translucent" | "invisible" | "brighten" | "darken";

                export type ULight = import("@unreal/un-light").ULight;
                export type LightEffect_T = import("@unreal/un-light").LightEffect_T;
                export type LightType_T = import("@unreal/un-light").LightType_T;
                export type UNMovableSunLight = import("@unreal/un-movable-sunlight").UNMovableSunLight;

                export type FNTimeColor = import("@unreal/un-l2env").FNTimeColor;
                export type FNTimeHSV = import("@unreal/un-l2env").FNTimeHSV;
                export type FNTimeScale = import("@unreal/un-l2env").FNTimeScale;
                export type UL2NEnvLight = import("@unreal/un-l2env").UL2NEnvLight;
                export type UL2NTimeLight = import("@unreal/un-l2env").UL2NTimeLight;
                export type UL2NEnvManager = import("@unreal/un-l2env").UL2NEnvManager;
                export type EEnvCycle = import("@unreal/un-l2env").EEnvCycle;
            }

            namespace Decoding {
                export type IndexTypedArray = Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor;
                export type IndexTypedArrayAttribute = typeof THREE.Uint8BufferAttribute | typeof THREE.Uint16BufferAttribute | typeof THREE.Uint32BufferAttribute;

                export type Vector2Arr = [number, number];
                export type Vector4Arr = [number, number, number, number];
                export type Matrix4Arr = number[] & { length: 16 };
                export type QuaternionArr = Vector4Arr;
                export type ColorArr = Vector4Arr;
                export type Vector3Arr = [number, number, number];
                export type EulerOrder = "XYZ" | "YZX" | "ZXY" | "XZY" | "YXZ" | "ZYX";
                export type EulerArr = [...Vector3Arr, EulerOrder];
                export type ArrGeometryGroup = [number, number, number];

                export type DecodeLibrary = import("@unreal/decode-library").DecodeLibrary;

                export type LoadSettings_T = {
                    env: GA.UL2NEnvManager,
                    loadTerrain?: boolean,
                    loadBaseModel?: boolean,
                    loadStaticModels?: boolean,
                    loadStaticModelList?: (number | string)[],
                    loadEmitters?: boolean,
                    helpersZoneBounds?: boolean,
                };

                export interface IInfo { getDecodeInfo(library: DecodeLibrary): IBaseZoneDecodeInfo; }

                export interface IBoxDecodeInfo { isValid: boolean, min: Vector3Arr, max: Vector3Arr }
                export interface ISphereDecodeInfo { center: Vector3Arr, radius: number }

                export interface IZoneDecodeInfo extends IBaseZoneDecodeInfo { type: "Zone" }
                export interface ISkyZoneDecodeInfo extends IBaseZoneDecodeInfo { type: "Sky" }
                export interface ISectorDecodeInfo extends IBaseZoneDecodeInfo { type: "Sector" }

                export interface IZoneFogInfo {
                    start: number,
                    end: number,
                    color: ColorArr
                }

                export type DecodableObject_T =
                    | "Group"
                    | "Level"
                    | "TerrainInfo"
                    | "TerrainSegment"
                    | "StaticMeshActor"
                    | "StaticMesh"
                    | "Model"
                    | "Light"
                    | "Sunlight"
                    | "Edges"
                    | "SkinnedMesh"
                    | "Bone"
                    | "Emitter";

                export interface IBaseObjectOrInstanceDecodeInfo {
                    uuid: string,
                    type: DecodableObject_T | "StaticMeshInstance"
                }

                export interface IBaseObjectDecodeInfo extends IBaseObjectOrInstanceDecodeInfo {
                    type: DecodableObject_T,
                    name?: string,
                    position?: Vector3Arr,
                    rotation?: EulerArr,
                    quaternion?: QuaternionArr,
                    scale?: Vector3Arr,
                    siblings?: IBaseObjectOrInstanceDecodeInfo[],
                    children?: IBaseObjectOrInstanceDecodeInfo[]
                }

                export interface IStaticMeshActorDecodeInfo extends IBaseObjectDecodeInfo {
                    actorName: string;
                    type: "StaticMeshActor",
                    instance: IStaticMeshInstanceDecodeInfo,
                    bounds: IBoxDecodeInfo,
                    scaledGlow: number
                }

                export interface IStaticMeshObjectDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "StaticMesh",
                    geometry: string,
                    materials?: string
                }

                export interface ILightInstanceDecodeInfo {
                    matrix: Matrix4Arr,
                    flags: ArrayBuffer,
                    scene: [string, number, number][],
                    environment: [string, number, number][]
                }

                export interface IStaticMeshInstanceDecodeInfo {
                    uuid?: string,
                    name?: string,
                    type: "StaticMeshInstance",
                    mesh: IStaticMeshObjectDecodeInfo,
                    lights?: ILightInstanceDecodeInfo,
                    attributes?: {
                        colors?: Float32Array
                    }
                }

                export interface IBaseZoneDecodeInfo {
                    type: "Sector" | "Zone" | "Sky",
                    uuid: string,
                    name?: string,
                    bounds: IBoxDecodeInfo,
                    children: IBaseObjectOrInstanceDecodeInfo[],
                    fog?: IZoneFogInfo
                }

                // BSP Types
                export interface IBSPNodeCollisionInfo_T {
                    flags: number[],
                    bounds: IBoxDecodeInfo
                }

                export interface IBSPNodeDecodeInfo_T {
                    children: [number, number],
                    plane: Vector4Arr,
                    leaves: [number, number],
                    zones: [number, number],
                    surfFlags: number,
                    iPlane: number,
                    iRenderBound: number,
                    spheres: {
                        exclusive: Vector4Arr,
                        inclusive: Vector4Arr
                    },
                    sectionIndex: number,
                    collision: IBSPNodeCollisionInfo_T,
                    zoneMask: bigint
                }

                export interface IBSPLeafDecodeInfo_T {
                    zone: number,
                    permiating: number,
                    volumetric: number,
                    visibleZones: bigint
                }

                export interface IBSPZoneDecodeInfo_T {
                    connectivity: bigint,
                    visibility: bigint,
                    zoneInfo: IBaseZoneDecodeInfo
                }

                // NEW: BSP Section (material + lightmap combination)
                export interface IBSPSectionDecodeInfo_T {
                    uuid: string,
                    priority: "opaque" | "transparent",
                    material: string,  // material UUID
                    lightmap: string | null,  // lightmap UUID (null if no lightmap)
                    geometry: string,  // geometry UUID
                    nodeIndices: number[]  // nodes in this section
                }

                // Material and Geometry Types
                export type DecodableTexture_T = "rgba" | "dds" | "g16" | "float";
                export type DataTextureFormats_T = "r" | "rg" | "rgb" | "rgba";
                export type DecodableMaterial_T = "modifier" | "texture" | "shader" | "group" | "terrain" | "lightmapped" | "instance" | "terrainSegment" | "sprite" | "solid" | "particle";
                export type DecodableMaterialModifier_T = "fadeColor" | "panTexture";

                export interface IBaseMaterialDecodeInfo {
                    name?: string,
                    materialType: DecodableMaterial_T,
                    color?: boolean
                }

                export interface ILightmappedDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "lightmapped",
                    material: string,
                    lightmap: string | null
                }

                export interface IMaterialGroupDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "group",
                    materials: string[]
                }

                export type IndexLikeArray = number[] | Uint8Array | Uint16Array | Uint32Array;

                export interface IGeometryDecodeInfo {
                    attributes: {
                        positions?: Float32Array;
                        normals?: Float32Array;
                        colors?: Float32Array,
                        colorsInstance?: Float32Array,
                        uvs?: Float32Array | Float32Array[];
                        uvs2?: Float32Array | Float32Array[];
                        skinIndex?: Uint8Array;
                        skinWeight?: Float32Array;
                    };
                    indices?: IndexLikeArray;
                    colliderIndices?: Uint32Array;
                    groups?: ArrGeometryGroup[],
                    bounds?: IBoxDecodeInfo
                }

                export interface IMaterialModifier {
                    type: "Lighting"
                }

                export type ParticleBlendModes_T = "normal" | "alpha" | "modulate" | "translucent" | "alphaModulate" | "darken" | "brighten";
                export type SpriteDirections_T = "camera" | "up" | "right" | "forward" | "normal" | "upNormal" | "rightNormal" | "scale";

                export type EmitterConfig_T = {
                    blendingMode: ParticleBlendModes_T,
                    maxParticles: number,
                    opacity: number,
                    lifetime: [number, number],
                    acceleration: GD.Vector3Arr,
                    particlesPerSecond: number,
                    fadeIn: Fade_T
                    fadeOut: Fade_T,
                    colorMultiplierRange: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                    initial: {
                        particlesPerSecond: number,
                        angularVelocity: { min: GD.Vector3Arr, max: GD.Vector3Arr }
                        velocity: { min: GD.Vector3Arr, max: GD.Vector3Arr }
                        position: { min: GD.Vector3Arr, max: GD.Vector3Arr }
                        scale: { min: GD.Vector3Arr, max: GD.Vector3Arr }
                    },
                    changesOverLifetime: {
                        scale: {
                            values: [number, number][],
                            repeats: number
                        }
                    }
                };

                export type Fade_T = {
                    time: number,
                    color: ColorArr
                };

                export interface IMaterialInstancedDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "instance",
                    baseMaterial: string,
                    modifiers: string[]
                }


                export interface ITextureDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "texture",
                    textureType: DecodableTexture_T,
                    buffer: ArrayBuffer,
                    wrapS?: number, wrapT?: number,
                    width: number, height: number,
                }

                export interface IEdgesObjectDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "Edges",
                    geometry: string,
                    color?: [number, number, number],
                    ignoreDepth?: boolean
                }

                export interface ILightDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "Light",
                    dynamic: boolean,
                    hsv: [number, number, number],
                    radius: number,
                    directional: boolean,
                    lightType: GA.LightType_T,
                    lightEffect: GA.LightEffect_T,
                    cone: number,
                    isSunlightColor: boolean,
                    period: number,
                    phase: number
                }

                export interface ISunLightDecodeInfo extends Omit<ILightDecodeInfo, "type"> {
                    type: "Sunlight"
                }

                export interface IShaderDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "shader",
                    diffuse: string,
                    opacity: string,
                    specular: string,
                    specularMask: string,
                    blendingMode: GA.SupportedBlendingTypes_T,
                    depthWrite: boolean,
                    doubleSide: boolean,
                    transparent: boolean,
                    alphaTest: number,
                    visible: boolean
                }

                export interface ITexPannerDecodeInfo extends IBaseMaterialModifierDecodeInfo {
                    modifierType: "panTexture",
                    transform: {
                        matrix: number[],
                        rate: number,
                        map: string
                    }
                }

                export interface IBaseMaterialModifierDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "modifier",
                    modifierType: DecodableMaterialModifier_T
                }

                export interface IFadeColorDecodeInfo extends IBaseMaterialModifierDecodeInfo {
                    modifierType: "fadeColor",
                    fadeColors: {
                        color1: number[],
                        color2: number[],
                        period: number
                    }
                }

                export interface IBoundsDecodeInfo {
                    sphere: ISphereDecodeInfo,
                    box: { min: Vector3Arr, max: Vector3Arr } | null
                }

                export type INTimeColorDecodeInfo = [number, number, number, number];
                export type INTimeHSVDecodeInfo = [number, number, number, number];
                export type INTimeScaleDecodeInfo = [number, number];
                export interface IL2NTimeLightDecodeInfo {
                    terrain: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                    actor: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                    staticMesh: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                    bsp: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] }
                }
                export interface IL2NEnvLightDecodeInfo {
                    type: GA.EEnvCycle,
                    light: IL2NTimeLightDecodeInfo,
                    color: {
                        sky: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        indexHaze: { type: "TypedArray", array: Int32Array },
                        haze: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        indexCloud: { type: "TypedArray", array: Int32Array },
                        cloud1: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        cloud2: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        cloud3: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        star: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        sun: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        moon: { type: "TimeColor", array: INTimeColorDecodeInfo[] }
                    },
                    ambient: {
                        terrain: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                        actor: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                        staticMesh: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                        bsp: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                    },
                    scale: {
                        sun: { type: "TimeScale", array: INTimeScaleDecodeInfo[] },
                        moon: { type: "TimeScale", array: INTimeScaleDecodeInfo[] }
                    }
                }
            }
        }
    }
}