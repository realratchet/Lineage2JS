type ValueTypeNames_T = "int32" | "uint32" | "int16" | "uint16" | "int8" | "uint8" | "guid" | "char" | "buffer" | "compat32" | "float";
type ValidTypes_T<T extends ValueTypeNames_T> = {
    bytes?: number;
    signed: boolean;
    name: T;
    dtype?: Int32ArrayConstructor | Uint32ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int8ArrayConstructor | Uint8ArrayConstructor | Float32ArrayConstructor;
};

type UObjectTypes_T = "Texture" | "Palette" | "StaticMesh" | "Shader" | "LevelInfo" | "TerrainSector" | "ZoneInfo";
type Seek_T = "current" | "set";
type FNumber<T> = typeof import("./unreal/un-number").FNumber;
type FNumberExt<T> = new (...params: any) => FNumber<T>;

type ValidConstructables_T<T> = typeof import("./unreal/un-color").FColor
    | typeof import("./unreal/un-mipmap").FMipmap
    | typeof import("./unreal/un-mipmap").FNumber
    | typeof import("./unreal/un-deco-layer").UDecoLayer
    | typeof import("./unreal/un-unknown-struct").FUnknownStruct
    | FNumberExt<T>;