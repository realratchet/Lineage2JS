import { Matrix4, Vector3 } from "three";

type IndexArray_T = Uint8Array | Uint16Array | Uint32Array;
type SortedIndexState_T = { camera: Vector3, keys: Int32Array, order: Uint32Array, ties: Uint8Array, indices: Uint32Array, vertexKeys: Int32Array, near: boolean };

const tmpVec = new Vector3();
const arrSortStack = new Int32Array(64);

function makeState(count: number, vertices: number): SortedIndexState_T {
    return { camera: new Vector3(), keys: new Int32Array(count), order: new Uint32Array(count), ties: new Uint8Array(count), indices: new Uint32Array(count * 3), vertexKeys: new Int32Array(vertices), near: false };
}

function integerKey(value: number) {
    if (!Number.isFinite(value) || value >= 2147483648) return -2147483648;

    const rounded = Math.round(value);
    return value - rounded === -0.5 && (rounded & 1) ? rounded - 1 : rounded;
}

// Engine FSortedIndexBuffer::GetContents 1063a635, Sort 1063a910.
function sortIndexBuffer(keys: Int32Array, order: Uint32Array, stable = false) {
    if (order.length < 2) return;

    let top = 0;
    arrSortStack[0] = 0; arrSortStack[1] = order.length - 1;
    while (top >= 0) {
        let min = arrSortStack[top * 2], max = arrSortStack[top * 2 + 1]; top--;
        while (true) {
            const count = max - min + 1;
            if (count <= 8) {
                while (max > min) {
                    let selected = min, selectedKey = keys[order[min]];
                    for (let item = min + 1; item <= max; item++) {
                        const key = keys[order[item]];
                        if ((selectedKey - key | 0) > 0 || stable && selectedKey === key && order[selected] < order[item]) { selected = item; selectedKey = key; }
                    }
                    const swap = order[selected]; order[selected] = order[max]; order[max--] = swap;
                }
                break;
            }
            const middle = min + (count >> 1), swap = order[middle]; order[middle] = order[min]; order[min] = swap;
            const pivot = order[min], pivotKey = keys[pivot];
            let first = min, last = max + 1;
            while (true) {
                do { first++; } while (first <= max && ((pivotKey - keys[order[first]] | 0) || (stable ? order[first] - pivot : 0)) <= 0);
                do { last--; } while (last > min && ((pivotKey - keys[order[last]] | 0) || (stable ? order[last] - pivot : 0)) >= 0);
                if (first > last) break;
                const swap = order[first]; order[first] = order[last]; order[last] = swap;
            }
            order[min] = order[last]; order[last] = pivot;
            if (last - 1 - min >= max - first) {
                if (min + 1 < last) { top++; arrSortStack[top * 2] = min; arrSortStack[top * 2 + 1] = last - 1; }
                if (max > first) { min = first; continue; }
            } else {
                if (max > first) { top++; arrSortStack[top * 2] = first; arrSortStack[top * 2 + 1] = max; }
                if (min + 1 < last) { max = last - 1; continue; }
            }
            break;
        }
    }
}

export class SortedIndexBuffer {
    protected main: SortedIndexState_T = null;
    protected auxiliary: SortedIndexState_T = null;
    protected vertices: Uint32Array = null;
    protected triangleVertices: Uint32Array = null;

    public constructor(protected readonly positions: Float32Array, protected readonly source: IndexArray_T, protected readonly start: number, public readonly count: number, protected readonly firstVertex: number, protected readonly inverse: Matrix4, protected readonly center: Vector3) {
    }

