import UPackage from "./un-package";
import UObject from "./un-object";

type UExport = import("./un-export").UExport;

class UTerrainSector extends UObject {
    static fromAsset(buffer: UPackage, data: UExport) {
        throw new Error("Method not implemented.");
    }

}

export default UTerrainSector;
export { UTerrainSector };