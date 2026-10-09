import NDomLayer from "./ndom";
import { DigitFont_T, FontType_T } from "./nwindow-canvas";

const TEX_BACK = "L2UI_CH3.FishingWnd.fishing_back";
const TEX_CLOCK = "L2UI_CH3.FishingWnd.fishing_clockicon";
const TEX_BAR = "L2UI_CH3.FishingWnd.fishing_bar1";
const TEX_BAR_BACK = "L2UI_CH3.FishingWnd.fishing_bar2";
const TEX_EFFECT = "L2UI_CH3.FishingWnd.fishing_effect";
const TEX_HINT = ["Icon.skill_i.skill1313", "Icon.skill_i.skill1314"];
const TEX_FRAME = ["FrameBackLeft", "FrameBackMid", "FrameBackRight"].map(name => `L2UI_CH3.FrameCtrl.${name}`);

type MessageFormatter_T = (id: number, ...params: string[]) => string;

export class NCFishViewportWnd {
    public static getTextures() { return [TEX_BACK, TEX_CLOCK, TEX_BAR, TEX_BAR_BACK, TEX_EFFECT, ...TEX_HINT, ...TEX_FRAME]; }
    public readonly element: HTMLDivElement;
    protected readonly viewport: HTMLCanvasElement;
    protected readonly hud: HTMLCanvasElement;
    protected maxHp = 0;
    protected hp = 0;
    protected maxTime = 0;
    protected time = 0;
    protected hasCombatUI = false;
    protected effectAlpha = 0;
    protected effectActive = false;
    protected effectTime = 0;
    protected endDelay = 0;
    protected message = "";
    protected delta = 0;
    protected messageFade = 0;
    protected redMessage = false;
    protected hintsEnabled = false;
    protected hintPhase = 0;
    protected lureType = 0;
    protected mode = 0;

