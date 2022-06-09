import UObject from "./un-object";
import FArray from "./un-array";
import FColor from "./un-color";

class UPlatte extends UObject {
    public colors: FArray<FColor> = new FArray(FColor);
    public readonly skipRemaining = true;

    public doLoad(pkg: UPackage, exp: UExport) {
        super.doLoad(pkg, exp);

        this.colors.load(pkg, null);

        console.assert(this.colors.getElemCount() === 256);

        this.colors.getElem(0).a = 0;

        return this;
    }
}

export default UPlatte;
export { UPlatte };