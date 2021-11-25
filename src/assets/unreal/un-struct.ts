import UObject from "./un-object";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UStruct extends UObject {
    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        super.load(pkg, exp);

        debugger;

        return this;
    }
}

export default UStruct;
export { UStruct };