import FColor from "./un-color";
import UObject, { type APackage, type UExport, FArray } from "@l2js/core";

abstract class UPlatte extends UObject {
    public colors: FArray<GA.FColor>
    // public readonly skipRemaining = true;

    public doLoad(pkg: APackage, exp: UExport) {
        super.doLoad(pkg, exp);

        this.colors = new FArray(FColor.class()).load(pkg);

        console.assert(this.colors.getElemCount() === 256);
    }
}

export default UPlatte;
export { UPlatte };
