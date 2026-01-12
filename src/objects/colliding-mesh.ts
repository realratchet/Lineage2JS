import { World, Collider, RigidBody, ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import type { ICollidable } from "./objects";
import LitActorMesh, { MeshLight } from "@client/objects/lit-actor";

class CollidingMesh extends LitActorMesh implements ICollidable {
    public readonly isCollidable: boolean = true;

    protected colliderDesc: ColliderDesc;
    protected rigidbodyDesc: RigidBodyDesc;
    protected rigidbody: RigidBody;
    protected collider: Collider;

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo: MeshLight, colliderIndices: Uint32Array, scaledGlow: number }) {
        super(props);

        if (props.colliderIndices && props.geometry.hasAttribute("position") && props.colliderIndices.length > 0)
            this.makeCollider(props.colliderIndices, props.geometry.getAttribute("position").array as Float32Array);
        else this.isCollidable = false;
    }

    public makeCollider(indices: Uint32Array, vertices: Float32Array) {
        this.colliderDesc = ColliderDesc.trimesh(vertices, indices);
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


