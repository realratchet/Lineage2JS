import RAPIER from "@dimforge/rapier3d";
import { Box3, Quaternion, Vector3 } from "three";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "../objects/objects";
import { pointPrimitive, queryPrimitive, sweptBounds, sweptIntersectsBox, type PrimitiveHit_T } from "./collision-primitive";
import buildCollisionModel from "./collision-model";
import CollisionOctree from "./collision-octree";
import type { DecodeLibrary } from "@l2js/engine";
import type PhysicsVolume from "../objects/physics-volume";
import type { ScriptHost_T, default as UnScriptVM } from "../ue-script/vm";
import { EPhysics_T } from "../assets/unreal/un-aactor";
import type BaseActor from "../base-actor";
import type { ScriptComponent } from "../game/script-component";
import { beginTouch, endTouch } from "../objects/components/transform-component";

const tmpVolumeBounds = new Box3();
const tmpBodyPosition = new Vector3();
const tmpTestDelta = new Vector3();
const tmpNormal = new Vector3();
const tmpRayDelta = new Vector3();
const identityRotation = new Quaternion();
const tmpEnd = new Vector3();
const tmpSweepBounds = new Box3();
const zeroExtentVector = new Vector3();
const tmpPlacementStart = new Vector3();
const tmpPlacementDelta = new Vector3();
const tmpSliceExtent = new Vector3();
const tmpSliceNormal = new Vector3();
const tmpSliceLocation = new Vector3();
const tmpEncroachmentExtent = new Vector3();
const tmpEncroachmentCenter = new Vector3();
const tmpEncroachmentBounds = new Box3();
const tmpOverlapCenter = new Vector3();
const tmpOverlapExtent = new Vector3();
const CELL_SIZE = 1024;
const PAWN_CELL_SIZE = 64;
const MAX_QUERY_CELLS = 4096;
const MAX_ENTRY_CELLS = 16384;
const ACTORBOX_EPSILON = Math.fround(4.2);
const DYNAMIC_CELL_MARGIN = 256; // Non-pawn movers retain a margin between dynamic re-grids.
// ULevel::MoveActor (0x85b3b0) extends the test by 2 units and subtracts them back off the result
const MOVE_ACTOR_EXTENSION = 2;
const COMPARISON_TIME_EPSILON = 0.001;
const COMPARISON_NORMAL_EPSILON = 0.001;
const CHECK_RESULT_POOL_SIZE = 128;
const RAY_RESULT_POOL_SIZE = 2;

export type CollisionBackend_T = "ue" | "rapier" | "compare";

export type CollisionQuery_T = {
    location: Vector3;
    delta: Vector3;
    extent: Vector3;
    sourceCollider?: RAPIER.Collider;
    sourceBody?: RAPIER.RigidBody;
    sourceActor?: ICollidable;
    sourceIsPlayer: boolean;
    sourceProfile?: ActorCollisionProfile_T;
    ignoredActors?: Set<ICollidable>;
    ignoreBases?: boolean;
    ignorePawns?: boolean;
    onlyWorldGeometry?: boolean;
    zeroExtent?: boolean;
    traceWorld?: boolean;
};

export type CollisionOverlapQuery_T = {
    onlyWorldGeometry?: boolean;
    location: Vector3;
    extent: Vector3;
    sourceCollider?: RAPIER.Collider;
    sourceBody?: RAPIER.RigidBody;
    sourceIsPlayer: boolean;
};

export type CheckResult_T = {
    item: number;
    time: number;
    location: Vector3;
    normal: Vector3;
    collider: RAPIER.Collider;
    actor: ICollidable | null;
};

export type RayCheckResult_T = {
    item: number;
    distance: number;
    location: Vector3;
    normal: Vector3;
    collider: RAPIER.Collider;
    actor: ICollidable | null;
};

export type PhysicsVolumeHit_T = { time: number, location: Vector3, normal: Vector3, actor: PhysicsVolume };
type PhysicsVolumeEntry_T = { actor: PhysicsVolume, primitive: CollisionPrimitive_T };
type PhysicsVolumeTree_T = { tree: CollisionOctree, entries: Map<string, PhysicsVolumeEntry_T> };

export type CollisionStats_T = {
    backend: CollisionBackend_T;
    queries: number;
    analyticalQueries: number;
    rapierQueries: number;
    analyticalCandidates: number;
    analyticalPrimitiveTests: number;
    unsupportedQueries: number;
    unsupportedCandidates: number;
    comparisons: number;
    comparisonMisses: number;
    comparisonActorDifferences: number;
    comparisonTimeDifferences: number;
    comparisonNormalDifferences: number;
    analyticalTime: number;
    rapierTime: number;
    registeredAnalytical: number;
    registeredUnsupported: number;
    registeredUnsupportedZeroExtent: number;
    registeredUnsupportedNonZeroExtent: number;
    registeredUnsupportedPointCheck: number;
};

type CollisionCells_T = Map<number, Map<number, Map<number, AnalyticalEntry_T[]>>>;

type AnalyticalEntry_T = {
    actor: ICollidable;
    primitive: CollisionPrimitive_T;
    bounds: Box3;
    order: number;
    queryMark: number;
    dynamic: boolean;
    active: boolean;
    cells: { x: number, y: number, z: number, entries: AnalyticalEntry_T[] }[];
    cellRange: number[];
    grid: CollisionCells_T;
    cellSize: number;
    margin: number;
};

const defaultProfile: ActorCollisionProfile_T = {
    collideActors: true,
    collideWorld: true,
    blockActors: true,
    blockPlayers: true,
    blockZeroExtent: true,
    blockNonZeroExtent: true,
    worldGeometry: true,
    useCylinderCollision: false,
    collisionRadius: 0,
    collisionHeight: 0
};

export class CollisionWorld {
    protected readonly world: RAPIER.World;
    protected backend: CollisionBackend_T;
    protected readonly colliderOwners = new Map<number, ICollidable>();
    protected readonly physicsVolumes = new Map<PhysicsVolume[], PhysicsVolumeEntry_T[]>();
    protected readonly physicsVolumeTrees = new Map<PhysicsVolume[], PhysicsVolumeTree_T>();
    protected readonly pawnLevels = new Map<BaseActor, PhysicsVolumeTree_T>();
    protected readonly volumeHit: PhysicsVolumeHit_T = { time: 1, location: new Vector3(), normal: new Vector3(), actor: null };
    protected readonly entriesByActor = new Map<ICollidable, AnalyticalEntry_T>();
    protected readonly unsupportedActors = new Set<ICollidable>();
    protected readonly analyticalEntries: AnalyticalEntry_T[] = [];
    protected readonly dynamicEntries: AnalyticalEntry_T[] = [];
    protected readonly largeEntries: AnalyticalEntry_T[] = [];
    protected readonly cells: CollisionCells_T = new Map();
    protected readonly pawnCells: CollisionCells_T = new Map();
    protected readonly arrShapes: { x: number, y: number, z: number, shape: RAPIER.Shape }[] = [];
    protected readonly arrCheckResults: CheckResult_T[] = [];
    protected readonly arrRayResults: RayCheckResult_T[] = [];
    protected readonly zeroShape = new RAPIER.Ball(0.001);
    protected readonly analyticalBestNormal = new Vector3();
    protected readonly ray = new RAPIER.Ray(zeroExtentVector, zeroExtentVector);
    protected readonly rayQuery: CollisionQuery_T = { location: zeroExtentVector, delta: zeroExtentVector, extent: zeroExtentVector, sourceIsPlayer: true, zeroExtent: true };
    protected readonly overlapQuery: CollisionQuery_T = { location: zeroExtentVector, delta: zeroExtentVector, extent: zeroExtentVector, sourceIsPlayer: true };
    protected readonly placementQuery: CollisionQuery_T = { location: zeroExtentVector, delta: tmpPlacementDelta, extent: zeroExtentVector, sourceIsPlayer: false, onlyWorldGeometry: true };
    protected keepTryingPlacement = false;
    protected queryMark = 0;
    protected dynamicMark = -1;
    protected nextOrder = 0;
    protected analyticalBestTime = Infinity;
    protected analyticalBestOrder = Infinity;
    protected analyticalBestItem = -1;
    protected analyticalBestActor: ICollidable = null;
    protected analyticalBestCollider: RAPIER.Collider = null;
    protected analyticalQuery: CollisionQuery_T = null;
    protected analyticalStart: Vector3 = null;
    protected analyticalEnd: Vector3 = null;
    protected analyticalExtent: Vector3 = null;
    protected analyticalTestDistance = 0;
    protected analyticalZeroExtent = false;
    protected analyticalUnsupported = false;
    protected rapierQuery: CollisionQuery_T = null;
    protected rapierZeroExtent = false;
    protected rapierQueryError: Error = null;
    protected checkResultIndex = 0;
    protected rayResultIndex = 0;
    protected readonly stats: CollisionStats_T = {
        backend: "ue",
        queries: 0,
        analyticalQueries: 0,
        rapierQueries: 0,
        analyticalCandidates: 0,
        analyticalPrimitiveTests: 0,
        unsupportedQueries: 0,
        unsupportedCandidates: 0,
        comparisons: 0,
        comparisonMisses: 0,
        comparisonActorDifferences: 0,
        comparisonTimeDifferences: 0,
        comparisonNormalDifferences: 0,
        analyticalTime: 0,
        rapierTime: 0,
        registeredAnalytical: 0,
        registeredUnsupported: 0,
        registeredUnsupportedZeroExtent: 0,
        registeredUnsupportedNonZeroExtent: 0,
        registeredUnsupportedPointCheck: 0
    };
    protected readonly rapierFilter: (collider: RAPIER.Collider) => boolean;

