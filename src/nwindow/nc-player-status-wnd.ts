import NWnd from "./nwnd";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCNameCtrl from "./nc-name-ctrl";
import NCStatusBarCtrl from "./nc-status-bar-ctrl";
import type NWindowCanvas from "./nwindow-canvas";

const TEXT_COLOR = 0xffdcdcdc;
const LEVEL_COLOR = 0xffb09b79;
const TEX_BACK1 = "L2UI_CH3.SmallWnd.Smallwindow2_back1";
const TEX_BACK2 = "L2UI_CH3.SmallWnd.Smallwindow2_back2";
const TEX_SIZECONTROL1 = "L2UI_CH3.PlayerStatusWnd.ps_sizecontrol1";
const TEX_SIZECONTROL2 = "L2UI_CH3.PlayerStatusWnd.ps_sizecontrol2";
const TEX_LEVELBACK = "L2UI_CH3.PlayerStatusWnd.ps_levelback";
const TEX_CPBAR = "L2UI_CH3.PlayerStatusWnd.ps_cpbar";
const TEX_CPBAR_BACK = "L2UI_CH3.PlayerStatusWnd.ps_cpbar_back";
const TEX_MPBAR = "L2UI_CH3.PlayerStatusWnd.ps_mpbar";
const TEX_MPBAR_BACK = "L2UI_CH3.PlayerStatusWnd.ps_mpbar_back";
const TEX_EXPBAR = "L2UI_CH3.PlayerStatusWnd.ps_expbar";
const TEX_EXPBAR_BACK = "L2UI_CH3.PlayerStatusWnd.ps_expbar_back";

const EXPERIENCE_TABLE = [0, 0, 68, 363, 1168, 2884, 6038, 11287, 19423, 31378, 48229, 71202, 101677, 141193, 191454, 254330, 331867, 426288, 540000, 675596, 835862, 1023784, 1242546, 1495543, 1786379, 2118876, 2497077, 2925250, 3407897, 3949754, 4555796, 5231246, 5981576, 6812513, 7730044, 8740422, 9850166, 11066072, 12395215, 13844951, 15422929, 17137087, 18995665, 21007203, 23180550, 25524868, 28049635, 30764654, 33680052, 36806289, 40154162, 45525133, 51262490, 57383988, 63907911, 70853089, 80700831, 91162654, 102265881, 114038596, 126509653, 146308200, 167244337, 189364894, 212717908, 237352644, 271975263, 308443198, 346827154, 387199547, 429634523, 474207979, 532694979, 606322775, 696381369, 804225364, 931275828, 1151275834, 1511275834, 2099275834]; // NWindow.dll 0x101cc91c: experience at the start of each level.

export type PlayerStatus_T = { name: string, level: number, exp: number, curHp: number, maxHp: number, curMp: number, maxMp: number, curCp: number, maxCp: number };

function barWidth(current: number, maximum: number, width: number) { return maximum ? Math.min(Math.trunc(current * width / maximum), width) : 0; }

export class NCPlayerStatusWnd extends NWnd { // NCPlayerStatusWnd: NCConsole 0x10060dae SetWindowRect(0, 0, 172, 84); paint 0x10113be0.
    protected readonly hpBar: NCStatusBarCtrl;
    protected readonly nameCtrl: NCNameCtrl;
    protected status: PlayerStatus_T = null;

    public constructor() {
        super(0, 0, 172, 84);

        this.addChild(new NCFrameCtrl(0, 0, 12, 84));
        this.hpBar = this.addChild(new NCStatusBarCtrl(16, 41, 150, 12, "HP", "L2UI_CH3.PlayerStatusWnd.ps_hpbar", "L2UI_CH3.PlayerStatusWnd.ps_hpbar_back", "L2UI_CH3.PlayerStatusWnd.ps_hpbarwarn1", 8, 12));
        this.nameCtrl = this.addChild(new NCNameCtrl(40, 9, this.width - 50, 14));
    }

    public hitTest(x: number, y: number): NWnd {
        const hit = super.hitTest(x, y);

        return hit === this.hpBar || hit === this.nameCtrl ? this : hit;
    }

