import UMetaField from "./un-meta-field";
import BufferValue from "../../buffer-value";
import UNativeRegistry from "../scripts/un-native-registry";

class UMetaStruct extends UMetaField {
    public friendlyName: string;

    protected textBufferId: number;
    protected firstChildPropId: number;
    protected unkObjectId: number;
    protected line: number;
    protected textPos: number;

    protected scriptSize: number;
    protected bytecodePlainText = "";
    protected bytecode: { type: string, value: any, tokenName?: string }[] = [];
    protected bytecodeLength = 0;

    protected klass: ObjectConstructor;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        const verArchive = pkg.header.getArchiveFileVersion();
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const int32 = new BufferValue(BufferValue.int32);

        this.textBufferId = pkg.read(compat32).value as number;
        this.firstChildPropId = pkg.read(compat32).value as number;

        const nameId = pkg.read(compat32).value as number;

        this.friendlyName = pkg.nameTable[nameId].name as string;

        console.assert(typeof this.friendlyName === "string" && this.friendlyName !== "None", "Must have a friendly name");

        if (0x77 < verArchive)
            this.unkObjectId = pkg.read(compat32).value as number;

        this.line = pkg.read(int32).value as number;
        this.textPos = pkg.read(int32).value as number;
        this.scriptSize = pkg.read(uint32).value as number;

        while (this.bytecodeLength < this.scriptSize)
            this.readToken(pkg, 0);

        console.assert(this.bytecodeLength === this.scriptSize, "Invalid bytecode length");

