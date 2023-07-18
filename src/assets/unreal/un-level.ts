import FURL from "./un-url";
import { UObject, BufferValue } from "@l2js/core";
import { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";

const LOAD_SUB_OBJECTS = true;
const LOAD_SOUNDS = false;

abstract class ULevelBase extends UObject {
    public doLoad(pkg: C.APackage, exp: C.UExport) {
        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

        super.doLoad(pkg, exp);

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        if (verLicense >= 23) {
            let dbNum = 0, dbMax = 0;

            dbNum = pkg.read(int32).value;
            dbMax = pkg.read(int32).value;
        } else {
            debugger;
        }
    }
}

abstract class ULevel extends ULevelBase {

    protected objectList: UObject[] = [];
    public readonly url: FURL = new FURL();
    protected reachSpecs = new FPrimitiveArray(BufferValue.uint32);
    public baseModelId: number;
    protected baseModel: GA.UModel;

    public timeSeconds: number = 0;

    protected unkBytes = BufferValue.allocBytes(3);
    protected unkInt0: number;
    protected info: GA.ULevelInfo;

    public getInfo() { return this.info; }
    public setInfo(info: GA.ULevelInfo) { this.info = info; }

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

        super.doLoad(pkg, exp);

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        let dbNum: number;
        let dbMax: number;
        let ambientSoundIds: number[];
        let objectIds: number[];

        if (0x16 < verLicense) {
            dbNum = pkg.read(int32).value;
            dbMax = pkg.read(int32).value;

            ambientSoundIds = new Array(dbNum); new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value).filter(v => v !== 0);
        } else ambientSoundIds = [];

        this.readHead = pkg.tell();

        dbNum = pkg.read(int32).value;
        dbMax = pkg.read(int32).value;

        objectIds = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value).filter(v => v !== 0);

        this.url.load(pkg);

        this.unkInt0 = pkg.read(int32).value;
        pkg.read(this.unkBytes);

        this.readHead = pkg.tell();

        this.reachSpecs.load(pkg);

        // debugger;

        this.readHead = pkg.tell();

        this.baseModelId = pkg.read(compat32).value;
        this.readHead = pkg.tell();

        if (LOAD_SUB_OBJECTS) {
            this.baseModel = pkg.fetchObject<GA.UModel>(this.baseModelId);

            if (LOAD_SOUNDS) {
                for (let objectId of ambientSoundIds) {
                    const object = pkg.fetchObject(objectId);

                    if (object)
                        this.objectList.push(object);
                }
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

    // public getDecodeInfo(library: DecodeLibrary): IBaseObjectDecodeInfo {
    //     const groupedObjectList = this.objectList.reduce((accum, obj) => {

    //         const constrName = (obj.constructor as any).isDynamicClass
    //             ? (obj.constructor as any).getConstructorName()
    //             : obj.constructor.name;

    //         accum[constrName] = accum[constrName] || [];
    //         accum[constrName].push(obj);

    //         return accum;
    //     }, {} as Record<string, UObject[]>);

    //     for (const emitter of (groupedObjectList.Emitter as UEmitter[]))
    //         emitter.loadSelf().getDecodeInfo(library);

    //     // debugger;

    //     // return {
    //     //     type: "Level",
    //     //     name: this.url.map,
    //     //     children: (await Promise.all([
    //     //         this.baseModel.getDecodeInfo(library),
    //     //         "FTerrainInfo" in groupedObjectList ? Promise.all(groupedObjectList["FTerrainInfo"].map((exp: FTerrainInfo) => exp.getDecodeInfo(library))) : Promise.resolve([]),
    //     //         "UStaticMeshActor" in groupedObjectList ? Promise.all(groupedObjectList["UStaticMeshActor"].map((exp: UStaticMeshActor) => exp.getDecodeInfo(library))) : Promise.resolve([])
    //     //     ])).flat()
    //     // };
    // }
}

export default ULevel;
export { ULevel };