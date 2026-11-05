import { Matrix4, Vector3 } from "three";
import { SortedIndexBuffer as WasmSortedIndexBuffer } from "three-wasm/SortedIndexBuffer";

type IndexArray_T = Uint8Array | Uint16Array | Uint32Array;
type SortedIndexState_T = { camera: Vector3, sorter: ReturnType<WasmSortedIndexBuffer["createState"]>, indices: Uint32Array };

const tmpVec = new Vector3();

export class SortedIndexBuffer {
    protected main: SortedIndexState_T = null;
    protected auxiliary: SortedIndexState_T = null;
    protected buffer: WasmSortedIndexBuffer = null;

    public constructor(protected readonly positions: Float32Array, protected readonly source: IndexArray_T, protected readonly start: number, public readonly count: number, protected readonly firstVertex: number, protected readonly inverse: Matrix4, protected readonly center: Vector3) {
    }

    public apply(target: IndexArray_T, offset: number, camera: Vector3, auxiliary: boolean, repacked: boolean): boolean {
        const cameraX = Math.fround(camera.x), cameraY = Math.fround(camera.y), cameraZ = Math.fround(camera.z);
        const x = Math.fround(this.center.x - cameraX), y = Math.fround(this.center.y - cameraY), z = Math.fround(this.center.z - cameraZ);
        const near = Math.fround(x * x + y * y + z * z) < 8192 * 8192;
        let state = auxiliary ? this.auxiliary : this.main, written = false;
        const entering = !state;

        if (entering || near) {
            tmpVec.set(cameraX, cameraY, cameraZ).applyMatrix4(this.inverse);
            tmpVec.set(Math.fround(tmpVec.x), Math.fround(tmpVec.y), Math.fround(tmpVec.z));

            if (entering || !state.sorter) {
                let buffer = this.buffer;
                if (!buffer) {
                    buffer = new WasmSortedIndexBuffer(this.positions, this.source.subarray(this.start, this.start + this.count), this.firstVertex);
                    if (near) this.buffer = buffer;
                }
                const sorter = buffer.createState();
                sorter.apply(tmpVec.x, tmpVec.y, tmpVec.z, true);
                if (!state) {
                    state = { camera: new Vector3(), sorter: null, indices: null };
                    if (auxiliary) this.auxiliary = state;
                    else this.main = state;
                }
                state.sorter = near ? sorter : null;
                state.indices = near ? sorter.indices : sorter.indices.slice();
                state.camera.copy(tmpVec);
                if (!near) {
                    if (buffer === this.buffer) sorter.dispose();
                    else buffer.dispose();
                }
                written = true;
            } else if (!state.camera.equals(tmpVec)) {
                written = state.sorter.apply(tmpVec.x, tmpVec.y, tmpVec.z, false);
                state.camera.copy(tmpVec);
            }
        }
        if (!written && !repacked && !entering) return false;
        const source = state.indices;

        for (let i = 0; i < this.count; i++) {
            if (target[offset + i] === source[i]) continue;
            target.set(source.subarray(i, this.count), offset + i);
            return true;
        }
        return false;
    }

    public dispose(): void {
        if (this.buffer) this.buffer.dispose();
        this.buffer = null;
        this.main = this.auxiliary = null;
    }
}

export default SortedIndexBuffer;
