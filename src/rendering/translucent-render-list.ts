import { Box3, Matrix4, NormalBlending, Quaternion, Vector3 } from "three";
import TranslucentDrawList from "./translucent-draw-list";
import { PolyFlags_T } from "../assets/unreal/un-polys";
import { getBatchBounds, type SectorObject } from "../objects/zone-object";

const tmpMatrix = new Matrix4();
const tmpPosition = new Vector3();
const tmpScale = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpBounds = new Box3();
const tmpEmitterBounds = new Box3();
const tmpExtent = new Vector3();
const arrNodes: number[] = [];

type Part_T = { item: any, state: State_T, actor: Owner_T, emitter: DynamicOwner_T, bounds: Box3, node: number, start: number, count: number, materialIndex: number, ordinal: number, split: boolean };
type Owner_T = { index: number, center: Vector3, radius: number, path: number, leaves: number[], parts: Part_T[], count: number, ordinals: Map<number, number> };
type State_T = { sector: SectorObject, nodes: SectorObject["bspNodes"], list: TranslucentDrawList, actors: Owner_T[], actorCount: number, leaves: number[][], leafCounts: number[], dynamicLeaves: Set<number>, meshes: Map<THREE.Object3D, Owner_T[]>, surfaces: Map<THREE.Object3D, any>, visibleNodes: Uint8Array, visibleActors: Uint8Array, arrVisibleNodes: number[], arrVisibleActors: number[], nodeParts: Part_T[][], nodeCounts: Uint32Array, sorted: Part_T[], partCount: number, cursor: number, cullBackfaces: boolean };
type BatchRange_T = { starts: Uint32Array, stamp: number };
type DynamicOwner_T = { owner: Owner_T, state: State_T, stamp: number, distance: number, key: number, items: any[] };

export class TranslucentRenderList {
    protected readonly cacheStates = new WeakMap<SectorObject, State_T>();
    protected readonly cacheObjects = new WeakMap<THREE.Object3D, State_T>();
    protected readonly cacheBatchRanges = new WeakMap<THREE.Object3D, BatchRange_T>();
    protected readonly cacheActors = new WeakMap<THREE.Object3D, DynamicOwner_T>();
    protected readonly arrStates: State_T[] = [];
    protected readonly arrParts: Part_T[] = [];
    protected readonly arrOutput: any[] = [];
    protected readonly arrDeferred: DynamicOwner_T[] = [];
    protected readonly arrSortedDeferred: DynamicOwner_T[] = [];
    protected readonly arrNameplates: any[] = [];
    protected partCount = 0;
    protected previousOutputCount = 0;
    protected stamp = 0;

    protected getBatchStarts(object: any): Uint32Array {
        const groups = object.visibleBatchGroups;
        let range = this.cacheBatchRanges.get(object);
        if (!range || range.starts.length < groups.length) {
            range = { starts: new Uint32Array(groups.length), stamp: -1 };
            this.cacheBatchRanges.set(object, range);
        }
        if (range.stamp !== this.stamp) {
            let offset = 0;
            for (let i = 0; i < groups.length; i++) {
                range.starts[i] = offset;
                offset += groups[i].count;
            }
            range.stamp = this.stamp;
        }
        return range.starts;
    }