    protected filterRapierCollider(collider: RAPIER.Collider): boolean {
        if (this.rapierQueryError) return false;

        try {
            const actor = this.colliderOwners.get(collider.handle);

            if (actor && this.shouldIgnoreActor(actor, this.rapierQuery)) return false;

            return !actor || this.shouldBlockActor(actor, this.rapierQuery, this.rapierZeroExtent);
        } catch (error) {
            // Rapier swallows exceptions raised by query predicates.
            this.rapierQueryError = error;
            return false;
        }
    }

    protected checkRapierQueryError(): void {
        if (!this.rapierQueryError) return;

        const error = this.rapierQueryError;
        this.rapierQueryError = null;
        throw error;
    }

    public constructor(world: RAPIER.World, backend: CollisionBackend_T = "ue") {
        this.world = world;
        this.rapierFilter = this.filterRapierCollider.bind(this);

        for (let i = 0; i < CHECK_RESULT_POOL_SIZE; i++)
            this.arrCheckResults.push({ item: -1, time: 0, location: new Vector3(), normal: new Vector3(), collider: null, actor: null });

        for (let i = 0; i < RAY_RESULT_POOL_SIZE; i++)
            this.arrRayResults.push({ item: -1, distance: 0, location: new Vector3(), normal: new Vector3(), collider: null, actor: null });

        this.setBackend(backend);
    }

    public setBackend(backend: CollisionBackend_T) {
        if (backend !== "ue" && backend !== "rapier" && backend !== "compare") throw new Error(`Unknown collision backend '${backend}'.`);

        this.backend = backend;
        this.stats.backend = backend;
    }

    public getBackend(): CollisionBackend_T { return this.backend; }
    public usesRapier(): boolean { return this.backend !== "ue"; }
    public getStats(): CollisionStats_T {
        return { ...this.stats, backend: this.backend, registeredAnalytical: this.entriesByActor.size };
    }

    public resetStats() {
        for (const key in this.stats)
            if (key !== "backend" && !key.startsWith("registered")) (this.stats as any)[key] = 0;
    }

    public register(object: ICollidable, colliders: RAPIER.Collider[]) {
        for (const collider of colliders)
            this.colliderOwners.set(collider.handle, object);

        if (this.entriesByActor.has(object)) return;

        const primitive = object.getCollisionPrimitive ? object.getCollisionPrimitive() : null;

        if (!primitive) {
            this.unsupportedActors.add(object);
            this.stats.registeredUnsupported++;
            return;
        }

        const dynamic = primitive.kind === "cylinder" || !!(object as any).isMovableObject || !!(object as any).isRotatingObject;
        let bounds = primitive.bounds;

        if (primitive.kind === "bsp" && !(object as any).isVolume) {
            const sector = object.parent as any;

            if (sector?.gridBounds && sector?.worldBounds) {
                bounds = new Box3();
                bounds.min.set(sector.gridBounds.min.x, sector.gridBounds.min.z, sector.worldBounds.min.z);
                bounds.max.set(sector.gridBounds.max.x, sector.gridBounds.max.z, sector.worldBounds.max.z);
            }
        }

        const pawn = primitive.kind === "cylinder" && object.getCollisionProfile().isPawn;
        const entry: AnalyticalEntry_T = { actor: object, primitive, bounds, order: this.nextOrder++, queryMark: 0, dynamic, active: true, cells: [], cellRange: [], grid: pawn ? this.pawnCells : this.cells, cellSize: pawn ? PAWN_CELL_SIZE : CELL_SIZE, margin: pawn ? 0 : dynamic ? DYNAMIC_CELL_MARGIN : 0 };

        this.entriesByActor.set(object, entry);
        this.analyticalEntries.push(entry);

        if (!primitive.supportsZeroExtent) this.stats.registeredUnsupportedZeroExtent++;
        if (!primitive.supportsNonZeroExtent) this.stats.registeredUnsupportedNonZeroExtent++;
        if (!primitive.supportsPointCheck) this.stats.registeredUnsupportedPointCheck++;

        if (dynamic) this.dynamicEntries.push(entry);

        this.insertEntry(entry, entry.margin);
    }

    public unregister(actor: ICollidable, colliders: RAPIER.Collider[]) {
        const entry = this.entriesByActor.get(actor);

        if (entry) {
            entry.active = false;
            this.entriesByActor.delete(actor);

            if (!entry.primitive.supportsZeroExtent) this.stats.registeredUnsupportedZeroExtent--;
            if (!entry.primitive.supportsNonZeroExtent) this.stats.registeredUnsupportedNonZeroExtent--;
            if (!entry.primitive.supportsPointCheck) this.stats.registeredUnsupportedPointCheck--;

            this.removeFromCells(entry);
            removeEntry(this.analyticalEntries, entry);
            removeEntry(this.dynamicEntries, entry);
            removeEntry(this.largeEntries, entry);
        } else if (actor && this.unsupportedActors.delete(actor)) this.stats.registeredUnsupported = Math.max(0, this.stats.registeredUnsupported - 1);

        for (const collider of colliders)
            if (collider) this.colliderOwners.delete(collider.handle);
    }

    // One dynamic re-grid per frame replaces roughly 180 full actor scans.
    public updateDynamicEntries(mark: number) {
        if (mark === this.dynamicMark) return;

        this.dynamicMark = mark;

        for (const [pawn, level] of this.pawnLevels) this.updateLevelPawn(pawn, level);

        for (const entry of this.dynamicEntries) {
            if (!entry.active) continue;

            entry.primitive = entry.actor.getCollisionPrimitive();
            entry.bounds = entry.primitive.bounds;

            if (this.isInCellRange(entry, entry.margin)) continue;

            this.removeFromCells(entry);
            removeEntry(this.largeEntries, entry);
            this.insertEntry(entry, entry.margin);
        }
    }

    public removeActor(actor: ICollidable): void {
        const entry = this.entriesByActor.get(actor);
        if (!entry) throw new Error(`Collision actor '${actor.name}' is not registered.`);
        entry.active = false;
        this.removeFromCells(entry);
        removeEntry(this.largeEntries, entry);
    }

    public addActor(actor: ICollidable): void {
        const entry = this.entriesByActor.get(actor);
        if (!entry) throw new Error(`Collision actor '${actor.name}' is not registered.`);
        this.removeActor(actor);
        entry.primitive = actor.getCollisionPrimitive();
        if (!entry.primitive) throw new Error(`Collision actor '${actor.name}' has no analytical primitive.`);
        entry.bounds = entry.primitive.bounds;
        entry.active = true;
        this.insertEntry(entry, entry.margin);
    }

    public moveActor(query: CollisionQuery_T): CheckResult_T | null {
        const hit = this.sweepQuery(query, MOVE_ACTOR_EXTENSION);

        if (hit) query.location.copy(hit.location);
        else query.location.add(query.delta);

        return hit;
    }

    // ULevel::SingleLineCheck is a plain trace; only MoveActor extends and backs the result off
    public singleLineCheck(query: CollisionQuery_T): CheckResult_T | null {
        if (query.traceWorld && (query.sourceActor || query.sourceCollider || query.sourceBody)) throw new Error(`World traces require a null source.`);
        return this.sweepQuery(query, 0);
    }

