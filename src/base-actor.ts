import { World, Collider, RigidBody } from "@dimforge/rapier3d";
import { Box3, Box3Helper, BoxHelper, Color, LoopPingPong, Object3D, Vector3 } from "three";
import { ICollidable } from "./objects/objects";
import RenderManager from "./rendering/render-manager";
import RAPIER from "@dimforge/rapier3d";

class BaseActor extends Object3D implements ICollidable {
    public readonly isActor = true;
    public readonly isCollidable = true;
    public readonly type: string = "Actor";

    protected characterSpeed = 125;
    protected stepHeight = 10;

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
    protected actorAnimations: Record<string, THREE.AnimationClip> = {};

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

    public getCollider(): RAPIER.Collider { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }
    public createCollider(physicsWorld: RAPIER.World): RAPIER.Collider {
        this.colliderDesc = RAPIER.ColliderDesc.cuboid(this.collisionSize.x * 0.5, this.collisionSize.y * 0.5, this.collisionSize.z * 0.5);
        this.rigidbodyDesc = RAPIER.RigidBodyDesc.dynamic();
        this.rigidbodyDesc
            // .setGravityScale(0)
            // .lockTranslations()
            // .enabledTranslations(false, true, false)
            .lockRotations()
            .setTranslation(this.position.x, this.position.y, this.position.z);

        this.rigidbodyDesc.mass = 70;

        this.rigidbody = physicsWorld.createRigidBody(this.rigidbodyDesc);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        const helper = new Box3Helper(this.collisionBounds);

        this.add(helper);

        return this.collider;
    }

    public getColliderSize() { return this.collisionSize; }
    public getStepHeight() { return this.stepHeight; }

    public update(renderManager: RenderManager, currentTime: number, deltaTime: number) {
        this.lastUpdate = currentTime;

        const groundObjects = this.getGravityIntersections(this.stepHeight);
        const state = this.actorState;
        const desired = state.desired;

        const charSpeed = this.characterSpeed * 2;
        const charHeight = this.collisionSize.y, halfCharHeight = charHeight * 0.5;

        if (groundObjects.length > 0) {
            const groundIntersection = groundObjects[0];
            const startVec = this.rigidbody.translation();
            const desiredVec = new Vector3(0, halfCharHeight + 10, 0).add(groundIntersection.position);

            const lerpedVector = new Vector3().lerpVectors(startVec as THREE.Vector3, desiredVec, 0.9);

            this.rigidbody.setTranslation(lerpedVector, true);
            this.rigidbody.setLinvel(new Vector3(), false); // reset velocity since we're on ground

            desired.state = "idle";

            if (state.locomotion) {
                desired.state = "running";

                const lookPosition = new Vector3()
                    .copy(desired.position)
                    .setY(this.position.y);

                this.lookAt(lookPosition);

                const dt = desired.position.distanceTo(this.rigidbody.translation() as THREE.Vector3) * 10;
                const lookDirection = new Vector3().copy(lookPosition).sub(this.position).normalize();
                const distanceVector = new Vector3().copy(lookDirection).multiplyScalar(Math.min(dt, charSpeed));

                if (dt < charHeight) {
                    this.rigidbody.setTranslation(desired.position, true);
                    this.rigidbody.setLinvel(new Vector3(), true);
                    state.locomotion = false;
                    desired.state = "idle";
                } else this.rigidbody.setLinvel(distanceVector, true);

            }
        } else desired.state = "falling";

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

    public getGravityIntersections(maxToi = Infinity) {
        return this.getRayIntersections(
            new Vector3(0, -this.collisionSize.y * 0.5, 0).add(this.rigidbody.translation() as THREE.Vector3),
            new Vector3(0, -1, 0),
            maxToi
        );
    }

    public setMeshes(meshes: THREE.Mesh[]) {
        this.stopAnimations();

        for (const mesh of this.meshes)
            this.remove(mesh);

        this.meshes = meshes;

        for (const mesh of meshes)
            this.add(mesh);


        this.collisionBounds.min.set(-5, +10, -5);
        this.collisionBounds.max.set(+5, +45, +5);
        // this.collisionSize.set(20, 40, 20);
        this.collisionBounds.getSize(this.collisionSize);
    }

    public setAnimations(animations: Record<string, THREE.AnimationClip>) {
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

    protected isAnimationsInit = false;

    public initAnimations() {
        this.isAnimationsInit = true;
        this.playAnimation(this.basicActorAnimations.idle);
    }

    public playAnimation(animationName: string) {
        if (!this.isAnimationsInit) return;

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

    public goTo(position: Vector3) {
        this.actorState.locomotion = true;
        this.actorState.desired.position.copy(position);
        this.actorState.desired.position.y += this.getStepHeight() + this.getColliderSize().y * 0.5;
    }

}

export default BaseActor;
export { BaseActor };

class ActorState {
    public state: ValidStateNames_T = "idle";
    public locomotion: boolean = false;
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