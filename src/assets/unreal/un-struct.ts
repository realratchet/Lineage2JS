import UObject from "./un-object";
import UPackage from "./un-package";
import UExport from "./un-export";
import BufferValue from "../buffer-value";

class UStruct extends UObject {
    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        super.load(pkg, exp);

        debugger;

        return this;
    }
}

export default UStruct;
export { UStruct };