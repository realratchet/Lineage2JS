import BufferValue from "../buffer-value";
import UExport from "./un-export";
import UObject from "./un-object";
import UPackage from "./un-package";

class UField extends UObject {
    public superFieldId: number = 0;
    public nextFieldId: number = 0;
    public superField: UField;
    public nextField: UField;

    public readonly isField = true;

    protected doReadSuperFields: Function;

    protected loadSuper() {
        if (!this.doReadSuperFields) return;

        const fn = this.doReadSuperFields;
        this.doReadSuperFields = null;

        fn();
    }

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        if (this.constructor.name !== "UClass")
            super.doLoad(pkg, exp);

        const compat32 = new BufferValue(BufferValue.compat32);

        this.superFieldId = pkg.read(compat32).value as number;

        this.doReadSuperFields = () => {
            if (this.superFieldId !== 0)
                this.superField = pkg.fetchObject<UField>(this.superFieldId);
        }

        // if (this.superFieldId !== 0) {
        //     const object = pkg.fetchObject<UField>(this.superFieldId);

        //     this.superField = object;

        //     // debugger;
        // }

        this.nextFieldId = pkg.read(compat32).value as number;

        // if (this.nextFieldId !== 0) {
        //     const object = pkg.fetchObject<UField>(this.nextFieldId);

        //     this.nextField = object;

        //     // debugger;
        // }

        // if (this.superFieldId === exp.index) this.superFieldId = 0;
        // if (this.nextFieldId === exp.index) this.nextFieldId = 0;

        // if (this.nextFieldId !== 0) this.promisesLoading.push(new Promise(async resolve => {
        //     const object = await pkg.fetchObject<UField>(this.nextFieldId);
        //     this.nextField = object;

        //     resolve(object);
        // }));
    }

    // public async onDecodeReady(): Promise<void> {
    //     await super.onDecodeReady();

    //     if (this.superField) await this.superField.onDecodeReady();
    // }
}

export default UField;
export { UField };