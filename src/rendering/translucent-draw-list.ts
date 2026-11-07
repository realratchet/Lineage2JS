type Plane_T = { x: number, y: number, z: number, w: number };
type Point_T = { x: number, y: number, z: number };
type Node_T = { plane: Plane_T, front: number, back: number, iPlane: number, leaves: number[] };
type Block_T = { items: Int32Array, count: number, minimum: number, following: Block_T };
type Actor_T = { center: Point_T, radius: number, path: number, leaves: number[] };

function planeDot(plane: Plane_T, x: number, y: number, z: number) {
    return (y * plane.y + z * plane.z) + x * plane.x - plane.w;
}

export class TranslucentDrawList {
    public order: Int32Array;
    public count = 0;
    protected next: Int32Array;
    protected stamps: Uint32Array;
    protected distances: Float64Array;
    protected readonly stack: Int32Array;
    protected readonly parents: Int32Array;
    protected readonly active: Uint32Array;
    protected readonly planeDistances: Float64Array;
    protected readonly leafNodes: number[][] = [];
    protected stamp = 0;
    protected readonly blocks: Block_T[] = [];
    protected blockCount = 0;

    public constructor(protected readonly nodes: Node_T[], protected readonly actors: Actor_T[], protected readonly leaves: number[][]) {
        this.order = new Int32Array(nodes.length + actors.length);
        this.next = new Int32Array(this.order.length);
        this.stamps = new Uint32Array(actors.length);
        this.distances = new Float64Array(actors.length);
        this.stack = new Int32Array(nodes.length * 6 + 4);
        this.parents = new Int32Array(nodes.length).fill(-1);
        this.active = new Uint32Array(nodes.length);
        this.planeDistances = new Float64Array(nodes.length);

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.front >= 0) this.parents[node.front] = i;
            if (node.back >= 0) this.parents[node.back] = i;
            if (node.iPlane >= 0) this.parents[node.iPlane] = i;
            for (let side = 0; side < 2; side++) {
                if ((side ? node.front : node.back) >= 0 || node.leaves[side] < 0) continue;
                const leaf = node.leaves[side];
                if (!this.leafNodes[leaf]) this.leafNodes[leaf] = [];
                this.leafNodes[leaf].push(i);
            }
        }
    }

    protected getBlock(): Block_T {
        let block = this.blocks[this.blockCount];
        if (!block) block = this.blocks[this.blockCount] = { items: new Int32Array(64), count: 0, minimum: Infinity, following: null };
        this.blockCount++;
        block.count = 0; block.minimum = Infinity; block.following = null;
        return block;
    }

    protected insertBlock(block: Block_T, index: number, entry: number, distance: number): void {
        if (block.count === 64) {
            const following = this.getBlock();
            following.items.set(block.items.subarray(32));
            following.count = block.count = 32;
            following.following = block.following;
            block.following = following;
            block.minimum = following.minimum = Infinity;
            for (let i = 0; i < 32; i++) {
                const a = block.items[i], b = following.items[i];
                block.minimum = Math.min(block.minimum, a < this.nodes.length ? -Infinity : this.distances[a - this.nodes.length]);
                following.minimum = Math.min(following.minimum, b < this.nodes.length ? -Infinity : this.distances[b - this.nodes.length]);
            }
            if (index >= 32) { block = following; index -= 32; }
        }
        for (let i = block.count; i > index; i--) block.items[i] = block.items[i - 1];
        block.items[index] = entry;
        block.count++;
        block.minimum = Math.min(block.minimum, distance);
    }

    protected markActive(node: number): void {
        while (node >= 0 && this.active[node] !== this.stamp) {
            this.active[node] = this.stamp;
            node = this.parents[node];
        }
    }

    // Engine ProcessLeaf 1064a878/1064adcb/1064b29a, ProcessBspNode 106500e0.
    public sort(camera: Point_T, visibleNodes: Uint8Array, visibleActors: Uint8Array, arrVisibleNodes?: number[], arrVisibleActors?: number[]): void {
        this.count = 0;
        if (!this.nodes.length) return;

        if (this.stamps.length < this.actors.length) {
            const capacity = Math.max(this.actors.length, this.stamps.length * 2);
            this.order = new Int32Array(this.nodes.length + capacity);
            this.next = new Int32Array(this.order.length);
            this.stamps = new Uint32Array(capacity);
            this.distances = new Float64Array(capacity);
        }

        this.stamp = (this.stamp + 1) >>> 0;
        if (!this.stamp) { this.stamps.fill(0); this.active.fill(0); this.stamp = 1; }

        for (let i = 0, count = arrVisibleNodes ? arrVisibleNodes.length : this.nodes.length; i < count; i++) {
            const index = arrVisibleNodes ? arrVisibleNodes[i] : i;
            if (visibleNodes[index]) this.markActive(index);
        }
        let visibleActorCount = 0;
        for (let i = 0, count = arrVisibleActors ? arrVisibleActors.length : this.actors.length; i < count; i++) {
            const index = arrVisibleActors ? arrVisibleActors[i] : i;
            if (!visibleActors[index]) continue;
            visibleActorCount++;
            for (const leaf of this.actors[index].leaves) {
                const nodes = this.leafNodes[leaf];
                if (nodes) for (const node of nodes) this.markActive(node);
            }
        }

        let useBlocks = false, firstBlock: Block_T = null, insertionSteps = 0;
        const blockThreshold = Math.max(256, visibleActorCount * 2);
        this.blockCount = 0;
        const { nodes, actors, next, stack, distances, planeDistances } = this;
        const x = Math.fround(camera.x), y = Math.fround(camera.y), z = Math.fround(camera.z);
        let top = 2, head = -1, remainingActors = visibleActorCount;
        stack[0] = 0; stack[1] = 0;

        while (top) {
            const index = stack[--top], kind = stack[--top];
            if (kind === 2) {
                if (index < 0 || !remainingActors) continue;
                const roster = this.leaves[index];
                if (!roster) continue;

                for (let i = 0; i < roster.length; i++) {
                    const actorIndex = roster[i];
                    if (!visibleActors[actorIndex] || this.stamps[actorIndex] === this.stamp) continue;
                    this.stamps[actorIndex] = this.stamp;
                    remainingActors--;

                    const actor = actors[actorIndex], center = actor.center;
                    const cx = Math.fround(center.x), cy = Math.fround(center.y), cz = Math.fround(center.z);
                    const dx = Math.fround(cx - x), dy = Math.fround(cy - y), dz = Math.fround(cz - z);
                    const distance = distances[actorIndex] = (dx * dx + dy * dy) + dz * dz, key = Math.fround(distance);
                    let previous = -1, item = head;

                    let block = firstBlock, offset = 0;
                    if (useBlocks) {
                        search: while (true) {
                            if (block.minimum > key && block.count) previous = block.items[block.count - 1];
                            else for (offset = 0; offset < block.count; offset++) {
                                item = block.items[offset];
                                if (item < nodes.length) {
                                    const plane = nodes[item].plane, height = actor.path ? cz - actor.radius : cz;
                                    if (!(planeDistances[item] * planeDot(plane, cx, cy, height) > 0)) break search;
                                } else if (!(distances[item - nodes.length] > key)) break search;
                                previous = item;
                            }
                            if (!block.following) { offset = block.count; item = -1; break; }
                            block = block.following;
                        }
                    } else while (item >= 0) {
                        insertionSteps++;
                        if (item < nodes.length) {
                            const plane = nodes[item].plane, height = actor.path ? cz - actor.radius : cz;
                            if (!(planeDistances[item] * planeDot(plane, cx, cy, height) > 0)) break;
                        } else if (!(distances[item - nodes.length] > key)) break;

                        previous = item; item = next[item];
                    }

                    const entry = nodes.length + actorIndex;
                    if (useBlocks) this.insertBlock(block, offset, entry, distance);
                    next[entry] = item;
                    if (previous < 0) head = entry;
                    else next[previous] = entry;

                    if (!useBlocks && visibleActorCount >= 64 && insertionSteps >= blockThreshold) {
                        useBlocks = true;
                        let block = firstBlock = this.getBlock();
                        for (let item = head; item >= 0; item = next[item]) {
                            if (block.count === 64) { block.following = this.getBlock(); block = block.following; }
                            block.items[block.count++] = item;
                            block.minimum = Math.min(block.minimum, item < nodes.length ? -Infinity : distances[item - nodes.length]);
                        }
                    }
                    if (!remainingActors) break;
                }
            } else if (kind === 1) {
                for (let node = index; node >= 0; node = nodes[node].iPlane) {
                    if (!visibleNodes[node]) continue;
                    planeDistances[node] = planeDot(nodes[node].plane, x, y, z);
                    next[node] = head; head = node;
                    if (useBlocks) this.insertBlock(firstBlock, 0, node, -Infinity);
                }
            } else {
                if (this.active[index] !== this.stamp) continue;
                const node = nodes[index], front = planeDot(node.plane, x, y, z) > 0;
                const near = front ? node.front : node.back, far = front ? node.back : node.front;
                stack[top++] = far < 0 ? 2 : 0; stack[top++] = far < 0 ? node.leaves[front ? 0 : 1] : far;
                stack[top++] = 1; stack[top++] = index;
                stack[top++] = near < 0 ? 2 : 0; stack[top++] = near < 0 ? node.leaves[front ? 1 : 0] : near;
            }
        }

        for (let item = head; item >= 0; item = next[item]) {
            if (this.count === this.order.length) throw new Error(`Invalid translucent primitive list.`);
            this.order[this.count++] = item < nodes.length ? item : ~(item - nodes.length);
        }
    }
}

export default TranslucentDrawList;
