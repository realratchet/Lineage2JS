import GameManager from "../game/game-manager";
import AudioManager from "../audio/audio-manager";
import PhysicsManager from "../physics/physics-manager";
import SkillViewerAssetManager from "./skill-viewer-asset-manager";
import SkillViewerRenderManager from "./skill-viewer-render-manager";
import SkillViewerFloor from "./skill-viewer-floor";
import SkillViewerStage from "./skill-viewer-npc";
import PlayerSkillViewerStage from "./skill-viewer-player";
import SkillViewerUI from "./skill-viewer-ui";
import { ZUpOrbitControls } from "../rendering/camera/controllers/zup-orbit-controls";
import type { AssetList_T } from "../assets/asset-manager";
import type { HTMLViewportElement_T } from "../rendering/render-manager";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";

const FLOOR_SIZE = 20000;

export class SkillViewerGame extends GameManager {
    public onFrameError: (error: Error) => void = null;

    public static async initialize(viewport: HTMLViewportElement_T, assets: AssetList_T, loadSettings: LoadSettings_T, characterPoolSize?: number): Promise<SkillViewerGame> {
        const game = new SkillViewerGame();

        game.manAsset = new SkillViewerAssetManager(loadSettings, assets, characterPoolSize);
        game.manRender = new SkillViewerRenderManager(viewport);
        game.manAudio = new AudioManager();
        game.manPhysics = new PhysicsManager();

        game.attach(game.manPhysics);
        game.attach(game.manRender);
        game.attach(game.manAudio);
        game.attach(game.manAsset);

        return await game.onInit();
    }

    protected onHandleAnimationFrame(currentTime: number): void {
        const deltaTime = currentTime - this.lastTick;

        // one broken skill must not freeze the viewer, report it and keep ticking
        try {
            this.onBeforeEngineTick(currentTime, deltaTime);
            this.onEngineTick(currentTime, deltaTime);
            this.onAfterEngineTick(currentTime, deltaTime);
        } catch (e) {
            console.error(e);
            if (this.onFrameError) this.onFrameError(e as Error);
        }

        this.lastTick = currentTime;

        requestAnimationFrame(this.animationFrameCallback);
    }
}

export async function runSkillViewer(isPlayer: boolean = false): Promise<void> {
    const loadSettings: LoadSettings_T = { textures: "auto", cache: { enabled: true, version: 62 }, decodeWorkerPoolSize: isPlayer ? 1 : 3, loadExtendedBoneInfluences: true, loadEmitters: true, loadAudio: true };

    const viewport = document.querySelector("viewport") as HTMLViewportElement_T;

    viewport.classList.add("skill-viewer-viewport");

    const assetList = await (await fetch("asset-list.json")).json();
    const game = await SkillViewerGame.initialize(viewport, assetList, loadSettings, isPlayer ? 0 : undefined);
    const renderManager = game.getComponent("render"), assetManager = game.getComponent("asset");
    const controls = new ZUpOrbitControls(renderManager.camera, renderManager.renderer.domElement);
    const stage = isPlayer ? new PlayerSkillViewerStage(renderManager, assetManager) : new SkillViewerStage(renderManager, assetManager);
    const ui = new SkillViewerUI(stage, controls);

    (global as any).renderManager = renderManager;
    (global as any).skillViewer = { game, stage, ui, controls };

    renderManager.scene.add(new SkillViewerFloor(FLOOR_SIZE));
    renderManager.camera.position.set(0, 900, 450);
    controls.target.set(0, 0, 50);
    controls.update();

    game.onFrameError = error => {
        stage.stop();
        ui.log(`frame error, attacks stopped: ${error.message}`, true);
    };

    game.startTicking(performance.now());

    await ui.init();
}

export default runSkillViewer;
