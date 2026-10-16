import type { Collider, RigidBody, World } from "@dimforge/rapier3d";
import type { IStaticMeshActorDecodeInfo } from "@l2js/engine/contracts/mesh";
import Actor from "./actor";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "./objects";
import type CollidingMesh from "./colliding-mesh";
import type { ScriptValue_T } from "../ue-script/vm";

export class StaticMeshActor extends Actor implements ICollidable {
    public readonly isCollidable = true;
    declare public readonly isStaticMeshActor: boolean;
    public readonly decodeInfo: IStaticMeshActorDecodeInfo;
    public readonly collisionOwner: CollidingMesh;
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
    public setUnrealScriptProperty(id: string, value: ScriptValue_T): void { this.collisionOwner.setActorProperty(this, id, value); }

    public release(notifyDestroyed = true): void {
        super.release(notifyDestroyed);

        if (this.isPendingKill()) this.collisionOwner.hasChangedCollisionActors = true;
    }
}

export default StaticMeshActor;
