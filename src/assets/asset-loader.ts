import AssetBuffer from "./asset-buffer";
import UTerrainSector from "./unreal/un-terrain";

class AssetLoader {
    async load(path: string): Promise<any> {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = new AssetBuffer(arrayBuffer);

        const decoded = await buffer.decode();
        const expTerrainSector = decoded.exports.filter(e => e.name.includes("TerrainSector"));

        const terrain = UTerrainSector.fromAsset(buffer, expTerrainSector[0]);

        debugger;
        return null;
    }
}

export default AssetLoader;
export { AssetLoader };