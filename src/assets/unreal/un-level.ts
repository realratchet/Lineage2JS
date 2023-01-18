import UObject from "./un-object";
import BufferValue from "../buffer-value";
import FURL from "./un-url";
import { FPrimitiveArray } from "./un-array";

const LOAD_SUB_OBJECTS = true;

class ULevel extends UObject {
    protected objectList: UObject[] = [];
    public readonly url: FURL = new FURL();
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

        if (LOAD_SUB_OBJECTS) {
            this.baseModel = pkg.fetchObject<UModel>(this.baseModelId);

            for (let objectId of ambientSoundIds) {
                const object = pkg.fetchObject(objectId);

                if (object)
                    this.objectList.push(object);
            }

            for (let objectId of objectIds) {
                const object = pkg.fetchObject(objectId);

                if (object)
                    this.objectList.push(object);
            }
        }

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

    public getDecodeInfo(library: DecodeLibrary): IBaseObjectDecodeInfo {
        const groupedObjectList = this.objectList.reduce((accum, obj) => {

            const constrName = (obj.constructor as any).isDynamicClass ? (obj.constructor as any).getConstructorName() : obj.constructor.name;

            accum[constrName] = accum[constrName] || [];
            accum[constrName].push(obj);

            return accum;
        }, {} as Record<string, UObject[]>);

        for (const emitter of (groupedObjectList.Emitter as UEmitter[]))
            emitter.loadSelf().getDecodeInfo(library);

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