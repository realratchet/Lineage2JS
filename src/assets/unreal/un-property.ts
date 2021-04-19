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
    // char *Name;
    // char *StructType;
    // uint32 Size;
    // int32 ArrayIndex;
    // bool IsArray;
    // int32 ArrayLength;
    // int8 Type;
    // uint32 DataLength;
    // int8 *Data;
}

export default UProperty;
export { UProperty };