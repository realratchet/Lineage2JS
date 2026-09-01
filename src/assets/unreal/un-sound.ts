import { BufferValue, type APackage, type UExport, FPrimitiveArrayLazy } from "@l2js/core";
import UObject from "./un-object";

export abstract class USound extends UObject {
    protected fileType: string;
    protected likelihood: number;
    protected data = new FPrimitiveArrayLazy(BufferValue.uint8);

    public doLoad(pkg: APackage, exp: UExport) {
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
