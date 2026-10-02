import FColor from "./un-color";
import { type APackage, type UExport, FArray } from "@l2js/core";
import UObject from "./un-object";

export abstract class UPlatte extends UObject {
    public colors: FArray<FColor>
    // public readonly skipRemaining = true;

    public doLoad(pkg: APackage, exp: UExport) {
        super.doLoad(pkg, exp);

        this.colors = new FArray(FColor.class()).load(pkg);

        console.assert(this.colors.getElemCount() === 256);
    }
}

export default UPlatte;
