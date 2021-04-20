import UPackage from "./un-package";

type UExport = import("./un-export").UExport;

class UTerrainSector {
    static fromAsset(buffer: UPackage, data: UExport) {
        buffer.seek(0, 0);
        buffer.dump(Infinity);
        buffer.seek(data.offset.value as number, 0);
        buffer.dump(32);
        throw new Error("Method not implemented.");
    }

}

export default UTerrainSector;
export { UTerrainSector };