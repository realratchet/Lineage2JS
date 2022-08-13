import UObject from "./un-object";
import BufferValue from "../buffer-value";
import FURL from "./un-url";
import { FPrimitiveArray } from "./un-array";

const LOAD_SUB_OBJECTS = false;

class ULevel extends UObject {
    protected objectList: UObject[] = [];
    protected url: FURL = new FURL();
    protected reachSpecs: FPrimitiveArray = new FPrimitiveArray(BufferValue.uint32);
    public baseModelId: number;
    protected baseModel: UModel;

    protected unkBytes = BufferValue.allocBytes(3);
    protected unkInt0: number;

    public doLoad(pkg: UPackage, exp: UExport) {
        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

        this.setReadPointers(exp);

        pkg.seek(this.readHead, "set");

        this.readNamedProps(pkg);

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        let dbNum: number;
        let dbMax: number;
        let ambientSoundIds: number[] = [];
        let objectIds: number[];

        if (0x16 < verLicense) {
            dbNum = pkg.read(int32).value as number;
            dbMax = pkg.read(int32).value as number;

            ambientSoundIds = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value as number).filter(v => v !== 0);
        }

        this.readHead = pkg.tell();

        dbNum = pkg.read(int32).value as number;
        dbMax = pkg.read(int32).value as number;

        objectIds = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value as number).filter(v => v !== 0);

        this.url.load(pkg);

        this.unkInt0 = pkg.read(int32).value as number;
        pkg.read(this.unkBytes);

        this.readHead = pkg.tell();

        this.reachSpecs.load(pkg);

        // debugger;

        this.readHead = pkg.tell();

        this.baseModelId = pkg.read(compat32).value as number;
        this.readHead = pkg.tell();

        // debugger;

        this.promisesLoading.push(new Promise<void>(async resolve => {
            if (!LOAD_SUB_OBJECTS) {
                resolve();
                return;
            }
            this.baseModel = await pkg.fetchObject<UModel>(this.baseModelId);
            resolve();
        }));

        for (let objectId of ambientSoundIds) {
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

        for (let objectId of objectIds) {
            this.promisesLoading.push(new Promise<void>(async resolve => {
                if (!LOAD_SUB_OBJECTS) {
                    resolve();
                    return;
                }

                // debugger;
                const object = await pkg.fetchObject(objectId);

                if (object) this.objectList.push(object);

                resolve();
            }));
        }

        // debugger;

        pkg.seek(this.readHead, "set");

        // const startBytes = pkg.tell();
        // const unk1 = pkg.read(new BufferValue(BufferValue.float)).value;
        // // console.log(pkg.tell() - startBytes);
        // // const unk2 = pkg.read(compat32).value;
        // // console.log(pkg.tell() - startBytes);


        // // pkg.dump(2);

        // debugger;

        this.readHead = this.readTail;

        return this;
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IBaseObjectDecodeInfo> {
        await this.onLoaded();

        const groupedObjectList = this.objectList.reduce((accum, obj) => {

            accum[obj.constructor.name] = accum[obj.constructor.name] || [];
            accum[obj.constructor.name].push(obj);

            return accum;
        }, {} as GenericObjectContainer_T<UObject[]>);

        debugger;

        // return {
        //     type: "Level",
        //     name: this.url.map,
        //     children: (await Promise.all([
        //         this.baseModel.getDecodeInfo(library),
        //         "UTerrainInfo" in groupedObjectList ? Promise.all(groupedObjectList["UTerrainInfo"].map((exp: UTerrainInfo) => exp.getDecodeInfo(library))) : Promise.resolve([]),
        //         "UStaticMeshActor" in groupedObjectList ? Promise.all(groupedObjectList["UStaticMeshActor"].map((exp: UStaticMeshActor) => exp.getDecodeInfo(library))) : Promise.resolve([])
        //     ])).flat()
        // };
    }
}

export default ULevel;
export { ULevel };