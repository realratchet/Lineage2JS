import UStaticMeshActor from "./static-mesh/un-static-mesh-actor";
import FRotator from "./un-rotator";

enum EMoverGlideType_T {
    MV_MoveByTime,
    MV_GlideByTime
}

// Likely for doors and stuff
abstract class UMover extends UStaticMeshActor {
    public readonly careUnread: boolean = false;

    declare protected moverGlideType: EMoverGlideType_T;
    declare protected keyNum: number;
    declare protected numKeys: number;
    declare protected moveTime: number;
    declare protected stayOpenTime: number;
    declare protected delayTime: number;
    declare protected triggerOnceOnly: boolean;
    declare protected keyPos: (GA.FVector | null)[];
    declare protected keyRot: (GA.FRotator | null)[];
    declare protected basePos: GA.FVector;
    declare protected baseRot: GA.FRotator;
    declare protected initialState: string;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "MoverGlideType": "moverGlideType",
            "KeyNum": "keyNum",
            "NumKeys": "numKeys",
            "MoveTime": "moveTime",
            "StayOpenTime": "stayOpenTime",
            "DelayTime": "delayTime",
            "bTriggerOnceOnly": "triggerOnceOnly",
            "KeyPos": "keyPos",
            "KeyRot": "keyRot",
            "BasePos": "basePos",
            "BaseRot": "baseRot",
            "InitialState": "initialState"
        });
    }

    protected getActorDecodeInfo(): Partial<GD.IStaticMeshActorDecodeInfo> {
        const keyPositions: GD.Vector3Arr[] = [];
        const keyQuaternions: GD.QuaternionArr[] = [];

        for (let i = 0; i < this.numKeys; i++) {
            const keyPos = this.keyPos[i];
            const keyRot = this.keyRot[i];
            const rot = FRotator.make(
                this.baseRot.pitch + (keyRot ? keyRot.pitch : 0),
                this.baseRot.yaw + (keyRot ? keyRot.yaw : 0),
                this.baseRot.roll + (keyRot ? keyRot.roll : 0)
            );

            keyPositions.push([
                this.basePos.x + (keyPos ? keyPos.x : 0),
                this.basePos.y + (keyPos ? keyPos.y : 0),
                this.basePos.z + (keyPos ? keyPos.z : 0)
            ]);
            keyQuaternions.push(rot.getQuaternionElements());
        }

        return {
            dontBatch: true,
            mover: {
                initialState: this.initialState,
                keyNum: this.keyNum,
                keyPositions,
                keyQuaternions,
                moveTime: this.moveTime,
                stayOpenTime: this.stayOpenTime,
                delayTime: this.delayTime,
                collisionRadius: this.collisionRadius,
                collisionHeight: this.collisionHeight,
                isGliding: this.moverGlideType === EMoverGlideType_T.MV_GlideByTime,
                triggerOnceOnly: this.triggerOnceOnly
            }
        };
    }
}

export default UMover;
export { UMover, EMoverGlideType_T };
