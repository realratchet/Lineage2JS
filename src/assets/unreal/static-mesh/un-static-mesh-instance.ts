import UObject from "../un-object";

type UPackage = import("../un-package").UPackage;
type UExport = import("../un-export").UExport;

class UStaticMeshIsntance extends UObject { 

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        await super.load(pkg, exp);

        return this;
    }

}

export default UStaticMeshIsntance;