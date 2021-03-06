type AssetLoader = import("./asset-loader").AssetLoader;
type ValueTypeNames_T = "int64" | "uint64" | "int32" | "uint32" | "int16" | "uint16" | "int8" | "uint8" | "guid" | "char" | "buffer" | "compat32" | "float";
type IndexTypedArray = Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor;
type IndexTypedArrayAttribute = typeof THREE.Uint8BufferAttribute | typeof THREE.Uint16BufferAttribute | typeof THREE.Uint32BufferAttribute;
type ValidTypes_T<T extends ValueTypeNames_T> = {
    bytes?: number;
    signed: boolean;
    name: T;
    dtype?: BigInt64ArrayConstructor | BigUint64ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int8ArrayConstructor | Uint8ArrayConstructor | Float32ArrayConstructor;
};

type UObjectTypes_T = "Texture" |
    "FinalBlend" |
    "Palette" |
    "StaticMesh" |
    "Shader" |
    "LevelInfo" |
    "TerrainSector" |
    "ZoneInfo" |
    "PhysicsVolume" |
    "SkyZoneInfo" |
    "Model" |
    "Polys" |
    "Brush" |
    "Level" |
    "AmbientSoundObject" |
    "Sound" |
    "Light" |
    "Class" |
    "TerrainInfo" |
    "NMovableSunLight" |
    "StaticMeshActor" |
    "WaterVolume" |
    "Emitter" |
    "NSun" |
    "NMoon" |
    "L2FogInfo" |
    "PlayerStart" |
    "MusicVolume" |
    "Mover" |
    "BlockingVolume" |
    "Camera" |
    "FadeColor" |
    "StaticMeshInstance" |
    "TexRotator" |
    "TexPanner" |
    "ColorModifier" |
    "TexOscillator" |
    "LevelSummary" |
    "DefaultPhysicsVolume" |
    "Struct" |
    "TextBuffer";
type Seek_T = "current" | "set";
type FNumber<T> = typeof import("./unreal/un-number").FNumber;
type FNumberExt<T> = new (...params: any) => FNumber<T>;

interface IConstructable {
    load(pkg: import("../assets/unreal/un-package").UPackage, tag?: import("../assets/unreal/un-property").PropertyTag): this;
}

type ValidConstructables_T<T> = typeof import("./unreal/un-color").FColor
    | typeof import("./unreal/un-vector").FVector
    | typeof import("./unreal/un-mipmap").FMipmap
    | typeof import("./unreal/un-mipmap").FNumber
    | typeof import("./unreal/un-deco-layer").UDecoLayer
    | typeof import("./unreal/un-unknown-struct").FUnknownStruct
    | typeof import("./unreal/bsp/un-bsp-node").FBSPNode
    | typeof import("./unreal/bsp/un-bsp-surf").FBSPSurf
    | typeof import("./unreal/bsp/un-bsp-section").FBSPSection
    | typeof import("./unreal/model/un-vert").FVert
    | typeof import("./unreal/un-material").FStaticMeshMaterial
    | typeof import("./unreal/un-tint-map").FTIntMap
    | typeof import("./unreal/bsp/un-bsp-section").FBSPVertex
    | typeof import("./unreal/model/un-lightmap-index").FLightmapIndex
    | typeof import("./unreal/model/un-multilightmap-texture").FMultiLightmapTexture
    | typeof import("./unreal/un-box").FBox
    | typeof import("./unreal/un-leaf").FLeaf
    | typeof import("./unreal/static-mesh/un-static-mesh-section").FStaticMeshSection
    | typeof import("./unreal/static-mesh/un-static-mesh-uv-stream").FStaticMeshUVStream
    | typeof import("./unreal/static-mesh/un-static-mesh-collision").FStaticMeshCollisionNode
    | typeof import("./unreal/static-mesh/un-static-mesh-collision").FStaticMeshCollisionTriangle
    | typeof import("./unreal/static-mesh/un-static-mesh-triangle").FStaticMeshTriangle

    | FNumberExt<T>;