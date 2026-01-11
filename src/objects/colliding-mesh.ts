import RAPIER, { World, Collider, RigidBody, ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { Intersection, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import type { ICollidable } from "./objects";
import { SectorObject } from "@client/objects/zone-object";

export interface MeshLight {
    matrix: Matrix4,
    scene: { light: string, flags: Uint8Array }[],
    environment: { light: string, flags: Uint8Array }[]
}

class CollidingMesh extends Mesh implements ICollidable {
    public readonly isCollidable: boolean = true;
    public readonly isUpdatable: boolean = true;

    protected colliderDesc: ColliderDesc;
    protected rigidbodyDesc: RigidBodyDesc;
    protected rigidbody: RigidBody;
    protected collider: Collider;

    protected lightInfo: MeshLight;

    public constructor(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], colliderIndices: Uint32Array, lightInfo: any) {
        super(geometry, material);

        if (colliderIndices && geometry.hasAttribute("position") && colliderIndices.length > 0)
            this.makeCollider(colliderIndices, geometry.getAttribute("position").array as Float32Array);
        else this.isCollidable = false;

        this.lightInfo = lightInfo
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

    public update(sector: SectorObject) {
        debugger;
    }

}

export default CollidingMesh;
export { CollidingMesh };


