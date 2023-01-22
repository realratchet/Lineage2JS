import RAPIER, { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { Mesh, Vector3 } from "three";
import type { ICollidable } from "./objects";

class Terrain extends Mesh implements ICollidable {
    public readonly isCollidable = true;

    protected rigidbodyDesc: RigidBodyDesc;
    protected colliderDesc: ColliderDesc;

    protected collider: RAPIER.Collider;
    protected rigidbody: RAPIER.RigidBody;

    protected bounds: THREE.Box3;
    protected boundsSize: THREE.Vector3;
    protected boundsPosition: THREE.Vector3;

    constructor(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], fieldInfo?: TerrainFieldInfo_T) {
        super(geometry, material);

        if (fieldInfo) this.setTerrainField(fieldInfo);
    }

    public setTerrainField({ segments: [vx, vz], heightfield, bounds }: TerrainFieldInfo_T) {
        this.bounds = bounds;
        this.boundsSize = bounds.getSize(new Vector3());
        this.boundsPosition = bounds.getCenter(new Vector3());
        this.colliderDesc = ColliderDesc.heightfield(vx, vz, heightfield, { x: this.boundsSize.x, y: 1, z: this.boundsSize.z });
        this.rigidbodyDesc = RigidBodyDesc.fixed();
    }

    public getCollider() { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }

    public createCollider(physicsWorld: RAPIER.World) {
        this.rigidbody = physicsWorld.createRigidBody(this.rigidbodyDesc);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        this.rigidbody.setTranslation(this.position, false);

        return this.collider;

    }
}

export default Terrain;
export { Terrain };

type TerrainFieldInfo_T = {
    segments: [number, number],
    heightfield: Float32Array,
    bounds: THREE.Box3
}