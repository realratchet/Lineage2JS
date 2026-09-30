import AssetManager from "../assets/asset-manager";
import SkillViewerDecodeWorkerClient from "./skill-viewer-decode-worker-client";
import type RenderManager from "../rendering/render-manager";
import type { INpcDefinition } from "@l2js/engine/contracts/pawn";

const CHARACTER_POOL_SIZE = 20;

export class SkillViewerAssetManager extends AssetManager {
    declare protected decodeWorker: SkillViewerDecodeWorkerClient;

    public async onInit(): Promise<this> {
        const manRender = this.getParent().getComponent("render");
        const textureMode = (this.loadSettings as any).textures ?? "auto";

        this.glCapabilities = manRender.renderer.capabilities;
        this.hasS3TC = manRender.renderer.extensions.get("WEBGL_compressed_texture_s3tc");
        this.preferCompressedTextures = textureMode === "compressed" || (textureMode === "auto" && this.hasS3TC);

        (this.loadSettings as any).rgbaTextures = !this.preferCompressedTextures;

        this.decodeWorker = new SkillViewerDecodeWorkerClient(this.decodeWorkerPoolSize);
        await this.decodeWorker.ready;
        this.isWorkerReady = true;

        const [clientConfig, charGroups] = await Promise.all([this.decodeWorker.getClientConfig(), this.decodeWorker.getCharGroups()]);

        this.userConfig = clientConfig.userConfig;
        this.warriorAnimations = clientConfig.warriorAnimations;
        this.charGroups = charGroups;

        this.decodeWorker.preloadCharacters(this.loadSettings, CHARACTER_POOL_SIZE);

        return this;
    }

    public preloadNpcs(npcs: readonly INpcDefinition[]): void { this.decodeWorker.preloadNpcs(this.loadSettings, npcs); }
    public setEnterEventEnabled(enabled: boolean): void { this.decodeWorker.setEnterEventEnabled(enabled); }

    public releaseUsedLibraries(renderManager: RenderManager): void {
        for (const library of this.decodeWorker.takeUsedLibraries())
            for (const sound of library.soundBlobCache.values()) {
                if (!sound.uri) continue;

                renderManager.audioManager.releaseSound(sound.uri);
            }
    }

    public async tick(_renderManager: RenderManager) { }
}

export default SkillViewerAssetManager;
