import ULevelInfo from "@client/assets/unreal/un-level-info";
import FURL from "./un-url";
import { UObject, BufferValue } from "@l2js/core";
import { FIndexArray, FObjectArray } from "@l2js/core/unreal/un-array";

const LOAD_SUB_OBJECTS = true;
const LOAD_SOUNDS = false;
const NUM_LEVEL_TEXT_BLOCKS = 16;

abstract class ULevelBase extends UObject {
    public readonly url: FURL = new FURL();

    protected ambientActors: FObjectArray<GA.AActor>;
    protected actors: FObjectArray<GA.AActor>;

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

        super.doLoad(pkg, exp);

        const verLicense = pkg.header.getLicenseeVersion();

        if (verLicense >= 23) {
            let dbNum = 0, dbMax = 0;

            dbNum = pkg.read(int32).value;
            dbMax = pkg.read(int32).value;

            this.ambientActors = FObjectArray.loadOfSize(dbNum, pkg);

            dbNum = pkg.read(int32).value;
            dbMax = pkg.read(int32).value;

            this.actors = FObjectArray.loadOfSize(dbNum, pkg);
        } else {
            debugger
            throw new Error("not implemented");
        }

        this.url.load(pkg);
    }
}

abstract class ULevel extends ULevelBase {
    public baseModelId: number;
    public levelInfoId: number;

    protected baseModel: GA.UModel;
    public levelInfo: GA.ULevelInfo;

    public get timeSeconds() { return 0; };

    protected info: GA.ULevelInfo;

    protected approxTime: number;
    protected firstDeletedId: number;

    protected objectList: UObject[] = [];

    public getInfo() { return this.info; }
    public setInfo(info: GA.ULevelInfo) { this.info = info; }

    public getModel() { return this.baseModel; }

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        const compat32 = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);

        super.doLoad(pkg, exp);

        const verArchive = pkg.header.getArchiveFileVersion();

        this.baseModelId = pkg.read(compat32).value;

        if (verArchive < 98) {
            debugger;
        }

        this.approxTime = pkg.read(float).value;

        this.firstDeletedId = pkg.read(compat32).value
        const textBlockIds = new Array<number>(NUM_LEVEL_TEXT_BLOCKS);

        for (let i = 0; i < NUM_LEVEL_TEXT_BLOCKS; i++)
            textBlockIds[i] = pkg.read(compat32).value;

        if (verArchive > 62) {
            const travelInfoPairsCount = pkg.read(compat32).value;

            if (travelInfoPairsCount !== 0)
                debugger;
        } else if (verArchive >= 61) {
            debugger;
        }

        this.levelInfo = this.actors[0] as GA.ULevelInfo;
        this.levelInfo.setLevel(this);

        if (LOAD_SUB_OBJECTS) {
            this.baseModel = pkg.fetchObject<GA.UModel>(this.baseModelId);

            if (LOAD_SOUNDS) {
                this.objectList.splice(0, this.ambientActors.length);
            }

            this.objectList.splice(0, this.actors.length);

            console.assert(this.levelInfo.constructor.friendlyName === "LevelInfo");
        }

        this.readHead = this.readTail;

        console.assert(this.bytesUnread === 0);

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
    //     //         "ATerrainInfo" in groupedObjectList ? Promise.all(groupedObjectList["ATerrainInfo"].map((exp: ATerrainInfo) => exp.getDecodeInfo(library))) : Promise.resolve([]),
    //     //         "UStaticMeshActor" in groupedObjectList ? Promise.all(groupedObjectList["UStaticMeshActor"].map((exp: UStaticMeshActor) => exp.getDecodeInfo(library))) : Promise.resolve([])
    //     //     ])).flat()
    //     // };
    // }
}

export default ULevel;
export { ULevel };