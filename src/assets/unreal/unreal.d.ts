type DecodeLibrary = import("./decode-library").DecodeLibrary;
type UPackage = import("./un-package").UPackage;
type BufferValue<T extends ValueTypeNames_T = ValueTypeNames_T> = import("../buffer-value").BufferValue;
type UHeader = import("./un-header").UHeader;
type UGeneration = import("./un-generation").UGeneration;
type UExport<T extends UObject = UObject> = import("./un-export").UExport;
type UName = import("./un-name").UName;
type UImport = import("./un-import").UImport;
type UTexture = import("./un-texture").UTexture;
type UCubemap = import("./un-cubemap").UCubemap;
type UTextureModifyInfo = import("./un-texture-modify-info").UTextureModifyInfo;
type UObject = import("./un-object").UObject;
type UClass = import("./un-class").UClass;
type UField = import("./un-field").UField;
type UEnum = import("./un-enum").UEnum;
type UProperty = import("./un-properties").UProperty;
type UStruct = import("./un-struct").UStruct;
type UPlatte = import("./un-palette").UPlatte;
type UStaticMesh = import("./static-mesh/un-static-mesh").UStaticMesh;
type ULevelInfo = import("./un-level-info").ULevelInfo;
type UTerrainSector = import("./un-terrain-sector").UTerrainSector;
type UTerrainLayer = import("./un-terrain-layer").UTerrainLayer
type UZoneInfo = import("./un-zone-info").UZoneInfo;
type UPhysicsVolume = import("./un-physics-volume").UPhysicsVolume;
type USkyZoneInfo = import("./un-sky-zone-info").USkyZoneInfo;
type UModel = import("./model/un-model").UModel;
type UPolys = import("./un-polys").UPolys;
type PolyFlags_T = import("./un-polys").PolyFlags_T;
type UBrush = import("./un-brush").UBrush;
type ULevel = import("./un-level").ULevel;
type UAmbientSoundObject = import("./un-ambient-sound").UAmbientSoundObject;
type USound = import("./un-sound").USound;
type ULight = import("./un-light").ULight;
type UTerrainInfo = import("./un-terrain-info").UTerrainInfo;
type UNMovableSunLight = import("./un-movable-sunlight").UNMovableSunLight;
type UStaticMeshActor = import("./static-mesh/un-static-mesh-actor").UStaticMeshActor;
type UWaterVolume = import("./un-water-volume").UWaterVolume;
type UEmitter = import("./un-emitter").UEmitter;
type UFont = import("./un-font").UFont;
type UNSun = import("./un-nsun").UNSun;
type UNMoon = import("./un-nmoon").UNMoon;
type UFogInfo = import("./un-fog-info").UFogInfo;
type UPlayerStart = import("./un-player-start").UPlayerStart;
type UMusicVolume = import("./un-music-volume").UMusicVolume;
type UMover = import("./un-mover").UMover;
type UBlockingVolume = import("./un-blocking-volume").UBlockingVolume;
type UCamera = import("./un-camera").UCamera;
type UStaticMeshInstance = import("./static-mesh/un-static-mesh-instance").UStaticMeshInstance;
type ULevelSummary = import("./un-level-summary").ULevelSummary;
type UDefaultPhysicsVolume = import("./un-physics").UDefaultPhysicsVolume;
type UEncodedFile = import("./un-encoded-file").UEncodedFile;
type UTextBuffer = import("./un-text-buffer").UTextBuffer;
type USkeletalMesh = import("./skeletal-mesh/un-skeletal-mesh").USkeletalMesh;
type UMeshAnimation = import("./skeletal-mesh/un-mesh-animation").UMeshAnimation;

type UMaterial = import("./un-material").UMaterial;
type FStaticMeshMaterial = import("./un-material").FStaticMeshMaterial;
type OutputBlending_T = import("./un-material").OutputBlending_T;

