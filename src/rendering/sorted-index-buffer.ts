import { Matrix4, Vector3 } from "three";
import { SortedIndexBuffer as WasmSortedIndexBuffer } from "three-wasm/SortedIndexBuffer";

type IndexArray_T = Uint8Array | Uint16Array | Uint32Array;
type SortedIndexState_T = { camera: Vector3, sorter: ReturnType<WasmSortedIndexBuffer["createState"]>, near: boolean };

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
        let state = auxiliary ? this.auxiliary : this.main, source = this.source, start = this.start;

        if (near) {
            if (!state) {
                if (!this.buffer) this.buffer = new WasmSortedIndexBuffer(this.positions, this.source.subarray(this.start, this.start + this.count), this.firstVertex);
                state = { camera: new Vector3(), sorter: this.buffer.createState(), near: false };
                if (auxiliary) this.auxiliary = state;
                else this.main = state;
            }
            tmpVec.set(cameraX, cameraY, cameraZ).applyMatrix4(this.inverse);
            tmpVec.set(Math.fround(tmpVec.x), Math.fround(tmpVec.y), Math.fround(tmpVec.z));
            const entering = !state.near;
            let written = false;

            if (entering || !state.camera.equals(tmpVec)) {
                written = state.sorter.apply(tmpVec.x, tmpVec.y, tmpVec.z, entering);
                state.camera.copy(tmpVec);
            }
            state.near = true;
            if (!written && !repacked && !entering) return false;
            source = state.sorter.indices; start = 0;
        } else {
            if (!repacked && (!state || !state.near)) return false;
            if (state) state.near = false;
        }

        let changed = false;
        for (let i = 0; i < this.count; i++) {
            const value = source[start + i];
            if (target[offset + i] !== value) { target[offset + i] = value; changed = true; }
        }
        return changed;
    }

    public dispose(): void {
        if (this.buffer) this.buffer.dispose();
        this.buffer = null;
        this.main = this.auxiliary = null;
    }
}

export default SortedIndexBuffer;
