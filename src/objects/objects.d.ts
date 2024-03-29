import type * as RAPIER from "@dimforge/rapier3d";

interface ICollidable extends THREE.Object3D<THREE.Event> {
    readonly isCollidable: boolean;

    createCollider(physicsWorld: RAPIER.World): RAPIER.Collider;
    getCollider(): RAPIER.Collider;
    getRigidbody(): RAPIER.RigidBody;
}