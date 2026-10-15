import { World, Collider, RigidBody, ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, CollisionTriangleIndex_T, ICollidable } from "./objects";
import LitActorMesh, { MeshLight_T } from "./lit-actor";
import { Box3, Quaternion, Vector3 } from "three";
import buildTriangleIndex from "../physics/triangle-index";
import { ColliderComponent } from "../physics/components/physics-component";
import type { IStaticMeshActorDecodeInfo, IStaticMeshCollisionDecodeInfo, StaticMeshBatchInfo_T } from "@l2js/engine/contracts/mesh";
import buildCollisionModel from "../physics/collision-model";
import StaticMeshActor from "./static-mesh-actor";
import type UnScriptVM from "../ue-script/vm";
import type { ScriptObjectFactory_T } from "../game/script-component";

const tmpPosition = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpScale = new Vector3();

export type CollidingMeshProps_T = { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo: MeshLight_T, colliderIndices: Uint32Array, scaledGlow: number, isSunAffected?: boolean, isSpecialLit?: boolean, forcedRegionTag?: string, forcedRegion?: number, permeatingLights?: string[], ambient?: { glow: number, vector: number[], isUnlit: boolean }, collision?: ActorCollisionProfile_T, staticMeshCollision?: IStaticMeshCollisionDecodeInfo, collisionIndex?: CollisionTriangleIndex_T };

export class CollidingMesh extends LitActorMesh implements ICollidable {
    public readonly isCollidable: boolean = true;
    public actorUuid: string;
    public readonly collisionActors: { actor: IStaticMeshActorDecodeInfo; object: StaticMeshActor; primitive: CollisionPrimitive_T<"staticMesh">; firstTriangle: number; triangleCount: number }[] = [];

    protected colliderDesc: ColliderDesc;
    protected rigidbodyDesc: RigidBodyDesc;
    protected rigidbody: RigidBody;
    protected collider: Collider;
    protected colliderIndices: Uint32Array;
    protected colliderVertices: Float32Array;
    protected collisionNodes: Int32Array;
    protected collisionBounds: Float32Array;
    protected collisionProfile: ActorCollisionProfile_T;
    protected staticMeshCollision: IStaticMeshCollisionDecodeInfo;
    protected collisionIndex: CollisionTriangleIndex_T;
    protected readonly analyticalBounds = new Box3();
    protected readonly analyticalCenter = new Vector3();
    protected readonly simpleCollisionBounds = new Box3();
    protected readonly localColliderBounds = new Box3();
    protected analyticalPrimitive: CollisionPrimitive_T = null;
    protected readonly basedActors = new Set<ICollidable>();
    protected scriptVM: UnScriptVM = null;
    protected scriptObjectFactory: ScriptObjectFactory_T = null;

    public constructor(props: CollidingMeshProps_T) {
        super(props);

        (this as any).isStaticMeshActor = true;

        this.collisionProfile = props.collision;
        this.staticMeshCollision = props.staticMeshCollision;
        this.collisionIndex = props.collisionIndex;

        if (props.colliderIndices && props.geometry.hasAttribute("position") && props.colliderIndices.length > 0)
            this.makeCollider(props.colliderIndices, props.geometry.getAttribute("position").array as Float32Array);
        else this.isCollidable = false;

        this.addComponent(new ColliderComponent());
    }

    public setCollisionActors(actors: StaticMeshBatchInfo_T["actorColliders"], source: Uint32Array): void {
        const vertices = this.geometry.getAttribute("position").array as Float32Array;
        let indexOffset = 0;

        for (const record of this.collisionActors) if (record.object) record.object.release();
        this.collisionActors.length = 0;
        for (const { actor, indexCount } of actors) {
            if (!Number.isSafeInteger(indexCount) || indexCount <= 0 || indexCount % 3 || !source || indexOffset + indexCount > source.length) throw new Error(`Actor '${actor.name}' has invalid collision triangles.`);
            const indices = source.subarray(indexOffset, indexOffset + indexCount);

            const bounds = new Box3();
            for (const index of indices) bounds.expandByPoint(tmpPosition.fromArray(vertices, index * 3));

            this.collisionActors.push({ actor, object: null, firstTriangle: indexOffset / 3, triangleCount: indices.length / 3, primitive: { kind: "staticMesh", vertices, indices, collisionNodes: null, collisionBounds: null, index: null, matrixWorld: this.matrixWorld, bounds, supportsZeroExtent: true, supportsNonZeroExtent: true, supportsPointCheck: true } });
            indexOffset += indices.length;
        }

        if (source && indexOffset !== source.length) throw new Error(`Actor collision triangles do not cover '${this.name}'.`);
        if (this.colliderIndices && (this.colliderIndices !== source || indexOffset !== this.colliderIndices.length)) throw new Error(`Actor collision triangles do not cover '${this.name}'.`);
    }

    public getCollisionActor(item: number): StaticMeshActor {
        if (!this.collisionActors.length) return null;
        if (!Number.isInteger(item) || item < 0) throw new Error(`Invalid collision triangle '${item}' in '${this.name}'.`);

        let first = 0, last = this.collisionActors.length - 1;

        while (first <= last) {
            const index = (first + last) >>> 1, record = this.collisionActors[index];

            if (item < record.firstTriangle) last = index - 1;
            else if (item >= record.firstTriangle + record.triangleCount) first = index + 1;
            else {
                if (!record.object) {
                    record.object = new StaticMeshActor(this, record.actor, record.primitive);
                    if (this.scriptVM) record.object.setScriptRuntime(this.scriptVM, this.scriptObjectFactory);
                }
                return record.object;
            }
        }

        throw new Error(`Collision triangle '${item}' has no actor in '${this.name}'.`);
    }