    protected makeState(sector: SectorObject): State_T {
        const library = (sector as any).decodeLibrary, manifest = library.staticMeshBatches;
        const actors: Owner_T[] = [], meshes = new Map<THREE.Object3D, Owner_T[]>(), surfaces = new Map<THREE.Object3D, any>(), leaves: number[][] = [];
        const order = new Map<string, number>(library.levelActorUuids.map((uuid: string, index: number) => [uuid, index]));
        const rosters: { owner: Owner_T, uuid: string }[] = [];

        for (const batch of manifest.batches) {
            const mesh = sector.staticMeshMap.get(batch.uuid), owners: Owner_T[] = [];
            if (!mesh) throw new Error(`Missing translucent batch: ${batch.name}`);

            for (let i = 0; i < batch.actors.length; i++) {
                const actor = batch.actors[i], source = library.geometries[actor.instance.mesh.geometry];
                tmpMatrix.compose(tmpPosition.fromArray(actor.position), tmpQuaternion.fromArray(actor.quaternion), tmpScale.fromArray(actor.scale));
                const center = new Vector3().fromArray(source.bounds.sphere.center).applyMatrix4(tmpMatrix), element = batch.batchElements[i];
                const owner: Owner_T = { index: actors.length, center, radius: 0, path: 0, leaves: element.leaves || [], parts: [], count: 0, ordinals: new Map(element.groups.map((group: any, index: number) => [group.start, index])) };
                center.set(Math.fround(center.x), Math.fround(center.y), Math.fround(center.z));
                owners.push(owner); actors.push(owner); rosters.push({ owner, uuid: actor.uuid });
            }
            meshes.set(mesh, owners);
        }
        for (const actor of manifest.unbatchable) {
            const mesh = sector.staticMeshMap.get(actor.uuid) as THREE.Mesh;
            if (!mesh || !mesh.geometry || !actor.instance) continue;
            if ((mesh as any).isMovableObject || (mesh as any).isRotatingObject) continue;

            const source = library.geometries[actor.instance.mesh.geometry];
            const center = new Vector3().fromArray(source.bounds.sphere.center).applyMatrix4(mesh.matrixWorld), memberships: number[] = [];
            library.leafActors.forEach((entries: any[], leaf: number) => { if (entries.some(entry => entry.uuid === actor.uuid)) memberships.push(leaf); });
            const owner: Owner_T = { index: actors.length, center, radius: 0, path: 0, leaves: memberships, parts: [], count: 0, ordinals: new Map(mesh.geometry.groups.map((group, index) => [group.start, index])) };
            center.set(Math.fround(center.x), Math.fround(center.y), Math.fround(center.z));
            meshes.set(mesh, [owner]); actors.push(owner); rosters.push({ owner, uuid: actor.uuid });
        }
        rosters.sort((a, b) => order.get(a.uuid) - order.get(b.uuid));
        const indices = new Map(actors.map((actor, index) => [actor, index]));
        for (const entry of rosters) for (const leaf of entry.owner.leaves) {
            if (!leaves[leaf]) leaves[leaf] = [];
            leaves[leaf].push(indices.get(entry.owner));
        }
        for (const section of sector.getTranslucentBSP()) surfaces.set(section.mesh, section);
        const state: State_T = { sector, nodes: sector.bspNodes, list: new TranslucentDrawList(sector.bspNodes, actors, leaves), actors, actorCount: actors.length, leaves, leafCounts: leaves.map(leaf => leaf.length), dynamicLeaves: new Set(), meshes, surfaces, visibleNodes: new Uint8Array(sector.bspNodes.length), visibleActors: new Uint8Array(actors.length), arrVisibleNodes: [], arrVisibleActors: [], nodeParts: [], nodeCounts: new Uint32Array(sector.bspNodes.length), sorted: [], partCount: 0, cursor: 0, cullBackfaces: false };
        for (const mesh of meshes.keys()) this.cacheObjects.set(mesh, state);
        for (const mesh of surfaces.keys()) this.cacheObjects.set(mesh, state);
        this.cacheStates.set(sector, state);
        return state;
    }

