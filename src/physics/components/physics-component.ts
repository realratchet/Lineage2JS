import { Vector3 } from "three";
import { IComponent, IObject, ObjectComponent } from "../../game/components";
import type BaseActor from "../../base-actor";
import type { ICollidable } from "../../objects/objects";
import type MovableObject from "../../objects/movable-object";
import type RotatingObject from "../../objects/rotating-object";
import type PhysicsManager from "../physics-manager";
import type UIManager from "../../game/ui-manager";
import type { CollisionActor_T } from "../collision-world";
import type StaticMeshActor from "../../objects/static-mesh-actor";

export type IPhysicsComponent<TParent extends IObject = IObject> = IComponent<TParent> & {
    readonly isPhysicsComponent: boolean;
    isPhysicsAdded(manager: PhysicsManager): boolean;
    onPhysicsAdded(manager: PhysicsManager): void;
    onPhysicsRemoved(manager: PhysicsManager): void;
    onPhysicsTick?(currentTime: number, deltaTime: number, actors: BaseActor[]): boolean;
    onTriggerPosition?(currentTime: number, position: Vector3): void;
};

export abstract class PhysicsComponent<TParent extends IObject = IObject> extends ObjectComponent<TParent> implements IPhysicsComponent<TParent> {
    declare public readonly isPhysicsComponent: boolean;
    protected physicsManager: PhysicsManager = null;

    public constructor() {
        super();

        (this as any).isPhysicsComponent = true;
    }

    public isPhysicsAdded(manager: PhysicsManager): boolean { return this.physicsManager === manager; }

    public onPhysicsAdded(manager: PhysicsManager): void {
        if (this.physicsManager) throw new Error(`Physics component '${this.componentName}' is already registered.`);

        this.physicsManager = manager;
    }

    public onPhysicsRemoved(manager: PhysicsManager): void {
        if (this.physicsManager !== manager) throw new Error(`Physics component '${this.componentName}' is not registered here.`);

        this.physicsManager = null;
    }

    public onDetach(): void {
        if (this.physicsManager) this.physicsManager.unregisterPhysicsComponent(this);
    }
}

export class ColliderComponent extends PhysicsComponent<ICollidable & IObject> {
    public readonly componentName = "collider";
    protected isRegistered = false;

    public setCollision(actor: CollisionActor_T, collideActors?: boolean, blockActors?: boolean, blockPlayers?: boolean): void {
        if (!this.physicsManager) throw new Error(`Collision actor '${this.getParent().name}' has no physics manager.`);
        if (actor !== this.getParent() && (actor as StaticMeshActor).collisionOwner !== this.getParent())
            throw new Error(`Collision actor '${actor.name}' does not belong to '${this.getParent().name}'.`);

        this.physicsManager.setCollision(actor, collideActors, blockActors, blockPlayers);
    }

    public onPhysicsAdded(manager: PhysicsManager): void {
        super.onPhysicsAdded(manager);

        const object = this.getParent();

        if (!object.isCollidable) return;

        manager.registerCollider(object);
        this.isRegistered = true;
    }

    public onPhysicsRemoved(manager: PhysicsManager): void {
        if (this.isRegistered) manager.unregisterCollider(this.getParent());

        this.isRegistered = false;
        super.onPhysicsRemoved(manager);
    }

    public refresh(object: ICollidable & IObject & { refreshCollisionGeometry(): void }): void {
        if (this.isRegistered) this.physicsManager.unregisterCollider(object);

        object.refreshCollisionGeometry();

        if (this.isRegistered) this.physicsManager.registerCollider(object);
    }
}

export class MoverComponent extends PhysicsComponent<MovableObject & IObject> {
    public readonly componentName = "mover";
    protected uiManager: UIManager = null;
    protected areDoorsOpen = false;

    public onPhysicsAdded(manager: PhysicsManager): void {
        super.onPhysicsAdded(manager);

        this.uiManager = manager.getParent().getComponent("ui");
        this.areDoorsOpen = this.uiManager.areDoorsOpen;
        this.getParent().initializeMover();

        const doorPosition = manager.getParent().getComponent("network").getDoorPosition(this.getParent());

        if (doorPosition !== undefined) this.getParent().setOpen(doorPosition === 1);
    }

    public onPhysicsRemoved(manager: PhysicsManager): void {
        this.uiManager = null;

        super.onPhysicsRemoved(manager);
    }

    public onPhysicsTick(_currentTime: number, deltaTime: number, actors: BaseActor[]): boolean {
        if (this.areDoorsOpen !== this.uiManager.areDoorsOpen) {
            this.areDoorsOpen = this.uiManager.areDoorsOpen;
            this.getParent().setOpen(this.areDoorsOpen);
        }

        return this.getParent().updateMover(deltaTime, actors);
    }

}

export class RotatingComponent extends PhysicsComponent<RotatingObject & IObject> {
    public readonly componentName = "rotating";

    public onPhysicsTick(_currentTime: number, deltaTime: number, _actors: BaseActor[]): boolean {
        this.getParent().updateRotation(deltaTime);

        return true;
    }
}
