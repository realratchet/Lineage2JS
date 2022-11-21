import BufferValue from "../buffer-value";
import FArray from "./un-array";
import UField from "./un-field";
import FNumber from "./un-number";

class UEnum extends UField {
    protected names: string[];

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        this.names = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg).map(v => pkg.nameTable[v.value].name.value as string);

        this.readHead = pkg.tell();
    }
}

export default UEnum;
export { UEnum };