    public findSpot(extent: Vector3, location: Vector3): boolean {
        const query = this.placementQuery;

        query.location = location;
        query.extent = extent;
        if (!this.overlapCheck(query)) return true;
        if (extent.x === 0 && extent.y === 0 && extent.z === 0) return false;

        tmpPlacementStart.copy(location);
        if (this.checkSlice(extent, location)) return true;
        if (!this.keepTryingPlacement) return false;

        tmpSliceExtent.copy(extent).multiplyScalar(0.5).setZ(1);
        let numFit = 0;

        for (let i = -1; i < 2; i += 2)
            for (let j = -1; j < 2; j += 2) {
                if (numFit >= 2) continue;

                const x = 0.55 * extent.x * i, y = 0.55 * extent.y * j;

                tmpSliceLocation.copy(tmpPlacementStart).add(tmpPlacementDelta.set(x, y, 0));
                query.location = tmpSliceLocation;
                query.extent = tmpSliceExtent;
                if (this.overlapCheck(query)) continue;

                numFit++;
                location.x += 1.1 * x;
                location.y += 1.1 * y;
            }

        if (!numFit) return false;
        if (numFit === 1) location.multiplyScalar(2).sub(tmpPlacementStart);

        query.location = location;
        query.extent = extent;
        if (this.overlapCheck(query)) return false;

        tmpPlacementDelta.copy(tmpPlacementStart).sub(location).multiplyScalar(0.2).add(tmpPlacementStart).sub(location);
        const hit = this.singleLineCheck(query);

        if (hit) location.copy(hit.location);
        return true;
    }

    protected checkSlice(extent: Vector3, location: Vector3): boolean {
        const query = this.placementQuery;

        this.keepTryingPlacement = false;
        tmpSliceExtent.copy(extent).setZ(1);
        query.location = location;
        query.extent = tmpSliceExtent;
        if (this.overlapCheck(query)) {
            this.keepTryingPlacement = true;
            return false;
        }

        tmpPlacementDelta.set(0, 0, -2 * extent.z);
        const floor = this.singleLineCheck(query);

        tmpSliceNormal.set(0, 0, 0);
        if (floor) tmpSliceNormal.copy(floor.normal).setZ(0);
        query.extent = extent;

        if (!floor || floor.time > 0.5) {
            location.z += floor ? -(2 * floor.time - 1) * extent.z + 1 : -extent.z;
            if (!this.overlapCheck(query)) {
                tmpPlacementDelta.set(0, 0, extent.z);
                const ceiling = this.singleLineCheck(query);

                if (ceiling) location.copy(ceiling.location);
                else location.z += extent.z;
                return true;
            }
        } else {
            location.z += (0.5 - floor.time) * 2 * extent.z + 1;
            if (!this.overlapCheck(query)) return true;
        }

        location.addScaledVector(tmpSliceNormal, extent.x);
        return !this.overlapCheck(query);
    }

    public registerPhysicsVolumes(volumes: PhysicsVolume[], library: DecodeLibrary): void {
        if (this.physicsVolumes.has(volumes)) return;

        const entries: PhysicsVolumeEntry_T[] = [];

        for (const actor of volumes) {
            let primitive: CollisionPrimitive_T;

            if (actor.bsp) {
                const nodes = actor.bsp.nodes.map(node => ({ plane: node.plane, children: [node.iFront, node.iBack], isCsg: node.isCsg }));
                const model = buildCollisionModel(nodes as any, actor.bsp.isRootOutside);
                const bounds = new Box3(new Vector3().fromArray(actor.bsp.bounds.min), new Vector3().fromArray(actor.bsp.bounds.max));
                primitive = { kind: "bsp", model, bounds, supportsZeroExtent: true, supportsNonZeroExtent: false, supportsPointCheck: false };
            } else {
                primitive = { kind: "cylinder", center: new Vector3().fromArray(getTraceProperty(actor, "Location") as number[]), radius: getTraceProperty(actor, "CollisionRadius") as number, halfHeight: getTraceProperty(actor, "CollisionHeight") as number, bounds: new Box3(), supportsZeroExtent: true, supportsNonZeroExtent: false, supportsPointCheck: false };
            }

            entries.push({ actor, primitive });
        }

        const tree = new CollisionOctree(), records = new Map([...library.staticMeshCollisionActors, ...library.volumeCollisionActors].map(record => [record.uuid, record]));
        for (const uuid of library.levelActorUuids) {
            const record = records.get(uuid);
            if (!record || !record.collision.collideActors) continue;
            tmpVolumeBounds.min.fromArray(record.collisionBounds.min);
            tmpVolumeBounds.max.fromArray(record.collisionBounds.max);
            tree.addActor(uuid, tmpVolumeBounds);
        }
        this.physicsVolumeTrees.set(volumes, { tree, entries: new Map(entries.map(entry => [entry.actor.actorUuid, entry])) });
        this.physicsVolumes.set(volumes, entries);
    }

    public unregisterPhysicsVolumes(volumes: PhysicsVolume[]): void {
        const level = this.physicsVolumeTrees.get(volumes);
        for (const [pawn, owner] of this.pawnLevels)
            if (owner === level) this.setPawnLevel(pawn, null);
        this.physicsVolumes.delete(volumes);
        this.physicsVolumeTrees.delete(volumes);
    }

    public setPawnLevel(pawn: BaseActor, volumes: PhysicsVolume[] | null): void {
        const previous = this.pawnLevels.get(pawn), level = volumes ? this.physicsVolumeTrees.get(volumes) : null;
        if (volumes && !level) throw new Error(`Pawn '${pawn.name}' has no registered owning level.`);
        if (previous && previous !== level) previous.tree.removeActor(pawn.uuid);
        if (!level) {
            this.pawnLevels.delete(pawn);
            return;
        }
        this.pawnLevels.set(pawn, level);
        this.updateLevelPawn(pawn, level);
    }

    protected updateLevelPawn(pawn: BaseActor, level: PhysicsVolumeTree_T): void {
        if (!pawn.getUnrealScriptProperty("bCollideActors") || pawn.isPendingKill()) {
            level.tree.removeActor(pawn.uuid);
            return;
        }
        pawn.getWorldPosition(tmpBodyPosition);
        const radius = Math.fround(Math.fround(pawn.getCollisionRadius()) + 1), height = Math.fround(pawn.getCollisionHeight());
        const x = Math.fround(tmpBodyPosition.x), y = Math.fround(tmpBodyPosition.y), z = Math.fround(tmpBodyPosition.z + height);
        tmpVolumeBounds.min.set(Math.fround(x - radius), Math.fround(y - radius), Math.fround(z - height - 1));
        tmpVolumeBounds.max.set(Math.fround(x + radius), Math.fround(y + radius), Math.fround(z + height + 1));
        level.tree.updateActor(pawn.uuid, tmpVolumeBounds);
    }

    public updatePawnCollision(pawn: BaseActor): void {
        const level = this.pawnLevels.get(pawn);
        if (level) this.updateLevelPawn(pawn, level);

        const entry = this.entriesByActor.get(pawn);
        if (!entry || !entry.active || entry.grid !== this.pawnCells) return;

        entry.primitive = pawn.getCollisionPrimitive();
        entry.bounds = entry.primitive.bounds;
        if (this.isInCellRange(entry, entry.margin)) return;

        this.removeFromCells(entry);
        removeEntry(this.largeEntries, entry);
        this.insertEntry(entry, entry.margin);
    }

    public removePawnCollision(pawn: BaseActor): void {
        const level = this.pawnLevels.get(pawn);
        if (level) level.tree.removeActor(pawn.uuid);
    }

