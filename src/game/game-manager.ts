import AssetManager, { AssetList_T } from "../assets/asset-manager";
import AudioManager from "../audio/audio-manager";
import { IEngineComponent } from "./components";
import PhysicsManager from "../physics/physics-manager";
import RenderManager, { type HTMLViewportElement_T } from "../rendering/render-manager";
import UIManager from "./ui-manager";
import InputManager from "./input-manager";
import NetworkManager from "../network/network-manager";
import NConsoleWnd, { type GameGUI_T } from "../nwindow/nconsole-wnd";
import Skin from "../nwindow/skin";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";

export class GameManager implements IEngineComponent<GameManager> {
    protected manAsset: AssetManager;
    protected manRender: RenderManager;
    protected manAudio: AudioManager;
    protected manPhysics: PhysicsManager;
    protected manUI: UIManager;
    protected manInput: InputManager;
    protected manNetwork: NetworkManager;
    protected manGUI: GameGUI_T;

    protected components: IEngineComponent<any>[] = [];

    protected lastTick: number = 0;
    protected currentTime = 0;
    protected readonly animationFrameCallback: FrameRequestCallback;
    protected readonly visibilityCallback: () => void;
    protected animationFrameHandle = 0;
    protected backgroundWorker: Worker = null;

    protected constructor() {
        this.animationFrameCallback = this.onHandleAnimationFrame.bind(this);
        this.visibilityCallback = this.onVisibilityChange.bind(this);
    }

    public static async initialize(viewport: HTMLViewportElement_T, assets: AssetList_T, loadSettings: LoadSettings_T): Promise<GameManager> {
        const game = new GameManager();

        game.manAsset = new AssetManager(loadSettings, assets);
        game.manRender = new RenderManager(viewport);
        game.manAudio = game.manRender.audioManager;
        game.manPhysics = new PhysicsManager();
        game.manUI = new UIManager();
        game.manInput = new InputManager();
        game.manNetwork = new NetworkManager();
        game.manGUI = await game.createGUI();

        game.attach(game.manPhysics);
        game.attach(game.manRender);
        game.attach(game.manInput);
        game.attach(game.manAudio);
        game.attach(game.manAsset);
        game.attach(game.manUI);
        game.attach(game.manGUI);
        game.attach(game.manNetwork);

        return await game.onInit();
    }

    public async onInit(): Promise<this> {
        for (const comp of this.components)
            await comp.onInit?.();

        return this;
    }

    public startTicking(currentTime: number): void {
        this.currentTime = this.lastTick = currentTime;

        for (const comp of this.components)
            comp.startTicking?.(this.lastTick);

        // ladies and gentlement, start your engines
        this.tick(this.lastTick);
        document.addEventListener("visibilitychange", this.visibilityCallback);
        window.addEventListener("focus", this.visibilityCallback);
        window.addEventListener("blur", this.visibilityCallback);
        this.onVisibilityChange();
    }

    protected async createGUI(): Promise<GameGUI_T> {
        const skin = new Skin(), url = new URLSearchParams(location.search).get("skin");

        if (url) Object.assign(skin, (await import(/* webpackIgnore: true */ url)).default); // user skins duck-type their factory overrides onto the retail skin

        return new NConsoleWnd(skin);
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
    public getComponent(component: "network"): NetworkManager;
    public getComponent(component: "gui"): GameGUI_T;
    public getComponent(component: unknown): unknown {
        switch (component) {
            case "asset": return this.manAsset;
            case "render": return this.manRender;
            case "audio": return this.manAudio;
            case "physics": return this.manPhysics;
            case "ui": return this.manUI;
            case "input": return this.manInput;
            case "network": return this.manNetwork;
            case "gui": return this.manGUI;
            default: throw new Error(`Unknown component: ${component}`);
        }
    }

    public setParent(_parent: GameManager): this { return this; } // this is the root
    public getParent() { return this; }
    public getCurrentTime() { return this.currentTime; }

    public onBeforeEngineTick(currentTime: number, deltaTime: number): void { for (const comp of this.components) comp.onBeforeEngineTick?.(currentTime, deltaTime); }
    public onEngineTick(currentTime: number, deltaTime: number): void { for (const comp of this.components) comp.onEngineTick?.(currentTime, deltaTime); }
    public onAfterEngineTick(currentTime: number, deltaTime: number): void { for (const comp of this.components) comp.onAfterEngineTick?.(currentTime, deltaTime); }

    protected tick(currentTime: number): void {
        currentTime = Math.max(currentTime, this.lastTick);
        const deltaTime = this.manNetwork ? this.manNetwork.getReplayDeltaTime(currentTime - this.lastTick) : currentTime - this.lastTick;

        this.lastTick = currentTime;
        if (deltaTime === null) return;
        this.currentTime += deltaTime;

        this.onBeforeEngineTick(this.currentTime, deltaTime);
        this.onEngineTick(this.currentTime, deltaTime);
        this.onAfterEngineTick(this.currentTime, deltaTime);
    }

    protected onHandleAnimationFrame(currentTime: number): void {
        if (document.hidden || !document.hasFocus()) return;

        this.tick(currentTime);
        this.animationFrameHandle = requestAnimationFrame(this.animationFrameCallback);
    }

    protected onVisibilityChange(): void {
        cancelAnimationFrame(this.animationFrameHandle);
        if (this.backgroundWorker) {
            this.backgroundWorker.terminate();
            this.backgroundWorker = null;
        }

        if (document.hidden || !document.hasFocus()) {
            const url = URL.createObjectURL(new Blob(["setInterval(() => postMessage(0), 1000 / 30);"], { type: "text/javascript" }));
            const worker = this.backgroundWorker = new Worker(url);

            URL.revokeObjectURL(url);
            worker.onmessage = () => {
                if ((document.hidden || !document.hasFocus()) && this.backgroundWorker === worker) this.tick(performance.now());
            };
        } else this.animationFrameHandle = requestAnimationFrame(this.animationFrameCallback);
    }
}

export default GameManager;