    public getTextures(): string[] { return [TEX_BACK1, TEX_BACK2, TEX_SIZECONTROL1, TEX_SIZECONTROL2, TEX_LEVELBACK, TEX_CPBAR, TEX_CPBAR_BACK, TEX_MPBAR, TEX_MPBAR_BACK, TEX_EXPBAR, TEX_EXPBAR_BACK]; }

    public setStatus(status: PlayerStatus_T) {
        this.status = status;
        this.hpBar.setValue(status.curHp, status.maxHp);
        this.nameCtrl.setText(status.name, TEXT_COLOR);
        this.invalidate();
    }

    protected drawValueRow(canvas: NWindowCanvas, y: number, barW: number, label: string, current: number, maximum: number) {
        const half = Math.trunc(barW / 2), text = String(current);

        canvas.drawDigits(25, y, TEXT_COLOR, label);
        canvas.drawDigits(half - Math.trunc(canvas.measureDigits("/") / 2) + 16, y, TEXT_COLOR, "/");
        canvas.drawDigits(half - canvas.measureText(text) + 8, y, TEXT_COLOR, text); // digit strings are positioned with the regular-font extent 0x10012960, not the 8px cell width
        canvas.drawDigits(half + 20, y, TEXT_COLOR, String(maximum));
    }

    public onPaint(canvas: NWindowCanvas) {
        const W = this.width, barW = W - 22;

        canvas.drawTile(12, 0, 16, 84, 0, 0, 16, 76, TEX_BACK1);
        canvas.drawTile(28, 0, W - 32, 84, 0, 0, 16, 76, TEX_BACK2);
        canvas.drawTile(W - 4, 0, 4, 84, 0, 0, 4, 76, TEX_SIZECONTROL1);
        canvas.drawTile(16, 6, 22, 20, 0, 0, 22, 20, TEX_LEVELBACK);
        canvas.drawTile(W - 5, 4, 9, 13, 0, 0, 9, 13, TEX_SIZECONTROL2);

        const status = this.status;

        if (!status) return;

        const levelStart = EXPERIENCE_TABLE[status.level], levelEnd = EXPERIENCE_TABLE[status.level + 1];
        const expW = levelEnd ? Math.min(Math.trunc((status.exp - levelStart) * barW / (levelEnd - levelStart)), barW) : 0;

        canvas.drawTile(16, 27, barW, 12, 0, 0, 8, 12, TEX_CPBAR_BACK);
        canvas.drawTile(16, 55, barW, 12, 0, 0, 8, 12, TEX_MPBAR_BACK);
        canvas.drawTile(16, 69, barW, 12, 0, 0, 8, 12, TEX_EXPBAR_BACK);
        canvas.drawTile(16, 27, barWidth(status.curCp, status.maxCp, barW), 12, 0, 0, 8, 12, TEX_CPBAR);
        canvas.drawTile(16, 55, barWidth(status.curMp, status.maxMp, barW), 12, 0, 0, 8, 12, TEX_MPBAR);
        canvas.drawTile(16, 69, expW, 12, 0, 0, 8, 12, TEX_EXPBAR);

        if (levelEnd) {
            const percent = `${((status.exp - levelStart) * 100 / (levelEnd - levelStart)).toFixed(2)}%`;

            canvas.drawDigits(Math.trunc(barW / 2) - Math.trunc(canvas.measureText(percent) / 2) + 12, 71, TEXT_COLOR, percent);
        }

        const level = String(status.level);

        if (status.level <= 9) canvas.drawDigits(27 - Math.trunc(canvas.measureDigits(level) / 2), 12, LEVEL_COLOR, level);
        else {
            canvas.drawDigits(20, 12, LEVEL_COLOR, level[0]);
            canvas.drawDigits(27, 12, LEVEL_COLOR, level[1]);
        }

        this.drawValueRow(canvas, 29, barW, "CP", status.curCp, status.maxCp);
        this.drawValueRow(canvas, 57, barW, "MP", status.curMp, status.maxMp);
    }
}

export default NCPlayerStatusWnd;