    public physicsVolumePointCheck(location: Vector3, volumes: PhysicsVolume[]): PhysicsVolume[] {
        const actors: PhysicsVolume[] = [], group = this.physicsVolumeTrees.get(volumes);
        if (!group) throw new Error(`Physics volume point query has no registered level.`);

        for (const [pawn, level] of this.pawnLevels)
            if (level === group) this.updateLevelPawn(pawn, level);

        for (const entry of this.physicsVolumes.get(volumes)) {
            const actor = entry.actor, primitive = entry.primitive;
            if (primitive.kind !== "cylinder") continue;
            primitive.center.fromArray(getTraceProperty(actor, "Location") as number[]);
            primitive.radius = getTraceProperty(actor, "CollisionRadius") as number;
            primitive.halfHeight = getTraceProperty(actor, "CollisionHeight") as number;
            if (!getTraceProperty(actor, "bCollideActors")) {
                group.tree.removeActor(actor.actorUuid);
                continue;
            }
            const radius = Math.fround(primitive.radius + 1), height = primitive.halfHeight + 1, center = primitive.center;
            tmpVolumeBounds.min.set(Math.fround(center.x - radius), Math.fround(center.y - radius), Math.fround(center.z - height));
            tmpVolumeBounds.max.set(Math.fround(center.x + radius), Math.fround(center.y + radius), Math.fround(center.z + height));
            group.tree.updateActor(actor.actorUuid, tmpVolumeBounds);
        }
        // shortcut: unhooked attachment/raw position writes refresh at dynamic updates/queries; native substep ordering and mesh/brush movers remain unwired.
        for (const uuid of group.tree.pointCheck(location)) {
            const entry = group.entries.get(uuid);
            if (!entry) continue;
            const actor = entry.actor;
            if (!getTraceProperty(actor, "bCollideActors") || !getTraceProperty(actor, "bBlockNonZeroExtentTraces")) continue;
            if (pointPrimitive(entry.primitive, location, zeroExtentVector)) actors.push(actor);
        }
        return actors.reverse();
    }

    public isBlockedBy(source: ScriptHost_T, target: ScriptHost_T, vm: UnScriptVM): boolean {
        // AActor::IsBlockedBy (0x7cd650).
        if (getTraceProperty(target, "bWorldGeometry")) return !!getTraceProperty(source, "bCollideWorld");

        const sourceEncroacher = isEncroacher(source, vm);
        if (sourceEncroacher && getTraceProperty(target, "bIgnoreEncroachers")) return false;
        const targetEncroacher = isEncroacher(target, vm);
        if (targetEncroacher && getTraceProperty(source, "bIgnoreEncroachers")) return false;

        if (getTraceProperty(target, "Brush") && isActorClass(target, "Brush", vm) || targetEncroacher)
            return !!getTraceProperty(source, "bCollideWorld") && !!getTraceProperty(target, isPlayerPawn(source, vm) ? "bBlockPlayers" : "bBlockActors");

        if (getTraceProperty(source, "Brush") && isActorClass(source, "Brush", vm) || sourceEncroacher)
            return !!getTraceProperty(target, "bCollideWorld") && !!getTraceProperty(source, isPlayerPawn(target, vm) ? "bBlockPlayers" : "bBlockActors");

        if (!getTraceProperty(target, isPlayerPawn(source, vm) || isActorClass(source, "Projectile", vm) ? "bBlockPlayers" : "bBlockActors")) return false;

        return !!getTraceProperty(source, isPlayerPawn(target, vm) || isActorClass(target, "Projectile", vm) ? "bBlockPlayers" : "bBlockActors");
    }

    public isOverlapping(source: ICollidable & ScriptHost_T, target: ScriptHost_T, vm: UnScriptVM): boolean {
        // shortcut: ordinary cylinder pawns only; extend before encroacher or brush-source movement.
        if (!source.getCollisionProfile().isPawn || source.getCollisionPrimitive().kind !== "cylinder" || isEncroacher(source, vm))
            throw new Error(`Unsupported overlap source '${source.name}'.`);
        if (source === target || getTraceProperty(source, "Level") === target) return false;
        if (isJoinedTo(source, target) || isJoinedTo(target, source)) return false;
        if (getTraceProperty(source, "bOnlyAffectPawns") && !isActorClass(target, "Pawn", vm)) return false;
        if (!getTraceProperty(source, "bBlockNonZeroExtentTraces") || !getTraceProperty(target, "bBlockNonZeroExtentTraces")) return false;

        const location = getTraceProperty(source, "Location") as number[], otherLocation = getTraceProperty(target, "Location") as number[];
        const radius = getTraceProperty(source, "CollisionRadius") as number, height = getTraceProperty(source, "CollisionHeight") as number;
        if (isActorClass(target, "Projector", vm) || getTraceProperty(target, "Brush") && isActorClass(target, "Volume", vm) || isActorClass(target, "FluidSurfaceInfo", vm) || isEncroacher(target, vm)) {
            let primitive = (target as any).getCollisionPrimitive ? (target as any).getCollisionPrimitive() as CollisionPrimitive_T : null;
            if (!primitive) for (const entries of this.physicsVolumes.values()) {
                const entry = entries.find(entry => entry.actor === target);
                if (entry) { primitive = entry.primitive; break; }
            }
            if (!primitive) throw new Error(`Overlap target '${target.scriptClassId}' has no analytical primitive.`);
            tmpOverlapCenter.fromArray(location);
            tmpOverlapExtent.set(radius, radius, height);
            return !!pointPrimitive(primitive, tmpOverlapCenter, tmpOverlapExtent);
        }

        const dz = location[2] - otherLocation[2], totalHeight = height + (getTraceProperty(target, "CollisionHeight") as number);
        if (dz * dz >= totalHeight * totalHeight) return false;
        const dx = location[0] - otherLocation[0], dy = location[1] - otherLocation[1], totalRadius = radius + (getTraceProperty(target, "CollisionRadius") as number);
        return dx * dx + dy * dy < totalRadius * totalRadius;
    }

    public checkEncroachment(source: BaseActor, location: Vector3, touchNotify: boolean, vm: UnScriptVM): boolean {
        if (!getTraceProperty(source, "bCollideActors") && !getTraceProperty(source, "bBlockActors") && !getTraceProperty(source, "bBlockPlayers")) return false;
        const actors = this.actorEncroachmentCheck(source, location);
        const level = getTraceProperty(source, "Level");

        // ULevel::CheckEncroachment (0x85d2a2..0x85d40f), ordinary-pawn branch.
        for (const actor of actors) {
            if (actor === source || actor === level || isJoinedTo(actor, source) || !this.isBlockedBy(source, actor, vm)) continue;
            if (!source.isPendingKill() && source.getComponent<ScriptComponent>("script").call("EncroachingOn", [actor])) return true;
        }

        if (touchNotify) {
            let touching = getTraceProperty(source, "Touching") as BaseActor[];
            for (let index = 0; index < touching.length; touching = getTraceProperty(source, "Touching") as BaseActor[]) {
                const actor = touching[index];
                if (actor && !this.isOverlapping(source, actor, vm)) endTouch(source, actor);
                else index++;
            }
        }

        for (const actor of actors) {
            if (actor === source || actor === level || isJoinedTo(actor, source)) continue;
            if (this.isBlockedBy(source, actor, vm)) {
                const target = actor as BaseActor;
                // shortcut: runtime script hosts have no state probe masks; honor IsProbing when state execution is added.
                if (!target.isPendingKill()) target.getComponent<ScriptComponent>("script").call("EncroachedBy", [source]);
            } else if (touchNotify) beginTouch(source, actor as BaseActor);
        }

        return false;
    }

