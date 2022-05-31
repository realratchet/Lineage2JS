import FConstructable from "../un-constructable";
import BufferValue from "../../buffer-value";
import { FMatrix } from "../un-matrix";

class FStaticMeshCollisionNode extends FConstructable {
    public vertices: number[]; // vertex
    public f2: number[]; // 6 floats? 2x3? makes no sense
    public f3: number;   // always 1?

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);
        const int8 = new BufferValue(BufferValue.int8);

        this.vertices = new Array(4).fill(1).map(_ => pkg.read(compat32).value as number);
        this.f2 = new Array(6).fill(1).map(_ => pkg.read(float).value as number);
        this.f3 = pkg.read(int8).value as number;

        return this;
    }
}

class FStaticMeshCollisionTriangle extends FConstructable {
    public matrix = new FMatrix(); // looks like 4 planes? some matrix?
    public vertices: number[];           // vertex

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);

        this.matrix.load(pkg);

        this.vertices = new Array(4).fill(1).map(_ => pkg.read(compat32).value as number);

        return this;
    }
}

export { FStaticMeshCollisionNode, FStaticMeshCollisionTriangle };