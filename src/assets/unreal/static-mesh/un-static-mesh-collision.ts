import FConstructable from "../un-constructable";
import { BufferValue } from "@l2js/core";
import { FMatrix } from "../un-matrix";
import FBox from "../un-box";

class FStaticMeshCollisionNode extends FConstructable {
    public vertices: number[]; // vertex
    public bounds = new FBox();

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);

        this.vertices = new Array(4).fill(1).map(_ => pkg.read(compat32).value as number);
        this.bounds.load(pkg);

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