import type * as RAPIER from "@dimforge/rapier3d";
import type * as THREE from "three";

export type ICollidable = THREE.Object3D<THREE.Event> & {
    readonly isCollidable: boolean;

    createCollider(physicsWorld: RAPIER.World): RAPIER.Collider;
    releaseCollider?(): void;
    getCollider(): RAPIER.Collider;
    getColliders?(): RAPIER.Collider[];
    getRigidbody(): RAPIER.RigidBody;
    getCollisionRadius(): number;
    getCollisionProfile?(): ActorCollisionProfile_T;
    getCollisionPrimitive?(): CollisionPrimitive_T;
    getBaseActor?(): ICollidable | null;
    getBasedActors?(): ReadonlySet<ICollidable>;
    addBasedActor?(actor: ICollidable): void;
    removeBasedActor?(actor: ICollidable): void;
};

export type CollisionHull_T = {
    planes: [number, number, number, number, number][];
    boxPlanes: [number, number, number, number, number][];
    bounds: THREE.Box3;
};

export type CollisionModel_T = {
    planes: Float32Array;
    children: Int32Array;
    isCsg: Uint8Array;
    hullIndices: Int32Array;
    hulls: CollisionHull_T[];
    rootOutside: boolean;
    bounds: THREE.Box3;
};

export type CollisionTriangleIndex_T = {
    minX: number;
    minY: number;
    cellSizeX: number;
    cellSizeY: number;
    sizeX: number;
    sizeY: number;
    offsets: Uint32Array;
    triangleIndices: Uint32Array;
    marks: Uint32Array;
    queryTag: number;
};



type CollisionPrimitiveUnion_T =
    | {
        kind: "bsp";
        model: CollisionModel_T;
        bounds: THREE.Box3;
        supportsZeroExtent: boolean;
        supportsNonZeroExtent: boolean;
        supportsPointCheck: boolean;
    }
    | {
        kind: "staticMesh";
        vertices: Float32Array;
        indices: Uint32Array;
        collisionNodes: Int32Array;
        collisionBounds: Float32Array;
        index?: CollisionTriangleIndex_T;
        collisionModel?: CollisionModel_T;
        useSimpleLineCollision?: boolean;
        useSimpleBoxCollision?: boolean;
        matrixWorld: THREE.Matrix4;
        bounds: THREE.Box3;
        supportsZeroExtent: boolean;
        supportsNonZeroExtent: boolean;
        supportsPointCheck: boolean;
    }
    | {
        kind: "terrain";
        vertices: Float32Array;
        indices: Uint32Array;
        index: CollisionTriangleIndex_T;
        matrixWorld: THREE.Matrix4;
        bounds: THREE.Box3;
        supportsZeroExtent: boolean;
        supportsNonZeroExtent: boolean;
        supportsPointCheck: boolean;
    }
    | {
        kind: "cylinder";
        center: THREE.Vector3;
        radius: number;
        halfHeight: number;
        bounds: THREE.Box3;
        supportsZeroExtent: boolean;
        supportsNonZeroExtent: boolean;
        supportsPointCheck: boolean;
    };

export type CollisionPrimitiveKind = CollisionPrimitiveUnion_T["kind"];

export type CollisionPrimitive_T<T extends CollisionPrimitiveKind = CollisionPrimitiveKind> = Extract<CollisionPrimitiveUnion_T, { kind: T }>;

export type ActorCollisionProfile_T = {
    collideActors: boolean;
    collideWorld: boolean;
    blockActors: boolean;
    blockPlayers: boolean;
    blockZeroExtent: boolean;
    blockNonZeroExtent: boolean;
    worldGeometry: boolean;
    useCylinderCollision: boolean;
    collisionRadius: number;
    collisionHeight: number;
    isPawn?: boolean;
};
