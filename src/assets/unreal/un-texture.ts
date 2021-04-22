import UObject from "./un-object";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UTexture extends UObject {
    public async load(pkg: UPackage, exp: UExport): Promise<this> {

        return this;
    }
}

export default UTexture;
export { UTexture };