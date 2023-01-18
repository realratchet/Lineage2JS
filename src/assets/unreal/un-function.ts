import BufferValue from "../buffer-value";
import UExport from "./un-export";
import UObject from "./un-object";
import UPackage from "./un-package";
import UStruct from "./un-struct";

class UFunction extends UStruct {
    protected paramSize: number;
    protected nativeFuncIndex: number;
    protected numParams: number;
    protected operatorPrecendence: number;
    protected returnValueOffset: number;
    protected funcFlags: FunctionFlags_T;
    protected replicationOffset: number;

    protected static getConstructorName() { return "Function"; }

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        const uint8 = new BufferValue(BufferValue.uint8);
        const uint16 = new BufferValue(BufferValue.uint16);
        const uint32 = new BufferValue(BufferValue.uint32);

        if (verArchive <= 0x40)
            this.paramSize = pkg.read(uint16).value as number;

        this.nativeFuncIndex = pkg.read(uint16).value as number;

        if (verArchive <= 0x40)
            this.numParams = pkg.read(uint8).value as number;

        this.operatorPrecendence = pkg.read(uint8).value as number;

        if (verArchive <= 0x40)
            this.returnValueOffset = pkg.read(uint16).value as number;

        this.funcFlags = pkg.read(uint32).value as number;

        if (this.allFlags(this.funcFlags, FunctionFlags_T.Net))
            this.replicationOffset = pkg.read(uint16).value as number;

        this.readHead = pkg.tell();

        // debugger;
    }

    public allFlags(value: FunctionFlags_T, flags: FunctionFlags_T): boolean { return (value & flags) === flags; }
    public anyFlags(value: FunctionFlags_T, flags: FunctionFlags_T): boolean { return (value & flags) !== 0; }
}

export default UFunction;
export { UFunction };

enum FunctionFlags_T {
    Final = 0x00000001,         // Function is final(prebindable, non - overridable function)
    Defined = 0x00000002,       // Function has been defined(not just declared)
    Iterator = 0x00000004,      // Function is an iterator
    Latent = 0x00000008,        // Function is a latent state function
    PreOperator = 0x00000010,   // Unary operator is a prefix operator
    Singular = 0x00000020,      // Function cannot be reentered
    Net = 0x00000040,           // Function is network - replicated
    NetReliable = 0x00000080,   // Function should be sent reliably on the network
    Simulated = 0x00000100,     // Function executed on the client side
    Exec = 0x00000200,          // Executable from command line
    Native = 0x00000400,        // Native function
    Event = 0x00000800,         // Event function
    Operator = 0x00001000,      // Operator function
    Static = 0x00002000,        // Static function
    NoExport = 0x00004000,      // Don't export intrinsic function to C++
    Const = 0x00008000,         // Function doesn't modify this object
    Invariant = 0x00010000      // Return value is purely dependent on parameters; no state dependencies or internal state changes
};