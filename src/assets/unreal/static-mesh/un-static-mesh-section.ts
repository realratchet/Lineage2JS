import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import BufferValue from "../../buffer-value";

class FStaticMeshSection extends FConstructable {
    public f4: number;              // always 0 ??
    public firstIndex: number;      // first index
    public firstVertex: number;     // first used vertex
    public lastVertex: number;      // last used vertex
    public fE: number;              // ALMOST always equals to f10
    public numFaces: number;        // number of faces in section

    // public unk: number;
    // public offsetSize: number;
    // public vertexMax: number;
    // public numFaces: number;
    // public triMax: number;

    public static readonly typeSize = 16;

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);

        // this.unk = await pkg.read(uint32).value as number;
        // this.offsetSize = await pkg.read(uint32).value as number;
        // this.vertexMax = await pkg.read(uint16).value as number;
        // this.numFaces = await pkg.read(uint16).value as number;
        // this.triMax = await pkg.read(uint16).value as number;

        this.f4 = await pkg.read(uint32).value as number;
        this.firstIndex = await pkg.read(uint16).value as number;
        this.firstVertex = await pkg.read(uint16).value as number;
        this.lastVertex = await pkg.read(uint16).value as number;
        this.fE = await pkg.read(uint16).value as number;
        this.numFaces = await pkg.read(uint16).value as number;

        return this;
    }

}

export default FStaticMeshSection;
export { FStaticMeshSection };