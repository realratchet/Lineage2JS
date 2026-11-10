import type AssetManager from "../assets/asset-manager";
import type RenderManager from "../rendering/render-manager";
import { setLoadingProgress, loadingTexts } from "../loading-progress";

export async function waitForAreaLoad(asset: AssetManager, render: RenderManager, isActive: () => boolean): Promise<void> {
    while (isActive()) {
        const progress = asset.getAreaLoadProgress(render, render.player.position);

        if (progress.ready === progress.total) return;

        const value = 0.85 * (progress.decoded + progress.built + progress.ready) / (3 * progress.total);

        setLoadingProgress(value || null, loadingTexts.areaParts(progress));
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

export default waitForAreaLoad;
