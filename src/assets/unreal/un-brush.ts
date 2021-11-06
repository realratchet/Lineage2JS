import UObject from "./un-object";
import { Vector3 } from "three";
import { PropertyTag } from "./un-property";
import BufferValue from "../buffer-value";
import FScale from "../un-scale";
import ULevelInfo from "./un-level-info";
import UPointRegion from "./un-point-region";
import UPhysicsVolume from "./un-physics-volume";
import UModel from "./model/un-model";
import UTextureModifyInfo from "./un-texture-modify-info";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UBrush extends UObject {
    protected readHeadOffset = 15;
    protected csgOper: number;
    protected mainScale: FScale;
    protected postScale: FScale;
    protected polyFlags: number;
    protected dynamicActorFilterState: boolean;
    protected level: ULevelInfo;
    protected region: UPointRegion;
    protected tag: string;
    protected sunAffect: boolean;
    protected physicsVolume: UPhysicsVolume;
    protected location: Vector3;
    protected brush: UModel;
    protected prePivot: Vector3;
    protected texModifyInfo: UTextureModifyInfo;
    protected group: string;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "CsgOper": "csgOper",
            "MainScale": "mainScale",
            "PostScale": "postScale",
            "PolyFlags": "polyFlags",
            "bDynamicActorFilterState": "dynamicActorFilterState",
            "Level": "level",
            "Region": "region",
            "Tag": "tag",
            "bSunAffect": "sunAffect",
            "PhysicsVolume": "physicsVolume",
            "Location": "location",
            "Brush": "brush",
            "PrePivot": "prePivot",
            "TexModifyInfo": "texModifyInfo",
            "Group": "group"
        });
    }
}

export default UBrush;
export { UBrush };