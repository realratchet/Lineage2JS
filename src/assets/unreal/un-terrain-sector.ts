import UPackage from "./un-package";
import UObject from "./un-object";

type UExport = import("./un-export").UExport;

class UTerrainSector extends UObject {
    public async load(pkg: UPackage, exp: UExport) {
        // debugger;

        await super.load(pkg, exp);

        debugger;

        return this;
    }
}

export default UTerrainSector;
export { UTerrainSector };