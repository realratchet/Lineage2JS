type Plane_T = { x: number, y: number, z: number, w: number };
type Point_T = { x: number, y: number, z: number };
type Node_T = { plane: Plane_T, front: number, back: number, iPlane: number, leaves: number[] };
type Actor_T = { center: Point_T, radius: number, path: number };

function planeDot(plane: Plane_T, x: number, y: number, z: number) {
    return (y * plane.y + z * plane.z) + x * plane.x - plane.w;
}

export class TranslucentDrawList {
    public readonly order: Int32Array;
    public count = 0;
    protected readonly next: Int32Array;
    protected readonly stamps: Uint32Array;
    protected readonly distances: Float64Array;
    protected readonly stack: Int32Array;
    protected stamp = 0;

    public constructor(protected readonly nodes: Node_T[], protected readonly actors: Actor_T[], protected readonly leaves: number[][]) {
        this.order = new Int32Array(nodes.length + actors.length);
        this.next = new Int32Array(this.order.length);
        this.stamps = new Uint32Array(actors.length);
        this.distances = new Float64Array(actors.length);
        this.stack = new Int32Array(nodes.length * 6 + 4);
    }

    // Engine ProcessLeaf 1064a878/1064adcb/1064b29a, ProcessBspNode 106500e0.
    public sort(camera: Point_T, visibleNodes: Uint8Array, visibleActors: Uint8Array): void {
        this.count = 0;
        if (!this.nodes.length) return;

        this.stamp = (this.stamp + 1) >>> 0;
        if (!this.stamp) { this.stamps.fill(0); this.stamp = 1; }

        const { nodes, actors, next, stack, distances } = this;
        const x = Math.fround(camera.x), y = Math.fround(camera.y), z = Math.fround(camera.z);
        let top = 2, head = -1;
        stack[0] = 0; stack[1] = 0;

        while (top) {
            const index = stack[--top], kind = stack[--top];
            if (kind === 2) {
                if (index < 0) continue;
                const roster = this.leaves[index];
                if (!roster) continue;

                for (let i = 0; i < roster.length; i++) {
                    const actorIndex = roster[i];
                    if (!visibleActors[actorIndex] || this.stamps[actorIndex] === this.stamp) continue;
                    this.stamps[actorIndex] = this.stamp;

                    const actor = actors[actorIndex], center = actor.center;
                    const cx = Math.fround(center.x), cy = Math.fround(center.y), cz = Math.fround(center.z);
                    const dx = Math.fround(cx - x), dy = Math.fround(cy - y), dz = Math.fround(cz - z);
                    const distance = distances[actorIndex] = (dx * dx + dy * dy) + dz * dz, key = Math.fround(distance);
                    let previous = -1, item = head;

                    while (item >= 0) {
                        if (item < nodes.length) {
                            const plane = nodes[item].plane, height = actor.path ? cz - actor.radius : cz;
                            if (!(planeDot(plane, x, y, z) * planeDot(plane, cx, cy, height) > 0)) break;
                        } else if (!(distances[item - nodes.length] > key)) break;

                        previous = item; item = next[item];
                    }

                    const entry = nodes.length + actorIndex;
                    next[entry] = item;
                    if (previous < 0) head = entry;
                    else next[previous] = entry;
                }
            } else if (kind === 1) {
                for (let node = index; node >= 0; node = nodes[node].iPlane) {
                    if (!visibleNodes[node]) continue;
                    next[node] = head; head = node;
                }
            } else {
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
