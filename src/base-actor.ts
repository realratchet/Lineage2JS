import { World, Collider, RigidBody } from "@dimforge/rapier3d";
import { Box3, Object3D, Vector3 } from "three";
import { ICollidable } from "./objects/objects";
import RenderManager from "./rendering/render-manager";
import RAPIER from "@dimforge/rapier3d";

class BaseActor extends Object3D implements ICollidable {
    public readonly isActor = true;
    public readonly isCollidable = true;
    public readonly type: string = "Actor";

    protected characterSpeed = 125;

    protected colliderDesc: RAPIER.ColliderDesc;
    protected rigidbodyDesc: RAPIER.RigidBodyDesc;

    protected collider: RAPIER.Collider;
    protected rigidbody: RAPIER.RigidBody;

    protected canFly = false;
    protected renderManager: RenderManager;
    protected lastUpdate: number;
    protected meshes: THREE.Object3D[] = [];
    protected currAnimations = new WeakMap<THREE.Object3D, THREE.AnimationAction>();
    protected prevAnimations = new WeakMap<THREE.Object3D, THREE.AnimationAction>();
    protected actorAnimations: GenericObjectContainer_T<THREE.AnimationClip> = {};

    protected readonly collisionBounds = new Box3();
    protected readonly collisionSize = new Vector3();
    protected readonly actorState = new ActorState();
    protected readonly basicActorAnimations: BasicActorAnimations = {
        idle: null,
        walking: null,
        running: null,
        dying: null,
        falling: null
    };

    constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public createCollider(physicsWorld: World): Collider { throw new Error("Method not implemented."); }
    public getCollider(): Collider { throw new Error("Method not implemented."); }
    public getRigidbody(): RigidBody { throw new Error("Method not implemented."); }

    public update(renderManager: RenderManager, currentTime: number, deltaTime: number) {
        this.lastUpdate = currentTime;

        const groundObjects = this.getGravityIntersections();
        const appliedVelocity = new Vector3();
        const itsct = groundObjects[0];
        const dt = deltaTime / 1000;
        const charSpeed = this.characterSpeed;
        const origin = new Vector3().copy(this.rigidbody.translation() as THREE.Vector3);

        const playerHeight = this.collisionSize.y;
        const playerHeightHalf = playerHeight * 0.5;

        const gravity = renderManager.physicsWorld.gravity;
        const gravityStep = new Vector3().copy(gravity as THREE.Vector3).multiplyScalar(dt);

        const itsctGround = groundObjects.length ? groundObjects[0] : null;
        const isOnFloor = itsctGround ? (itsct.toi <= this.collisionSize.y) : false;

        const state = this.actorState;
        const desired = state.desired;

        if (!isOnFloor) {
            desired.state = "falling";
            state.velocity.add(gravityStep).multiplyScalar(0.9);
        } else {
            desired.state = "idle";
            state.velocity.set(0, 0, 0);
        }

        const inputVelocity = new Vector3();
        const desiredPosition = new Vector3().copy(origin as THREE.Vector3);

        desiredPosition.add(state.velocity).add(inputVelocity);

        // if (itsctGround)
        //     desiredPosition.y = Math.max(itsctGround.position.y, desiredPosition.y - playerHeightHalf);

        this.rigidbody.setTranslation(desiredPosition, false);

        this.checkAnimationState();
    }

    protected checkAnimationState() {
        if (this.actorState.desired.state === this.actorState.state) return;

        this.actorState.state = this.actorState.desired.state;

        switch (this.actorState.state) {
            case "falling": this.playAnimation(this.basicActorAnimations.falling); break;
            case "idle": this.playAnimation(this.basicActorAnimations.idle); break;
            case "dying": this.playAnimation(this.basicActorAnimations.dying); break;
            case "walking": this.playAnimation(this.basicActorAnimations.walking); break;
            case "running": this.playAnimation(this.basicActorAnimations.running); break;
            default: new Error(`Unknown actor state: '${this.actorState.state}'`);
        }
    }

