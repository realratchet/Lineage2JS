type ValueTypeNames_T = "int64" | "uint64" | "int32" | "uint32" | "int16" | "uint16" | "int8" | "uint8" | "guid" | "char" | "buffer" | "compat32" | "float";
type ValidTypes_T<T extends ValueTypeNames_T> = {
    bytes?: number;
    signed: boolean;
    name: T;
    dtype?: BigInt64ArrayConstructor | BigUint64ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int8ArrayConstructor | Uint8ArrayConstructor | Float32ArrayConstructor;
};

type UObjectTypes_T = "Texture" |
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
    "TexOscillator";
type Seek_T = "current" | "set";
type FNumber<T> = typeof import("./unreal/un-number").FNumber;
type FNumberExt<T> = new (...params: any) => FNumber<T>;

interface IConstructable {
    load(pkg: import("../assets/unreal/un-package").UPackage, tag?: import("../assets/unreal/un-property").PropertyTag): Promise<this>;
}

type ValidConstructables_T<T> = typeof import("./unreal/un-color").FColor
    | typeof import("./unreal/un-vector").FVector
    | typeof import("./unreal/un-mipmap").FMipmap
    | typeof import("./unreal/un-mipmap").FNumber
    | typeof import("./unreal/un-deco-layer").UDecoLayer
    | typeof import("./unreal/un-unknown-struct").FUnknownStruct
    | typeof import("./unreal/bsp/un-bsp-node").FBSPNode
    | typeof import("./unreal/bsp/un-bsp-surf").FBSPSurf
    | typeof import("./unreal/model/un-vert").FVert
    | FNumberExt<T>;