type UShader = import("./un-material").UShader;
type UFadeColor = import("./un-material").UFadeColor;
type UTexRotator = import("./un-material").UTexRotator;
type UTexPanner = import("./un-material").UTexPanner;
type UColorModifier = import("./un-material").UColorModifier;
type UTexOscillator = import("./un-material").UTexOscillator;
type UTexEnvMap = import("./un-material").UTexEnvMap;
type URangeVector = import("./un-range").URangeVector;
type URange = import("./un-range").URange;
type FPlane = import("./un-plane").FPlane;
type FScale = import("./un-scale").FScale;
type UPlane = import("./un-plane").UPlane;

type PropertyTag = import("./un-property-tag").PropertyTag;
type FColor = import("./un-color").FColor;
type UMatrix = import("./un-matrix").UMatrix;
type FMatrix = import("./un-matrix").FMatrix;
type UPointRegion = import("./un-point-region").UPointRegion;
type FVector = import("./un-vector").FVector;
type FQuaternion = import("./un-quaternion").FQuaternion;
type FRotator = import("./un-rotator").FRotator;
type FCoords = import("./un-coords").FCoords;

type FMipmap = import("./un-mipmap").FMipmap;
type UDecoLayer = import("./un-deco-layer").UDecoLayer;
type FUnknownStruct = import("./un-unknown-struct").FUnknownStruct;
type FBSPNode = import("./bsp/un-bsp-node").FBSPNode;
type FBSPSurf = import("./bsp/un-bsp-surf").FBSPSurf;
type FVert = import("./model/un-vert").FVert;
type FBox = import("./un-box").FBox;

type FMultiLightmapTexture = import("./model/un-multilightmap-texture").FMultiLightmapTexture;
type FStaticLightmapTexture = import("./model/un-multilightmap-texture").FStaticLightmapTexture;

type ETextureFormat = import("./un-tex-format").ETextureFormat;
type ETexturePixelFormat = import("./un-tex-format").ETexturePixelFormat;

type DecodableTexture_T = "rgba" | "dds" | "g16" | "float";
type DecodableMaterial_T = "modifier" | "texture" | "shader" | "group" | "terrain" | "lightmapped" | "instance" | "terrainSegment" | "sprite" | "solid";
type DecodableMaterialModifier_T = "fadeColor" | "panTexture";
interface IBaseMaterialDecodeInfo { name?: string, materialType: DecodableMaterial_T, color?: boolean }
interface IBaseMaterialModifierDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "modifier",
    modifierType: DecodableMaterialModifier_T
}

interface ISolidMaterialDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "solid",
    solidColor: number
}

interface IBSPLeafDecodeInfo_T {
    zone: number,
    permiating: number,
    volumetric: number,
    visibleZones: bigint
}

interface IBSPZoneDecodeInfo_T {
    connectivity: bigint,
    visibility: bigint,
    zoneInfo: IBaseZoneDecodeInfo
}

interface IBSPNodeCollisionInfo_T {
    flags: number[],
    bounds: IBoxDecodeInfo
}

interface IBSPNodeDecodeInfo_T {
    children: [number, number],
    plane: Vector4Arr,
    leaves: [number, number],
    zones: [number, number],
    collision?: IBSPNodeCollisionInfo_T
}

interface IAnimatedSpriteDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "sprite",
    sprites: ITextureDecodeInfo[],
    framerate: number
}

interface IMaterialTerrainSegmentDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "terrainSegment";
    terrainMaterial: string,
    uvs: IDataTextureDecodeInfo
}

interface IMaterialTerrainDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "terrain";
    layers: { map: string, alphaMap: string }[]
}

interface IMaterialInstancedDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "instance",
    baseMaterial: string,
    modifiers: string[]
}

interface ITextureDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "texture",
    textureType: DecodableTexture_T,
    buffer: ArrayBuffer,
    wrapS?: number, wrapT?: number,
    width: number, height: number,
}

