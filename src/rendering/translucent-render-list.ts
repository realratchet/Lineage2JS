import { Box3, Matrix4, NormalBlending, Quaternion, Vector3 } from "three";
import TranslucentDrawList from "./translucent-draw-list";
import { PolyFlags_T } from "../assets/unreal/un-polys";
import type { SectorObject } from "../objects/zone-object";

const tmpMatrix = new Matrix4();
const tmpPosition = new Vector3();
const tmpScale = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpBounds = new Box3();
const tmpEmitterBounds = new Box3();
const tmpExtent = new Vector3();
const arrNodes: number[] = [];

type Part_T = { item: any, state: State_T, actor: Owner_T, node: number, start: number, count: number, materialIndex: number, ordinal: number, split: boolean };
type Owner_T = { center: Vector3, radius: number, path: number, leaves: number[], parts: Part_T[], count: number, ordinals: Map<number, number> };
type State_T = { sector: SectorObject, nodes: SectorObject["bspNodes"], list: TranslucentDrawList, actors: Owner_T[], actorCount: number, leaves: number[][], leafCounts: number[], dynamicLeaves: Set<number>, meshes: Map<THREE.Object3D, Owner_T[]>, surfaces: Map<THREE.Object3D, any>, visibleNodes: Uint8Array, visibleActors: Uint8Array, nodeParts: Part_T[][], nodeCounts: Uint32Array, sorted: Part_T[], cursor: number, cullBackfaces: boolean };
type BatchRange_T = { starts: Uint32Array, stamp: number };
type EmitterOwner_T = { owner: Owner_T, state: State_T, stamp: number };

