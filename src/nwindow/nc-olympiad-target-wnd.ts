import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";
import type { OlympiadUserInfo_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.SmallWnd.SmallWindow_Back";
const TEX_STRIP = "L2UI_CH3.FrameCtrl.smallbar";
const TEX_CP = "L2UI_CH3.SmallWnd.CpBar";
const TEX_HP = "L2UI_CH3.SmallWnd.HpBar";
const TEX_CP_BACK = "L2UI_CH3.SmallWnd.CpBar_back";
const TEX_HP_BACK = "L2UI_CH3.SmallWnd.HpBar_back";

export class NCOlympiadTargetWnd {
    public static getTextures(): string[] { return [1, 2, 3].flatMap(index => [TEX_BACK + index, TEX_STRIP + index]).concat([TEX_CP, TEX_HP, TEX_CP_BACK, TEX_HP_BACK]); }

    public readonly element: HTMLDivElement;
    protected readonly cpBar: HTMLDivElement;
    protected readonly hpBar: HTMLDivElement;
    protected readonly name: HTMLDivElement;
    protected info: OlympiadUserInfo_T = null;
    protected side = 0;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 0, 172, 46);
        this.element.hidden = true;
        layer.tile(this.element, 12, 0, 16, 46, 0, 0, 16, 46, TEX_BACK + "1");
        layer.tile(this.element, 28, 0, 172 - 44, 46, 0, 0, 16, 46, TEX_BACK + "2");
        layer.tile(this.element, 172 - 16, 0, 16, 46, 0, 0, 16, 46, TEX_BACK + "3");
        layer.tile(this.element, 0, 0, 12, 8, 0, 0, 12, 8, TEX_STRIP + "1");
        layer.tile(this.element, 0, 8, 12, 38, 0, 0, 12, 8, TEX_STRIP + "2");
        layer.tile(this.element, 0, 38, 12, 8, 0, 0, 12, 8, TEX_STRIP + "3");
        layer.tile(this.element, 16, 26, 150, 6, 0, 0, 8, 6, TEX_CP_BACK);
        layer.tile(this.element, 16, 33, 150, 6, 0, 0, 8, 6, TEX_HP_BACK);
        this.cpBar = layer.tile(this.element, 16, 26, 0, 6, 0, 0, 8, 6, TEX_CP);
        this.hpBar = layer.tile(this.element, 16, 33, 0, 6, 0, 0, 8, 6, TEX_HP);
        this.name = layer.text(this.element, "", 0xffdcdcdc, undefined, 25, 6);
        NCFrameCtrl.createGrip(layer, this.element, 0, 0, 12, 46);
        this.update();
    }

    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }
    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 86), Math.trunc(height * 0.5 - 23)); }
    public initialize(side: number) { this.side = side; }
    public getSide() { return this.side; }
    public getInfo() { return this.info; }
    public setInfo(info: OlympiadUserInfo_T) { this.info = info; this.update(); }
    public reset() { this.info = null; this.side = 0; this.update(); }

    protected update() {
        const info = this.info;

        this.layer.placeTile(this.cpBar, 16, 26, info && info.maxCp ? Math.trunc(Math.imul(info.curCp, 150) / info.maxCp) : 0, 6, 0, 0, 8, 6, TEX_CP);
        this.layer.placeTile(this.hpBar, 16, 33, info && info.maxHp ? Math.trunc(Math.imul(info.curHp, 150) / info.maxHp) : 0, 6, 0, 0, 8, 6, TEX_HP);
        this.layer.renderText(this.name, info ? info.name : "", 0xffdcdcdc);
    }
}

export default NCOlympiadTargetWnd;
