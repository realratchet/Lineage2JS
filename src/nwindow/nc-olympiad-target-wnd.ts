import NWnd from "./nwnd";
import NCFrameCtrl from "./nc-frame-ctrl";
import type NWindowCanvas from "./nwindow-canvas";
import type { OlympiadUserInfo_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.SmallWnd.SmallWindow_Back";
const TEX_STRIP = "L2UI_CH3.FrameCtrl.smallbar";
const TEX_CP = "L2UI_CH3.SmallWnd.CpBar";
const TEX_HP = "L2UI_CH3.SmallWnd.HpBar";
const TEX_CP_BACK = "L2UI_CH3.SmallWnd.CpBar_back";
const TEX_HP_BACK = "L2UI_CH3.SmallWnd.HpBar_back";

export class NCOlympiadTargetWnd extends NWnd {
    protected info: OlympiadUserInfo_T = null;
    protected side = 0;

    public constructor() {
        super(0, 0, 172, 46);

        this.addChild(new NCFrameCtrl(0, 0, 12, 46));
        this.isVisible = false;
    }

    public getTextures(): string[] { return [1, 2, 3].flatMap(index => [TEX_BACK + index, TEX_STRIP + index]).concat([TEX_CP, TEX_HP, TEX_CP_BACK, TEX_HP_BACK]); }
    public placeOnScreen(width: number, height: number) { this.x = Math.trunc(width * 0.5 - 86); this.y = Math.trunc(height * 0.5 - 23); }
    public initialize(side: number) { this.side = side; }
    public getSide() { return this.side; }
    public getInfo() { return this.info; }
    public setInfo(info: OlympiadUserInfo_T) { this.info = info; this.invalidate(); }
    public reset() { this.info = null; this.side = 0; this.invalidate(); }

    public onPaint(canvas: NWindowCanvas) {
        canvas.drawTile(12, 0, 16, 46, 0, 0, 16, 46, TEX_BACK + "1");
        canvas.drawTile(28, 0, this.width - 44, 46, 0, 0, 16, 46, TEX_BACK + "2");
        canvas.drawTile(this.width - 16, 0, 16, 46, 0, 0, 16, 46, TEX_BACK + "3");
        canvas.drawTile(0, 0, 12, 8, 0, 0, 12, 8, TEX_STRIP + "1");
        canvas.drawTile(0, 8, 12, 38, 0, 0, 12, 8, TEX_STRIP + "2");
        canvas.drawTile(0, 38, 12, 8, 0, 0, 12, 8, TEX_STRIP + "3");
        canvas.drawTile(16, 26, 150, 6, 0, 0, 8, 6, TEX_CP_BACK);
        canvas.drawTile(16, 33, 150, 6, 0, 0, 8, 6, TEX_HP_BACK);

        if (!this.info) return;

        const info = this.info;

        if (info.maxCp) canvas.drawTile(16, 26, Math.trunc(Math.imul(info.curCp, 150) / info.maxCp), 6, 0, 0, 8, 6, TEX_CP);
        if (info.maxHp) canvas.drawTile(16, 33, Math.trunc(Math.imul(info.curHp, 150) / info.maxHp), 6, 0, 0, 8, 6, TEX_HP);

        canvas.drawText(25, 6, 0xffdcdcdc, info.name);
    }
}

export default NCOlympiadTargetWnd;
