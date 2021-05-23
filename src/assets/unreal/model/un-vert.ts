import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";

class FVert extends FConstructable {
    public static typeSize = 8;
    public vertex: number;
    public side: number;

    public load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        throw new Error("Method not implemented.");
    }

}

export default FVert;
export { FVert };