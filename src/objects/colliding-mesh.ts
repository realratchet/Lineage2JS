import { World, Collider, RigidBody, ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, CollisionTriangleIndex_T, ICollidable } from "./objects";
import LitActorMesh, { MeshLight_T } from "./lit-actor";
import { Box3, Quaternion, Vector3 } from "three";
import buildTriangleIndex from "../physics/triangle-index";
import { ColliderComponent } from "../physics/components/physics-component";
import type { IStaticMeshActorDecodeInfo, IStaticMeshCollisionDecodeInfo, StaticMeshBatchInfo_T } from "@l2js/engine/contracts/mesh";
import buildCollisionModel from "../physics/collision-model";
import StaticMeshActor from "./static-mesh-actor";
import Actor from "./actor";
import type BaseActor from "../base-actor";
import type { default as UnScriptVM, ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";
import { ScriptComponent, type ScriptObjectFactory_T } from "../game/script-component";
import { setScriptObjectProperty } from "./components/actor-ownership-component";
import { releaseTouching, type TouchActor_T, type TransformComponent } from "./components/transform-component";

const tmpPosition = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpScale = new Vector3();

const COLLISION_ACTOR_CELL_SIZE = 512;

function getCollisionActorCell(x: number, y: number) { return (x + 32768) * 65536 + (y + 32768); }

export type CollidingMeshProps_T = { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo: MeshLight_T, colliderIndices: Uint32Array, scaledGlow: number, isSunAffected?: boolean, isSpecialLit?: boolean, forcedRegionTag?: string, forcedRegion?: number, permeatingLights?: string[], ambient?: { glow: number, vector: number[], isUnlit: boolean }, collision?: ActorCollisionProfile_T, staticMeshCollision?: IStaticMeshCollisionDecodeInfo, collisionIndex?: CollisionTriangleIndex_T };

export class CollidingMesh extends LitActorMesh implements ICollidable {
    public readonly isCollidable: boolean = true;
    declare public readonly isStaticMeshActor: boolean;
    public actorUuid: string;
    public readonly collisionActors: { actor: IStaticMeshActorDecodeInfo; object: StaticMeshActor; primitive: CollisionPrimitive_T<"staticMesh">; firstTriangle: number; triangleCount: number }[] = [];
    public hasChangedCollisionActors = false;
    protected collisionActorCells: Map<number, number[]> = null;
    protected collisionActorMarks: Uint32Array = null;
    protected collisionActorTag = 0;
    protected readonly collisionActorCandidates: number[] = [];
    declare public scriptProperties: Map<string, ScriptValue_T>;
    declare public scriptClassId: string;
    public scriptBase: BaseActor = null;

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
    protected scriptComponent: ScriptComponent = null;

    public constructor(props: CollidingMeshProps_T) {
        super(props);

        (this as any).isStaticMeshActor = true;

        this.collisionProfile = props.collision && { ...props.collision };
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
        this.hasChangedCollisionActors = false;
        for (const { actor, indexCount } of actors) {
            if (!Number.isSafeInteger(indexCount) || indexCount <= 0 || indexCount % 3 || !source || indexOffset + indexCount > source.length) throw new Error(`Actor '${actor.name}' has invalid collision triangles.`);
            const indices = source.subarray(indexOffset, indexOffset + indexCount);

            const bounds = new Box3();
            for (const index of indices) bounds.expandByPoint(tmpPosition.fromArray(vertices, index * 3));

            this.collisionActors.push({ actor, object: null, firstTriangle: indexOffset / 3, triangleCount: indices.length / 3, primitive: { kind: "staticMesh", vertices, indices, collisionNodes: null, collisionBounds: null, index: indices.length < 384 ? null : buildTriangleIndex(vertices, indices), matrixWorld: this.matrixWorld, bounds, supportsZeroExtent: true, supportsNonZeroExtent: true, supportsPointCheck: true } });
            indexOffset += indices.length;
        }

        this.collisionActorCells = null;

        if (source && indexOffset !== source.length) throw new Error(`Actor collision triangles do not cover '${this.name}'.`);
        if (this.colliderIndices && (this.colliderIndices !== source || indexOffset !== this.colliderIndices.length)) throw new Error(`Actor collision triangles do not cover '${this.name}'.`);
    }

    protected buildCollisionActorCells(): void {
        const cells = new Map<number, number[]>();

        for (let i = 0; i < this.collisionActors.length; i++) {
            const bounds = this.collisionActors[i].primitive.bounds;
            const minX = Math.floor(bounds.min.x / COLLISION_ACTOR_CELL_SIZE), maxX = Math.floor(bounds.max.x / COLLISION_ACTOR_CELL_SIZE);
            const minY = Math.floor(bounds.min.y / COLLISION_ACTOR_CELL_SIZE), maxY = Math.floor(bounds.max.y / COLLISION_ACTOR_CELL_SIZE);

            for (let x = minX; x <= maxX; x++)
                for (let y = minY; y <= maxY; y++) {
                    const key = getCollisionActorCell(x, y);
                    let cell = cells.get(key);

                    if (!cell) cells.set(key, cell = []);
                    cell.push(i);
                }
        }

        this.collisionActorCells = cells;
        this.collisionActorMarks = new Uint32Array(this.collisionActors.length);
    }

    public getCollisionActorCandidates(bounds: Box3): readonly number[] {
        if (!this.collisionActorCells) this.buildCollisionActorCells();

        const candidates = this.collisionActorCandidates, marks = this.collisionActorMarks, tag = ++this.collisionActorTag;
        const minX = Math.floor(bounds.min.x / COLLISION_ACTOR_CELL_SIZE), maxX = Math.floor(bounds.max.x / COLLISION_ACTOR_CELL_SIZE);
        const minY = Math.floor(bounds.min.y / COLLISION_ACTOR_CELL_SIZE), maxY = Math.floor(bounds.max.y / COLLISION_ACTOR_CELL_SIZE);

        candidates.length = 0;

        if ((maxX - minX + 1) * (maxY - minY + 1) > this.collisionActors.length) {
            for (let i = 0; i < this.collisionActors.length; i++) candidates.push(i);
            return candidates;
        }

        for (let x = minX; x <= maxX; x++)
            for (let y = minY; y <= maxY; y++) {
                const cell = this.collisionActorCells.get(getCollisionActorCell(x, y));

                if (!cell) continue;

                for (let i = 0; i < cell.length; i++)
                    if (marks[cell[i]] !== tag) {
                        marks[cell[i]] = tag;
                        candidates.push(cell[i]);
                    }
            }

        if (candidates.length > 1) candidates.sort((a, b) => a - b); // keep record order for hit tie-breaks and touch order

        return candidates;
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

        if (this.scriptClassId) {
            if (this.scriptComponent) this.scriptComponent.setRuntime(vm, objectFactory);
            else {
                setScriptObjectProperty(this, "Touching", []);
                // shortcut: map actors receive callbacks; defer PostBeginPlay until iterator/state initialization exists.
                this.scriptComponent = this.addComponent(new ScriptComponent(vm, objectFactory, this.scriptClassId));
            }
        }

        for (const record of this.collisionActors)
            if (record.object) record.object.setScriptRuntime(vm, objectFactory);
    }

    public getUnrealScriptProperty(id: string): ScriptValue_T {
        if (!this.scriptProperties) return null;
        if (id.slice(id.lastIndexOf(".") + 1).toLowerCase() === "location") return this.getWorldPosition(tmpPosition).toArray();

        return Actor.prototype.getUnrealScriptProperty.call(this, id);
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T { return Actor.prototype.callUnrealNative.call(this, call); }
    public getBaseActor(): ICollidable | null { return Actor.prototype.getBaseActor.call(this); }
    public setBase(actor: ICollidable | null): void {
        if (this.getComponent<TransformComponent>("transform").setBase(actor)) setScriptObjectProperty(this, "Base", actor as any);
    }
    public isPendingKill(): boolean { return Actor.prototype.isPendingKill.call(this); }
    public beginTouch(other: TouchActor_T): void { Actor.prototype.beginTouch.call(this, other); }
    public endTouch(other: TouchActor_T, noNotifySelf = false): void { Actor.prototype.endTouch.call(this, other, noNotifySelf); }
    public release(notifyDestroyed = true): void { Actor.prototype.release.call(this, notifyDestroyed); }

    public setUnrealScriptProperty(id: string, value: ScriptValue_T): void { this.setActorProperty(this, id, value); }

    public setActorProperty(actor: CollidingMesh | StaticMeshActor, id: string, value: ScriptValue_T): void {
        const field = id.slice(id.lastIndexOf(".") + 1);

        if (!actor.scriptProperties) throw new Error(`Actor '${actor.name}' has no UnrealScript property storage.`);
        setScriptObjectProperty(actor, field, value);

        const profile = actor.getCollisionProfile();

        switch (field.toLowerCase()) {
            case "location":
                if (actor !== this) return;

                tmpPosition.fromArray(value as number[]);
                if (this.parent) this.parent.worldToLocal(tmpPosition);
                this.position.copy(tmpPosition);
                return;
            case "bcollideactors": profile.collideActors = !!value; break;
            case "bcollideworld": profile.collideWorld = !!value; break;
            case "bblockactors": profile.blockActors = !!value; break;
            case "bblockplayers": profile.blockPlayers = !!value; break;
            case "bblockzeroextenttraces": profile.blockZeroExtent = !!value; break;
            case "bblocknonzeroextenttraces": profile.blockNonZeroExtent = !!value; break;
            case "bworldgeometry": profile.worldGeometry = !!value; break;
            case "bonlyaffectpawns": break;
            default: return;
        }

        if (actor !== this) this.hasChangedCollisionActors = true;
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
        this.rigidbody.setTranslation(this.getWorldPosition(tmpPosition), false);
        this.rigidbody.setRotation(this.getWorldQuaternion(tmpQuaternion), false);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        return this.collider;
    }

    public releaseCollider() {
        if (this.scriptComponent) releaseTouching(this);
        for (const record of this.collisionActors) {
            if (record.object) record.object.release();
            record.object = null;
        }
        this.hasChangedCollisionActors = false;
        this.collider = null;
        this.rigidbody = null;
    }

    public getCollider(): Collider { return this.collider; }
    public getRigidbody(): RigidBody { return this.rigidbody; }
    public getCollisionProfile(): ActorCollisionProfile_T { return this.collisionProfile; }
    public getCollisionRadius(): number { return this.collisionProfile.collisionRadius; }
    public getCollisionHeight(): number { return this.collisionProfile.collisionHeight; }
    public syncCollisionTransform(): void {
        this.updateMatrixWorld(true);
        this.getCollisionPrimitive();
        if (!this.rigidbody) return;

        this.rigidbody.setTranslation(this.getWorldPosition(tmpPosition), true);
        this.rigidbody.setNextKinematicTranslation(tmpPosition);
        this.collider.setTranslation(tmpPosition);
        this.rigidbody.setRotation(this.getWorldQuaternion(tmpQuaternion), true);
        this.rigidbody.setNextKinematicRotation(tmpQuaternion);
        this.collider.setRotation(tmpQuaternion);
    }
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
