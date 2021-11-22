import UObject from "./un-object";
import { Euler, Vector3 } from "three";
import UTextureModifyInfo from "./un-texture-modify-info";
import ULevelInfo from "./un-level-info";
import UPointRegion from "./un-point-region";
import UPhysicsVolume from "./un-physics-volume";
import FVector from "./un-vector";
import FRotator from "./un-rotator";
import ULevel from "./un-level";

class UAActor extends UObject {
    protected readHeadOffset: number = 15;

    protected texModifyInfo: UTextureModifyInfo;
    protected isDynamicActorFilterState: boolean;
    protected level: ULevel;
    protected region: UPointRegion;
    protected drawScale: number;
    protected tag: string;
    protected group: string;
    protected isSunAffected: boolean;
    protected physicsVolume: UPhysicsVolume;
    public readonly location: FVector = new FVector();
    public readonly rotation: FRotator = new FRotator();
    public readonly scale: FVector = new FVector(1, 1, 1);
    protected swayRotationOrig: FRotator = new FRotator();

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "bDynamicActorFilterState": "isDynamicActorFilterState",
            "Level": "level",
            "Region": "region",
            "Tag": "tag",
            "bSunAffect": "isSunAffected",
            "PhysicsVolume": "physicsVolume",
            "Location": "location",
            "Rotation": "rotation",
            "SwayRotationOrig": "swayRotationOrig",
            "DrawScale": "drawScale",
            "TexModifyInfo": "texModifyInfo",
            "DrawScale3D": "scale",
            "Group": "group"
        });
    };
}

export default UAActor;
export { UAActor };