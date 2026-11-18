import type * as RAPIER from "@dimforge/rapier3d";
import type * as THREE from "three";
import type { ScriptHost_T } from "../ue-script/vm";
import type Terrain from "./terrain";
import type BSPCollider from "./bsp-collider";
import type { CollisionModel_T } from "../physics/collision-model";
import type { CollisionTriangleIndex_T } from "../physics/triangle-index";

export function getScriptActor(actor: ICollidable | null): ScriptHost_T | null {
    if (!actor) return null;
    if ((actor as any).isBSPCollider) {
        const collider = actor as BSPCollider;
        const host = collider.scriptActor || collider.levelInfoActor;

        if (!host) throw new Error(`BSP '${actor.name}' has no script actor.`);
        return host;
    }
    if ((actor as any).isTerrain) {
        const host = (actor as Terrain).terrainInfoActor;

        if (!host) throw new Error(`Terrain '${actor.name}' has no TerrainInfo actor.`);
        return host;
    }
    return actor as unknown as ScriptHost_T;
}

export type ICollidable = THREE.Object3D & {
    readonly isCollidable: boolean;
    scriptClassId?: string;

    createCollider(physicsWorld: RAPIER.World): RAPIER.Collider;
    releaseCollider?(): void;
    getCollider(): RAPIER.Collider;
    getColliders?(): RAPIER.Collider[];
    getRigidbody(): RAPIER.RigidBody;
    getCollisionRadius(): number;
    getCollisionProfile?(): ActorCollisionProfile_T;
    getCollisionPrimitive?(): CollisionPrimitive_T;
    isEnterRising?(): boolean;
    getBaseActor?(): ICollidable | null;
    getBasedActors?(): ReadonlySet<ICollidable>;
    addBasedActor?(actor: ICollidable): void;
    removeBasedActor?(actor: ICollidable): void;
};

type CollisionPrimitiveUnion_T = {
    bounds: THREE.Box3;
    supportsZeroExtent: boolean;
    supportsNonZeroExtent: boolean;
    supportsPointCheck: boolean;
} & (
    {
        kind: "projector";
        planes: THREE.Plane[];
        direction: THREE.Vector3;
    }
    | {
        kind: "bsp";
        model: CollisionModel_T;
    }
    | {
        kind: "staticMesh";
        materialIndices?: Int32Array;
        materials?: (string | null)[];
        defaultMaterial?: string | null;
        vertices: Float32Array;
        indices: Uint32Array;
        collisionNodes: Int32Array;
        collisionBounds: Float32Array;
        index?: CollisionTriangleIndex_T;
        collisionModel?: CollisionModel_T;
        useSimpleLineCollision?: boolean;
        useSimpleBoxCollision?: boolean;
        matrixWorld: THREE.Matrix4;
    }
    | {
        kind: "terrain";
        vertices: Float32Array;
        indices: Uint32Array;
        index: CollisionTriangleIndex_T;
        matrixWorld: THREE.Matrix4;
    }
    | {
        kind: "cylinder";
        center: THREE.Vector3;
        radius: number;
        halfHeight: number;
    });

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
