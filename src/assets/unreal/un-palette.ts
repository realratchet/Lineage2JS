import FColor from "@client/assets/unreal/un-color";
import UObject from "@l2js/core";
import FArray from "@l2js/core/src/unreal/un-array";

abstract class UPlatte extends UObject {
    public colors: FArray<GA.FColor>
    // public readonly skipRemaining = true;

    public doLoad(pkg: GA.UPackage, exp: C.UExport) {
        super.doLoad(pkg, exp);

        this.colors = new FArray(FColor.class()).load(pkg);

        console.assert(this.colors.getElemCount() === 256);
    }
}

export default UPlatte;
export { UPlatte };