type DataTextureFormats_T = "r" | "rg" | "rgb" | "rgba";
interface IDataTextureDecodeInfo extends ITextureDecodeInfo { format?: DataTextureFormats_T }

interface IMaterialGroupDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "group",
    materials: string[]
}

interface ILightmappedDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "lightmapped",
    material: string,
    lightmap: string
}

interface IShaderDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "shader",
    diffuse: string,
    opacity: string,
    specular: string,
    specularMask: string,
    blendingMode: SupportedBlendingTypes_T,
    depthWrite: boolean,
    doubleSide: boolean,
    transparent: boolean,
    alphaTest: number,
    visible: boolean
}

interface ITexPannerDecodeInfo extends IBaseMaterialModifierDecodeInfo {
    modifierType: "panTexture",
    transform: {
        matrix: number[],
        rate: number,
        map: string
    }
}

interface IFadeColorDecodeInfo extends IBaseMaterialModifierDecodeInfo {
    modifierType: "fadeColor",
    fadeColors: {
        color1: number[],
        color2: number[],
        period: number
    }
}

interface IBaseTimedConstructable {
    time: number;
}

interface IDecodedParameter {
    uniforms: Record<string, any>,
    defines: Record<string, any>,
    isUsingMap: boolean,
    transformType: "none" | "pan" | "rotate",
}

interface IDecodedSpriteParameter extends IDecodedParameter {
    isSprite: true,
    sprites: any[],
    framerate: number
}

type SupportedImports_T = "Level" | "Texture" | "Shader" | "ColorModifier" | "Sound" | "Effect" | "Animation" | "Script";
type SupportedBlendingTypes_T = "normal" | "masked" | "modulate" | "translucent" | "invisible" | "brighten" | "darken";

type DecodableObject_T = "Group" | "Level" | "TerrainInfo" | "TerrainSegment" | "StaticMeshActor" | "StaticMesh" | "Model" | "Light" | "Edges" | "SkinnedMesh" | "Bone";

type Vector2Arr = [number, number];
type Vector4Arr = [number, number, number, number];
type QuaternionArr = Vector4Arr;
type ColorArr = Vector4Arr;
type Vector3Arr = [number, number, number];
type EulerOrder = "XYZ" | "YZX" | "ZXY" | "XZY" | "YXZ" | "ZYX";
type EulerArr = [...Vector3Arr, EulerOrder];
type ArrGeometryGroup = [number, number, number];

interface IBaseObjectOrInstanceDecodeInfo {
    uuid: string,
    type: DecodableObject_T | "StaticMeshInstance"
}

interface IStaticMeshActorDecodeInfo extends IBaseObjectDecodeInfo {
    actorName: string;
    type: "StaticMeshActor",
    instance: IStaticMeshInstanceDecodeInfo
}

interface ISkinnedMeshObjectDecodeInfo extends IBaseObjectDecodeInfo {
    type: "SkinnedMesh";
    geometry: string;
    materials?: string;
    skeleton: IBoneDecodeInfo[];
    animations: Record<string, IKeyframeDecodeInfo_T[]>
}

interface IBoxDecodeInfo { isValid: boolean, min: Vector3Arr, max: Vector3Arr }

interface IBaseZoneDecodeInfo {
    type: "Sector" | "Zone" | "Sky",
    uuid: string,
    name?: string,
    bounds: IBoxDecodeInfo,
    children: IBaseObjectOrInstanceDecodeInfo[],
    fog?: IZoneFogInfo
}

interface IZoneDecodeInfo extends IBaseZoneDecodeInfo { type: "Zone" }
interface ISkyZoneDecodeInfo extends IBaseZoneDecodeInfo { type: "Sky" }
interface ISectorDecodeInfo extends IBaseZoneDecodeInfo { type: "Sector" }

interface IStaticMeshInstanceDecodeInfo {
    uuid?: string,
    name?: string,
    type: "StaticMeshInstance",
    mesh: IStaticMeshObjectDecodeInfo,
    attributes?: {
        colors?: Float32Array
    }
}

