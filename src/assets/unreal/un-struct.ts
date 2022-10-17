import BufferValue from "../buffer-value";
import UExport from "./un-export";
import UField from "./un-field";
import UObject from "./un-object";
import UPackage from "./un-package";
import UTextBuffer from "./un-text-buffer";

class UStruct extends UField {
    protected textBufferId: number;
    protected textBuffer: UTextBuffer;

    protected childrenId: number;
    protected children: UField;

    protected friendlyName: string;
    protected line: number;
    protected textPos: number;
    protected unkObjectId: number = 0;
    protected unkObject: UObject;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        const compat32 = new BufferValue(BufferValue.compat32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const int32 = new BufferValue(BufferValue.int32);

        // debugger;

        this.textBufferId = pkg.read(compat32).value as number;
        this.childrenId = pkg.read(compat32).value as number;
        this.friendlyName = pkg.nameTable[pkg.read(compat32).value as number].name.value as string;

        console.assert(typeof this.friendlyName === "string" && this.friendlyName !== "None", "Must have a friendly name");

        if (0x77 < verArchive) {
            this.unkObjectId = pkg.read(compat32).value as number;
        }


        // if (verLicense >= 0x19)
        //     this.unkNum0 = pkg.read(int32).value as number;

        // debugger;

        this.line = pkg.read(uint32).value as number;
        this.textPos = pkg.read(uint32).value as number;

        let scriptSize = pkg.read(uint32).value as number;

        // debugger;

        while (this.bytecode.length < scriptSize)
            this.readToken(pkg, 0);

        // debugger;

        this.promisesLoading.push(new Promise<void>(async resolve => {

            if (this.unkObjectId !== 0) {
                this.unkObject = await pkg.fetchObject<UObject>(this.textBufferId);

                debugger;
            }

            if (this.textBufferId !== 0)
                this.textBuffer = await pkg.fetchObject<UTextBuffer>(this.textBufferId);

            if (this.childrenId !== 0) {
                let children = await pkg.fetchObject<UField>(this.childrenId);

                debugger;

                // while (children) {
                //     debugger;
                // }
            }

            resolve();
        }));
    }

    protected bytecodePlainText = "";
    protected bytecode: any[] = [];

    protected readToken(pkg: UPackage, depth: number) {
        if (depth === 64) throw new Error("Too deep");

        depth++;

        const uint8 = new BufferValue(BufferValue.uint8);
        const uint16 = new BufferValue(BufferValue.uint16);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);
        const char = new BufferValue(BufferValue.char);


        const token = pkg.read(uint8).value as ExprToken_T;

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        this.bytecode.push(token);

        let tokenDebug = new Array(depth - 1).fill("\t").join("");
        tokenDebug += tokenNames[token];
        tokenDebug += "\r\n";
        this.bytecodePlainText += tokenDebug;

