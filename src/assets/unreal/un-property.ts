const UNP_ByteProperty = 0x1;
const UNP_IntProperty = 0x2;
const UNP_BoolProperty = 0x3;
const UNP_FloatProperty = 0x4;
const UNP_ObjectProperty = 0x5;
const UNP_NameProperty = 0x6;
const UNP_StringProperty = 0x7;
const UNP_ClassProperty = 0x8;
const UNP_ArrayProperty = 0x9;
const UNP_StructProperty = 0xa;
const UNP_VectorProperty = 0xb;
const UNP_RotatorProperty = 0xc;
const UNP_StrProperty = 0xd;
const UNP_MapProperty = 0xe;
const UNP_FixedArrayProperty = 0xf;

const PROPERTY_TYPE_MASK = 0x0f;
const PROPERTY_SIZE_MASK = 0x70;
const PROPERTY_ARRAY_MASK = 0x80;

class UProperty {
    public static UNP_ByteProperty = UNP_ByteProperty;
    public static UNP_IntProperty = UNP_IntProperty;
    public static UNP_BoolProperty = UNP_BoolProperty;
    public static UNP_FloatProperty = UNP_FloatProperty;
    public static UNP_ObjectProperty = UNP_ObjectProperty;
    public static UNP_NameProperty = UNP_NameProperty;
    public static UNP_StringProperty = UNP_StringProperty;
    public static UNP_ClassProperty = UNP_ClassProperty;
    public static UNP_ArrayProperty = UNP_ArrayProperty;
    public static UNP_StructProperty = UNP_StructProperty;
    public static UNP_VectorProperty = UNP_VectorProperty;
    public static UNP_RotatorProperty = UNP_RotatorProperty;
    public static UNP_StrProperty = UNP_StrProperty;
    public static UNP_MapProperty = UNP_MapProperty;
    public static UNP_FixedArrayProperty = UNP_FixedArrayProperty;

    public static PROPERTY_TYPE_MASK = PROPERTY_TYPE_MASK;
    public static PROPERTY_SIZE_MASK = PROPERTY_SIZE_MASK;
    public static PROPERTY_ARRAY_MASK = PROPERTY_ARRAY_MASK;

    public name: string = "None";
    public isArray: boolean = false;
    public type: number;
    public structType?: string;
    public size: number = 0;
    public arrayIndex: number;

    public setInfo(info: number) {
        this.isArray = (info & PROPERTY_ARRAY_MASK) !== 0;
        this.type = info & PROPERTY_TYPE_MASK;
    }

    // char *StructType;
    // uint32 Size;
    // int32 ArrayIndex;
    // int32 ArrayLength;
    // int8 Type;
    // uint32 DataLength;
    // int8 *Data;
}

export default UProperty;
export { UProperty };