    public setScriptRuntime(vm: UnScriptVM, objectFactory: ScriptObjectFactory_T): void {
        this.scriptVM = vm;
        this.scriptObjectFactory = objectFactory;

        for (const record of this.collisionActors)
            if (record.object) record.object.setScriptRuntime(vm, objectFactory);
    }

    public makeCollider(indices: Uint32Array, vertices: Float32Array) {
        this.colliderIndices = indices;
        this.colliderVertices = vertices;
        this.colliderDesc = ColliderDesc.trimesh(vertices, indices);
        this.rigidbodyDesc = RigidBodyDesc.fixed();

        const collisionModelInfo = this.staticMeshCollision?.collisionModel;
        const collisionModel = collisionModelInfo ? buildCollisionModel(collisionModelInfo.nodes, collisionModelInfo.rootOutside) : null;

        this.simpleCollisionBounds.makeEmpty();
        if (collisionModel) this.simpleCollisionBounds.copy(collisionModel.bounds);

        this.localColliderBounds.setFromArray(vertices).union(this.simpleCollisionBounds);

        if (this.staticMeshCollision?.nodes.length) {
            this.collisionNodes = this.staticMeshCollision.nodes;
            this.collisionBounds = this.staticMeshCollision.bounds;
        } else {
            this.collisionNodes = null;
            this.collisionBounds = null;
        }

        if (this.collisionProfile?.useCylinderCollision) {
            this.analyticalPrimitive = { kind: "cylinder", center: this.analyticalCenter, radius: this.collisionProfile.collisionRadius, halfHeight: this.collisionProfile.collisionHeight, bounds: this.analyticalBounds, supportsZeroExtent: true, supportsNonZeroExtent: true, supportsPointCheck: true };
        } else {
            this.analyticalPrimitive = {
                kind: "staticMesh",
                vertices: this.colliderVertices,
                indices: this.colliderIndices,
                collisionNodes: this.collisionNodes,
                collisionBounds: this.collisionBounds,
                index: this.collisionIndex || (this.colliderIndices.length < 384 ? null : buildTriangleIndex(this.colliderVertices, this.colliderIndices)),
                collisionModel,
                useSimpleLineCollision: !!collisionModel && this.staticMeshCollision.useSimpleLineCollision,
                useSimpleBoxCollision: !!collisionModel && this.staticMeshCollision.useSimpleBoxCollision,
                matrixWorld: this.matrixWorld,
                bounds: this.analyticalBounds,
                supportsZeroExtent: true,
                supportsNonZeroExtent: true,
                supportsPointCheck: true
            };
        }
    }

    public createCollider(physicsWorld: World): Collider {
        this.getWorldScale(tmpScale);

        if (tmpScale.x !== 1 || tmpScale.y !== 1 || tmpScale.z !== 1) {
            const vertices = new Float32Array(this.colliderVertices.length);
            const indices = new Uint32Array(this.colliderIndices);

            for (let i = 0, len = vertices.length; i < len; i += 3) {
                vertices[i] = this.colliderVertices[i] * tmpScale.x;
                vertices[i + 1] = this.colliderVertices[i + 1] * tmpScale.y;
                vertices[i + 2] = this.colliderVertices[i + 2] * tmpScale.z;
            }

            if (tmpScale.x * tmpScale.y * tmpScale.z < 0)
                for (let i = 0, len = indices.length; i < len; i += 3)
                    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];

            this.colliderDesc = ColliderDesc.trimesh(vertices, indices);
        }

        this.rigidbody = physicsWorld.createRigidBody(this.rigidbodyDesc);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        this.rigidbody.setTranslation(this.getWorldPosition(tmpPosition), false);
        this.rigidbody.setRotation(this.getWorldQuaternion(tmpQuaternion), false);

        return this.collider;
    }

    public releaseCollider() {
        for (const record of this.collisionActors) {
            if (record.object) record.object.release();
            record.object = null;
        }
        this.collider = null;
        this.rigidbody = null;
    }

    public getCollider(): Collider { return this.collider; }
    public getRigidbody(): RigidBody { return this.rigidbody; }
    public getCollisionProfile(): ActorCollisionProfile_T { return this.collisionProfile; }
    public getCollisionRadius(): number { return this.collisionProfile.collisionRadius; }
    public getBasedActors(): ReadonlySet<ICollidable> { return this.basedActors; }
    public addBasedActor(actor: ICollidable) { this.basedActors.add(actor); }
    public removeBasedActor(actor: ICollidable) { this.basedActors.delete(actor); }
    public getCollisionPrimitive(): CollisionPrimitive_T | null {
        if (!this.analyticalPrimitive) return null;

        if (this.analyticalPrimitive.kind === "cylinder") {
            this.getWorldPosition(this.analyticalCenter);
            this.analyticalBounds.min.set(this.analyticalCenter.x - this.analyticalPrimitive.radius, this.analyticalCenter.y - this.analyticalPrimitive.radius, this.analyticalCenter.z - this.analyticalPrimitive.halfHeight);
            this.analyticalBounds.max.set(this.analyticalCenter.x + this.analyticalPrimitive.radius, this.analyticalCenter.y + this.analyticalPrimitive.radius, this.analyticalCenter.z + this.analyticalPrimitive.halfHeight);
        } else {
            this.updateWorldMatrix(true, false);
            this.analyticalBounds.copy(this.localColliderBounds).applyMatrix4(this.matrixWorld);
        }

        return this.analyticalPrimitive;
    }
}

export default CollidingMesh;