        if (token >= ExprToken_T.MinConversion && token <= ExprToken_T.MaxConversion)
            this.readToken(pkg, depth);
        else if (token >= ExprToken_T.FirstNative)
            while (this.readToken(pkg, depth) != ExprToken_T.EndFunctionParms);
        else if (token >= ExprToken_T.ExtendedNative) {
            const token2 = pkg.read(uint8).value as ExprToken_T;

            this.bytecode.push(token2);

            while (this.readToken(pkg, depth) != ExprToken_T.EndFunctionParms);
        } else if (token === ExprToken_T.VirtualFunction) {
            const nameIdx = pkg.read(compat32).value as number;

            this.bytecode.push(nameIdx);

            while (this.readToken(pkg, depth) != ExprToken_T.EndFunctionParms);
        } else if (token === ExprToken_T.FinalFunction) {
            const objectIdx = pkg.read(compat32).value as number;

            this.bytecode.push(objectIdx);

            while (this.readToken(pkg, depth) != ExprToken_T.EndFunctionParms);
        } else if (token === ExprToken_T.GlobalFunction) {
            const nameIdx = pkg.read(compat32).value as number;

            this.bytecode.push(nameIdx);

            while (this.readToken(pkg, depth) != ExprToken_T.EndFunctionParms);
        } else if (token === ExprToken_T.LetBool && verArchive <= 61) {
            while (true) {
                while (true) {
                    const size = pkg.read(uint8).value as number;

                    this.bytecode.push(size);

                    if (size === 0) break;

                    this.bytecode.push(pkg.read(uint8).value as number);
                }
            }
        } else {
            switch (token) {
                case ExprToken_T.LocalVariable:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    break;
                case ExprToken_T.InstanceVariable:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    break;
                case ExprToken_T.DefaultVariable:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    break;
                case ExprToken_T.Return:
                    if (verArchive > 61)
                        this.readToken(pkg, depth);
                    break;
                case ExprToken_T.Switch:
                    this.bytecode.push(pkg.read(uint8).value as number);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.Jump:
                    this.bytecode.push(pkg.read(uint16).value as number);
                    break;
                case ExprToken_T.JumpIfNot:
                    this.bytecode.push(pkg.read(uint16).value as number);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.Stop: break;
                case ExprToken_T.Assert:
                    this.bytecode.push(pkg.read(uint16).value as number);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.Case: {
                    const nextoffset = pkg.read(uint16).value as number;

                    this.bytecode.push(nextoffset);

                    if (nextoffset != 0xffff)
                        this.readToken(pkg, depth);
                } break;
                case ExprToken_T.Nothing: break;
                case ExprToken_T.LabelTable:
                    while (true) {
                        const nameIndex = pkg.read(compat32).value as number;

                        this.bytecode.push(nameIndex);
                        this.bytecode.push(pkg.read(uint32).value as number);

                        if (pkg.nameTable[nameIndex].name.value as string === "None")
                            break;
                    }
                    break;
                case ExprToken_T.GotoLabel:
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.EatString:
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.Let:
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.DynArrayElement:
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
                    this.readToken(pkg, depth);
                    this.bytecode.push(pkg.read(uint16).value as number);
                    this.bytecode.push(pkg.read(uint8).value as number);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.MetaCast:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.LetBool:
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.Unknown0x15:
                    /*this.readToken(pkg, depth);*/
                    break;
                case ExprToken_T.EndFunctionParms: break;
                case ExprToken_T.Self: break;
                case ExprToken_T.Skip:
                    this.bytecode.push(pkg.read(uint16).value as number);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.Context:
                    this.readToken(pkg, depth);
                    this.bytecode.push(pkg.read(uint16).value as number);
                    this.bytecode.push(pkg.read(uint8).value as number);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.ArrayElement:
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.IntConst:
                    this.bytecode.push(pkg.read(uint32).value as number);
                    break;
                case ExprToken_T.FloatConst:
                    this.bytecode.push(pkg.read(float).value as number);
                    break;
                case ExprToken_T.StringConst:
                    this.bytecode.push(pkg.read(char).value as string);
                    break;
                case ExprToken_T.ObjectConst:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    break;
                case ExprToken_T.NameConst:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    break;
                case ExprToken_T.RotationConst:
                    this.bytecode.push(pkg.read(uint32).value as number);
                    this.bytecode.push(pkg.read(uint32).value as number);
                    this.bytecode.push(pkg.read(uint32).value as number);
                    break;
                case ExprToken_T.VectorConst:
                    this.bytecode.push(pkg.read(float).value as number);
                    this.bytecode.push(pkg.read(float).value as number);
                    this.bytecode.push(pkg.read(float).value as number);
                    break;
                case ExprToken_T.ByteConst:
                    this.bytecode.push(pkg.read(uint8).value as number);
                    break;
                case ExprToken_T.IntZero: break;
                case ExprToken_T.IntOne: break;
                case ExprToken_T.True: break;
                case ExprToken_T.False: break;
                case ExprToken_T.NativeParm:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    break;
                case ExprToken_T.NoObject: break;
                case ExprToken_T.Unknown0x2b:
                    this.bytecode.push(pkg.read(uint8).value as number);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.IntConstByte:
                    this.bytecode.push(pkg.read(uint8).value as number);
                    break;
                case ExprToken_T.BoolVariable:
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.DynamicCast:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    this.readToken(pkg, depth); break;
                case ExprToken_T.Iterator:
                    this.readToken(pkg, depth);
                    this.bytecode.push(pkg.read(uint16).value as number);
                    break;
                case ExprToken_T.IteratorPop: break;
                case ExprToken_T.IteratorNext: break;
                case ExprToken_T.StructCmpEq:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.StructCmpNe:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    this.readToken(pkg, depth);
                    this.readToken(pkg, depth);
                    break;
                case ExprToken_T.UnicodeStringConst:
                    debugger;
                    /*PushUnicodeZ(stream -> ReadUnicodeZ());*/
                    break;
                case ExprToken_T.StructMember:
                    this.bytecode.push(pkg.read(compat32).value as number);
                    this.readToken(pkg, depth);
                    break;
                default: throw Error("Unknown script bytecode token encountered");
            }
        }

