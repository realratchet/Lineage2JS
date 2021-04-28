type ValueTypeNames_T = "int32" | "uint32" | "int16" | "uint16" | "int8" | "uint8" | "guid" | "char" | "buffer" | "compat32" | "float";
type ValidTypes_T<T extends ValueTypeNames_T> = {
    bytes?: number;
    signed: boolean;
    name: T;
    dtype?: Int32ArrayConstructor | Uint32ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int8ArrayConstructor | Uint8ArrayConstructor | Float32ArrayConstructor;
};

type UObjectTypes_T = "Texture" | "Palette" | "StaticMesh" | "Shader";
type Seek_T = "current" | "set";

type ValidConstructables_T = typeof import("./unreal/un-color").FColor
    | typeof import("./unreal/un-mipmap").FMipmap
    | typeof import("./unreal/un-mipmap").FNumber
    | typeof import("./unreal/un-deco-layer").UDecoLayer;