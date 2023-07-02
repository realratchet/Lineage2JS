import { BufferValue } from "@l2js/core";

class FStaticMeshSection implements C.IConstructable {
    declare public f4: number;              // always 0 ??
    declare public firstIndex: number;      // first index
    declare public firstVertex: number;     // first used vertex
    declare public lastVertex: number;      // last used vertex
    declare public fE: number;              // ALMOST always equals to f10
    declare public numFaces: number;        // number of faces in section

    public load(pkg: GA.UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);

        this.f4 = pkg.read(uint32).value;
        this.firstIndex = pkg.read(uint16).value;
        this.firstVertex = pkg.read(uint16).value;
        this.lastVertex = pkg.read(uint16).value;
        this.fE = pkg.read(uint16).value;
        this.numFaces = pkg.read(uint16).value;

        return this;
    }
}

export default FStaticMeshSection;
export { FStaticMeshSection };