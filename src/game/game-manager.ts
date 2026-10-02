import AssetManager, { AssetList_T } from "../assets/asset-manager";
import AudioManager from "../audio/audio-manager";
import { IEngineComponent } from "./components";
import PhysicsManager from "../physics/physics-manager";
import RenderManager, { type HTMLViewportElement_T } from "../rendering/render-manager";
import UIManager from "./ui-manager";
import InputManager from "./input-manager";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";

export class GameManager implements IEngineComponent<GameManager> {
    protected manAsset: AssetManager;
    protected manRender: RenderManager;
    protected manAudio: AudioManager;
    protected manPhysics: PhysicsManager;
    protected manUI: UIManager;
    protected manInput: InputManager;

    protected components: IEngineComponent<any>[] = [];

    protected lastTick: number = 0;
    protected readonly animationFrameCallback: FrameRequestCallback;

    protected constructor() {
        this.animationFrameCallback = this.onHandleAnimationFrame.bind(this);
    }

    public static async initialize(viewport: HTMLViewportElement_T, assets: AssetList_T, loadSettings: LoadSettings_T): Promise<GameManager> {
        const game = new GameManager();

        game.manAsset = new AssetManager(loadSettings, assets);
        game.manRender = new RenderManager(viewport);
        game.manAudio = new AudioManager();
        game.manPhysics = new PhysicsManager();
        game.manUI = new UIManager();
        game.manInput = new InputManager();

        game.attach(game.manPhysics);
        game.attach(game.manRender);
        game.attach(game.manInput);
        game.attach(game.manAudio);
        game.attach(game.manAsset);
        game.attach(game.manUI);

        return await game.onInit();
    }

    public async onInit(): Promise<this> {
        for (const comp of this.components)
            await comp.onInit?.();

        return this;
    }

    public startTicking(currentTime: number): void {
        this.lastTick = currentTime;

        for (const comp of this.components)
            comp.startTicking?.(this.lastTick);

        // ladies and gentlement, start your engines
        this.onHandleAnimationFrame(this.lastTick);
    }

    protected attach<T extends IEngineComponent<any>>(comp: T): T {
        this.components.push(comp.setParent(this));
        return comp;
    }

    public getComponent(component: "asset"): AssetManager;
    public getComponent(component: "render"): RenderManager;
    public getComponent(component: "audio"): AudioManager;
    public getComponent(component: "physics"): PhysicsManager;
    public getComponent(component: "ui"): UIManager;
    public getComponent(component: "input"): InputManager;
    public getComponent(component: unknown): unknown {
        switch (component) {
            case "asset": return this.manAsset;
            case "render": return this.manRender;
            case "audio": return this.manAudio;
            case "physics": return this.manPhysics;
            case "ui": return this.manUI;
            case "input": return this.manInput;
            default: throw new Error(`Unknown component: ${component}`);
        }
    }

    public setParent(_parent: GameManager): this { return this; } // this is the root
    public getParent() { return this; }

    public onBeforeEngineTick(currentTime: number, deltaTime: number): void { for (const comp of this.components) comp.onBeforeEngineTick?.(currentTime, deltaTime); }
    public onEngineTick(currentTime: number, deltaTime: number): void { for (const comp of this.components) comp.onEngineTick?.(currentTime, deltaTime); }
    public onAfterEngineTick(currentTime: number, deltaTime: number): void { for (const comp of this.components) comp.onAfterEngineTick?.(currentTime, deltaTime); }

    protected onHandleAnimationFrame(currentTime: number): void {
        const deltaTime = currentTime - this.lastTick;

        this.onBeforeEngineTick(currentTime, deltaTime);
        this.onEngineTick(currentTime, deltaTime);
        this.onAfterEngineTick(currentTime, deltaTime);

        this.lastTick = currentTime;

        requestAnimationFrame(this.animationFrameCallback);
    }
}

export default GameManager;
