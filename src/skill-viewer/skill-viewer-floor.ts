import { World, Collider, RigidBody, ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { Box3, BufferAttribute, BufferGeometry, GridHelper, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { GameMesh } from "../game/components";
import { ColliderComponent } from "../physics/components/physics-component";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "../objects/objects";

const tmpPosition = new Vector3();
const tmpQuaternion = new Quaternion();

export class SkillViewerFloor extends GameMesh implements ICollidable {
    public readonly isCollidable = true;

    protected readonly vertices: Float32Array;
    protected readonly indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
    protected readonly renderIndices = new Uint32Array([0, 2, 1, 0, 3, 2]);
    protected readonly bounds = new Box3();
    protected readonly primitive: CollisionPrimitive_T;
    protected readonly collisionProfile: ActorCollisionProfile_T = { collideActors: true, collideWorld: true, blockActors: true, blockPlayers: true, blockZeroExtent: true, blockNonZeroExtent: true, worldGeometry: true, useCylinderCollision: false, collisionRadius: 0, collisionHeight: 0 };
    protected collider: Collider = null;
    protected rigidbody: RigidBody = null;

    public constructor(size: number) {
        super(new BufferGeometry(), new MeshBasicMaterial({ color: 0x2a2a2a }));

        this.vertices = new Float32Array([-size, -size, 0, size, -size, 0, size, size, 0, -size, size, 0]);
        this.geometry.setAttribute("position", new BufferAttribute(this.vertices, 3));
        // clip space X is flipped globally, render winding is reversed so the top face is the front
        this.geometry.setIndex(new BufferAttribute(this.renderIndices, 1));
        this.name = "SkillViewerFloor";

        const grid = new GridHelper(size * 2, size / 50, 0x555555, 0x3a3a3a);

        grid.rotation.x = Math.PI / 2;
        grid.position.z = 0.5;
        this.add(grid);

        this.primitive = { kind: "staticMesh", vertices: this.vertices, indices: this.indices, collisionNodes: null, collisionBounds: null, matrixWorld: this.matrixWorld, bounds: this.bounds, supportsZeroExtent: true, supportsNonZeroExtent: true, supportsPointCheck: true };

        this.addComponent(new ColliderComponent());
    }

    public createCollider(physicsWorld: World): Collider {
        this.rigidbody = physicsWorld.createRigidBody(RigidBodyDesc.fixed());
        this.collider = physicsWorld.createCollider(ColliderDesc.trimesh(this.vertices, this.indices), this.rigidbody);

        this.rigidbody.setTranslation(this.getWorldPosition(tmpPosition), false);
        this.rigidbody.setRotation(this.getWorldQuaternion(tmpQuaternion), false);

        return this.collider;
    }

    public releaseCollider(): void {
        this.collider = null;
        this.rigidbody = null;
    }

    public getCollider(): Collider { return this.collider; }
    public getRigidbody(): RigidBody { return this.rigidbody; }
    public getCollisionRadius(): number { return 0; }
    public getCollisionProfile(): ActorCollisionProfile_T { return this.collisionProfile; }

    public getCollisionPrimitive(): CollisionPrimitive_T {
        this.updateWorldMatrix(true, false);
        this.bounds.setFromArray(this.vertices).applyMatrix4(this.matrixWorld);

        return this.primitive;
    }
}

export default SkillViewerFloor;
