import type { APackage, Constructable_T } from "@l2js/core";
class FStaticMeshSection implements Constructable_T {
    declare public isStrip: boolean;
    declare public firstIndex: number;      // first index
    declare public firstVertex: number;     // first used vertex
    declare public lastVertex: number;      // last used vertex
    declare public numTriangles: number;
    declare public numFaces: number;        // number of faces in section

    public load(pkg: APackage): this {
        this.isStrip = pkg.read("uint32") !== 0;
        this.firstIndex = pkg.read("uint16");
        this.firstVertex = pkg.read("uint16");
        this.lastVertex = pkg.read("uint16");
        this.numTriangles = pkg.read("uint16");
        this.numFaces = pkg.read("uint16");

        return this;
    }
}

export default FStaticMeshSection;
export { FStaticMeshSection };