        if (this.firstChildPropId !== 0) {
            this.promisesLoading.push(new Promise(async resolve => {
                const childPropFields = [];
                // debugger;

                let childPropId = this.firstChildPropId;

                while (Number.isFinite(childPropId) && childPropId !== 0) {

                    const field = await pkg.fetchObject<UProperty>(childPropId);

                    childPropFields.push(field);

                    childPropId = field.nextFieldId;
                }

                debugger;

                resolve(childPropFields);
            }));
        }
    }

    public async constructClass(): Promise<void> {
        const friendlyName = this.friendlyName;
        
        this.klass = { [friendlyName]: class { } }[friendlyName] as typeof Object

        await super.constructClass();

        debugger;
    }

    protected readToken(pkg: UPackage, depth: number): ExprToken_T {
        if (depth === 64) throw new Error("Too deep");

        const uint8 = new BufferValue(BufferValue.uint8);
        const uint16 = new BufferValue(BufferValue.uint16);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);

        depth++;

        const tokenValue = pkg.read(uint8).value as ExprToken_T;
        let tokenValue2 = tokenValue;

        const isNativeFunc = UNativeRegistry.hasNativeFunc(tokenValue);
        const tokenName = isNativeFunc ? UNativeRegistry.getNativeFuncName(tokenValue) : ExprToken_T[tokenValue];

        if (!tokenName) throw new Error(`Unknown token name: ${tokenValue}`);

        this.bytecodeLength = this.bytecodeLength + 1;
        this.bytecode.push({ type: isNativeFunc ? "call" : "token", value: tokenValue, tokenName });

        let tokenDebug = new Array(depth - 1).fill("\t").join("");

        tokenDebug += tokenName + "\r\n";
        this.bytecodePlainText += tokenDebug;

        // const tokenHex = `0x${tokenValue.toString(16)}`;

        if (tokenValue < ExprToken_T.MaxConversion) {
            switch (tokenValue) {
                case ExprToken_T.LocalVariable:
                case ExprToken_T.InstanceVariable:
                case ExprToken_T.DefaultVariable:
                case ExprToken_T.ObjectConst:
                case ExprToken_T.NativeParm: {
                    const objectIndex = pkg.read(compat32).value as number;

                    this.bytecode.push({ type: "compat", value: objectIndex });
                    this.bytecodeLength = this.bytecodeLength + 4;
                } return tokenValue2;
                case ExprToken_T.Return:
                case ExprToken_T.GotoLabel:
                case ExprToken_T.EatString:
                case ExprToken_T.UnkMember:
                    this.readToken(pkg, depth);
                    return tokenValue2;
                case ExprToken_T.Switch:
                case ExprToken_T.MinConversion:
                    this.bytecode.push({ type: "byte", value: pkg.read(uint8).value as number });
                    this.bytecodeLength = this.bytecodeLength + 1;
                    this.readToken(pkg, depth);
                    return tokenValue2;
                case ExprToken_T.Jump:
                    this.bytecode.push({ type: "uint16", value: pkg.read(uint16).value as number });
                    this.bytecodeLength = this.bytecodeLength + 2;
                    break;
                case ExprToken_T.JumpIfNot:
                case ExprToken_T.Assert:
                case ExprToken_T.Skip:
                    this.bytecode.push({ type: "uint16", value: pkg.read(uint16).value as number });
                    this.bytecodeLength = this.bytecodeLength + 2;
                    this.readToken(pkg, depth);
                    return tokenValue2;
                case ExprToken_T.Stop:
                case ExprToken_T.Nothing:
                case ExprToken_T.EndFunctionParms:
                case ExprToken_T.Self:
                case ExprToken_T.IntZero:
                case ExprToken_T.IntOne:
                case ExprToken_T.True:
                case ExprToken_T.False:
                case ExprToken_T.NoObject:
                case ExprToken_T.BoolVariable:
                case ExprToken_T.IteratorPop:
                case ExprToken_T.IteratorNext:
                    return tokenValue2;
                case ExprToken_T.Case: {
                    const value = pkg.read(uint16).value as number;

                    this.bytecode.push({ type: "uint16", value });
                    this.bytecodeLength = this.bytecodeLength + 2;

                    if (value !== 0xffff)
                        this.readToken(pkg, depth);

                } return tokenValue2;
                case ExprToken_T.LabelTable:
                    // if ( (*(_BYTE *)likelyBytecodeLength & 3) != 0 )
                    //     appFailAssert(aIcode30, aUnclassCpp_6, 1467);
                    // do
                    // {
                    //     a2 = (int *)(this[21] + *likelyBytecodeLength);
                    //     operator<<(v3, a2);
                    //     v54 = a2;
                    //     *likelyBytecodeLength += 8;
                    // }
                    // while ( *v54 );
                    throw new Error("do something here");
                    return tokenValue2;
                case ExprToken_T.Let:
                case ExprToken_T.DynArrayElement:
                case ExprToken_T.LetBool:
                case ExprToken_T.ArrayElement:
                case ExprToken_T.FloatToBool:
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.New:
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.ClassContext:
                case ExprToken_T.Context:
                    this.readToken(pkg, depth);

                    this.bytecode.push({ type: "uint16", value: pkg.read(uint16).value as number });
                    this.bytecodeLength = this.bytecodeLength + 2;

                    this.bytecode.push({ type: "uint8", value: pkg.read(uint8).value as number });
                    this.bytecodeLength = this.bytecodeLength + 1;

                    this.readToken(pkg, depth);
                    return tokenValue2;
                case ExprToken_T.MetaCast:
                case ExprToken_T.DynamicCast:
                case ExprToken_T.StructMember: {
                    const objectIndex = pkg.read(compat32).value as number;

                    this.bytecode.push({ type: "compat", value: objectIndex });
                    this.bytecodeLength = this.bytecodeLength + 4;

                    this.readToken(pkg, depth);

                } return tokenValue2;
                case ExprToken_T.VirtualFunction:
                case ExprToken_T.GlobalFunction: {
                    const objectIndex = pkg.read(compat32).value as number;

                    this.bytecode.push({ type: "compat", value: objectIndex });
                    this.bytecodeLength = this.bytecodeLength + 4;

                    while (this.readToken(pkg, depth) !== ExprToken_T.EndFunctionParms);

                    if (this.bytecodeLength < this.scriptSize) {
                        const pos = pkg.tell();
                        const token2 = pkg.read(uint8).value as ExprToken_T;

                        // this.bytecodeLength = this.bytecodeLength + 1;

                        if (token2 === ExprToken_T.BoolToFloat) {
                            debugger;
                        }

                        pkg.seek(pos, "set");
                    }
                } return tokenValue2;
                case ExprToken_T.FinalFunction: {
                    const objectIndex = pkg.read(compat32).value as number;

                    this.bytecode.push({ type: "compat", value: objectIndex });
                    this.bytecodeLength = this.bytecodeLength + 4;

                    while (this.readToken(pkg, depth) !== ExprToken_T.EndFunctionParms);

                    if (this.bytecodeLength < this.scriptSize) {
                        const pos = pkg.tell();
                        const token2 = pkg.read(uint8).value as ExprToken_T;

                        if (token2 === ExprToken_T.BoolToFloat) {
                            debugger;
                        }

                        pkg.seek(pos, "set");
                    }

                } return tokenValue2;
                case ExprToken_T.IntConst:
                    this.bytecode.push({ type: "uint32", value: pkg.read(uint32).value as number });
                    this.bytecodeLength = this.bytecodeLength + 4;
                    return tokenValue2;
                case ExprToken_T.FloatConst:
                    this.bytecode.push({ type: "float", value: pkg.read(float).value as number });
                    this.bytecodeLength = this.bytecodeLength + 4;
                    break;
                case ExprToken_T.StringConst: {
                    let constant = "";

                    do {
                        const charCode = pkg.read(uint8).value as number;

                        if (charCode === 0) break;

                        constant = constant + String.fromCharCode(charCode);

                    } while (true);

                    this.bytecodeLength = this.bytecodeLength + constant.length + 1;
                    this.bytecode.push({ type: "string", value: constant });

                } return tokenValue2;
                case ExprToken_T.NameConst:
                case ExprToken_T.FloatToInt: {
                    const objectIndex = pkg.read(compat32).value as number;

                    // debugger;

                    this.bytecode.push({ type: "compat", value: objectIndex });
                    this.bytecodeLength = this.bytecodeLength + 4;
                } return tokenValue2;
                case ExprToken_T.RotationConst:
                    this.bytecode.push({ type: "rotator", value: /*new FRotator().load(pkg)*/ BufferValue.allocBytes(3 * 4) });
                    this.bytecodeLength = this.bytecodeLength + 4 * 3;
                    return tokenValue2;
                case ExprToken_T.VectorConst:
                    this.bytecode.push({ type: "vector", value: /*new FVector().load(pkg)*/ BufferValue.allocBytes(3 * 4) });
                    this.bytecodeLength = this.bytecodeLength + 4 * 3;
                    break;
                case ExprToken_T.ByteConst:
                case ExprToken_T.IntConstByte:
                    this.bytecode.push({ type: "byte", value: pkg.read(uint8).value as number });
                    this.bytecodeLength = this.bytecodeLength + 1;
                    break;
                case ExprToken_T.Iterator:
                    this.readToken(pkg, depth);
                    this.bytecode.push({ type: "uint16", value: pkg.read(uint16).value as number });
                    this.bytecodeLength = this.bytecodeLength + 2;
                    break;
                case ExprToken_T.StructCmpEq:
                case ExprToken_T.StructCmpNe: {
                    // 1981

                    debugger;

                    const objectIndex = pkg.read(compat32).value as number;

                    this.bytecode.push({ type: "compat", value: objectIndex });
                    this.bytecodeLength = this.bytecodeLength + 4;

                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                } break;
                case ExprToken_T.UnicodeStringConst:
                    // do
                    // {
                    //     likelyReadUint16((int)v3, v9 + *likelyBytecodeLength);
                    //     likelyBytecodeLength8 = *likelyBytecodeLength + 2;
                    //     *likelyBytecodeLength = likelyBytecodeLength8;
                    //     v9 = this[21];
                    // }
                    // while ( *(_BYTE *)(likelyBytecodeLength8 + v9 - 1) );
                    throw new Error("do something here");
                    break;
                case ExprToken_T.BoolToByte:
                case ExprToken_T.BoolToInt:
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.BoolToFloat:
                    // sub_10104296(v3, v11);
                    // v28 = *likelyBytecodeLength + 4;
                    // *likelyBytecodeLength = v28;
                    // sub_10104296(v3, v28 + this[21]);
                    // v29 = *likelyBytecodeLength + 4;
                    // *likelyBytecodeLength = v29;
                    // sub_10104296(v3, v29 + this[21]);
                    // *likelyBytecodeLength += 4;
                    // do
                    // {
                    //     likelyReadByte(v3, this[21] + *likelyBytecodeLength);
                    //     v30 = *likelyBytecodeLength + 1;
                    //     *likelyBytecodeLength = v30;
                    // }
                    // while ( *(_BYTE *)(v30 + this[21] - 1) );
                    throw new Error("do something here");
                    break;
                case ExprToken_T.FloatToByte:
                    // (*(void (__thiscall **)(_DWORD *, int))(*v3 + 24))(v3, v11);
                    // likelyBytecodeLength5 = *likelyBytecodeLength + 4;
                    // *likelyBytecodeLength = likelyBytecodeLength5;
                    // (*(void (__thiscall **)(_DWORD *, int))(*v3 + 28))(v3, likelyBytecodeLength5 + this[21]);
                    // *likelyBytecodeLength += 4;
                    throw new Error("do something here");
                    break;
                default: throw new Error(`Bad token '${tokenValue}'`);
            }
        } else {
            if (tokenValue >= ExprToken_T.MaxConversion && tokenValue < ExprToken_T.FirstNative) {
                this.bytecode.push({ type: "uint8", value: pkg.read(uint8).value as number });
                this.bytecodeLength = this.bytecodeLength + 1;
            }

            while (this.readToken(pkg, depth) !== ExprToken_T.EndFunctionParms);

            if (this.bytecodeLength < this.scriptSize) {
                const pos = pkg.tell();
                const token2 = pkg.read(uint8).value as ExprToken_T;

                // this.bytecode.push(token2);
                // this.bytecodeLength++;

                if (token2 === ExprToken_T.BoolToFloat) {
                    throw new Error("do something here");
                }

                pkg.seek(pos, "set");
            }
        }

        depth++;

        return tokenValue2;
    }
}

