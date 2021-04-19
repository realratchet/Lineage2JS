type ValueTypeNames_T = "int32" | "uint32" | "int16" | "uint16" | "int8" | "uint8" | "guid" | "char" | "buffer" | "compat32";
type ValidTypes_T<T extends ValueTypeNames_T> = {
    bytes?: number;
    signed: boolean;
    name: T;
    dtype?: Int32ArrayConstructor | Uint32ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int8ArrayConstructor | Uint8ArrayConstructor;
};