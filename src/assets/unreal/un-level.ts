import UObject from "./un-object";
import UPackage from "./un-package";
import UExport from "./un-export";
import BufferValue from "../buffer-value";
import FURL from "./un-url";
import { FPrimitiveArray } from "./un-array";
import UModel from "./model/un-model";

const LOAD_SUB_OBJECTS = false;

class ULevel extends UObject {
    protected objectList: UObject[] = [];
    protected url: FURL = new FURL;
    protected reachSpecs: FPrimitiveArray = new FPrimitiveArray(BufferValue.uint32);
    public baseModelId: number;
    protected baseModel: UModel;

    public doLoad(pkg: UPackage, exp: UExport) {
        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

        this.setReadPointers(exp);

        pkg.seek(this.readHead, "set");

        this.readNamedProps(pkg);

        // debugger;

        let dbNum = pkg.read(int32).value as number;
        let dbMax = pkg.read(int32).value as number;

        const objectIds = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value as number).filter(v => v !== 0);

        this.readHead = pkg.tell();

        // debugger;

        let objectIds2: number[];
        if (objectIds.length === dbMax) {
            dbNum = pkg.read(int32).value as number;
            dbMax = pkg.read(int32).value as number;

            objectIds2 = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value as number);
        } else {
            debugger;
            objectIds2 = [];
        }

        this.url.load(pkg, null);


        pkg.seek(7);
        this.readHead = pkg.tell();

        this.reachSpecs.load(pkg);

        this.readHead = pkg.tell();

        this.baseModelId = pkg.read(compat32).value as number;
        this.readHead = pkg.tell();

        this.promisesLoading.push(new Promise<void>(async resolve => {
            if (!LOAD_SUB_OBJECTS) {
                resolve();
                return;
            }
            this.baseModel = await pkg.fetchObject<UModel>(this.baseModelId);
            resolve();
        }));


        // debugger;

        for (let objectId of objectIds) {
            // const pkgName = pkg.getPackageName(pkg.exports[objectId - 1].idClass.value as number);

            // debugger;

            // if (pkgName !== "UStaticMeshActor" && pkgName !== "UTerrainInfo") continue;

            this.promisesLoading.push(new Promise<void>(async resolve => {
                if (!LOAD_SUB_OBJECTS) {
                    resolve();
                    return;
                }
                const object = await pkg.fetchObject(objectId);

                if (object) this.objectList.push(object);

                resolve();
            }));
        }

        // for (let objectId of [1804]) {
        for (let objectId of objectIds2) {
            // const pkgName = pkg.getPackageName(pkg.exports[objectId - 1].idClass.value as number);

            // debugger;

            // if (pkgName !== "StaticMeshActor" && pkgName !== "TerrainInfo") continue;

            this.promisesLoading.push(new Promise<void>(async resolve => {
                if (!LOAD_SUB_OBJECTS) {
                    resolve();
                    return;
                }
                const object = await pkg.fetchObject(objectId);

                if (object) this.objectList.push(object);

                resolve();
            }));
        }

        this.readHead = this.readTail;

        return this;
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IBaseObjectDecodeInfo> {
        await this.onLoaded();

        const groupedObjectList = this.objectList.reduce((accum, obj) => {

            accum[obj.constructor.name] = accum[obj.constructor.name] || [];
            accum[obj.constructor.name].push(obj);

            return accum;
        }, {} as { [key: string]: UObject[] });

        debugger;

        return {
            type: "Level",
            name: this.url.map,
            children: (await Promise.all([
                this.baseModel.getDecodeInfo(library),
                // "UTerrainInfo" in groupedObjectList ? Promise.all(groupedObjectList["UTerrainInfo"].map((exp: UTerrainInfo) => exp.getDecodeInfo(library))) : Promise.resolve([]),
                // "UStaticMeshActor" in groupedObjectList ? Promise.all(groupedObjectList["UStaticMeshActor"].map((exp: UStaticMeshActor) => exp.getDecodeInfo(library))) : Promise.resolve([])
            ])).flat()
        };
    }
}

export default ULevel;
export { ULevel };