export default UMetaStruct;
export { UMetaStruct };

const tokenNames = [
    "LocalVariable", "InstanceVariable", "DefaultVariable", "0x03", "Return", "Switch", "Jump", "JumpIfNot",
    "Stop", "Assert", "Case", "Nothing", "LabelTable", "GotoLabel", "EatString", "Let",
    "DynArrayElement", "New", "ClassContext", "MetaCast", "LetBool", "Unknown0x15", "EndFunctionParms", "Self",
    "Skip", "Context", "ArrayElement", "VirtualFunction", "FinalFunction", "IntConst", "FloatConst", "StringConst",
    "ObjectConst", "NameConst", "RotationConst", "VectorConst", "ByteConst", "IntZero", "IntOne", "True",
    "False", "NativeParm", "NoObject", "Unknown0x2b", "IntConstByte", "BoolVariable", "DynamicCast", "Iterator",
    "IteratorPop", "IteratorNext", "StructCmpEq", "StructCmpNe", "UnicodeStringConst", "0x35", "StructMember", "0x37",
    "GlobalFunction", "RotatorToVector", "ByteToInt", "ByteToBool", "ByteToFloat", "IntToByte", "IntToBool", "IntToFloat",
    "BoolToByte", "BoolToInt", "BoolToFloat", "FloatToByte", "FloatToInt", "FloatToBool", "Unknown0x46", "ObjectToBool",
    "NameToBool", "StringToByte", "StringToInt", "StringToBool", "StringToFloat", "StringToVector", "StringToRotator", "VectorToBool",
    "VectorToRotator", "RotatorToBool", "ByteToString", "IntToString", "BoolToString", "FloatToString", "ObjectToString", "NameToString",
    "VectorToString", "RotatorToString", "0x5a", "0x5b", "0x5c", "0x5d", "0x5e", "0x5f",
    "ExtendedNative60", "ExtendedNative61", "ExtendedNative62", "ExtendedNative63", "ExtendedNative64", "ExtendedNative65", "ExtendedNative66", "ExtendedNative67",
    "ExtendedNative68", "ExtendedNative69", "ExtendedNative6A", "ExtendedNative6B", "ExtendedNative6C", "ExtendedNative6D", "ExtendedNative6E", "ExtendedNative6F",
    "Native70", "Native71", "Native72", "Native73", "Native74", "Native75", "Native76", "Native77",
    "Native78", "Native79", "Native7A", "Native7B", "Native7C", "Native7D", "Native7E", "Native7F",
    "Native80", "Native81", "Native82", "Native83", "Native84", "Native85", "Native86", "Native87",
    "Native88", "Native89", "Native8A", "Native8B", "Native8C", "Native8D", "Native8E", "Native8F",
    "Native90", "Native91", "Native92", "Native93", "Native94", "Native95", "Native96", "Native97",
    "Native98", "Native99", "Native9A", "Native9B", "Native9C", "Native9D", "Native9E", "Native9F",
    "NativeA0", "NativeA1", "NativeA2", "NativeA3", "NativeA4", "NativeA5", "NativeA6", "NativeA7",
    "NativeA8", "NativeA9", "NativeAA", "NativeAB", "NativeAC", "NativeAD", "NativeAE", "NativeAF",
    "NativeB0", "NativeB1", "NativeB2", "NativeB3", "NativeB4", "NativeB5", "NativeB6", "NativeB7",
    "NativeB8", "NativeB9", "NativeBA", "NativeBB", "NativeBC", "NativeBD", "NativeBE", "NativeBF",
    "NativeC0", "NativeC1", "NativeC2", "NativeC3", "NativeC4", "NativeC5", "NativeC6", "NativeC7",
    "NativeC8", "NativeC9", "NativeCA", "NativeCB", "NativeCC", "NativeCD", "NativeCE", "NativeCF",
    "NativeD0", "NativeD1", "NativeD2", "NativeD3", "NativeD4", "NativeD5", "NativeD6", "NativeD7",
    "NativeD8", "NativeD9", "NativeDA", "NativeDB", "NativeDC", "NativeDD", "NativeDE", "NativeDF",
    "NativeE0", "NativeE1", "NativeE2", "NativeE3", "NativeE4", "NativeE5", "NativeE6", "NativeE7",
    "NativeE8", "NativeE9", "NativeEA", "NativeEB", "NativeEC", "NativeED", "NativeEE", "NativeEF",
    "NativeF0", "NativeF1", "NativeF2", "NativeF3", "NativeF4", "NativeF5", "NativeF6", "NativeF7",
    "NativeF8", "NativeF9", "NativeFA", "NativeFB", "NativeFC", "NativeFD", "NativeFE", "NativeFF"
];

