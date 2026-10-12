import UObject from "./un-object";
import type { UAActor } from "./un-aactor";

export abstract class UReachSpec extends UObject {
    declare public readonly distance: number;
    declare public readonly start: UAActor;
    declare public readonly end: UAActor;
    declare public readonly collisionRadius: number;
    declare public readonly collisionHeight: number;
    declare public readonly reachFlags: number;
    declare public readonly maxLandingVelocity: number;
    declare public readonly isPruned: number;
    declare public readonly isForced: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Distance": "distance",
            "Start": "start",
            "End": "end",
            "CollisionRadius": "collisionRadius",
            "CollisionHeight": "collisionHeight",
            "reachFlags": "reachFlags",
            "MaxLandingVelocity": "maxLandingVelocity",
            "bPruned": "isPruned",
            "bForced": "isForced"
        });
    }
}

export default UReachSpec;
