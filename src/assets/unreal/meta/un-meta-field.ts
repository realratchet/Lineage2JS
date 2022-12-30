
import BufferValue from "../../buffer-value";
import UMetaObject from "./un-meta-object";

const compat32 = new BufferValue(BufferValue.compat32);

class UMetaField extends UMetaObject {
    protected superFieldId: number;
    protected nextFieldId: number;

    protected doLoad(pkg: UPackage, exp: UExport): void {
        this.superFieldId = pkg.read(compat32).value as number;
        this.nextFieldId = pkg.read(compat32).value as number;

        if (this.superFieldId === exp.index) debugger;
        if (this.nextFieldId === exp.index) debugger;
    }

    public async constructClass(cls: ObjectConstructor): Promise<void> {
        debugger;
    }
}

export default UMetaField;
export { UMetaField };