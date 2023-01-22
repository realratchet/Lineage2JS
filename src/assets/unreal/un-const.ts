import BufferValue from "../buffer-value";
import FArray from "./un-array";
import UField from "./un-field";
import FNumber from "./un-number";
import FString from "./un-string";

class UConst extends UField {
    protected value: string;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.value = new FString().load(pkg).value as string;
        this.readHead = pkg.tell();
    }
}

export default UConst;
export { UConst };