    protected getDynamicActor(object: any, x: number, y: number, z: number): DynamicOwner_T {
        const pawn = object.actorRenderable;
        let actor = pawn ? pawn.getParent() : object.emitterActor || object;
        if (!pawn) {
            while (actor && !actor.isEmitterActor) actor = actor.parent;
            if (!actor || actor.getUnrealScriptProperty("bDisableSorting")) return null;
        }

        let entry = this.cacheActors.get(actor);
        if (entry && entry.stamp === this.stamp) return entry;
        if (!entry) {
            entry = { owner: { index: -1, center: new Vector3(), radius: 0, path: 1, leaves: [], parts: [], count: 0, ordinals: new Map() }, state: null, stamp: -1, distance: 0, key: 0, items: [] };
            this.cacheActors.set(actor, entry);
        }
        entry.state = null;
        entry.items.length = 0;
        const owner = entry.owner;
        owner.count = 0; owner.leaves.length = 0;
        owner.path = !pawn && actor.getUnrealScriptProperty("bStatic") ? 0 : 1;
        tmpBounds.makeEmpty();
        if (pawn) {
            const sphere = pawn.getRenderSphere();
            tmpBounds.min.copy(sphere.center).addScalar(-sphere.radius);
            tmpBounds.max.copy(sphere.center).addScalar(sphere.radius);
        } else for (const child of actor.scriptProperties.get("Emitters")) {
            if (child.isDisabled) continue;
            tmpBounds.union(child.getRenderBounds(tmpEmitterBounds));
        }
        if (tmpBounds.isEmpty()) return null;
        entry.stamp = this.stamp;

        // FDynamicActor::Update 0x8e7c08 builds the emitter sphere from its world box.
        tmpBounds.getCenter(owner.center);
        tmpBounds.getSize(tmpExtent).multiplyScalar(0.5);
        owner.center.set(Math.fround(owner.center.x), Math.fround(owner.center.y), Math.fround(owner.center.z));
        const dx = Math.fround(owner.center.x - x), dy = Math.fround(owner.center.y - y), dz = Math.fround(owner.center.z - z);
        entry.distance = (dx * dx + dy * dy) + dz * dz;
        entry.key = Math.fround(entry.distance);
        const radiusSquared = Math.fround(pawn ? tmpExtent.x * tmpExtent.x : Math.max(owner.center.distanceToSquared(tmpBounds.min), owner.center.distanceToSquared(tmpBounds.max)));
        owner.radius = Math.fround(Math.fround(Math.sqrt(radiusSquared)) * Math.fround(1.001)); // Core 0x1015079b..0x101507b5.
        actor.getWorldPosition(tmpPosition);
        const sectorX = Math.trunc(Math.trunc(Math.fround(tmpPosition.x)) / 32768 + 20), sectorY = Math.trunc(Math.trunc(Math.fround(tmpPosition.y)) / 32768 + 18);
        for (const state of this.arrStates) {
            if (state.sector.index.x !== sectorX || state.sector.index.y !== sectorY || !state.nodes.length) continue;

            arrNodes.length = 0; arrNodes.push(0);
            while (arrNodes.length) {
                const node = state.nodes[arrNodes.pop()], plane = node.plane;
                const distance = (owner.center.y * plane.y + owner.center.z * plane.z) + owner.center.x * plane.x - plane.w;
                const extent = Math.abs(plane.x * tmpExtent.x) + Math.abs(plane.y * tmpExtent.y) + Math.abs(plane.z * tmpExtent.z);
                if (distance < extent) {
                    if (node.back >= 0) arrNodes.push(node.back);
                    else if (node.leaves[0] >= 0) owner.leaves.push(node.leaves[0]);
                }
                if (-distance < extent) {
                    if (node.front >= 0) arrNodes.push(node.front);
                    else if (node.leaves[1] >= 0) owner.leaves.push(node.leaves[1]);
                }
            }
            if (!owner.leaves.length) return entry;

            const index = owner.index = state.actors.length;
            state.actors.push(owner);
            for (const leaf of owner.leaves) {
                if (!state.leaves[leaf]) state.leaves[leaf] = [];
                state.leaves[leaf].push(index);
                state.dynamicLeaves.add(leaf);
            }
            entry.state = state;
            return entry;
        }
        return entry;
    }

    protected add(item: any, state: State_T, actor: Owner_T, node: number, start: number, count: number, materialIndex: number, ordinal: number, split = !!state, emitter: DynamicOwner_T = null) {
        let part = this.arrParts[this.partCount];
        if (!part) part = this.arrParts[this.partCount] = { item: null, state: null, actor: null, emitter: null, bounds: null, node: -1, start: 0, count: 0, materialIndex: 0, ordinal: 0, split: false };
        this.partCount++;
        part.item = item; part.state = state; part.actor = actor; part.node = node;
        part.start = start; part.count = count; part.materialIndex = materialIndex; part.ordinal = ordinal;
        part.split = split;
        part.emitter = emitter;
        part.bounds = null;
        if (state) state.partCount++;

        if (actor) {
            if (!actor.count && state) {
                if (state.visibleActors.length <= actor.index) {
                    const visibleActors = new Uint8Array(Math.max(actor.index + 1, state.visibleActors.length * 2));
                    visibleActors.set(state.visibleActors);
                    state.visibleActors = visibleActors;
                }
                state.visibleActors[actor.index] = 1;
                state.arrVisibleActors.push(actor.index);
            }
            let index = actor.count++;
            while (index && actor.parts[index - 1].ordinal > ordinal) { actor.parts[index] = actor.parts[index - 1]; index--; }
            actor.parts[index] = part;
        } else if (state && node >= 0) {
            if (!state.nodeCounts[node]) {
                state.visibleNodes[node] = 1;
                state.arrVisibleNodes.push(node);
            }
            const parts = state.nodeParts[node] || (state.nodeParts[node] = []);
            parts[state.nodeCounts[node]++] = part;
        }
        return part;
    }

