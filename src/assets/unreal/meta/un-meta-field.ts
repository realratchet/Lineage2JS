
import BufferValue from "../../buffer-value";
import UMetaObject from "./un-meta-object";

const compat32 = new BufferValue(BufferValue.compat32);

class UMetaField extends UMetaObject {
    protected superFieldId: number;
    protected nextFieldId: number;

    protected promisesLoading = new Array<Promise<any>>();
    protected superField: UMetaField;
    protected nextField: UMetaField;

    protected doLoad(pkg: UPackage, exp: UExport): void {
        super.doLoad(pkg, exp);

        this.superFieldId = pkg.read(compat32).value as number;
        this.nextFieldId = pkg.read(compat32).value as number;

        // if (this.superFieldId === exp.index) debugger;
        // if (this.nextFieldId === exp.index) this.nextFieldId = 0;

        if (this.superFieldId !== 0) this.promisesLoading.push(new Promise(async resolve => {
            const object = await pkg.fetchObject(this.superFieldId) as unknown as UMetaField;
            this.superField = object;

            resolve(object);
        }));

        if (this.nextFieldId !== 0) this.promisesLoading.push(new Promise(async resolve => {
            const object = await pkg.fetchObject(this.nextFieldId) as unknown as UMetaField;
            this.nextField = object;

            resolve(object);
        }));

    }

    public async onDecodeReady(): Promise<void> {
        try {
            await Promise.all(this.promisesLoading);
        } catch (e) {
            // debugger;
            throw e;
        }
    }

    public async constructClass(): Promise<void> {
        if (this.nextFieldId !== 0 || this.superFieldId !== 0)
            debugger;

        await this.onDecodeReady();
    }
}

export default UMetaField;
export { UMetaField };