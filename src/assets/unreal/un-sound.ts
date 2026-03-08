import UObject, { BufferValue } from "@l2js/core";
import { FPrimitiveArrayLazy } from "@l2js/core/src/unreal/un-array";

abstract class USound extends UObject {
    protected fileType: string;
    protected likelihood: number;
    protected data = new FPrimitiveArrayLazy(BufferValue.uint8);

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        super.doLoad(pkg, exp);

        const nameIndex = pkg.read("compat32");
        
        this.fileType = pkg.nameTable[nameIndex].name;
        this.data.load(pkg);

        this.readHead = pkg.tell();
    }

    public getAudioData(): Uint8Array {
        return this.data.getTypedArray().slice() as Uint8Array;
    }

    public getFileType(): string {
        return this.fileType;
    }
}

export default USound;
export { USound };