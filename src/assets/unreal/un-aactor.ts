import UObject from "./un-object";
import UTextureModifyInfo from "./un-texture-modify-info";
import UPointRegion from "./un-point-region";
import UPhysicsVolume from "./un-physics-volume";
import FVector from "./un-vector";
import FRotator from "./un-rotator";
import ULevel from "./un-level";

// 15 byte header
// byte  1: compat importing same class
// byte  2: compat importing same class
// byte  3: ?
// byte  4: ?
// byte  5: ?
// byte  6: ?
// byte  7: ?
// byte  8: ?
// byte  9: ?
// byte 10: ?
// byte 11: compat for some export? light? (2 bytes)
// byte 12
// byte 13: compat for some export? light? (2 bytes)
// byte 14
// byte 15: compat pointing to engine package?

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

    protected hasDistanceFog: boolean;
    protected distanceFogEnd: number;
    protected distanceFogStart: number;
    protected distanceFogColor: FColor;

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
            "Group": "group",

            "bDistanceFog": "hasDistanceFog",
            "DistanceFogEnd": "distanceFogEnd",
            "DistanceFogStart": "distanceFogStart",
            "DistanceFogColor": "distanceFogColor",
        });
    };
}

export default UAActor;
export { UAActor };