    public constructor(protected readonly layer: NDomLayer, protected readonly formatSystemMessage: MessageFormatter_T) {
        this.element = layer.createWindow(100, 100, 256, 276);
        this.element.hidden = true;
        this.element.style.overflow = "hidden";
        this.element.setAttribute("role", "dialog");
        this.element.setAttribute("aria-label", layer.getManager().getSysString(1112));
        layer.tile(this.element, 0, 20, 256, 256, 0, 0, 256, 256, TEX_BACK);

        this.viewport = document.createElement("canvas");
        this.viewport.width = 252;
        this.viewport.height = 254;
        this.viewport.className = "ndom-absolute";
        this.viewport.style.pointerEvents = "none";
        layer.place(this.viewport, 2, 20, 252, 254);
        this.element.appendChild(this.viewport);
        this.hud = document.createElement("canvas");
        this.hud.className = "ndom-absolute";
        this.hud.style.pointerEvents = "none";
        layer.place(this.hud, 0, 0, 256, 276);
        this.element.appendChild(this.hud);

        const frame = layer.createWindow(0, 0, 256, 20, this.element);
        layer.tile(frame, 0, 0, 16, 20, 0, 0, 16, 20, TEX_FRAME[0]);
        layer.tile(frame, 16, 0, 224, 20, 0, 0, 32, 20, TEX_FRAME[1]);
        layer.tile(frame, 240, 0, 16, 20, 0, 0, 16, 20, TEX_FRAME[2]);
        const height = layer.getManager().canvas.getLineHeight(FontType_T.SMALL);
        layer.text(frame, layer.getManager().getSysString(1112), 0xffc8d2dc, FontType_T.SMALL, 20, Math.trunc(10 - height / 2 + 2));
        frame.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            layer.dragWindow(this.element, event);
        });
    }

    public getViewportCanvas() { return this.viewport; }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }
    public placeOnScreen(width: number, height: number) {}

    public reset() {
        this.maxHp = this.hp = this.maxTime = this.time = 0;
        this.hasCombatUI = this.effectActive = this.redMessage = this.hintsEnabled = false;
        this.effectAlpha = this.effectTime = this.endDelay = this.delta = this.messageFade = this.hintPhase = this.lureType = this.mode = 0;
        this.message = "";
        this.paint();
    }

    public start() { this.reset(); this.setVisible(true); }

    public init(maxHp: number, time: number, lureType: number) {
        this.maxHp = this.hp = maxHp;
        this.maxTime = this.time = time;
        this.lureType = lureType;
        this.mode = this.hintPhase = this.delta = this.messageFade = 0;
        this.hasCombatUI = this.hintsEnabled = this.redMessage = false;
        this.message = "";
        this.paint();
    }

    protected setMessage(id: number, delta: number, penalty = 0) {
        this.message = penalty > 0 ? this.formatSystemMessage(id, String(penalty)) : this.layer.getManager().getSysString(id);
        this.delta = delta;
        this.redMessage = penalty > 0 || delta > 0;
        this.messageFade = 2;
    }

    protected startEffect() { this.effectActive = true; this.effectAlpha = 255; this.effectTime = 0; }

    public update(hp: number, time: number, goodUse: number | boolean, mode: number, animation: number, penalty: number) {
        const delta = (hp - this.hp) | 0;

        if (mode !== this.mode) { this.mode = mode; this.hintPhase = 0; }
        if (animation !== 4) { this.hp = hp; this.time = time; }
        if (!this.hasCombatUI && ((this.maxTime - this.time) | 0) === 3) {
            this.hasCombatUI = true;
            if (this.lureType === 0) this.hintsEnabled = true;
        }
        if (animation === 3) this.setMessage(1261, 0);
        else if (animation === 4) { this.hintsEnabled = false; this.setMessage(1264, 0); }
        if (this.hasCombatUI) {
            if (goodUse) this.startEffect();
            if (animation === 1 || animation === 2) {
                if (delta < 0) this.setMessage(penalty > 0 ? animation === 1 ? 1672 : 1671 : animation === 1 ? 1256 : 1257, delta, penalty);
                else this.setMessage(animation === 1 ? 1258 : 1259, delta);
            }
        }
        this.paint();
    }

    public end(isWin: boolean) {
        if (!isWin) { this.setVisible(false); return; }

        this.endDelay = 2;
        if (this.hasCombatUI) this.startEffect();
        this.update(0, 0, 0, 0, 4, 0);
    }

    public tick(deltaSeconds: number) {
        const dt = Math.fround(deltaSeconds);

        if (this.effectActive) {
            const t = this.effectTime = Math.fround(this.effectTime + dt);

            if (t <= Math.fround(.04)) this.effectAlpha = 255;
            else if (t <= Math.fround(.08)) this.effectAlpha = 0;
            else if (t <= Math.fround(.095)) this.effectAlpha = Math.trunc(255 - (t - Math.fround(.05)) * 10000);
            else if (t <= Math.fround(.2)) this.effectAlpha = Math.trunc(105 - (t - Math.fround(.08)) * 500);
            else { this.effectActive = false; this.effectTime = this.effectAlpha = 0; }
        }
        if (this.hintsEnabled) this.hintPhase = Math.fround(this.hintPhase + dt);
        if (this.messageFade > 0) this.messageFade = Math.max(0, Math.fround(this.messageFade - dt));
        if (this.endDelay > 0) {
            this.endDelay = Math.fround(this.endDelay - dt);
            if (this.endDelay <= 0) this.setVisible(false);
        }
        if (this.isVisible()) this.paint();
    }

    protected paintTile(context: CanvasRenderingContext2D, path: string, x: number, y: number, width: number, height: number, sourceWidth: number, sourceHeight: number, alpha = 255) {
        const texture = this.layer.getManager().canvas.getTexture(path);

        if (!texture || width <= 0 || height <= 0) return;

        context.globalAlpha = (alpha & 255) / 255;
        context.drawImage(texture, 0, 0, sourceWidth, sourceHeight, x, y, width, height);
        context.globalAlpha = 1;
    }

    protected paint() {
        const canvas = this.layer.getManager().canvas, scale = canvas.scale;
        const width = Math.round(256 * scale), height = Math.round(276 * scale);

        if (this.hud.width !== width || this.hud.height !== height) { this.hud.width = width; this.hud.height = height; }
        const context = this.hud.getContext("2d");
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.clearRect(0, 0, 256, 276);
        context.imageSmoothingEnabled = false;
        const alpha = this.messageFade >= 1 ? 255 : Math.trunc(this.messageFade * 255);
        canvas.renderText(context, 13, 256, (alpha << 24) | (this.redMessage ? 0xff0000 : 0xdcdcdc), this.message);
        if (this.delta) canvas.renderText(context, 242 - canvas.measureText(String(this.delta)), 256, (alpha << 24) | (this.delta > 0 ? 0xff0000 : 0xdcdcdc), String(this.delta));
        if (this.hasCombatUI) {
            this.paintTile(context, TEX_CLOCK, 110, 215, 12, 16, 12, 16);
            canvas.renderDigits(context, 125, 216, 0xffdcdcdc, String(this.time), DigitFont_T.LARGE);
            if (this.maxHp !== 0) {
                const filled = Math.trunc(Math.imul(this.hp, 115) / this.maxHp);
                this.paintTile(context, TEX_BAR, 13, 236, filled, 11, 8, 11);
                this.paintTile(context, TEX_BAR_BACK, 13 + filled, 236, 230 - filled, 11, 8, 11);
            }
            if (this.effectActive) this.paintTile(context, TEX_EFFECT, -22, 221, 297, 41, 297, 41, this.effectAlpha);
        }
        const phase = this.hintPhase;
        if (this.hintsEnabled && (phase >= 0 && phase < Math.fround(.1) || phase >= Math.fround(.2) && phase < Math.fround(.3) || phase >= Math.fround(.4))) {
            this.paintTile(context, TEX_HINT[this.mode === 0 ? 0 : 1], 13, 33, 32, 32, 32, 32);
            canvas.renderWrappedText(context, 53, 33, 0xffe7dcb6, this.layer.getManager().getSystemMessage(this.mode === 0 ? 1665 : 1664), 193);
        }
    }
}

export default NCFishViewportWnd;