    public actorEncroachmentCheck(source: ICollidable & ScriptHost_T, location: Vector3): ScriptHost_T[] {
        const profile = source.getCollisionProfile(), primitive = source.getCollisionPrimitive();
        const physics = getTraceProperty(source, "Physics");

        // shortcut: only ordinary cylinder pawns initiate this query; extend for encroachers before wiring their movement.
        if (!profile.isPawn || primitive.kind !== "cylinder" || profile.collideActors && (physics === 13 || physics === 14))
            throw new Error(`Unsupported encroachment source '${source.name}'.`);
        if (this.unsupportedActors.size) throw new Error(`Encroachment query contains actors without analytical primitives.`);

        const actors: ScriptHost_T[] = [];
        if (!profile.blockNonZeroExtent || getTraceProperty(source, "bOnlyAffectPawns")) return actors;

        tmpEncroachmentExtent.set(profile.collisionRadius, profile.collisionRadius, profile.collisionHeight);
        tmpEncroachmentBounds.min.copy(location).sub(tmpEncroachmentExtent);
        tmpEncroachmentBounds.max.copy(location).add(tmpEncroachmentExtent);

        for (const entry of this.analyticalEntries) {
            if (!entry.active || entry.primitive.kind === "terrain") continue;
            const actor = ((entry.actor as any).scriptActor || entry.actor) as ICollidable & ScriptHost_T;
            if (entry.primitive.kind === "bsp" && !(actor as any).isVolume) continue;

            const records = (actor as any).collisionActors;
            if (records && records.length) {
                for (const record of records) {
                    const target = record.object || record.actor, targetProfile = record.object ? record.object.getCollisionProfile() : record.actor.collision;
                    const targetPhysics = getTraceProperty(target, "Physics");
                    if (record.object) record.object.getWorldPosition(tmpEncroachmentCenter);
                    else tmpEncroachmentCenter.fromArray(record.actor.position);
                    const usePrimitive = targetProfile.collideActors && (targetPhysics === 13 || targetPhysics === 14);
                    if (encroachmentOverlap(source, profile, location, target, targetProfile, record.primitive, tmpEncroachmentCenter, usePrimitive)) actors.push((actor as any).getCollisionActor(record.firstTriangle));
                }
                continue;
            }

            const targetProfile = actor.getCollisionProfile(), targetPrimitive = actor.getCollisionPrimitive();
            if (targetPrimitive.kind === "cylinder") tmpEncroachmentCenter.copy(targetPrimitive.center);
            else actor.getWorldPosition(tmpEncroachmentCenter);

            const targetPhysics = getTraceProperty(actor, "Physics");
            const usePrimitive = !!(actor as any).isVolume || !!(actor as any).isMovableObject || targetProfile.collideActors && (targetPhysics === 13 || targetPhysics === 14);
            if (encroachmentOverlap(source, profile, location, actor, targetProfile, targetPrimitive, tmpEncroachmentCenter, usePrimitive)) actors.push(actor);
        }

        for (const entries of this.physicsVolumes.values()) {
            for (const entry of entries) {
                const actor = entry.actor, primitive = entry.primitive;
                if (!getTraceProperty(actor, "bCollideActors") || !getTraceProperty(actor, "bBlockNonZeroExtentTraces")) continue;
                if (isJoinedTo(actor, source) || isJoinedTo(source, actor)) continue;
                if (getTraceProperty(actor, "bOnlyAffectPawns") && !profile.isPawn) continue;
                if (primitive.kind === "cylinder") {
                    primitive.center.fromArray(getTraceProperty(actor, "Location") as number[]);
                    primitive.radius = getTraceProperty(actor, "CollisionRadius") as number;
                    primitive.halfHeight = getTraceProperty(actor, "CollisionHeight") as number;
                }
                if (pointPrimitive(primitive, location, tmpEncroachmentExtent)) actors.push(actor);
            }
        }

        return actors.reverse();
    }

    public physicsVolumeLineCheck(start: Vector3, end: Vector3, source: ScriptHost_T = null, sourceIsPawn: boolean = false): PhysicsVolumeHit_T | null {
        const distance = start.distanceTo(end);
        if (distance === 0 || source && getTraceProperty(source, "bOnlyAffectPawns")) return null;

        const result = this.volumeHit;
        result.time = Infinity;
        result.actor = null;

        for (const entries of this.physicsVolumes.values()) {
            for (const entry of entries) {
                const actor = entry.actor, primitive = entry.primitive;
                if (!getTraceProperty(actor, "bCollideActors") || !getTraceProperty(actor, "bBlockZeroExtentTraces") || getTraceProperty(actor, "bDeleteMe") || getTraceProperty(actor, "bPendingDelete")) continue;
                if (getTraceProperty(actor, "bOnlyAffectPawns") && source && !sourceIsPawn) continue;

                let ignored = false;
                let depth = 0;
                for (let owner: any = source; owner; owner = owner.scriptOwner || getTraceProperty(owner, "Owner")) {
                    if (owner === actor || owner === actor.objectPath) { ignored = true; break; }
                    if (typeof owner === "string") throw new Error(`Unresolved trace source Owner '${owner}'.`);
                    if (++depth === 64) throw new Error(`Trace source Owner chain is cyclic.`);
                }
                if (ignored) continue;

                if (primitive.kind === "bsp" && primitive.model.planes.length === 0) continue;
                if (primitive.kind === "cylinder") {
                    primitive.center.fromArray(getTraceProperty(actor, "Location") as number[]);
                    primitive.radius = getTraceProperty(actor, "CollisionRadius") as number;
                    primitive.halfHeight = getTraceProperty(actor, "CollisionHeight") as number;
                }

                const hit = queryPrimitive(primitive, start, end, zeroExtentVector);
                if (!hit) continue;

                const time = Math.min(1, Math.max(0, hit.time - getTraceBackoff(primitive, distance, true) / distance));
                if (time < result.time) {
                    result.time = time;
                    result.actor = actor;
                    result.normal.copy(hit.normal);
                }
            }
        }

        if (!result.actor) return null;
        result.location.copy(end).sub(start).multiplyScalar(result.time).add(start);
        return result;
    }

    protected sweepQuery(query: CollisionQuery_T, extension: number): CheckResult_T | null {
        const distance = query.delta.length();

        if (distance === 0) return null;

        this.stats.queries++;

        const testDistance = distance + extension;

        tmpTestDelta.copy(query.delta).multiplyScalar(testDistance / distance);

        const zeroExtent = query.zeroExtent || query.extent.lengthSq() === 0;

        if (this.backend === "ue") return this.timedAnalyticalLineCheck(query, tmpTestDelta, testDistance, distance, zeroExtent);
        if (this.backend === "rapier") return this.timedRapierLineCheck(query, tmpTestDelta, testDistance, distance, zeroExtent);

        const analyticalHit = this.timedAnalyticalLineCheck(query, tmpTestDelta, testDistance, distance, zeroExtent);
        const rapierHit = this.timedRapierLineCheck(query, tmpTestDelta, testDistance, distance, zeroExtent);

        this.recordComparison(analyticalHit, rapierHit);

        return analyticalHit;
    }

    public rayCheck(origin: Vector3, direction: Vector3, maxDistance: number, sourceCollider?: RAPIER.Collider, sourceBody?: RAPIER.RigidBody, sourceIsPlayer: boolean = true): RayCheckResult_T | null {
        this.stats.queries++;
        this.rayQuery.location = origin;
        this.rayQuery.delta = tmpRayDelta.copy(direction).multiplyScalar(maxDistance);
        this.rayQuery.sourceCollider = sourceCollider;
        this.rayQuery.sourceBody = sourceBody;
        this.rayQuery.sourceActor = sourceCollider ? this.colliderOwners.get(sourceCollider.handle) : null;
        this.rayQuery.sourceIsPlayer = sourceIsPlayer;
        this.rayQuery.ignoredActors = null;
        this.rayQuery.ignoreBases = false;

        if (this.backend === "ue") return this.analyticalRayCheck(this.rayQuery, maxDistance);
        if (this.backend === "rapier") return this.rapierRayCheck(this.rayQuery, direction, maxDistance);

        const analyticalHit = this.analyticalRayCheck(this.rayQuery, maxDistance);
        const rapierHit = this.rapierRayCheck(this.rayQuery, direction, maxDistance);

        this.recordComparison(this.rayAsCheckResult(analyticalHit, maxDistance), this.rayAsCheckResult(rapierHit, maxDistance));

        return analyticalHit;
    }

    public overlapCheck(query: CollisionOverlapQuery_T): ICollidable | null {
        this.stats.queries++;

        this.overlapQuery.location = query.location;
        this.overlapQuery.extent = query.extent;
        this.overlapQuery.sourceCollider = query.sourceCollider;
        this.overlapQuery.sourceBody = query.sourceBody;
        this.overlapQuery.sourceIsPlayer = query.sourceIsPlayer;
        this.overlapQuery.onlyWorldGeometry = query.onlyWorldGeometry;

        if (this.backend === "ue") return this.timedAnalyticalOverlapCheck(this.overlapQuery);
        if (this.backend === "rapier") return this.timedRapierOverlapCheck(this.overlapQuery);

        const analyticalActor = this.timedAnalyticalOverlapCheck(this.overlapQuery);
        const rapierActor = this.timedRapierOverlapCheck(this.overlapQuery);

        this.stats.comparisons++;

        if (!!analyticalActor !== !!rapierActor) this.stats.comparisonMisses++;
        else if (analyticalActor !== rapierActor && (analyticalActor as any)?.collisionOwner !== rapierActor && (rapierActor as any)?.collisionOwner !== analyticalActor) this.stats.comparisonActorDifferences++;

        return analyticalActor;
    }

    protected analyticalRayCheck(query: CollisionQuery_T, maxDistance: number): RayCheckResult_T | null {
        const start = performance.now();
        const hit = this.analyticalLineCheck(query, query.delta, maxDistance, maxDistance, true);

        this.stats.analyticalQueries++;
        this.stats.analyticalTime += performance.now() - start;

        if (!hit) return null;

        return this.makeRayResult(hit.time * maxDistance, hit.location, hit.normal, hit.collider, hit.actor, hit.item);
    }

