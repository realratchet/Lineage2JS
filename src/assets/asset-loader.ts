import AssetBuffer from "./asset-buffer";
import UTerrainSector from "./unreal/un-terrain";
import UTerrainInfo from "./unreal/un-terrain-info";

class AssetLoader {
    async load(path: string): Promise<any> {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = new AssetBuffer(arrayBuffer);

        const decoded = await buffer.decode();
        const expTerrainSector = decoded.exports.find(e => e.name.includes("TerrainInfo"));
        const terrain = UTerrainInfo.fromAsset(buffer, expTerrainSector);

        debugger;
        return null;
    }
}

export default AssetLoader;
export { AssetLoader };