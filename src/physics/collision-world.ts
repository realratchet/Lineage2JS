import RAPIER from "@dimforge/rapier3d";
import { Box3, Quaternion, Vector3 } from "three";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "@client/objects/objects";
import { pointPrimitive, queryPrimitive, sweptBounds, sweptIntersectsBox } from "./collision-primitive";

const tmpBodyPosition = new Vector3();
const tmpTestDelta = new Vector3();
const tmpNormal = new Vector3();
const tmpRayDelta = new Vector3();
const identityRotation = new Quaternion();
const tmpEnd = new Vector3();
const tmpSweepBounds = new Box3();
const zeroExtentVector = new Vector3();
const CELL_SIZE = 1024;
const MAX_QUERY_CELLS = 4096;
const MAX_ENTRY_CELLS = 16384;
// dynamic entries are re-gridded once a frame, so their footprint carries enough slack to cover
// however far they travel across that frame's substeps - a pawn at ground speed covers 134 a second
const DYNAMIC_CELL_MARGIN = 256;
// ULevel::MoveActor (0x85b3b0) extends the test by 2 units and subtracts them back off the result
const MOVE_ACTOR_EXTENSION = 2;
const COMPARISON_TIME_EPSILON = 0.001;
const COMPARISON_NORMAL_EPSILON = 0.001;

type CollisionBackend_T = "ue" | "rapier" | "compare";

type CollisionQuery_T = {
    location: Vector3;
    delta: Vector3;
    extent: Vector3;
    sourceCollider?: RAPIER.Collider;
    sourceBody?: RAPIER.RigidBody;
    sourceIsPlayer: boolean;
    sourceProfile?: ActorCollisionProfile_T;
    ignoredActors?: Set<ICollidable>;
    zeroExtent?: boolean;
};

type CollisionOverlapQuery_T = {
    location: Vector3;
    extent: Vector3;
    sourceCollider?: RAPIER.Collider;
    sourceBody?: RAPIER.RigidBody;
    sourceIsPlayer: boolean;
};

type CheckResult_T = {
    time: number;
    location: Vector3;
    normal: Vector3;
    collider: RAPIER.Collider;
    actor: ICollidable | null;
};

type RayCheckResult_T = {
    distance: number;
    location: Vector3;
    normal: Vector3;
    collider: RAPIER.Collider;
    actor: ICollidable | null;
};

