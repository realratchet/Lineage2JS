import UObject from "./un-object";
import FArray from "./un-array";
import { FColor } from "./un-color";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UPlatte extends UObject {
    protected colors: FArray<FColor> = new FArray(FColor);

    public async load(pkg: UPackage, exp: UExport) {
        await super.load(pkg, exp);
        await this.colors.load(pkg, null);

        console.assert(this.colors.getElemCount() === 256);

        this.colors.getElem(0).a = 0;

        return this;
    }
}

export default UPlatte;
export { UPlatte };