enum ExprToken_T {
    // Variable references
    LocalVariable = 0x00,    // A local variable
    InstanceVariable = 0x01,    // An object variable
    DefaultVariable = 0x02,    // Default variable for a concrete object

    // Tokens
    Return = 0x04,    // Return from function
    Switch = 0x05,    // Switch
    Jump = 0x06,    // Goto a local address in code
    JumpIfNot = 0x07,    // Goto if not expression
    Stop = 0x08,    // Stop executing state code
    Assert = 0x09,    // Assertion
    Case = 0x0A,    // Case
    Nothing = 0x0B,    // No operation
    LabelTable = 0x0C,    // Table of labels
    GotoLabel = 0x0D,    // Goto a label
    EatString = 0x0E, // Ignore a dynamic string
    Let = 0x0F,    // Assign an arbitrary size value to a variable
    DynArrayElement = 0x10, // Dynamic array element
    New = 0x11, // New object allocation
    ClassContext = 0x12, // Class default metaobject context
    MetaCast = 0x13, // Metaclass cast
    LetBool = 0x14, // Let boolean variable
    Unknown0x15 = 0x15,
    EndFunctionParms = 0x16,    // End of function call parameters
    Self = 0x17,    // Self object
    Skip = 0x18,    // Skippable expression
    Context = 0x19,    // Call a function through an object context
    ArrayElement = 0x1A,    // Array element
    VirtualFunction = 0x1B,    // A function call with parameters
    FinalFunction = 0x1C,    // A prebound function call with parameters
    IntConst = 0x1D,    // Int constant
    FloatConst = 0x1E,    // Floating point constant
    StringConst = 0x1F,    // String constant
    ObjectConst = 0x20,    // An object constant
    NameConst = 0x21,    // A name constant
    RotationConst = 0x22,    // A rotation constant
    VectorConst = 0x23,    // A vector constant
    ByteConst = 0x24,    // A byte constant
    IntZero = 0x25,    // Zero
    IntOne = 0x26,    // One
    True = 0x27,    // Bool True
    False = 0x28,    // Bool False
    NativeParm = 0x29, // Native function parameter offset
    NoObject = 0x2A,    // NoObject
    Unknown0x2b = 0x2B,
    IntConstByte = 0x2C,    // Int constant that requires 1 byte
    BoolVariable = 0x2D,    // A bool variable which requires a bitmask
    DynamicCast = 0x2E,    // Safe dynamic class casting
    Iterator = 0x2F, // Begin an iterator operation
    IteratorPop = 0x30, // Pop an iterator level
    IteratorNext = 0x31, // Go to next iteration
    StructCmpEq = 0x32,    // Struct binary compare-for-equal
    StructCmpNe = 0x33,    // Struct binary compare-for-unequal
    UnicodeStringConst = 0x34, // Unicode string constant
    //
    StructMember = 0x36, // Struct member
    UnkMember = 0x37,
    //
    GlobalFunction = 0x38, // Call non-state version of a function

