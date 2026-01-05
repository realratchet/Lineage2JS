import { BufferValue } from "@l2js/core";

const int32 = new BufferValue(BufferValue.int32);
const compat = new BufferValue(BufferValue.compat32);

class FStaticMeshUVStream implements C.IConstructable {
    declare private data: DataView;
    declare private f10: number;
    declare private f1C: number; // most likely revision as it's always the last one in stream

    public getUV(index: number): [number, number] {
        const off = index << 3;

        return [
            this.data.getFloat32(off, true), this.data.getFloat32(off + 4, true)
        ];
    }


    public load(pkg: C.APackage): this {
        const size = pkg.read(compat).value as number;

        this.data = pkg.read(size * 4 * 2).value;

        this.f10 = pkg.read(int32).value as number;
        this.f1C = pkg.read(int32).value as number;

        return this;
    }
}

export default FStaticMeshUVStream;
export { FStaticMeshUVStream };