interface IBaseObjectDecodeInfo extends IBaseObjectOrInstanceDecodeInfo {
    type: DecodableObject_T,
    name?: string,
    position?: Vector3Arr,
    rotation?: EulerArr,
    scale?: Vector3Arr,
    siblings?: IBaseObjectOrInstanceDecodeInfo[],
    children?: IBaseObjectOrInstanceDecodeInfo[]
}

type IBoundsDecodeInfo = {
    sphere?: {
        center: Vector3Arr;
        radius: number;
    };
    box?: {
        min: Vector3Arr;
        max: Vector3Arr;
    };
}

type IndexLikeArray = number[] | Uint8Array | Uint16Array | Uint32Array;

interface IGeometryDecodeInfo {
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
    bounds?: IBoundsDecodeInfo
}

interface IStaticMeshObjectDecodeInfo extends IBaseObjectDecodeInfo {
    type: "StaticMesh",
    geometry: string,
    materials?: string
}

interface IEdgesObjectDecodeInfo extends IBaseObjectDecodeInfo {
    type: "Edges",
    geometry: string,
    color?: [number, number, number],
    ignoreDepth?: boolean
}

interface ILightDecodeInfo extends IBaseObjectDecodeInfo {
    type: "Light",
    color: [number, number, number],
    radius: number,
    directional: boolean,
    lightType: LightType_T,
    lightEffect: LightEffect_T,
    cone: number
}

interface IMaterialModifier {
    type: "Lighting"
}

interface IBaseLightingMaterialModifier extends IMaterialModifier {
    type: "Lighting",
    lightType: "Directional" | "Ambient",
    color: [number, number, number],
    brightness: number
}

interface ILightDirectionalMaterialModifier extends IBaseLightingMaterialModifier {
    lightType: "Directional",
    direction: Vector3Arr,
}

interface ILightAmbientMaterialModifier extends IBaseLightingMaterialModifier {
    lightType: "Ambient"
}

interface IBoneDecodeInfo extends IBaseObjectDecodeInfo {
    type: "Bone",
    name: string,
    position: Vector3Arr,
    quaternion: QuaternionArr,
    scale: Vector3Arr,
    parent: number
}

type MapData_T = { texture: THREE.Texture, size: THREE.Vector2 };

type LightType_T = number | {
    None: 0,
    Steady: 1,
    Pulse: 2,
    Blink: 3,
    Flicker: 4,
    Strobe: 5,
    SubtlePulse: 6,
    TexturePaletteOnce: 7,
    TexturePaletteLoop: 8
};

type LightEffect_T = number | {
    TorchWaver: 0x0,
    FireWaver: 0x1,
    WateryShimmer: 0x2,
    SearchLight: 0x3,
    SlowWave: 0x4,
    FastWave: 0x5,
    Shock: 0x6,
    Disco: 0x7,
    Spotlight: 0x8,
    NonIncidence: 0x9,
    ShellOnly: 0xA,
    OmniBumpMap: 0xB,
    Interference: 0xC,
    Cylinder: 0xD,
    Rotor: 0xE,
    Unused: 0xF
};

interface IInfo { getDecodeInfo(library: DecodeLibrary): Promise<IBaseZoneDecodeInfo>; }

interface IZoneFogInfo {
    start: number,
    end: number,
    color: ColorArr
}

type LoadSettings_T = {
    loadTerrain?: boolean,
    loadBaseModel?: boolean,
    loadStaticModels?: boolean,
    loadStaticModelList?: number[],
    helpersZoneBounds?: boolean
};

type ISunDecodeInfo_T = {
    type: "Sun",
    sprites: string[]
}

type IKeyframeDecodeInfo_T = {
    name: string,
    times: Float32Array,
    values: Float32Array,
    type: "Vector" | "Quaternion"
}