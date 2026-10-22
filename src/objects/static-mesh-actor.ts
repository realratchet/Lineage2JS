import type { Collider, RigidBody, World } from "@dimforge/rapier3d";
import type { IStaticMeshActorDecodeInfo } from "@l2js/engine/contracts/mesh";
import Actor from "./actor";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "./objects";
import type CollidingMesh from "./colliding-mesh";
import type { ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";
import { ColliderComponent } from "../physics/components/physics-component";

export class StaticMeshActor extends Actor implements ICollidable {
    public readonly isCollidable = true;
    declare public readonly isStaticMeshActor: boolean;
    public readonly decodeInfo: IStaticMeshActorDecodeInfo;
    public readonly collisionOwner: CollidingMesh;
    public isCollisionIndexed = true;
    protected readonly primitive: CollisionPrimitive_T<"staticMesh">;
    protected readonly collisionProfile: ActorCollisionProfile_T;

    public constructor(owner: CollidingMesh, info: IStaticMeshActorDecodeInfo, primitive: CollisionPrimitive_T<"staticMesh">) {
        super(info);

        (this as any).isStaticMeshActor = true;
        this.decodeInfo = info;
        this.collisionOwner = owner;
        this.primitive = primitive;
        this.collisionProfile = { ...info.collision };

        this.position.fromArray(info.position);
        this.quaternion.fromArray(info.quaternion);
        this.scale.fromArray(info.scale);
    }

    public createCollider(_world: World): Collider { throw new Error(`Actor '${this.name}' uses the collider of '${this.collisionOwner.name}'.`); }
    public getCollider(): Collider { return this.collisionOwner.getCollider(); }
    public getRigidbody(): RigidBody { return this.collisionOwner.getRigidbody(); }
    public getCollisionProfile(): ActorCollisionProfile_T { return this.collisionProfile; }
    public getCollisionPrimitive(): CollisionPrimitive_T { return this.primitive; }
    public getCollisionRadius(): number { return this.collisionProfile.collisionRadius; }
    public getCollisionHeight(): number { return this.collisionProfile.collisionHeight; }
    public setUnrealScriptProperty(id: string, value: ScriptValue_T): void { this.collisionOwner.setActorProperty(this, id, value); }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        if (call.index === 262 || call.name.toLowerCase() === "setcollision") {
            if (call.context !== this) throw new Error(`SetCollision context does not match '${this.name}'.`);

            this.collisionOwner.getComponent<ColliderComponent>("collider").setCollision(this, call.args[0] as boolean, call.args[1] as boolean, call.args[2] as boolean);
            return;
        }

        return super.callUnrealNative(call);
    }

    public release(notifyDestroyed = true): void {
        super.release(notifyDestroyed);

        if (this.isPendingKill()) this.collisionOwner.hasChangedCollisionActors = true;
    }
}

export default StaticMeshActor;
