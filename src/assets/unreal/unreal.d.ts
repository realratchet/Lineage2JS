// type DecodeLibrary = import("./decode-library").DecodeLibrary;
// type UPackage = import("./un-package").UPackage;
// type UNativePackage = import("./un-package").UNativePackage;
// type BufferValue<T extends ValueTypeNames_T = ValueTypeNames_T> = import("../buffer-value").BufferValue<T>;
// type UHeader = import("./un-header").UHeader;
// type UGeneration = import("./un-generation").UGeneration;
// type UExport<T extends UObject = UObject> = import("./un-export").UExport<T>;
// type FConstructable = import("./un-constructable").FConstructable | import("./un-object").UObject;
// type FArray<T extends FConstructable = FConstructable> = import("./un-array").FArray<T>;
// type FObjectArray<T extends UObject = UObject> = import("./un-array").FObjectArray<T>;
// type FArrayLazy<T extends FConstructable = FConstructable> = import("./un-array").FArrayLazy<T>;
// type FPrimitiveArray<T extends ValueTypeNames_T = ValueTypeNames_T> = import("./un-array").FPrimitiveArray<T>;
// type FPrimitiveArrayLazy<T extends ValueTypeNames_T = ValueTypeNames_T> = import("./un-array").FPrimitiveArrayLazy<T>;
// type UName = import("./un-name").UName;
// type UImport = import("./un-import").UImport;
// type UTexture = import("./un-texture").UTexture;
// type UCubemap = import("./un-cubemap").UCubemap;
// type UTextureModifyInfo = import("./un-texture-modify-info").UTextureModifyInfo;
// type UObject = import("./un-object").UObject;
// type UAActor = import("./un-aactor").UAActor;
// type UClass = import("./un-class").UClass;
// type UFunction = import("./un-function").UFunction;
// type UField = import("./un-field").UField;
// type UEnum = import("./un-enum").UEnum;
// type UProperty = import("./un-properties").UProperty;
// type UStruct = import("./un-struct").UStruct;
// type UPlatte = import("./un-palette").UPlatte;
// type UStaticMesh = import("./static-mesh/un-static-mesh").UStaticMesh;
// type ULevelInfo = import("./un-level-info").ULevelInfo;
// type UTerrainSector = import("./un-terrain-sector").UTerrainSector;
// type UTerrainLayer = import("./un-terrain-layer").UTerrainLayer
// type FZoneInfo = import("./un-zone-info").FZoneInfo;
// type UPhysicsVolume = import("./un-physics-volume").UPhysicsVolume;
// type USkyZoneInfo = import("./un-sky-zone-info").USkyZoneInfo;
// type UPolys = import("./un-polys").UPolys;
// type PolyFlags_T = import("./un-polys").PolyFlags_T;
// type UBrush = import("./un-brush").UBrush;
// type UAmbientSoundObject = import("./un-ambient-sound").UAmbientSoundObject;
// type USound = import("./un-sound").USound;
// type ULight = import("./un-light").ULight;
// 
// 
// type ATerrainInfo = import("./un-terrain-info").ATerrainInfo;
// type UNMovableSunLight = import("./un-movable-sunlight").UNMovableSunLight;
// type UStaticMeshActor = import("./static-mesh/un-static-mesh-actor").UStaticMeshActor;
// type UWaterVolume = import("./un-water-volume").UWaterVolume;
// type UEmitter = import("./un-emitter").UEmitter;
// type UFont = import("./un-font").UFont;
// type UNSun = import("./un-nsun").UNSun;
// type UNMoon = import("./un-nmoon").UNMoon;
// type FFogInfo = import("./un-fog-info").FFogInfo;
// type UPlayerStart = import("./un-player-start").UPlayerStart;
// type UMusicVolume = import("./un-music-volume").UMusicVolume;
// type UMover = import("./un-mover").UMover;
// type UBlockingVolume = import("./un-blocking-volume").UBlockingVolume;
// type UCamera = import("./un-camera").UCamera;
// type UStaticMeshInstance = import("./static-mesh/un-static-mesh-instance").UStaticMeshInstance;
// type ULevelSummary = import("./un-level-summary").ULevelSummary;
// type UDefaultPhysicsVolume = import("./un-physics").UDefaultPhysicsVolume;
// 
// type UTextBuffer = import("./un-text-buffer").UTextBuffer;
// type USkeletalMesh = import("./skeletal-mesh/un-skeletal-mesh").USkeletalMesh;
// type UMeshAnimation = import("./skeletal-mesh/un-mesh-animation").UMeshAnimation;

// type UMaterial = import("./un-material").UMaterial;
// type UStaticMeshMaterial = import("./un-material").UStaticMeshMaterial;
// type OutputBlending_T = import("./un-material").OutputBlending_T;

// type UShader = import("./un-material").UShader;
// type UFadeColor = import("./un-material").UFadeColor;
// type UTexRotator = import("./un-material").UTexRotator;
// type UTexPanner = import("./un-material").UTexPanner;
// type UColorModifier = import("./un-material").UColorModifier;
// type UTexOscillator = import("./un-material").UTexOscillator;
// type UTexEnvMap = import("./un-material").UTexEnvMap;
// type FRangeVector = import("./un-range").FRangeVector;
// type FRange = import("./un-range").FRange;
// type FPlane = import("./un-plane").FPlane;
// type FScale = import("./un-scale").FScale;
// type UPlane = import("./un-plane").UPlane;

// type PropertyTag = import("./un-property-tag").PropertyTag;
// type FColor = import("./un-color").FColor;
// type FMatrix = import("./un-matrix").FMatrix;
// type FMatrix = import("./un-matrix").FMatrix;
// type UPointRegion = import("./un-point-region").UPointRegion;
// type FVector = import("./un-vector").FVector;
// type FQuaternion = import("./un-quaternion").FQuaternion;
// type FRotator = import("./un-rotator").FRotator;
// type FCoords = import("./un-coords").FCoords;

