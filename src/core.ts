// import RenderManager from "./rendering/render-manager";
import AssetLoader from "./assets/asset-loader";
import assetList from "./assets/asset-list";

async function startCore() {
    const assetLoader = new AssetLoader(assetList);
    const mapData = await assetLoader.load(assetLoader.getPackage("20_21"));
    // const viewport = document.querySelector("viewport") as HTMLViewportElement;
    // const renderManager = new RenderManager(viewport);
}

export default startCore;
export { startCore };