import UObject from "./un-object";
import UPackage from "./un-package";
import UExport from "./un-export";
import BufferValue from "../buffer-value";
import FURL from "./un-url";
import FArray from "./un-array";
import FNumber from "./un-number";
import { Group } from "three";
import UModel from "./model/un-model";
import UTerrainInfo from "./un-terrain-info";
import UStaticMeshActor from "./static-mesh/un-static-mesh-actor";

class ULevel extends UObject {
    protected objectList: UObject[] = [];
    protected url: FURL = new FURL;
    protected reachSpecs: FArray = new FArray(FNumber.forType(BufferValue.uint32) as any);
    protected baseModel: UModel;

    public async load(pkg: UPackage, exp: UExport) {
        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

        this.setReadPointers(exp);

        pkg.seek(this.readHead, "set");

        await this.readNamedProps(pkg);

        let dbNum = await pkg.read(int32).value as number;
        let dbMax = await pkg.read(int32).value as number;

        const objectIds = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value as number);

        dbNum = await pkg.read(int32).value as number;
        dbMax = await pkg.read(int32).value as number;

        const objectIds2 = new Array(dbMax).fill(1).map(_ => pkg.read(compat32).value as number);

        await this.url.load(pkg, null);

        pkg.seek(7);

        await this.reachSpecs.load(pkg);

        const baseModelId = await pkg.read(compat32).value as number;

        this.baseModel = await pkg.fetchObject(baseModelId) as UModel;

        for (let objectId of objectIds) {
            const object = await pkg.fetchObject(objectId);

            if (object) this.objectList.push(object);
        }

        for (let objectId of objectIds2) {
            const object = await pkg.fetchObject(objectId);

            if (object) this.objectList.push(object);
        }

        this.readHead = this.readTail;

        return this;
    }

    public async decodeLevel(): Promise<Group> {
        const group = new Group();

        group.name = this.url.map;

        const groupedObjectList = this.objectList.reduce((accum, obj) => {

            accum[obj.constructor.name] = accum[obj.constructor.name] || [];
            accum[obj.constructor.name].push(obj);

            return accum;
        }, {} as { [key: string]: UObject[] });

        group.add(await this.baseModel.decodeModel());

        for (let type of [/*"UBrush", */"UTerrainInfo", "UStaticMeshActor"]) {
            for (let object of groupedObjectList[type]) {
                switch (type) {
                    // case "UBrush": group.add(await (object as UBrush).decodeMesh()); break;
                    case "UStaticMeshActor": group.add(await (object as UStaticMeshActor).decodeMesh()); break;
                    case "UTerrainInfo": group.add(await (object as UTerrainInfo).decodeMesh()); break
                }
            }
        }

        return group;
    }
}

export default ULevel;
export { ULevel };