    // Native conversions.
    MinConversion = 0x39,    // Minimum conversion token
    RotatorToVector = 0x39,
    ByteToInt = 0x3A,
    ByteToBool = 0x3B,
    ByteToFloat = 0x3C,
    IntToByte = 0x3D,
    IntToBool = 0x3E,
    IntToFloat = 0x3F,
    BoolToByte = 0x40,
    BoolToInt = 0x41,
    BoolToFloat = 0x42,
    FloatToByte = 0x43,
    FloatToInt = 0x44,
    FloatToBool = 0x45,
    Unknown0x46 = 0x46,
    ObjectToBool = 0x47,
    NameToBool = 0x48,
    StringToByte = 0x49,
    StringToInt = 0x4A,
    StringToBool = 0x4B,
    StringToFloat = 0x4C,
    StringToVector = 0x4D,
    StringToRotator = 0x4E,
    VectorToBool = 0x4F,
    VectorToRotator = 0x50,
    RotatorToBool = 0x51,
    ByteToString = 0x52,
    IntToString = 0x53,
    BoolToString = 0x54,
    FloatToString = 0x55,
    ObjectToString = 0x56,
    NameToString = 0x57,
    VectorToString = 0x58,
    RotatorToString = 0x59,
    MaxConversion = 0x60,    // Maximum conversion token
    ExtendedNative = 0x60,
    FirstNative = 0x70,
};