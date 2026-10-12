import type { Collider, RigidBody, World } from "@dimforge/rapier3d";
import Actor from "./actor";
import type BSPCollider from "./bsp-collider";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "./objects";
import type { Vector3Arr } from "@l2js/engine";
import Rotator from "../utils/rotator";
import { Vector3 } from "three";
import { pointPrimitive } from "../physics/collision-primitive";
import type { ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";

const tmpRotator = new Rotator();
const tmpLocation = new Vector3();
const zeroExtent = new Vector3();

export class Volume extends Actor implements ICollidable {
    public readonly isCollidable = true;
    declare public readonly isVolume: boolean;
    public readonly collisionOwner: BSPCollider;
    protected readonly collisionProfile: ActorCollisionProfile_T;

    public constructor(owner: BSPCollider) {
        super({ uuid: owner.actorUuid, name: owner.name, scriptClassId: owner.scriptClassId, scriptProperties: Object.fromEntries(owner.scriptProperties) });

        (this as any).isVolume = true;

        this.collisionOwner = owner;
        this.collisionProfile = { ...owner.getCollisionProfile() };
        this.position.fromArray(this.getUnrealScriptProperty("Location") as Vector3Arr);
        const [pitch, yaw, roll] = this.getUnrealScriptProperty("Rotation") as Vector3Arr;
        tmpRotator.set(pitch, yaw, roll).toQuaternion(this.quaternion);
        this.scale.fromArray(this.getUnrealScriptProperty("DrawScale3D") as Vector3Arr).multiplyScalar(this.getUnrealScriptProperty("DrawScale") as number);
    }

    public createCollider(_world: World): Collider { throw new Error(`Actor '${this.name}' uses the collider of '${this.collisionOwner.name}'.`); }
    public getCollider(): Collider { return this.collisionOwner.getCollider(); }
    public getRigidbody(): RigidBody { return this.collisionOwner.getRigidbody(); }
    public getCollisionProfile(): ActorCollisionProfile_T { return this.collisionProfile; }
    public getCollisionPrimitive(): CollisionPrimitive_T { return this.collisionOwner.getCollisionPrimitive(); }
    public getCollisionRadius(): number { return this.collisionProfile.collisionRadius; }
    public encompasses(location: Vector3): boolean {
        if (!this.getUnrealScriptProperty("Brush")) return false;

        return !!pointPrimitive(this.getCollisionPrimitive(), location, zeroExtent);
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        if (call.name.toLowerCase() === "encompasses") return this.encompasses(tmpLocation.fromArray(call.args[0] as Vector3Arr));

        return super.callUnrealNative(call);
    }
}

export default Volume;
