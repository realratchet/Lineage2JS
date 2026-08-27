import { Vector3 } from "three";
import { IComponent, IObject, ObjectComponent } from "@client/game/components";
import type BaseActor from "@client/base-actor";
import type { ICollidable } from "@client/objects/objects";
import type MovableObject from "@client/objects/movable-object";
import type RotatingObject from "@client/objects/rotating-object";
import type PhysicsManager from "@client/physics/physics-manager";
import type UIManager from "@client/game/ui-manager";

interface IPhysicsComponent<TParent extends IObject = IObject> extends IComponent<TParent> {
    readonly isPhysicsComponent: boolean;
    isPhysicsAdded(manager: PhysicsManager): boolean;
    onPhysicsAdded(manager: PhysicsManager): void;
    onPhysicsRemoved(manager: PhysicsManager): void;
    getPhysicsTickRate?(): number;
    onPhysicsTick?(currentTime: number, deltaTime: number, actors: BaseActor[]): boolean;
    onTriggerPosition?(currentTime: number, position: Vector3): void;
}

abstract class PhysicsComponent<TParent extends IObject = IObject> extends ObjectComponent<TParent> implements IPhysicsComponent<TParent> {
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

class ColliderComponent extends PhysicsComponent<ICollidable & IObject> {
    public readonly componentName = "collider";
    protected isRegistered = false;

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

class MoverComponent extends PhysicsComponent<MovableObject & IObject> {
    public readonly componentName = "mover";
    protected uiManager: UIManager = null;
    protected nextUpdate = -1;
    protected uiPosition = NaN;

    public onPhysicsAdded(manager: PhysicsManager): void {
        super.onPhysicsAdded(manager);

        this.uiManager = manager.getParent().getComponent("ui");
    }

    public onPhysicsRemoved(manager: PhysicsManager): void {
        this.uiManager = null;

        super.onPhysicsRemoved(manager);
    }

    public onTriggerPosition(currentTime: number, position: Vector3): void {
        const nextUpdate = this.getParent().tryTrigger(currentTime, position);

        if (nextUpdate !== null) this.nextUpdate = nextUpdate;
    }

    public onPhysicsTick(currentTime: number, _deltaTime: number, actors: BaseActor[]): boolean {
        if (this.uiPosition !== this.uiManager.moverPosition) {
            this.uiPosition = this.uiManager.moverPosition;
            this.nextUpdate = -1;
            this.getParent().setPosition(this.uiPosition);
            return true;
        }

        if (this.nextUpdate < 0 || currentTime < this.nextUpdate) return false;

        this.nextUpdate = this.getParent().updateMover(currentTime, actors);

        return true;
    }
}

class RotatingComponent extends PhysicsComponent<RotatingObject & IObject> {
    public readonly componentName = "rotating";

    public onPhysicsTick(_currentTime: number, deltaTime: number, _actors: BaseActor[]): boolean {
        this.getParent().updateRotation(deltaTime);

        return true;
    }
}

export { ColliderComponent, MoverComponent, PhysicsComponent, RotatingComponent };
export type { IPhysicsComponent };