    public apply(target: IndexArray_T, offset: number, camera: Vector3, auxiliary: boolean, repacked: boolean): boolean {
        const cameraX = Math.fround(camera.x), cameraY = Math.fround(camera.y), cameraZ = Math.fround(camera.z);
        const x = Math.fround(this.center.x - cameraX), y = Math.fround(this.center.y - cameraY), z = Math.fround(this.center.z - cameraZ);
        const near = Math.fround(x * x + y * y + z * z) < 8192 * 8192;
        let state = auxiliary ? this.auxiliary : this.main, source = this.source, start = this.start, changed = false;

        if (near) {
            if (!state) {
                if (!this.vertices) {
                    const vertices: number[] = [], lookup = new Map<number, number>();
                    this.triangleVertices = new Uint32Array(this.count);
                    for (let i = 0; i < this.count; i++) {
                        const offset = (this.source[this.start + i] - this.firstVertex) * 3;
                        if (offset < 0 || offset + 2 >= this.positions.length) throw new Error(`Invalid sorted static mesh vertex: ${offset}`);
                        let index = lookup.get(offset);
                        if (index === undefined) {
                            index = vertices.length; vertices.push(offset); lookup.set(offset, index);
                        }
                        this.triangleVertices[i] = index;
                    }
                    this.vertices = Uint32Array.from(vertices);
                }
                state = makeState(this.count / 3, this.vertices.length);
                if (auxiliary) this.auxiliary = state;
                else this.main = state;
            }
            tmpVec.set(cameraX, cameraY, cameraZ).applyMatrix4(this.inverse);
            tmpVec.set(Math.fround(tmpVec.x), Math.fround(tmpVec.y), Math.fround(tmpVec.z));
            const entering = !state.near;
            let written = false;

            if (entering || !state.camera.equals(tmpVec)) {
                const { keys, order, ties, indices, vertexKeys } = state;
                let unchanged = !entering, min = 2147483647, max = -2147483648;

                for (let i = 0; i < this.vertices.length; i++) {
                    const index = this.vertices[i];
                    const x = Math.fround(this.positions[index] - tmpVec.x), y = Math.fround(this.positions[index + 1] - tmpVec.y), z = Math.fround(this.positions[index + 2] - tmpVec.z);
                    vertexKeys[i] = integerKey(Math.fround(x * x + y * y + z * z));
                }
                for (let i = 0; i < order.length; i++) {
                    const offset = i * 3;
                    let key = vertexKeys[this.triangleVertices[offset]];
                    const second = vertexKeys[this.triangleVertices[offset + 1]], third = vertexKeys[this.triangleVertices[offset + 2]];
                    if (second > key) key = second;
                    if (third > key) key = third;
                    keys[i] = key;
                    if (key < min) min = key;
                    if (key > max) max = key;
                }
                for (let i = 1; i < order.length && unchanged; i++)
                    if (keys[order[i - 1]] < keys[order[i]] || Number(keys[order[i - 1]] === keys[order[i]]) !== ties[i]) unchanged = false;

                if (!unchanged || max - min >= 2147483648) {
                    for (let i = 0; i < order.length; i++) order[i] = i;
                    sortIndexBuffer(keys, order, max - min < 2147483648);
                    written = true;
                    for (let i = 0; i < order.length; i++) {
                        if (i) ties[i] = Number(keys[order[i - 1]] === keys[order[i]]);
                        for (let vertex = 0; vertex < 3; vertex++) {
                            const value = this.source[this.start + order[i] * 3 + vertex], index = i * 3 + vertex;
                            indices[index] = value;
                            if (target[offset + index] !== value) { target[offset + index] = value; changed = true; }
                        }
                    }
                }
                state.camera.copy(tmpVec);
            }
            state.near = true;
            if (written) return changed;
            if (!repacked && !entering) return false;
            source = state.indices; start = 0;
        } else {
            if (!repacked && (!state || !state.near)) return false;
            if (state) state.near = false;
        }

        changed = false;
        for (let i = 0; i < this.count; i++) {
            const value = source[start + i];
            if (target[offset + i] !== value) { target[offset + i] = value; changed = true; }
        }
        return changed;
    }
}

export default SortedIndexBuffer;
