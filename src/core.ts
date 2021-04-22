// import RenderManager from "./rendering/render-manager";
import AssetLoader from "./assets/asset-loader";
import assetList from "./assets/asset-list";
import UTerrainInfo from "./assets/unreal/un-terrain-info";

async function startCore() {
    const assetLoader = new AssetLoader(assetList);
    const pkg = assetLoader.getPackage("20_21");

    await assetLoader.load(pkg);

    const expTerrainSector = pkg.exports.find(e => e.objectName.includes("TerrainInfo"));
    const terrain = await new UTerrainInfo().load(pkg, expTerrainSector);

    // const viewport = document.querySelector("viewport") as HTMLViewportElement;
    // const renderManager = new RenderManager(viewport);
}

export default startCore;
export { startCore };