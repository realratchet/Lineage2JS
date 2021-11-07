import UObject from "./un-object";
import UPackage from "./un-package";
import UExport from "./un-export";
import BufferValue from "../buffer-value";
import FURL from "./un-url";
import FArray from "./un-array";
import FNumber from "./un-number";

class ULevel extends UObject {
    protected objectList: UObject[] = [];
    protected url: FURL = new FURL;
    protected reachSpecs: FArray = new FArray(FNumber.forType(BufferValue.uint32) as any);

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
          
        });
    }

    public async load(pkg: UPackage, exp: UExport) {
        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

        // await super.load(pkg, exp);

        this.setReadPointers(exp);

        pkg.seek(this.readHead, "set");
        
        const startOffset = pkg.tell();

        await this.readNamedProps(pkg);

        console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);

        let dbNum = await pkg.read(int32).value as number;
        let dbMax = await pkg.read(int32).value as number;

        const objectIds = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value as number);

        dbNum = await pkg.read(int32).value as number;
        dbMax = await pkg.read(int32).value as number;

        const objectIds2 = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value as number);

        console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);
        // debugger;

        await this.url.load(pkg, null);

        // console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);

        // debugger;
        // // await this.readNamedProps(pkg);
        
        // pkg.seek(7);
        
        // console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);
        // debugger;

        // await this.reachSpecs.load(pkg);

        // debugger;

        // const baseModelId = await pkg.read(compat32).value as number;
        // const baseModel = await pkg.fetchObject(baseModelId);

        // // const pkgTell = pkg.tell();

        // // await this.readNamedProps(pkg);

        // // console.log(`offset: ${pkg.tell() - pkgTell}`);

        // debugger;

        // for (let objectId of objectIds) {
        //     const object = await pkg.fetchObject(objectId);

        //     if (object) {
        //         this.objectList.push(object);
        //         console.log(`Added object of type: '${object.constructor.name}'`);
        //     }
        // }

        // // debugger;

        // for (let objectId of objectIds2) {
        //     const object = await pkg.fetchObject(objectId);

        //     if (object) {
        //         this.objectList.push(object);
        //         console.log(`Added object of type: '${object.constructor.name}'`);
        //     }
        // }

        // debugger;

        this.readHead = this.readTail;

        return this;
    }
}

export default ULevel;
export { ULevel };