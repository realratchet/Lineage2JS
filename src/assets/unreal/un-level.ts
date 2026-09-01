import FURL from "./un-url";
import { BufferValue, type APackage, type UExport, FObjectArray } from "@l2js/core";
import UObject from "./un-object";
import type { UAActor } from "./un-aactor";
import type { UModel } from "./model/un-model";
import type { ULevelInfo } from "./un-level-info";

const LOAD_SUB_OBJECTS = true;
const LOAD_SOUNDS = false;
const NUM_LEVEL_TEXT_BLOCKS = 16;

abstract class ULevelBase extends UObject {
    public readonly url: FURL = new FURL();

    protected ambientActors: FObjectArray<UAActor>;
    protected actors: FObjectArray<UAActor>;

    public doLoad(pkg: APackage, exp: UExport) {
        super.doLoad(pkg, exp);

        const verLicense = pkg.header.getLicenseeVersion();

        if (verLicense >= 23) {
            let dbNum = 0, dbMax = 0;

            dbNum = pkg.read("int32");
            dbMax = pkg.read("int32");

            this.ambientActors = FObjectArray.loadOfSize(dbNum, pkg);

            dbNum = pkg.read("int32");
            dbMax = pkg.read("int32");

            this.actors = FObjectArray.loadOfSize(dbNum, pkg);
        } else {
            // stock ue2 layout (older chronicle maps): a single actor array, no ambient pair
            const dbNum = pkg.read("int32");

            pkg.read("int32"); // dbMax

            this.ambientActors = FObjectArray.loadOfSize(0, pkg);
            this.actors = FObjectArray.loadOfSize(dbNum, pkg);
        }

        this.url.load(pkg);
    }
}

export abstract class ULevel extends ULevelBase {
    public baseModelId: number;
    public levelInfoId: number;

    protected baseModel: UModel;
    public levelInfo: ULevelInfo;

    public get timeSeconds() { return 0; };

    protected info: ULevelInfo;

    protected approxTime: number;
    protected firstDeletedId: number;

    protected objectList: UObject[] = [];

    public getInfo() { return this.info; }
    public setInfo(info: ULevelInfo) { this.info = info; }

    public getModel() { return this.baseModel; }
    public getActors() { return this.actors; }
    public getAmbientActors() { return this.ambientActors; }

    public doLoad(pkg: APackage, exp: UExport) {
        super.doLoad(pkg, exp);

        const verArchive = pkg.header.getArchiveFileVersion();

        this.baseModelId = pkg.read("compat32");

        if (verArchive < 98) {
            debugger;
        }

        this.approxTime = pkg.read("float");

        this.firstDeletedId = pkg.read("compat32");
        const textBlockIds = new Array<number>(NUM_LEVEL_TEXT_BLOCKS);

        for (let i = 0; i < NUM_LEVEL_TEXT_BLOCKS; i++)
            textBlockIds[i] = pkg.read("compat32");

        if (verArchive > 62) {
            const travelInfoPairsCount = pkg.read("compat32");

            if (travelInfoPairsCount !== 0)
                debugger;
        } else if (verArchive >= 61) {
            debugger;
        }

        this.levelInfo = this.actors[0] as ULevelInfo;
        this.levelInfo.setLevel(this);

        if (LOAD_SUB_OBJECTS) {
            this.baseModel = pkg.fetchObject<UModel>(this.baseModelId);

            if (LOAD_SOUNDS) {
                this.objectList = this.objectList.concat(this.ambientActors);
            }

            this.objectList = this.objectList.concat(this.actors);

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