    public sort(items: any[], camera: THREE.Camera, sectors: SectorObject[]): void {
        const oldPartCount = this.partCount;
        this.stamp++;
        this.partCount = 0; this.arrStates.length = 0;
        const x = Math.fround(camera.position.x), y = Math.fround(camera.position.y), z = Math.fround(camera.position.z);
        for (const sector of sectors) {
            if (!sector.visible || !sector.bspGroup || !sector.staticMeshGroup || !(sector as any).decodeLibrary?.staticMeshBatches) continue;

            const state = this.cacheStates.get(sector) || this.makeState(sector);
            for (const leaf of state.dynamicLeaves) state.leaves[leaf].length = state.leafCounts[leaf] || 0;
            state.dynamicLeaves.clear();
            for (const index of state.arrVisibleActors) {
                state.actors[index].count = 0;
                state.visibleActors[index] = 0;
            }
            for (const index of state.arrVisibleNodes) {
                state.visibleNodes[index] = state.nodeCounts[index] = 0;
            }
            state.arrVisibleActors.length = state.arrVisibleNodes.length = 0;
            state.actors.length = state.actorCount;
            state.sorted.length = 0; state.partCount = 0; state.cursor = 0;
            state.cullBackfaces = sector.findPositionZone(camera.position) !== 0;
            this.arrStates.push(state);
        }
        for (const item of items) {
            const object = item.object, state = this.cacheObjects.get(object), section = state && state.surfaces.get(object);
            if (section) {
                let offset = 0;
                for (const block of section.order) {
                    const count = section.counts[block], node = section.nodes[block], bsp = state.nodes[node], plane = bsp.plane, start = offset;
                    offset += count;
                    // Engine 1064bd0b..1064bd27 also admits PF_Unused5 from behind.
                    if (state.cullBackfaces && !(bsp.surfFlags & (PolyFlags_T.PF_TwoSided | PolyFlags_T.PF_Portal | PolyFlags_T.PF_Unused5)) && !((y * plane.y + z * plane.z) + x * plane.x - plane.w > 0)) continue;

                    this.add(item, state, null, node, start, count, 0, 0);
                }
                continue;
            }
            const owners = state && item.material.blending === NormalBlending && state.meshes.get(object);
            if (owners && object.isBatch) {
                const groups = object.visibleBatchGroups, starts = this.getBatchStarts(object), limit = item.group.start + item.group.count;
                let firstGroup = 0, lastGroup = groups.length;
                while (firstGroup < lastGroup) {
                    const middle = (firstGroup + lastGroup) >>> 1;
                    if (starts[middle] + groups[middle].count <= item.group.start) firstGroup = middle + 1;
                    else lastGroup = middle;
                }
                for (let i = firstGroup; i < groups.length && starts[i] < limit; i++) {
                    const group = groups[i], start = starts[i];
                    const first = Math.max(start, item.group.start), end = Math.min(start + group.count, limit);
                    if (end <= first) continue;

                    const owner = owners[group.elementIndex];
                    const part = this.add(item, state, owner, -1, first, end - first, item.group.materialIndex, owner.ordinals.get(group.start));
                    if (object.batchIndices && first === start && end === start + group.count) part.bounds = getBatchBounds(item.geometry, object.batchIndices, group);
                }
            } else if (owners && owners[0].leaves.length) {
                const start = item.group ? item.group.start : 0, count = item.group ? item.group.count : item.geometry.index.count;
                this.add(item, state, owners[0], -1, start, count, item.group ? item.group.materialIndex : 0, owners[0].ordinals.get(start) || 0);
            } else {
                const actor = this.getDynamicActor(object, x, y, z), pawn = object.actorRenderable;
                const ordinal = pawn ? item.material.blending === NormalBlending ? 0 : 1 : item.renderOrder;
                this.add(item, actor ? actor.state : null, actor ? actor.owner : null, -1, item.group ? item.group.start : 0, item.group ? item.group.count : 0, item.group ? item.group.materialIndex : 0, ordinal, false, pawn ? null : actor);
            }
        }
        for (const state of this.arrStates) {
            if (!state.partCount) continue;
            state.list.sort(camera.position, state.visibleNodes, state.visibleActors, state.arrVisibleNodes, state.arrVisibleActors);
            for (let i = 0; i < state.list.count; i++) {
                const entry = state.list.order[i], parts = entry < 0 ? state.actors[~entry].parts : state.nodeParts[entry], count = entry < 0 ? state.actors[~entry].count : state.nodeCounts[entry];
                for (let part = 0; part < count; part++) state.sorted.push(parts[part]);
            }
        }
        let count = 0;
        for (let i = 0; i < this.partCount; i++) {
            const original = this.arrParts[i], part = original.state ? original.state.sorted[original.state.cursor++] : original;
            if (!part) throw new Error(`Incomplete translucent source-owner list.`);

            const item = part.item, previous = count ? this.arrOutput[count - 1] : null;
            if (previous && previous.group && (part.split || item.group) && previous.object === item.object && previous.material === item.material && previous.groupOrder === item.groupOrder && previous.renderOrder === item.renderOrder && previous.group.start + previous.group.count === part.start) {
                previous.group.count += part.count;
                if (previous.range.position && part.bounds) {
                    previous.range.bounds.union(part.bounds);
                    previous.range.boundsCount = previous.range.count;
                } else previous.range.position = null;
                continue;
            }
            let output = this.arrOutput[count];
            if (!output) output = this.arrOutput[count] = { group: null, range: { start: 0, count: 0, materialIndex: 0, bounds: new Box3(), position: null, index: null, positionVersion: -1, indexVersion: -1, boundsStart: 0, boundsCount: 0 } };
            output.id = item.id; output.object = item.object; output.geometry = item.geometry; output.material = item.material; output.materialVariant = item.materialVariant;
            output.groupOrder = item.groupOrder; output.renderOrder = item.renderOrder; output.z = item.z;
            output.emitter = part.emitter;
            output.group = part.split || item.group ? output.range : null;
            output.range.start = part.start; output.range.count = part.count; output.range.materialIndex = part.materialIndex;
            if (part.bounds) {
                const position = item.geometry.attributes.position;
                output.range.bounds.copy(part.bounds);
                output.range.position = position;
                output.range.index = item.geometry.index;
                output.range.positionVersion = position.isInterleavedBufferAttribute ? position.data.version : position.version;
                output.range.indexVersion = item.geometry.index.version;
                output.range.boundsStart = part.start; output.range.boundsCount = part.count;
            } else output.range.position = output.range.index = null;
            items[count++] = output;
        }
        items.length = count;
        let worldCount = 0;
        for (const item of items) {
            if (item.emitter) {
                if (!item.emitter.items.length) this.arrDeferred.push(item.emitter);
                item.emitter.items.push(item);
            } else if (item.object.isNameplate) this.arrNameplates.push(item);
            else items[worldCount++] = item;
        }
        // Engine.dll RVA 0x3524f1..0x352c36 defers DT_Particle until after world translucency and decorations.
        for (let i = this.arrDeferred.length - 1; i >= 0; i--) {
            const emitter = this.arrDeferred[i];
            let index = 0;
            while (index < this.arrSortedDeferred.length && this.arrSortedDeferred[index].distance > emitter.key) index++;
            for (let j = this.arrSortedDeferred.length; j > index; j--) this.arrSortedDeferred[j] = this.arrSortedDeferred[j - 1];
            this.arrSortedDeferred[index] = emitter;
        }
        for (const emitter of this.arrSortedDeferred) for (const item of emitter.items) items[worldCount++] = item;
        for (const item of this.arrNameplates) items[worldCount++] = item;
        this.arrDeferred.length = this.arrSortedDeferred.length = this.arrNameplates.length = 0;
        for (let i = count; i < this.previousOutputCount; i++) { const item = this.arrOutput[i]; item.object = item.geometry = item.material = item.emitter = null; item.range.position = item.range.index = null; }
        for (let i = this.partCount; i < oldPartCount; i++) { const part = this.arrParts[i]; part.item = part.state = part.actor = part.emitter = part.bounds = null; }
        this.previousOutputCount = count;
    }
}

export default TranslucentRenderList;
