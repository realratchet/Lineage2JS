import { BufferValue } from "@l2js/core";
import FConstructable from "../un-constructable";

class FStaticMeshSection extends FConstructable {
    public f4: number;              // always 0 ??
    public firstIndex: number;      // first index
    public firstVertex: number;     // first used vertex
    public lastVertex: number;      // last used vertex
    public fE: number;              // ALMOST always equals to f10
    public numFaces: number;        // number of faces in section

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);

        this.f4 = pkg.read(uint32).value as number;
        this.firstIndex = pkg.read(uint16).value as number;
        this.firstVertex = pkg.read(uint16).value as number;
        this.lastVertex = pkg.read(uint16).value as number;
        this.fE = pkg.read(uint16).value as number;
        this.numFaces = pkg.read(uint16).value as number;

        return this;
    }
}

export default FStaticMeshSection;
export { FStaticMeshSection };