import UStaticMeshActor, { type IStaticMeshActorDecodeInfo } from "./static-mesh/un-static-mesh-actor";
import FRotator from "./un-rotator";
import type { FVector } from "./un-vector";
import type { Vector3Arr, QuaternionArr } from "./library-types";

type IMoverDecodeInfo = {
    initialState: string,
    keyNum: number,
    keyPositions: Vector3Arr[],
    keyQuaternions: QuaternionArr[],
    moveTime: number,
    stayOpenTime: number,
    delayTime: number,
    collisionRadius: number,
    collisionHeight: number,
    isGliding: boolean,
    triggerOnceOnly: boolean,
    moverEncroachType: "stop" | "return" | "crush" | "ignore"
};

enum EMoverGlideType_T {
    MV_MoveByTime,
    MV_GlideByTime
}

enum EMoverEncroachType_T {
    ME_StopWhenEncroach,
    ME_ReturnWhenEncroach,
    ME_CrushWhenEncroach,
    ME_IgnoreWhenEncroach
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
    declare protected keyPos: (FVector | null)[];
    declare protected keyRot: (FRotator | null)[];
    declare protected basePos: FVector;
    declare protected baseRot: FRotator;
    declare protected initialState: string;
    declare protected moverEncroachType: EMoverEncroachType_T;

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
            "InitialState": "initialState",
            "MoverEncroachType": "moverEncroachType"
        });
    }

    protected getActorDecodeInfo(): Partial<IStaticMeshActorDecodeInfo> {
        const keyPositions: Vector3Arr[] = [];
        const keyQuaternions: QuaternionArr[] = [];

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
                triggerOnceOnly: this.triggerOnceOnly,
                moverEncroachType: getMoverEncroachType(this.moverEncroachType)
            }
        };
    }
}

function getMoverEncroachType(value: EMoverEncroachType_T): IMoverDecodeInfo["moverEncroachType"] {
    switch (value) {
        case EMoverEncroachType_T.ME_StopWhenEncroach: return "stop";
        case EMoverEncroachType_T.ME_ReturnWhenEncroach: return "return";
        case EMoverEncroachType_T.ME_CrushWhenEncroach: return "crush";
        case EMoverEncroachType_T.ME_IgnoreWhenEncroach: return "ignore";
        default: throw new Error(`Unknown mover encroach type '${value}'.`);
    }
}

export default UMover;
export { UMover, EMoverEncroachType_T, EMoverGlideType_T };
export type { IMoverDecodeInfo };
