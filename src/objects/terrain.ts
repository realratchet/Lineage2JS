import RAPIER, { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { Object3D, Vector3 } from "three";
import type { ICollidable } from "./objects";

class Terrain extends Object3D implements ICollidable {
    public readonly isCollidable = true;

    protected rigidbodyDesc: RigidBodyDesc;
    protected colliderDesc: ColliderDesc;

    protected collider: RAPIER.Collider;
    protected rigidbody: RAPIER.RigidBody;

    protected bounds: THREE.Box3;
    protected boundsSize: THREE.Vector3;
    protected boundsPosition: THREE.Vector3;

    public setTerrainField(vx: number, vz: number, heightfield: Float32Array, bounds: THREE.Box3) {
        this.bounds = bounds;
        this.boundsSize = bounds.getSize(new Vector3());
        this.boundsPosition = bounds.getCenter(new Vector3());
        this.colliderDesc = ColliderDesc.heightfield(vx, vz, heightfield, { x: this.boundsSize.x, y: 0, z: this.boundsSize.z });
        this.rigidbodyDesc = RAPIER.RigidBodyDesc.fixed();

        // debugger;
    }

    public getCollider() { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }

    public createCollider(physicsWorld: RAPIER.World): this {
        this.rigidbody = physicsWorld.createRigidBody(this.rigidbodyDesc);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        this.rigidbody.setTranslation(this.position, true);
        // this.collider.setTranslation(this.position);

        // debugger;

        return this;

    }
}

export default Terrain;
export { Terrain };