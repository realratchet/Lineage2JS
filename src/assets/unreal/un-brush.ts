import UObject from "./un-object";
import { Vector3, Group, Object3D } from "three";
import { PropertyTag } from "./un-property";
import BufferValue from "../buffer-value";
import FScale from "../un-scale";
import ULevelInfo from "./un-level-info";
import UPointRegion from "./un-point-region";
import UPhysicsVolume from "./un-physics-volume";
import UModel from "./model/un-model";
import UTextureModifyInfo from "./un-texture-modify-info";
import UAActor from "./un-aactor";
import FVector from "./un-vector";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UBrush extends UAActor {
    protected readHeadOffset = 15;

    protected csgOper: number;
    protected mainScale: FScale;
    protected postScale: FScale;
    protected polyFlags: number;
    protected brush: UModel;
    protected prePivot: FVector = new FVector();
    protected texModifyInfo: UTextureModifyInfo;
    protected group: string;
    protected isRangeIgnored: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "CsgOper": "csgOper",
            "MainScale": "mainScale",
            "PostScale": "postScale",
            "PolyFlags": "polyFlags",
            "Brush": "brush",
            "PrePivot": "prePivot",
            "TexModifyInfo": "texModifyInfo",
            "Group": "group",
            "bIgnoredRange": "isRangeIgnored"
        });
    }

    public async decodeMesh(): Promise<Object3D> {

        const brush = await this.brush.decodeModel();

        brush.name = this.group || this.objectName;

        const position = new Vector3().subVectors(this.location.vector, this.prePivot.vector);

        brush.position.set(position.x, position.z, position.y);

        // brush.scale.set(this.mainScale.x, this.mainScale.y, this.mainScale.z);

        // if (brush.children.length > 0)
        //     debugger;

        return brush;
    }
}

export default UBrush;
export { UBrush };