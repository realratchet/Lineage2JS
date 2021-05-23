import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";

class FBSPSurf extends FConstructable {
    public static readonly typeSize = 1;

    public load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        throw new Error("Method not implemented.");
    }

}

export default FBSPSurf;
export { FBSPSurf };