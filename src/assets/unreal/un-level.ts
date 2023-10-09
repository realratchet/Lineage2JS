import ULevelInfo from "@client/assets/unreal/un-level-info";
import FURL from "./un-url";
import { UObject, BufferValue } from "@l2js/core";

const LOAD_SUB_OBJECTS = true;
const LOAD_SOUNDS = false;
const NUM_LEVEL_TEXT_BLOCKS = 16;

abstract class ULevelBase extends UObject {
    public readonly url: FURL = new FURL();

    protected ambientActorIds: Array<number>;
    protected actorIds: Array<number>;

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

        super.doLoad(pkg, exp);

        const verLicense = pkg.header.getLicenseeVersion();

        if (verLicense >= 23) {
            let dbNum = 0, dbMax = 0;

            dbNum = pkg.read(int32).value;
            dbMax = pkg.read(int32).value;

            this.ambientActorIds = new Array<number>(dbNum);

            for (let i = 0; i < dbNum; i++)
                this.ambientActorIds[i] = pkg.read(compat32).value;

            dbNum = pkg.read(int32).value;
            dbMax = pkg.read(int32).value;

            this.actorIds = new Array<number>(dbNum);

            for (let i = 0; i < dbNum; i++)
                this.actorIds[i] = pkg.read(compat32).value;
        } else {
            debugger
        }

        this.url.load(pkg);
    }
}

abstract class ULevel extends ULevelBase {
    public baseModelId: number;
    public levelInfoId: number;

    protected baseModel: GA.UModel;
    protected levelInfo: GA.ULevelInfo;

    public get timeSeconds() { return 0; };

    protected info: GA.ULevelInfo;

    protected approxTime: number;
    protected firstDeletedId: number;

    protected objectList: UObject[] = [];

    public getInfo() { return this.info; }
    public setInfo(info: GA.ULevelInfo) { this.info = info; }

    public getModel() { return this.baseModel; }

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        const int32 = new BufferValue(BufferValue.int32);
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

        this.levelInfoId = this.actorIds[0];

        if (LOAD_SUB_OBJECTS) {
            this.baseModel = pkg.fetchObject<GA.UModel>(this.baseModelId);

            if (LOAD_SOUNDS) {
                for (const objectId of this.ambientActorIds) {
                    const object = pkg.fetchObject(objectId);

                    if (object)
                        this.objectList.push(object);
                }
            }

            for (const objectId of this.actorIds) {
                const object = pkg.fetchObject(objectId);

                if (object)
                    this.objectList.push(object);
            }

            this.levelInfo = pkg.fetchObject<GA.ULevelInfo>(this.actorIds[0]);

            console.assert(this.levelInfo.constructor.friendlyName === "LevelInfo");
        }

        this.readHead = this.readTail;

        console.assert(this.bytesUnread === 0);

        // debugger;

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