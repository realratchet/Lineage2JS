import BufferValue from "../buffer-value";
import UObject from "./un-object";

class UField extends UObject {
    public superFieldId: number = 0;
    public nextFieldId: number = 0;
    public superField: UField;
    public nextField: UField;

    public readonly isField = true;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        if (this.constructor.name !== "UClass")
            super.doLoad(pkg, exp);

        const compat32 = new BufferValue(BufferValue.compat32);

        this.superFieldId = pkg.read(compat32).value as number;
        this.nextFieldId = pkg.read(compat32).value as number;

        // if (this.superFieldId === exp.index) this.superFieldId = 0;
        // if (this.nextFieldId === exp.index) this.nextFieldId = 0;

        this.promisesLoading.push(new Promise<void>(async resolve => {

            if (this.superFieldId !== 0)
                this.superField = await pkg.fetchObject<UField>(this.superFieldId);

            if (this.nextFieldId !== 0)
                this.nextField = await pkg.fetchObject<UField>(this.nextFieldId);

            resolve();
        }));
    }

}

export default UField;
export { UField };