    protected rapierRayCheck(query: CollisionQuery_T, direction: Vector3, maxDistance: number): RayCheckResult_T | null {
        const start = performance.now();

        this.rapierQuery = query;
        this.rapierZeroExtent = true;
        this.rapierQueryError = null;
        this.ray.origin = query.location;
        this.ray.dir = direction;

        const hit = this.world.castRayAndGetNormal(this.ray, maxDistance, false, undefined, undefined, query.sourceCollider, query.sourceBody, this.rapierFilter);
        this.checkRapierQueryError();

        this.stats.rapierQueries++;
        this.stats.rapierTime += performance.now() - start;

        if (!hit) return null;

        return this.makeRayResult(hit.toi, tmpBodyPosition.copy(direction).multiplyScalar(hit.toi).add(query.location), tmpNormal.copy(hit.normal as Vector3), hit.collider, this.colliderOwners.get(hit.collider.handle) || null);
    }

    protected timedAnalyticalLineCheck(query: CollisionQuery_T, testDelta: Vector3, testDistance: number, requestedDistance: number, zeroExtent: boolean): CheckResult_T | null {
        const start = performance.now();
        const result = this.analyticalLineCheck(query, testDelta, testDistance, requestedDistance, zeroExtent);

        this.stats.analyticalQueries++;
        this.stats.analyticalTime += performance.now() - start;

        return result;
    }

    protected timedRapierLineCheck(query: CollisionQuery_T, testDelta: Vector3, testDistance: number, requestedDistance: number, zeroExtent: boolean): CheckResult_T | null {
        const start = performance.now();
        const result = this.rapierLineCheck(query, testDelta, testDistance, requestedDistance, zeroExtent);

        this.stats.rapierQueries++;
        this.stats.rapierTime += performance.now() - start;

        return result;
    }

    protected timedAnalyticalOverlapCheck(query: CollisionQuery_T): ICollidable | null {
        const start = performance.now();
        const result = this.analyticalOverlapCheck(query);

        this.stats.analyticalQueries++;
        this.stats.analyticalTime += performance.now() - start;

        return result;
    }

    protected timedRapierOverlapCheck(query: CollisionQuery_T): ICollidable | null {
        const start = performance.now();

        this.rapierQuery = query;
        this.rapierZeroExtent = false;
        this.rapierQueryError = null;

        const collider = this.world.intersectionWithShape(query.location, identityRotation, this.getShape(query.extent, false), undefined, undefined, query.sourceCollider, query.sourceBody, this.rapierFilter);
        this.checkRapierQueryError();

        this.stats.rapierQueries++;
        this.stats.rapierTime += performance.now() - start;

        return collider ? this.colliderOwners.get(collider.handle) || null : null;
    }

    protected analyticalOverlapCheck(query: CollisionQuery_T): ICollidable | null {
        const bounds = tmpSweepBounds;
        let unsupported = false;

        bounds.min.copy(query.location).sub(query.extent);
        bounds.max.copy(query.location).add(query.extent);

        for (const entry of this.analyticalEntries) {
            if (!entry.active || this.shouldIgnoreActor(entry.actor, query)) continue;
            if (!this.shouldBlockActor(entry.actor, query, false)) continue;
            if (entry.dynamic) {
                entry.primitive = entry.actor.getCollisionPrimitive();
                entry.bounds = entry.primitive.bounds;
            }
            if (!bounds.intersectsBox(entry.bounds)) continue;

            this.stats.analyticalCandidates++;

            if (!entry.primitive.supportsPointCheck) {
                this.stats.unsupportedCandidates++;
                unsupported = true;
                continue;
            }

            this.stats.analyticalPrimitiveTests++;

            if (pointPrimitive(entry.primitive, query.location, query.extent)) {
                if (unsupported) this.stats.unsupportedQueries++;
                return (entry.actor as any).scriptActor || entry.actor;
            }
        }

        if (unsupported) this.stats.unsupportedQueries++;

        return null;
    }

    protected rapierLineCheck(query: CollisionQuery_T, testDelta: Vector3, testDistance: number, requestedDistance: number, zeroExtent: boolean): CheckResult_T | null {
        this.rapierQuery = query;
        this.rapierZeroExtent = zeroExtent;
        this.rapierQueryError = null;

        const hit = this.world.castShape(query.location, identityRotation, testDelta, this.getShape(query.extent, zeroExtent), 1, undefined, undefined, query.sourceCollider, query.sourceBody, this.rapierFilter);
        this.checkRapierQueryError();

        if (!hit) return null;

        const actor = this.colliderOwners.get(hit.collider.handle) || null;
        const primitive = actor && actor.getCollisionPrimitive ? actor.getCollisionPrimitive() : null;
        const travelled = Math.max(0, hit.toi * testDistance - getTraceBackoff(primitive, testDistance, zeroExtent));
        const extension = testDistance - requestedDistance;
        const time = travelled > extension ? (travelled - extension) / requestedDistance : 0;

        if (time > 1) return null;

        tmpNormal.copy(hit.normal1 as Vector3).normalize();

        return this.makeCheckResult(time, tmpBodyPosition.copy(query.location).addScaledVector(query.delta, time), tmpNormal, hit.collider, actor);
    }

    protected analyticalLineCheck(query: CollisionQuery_T, testDelta: Vector3, testDistance: number, requestedDistance: number, zeroExtent: boolean): CheckResult_T | null {
        const end = tmpEnd.copy(query.location).add(testDelta);
        const extent = zeroExtent ? zeroExtentVector : query.extent;
        const bounds = sweptBounds(query.location, end, extent, tmpSweepBounds);
        this.beginAnalyticalQuery(query, query.location, end, extent, testDistance, zeroExtent);

        for (let i = 0; i < (query.ignorePawns ? 1 : 2); i++) {
            const grid = i === 0 ? this.cells : this.pawnCells, cellSize = i === 0 ? CELL_SIZE : PAWN_CELL_SIZE;
            const minX = Math.floor(bounds.min.x / cellSize), minY = Math.floor(bounds.min.y / cellSize), minZ = Math.floor(bounds.min.z / cellSize);
            const maxX = Math.floor(bounds.max.x / cellSize), maxY = Math.floor(bounds.max.y / cellSize), maxZ = Math.floor(bounds.max.z / cellSize);
            const cellCount = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);

            if (cellCount > MAX_QUERY_CELLS) {
                for (const entry of this.analyticalEntries)
                    if (entry.grid === grid) this.testAnalyticalEntry(entry);
            } else {
                for (let x = minX; x <= maxX; x++) {
                    const cellsY = grid.get(x);
                    if (!cellsY) continue;

                    for (let y = minY; y <= maxY; y++) {
                        const cellsZ = cellsY.get(y);
                        if (!cellsZ) continue;

                        for (let z = minZ; z <= maxZ; z++) {
                            const cell = cellsZ.get(z);
                            if (!cell) continue;

                            for (const entry of cell) this.testAnalyticalEntry(entry);
                        }
                    }
                }
            }
        }
        for (const entry of this.largeEntries) this.testAnalyticalEntry(entry);

        if (this.analyticalUnsupported) this.stats.unsupportedQueries++;
        if (!this.analyticalBestActor) return null;

        const travelled = this.analyticalBestTime * testDistance;
        const extension = testDistance - requestedDistance;
        const requestedTime = travelled > extension ? (travelled - extension) / requestedDistance : 0;

        if (requestedTime > 1) return null;