export class TranslucentRenderList {
    protected readonly cacheStates = new WeakMap<SectorObject, State_T>();
    protected readonly cacheObjects = new WeakMap<THREE.Object3D, State_T>();
    protected readonly cacheBatchRanges = new WeakMap<THREE.Object3D, BatchRange_T>();
    protected readonly cacheEmitters = new WeakMap<THREE.Object3D, EmitterOwner_T>();
    protected readonly arrStates: State_T[] = [];
    protected readonly arrParts: Part_T[] = [];
    protected readonly arrOutput: any[] = [];
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
                const owner: Owner_T = { center, radius: 0, path: 0, leaves: element.leaves || [], parts: [], count: 0, ordinals: new Map(element.groups.map((group: any, index: number) => [group.start, index])) };
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
            const owner: Owner_T = { center, radius: 0, path: 0, leaves: memberships, parts: [], count: 0, ordinals: new Map(mesh.geometry.groups.map((group, index) => [group.start, index])) };
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
        const state: State_T = { sector, nodes: sector.bspNodes, list: new TranslucentDrawList(sector.bspNodes, actors, leaves), actors, actorCount: actors.length, leaves, leafCounts: leaves.map(leaf => leaf.length), dynamicLeaves: new Set(), meshes, surfaces, visibleNodes: new Uint8Array(sector.bspNodes.length), visibleActors: new Uint8Array(actors.length), nodeParts: [], nodeCounts: new Uint32Array(sector.bspNodes.length), sorted: [], cursor: 0, cullBackfaces: false };
        for (const mesh of meshes.keys()) this.cacheObjects.set(mesh, state);
        for (const mesh of surfaces.keys()) this.cacheObjects.set(mesh, state);
        this.cacheStates.set(sector, state);
        return state;
    }

    protected getEmitter(object: any): EmitterOwner_T {
        let emitter = object.emitterActor || object;
        while (emitter && !emitter.isEmitterActor) emitter = emitter.parent;
        if (!emitter) return null;

        let entry = this.cacheEmitters.get(emitter);
        if (entry && entry.stamp === this.stamp) return entry.state ? entry : null;
        if (!entry) {
            entry = { owner: { center: new Vector3(), radius: 0, path: 1, leaves: [], parts: [], count: 0, ordinals: new Map() }, state: null, stamp: 0 };
            this.cacheEmitters.set(emitter, entry);
        }
        entry.stamp = this.stamp; entry.state = null;
        const owner = entry.owner;
        owner.count = 0; owner.leaves.length = 0;
        owner.path = emitter.getUnrealScriptProperty("bStatic") ? 0 : 1;
        tmpBounds.makeEmpty();
        for (const child of emitter.scriptProperties.get("Emitters")) {
            if (child.isDisabled) continue;
            tmpBounds.union(child.getRenderBounds(tmpEmitterBounds));
        }
        if (tmpBounds.isEmpty()) return null;

        // FDynamicActor::Update 0x8e7c08 builds the emitter sphere from its world box.
        tmpBounds.getCenter(owner.center);
        tmpBounds.getSize(tmpExtent).multiplyScalar(0.5);
        owner.center.set(Math.fround(owner.center.x), Math.fround(owner.center.y), Math.fround(owner.center.z));
        const radiusSquared = Math.fround(Math.max(owner.center.distanceToSquared(tmpBounds.min), owner.center.distanceToSquared(tmpBounds.max)));
        owner.radius = Math.fround(Math.fround(Math.sqrt(radiusSquared)) * Math.fround(1.001)); // Core 0x1015079b..0x101507b5.
        emitter.getWorldPosition(tmpPosition);
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
            if (!owner.leaves.length) return null;

            const index = state.actors.length;
            state.actors.push(owner);
            for (const leaf of owner.leaves) {
                if (!state.leaves[leaf]) state.leaves[leaf] = [];
                state.leaves[leaf].push(index);
                state.dynamicLeaves.add(leaf);
            }
            entry.state = state;
            return entry;
        }
        return null;
    }

    protected add(item: any, state: State_T, actor: Owner_T, node: number, start: number, count: number, materialIndex: number, ordinal: number, split = !!state) {
        let part = this.arrParts[this.partCount];
        if (!part) part = this.arrParts[this.partCount] = { item: null, state: null, actor: null, node: -1, start: 0, count: 0, materialIndex: 0, ordinal: 0, split: false };
        this.partCount++;
        part.item = item; part.state = state; part.actor = actor; part.node = node;
        part.start = start; part.count = count; part.materialIndex = materialIndex; part.ordinal = ordinal;
        part.split = split;

        if (actor) {
            let index = actor.count++;
            while (index && actor.parts[index - 1].ordinal > ordinal) { actor.parts[index] = actor.parts[index - 1]; index--; }
            actor.parts[index] = part;
        } else if (state && node >= 0) {
            const parts = state.nodeParts[node] || (state.nodeParts[node] = []);
            parts[state.nodeCounts[node]++] = part;
        }
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
            state.actors.length = state.actorCount;
            state.visibleNodes.fill(0); state.visibleActors.fill(0); state.nodeCounts.fill(0);
            state.sorted.length = 0; state.cursor = 0;
            state.cullBackfaces = sector.findPositionZone(camera.position) !== 0;
            for (const actor of state.actors) actor.count = 0;
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
                    state.visibleNodes[node] = 1;
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
                    this.add(item, state, owner, -1, first, end - first, item.group.materialIndex, owner.ordinals.get(group.start));
                }
            } else if (owners && owners[0].leaves.length) {
                const start = item.group ? item.group.start : 0, count = item.group ? item.group.count : item.geometry.index.count;
                this.add(item, state, owners[0], -1, start, count, item.group ? item.group.materialIndex : 0, owners[0].ordinals.get(start) || 0);
            } else {
                const emitter = this.getEmitter(object);
                this.add(item, emitter ? emitter.state : null, emitter ? emitter.owner : null, -1, item.group ? item.group.start : 0, item.group ? item.group.count : 0, item.group ? item.group.materialIndex : 0, item.renderOrder, false);
            }
        }
        for (const state of this.arrStates) {
            if (state.visibleActors.length < state.actors.length) state.visibleActors = new Uint8Array(Math.max(state.actors.length, state.visibleActors.length * 2));
            for (let i = 0; i < state.actors.length; i++) state.visibleActors[i] = Number(state.actors[i].count > 0);
            state.list.sort(camera.position, state.visibleNodes, state.visibleActors);
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
                continue;
            }
            let output = this.arrOutput[count];
            if (!output) output = this.arrOutput[count] = { group: null, range: { start: 0, count: 0, materialIndex: 0 } };
            output.id = item.id; output.object = item.object; output.geometry = item.geometry; output.material = item.material; output.materialVariant = item.materialVariant;
            output.groupOrder = item.groupOrder; output.renderOrder = item.renderOrder; output.z = item.z;
            output.group = part.split || item.group ? output.range : null;
            output.range.start = part.start; output.range.count = part.count; output.range.materialIndex = part.materialIndex;
            items[count++] = output;
        }
        items.length = count;
        for (let i = count; i < this.previousOutputCount; i++) { const item = this.arrOutput[i]; item.object = item.geometry = item.material = null; }
        for (let i = this.partCount; i < oldPartCount; i++) { const part = this.arrParts[i]; part.item = part.state = part.actor = null; }
        this.previousOutputCount = count;
    }
}

export default TranslucentRenderList;
