import UStaticMeshActor from "./static-mesh/un-static-mesh-actor";
import FRotator from "./un-rotator";

enum EMoverGlideType_T {
    MV_MoveByTime,
    MV_GlideByTime
}

// Likely for doors and stuff
abstract class UMover extends UStaticMeshActor {
    public readonly careUnread: boolean = false;

    declare protected MoverGlideType: EMoverGlideType_T;
    declare protected KeyNum: number;
    declare protected NumKeys: number;
    declare protected MoveTime: number;
    declare protected StayOpenTime: number;
    declare protected DelayTime: number;
    declare protected bTriggerOnceOnly: boolean;
    declare protected KeyPos: (GA.FVector | null)[];
    declare protected KeyRot: (GA.FRotator | null)[];
    declare protected BasePos: GA.FVector;
    declare protected BaseRot: GA.FRotator;
    declare protected InitialState: string;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "MoverGlideType": "MoverGlideType",
            "KeyNum": "KeyNum",
            "NumKeys": "NumKeys",
            "MoveTime": "MoveTime",
            "StayOpenTime": "StayOpenTime",
            "DelayTime": "DelayTime",
            "bTriggerOnceOnly": "bTriggerOnceOnly",
            "KeyPos": "KeyPos",
            "KeyRot": "KeyRot",
            "BasePos": "BasePos",
            "BaseRot": "BaseRot",
            "InitialState": "InitialState"
        });
    }

    protected getActorDecodeInfo(): Partial<GD.IStaticMeshActorDecodeInfo> {
        const keyPositions: GD.Vector3Arr[] = [];
        const keyQuaternions: GD.QuaternionArr[] = [];

        for (let i = 0; i < this.NumKeys; i++) {
            const keyPos = this.KeyPos[i];
            const keyRot = this.KeyRot[i];
            const rot = FRotator.make(
                this.BaseRot.pitch + (keyRot ? keyRot.pitch : 0),
                this.BaseRot.yaw + (keyRot ? keyRot.yaw : 0),
                this.BaseRot.roll + (keyRot ? keyRot.roll : 0)
            );

            keyPositions.push([
                this.BasePos.x + (keyPos ? keyPos.x : 0),
                this.BasePos.y + (keyPos ? keyPos.y : 0),
                this.BasePos.z + (keyPos ? keyPos.z : 0)
            ]);
            keyQuaternions.push(rot.getQuaternionElements());
        }

        return {
            dontBatch: true,
            mover: {
                initialState: this.InitialState,
                keyNum: this.KeyNum,
                keyPositions,
                keyQuaternions,
                moveTime: this.MoveTime,
                stayOpenTime: this.StayOpenTime,
                delayTime: this.DelayTime,
                collisionRadius: this.collisionRadius,
                collisionHeight: this.collisionHeight,
                isGliding: this.MoverGlideType === EMoverGlideType_T.MV_GlideByTime,
                triggerOnceOnly: this.bTriggerOnceOnly
            }
        };
    }
}

export default UMover;
export { UMover, EMoverGlideType_T };
