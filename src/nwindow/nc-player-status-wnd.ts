import NCStatusWnd from "./nc-status-wnd";
import type NDomLayer from "./ndom";

const TEXT_COLOR = 0xffdcdcdc;
const LEVEL_COLOR = 0xffb09b79;
const TEX_BACK1 = "L2UI_CH3.SmallWnd.Smallwindow2_back1";
const TEX_BACK2 = "L2UI_CH3.SmallWnd.Smallwindow2_back2";
const TEX_SIZECONTROL1 = "L2UI_CH3.PlayerStatusWnd.ps_sizecontrol1";
const TEX_SIZECONTROL2 = "L2UI_CH3.PlayerStatusWnd.ps_sizecontrol2";
const TEX_LEVELBACK = "L2UI_CH3.PlayerStatusWnd.ps_levelback";
const TEX_CPBAR = "L2UI_CH3.PlayerStatusWnd.ps_cpbar";
const TEX_CPBAR_BACK = "L2UI_CH3.PlayerStatusWnd.ps_cpbar_back";
const TEX_HPBAR = "L2UI_CH3.PlayerStatusWnd.ps_hpbar";
const TEX_HPBAR_BACK = "L2UI_CH3.PlayerStatusWnd.ps_hpbar_back";
const TEX_HPBAR_WARN = "L2UI_CH3.PlayerStatusWnd.ps_hpbarwarn1";
const TEX_MPBAR = "L2UI_CH3.PlayerStatusWnd.ps_mpbar";
const TEX_MPBAR_BACK = "L2UI_CH3.PlayerStatusWnd.ps_mpbar_back";
const TEX_EXPBAR = "L2UI_CH3.PlayerStatusWnd.ps_expbar";
const TEX_EXPBAR_BACK = "L2UI_CH3.PlayerStatusWnd.ps_expbar_back";
const HEIGHT = 84;

const EXPERIENCE_TABLE = [0, 0, 68, 363, 1168, 2884, 6038, 11287, 19423, 31378, 48229, 71202, 101677, 141193, 191454, 254330, 331867, 426288, 540000, 675596, 835862, 1023784, 1242546, 1495543, 1786379, 2118876, 2497077, 2925250, 3407897, 3949754, 4555796, 5231246, 5981576, 6812513, 7730044, 8740422, 9850166, 11066072, 12395215, 13844951, 15422929, 17137087, 18995665, 21007203, 23180550, 25524868, 28049635, 30764654, 33680052, 36806289, 40154162, 45525133, 51262490, 57383988, 63907911, 70853089, 80700831, 91162654, 102265881, 114038596, 126509653, 146308200, 167244337, 189364894, 212717908, 237352644, 271975263, 308443198, 346827154, 387199547, 429634523, 474207979, 532694979, 606322775, 696381369, 804225364, 931275828, 1151275834, 1511275834, 2099275834]; // NWindow.dll 0x101cc91c: experience at the start of each level.

export type PlayerStatus_T = { name: string, level: number, exp: number, curHp: number, maxHp: number, curMp: number, maxMp: number, curCp: number, maxCp: number };

function barWidth(current: number, maximum: number, width: number) { return maximum ? Math.min(Math.trunc(current * width / maximum), width) : 0; }

export class NCPlayerStatusWnd extends NCStatusWnd { // NCPlayerStatusWnd: NCConsole 0x10060dae SetWindowRect(0, 0, 172, 84); paint 0x10113be0.
    public static getTextures(): string[] { return [...NCStatusWnd.getTextures(), TEX_BACK1, TEX_BACK2, TEX_SIZECONTROL1, TEX_SIZECONTROL2, TEX_LEVELBACK, TEX_CPBAR, TEX_CPBAR_BACK, TEX_HPBAR, TEX_HPBAR_BACK, TEX_HPBAR_WARN, TEX_MPBAR, TEX_MPBAR_BACK, TEX_EXPBAR, TEX_EXPBAR_BACK]; }

    protected readonly sizeControl2: HTMLDivElement;
    protected readonly arrBars: HTMLDivElement[];
    protected readonly values: HTMLDivElement;
    protected status: PlayerStatus_T = null;

    public onClick: (shift: boolean) => void = null;

    public constructor(layer: NDomLayer) {
        super(layer, "PlayerStatusWnd", 0, 0, HEIGHT);

        layer.tile(this.element, 16, 6, 22, 20, 0, 0, 22, 20, TEX_LEVELBACK);
        this.sizeControl2 = layer.tile(this.element, 0, 4, 9, 13, 0, 0, 9, 13, TEX_SIZECONTROL2);
        this.arrBars = [TEX_CPBAR_BACK, TEX_MPBAR_BACK, TEX_EXPBAR_BACK, TEX_CPBAR, TEX_MPBAR, TEX_EXPBAR, TEX_HPBAR_BACK, TEX_HPBAR, TEX_HPBAR_WARN].map(texture => layer.tile(this.element, 0, 0, 0, 12, 0, 0, 8, 12, texture));
        this.values = layer.createWindow(0, 0, 0, HEIGHT, this.element);
        this.values.style.pointerEvents = "none";
        this.createSizeCtrl();
        this.element.addEventListener("click", event => {
            if (event.button !== 0 || this.grip.contains(event.target as Node) || this.sizeCtrl.contains(event.target as Node)) return;
            if (this.onClick) this.onClick(event.shiftKey);
        });
        this.update();
    }

