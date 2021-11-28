type UPackage = import("./un-package").UPackage;
type BufferValue<T extends ValueTypeNames_T = ValueTypeNames_T> = import("../buffer-value").BufferValue;
type UHeader = import("./un-header").UHeader;
type UGeneration = import("./un-generation").UGeneration;
type UExport = import("./un-export").UExport;
type UName = import("./un-name").UName;
type UImport = import("./un-import").UImport;
type UTexture = import("./un-texture").UTexture;
type UObject = import("./un-object").UObject;
type UClass = import("./un-class").UClass;
type UStruct = import("./un-struct").UStruct;
type UPlatte = import("./un-palette").UPlatte;
type UStaticMesh = import("./static-mesh/un-static-mesh").UStaticMesh;
type ULevelInfo = import("./un-level-info").ULevelInfo;
type UTerrainSector = import("./un-terrain-sector").UTerrainSector;
type UZoneInfo = import("./un-zone-info").UZoneInfo;
type UPhysicsVolume = import("./un-physics-volume").UPhysicsVolume;
type USkyZoneInfo = import("./un-sky-zone-info").USkyZoneInfo;
type UModel = import("./model/un-model").UModel;
type UPolys = import("./un-polys").UPolys;
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
type UNSun = import("./un-nsun").UNSun;
type UNMoon = import("./un-nmoon").UNMoon;
type UFogInfo = import("./un-fog-info").UFogInfo;
type UPlayerStart = import("./un-player-start").UPlayerStart;
type UMusicVolume = import("./un-music-volume").UMusicVolume;
type UMover = import("./un-mover").UMover;
type UBlockingVolume = import("./un-blocking-volume").UBlockingVolume;
type UCamera = import("./un-camera").UCamera;
type UStaticMeshIsntance = import("./static-mesh/un-static-mesh-instance").UStaticMeshIsntance;
type ULevelSummary = import("./un-level-summary").ULevelSummary;
type UDefaultPhysicsVolume = import("./un-physics").UDefaultPhysicsVolume;
type UEncodedFile = import("./un-encoded-file").UEncodedFile;
type UTextBuffer = import("./un-text-buffer").UTextBuffer;

type UMaterial = import("./un-material").UMaterial;
type UMaterialContainer = import("./un-material").UMaterialContainer;
type OutputBlending_T = import("./un-material").OutputBlending_T;

type UShader = import("./un-material").UShader;
type UFadeColor = import("./un-material").UFadeColor;
type UTexRotator = import("./un-material").UTexRotator;
type UTexPanner = import("./un-material").UTexPanner;
type UColorModifier = import("./un-material").UColorModifier;
type UTexOscillator = import("./un-material").UTexOscillator;

type PropertyTag = import("./un-property").PropertyTag;
type FColor = import("./un-color").FColor;
type UMatrix = import("./un-matrix").UMatrix;
type UPointRegion = import("./un-point-region").UPointRegion;
type FVector = import("./un-vector").FVector;
type FRotator = import("./un-rotator").FRotator;

type FMipmap = import("./un-mipmap").FMipmap;
type UDecoLayer = import("./un-deco-layer").UDecoLayer;
type FUnknownStruct = import("./un-unknown-struct").FUnknownStruct;
type FBSPNode = import("./bsp/un-bsp-node").FBSPNode;
type FBSPSurf = import("./bsp/un-bsp-surf").FBSPSurf;
type FVert = import("./model/un-vert").FVert;

type ETextureFormat = import("./un-tex-format").ETextureFormat;
type ETexturePixelFormat = import("./un-tex-format").ETexturePixelFormat;

type DecodableTexture_T = "dds" | "g16";
type DecodableMaterial_T = "modifier" | "texture" | "shader";
type DecodableMaterialModifier_T = "fadeColor" | "panTexture";
interface IBaseMaterialDecodeInfo { materialType: DecodableMaterial_T }
interface IBaseMaterialModifierDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "modifier",
    modifierType: DecodableMaterialModifier_T
}
interface ITextureDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "texture",
    textureType: DecodableTexture_T,
    buffer: ArrayBuffer,
    wrapS: number, wrapT: number
}

interface IShaderDecodeInfo extends IBaseMaterialDecodeInfo {
    materialType: "shader",
    diffuse: IBaseMaterialDecodeInfo,
    opacity: IBaseMaterialDecodeInfo,
    specular: IBaseMaterialDecodeInfo,
    specularMask: IBaseMaterialDecodeInfo,
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
        map: ITextureDecodeInfo
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

interface IDecodedParameter {
    uniforms: { [key: string]: any },
    defines: { [key: string]: any },
    isUsingMap: boolean,
    transformType: "none" | "pan" | "rotate",
}

type SupportedBlendingTypes_T = "normal" | "masked" | "modulate" | "translucent" | "invisible" | "brighten" | "darken";

type DecodableObject_T = "StaticMeshActor" | "StaticMesh" | "Model";

type Vector3Arr = [number, number, number];
type EulerOrder = "XYZ" | "YZX" | "ZXY" | "XZY" | "YXZ" | "ZYX";
type EulerArr = [number, number, number, EulerOrder];
type ArrGeometryGroup = [number, number, number];

interface IBaseObjectDecodeInfo {
    type: DecodableObject_T,
    name?: string,
    position?: Vector3Arr,
    rotation?: EulerArr,
    scale?: Vector3Arr,
    children?: IBaseObjectDecodeInfo[]
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

interface IStaticMeshObjectDecodeInfo extends IBaseObjectDecodeInfo {
    geometry: {
        attributes: {
            positions: Float32Array;
            normals: Float32Array;
            uvs: Float32Array;
        };
        indices: number[] | Uint8Array | Uint16Array | Uint32Array;
        groups: ArrGeometryGroup[],
        bounds?: IBoundsDecodeInfo
    },
    materials: IBaseMaterialDecodeInfo[]
}