import { BufferValue } from "@l2js/core";
import { FMatrix } from "../un-matrix";
import FBox from "../un-box";

class FStaticMeshCollisionNode implements C.IConstructable {
    declare public vertices: number[]; // vertex
    declare public bounds: FBox;

    public load(pkg: C.APackage): this {
        this.bounds = FBox.make();

        this.vertices = new Array(4).fill(1).map(_ => pkg.read("compat32"));
        this.bounds.load(pkg);

        return this;
    }
}

class FStaticMeshCollisionTriangle implements C.IConstructable {
    declare public matrix: FMatrix;     // looks like 4 planes? some matrix?
    declare public vertices: number[];  // vertex

    public load(pkg: C.APackage): this {

        this.matrix = FMatrix.make();
        this.matrix.load(pkg);

        this.vertices = new Array(4).fill(1).map(_ => pkg.read("compat32"));

        return this;
    }
}

export { FStaticMeshCollisionNode, FStaticMeshCollisionTriangle };