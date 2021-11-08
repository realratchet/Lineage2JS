import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import BufferValue from "../../buffer-value";

class FVert extends FConstructable {
    public static typeSize = 8;
    public vertex: number;
    public side: number;

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        const compat32 = new BufferValue(BufferValue.compat32);

        this.vertex = pkg.read(compat32).value as number;
        this.side = pkg.read(compat32).value as number;
        
        return this;
    }

}

export default FVert;
export { FVert };