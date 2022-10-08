import { World, Collider, RigidBody } from "@dimforge/rapier3d";
import { Box3, Object3D, Vector3 } from "three";
import { ICollidable } from "./objects/objects";
import RenderManager from "./rendering/render-manager";
import RAPIER from "@dimforge/rapier3d";

class BaseActor extends Object3D implements ICollidable {
    public readonly isActor = true;
    public readonly isCollidable = true;
    public readonly type: string = "Actor";

    protected colliderDesc: RAPIER.ColliderDesc;
    protected rigidbodyDesc: RAPIER.RigidBodyDesc;

    protected collider: RAPIER.Collider;
    protected rigidbody: RAPIER.RigidBody;

    protected canFly = false;
    protected renderManager: RenderManager;
    protected lastUpdate: number;
    protected meshes: THREE.Object3D[] = [];
    protected activeAnimationClips: THREE.AnimationAction[] = [];
    protected actorAnimations: GenericObjectContainer_T<THREE.AnimationClip> = {};

    protected readonly collisionBounds = new Box3();
    protected readonly collisionSize = new Vector3();
    protected readonly actorState = new ActorState();
    protected readonly basicActorAnimations: BasicActorAnimations = {
        idle: null,
        walking: null,
        running: null,
        death: null,
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
            new Vector3(0, this.collisionSize.y * 0.5, 0).add(this.rigidbody.translation() as THREE.Vector3),
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
        for (const clip of this.activeAnimationClips)
            clip.stop();
    }

    protected setBasicActorAnimation(key: string, animationName: string) {
        if (!(animationName in this.actorAnimations))
            throw new Error(`'${animationName}' is not available.`);

        if (!(key in this.basicActorAnimations))
            throw new Error(`'${key}' is not a valid basic actor animation`);

        (this.basicActorAnimations as any)[key] = animationName;
    }

    public setIdleAnimation(animationName: string) { this.setBasicActorAnimation("idle", animationName); }
    public setWalkingAnimation(animationName: string) { this.setBasicActorAnimation("walking", animationName); }
    public setRunningAnimation(animationName: string) { this.setBasicActorAnimation("running", animationName); }
    public setDeathAnimation(animationName: string) { this.setBasicActorAnimation("death", animationName); }
    public setFallingAnimation(animationName: string) { this.setBasicActorAnimation("falling", animationName); }

    public initAnimations() { this.playAnimation(this.basicActorAnimations.idle); }
    public playAnimation(animationName: string) {
        if (!(animationName in this.actorAnimations))
            throw new Error(`'${animationName}' is not available.`);

        const clip = this.actorAnimations[animationName];
        const mixer = this.renderManager.mixer;

        for (let mesh of this.meshes) {
            const action = mixer.clipAction(clip, mesh);

            this.activeAnimationClips.push(action);

            action.play();
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
    death: string;
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