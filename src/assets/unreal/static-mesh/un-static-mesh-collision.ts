import { BufferValue, type APackage, type Constructable_T } from "@l2js/core";
import { FMatrix } from "../un-matrix";
import FBox from "../un-box";

export class FStaticMeshCollisionNode implements Constructable_T {
    declare public vertices: number[]; // vertex
    declare public bounds: FBox;

    public load(pkg: APackage): this {
        this.bounds = FBox.make();

        this.vertices = new Array(4).fill(1).map(_ => pkg.read("compat32"));
        this.bounds.load(pkg);

        return this;
    }
}

export class FStaticMeshCollisionTriangle implements Constructable_T {
    declare public matrix: FMatrix;     // looks like 4 planes? some matrix?
    declare public vertices: number[];  // vertex

    public load(pkg: APackage): this {

        this.matrix = FMatrix.make();
        this.matrix.load(pkg);

        this.vertices = new Array(4).fill(1).map(_ => pkg.read("compat32"));

        return this;
    }
}