    public getRayIntersections(position: THREE.Vector3, direction: THREE.Vector3, maxToi: number) {
        const rm = this.renderManager;
        const ray = new RAPIER.Ray(position, direction);
        const collection: IntersectionResult[] = [];

        rm.physicsWorld.intersectionsWithRay(ray, maxToi, false, i => {
            const object = rm.colliderMap.get(i.collider);

            if (object !== this) {
                const position = new Vector3()
                    .copy(ray.dir as THREE.Vector3)
                    .multiplyScalar(i.toi)
                    .add(ray.origin as THREE.Vector3);

                collection.push({
                    ...i,
                    position,
                    object
                });
            }

            return true;
        });

        collection.sort((a, b) => a.toi - b.toi);

        return collection


    }

    public getGravityIntersections() {
        return this.getRayIntersections(
            new Vector3(0, this.collisionSize.y, 0).add(this.rigidbody.translation() as THREE.Vector3),
            new Vector3(0, -1, 0),
            Infinity
        );
    }

    public setMeshes(meshes: THREE.Mesh[]) {
        this.stopAnimations();

        for (const mesh of this.meshes)
            this.remove(mesh);

        this.meshes = meshes;

        for (const mesh of meshes) {
            this.add(mesh);

            this.collisionBounds.expandByPoint(mesh.geometry.boundingBox.min);
            this.collisionBounds.expandByPoint(mesh.geometry.boundingBox.max);
        }

        this.collisionBounds.getSize(this.collisionSize);
    }

    public setAnimations(animations: GenericObjectContainer_T<THREE.AnimationClip>) {
        this.stopAnimations();
        this.actorState.reset();
        this.actorAnimations = animations;
    }

    public stopAnimations() {
        for (const mesh of this.meshes) {
            if (this.prevAnimations.has(mesh))
                this.prevAnimations.get(mesh).stop();

            if (this.currAnimations.has(mesh))
                this.currAnimations.get(mesh).stop();
        }
    }

    protected setBasicActorAnimation(key: ValidStateNames_T, animationName: string) {
        if (!(animationName in this.actorAnimations))
            throw new Error(`'${animationName}' is not available.`);

        if (!(key in this.basicActorAnimations))
            throw new Error(`'${key}' is not a valid basic actor animation`);

        (this.basicActorAnimations as any)[key] = animationName;
    }

    public setIdleAnimation(animationName: string) { this.setBasicActorAnimation("idle", animationName); }
    public setWalkingAnimation(animationName: string) { this.setBasicActorAnimation("walking", animationName); }
    public setRunningAnimation(animationName: string) { this.setBasicActorAnimation("running", animationName); }
    public setDeathAnimation(animationName: string) { this.setBasicActorAnimation("dying", animationName); }
    public setFallingAnimation(animationName: string) { this.setBasicActorAnimation("falling", animationName); }

    public initAnimations() { this.playAnimation(this.basicActorAnimations.idle); }
    public playAnimation(animationName: string) {
        if (!(animationName in this.actorAnimations))
            throw new Error(`'${animationName}' is not available.`);

        const clip = this.actorAnimations[animationName];
        const mixer = this.renderManager.mixer;

        for (const mesh of this.meshes) {
            const prevAct = this.prevAnimations.get(mesh) || null;
            const currAct = this.currAnimations.get(mesh) || null;
            const nextAct = mixer.clipAction(clip, mesh);

            this.currAnimations.set(mesh, nextAct);

            if (prevAct) prevAct.stop();
            if (currAct) {
                this.prevAnimations.set(mesh, currAct);
                currAct.crossFadeTo(nextAct, 0.25, false);
            }

            nextAct.play();
        }
    }

}

export default BaseActor;
export { BaseActor };

class ActorState {
    public state: ValidStateNames_T = "idle";
    public readonly velocity = new Vector3();
    public readonly desired: DesiredState_T = {
        state: "idle",
        position: new Vector3(),
        direction: new Vector3()
    };

    public reset() {
        this.state = "idle";
        this.desired.state = "idle";
    }
}

type BasicActorAnimations = {
    idle: string;
    walking: string;
    running: string;
    dying: string;
    falling: string;
}

type DesiredState_T = {
    state: ValidStateNames_T;
    position: THREE.Vector3;
    direction: THREE.Vector3;
}

type ValidStateNames_T = "idle" | "walking" | "running" | "dying" | "falling";

type IntersectionResult = {
    position: THREE.Vector3,
    object: ICollidable
} & RAPIER.RayColliderIntersection;