        return this.makeCheckResult(requestedTime, tmpBodyPosition.copy(query.location).addScaledVector(query.delta, requestedTime), this.analyticalBestNormal, this.analyticalBestCollider, this.analyticalBestActor, this.analyticalBestItem);
    }

    protected beginAnalyticalQuery(query: CollisionQuery_T, start: Vector3, end: Vector3, extent: Vector3, testDistance: number, zeroExtent: boolean) {
        this.queryMark++;

        if (this.queryMark === 0x7fffffff) {
            this.queryMark = 1;

            for (const entry of this.analyticalEntries) entry.queryMark = 0;
        }

        this.analyticalQuery = query;
        this.analyticalStart = start;
        this.analyticalEnd = end;
        this.analyticalExtent = extent;
        this.analyticalTestDistance = testDistance;
        this.analyticalZeroExtent = zeroExtent;
        this.analyticalBestTime = Infinity;
        this.analyticalBestOrder = Infinity;
        this.analyticalBestItem = -1;
        this.analyticalBestActor = null;
        this.analyticalBestCollider = null;
        this.analyticalUnsupported = false;
    }

    protected testAnalyticalEntry(entry: AnalyticalEntry_T) {
        if (!entry.active || entry.queryMark === this.queryMark) return;

        entry.queryMark = this.queryMark;

        if (entry.dynamic) {
            entry.primitive = entry.actor.getCollisionPrimitive();
            entry.bounds = entry.primitive.bounds;
        }

        if (!sweptIntersectsBox(this.analyticalStart, this.analyticalEnd, this.analyticalExtent, entry.bounds)) return;
        if (this.shouldIgnoreActor(entry.actor, this.analyticalQuery)) return;
        if (!this.shouldBlockActor(entry.actor, this.analyticalQuery, this.analyticalZeroExtent)) return;

        this.stats.analyticalCandidates++;

        if (this.analyticalZeroExtent ? !entry.primitive.supportsZeroExtent : !entry.primitive.supportsNonZeroExtent) {
            this.stats.unsupportedCandidates++;
            this.analyticalUnsupported = true;
            return;
        }

        const records = (entry.actor as any).collisionActors;
        if (records && records.length && this.hasIgnoredCollisionActors(entry.actor)) {
            for (const record of records) {
                if (record.object && (this.shouldIgnoreActor(record.object, this.analyticalQuery) || !this.shouldBlockActor(record.object, this.analyticalQuery, this.analyticalZeroExtent))) continue;
                if (!sweptIntersectsBox(this.analyticalStart, this.analyticalEnd, this.analyticalExtent, record.primitive.bounds)) continue;

                this.stats.analyticalPrimitiveTests++;
                const hit = queryPrimitive(record.primitive, this.analyticalStart, this.analyticalEnd, this.analyticalExtent);
                if (hit) this.setAnalyticalHit(entry, record.primitive, hit, record.firstTriangle + hit.item);
            }
            return;
        }

        this.stats.analyticalPrimitiveTests++;
        const hit = queryPrimitive(entry.primitive, this.analyticalStart, this.analyticalEnd, this.analyticalExtent);

        if (hit) this.setAnalyticalHit(entry, entry.primitive, hit, hit.item);
    }

    protected hasIgnoredCollisionActors(actor: ICollidable): boolean {
        const query = this.analyticalQuery;
        const source = query.sourceActor || (query.sourceCollider ? this.colliderOwners.get(query.sourceCollider.handle) : null);

        if (source && (source as any).collisionOwner === actor) return true;
        if (query.ignoreBases && !actor.getCollisionProfile().worldGeometry) return true;
        if (query.ignoredActors)
            for (const ignored of query.ignoredActors)
                if ((ignored as any).collisionOwner === actor) return true;

        return false;
    }

    protected setAnalyticalHit(entry: AnalyticalEntry_T, primitive: CollisionPrimitive_T, hit: PrimitiveHit_T, item: number): void {
        const time = Math.max(0, hit.time - getTraceBackoff(primitive, this.analyticalTestDistance, this.analyticalZeroExtent) / this.analyticalTestDistance);

        if (time > this.analyticalBestTime || time === this.analyticalBestTime && entry.order >= this.analyticalBestOrder) return;

        this.analyticalBestTime = time;
        this.analyticalBestOrder = entry.order;
        this.analyticalBestItem = item;
        this.analyticalBestNormal.copy(hit.normal);
        const records = (entry.actor as any).collisionActors;
        this.analyticalBestActor = records && records.length ? (entry.actor as any).getCollisionActor(item) : (entry.actor as any).scriptActor || entry.actor;
        this.analyticalBestCollider = entry.actor.getCollider();
    }

    protected removeFromCells(entry: AnalyticalEntry_T) {
        for (const info of entry.cells) {
            const index = info.entries.indexOf(entry);

            if (index >= 0) info.entries.splice(index, 1);
            if (info.entries.length > 0) continue;

            const cellsY = entry.grid.get(info.x);
            const cellsZ = cellsY.get(info.y);

            cellsZ.delete(info.z);
            if (cellsZ.size === 0) cellsY.delete(info.y);
            if (cellsY.size === 0) entry.grid.delete(info.x);
        }

        entry.cells.length = 0;
    }

    protected isInCellRange(entry: AnalyticalEntry_T, margin: number): boolean {
        const bounds = entry.bounds, range = entry.cellRange, cellSize = entry.cellSize;

        return range.length === 6
            && range[0] === Math.floor((bounds.min.x - margin) / cellSize) && range[1] === Math.floor((bounds.min.y - margin) / cellSize) && range[2] === Math.floor((bounds.min.z - margin) / cellSize)
            && range[3] === Math.floor((bounds.max.x + margin) / cellSize) && range[4] === Math.floor((bounds.max.y + margin) / cellSize) && range[5] === Math.floor((bounds.max.z + margin) / cellSize);
    }

    protected insertEntry(entry: AnalyticalEntry_T, margin: number) {
        const bounds = entry.bounds, cellSize = entry.cellSize, grid = entry.grid;
        const minX = Math.floor((bounds.min.x - margin) / cellSize), minY = Math.floor((bounds.min.y - margin) / cellSize), minZ = Math.floor((bounds.min.z - margin) / cellSize);
        const maxX = Math.floor((bounds.max.x + margin) / cellSize), maxY = Math.floor((bounds.max.y + margin) / cellSize), maxZ = Math.floor((bounds.max.z + margin) / cellSize);

        entry.cellRange.length = 0;
        entry.cellRange.push(minX, minY, minZ, maxX, maxY, maxZ);

        const cellCount = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);

        if (!Number.isFinite(cellCount) || cellCount <= 0 || cellCount > MAX_ENTRY_CELLS) {
            this.largeEntries.push(entry);
            return;
        }

        for (let x = minX; x <= maxX; x++) {
            let cellsY = grid.get(x);

            if (!cellsY) {
                cellsY = new Map();
                grid.set(x, cellsY);
            }

            for (let y = minY; y <= maxY; y++) {
                let cellsZ = cellsY.get(y);

                if (!cellsZ) {
                    cellsZ = new Map();
                    cellsY.set(y, cellsZ);
                }

                for (let z = minZ; z <= maxZ; z++) {
                    let cell = cellsZ.get(z);

                    if (!cell) {
                        cell = [];
                        cellsZ.set(z, cell);
                    }

                    cell.push(entry);
                    entry.cells.push({ x, y, z, entries: cell });
                }
            }
        }
    }

    protected getShape(extent: Vector3, zeroExtent: boolean): RAPIER.Shape {
        if (zeroExtent) return this.zeroShape;

        for (const info of this.arrShapes)
            if (info.x === extent.x && info.y === extent.y && info.z === extent.z) return info.shape;

        const shape = new RAPIER.Cuboid(extent.x, extent.y, extent.z);

        this.arrShapes.push({ x: extent.x, y: extent.y, z: extent.z, shape });

        return shape;
    }

    protected makeCheckResult(time: number, location: Vector3, normal: Vector3, collider: RAPIER.Collider, actor: ICollidable | null, item = -1): CheckResult_T {
        const result = this.arrCheckResults[this.checkResultIndex++];

        if (this.checkResultIndex === this.arrCheckResults.length) this.checkResultIndex = 0;

        result.time = time;
        result.item = item;
        result.location.copy(location);
        result.normal.copy(normal);
        result.collider = collider;
        result.actor = actor;

        return result;
    }

    protected makeRayResult(distance: number, location: Vector3, normal: Vector3, collider: RAPIER.Collider, actor: ICollidable | null, item = -1): RayCheckResult_T {
        const result = this.arrRayResults[this.rayResultIndex++];

        if (this.rayResultIndex === this.arrRayResults.length) this.rayResultIndex = 0;

        result.distance = distance;
        result.item = item;
        result.location.copy(location);
        result.normal.copy(normal);
        result.collider = collider;
        result.actor = actor;

        return result;
    }

    protected rayAsCheckResult(hit: RayCheckResult_T | null, maxDistance: number): CheckResult_T | null {
        if (!hit) return null;

        return this.makeCheckResult(hit.distance / maxDistance, hit.location, hit.normal, hit.collider, hit.actor, hit.item);
    }

    protected recordComparison(a: CheckResult_T | null, b: CheckResult_T | null) {
        this.stats.comparisons++;

        if (!!a !== !!b) {
            this.stats.comparisonMisses++;
            return;
        }

        if (!a) return;
        if (a.actor !== b.actor && (a.actor as any)?.collisionOwner !== b.actor && (b.actor as any)?.collisionOwner !== a.actor) this.stats.comparisonActorDifferences++;
        if (Math.abs(a.time - b.time) > COMPARISON_TIME_EPSILON) this.stats.comparisonTimeDifferences++;
        if (a.normal.dot(b.normal) < 1 - COMPARISON_NORMAL_EPSILON) this.stats.comparisonNormalDifferences++;
    }

    // AActor::IsBlockedBy 0x7cd650: actor blocking is mutual; world geometry uses bCollideWorld.
    protected shouldBlockActor(actor: ICollidable, query: CollisionQuery_T, zeroExtent: boolean): boolean {
        const target = actor.getCollisionProfile ? actor.getCollisionProfile() || defaultProfile : defaultProfile;

        if ((actor as any).isStaticMeshActor && !target.collideActors) return false;
        if (zeroExtent ? !target.blockZeroExtent : !target.blockNonZeroExtent) return false;

        if (query.traceWorld) {
            // Null-source TRACE_World: AActor 0x7cf0f1, APawn 0x8afb34, AMover 0x60ddc0.
            if (target.isPawn) return !!getTraceProperty(actor as ScriptHost_T, "bAsTreatWorld");
            if ((actor as any).isMovableObject) {
                const grade = (actor as any).damageGrade;

                if (!Number.isInteger(grade)) throw new Error(`Invalid mover DamageGrade '${grade}'.`);
                return grade !== 6;
            }
            return target.worldGeometry;
        }

        if (query.onlyWorldGeometry) return target.worldGeometry;

        const source = query.sourceProfile || defaultProfile;

        if (target.worldGeometry) return source.collideWorld;
        if (!target.collideActors || !source.collideActors) return false;
        if (!(source.isPawn ? target.blockPlayers : target.blockActors)) return false;

        return target.isPawn ? source.blockPlayers : source.blockActors;
    }

    protected shouldIgnoreActor(actor: ICollidable, query: CollisionQuery_T): boolean {
        const entry = this.entriesByActor.get(actor);
        if (entry && !entry.active) return true;
        const sourceObject = query.sourceActor || (query.sourceCollider ? this.colliderOwners.get(query.sourceCollider.handle) : null);
        const source = (sourceObject as any)?.scriptActor || sourceObject;

        if (actor === source) return true;
        if (query.ignoredActors && query.ignoredActors.has(actor)) return true;

        actor = (actor as any).scriptActor || actor;
        if (actor === source) return true;
        if (query.ignoredActors && query.ignoredActors.has(actor)) return true;

        const profile = actor.getCollisionProfile ? actor.getCollisionProfile() || defaultProfile : defaultProfile;

        if (profile.isPawn) {
            const controller = getTraceProperty(actor as ScriptHost_T, "Controller");
            if (typeof controller === "string") throw new Error(`Unresolved pawn Controller '${controller}'.`);

            // APawn::ShouldTrace 0x8afa60..0x8afad1; ordinary traces omit the 0x10000 exception.
            if (controller && getTraceProperty(controller, "bDead")) return true;
            if (source && (controller === source || getTraceProperty(source, "CanIngnoreCollision") && getTraceProperty(actor as ScriptHost_T, "CanBeIngnoredCollision"))) return true;
            if ((actor as BaseActor).checkLoadingResource()) return true;
        }

        if (query.ignorePawns && profile.isPawn) return true;
        if (!query.ignoreBases || !source) return false;

        if (profile.worldGeometry) return false;

        return isBasedOn(source, actor) || isBasedOn(actor, source);
    }
}