        return token;
    }
}

export default UStruct;
export { UStruct };

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
    LocalVariable = 0x00,	// A local variable
    InstanceVariable = 0x01,	// An object variable
    DefaultVariable = 0x02,	// Default variable for a concrete object

    // Tokens
    Return = 0x04,	// Return from function
    Switch = 0x05,	// Switch
    Jump = 0x06,	// Goto a local address in code
    JumpIfNot = 0x07,	// Goto if not expression
    Stop = 0x08,	// Stop executing state code
    Assert = 0x09,	// Assertion
    Case = 0x0A,	// Case
    Nothing = 0x0B,	// No operation
    LabelTable = 0x0C,	// Table of labels
    GotoLabel = 0x0D,	// Goto a label
    EatString = 0x0E, // Ignore a dynamic string
    Let = 0x0F,	// Assign an arbitrary size value to a variable
    DynArrayElement = 0x10, // Dynamic array element
    New = 0x11, // New object allocation
    ClassContext = 0x12, // Class default metaobject context
    MetaCast = 0x13, // Metaclass cast
    LetBool = 0x14, // Let boolean variable
    Unknown0x15 = 0x15,
    EndFunctionParms = 0x16,	// End of function call parameters
    Self = 0x17,	// Self object
    Skip = 0x18,	// Skippable expression
    Context = 0x19,	// Call a function through an object context
    ArrayElement = 0x1A,	// Array element
    VirtualFunction = 0x1B,	// A function call with parameters
    FinalFunction = 0x1C,	// A prebound function call with parameters
    IntConst = 0x1D,	// Int constant
    FloatConst = 0x1E,	// Floating point constant
    StringConst = 0x1F,	// String constant
    ObjectConst = 0x20,	// An object constant
    NameConst = 0x21,	// A name constant
    RotationConst = 0x22,	// A rotation constant
    VectorConst = 0x23,	// A vector constant
    ByteConst = 0x24,	// A byte constant
    IntZero = 0x25,	// Zero
    IntOne = 0x26,	// One
    True = 0x27,	// Bool True
    False = 0x28,	// Bool False
    NativeParm = 0x29, // Native function parameter offset
    NoObject = 0x2A,	// NoObject
    Unknown0x2b = 0x2B,
    IntConstByte = 0x2C,	// Int constant that requires 1 byte
    BoolVariable = 0x2D,	// A bool variable which requires a bitmask
    DynamicCast = 0x2E,	// Safe dynamic class casting
    Iterator = 0x2F, // Begin an iterator operation
    IteratorPop = 0x30, // Pop an iterator level
    IteratorNext = 0x31, // Go to next iteration
    StructCmpEq = 0x32,	// Struct binary compare-for-equal
    StructCmpNe = 0x33,	// Struct binary compare-for-unequal
    UnicodeStringConst = 0x34, // Unicode string constant
    //
    StructMember = 0x36, // Struct member
    //
    GlobalFunction = 0x38, // Call non-state version of a function

    // Native conversions.
    MinConversion = 0x39,	// Minimum conversion token
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
    MaxConversion = 0x60,	// Maximum conversion token
    ExtendedNative = 0x60,
    FirstNative = 0x70
};