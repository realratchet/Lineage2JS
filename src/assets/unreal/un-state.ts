import BufferValue from "../buffer-value";
import UExport from "./un-export";
import UObject from "./un-object";
import UPackage from "./un-package";
import UStruct from "./un-struct";

class UState extends UStruct {
    protected probeMask: bigint;
    protected ignoreMask: bigint;
    protected stateFlags: number;
    protected labelTableOffset: number;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const uint64 = new BufferValue(BufferValue.uint64);
        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);

        this.probeMask = pkg.read(uint64).value as bigint;
        this.ignoreMask = pkg.read(uint64).value as bigint;
        this.stateFlags = pkg.read(uint32).value as number;
        this.labelTableOffset = pkg.read(uint16).value as number;


        // debugger;
    }
 }

export default UState;
export { UState };