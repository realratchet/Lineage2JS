import UObject, { BufferValue } from "@l2js/core";
import { FPrimitiveArrayLazy } from "@l2js/core/src/unreal/un-array";

abstract class USound extends UObject {
    protected fileType: string;
    protected likelihood: number;
    protected data = new FPrimitiveArrayLazy(BufferValue.uint8);

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        super.doLoad(pkg, exp);

        const compat = new BufferValue(BufferValue.compat32);
        const nameIndex = pkg.read(compat).value;
        
        this.fileType = pkg.nameTable[nameIndex].name;
        this.data.load(pkg);

        this.readHead = pkg.tell();

        const wav = this.data.getTypedArray().slice();
        const blob = new Blob([wav.buffer], { type: "application/octet-stream" });
        const f = URL.createObjectURL(blob);

        console.log(f);

        debugger;
    }
}

export default USound;
export { USound };