type CollisionStats_T = {
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

type AnalyticalEntry_T = {
    actor: ICollidable;
    primitive: CollisionPrimitive_T;
    bounds: Box3;
    order: number;
    queryMark: number;
    dynamic: boolean;
    active: boolean;
    cells: { x: number, y: number, z: number, entries: AnalyticalEntry_T[] }[];
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

class CollisionWorld {
    protected readonly world: RAPIER.World;
    protected backend: CollisionBackend_T;
    protected readonly colliderOwners = new Map<number, ICollidable>();
    protected readonly entriesByActor = new Map<ICollidable, AnalyticalEntry_T>();
    protected readonly unsupportedActors = new Set<ICollidable>();
    protected readonly analyticalEntries: AnalyticalEntry_T[] = [];
    protected readonly dynamicEntries: AnalyticalEntry_T[] = [];
    protected readonly largeEntries: AnalyticalEntry_T[] = [];
    protected readonly cells = new Map<number, Map<number, Map<number, AnalyticalEntry_T[]>>>();
    protected readonly arrShapes: { x: number, y: number, z: number, shape: RAPIER.Shape }[] = [];
    protected readonly zeroShape = new RAPIER.Ball(0.001);
    protected readonly analyticalBestNormal = new Vector3();
    protected readonly ray = new RAPIER.Ray(zeroExtentVector, zeroExtentVector);
    protected readonly rayQuery: CollisionQuery_T = { location: zeroExtentVector, delta: zeroExtentVector, extent: zeroExtentVector, sourceIsPlayer: true, zeroExtent: true };
    protected readonly overlapQuery: CollisionQuery_T = { location: zeroExtentVector, delta: zeroExtentVector, extent: zeroExtentVector, sourceIsPlayer: true };
    protected queryMark = 0;
    protected dynamicMark = -1;
    protected nextOrder = 0;
    protected analyticalBestTime = Infinity;
    protected analyticalBestOrder = Infinity;
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
    protected readonly rapierFilter = (collider: RAPIER.Collider) => {
        const actor = this.colliderOwners.get(collider.handle);
        const sourceActor = this.rapierQuery.sourceCollider ? this.colliderOwners.get(this.rapierQuery.sourceCollider.handle) : null;

        if (actor && actor === sourceActor) return false;

        return !actor || this.shouldBlockActor(actor, this.rapierQuery, this.rapierZeroExtent);
    };

    public constructor(world: RAPIER.World, backend: CollisionBackend_T = "ue") {
        this.world = world;
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

        if (primitive.kind === "bsp") {
            const sector = object.parent as any;

            if (sector?.gridBounds && sector?.worldBounds) {
                bounds = new Box3();
                bounds.min.set(sector.gridBounds.min.x, sector.gridBounds.min.z, sector.worldBounds.min.z);
                bounds.max.set(sector.gridBounds.max.x, sector.gridBounds.max.z, sector.worldBounds.max.z);
            }
        }

        const entry: AnalyticalEntry_T = { actor: object, primitive, bounds, order: this.nextOrder++, queryMark: 0, dynamic, active: true, cells: [] };

        this.entriesByActor.set(object, entry);
        this.analyticalEntries.push(entry);

        if (!primitive.supportsZeroExtent) this.stats.registeredUnsupportedZeroExtent++;
        if (!primitive.supportsNonZeroExtent) this.stats.registeredUnsupportedNonZeroExtent++;
        if (!primitive.supportsPointCheck) this.stats.registeredUnsupportedPointCheck++;

        if (dynamic) this.dynamicEntries.push(entry);

        this.insertEntry(entry, dynamic ? DYNAMIC_CELL_MARGIN : 0);
    }

    public unregister(colliders: RAPIER.Collider[]) {
        for (const collider of colliders) {
            if (!collider) continue;

            const actor = this.colliderOwners.get(collider.handle);
            const entry = actor ? this.entriesByActor.get(actor) : null;

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

            this.colliderOwners.delete(collider.handle);
        }
    }

    // without this the grid would only hold the static world and every trace would have to walk the
    // whole dynamic list; one re-grid a frame replaces ~180 full scans of it
    public updateDynamicEntries(mark: number) {
        if (mark === this.dynamicMark) return;

        this.dynamicMark = mark;

        for (const entry of this.dynamicEntries) {
            if (!entry.active) continue;

            entry.primitive = entry.actor.getCollisionPrimitive();
            entry.bounds = entry.primitive.bounds;

            this.removeFromCells(entry);
            removeEntry(this.largeEntries, entry);
            this.insertEntry(entry, DYNAMIC_CELL_MARGIN);
        }
    }

    public moveActor(query: CollisionQuery_T): CheckResult_T | null {
        const hit = this.sweepQuery(query, MOVE_ACTOR_EXTENSION);

        if (hit) query.location.copy(hit.location);
        else query.location.add(query.delta);

        return hit;
    }

    // ULevel::SingleLineCheck is a plain trace; only MoveActor extends and backs the result off
    public singleLineCheck(query: CollisionQuery_T): CheckResult_T | null {
        return this.sweepQuery(query, 0);
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
        this.rayQuery.sourceIsPlayer = sourceIsPlayer;

        if (this.backend === "ue") return this.analyticalRayCheck(this.rayQuery, maxDistance);
        if (this.backend === "rapier") return this.rapierRayCheck(this.rayQuery, direction, maxDistance);

        const analyticalHit = this.analyticalRayCheck(this.rayQuery, maxDistance);
        const rapierHit = this.rapierRayCheck(this.rayQuery, direction, maxDistance);

        this.recordComparison(analyticalHit ? { ...analyticalHit, time: analyticalHit.distance / maxDistance } : null, rapierHit ? { ...rapierHit, time: rapierHit.distance / maxDistance } : null);

        return analyticalHit;
    }

    public overlapCheck(query: CollisionOverlapQuery_T): ICollidable | null {
        this.stats.queries++;

        this.overlapQuery.location = query.location;
        this.overlapQuery.extent = query.extent;
        this.overlapQuery.sourceCollider = query.sourceCollider;
        this.overlapQuery.sourceBody = query.sourceBody;
        this.overlapQuery.sourceIsPlayer = query.sourceIsPlayer;

        if (this.backend === "ue") return this.timedAnalyticalOverlapCheck(this.overlapQuery);
        if (this.backend === "rapier") return this.timedRapierOverlapCheck(this.overlapQuery);

        const analyticalActor = this.timedAnalyticalOverlapCheck(this.overlapQuery);
        const rapierActor = this.timedRapierOverlapCheck(this.overlapQuery);

        this.stats.comparisons++;

        if (!!analyticalActor !== !!rapierActor) this.stats.comparisonMisses++;
        else if (analyticalActor !== rapierActor) this.stats.comparisonActorDifferences++;

        return analyticalActor;
    }

    protected analyticalRayCheck(query: CollisionQuery_T, maxDistance: number): RayCheckResult_T | null {
        const start = performance.now();
        const hit = this.analyticalLineCheck(query, query.delta, maxDistance, maxDistance, true);

        this.stats.analyticalQueries++;
        this.stats.analyticalTime += performance.now() - start;

        if (!hit) return null;

        return { distance: hit.time * maxDistance, location: hit.location, normal: hit.normal, collider: hit.collider, actor: hit.actor };
    }

    protected rapierRayCheck(query: CollisionQuery_T, direction: Vector3, maxDistance: number): RayCheckResult_T | null {
        const start = performance.now();

        this.rapierQuery = query;
        this.rapierZeroExtent = true;
        this.ray.origin = query.location;
        this.ray.dir = direction;

        const hit = this.world.castRayAndGetNormal(this.ray, maxDistance, false, undefined, undefined, query.sourceCollider, query.sourceBody, this.rapierFilter);

        this.stats.rapierQueries++;
        this.stats.rapierTime += performance.now() - start;

        if (!hit) return null;

        return {
            distance: hit.toi,
            location: tmpBodyPosition.copy(direction).multiplyScalar(hit.toi).add(query.location).clone(),
            normal: tmpNormal.copy(hit.normal as Vector3).clone(),
            collider: hit.collider,
            actor: this.colliderOwners.get(hit.collider.handle) || null
        };
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

        const collider = this.world.intersectionWithShape(query.location, identityRotation, this.getShape(query.extent, false), undefined, undefined, query.sourceCollider, query.sourceBody, this.rapierFilter);

        this.stats.rapierQueries++;
        this.stats.rapierTime += performance.now() - start;

        return collider ? this.colliderOwners.get(collider.handle) || null : null;
    }

    protected analyticalOverlapCheck(query: CollisionQuery_T): ICollidable | null {
        const bounds = tmpSweepBounds;
        const sourceActor = query.sourceCollider ? this.colliderOwners.get(query.sourceCollider.handle) : null;
        let unsupported = false;

        bounds.min.copy(query.location).sub(query.extent);
        bounds.max.copy(query.location).add(query.extent);

        for (const entry of this.analyticalEntries) {
            if (!entry.active || entry.actor === sourceActor) continue;
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
                return entry.actor;
            }
        }

        if (unsupported) this.stats.unsupportedQueries++;

        return null;
    }

    protected rapierLineCheck(query: CollisionQuery_T, testDelta: Vector3, testDistance: number, requestedDistance: number, zeroExtent: boolean): CheckResult_T | null {
        this.rapierQuery = query;
        this.rapierZeroExtent = zeroExtent;

        const hit = this.world.castShape(query.location, identityRotation, testDelta, this.getShape(query.extent, zeroExtent), 1, undefined, undefined, query.sourceCollider, query.sourceBody, this.rapierFilter);

        if (!hit) return null;

        const actor = this.colliderOwners.get(hit.collider.handle) || null;
        const primitive = actor && actor.getCollisionPrimitive ? actor.getCollisionPrimitive() : null;
        const travelled = Math.max(0, hit.toi * testDistance - getTraceBackoff(primitive, testDistance, zeroExtent));
        const extension = testDistance - requestedDistance;
        const time = travelled > extension ? (travelled - extension) / requestedDistance : 0;

        if (time > 1) return null;

        tmpNormal.copy(hit.normal1 as Vector3).normalize();

        return { time, location: tmpBodyPosition.copy(query.location).addScaledVector(query.delta, time).clone(), normal: tmpNormal.clone(), collider: hit.collider, actor };
    }

    protected analyticalLineCheck(query: CollisionQuery_T, testDelta: Vector3, testDistance: number, requestedDistance: number, zeroExtent: boolean): CheckResult_T | null {
        const end = tmpEnd.copy(query.location).add(testDelta);
        const extent = zeroExtent ? zeroExtentVector : query.extent;
        const bounds = sweptBounds(query.location, end, extent, tmpSweepBounds);
        const minX = Math.floor(bounds.min.x / CELL_SIZE), minY = Math.floor(bounds.min.y / CELL_SIZE), minZ = Math.floor(bounds.min.z / CELL_SIZE);
        const maxX = Math.floor(bounds.max.x / CELL_SIZE), maxY = Math.floor(bounds.max.y / CELL_SIZE), maxZ = Math.floor(bounds.max.z / CELL_SIZE);
        const cellCount = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);

        this.beginAnalyticalQuery(query, query.location, end, extent, testDistance, zeroExtent);

        if (cellCount > MAX_QUERY_CELLS) {
            for (const entry of this.analyticalEntries) this.testAnalyticalEntry(entry);
        } else {
            for (let x = minX; x <= maxX; x++) {
                const cellsY = this.cells.get(x);

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

            for (const entry of this.largeEntries) this.testAnalyticalEntry(entry);
        }

        if (this.analyticalUnsupported) this.stats.unsupportedQueries++;
        if (!this.analyticalBestActor) return null;

        const travelled = this.analyticalBestTime * testDistance;
        const extension = testDistance - requestedDistance;
        const requestedTime = travelled > extension ? (travelled - extension) / requestedDistance : 0;

        if (requestedTime > 1) return null;

        return { time: requestedTime, location: tmpBodyPosition.copy(query.location).addScaledVector(query.delta, requestedTime).clone(), normal: this.analyticalBestNormal.clone(), collider: this.analyticalBestCollider, actor: this.analyticalBestActor };
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
        this.analyticalBestActor = null;
        this.analyticalBestCollider = null;
        this.analyticalUnsupported = false;
    }

    protected testAnalyticalEntry(entry: AnalyticalEntry_T) {
        if (!entry.active || entry.queryMark === this.queryMark) return;

        entry.queryMark = this.queryMark;

        const sourceActor = this.analyticalQuery.sourceCollider ? this.colliderOwners.get(this.analyticalQuery.sourceCollider.handle) : null;

        if (entry.actor === sourceActor) return;
        if (this.analyticalQuery.ignoredActors && this.analyticalQuery.ignoredActors.has(entry.actor)) return;

        if (!this.shouldBlockActor(entry.actor, this.analyticalQuery, this.analyticalZeroExtent)) return;

        if (entry.dynamic) {
            entry.primitive = entry.actor.getCollisionPrimitive();
            entry.bounds = entry.primitive.bounds;
        }

        if (!sweptIntersectsBox(this.analyticalStart, this.analyticalEnd, this.analyticalExtent, entry.bounds)) return;

        this.stats.analyticalCandidates++;

        if (this.analyticalZeroExtent ? !entry.primitive.supportsZeroExtent : !entry.primitive.supportsNonZeroExtent) {
            this.stats.unsupportedCandidates++;
            this.analyticalUnsupported = true;
            return;
        }

        this.stats.analyticalPrimitiveTests++;

        const hit = queryPrimitive(entry.primitive, this.analyticalStart, this.analyticalEnd, this.analyticalExtent);

        if (!hit) return;

        const time = Math.max(0, hit.time - getTraceBackoff(entry.primitive, this.analyticalTestDistance, this.analyticalZeroExtent) / this.analyticalTestDistance);

        if (time > this.analyticalBestTime || time === this.analyticalBestTime && entry.order >= this.analyticalBestOrder) return;

        this.analyticalBestTime = time;
        this.analyticalBestOrder = entry.order;
        this.analyticalBestNormal.copy(hit.normal);
        this.analyticalBestActor = entry.actor;
        this.analyticalBestCollider = entry.actor.getCollider();
    }

    protected removeFromCells(entry: AnalyticalEntry_T) {
        for (const info of entry.cells) {
            const index = info.entries.indexOf(entry);

            if (index >= 0) info.entries.splice(index, 1);
            if (info.entries.length > 0) continue;

            const cellsY = this.cells.get(info.x);
            const cellsZ = cellsY.get(info.y);

            cellsZ.delete(info.z);
            if (cellsZ.size === 0) cellsY.delete(info.y);
            if (cellsY.size === 0) this.cells.delete(info.x);
        }

        entry.cells.length = 0;
    }

    protected insertEntry(entry: AnalyticalEntry_T, margin: number) {
        const bounds = entry.bounds;
        const minX = Math.floor((bounds.min.x - margin) / CELL_SIZE), minY = Math.floor((bounds.min.y - margin) / CELL_SIZE), minZ = Math.floor((bounds.min.z - margin) / CELL_SIZE);
        const maxX = Math.floor((bounds.max.x + margin) / CELL_SIZE), maxY = Math.floor((bounds.max.y + margin) / CELL_SIZE), maxZ = Math.floor((bounds.max.z + margin) / CELL_SIZE);
        const cellCount = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);

        if (!Number.isFinite(cellCount) || cellCount <= 0 || cellCount > MAX_ENTRY_CELLS) {
            this.largeEntries.push(entry);
            return;
        }

        for (let x = minX; x <= maxX; x++) {
            let cellsY = this.cells.get(x);

            if (!cellsY) {
                cellsY = new Map();
                this.cells.set(x, cellsY);
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

    protected recordComparison(a: CheckResult_T | null, b: CheckResult_T | null) {
        this.stats.comparisons++;

        if (!!a !== !!b) {
            this.stats.comparisonMisses++;
            return;
        }

        if (!a) return;
        if (a.actor !== b.actor) this.stats.comparisonActorDifferences++;
        if (Math.abs(a.time - b.time) > COMPARISON_TIME_EPSILON) this.stats.comparisonTimeDifferences++;
        if (a.normal.dot(b.normal) < 1 - COMPARISON_NORMAL_EPSILON) this.stats.comparisonNormalDifferences++;
    }

    // AActor::IsBlockedBy (0x7cd650): world geometry answers from the source's bCollideWorld, every
    // other pairing is mutual - both actors must agree before the hit counts
    protected shouldBlockActor(actor: ICollidable, query: CollisionQuery_T, zeroExtent: boolean): boolean {
        const target = actor.getCollisionProfile ? actor.getCollisionProfile() || defaultProfile : defaultProfile;

        if (zeroExtent ? !target.blockZeroExtent : !target.blockNonZeroExtent) return false;

        const source = query.sourceProfile || defaultProfile;

        if (target.worldGeometry) return source.collideWorld;
        if (!target.collideActors || !source.collideActors) return false;
        if (!(source.isPawn ? target.blockPlayers : target.blockActors)) return false;

        return target.isPawn ? source.blockPlayers : source.blockActors;
    }
}

function removeEntry(entries: AnalyticalEntry_T[], entry: AnalyticalEntry_T) {
    const index = entries.indexOf(entry);

    if (index >= 0) entries.splice(index, 1);
}

function getTraceBackoff(primitive: CollisionPrimitive_T | null, testDistance: number, zeroExtent: boolean): number {
    if (!primitive) return 0;
    if (primitive.kind === "terrain") return 0.5;
    if (primitive.kind === "bsp") return zeroExtent ? 0.5 : Math.max(0.1, Math.min(4, 0.1 * testDistance));
    if (primitive.kind === "staticMesh") return Math.max(0.1, Math.min(1, 0.1 * testDistance));

    return 0;
}

export default CollisionWorld;
export { CheckResult_T, CollisionBackend_T, CollisionOverlapQuery_T, CollisionQuery_T, CollisionStats_T, CollisionWorld, RayCheckResult_T };
