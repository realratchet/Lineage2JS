import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import BufferValue from "../../buffer-value";

class FStaticMeshSection extends FConstructable {
    public f4: number;
    public firstIndex: number;
    public firstVertex: number;
    public lastVertex: number;
    public fE: number;
    public numFaces: number;

    public static readonly typeSize = 16;

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        const v = new BufferValue(BufferValue.uint16);

        this.f4 = pkg.read(new BufferValue(BufferValue.int32)).value as number;
        this.firstIndex = pkg.read(v).value as number;
        this.firstVertex = pkg.read(v).value as number;
        this.lastVertex = pkg.read(v).value as number;
        this.fE = pkg.read(v).value as number;
        this.numFaces = pkg.read(v).value as number;

        return this;
    }

}

export default FStaticMeshSection;
export { FStaticMeshSection };