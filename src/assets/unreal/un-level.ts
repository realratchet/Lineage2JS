import UObject from "./un-object";
import UPackage from "./un-package";
import UExport from "./un-export";
import BufferValue from "../buffer-value";

class ULevel extends UObject {
    protected objectList: UObject[] = [];

    public async load(pkg: UPackage, exp: UExport) {
        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

        await super.load(pkg, exp);

        let dbNum = await pkg.read(int32).value as number;
        let dbMax = await pkg.read(int32).value as number;

        const objectIds = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value as number);

        dbNum = await pkg.read(int32).value as number;
        dbMax = await pkg.read(int32).value as number;

        const objectIds2 = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value as number);

        for(let objectId of objectIds) {
            const object = await pkg.fetchObject(objectId);

            if (object) {
                this.objectList.push(object);
                console.log(`Added object of type: '${object.constructor.name}'`);
            }
        }

        // debugger;

        for(let objectId of objectIds2) {
            const object = await pkg.fetchObject(objectId);

            if (object) {
                this.objectList.push(object);
                console.log(`Added object of type: '${object.constructor.name}'`);
            }
        }

        debugger;

        return this;
    }
}

export default ULevel;
export { ULevel };