import UStaticMeshActor from "./un-static-mesh-actor";
import { UObject } from "@l2js/core";

// per-axis float triple (MovableStaticMeshActor.uc struct L2RotatorTime - PitchTime/RollTime/YawTime)
abstract class FL2RotatorTime extends UObject {
    public static readonly plainStructFields = true; // values live in fields, not propertyDict (see UObject.loadNative)

    declare public pitchTime: number;
    declare public rollTime: number;
    declare public yawTime: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "PitchTime": "pitchTime",
            "RollTime": "rollTime",
            "YawTime": "yawTime"
        });
    }

    public getElements(): GD.Vector3Arr { return [this.pitchTime ?? 0, this.yawTime ?? 0, this.rollTime ?? 0]; }
}

// bounded rotational oscillation around the placed rotation (cpp/l2_editor_leak/Engine/Classes/MovableStaticMeshActor.uc,
// defaultproperties Physics=PHYS_L2Movement bStatic=False bUseL2RotatorRandomStart=True)
abstract class UMovableStaticMeshActor extends UStaticMeshActor {

    declare protected l2MovementTag: string[];
    declare protected l2AccelRatio: FL2RotatorTime;
    declare protected useL2RotatorMaxRandom: boolean;
    declare protected useL2RotatorRandomStart: boolean;
    declare protected l2RotatorRate: GA.FRotator;
    declare protected l2RotatorMax: GA.FRotator;
    declare protected l2OrgRotator: GA.FRotator;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "L2MovementTag": "l2MovementTag",
            "L2AccelRatio": "l2AccelRatio",
            "bUseL2RotatorMaxRandom": "useL2RotatorMaxRandom",
            "bUseL2RotatorRandomStart": "useL2RotatorRandomStart",
            "L2RotatorRate": "l2RotatorRate",
            "L2RotatorMax": "l2RotatorMax",
            "L2OrgRotator": "l2OrgRotator"
        });
    }

    protected getActorDecodeInfo(): Partial<GD.IStaticMeshActorDecodeInfo> {
        if (!this.l2RotatorRate && !this.l2RotatorMax) return {};

        // L2OrgRotator is runtime-written by native init (bL2InitMove), zeroed in placed data - sway centers on the placed rotation
        const org = this.l2OrgRotator && (this.l2OrgRotator.pitch || this.l2OrgRotator.yaw || this.l2OrgRotator.roll) ? this.l2OrgRotator : this.rotation;

        return {
            dontBatch: true,
            swaying: {
                tags: this.l2MovementTag ? Array.from(this.l2MovementTag) : [],
                orgRotator: [org.pitch, org.yaw, org.roll],
                rate: this.l2RotatorRate ? [this.l2RotatorRate.pitch, this.l2RotatorRate.yaw, this.l2RotatorRate.roll] : [0, 0, 0],
                max: this.l2RotatorMax ? [this.l2RotatorMax.pitch, this.l2RotatorMax.yaw, this.l2RotatorMax.roll] : [0, 0, 0],
                accelRatio: this.l2AccelRatio ? this.l2AccelRatio.getElements() : [0, 0, 0],
                maxRandom: !!this.useL2RotatorMaxRandom,
                randomStart: this.useL2RotatorRandomStart !== false
            } as GD.ISwayingDecodeInfo
        };
    }
}

export default UMovableStaticMeshActor;
export { UMovableStaticMeshActor, FL2RotatorTime };
