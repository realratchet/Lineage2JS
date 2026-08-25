import AssetManager, { AssetList_T } from "@client/assets/asset-manager";
import AudioManager from "@client/audio/audio-manager";
import { IEngineComponent } from "@client/game/components";
import PhysicsManager from "@client/physics/physics-manager";
import RenderManager from "@client/rendering/render-manager";

class GameManager implements IEngineComponent<GameManager> {
    protected manAsset: AssetManager;
    protected manRender: RenderManager;
    protected manAudio: AudioManager;
    protected manPhysics: PhysicsManager;

    protected components: IEngineComponent<any>[] = [];

    protected lastTick: number = 0;

    protected constructor() {

    }

    public static async initialize(viewport: HTMLViewportElement, assets: AssetList_T, loadSettings: GD.LoadSettings_T): Promise<GameManager> {
        const game = new GameManager();

        game.manAsset = game.attach(new AssetManager(loadSettings, assets));
        game.manRender = game.attach(new RenderManager(viewport));
        game.manAudio = game.attach(new AudioManager());
        game.manPhysics = game.attach(new PhysicsManager());

        return game.startTicking();
    }

    protected startTicking(): this {
        // ladies and gentlement, start your engines
        this.onHandleAnimationFrame(this.lastTick = performance.now());

        return this;
    }

    protected attach<T extends IEngineComponent<any>>(comp: T): T {
        this.components.push(comp.setParent(this));
        return comp;
    }

    public getComponent(component: "asset"): AssetManager;
    public getComponent(component: "render"): RenderManager;
    public getComponent(component: "audio"): AudioManager;
    public getComponent(component: "physics"): PhysicsManager;
    public getComponent(component: unknown): unknown {
        switch (component) {
            case "asset": return this.manAsset;
            case "render": return this.manRender;
            case "audio": return this.manAudio;
            case "physics": return this.manPhysics;
            default: throw new Error(`Unknown component: ${component}`);
        }
    }

    public setParent(_parent: GameManager): this { return this; } // this is the root
    public getParent() { return this; }

    public onBeforeEngineTick(currentTime: number, deltaTime: number): void { for (const comp of this.components) comp.onBeforeEngineTick?.(currentTime, deltaTime); }
    public onEngineTick(currentTime: number, deltaTime: number): void { for (const comp of this.components) comp.onEngineTick?.(currentTime, deltaTime); }
    public onAfterEngineTick(currentTime: number, deltaTime: number): void { for (const comp of this.components) comp.onAfterEngineTick?.(currentTime, deltaTime); }

    protected onHandleAnimationFrame(currentTime: number) {
        const deltaTime = currentTime - this.lastTick;

        this.onBeforeEngineTick(currentTime, deltaTime);
        this.onEngineTick(currentTime, deltaTime);
        this.onAfterEngineTick(currentTime, deltaTime);

        this.lastTick = currentTime;

        requestAnimationFrame(this.onHandleAnimationFrame.bind(this)); return this;
    }
}

export default GameManager;
export { GameManager };