function removeEntry(entries: AnalyticalEntry_T[], entry: AnalyticalEntry_T) {
    const index = entries.indexOf(entry);

    if (index >= 0) entries.splice(index, 1);
}

function isBasedOn(actor: ICollidable, base: ICollidable): boolean {
    let current = actor.getBaseActor ? actor.getBaseActor() : null;

    for (let depth = 0; current; depth++) {
        if (current === base) return true;
        if (depth === 63) throw new Error("Actor base chain is cyclic.");

        current = current.getBaseActor ? current.getBaseActor() : null;
    }

    return false;
}

function getTraceProperty(actor: ScriptHost_T, name: string): any {
    if (actor.getUnrealScriptProperty) return actor.getUnrealScriptProperty(name);
    const properties = actor.scriptProperties;
    return properties instanceof Map ? properties.get(name) : properties?.[name];
}

function isActorClass(actor: ScriptHost_T, name: string, vm: UnScriptVM): boolean {
    return vm.invokeNative(actor, actor, 303, "IsA", [name]) as boolean;
}

function isPlayerPawn(actor: ScriptHost_T, vm: UnScriptVM): boolean {
    if (!isActorClass(actor, "Pawn", vm)) return false;
    const controller = getTraceProperty(actor, "Controller");
    if (!controller) return false;
    if (typeof controller === "string") throw new Error(`Unresolved pawn Controller '${controller}'.`);
    return isActorClass(controller, "PlayerController", vm) && !!getTraceProperty(controller, "Player");
}

function isEncroacher(actor: ScriptHost_T, vm: UnScriptVM): boolean {
    if (!getTraceProperty(actor, "bCollideActors")) return false;
    if (getTraceProperty(actor, "StaticMesh") && isActorClass(actor, "Mover", vm)) return true;
    const physics = getTraceProperty(actor, "Physics");
    return physics === EPhysics_T.PHYS_KarmaRagDoll || physics === EPhysics_T.PHYS_Karma && !isActorClass(actor, "KConstraint", vm);
}

function isJoinedTo(actor: ScriptHost_T, other: ScriptHost_T): boolean {
    const tag = getTraceProperty(other, "JoinedTag");
    let current: any = actor;

    for (let depth = 0; current; depth++) {
        if (current === other || tag && tag === getTraceProperty(current, "JoinedTag")) return true;
        if (depth === 63) throw new Error(`Actor base chain is cyclic.`);

        current = current.getUnrealScriptProperty ? getTraceProperty(current, "Base") : current.getBaseActor ? current.getBaseActor() : getTraceProperty(current, "Base");
        if (typeof current === "string") throw new Error(`Unresolved encroachment Base '${current}'.`);
    }

    return false;
}

function encroachmentOverlap(source: ScriptHost_T, sourceProfile: ActorCollisionProfile_T, location: Vector3, actor: ScriptHost_T, profile: ActorCollisionProfile_T, primitive: CollisionPrimitive_T, center: Vector3, usePrimitive: boolean): boolean {
    if (!profile.collideActors || !profile.blockNonZeroExtent || !tmpEncroachmentBounds.intersectsBox(primitive.bounds)) return false;
    if (profile.isPawn) {
        const controller = getTraceProperty(actor, "Controller");
        if (typeof controller === "string") throw new Error(`Unresolved pawn Controller '${controller}'.`);

        // APawn::ShouldTrace 0x8afa60..0x8afabe; encroachment flags 0x9f exclude bDead controllers.
        if (controller === source || controller && getTraceProperty(controller, "bDead")) return false;
        if (getTraceProperty(source, "CanIngnoreCollision") && getTraceProperty(actor, "CanBeIngnoredCollision")) return false;
        if ((actor as BaseActor).checkLoadingResource()) return false;
    }
    if (isJoinedTo(actor, source) || isJoinedTo(source, actor)) return false;
    if (getTraceProperty(actor, "bOnlyAffectPawns") && !sourceProfile.isPawn) return false;

    if (usePrimitive) return !!pointPrimitive(primitive, location, tmpEncroachmentExtent);

    const dz = center.z - location.z, height = profile.collisionHeight + sourceProfile.collisionHeight;
    if (dz * dz >= height * height) return false;

    const dx = center.x - location.x, dy = center.y - location.y, radius = profile.collisionRadius + sourceProfile.collisionRadius;
    return dx * dx + dy * dy < radius * radius;
}

function getTraceBackoff(primitive: CollisionPrimitive_T | null, testDistance: number, zeroExtent: boolean): number {
    if (!primitive) return 0;
    if (primitive.kind === "terrain") return 0.5;
    if (primitive.kind === "bsp") return zeroExtent ? 0.5 : Math.max(0.1, Math.min(4, 0.1 * testDistance));
    if (primitive.kind === "staticMesh" && primitive.collisionModel && (zeroExtent ? primitive.useSimpleLineCollision : primitive.useSimpleBoxCollision))
        return zeroExtent ? 0.5 : Math.max(0.1, Math.min(4, 0.1 * testDistance));
    if (primitive.kind === "staticMesh") return Math.max(0.1, Math.min(1, 0.1 * testDistance));

    return 0;
}

export default CollisionWorld;
