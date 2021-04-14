import AssetBuffer from "../asset-buffer";

type UExport = import("./un-export").UExport;

class UTerrainSector {
    static fromAsset(buffer: AssetBuffer, data: UExport) {
        throw new Error("Method not implemented.");
    }

}

export default UTerrainSector;
export { UTerrainSector };