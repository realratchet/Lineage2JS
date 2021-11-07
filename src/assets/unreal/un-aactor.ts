import UObject from "./un-object";
import UPackage from "./un-package";
import UExport from "./un-export";
import BufferValue from "../buffer-value";
import { Euler, Vector3 } from "three";
import UTextureModifyInfo from "./un-texture-modify-info";
import ULevelInfo from "./un-level-info";
import UPointRegion from "./un-point-region";
import UPhysicsVolume from "./un-physics-volume";

class UAActor extends UObject {
    protected readHeadOffset: number = 15;

    protected texModifyInfo: UTextureModifyInfo;
    protected isDynamicActorFilterState: boolean;
    protected level: ULevelInfo;
    protected region: UPointRegion;
    protected drawScale: number;
    protected tag: string;
    protected isSunAffected: boolean;
    protected physicsVolume: UPhysicsVolume;
    public readonly location: Vector3 = new Vector3();
    public readonly rotation: Euler = new Euler();
    public readonly scale: Vector3 = new Vector3(1, 1, 1);
    protected swayRotationOrig: Euler = new Euler();

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
            "DrawScale3D": "scale"
        });
    };

    // public async load(pkg: UPackage, exp: UExport): Promise<this> {
    //     const compat32 = new BufferValue(BufferValue.compat32);


    //     this.setReadPointers(exp);
    //     pkg.seek(this.readHead, "set");
    //     // debugger;

    //     // const objectId = await pkg.read(compat32).value as number;
    //     // const object = await pkg.fetchObject(objectId);

    //     // debugger;

    //     await this.readNamedProps(pkg);

    //     // await super.load(pkg, exp);

    //     // debugger;

    //     // this.readNamedProps(pkg);

    //     // debugger;
    //     // this.readNamedProps(pkg);

    //     // debugger;
    //     // this.readNamedProps(pkg);

    //     debugger;

    //     return this;
    // }
}

export default UAActor;
export { UAActor };