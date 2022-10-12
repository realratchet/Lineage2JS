import BufferValue from "../buffer-value";
import UObject from "./un-object";

class UField extends UObject {
    protected superFieldId: number;
    protected nextFieldId: number;
    protected superField: UField;
    protected nextField: UField;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        const compat32 = new BufferValue(BufferValue.compat32);

        this.superFieldId = pkg.read(compat32).value as number;
        this.nextFieldId = pkg.read(compat32).value as number;

        this.promisesLoading.push(new Promise<void>(async resolve => {

            if (this.superFieldId !== 0)
                this.superField = await pkg.fetchObject<UField>(this.superFieldId);

            if (this.nextFieldId !== 0)
                this.nextField = await pkg.fetchObject<UField>(this.superFieldId);

            resolve();
        }));
    }

}

export default UField;
export { UField };