// type FMipmap = import("./un-mipmap").FMipmap;
// type UDecoLayer = import("./un-deco-layer").UDecoLayer;
// type FUnknownStruct = import("./un-unknown-struct").FUnknownStruct;
// type FBSPNode = import("./bsp/un-bsp-node").FBSPNode;
// type FBSPSurf = import("./bsp/un-bsp-surf").FBSPSurf;
// type FVert = import("./model/un-vert").FVert;
// type FBox = import("./un-box").FBox;

// type FMultiLightmapTexture = import("./model/un-multilightmap-texture").FMultiLightmapTexture;
// type FStaticLightmapTexture = import("./model/un-multilightmap-texture").FStaticLightmapTexture;

// type ETextureFormat = import("./un-tex-format").ETextureFormat;
// type ETexturePixelFormat = import("./un-tex-format").ETexturePixelFormat;

// interface IBaseMaterialDecodeInfo { name?: string, materialType: DecodableMaterial_T, color?: boolean }


// interface IParticleMaterialDecodeInfo extends IBaseMaterialDecodeInfo {
//     materialType: "particle",
//     material: string,
//     blendingMode: ParticleBlendModes_T,
//     opacity: number
// }

// interface ISolidMaterialDecodeInfo extends IBaseMaterialDecodeInfo {
//     materialType: "solid",
//     solidColor: number
// }

// interface IBSPLeafDecodeInfo_T {
//     zone: number,
//     permiating: number,
//     volumetric: number,
//     visibleZones: bigint
// }

// interface IBSPZoneDecodeInfo_T {
//     connectivity: bigint,
//     visibility: bigint,
//     zoneInfo: IBaseZoneDecodeInfo
// }

// interface IBSPNodeCollisionInfo_T {
//     flags: number[],
//     bounds: IBoxDecodeInfo
// }

// interface IBSPNodeDecodeInfo_T {
//     children: [number, number],
//     plane: Vector4Arr,
//     leaves: [number, number],
//     zones: [number, number],
//     collision?: IBSPNodeCollisionInfo_T
// }

// interface IAnimatedSpriteDecodeInfo extends IBaseMaterialDecodeInfo {
//     materialType: "sprite",
//     sprites: ITextureDecodeInfo[],
//     framerate: number
// }

// interface IMaterialTerrainSegmentDecodeInfo extends IBaseMaterialDecodeInfo {
//     materialType: "terrainSegment";
//     terrainMaterial: string,
//     uvs: IDataTextureDecodeInfo
// }

// interface IMaterialTerrainDecodeInfo extends IBaseMaterialDecodeInfo {
//     materialType: "terrain";
//     layers: { map: string, alphaMap: string }[]
// }



// interface IDataTextureDecodeInfo extends ITextureDecodeInfo { format?: DataTextureFormats_T }

// interface IMaterialGroupDecodeInfo extends IBaseMaterialDecodeInfo {
//     materialType: "group",
//     materials: string[]
// }

// interface ILightmappedDecodeInfo extends IBaseMaterialDecodeInfo {
//     materialType: "lightmapped",
//     material: string,
//     lightmap: string
// }






// interface IBaseTimedConstructable {
//     time: number;
// }

// interface IDecodedParameter {
//     uniforms: Record<string, any>,
//     defines: Record<string, any>,
//     isUsingMap: boolean,
//     transformType: "none" | "pan" | "rotate",
// }

// interface IDecodedSpriteParameter extends IDecodedParameter {
//     isSprite: true,
//     sprites: any[],
//     framerate: number
// }

// type SupportedImports_T = "Level" | "Texture" | "Shader" | "ColorModifier" | "Sound" | "Effect" | "Animation" | "Script";



// interface ISkinnedMeshObjectDecodeInfo extends IBaseObjectDecodeInfo {
//     type: "SkinnedMesh";
//     geometry: string;
//     materials?: string;
//     skeleton: IBoneDecodeInfo[];
//     animations: Record<string, IKeyframeDecodeInfo_T[]>
// }






// interface IMaterialModifier {
//     type: "Lighting"
// }

// interface IBaseLightingMaterialModifier extends IMaterialModifier {
//     type: "Lighting",
//     lightType: "Directional" | "Ambient",
//     color: [number, number, number],
//     brightness: number
// }

// interface ILightDirectionalMaterialModifier extends IBaseLightingMaterialModifier {
//     lightType: "Directional",
//     direction: Vector3Arr,
// }

// interface ILightAmbientMaterialModifier extends IBaseLightingMaterialModifier {
//     lightType: "Ambient"
// }

// interface IBoneDecodeInfo extends IBaseObjectDecodeInfo {
//     type: "Bone",
//     name: string,
//     position: Vector3Arr,
//     quaternion: QuaternionArr,
//     scale: Vector3Arr,
//     parent: number
// }

// type MapData_T = { texture: THREE.Texture, size: THREE.Vector2 };


// type LoadSettings_T = {
//     loadTerrain?: boolean,
//     loadBaseModel?: boolean,
//     loadStaticModels?: boolean,
//     loadStaticModelList?: number[],
//     loadEmitters?: boolean,
//     helpersZoneBounds?: boolean
// };

// type ISunDecodeInfo_T = {
//     type: "Sun",
//     sprites: string[]
// }

// type IKeyframeDecodeInfo_T = {
//     name: string,
//     times: Float32Array,
//     values: Float32Array,
//     type: "Vector" | "Quaternion"
// }