    public placeOnScreen() { this.restoreWidth(); }

    public setStatus(status: PlayerStatus_T) {
        this.status = status;
        this.update();
    }

    protected drawValueRow(y: number, barW: number, label: string, current: number, maximum: number) {
        const layer = this.layer, half = Math.trunc(barW / 2), text = String(current);

        layer.digits(this.values, label, TEXT_COLOR, undefined, 25, y);
        layer.digits(this.values, "/", TEXT_COLOR, undefined, 16 + half - Math.trunc(layer.getManager().canvas.measureDigits("/") / 2), y);
        layer.digits(this.values, text, TEXT_COLOR, undefined, 16 + half - layer.measureText(text) - 8, y); // digit strings are positioned with the regular-font extent 0x10012960, not the 8px cell width
        layer.digits(this.values, String(maximum), TEXT_COLOR, undefined, 16 + half + 4, y);
    }

    protected update() {
        const layer = this.layer, W = this.width, barW = W - 22, status = this.status;

        this.layoutFrame(HEIGHT, [TEX_BACK1, TEX_BACK2, TEX_SIZECONTROL1], 76, 4, 4);
        layer.place(this.sizeControl2, W - 5, 4);
        this.setName(status ? status.name : "", TEXT_COLOR, 40, 9, W - 50);
        this.values.style.width = `${W}px`;
        this.values.replaceChildren();

        if (!status) {
            for (const bar of this.arrBars) bar.hidden = true;
            return;
        }

        const levelStart = EXPERIENCE_TABLE[status.level], levelEnd = EXPERIENCE_TABLE[status.level + 1];
        const expW = levelEnd ? Math.min(Math.trunc((status.exp - levelStart) * barW / (levelEnd - levelStart)), barW) : 0;
        const hpW = status.curHp ? Math.trunc(status.curHp * barW / status.maxHp) : 0, isWarning = status.curHp < Math.trunc(status.maxHp / 10) * 3; // NCStatusBarCtrl 0x10112be0: warning below 30% of max, max/10 truncated first.
        const [cpBack, mpBack, expBack, cp, mp, exp, hpBack, hp, hpWarn] = this.arrBars;

        layer.placeTile(cpBack, 16, 27, barW, 12, 0, 0, 8, 12, TEX_CPBAR_BACK);
        layer.placeTile(mpBack, 16, 55, barW, 12, 0, 0, 8, 12, TEX_MPBAR_BACK);
        layer.placeTile(expBack, 16, 69, barW, 12, 0, 0, 8, 12, TEX_EXPBAR_BACK);
        layer.placeTile(cp, 16, 27, barWidth(status.curCp, status.maxCp, barW), 12, 0, 0, 8, 12, TEX_CPBAR);
        layer.placeTile(mp, 16, 55, barWidth(status.curMp, status.maxMp, barW), 12, 0, 0, 8, 12, TEX_MPBAR);
        layer.placeTile(exp, 16, 69, expW, 12, 0, 0, 8, 12, TEX_EXPBAR);
        layer.placeTile(hpBack, 16, 41, barW, 12, 0, 0, 8, 12, TEX_HPBAR_BACK); // NCStatusBarCtrl paint 0x10112c10
        layer.placeTile(hp, 16, 41, hpW, 12, 0, 0, 8, 12, TEX_HPBAR);
        layer.placeTile(hpWarn, 16, 41, isWarning ? hpW : 0, 12, 0, 0, 8, 12, TEX_HPBAR_WARN);

        if (levelEnd) {
            const percent = `${((status.exp - levelStart) * 100 / (levelEnd - levelStart)).toFixed(2)}%`;

            layer.digits(this.values, percent, TEXT_COLOR, undefined, Math.trunc(barW / 2) - Math.trunc(layer.measureText(percent) / 2) + 12, 71);
        }

        const level = String(status.level);

        if (status.level <= 9) layer.digits(this.values, level, LEVEL_COLOR, undefined, 27 - Math.trunc(layer.getManager().canvas.measureDigits(level) / 2), 12);
        else {
            layer.digits(this.values, level[0], LEVEL_COLOR, undefined, 20, 12);
            layer.digits(this.values, level[1], LEVEL_COLOR, undefined, 27, 12);
        }

        this.drawValueRow(29, barW, "CP", status.curCp, status.maxCp);
        this.drawValueRow(43, barW, "HP", status.curHp, status.maxHp);
        this.drawValueRow(57, barW, "MP", status.curMp, status.maxMp);
    }
}

export default NCPlayerStatusWnd;
