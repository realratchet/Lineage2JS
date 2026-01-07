import { BufferValue } from "@l2js/core";

class FStaticMeshSection implements C.IConstructable {
    declare public f4: number;              // always 0 ??
    declare public firstIndex: number;      // first index
    declare public firstVertex: number;     // first used vertex
    declare public lastVertex: number;      // last used vertex
    declare public fE: number;              // ALMOST always equals to f10
    declare public numFaces: number;        // number of faces in section

    public load(pkg: C.APackage): this {

        this.f4 = pkg.read("uint32");
        this.firstIndex = pkg.read("uint16");
        this.firstVertex = pkg.read("uint16");
        this.lastVertex = pkg.read("uint16");
        this.fE = pkg.read("uint16");
        this.numFaces = pkg.read("uint16");

        return this;
    }
}

export default FStaticMeshSection;
export { FStaticMeshSection };