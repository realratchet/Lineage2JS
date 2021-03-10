import RenderManager from "./rendering/render-manager";
import AssetLoader from "./assets/asset-loader";

async function startCore() {
    const assetLoader = new AssetLoader();
    const mapData = await assetLoader.load("/assets/maps/20_20.unr");
    // const viewport = document.querySelector("viewport") as HTMLViewportElement;
    // const renderManager = new RenderManager(viewport);
}

export default startCore;
export { startCore };