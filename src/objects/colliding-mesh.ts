import RAPIER, { World, Collider, RigidBody, ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { Mesh } from "three";
import type { ICollidable } from "./objects";

class CollidingMesh extends Mesh implements ICollidable {
    public readonly isCollidable: boolean = true;

    protected colliderDesc: ColliderDesc;
    protected rigidbodyDesc: RigidBodyDesc;
    protected rigidbody: RigidBody;
    protected collider: Collider;

    public constructor(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], colliderIndices: Uint32Array) {
        super(geometry, material);

        if (colliderIndices && geometry.hasAttribute("position"))
            this.makeCollider(colliderIndices, geometry.getAttribute("position").array as Float32Array);
        else this.isCollidable = false;
    }

    public makeCollider(indices: Uint32Array, vertices: Float32Array) {
        this.colliderDesc = ColliderDesc.trimesh(vertices, indices)
        this.rigidbodyDesc = RigidBodyDesc.fixed();
    }

    public createCollider(physicsWorld: World): Collider {
        this.rigidbody = physicsWorld.createRigidBody(this.rigidbodyDesc);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        this.rigidbody.setTranslation(this.position, false);
        this.rigidbody.setRotation(this.quaternion, false);

        return this.collider;
    }

    public getCollider(): Collider { return this.collider; }
    public getRigidbody(): RigidBody { return this.rigidbody; }

}

export default CollidingMesh;
export { CollidingMesh };