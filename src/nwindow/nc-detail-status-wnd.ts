import type NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import { EXPERIENCE_TABLE } from "./nc-lobby-wnd";
import type { UserInfo_T, ClanInfo_T, HennaStatus_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.PlayerStatusWnd.myinfo_back";
const TEX_HP = "L2UI_CH3.PlayerStatusWnd.ps_hpbar";
const TEX_MP = "L2UI_CH3.PlayerStatusWnd.ps_mpbar";
const TEX_CP = "L2UI_CH3.PlayerStatusWnd.ps_cpbar";
const TEX_EXP = "L2UI_CH3.PlayerStatusWnd.ps_expbar";
const arrWeight = [1, 2, 3, 4, 5].map(index => `L2UI_CH3.PlayerStatusWnd.ps_weightBar${index}`);
const TEX_HERO = "L2UI_CH3.PlayerStatusWnd.myinfo_heroicon";
const TEX_NOBLE = "L2UI_CH3.PlayerStatusWnd.myinfo_nobleicon";
const VALUE_COLOR = 0xffb09b79;
const arrLabels = [[430, 15, 25], [88, 15, 46], [93, 22, 110], [94, 16, 132], [95, 16, 147], [96, 16, 162], [113, 16, 177], [111, 16, 192], [103, 22, 214], [98, 137, 132], [99, 137, 148], [97, 137, 163], [432, 137, 178], [112, 137, 193], [104, 16, 236], [105, 96, 236], [106, 177, 236], [107, 16, 252], [108, 96, 252], [109, 177, 252], [100, 22, 273], [101, 16, 294], [102, 137, 294], [709, 16, 310], [710, 137, 310]];

export class NCDetailStatusWnd { // C4 NWindow RVA 0x110c90 (paint), 0x10def0 (textures).
    public static getTextures() { return [TEX_BACK, TEX_HP, TEX_MP, TEX_CP, TEX_EXP, TEX_HERO, TEX_NOBLE, ...arrWeight, "L2UI.NWindow.Number"]; }
    public readonly element: HTMLDivElement;
    protected readonly values: HTMLDivElement;
    protected readonly bars: HTMLDivElement[];
    protected readonly rank: HTMLDivElement;
    protected status: UserInfo_T = null;
    protected clan: ClanInfo_T = null;
    protected henna: HennaStatus_T = null;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement) {
        this.element = layer.createWindow(0, 66, 256, 335, parent);
        layer.tile(this.element, 0, 0, 256, 335, 0, 0, 256, 335, TEX_BACK);
        for (const [id, x, y] of arrLabels) layer.text(this.element, layer.getManager().getSysString(id), [93, 103, 100].includes(id) ? 0xffdcdcdc : 0xffa3a3a3, FontType_T.SMALL, x, y);

        this.bars = [[35, 59, TEX_HP], [35, 73, TEX_MP], [156, 59, TEX_CP], [35, 87, TEX_EXP], [156, 73, arrWeight[0]]].map(([x, y, texture]) => layer.tile(this.element, x as number, y as number, 85, 12, 0, 0, 8, 12, texture as string));
        this.rank = layer.tile(this.element, 192, 40, 13, 15, 0, 0, 13, 15, TEX_HERO);
        this.rank.hidden = true;
        this.bars.forEach(bar => bar.hidden = true);
        this.values = layer.createWindow(0, 0, 256, 335, this.element);
        this.values.style.pointerEvents = "none";
    }

    public setStatus(status: UserInfo_T) { this.status = status; this.paint(); }
    public setClan(clan: ClanInfo_T) { this.clan = clan; this.paint(); }
    public setHenna(henna: HennaStatus_T) { this.henna = henna; this.paint(); }

    protected drawText(x: number, y: number, text: string, color: number = VALUE_COLOR, align: CanvasTextAlign = "left") {
        const width = this.layer.measureText(text);

        if (align === "right") x -= width;
        if (align === "center") x -= Math.trunc(width / 2);
        this.layer.text(this.values, text, color, FontType_T.SMALL, Math.trunc(x), Math.trunc(y));
    }

    protected paint() {
        const info = this.status;

        if (!info) return;

        const layer = this.layer;
        const levelStart = EXPERIENCE_TABLE[info.level], levelEnd = EXPERIENCE_TABLE[info.level + 1];

        if (levelEnd === undefined) throw new Error(`Level ${info.level} is outside the experience table.`);

        const exp = levelEnd ? (info.exp - levelStart) / (levelEnd - levelStart) : 0;
        const weight = info.maxLoad ? info.curLoad / info.maxLoad : 0;
        const weightWidth = info.maxLoad ? Math.trunc(info.curLoad * 85 / info.maxLoad) : 0;
        const weightPercent = weightWidth > 0 ? Math.fround(weight * 100) : 0;
        const weightIndex = weight * 100 <= 50 ? 0 : weightPercent <= 66.6 ? 1 : weightPercent <= 80 ? 2 : weightPercent <= 100 ? 3 : 4;
        const arrValues = [info.maxHp ? info.curHp / info.maxHp : 0, info.maxMp ? info.curMp / info.maxMp : 0, info.maxCp ? info.curCp / info.maxCp : 0, exp, weight];
        const arrTextures = [TEX_HP, TEX_MP, TEX_CP, TEX_EXP, arrWeight[weightIndex]];

        this.bars.forEach((bar, index) => {
            const width = index === 4 ? weightWidth : Math.trunc(arrValues[index] * 85);
            const height = (index === 4 ? weightPercent > 100 : index < 3 && width > 85) ? 10 : 12;
            const drawWidth = index === 4 ? width : Math.min(width, 85);

            bar.hidden = width <= 0;
            if (bar.hidden) return;

            bar.style.width = `${drawWidth}px`;
            bar.style.height = `${height}px`;
            layer.setTile(bar, drawWidth, height, 0, 0, index === 4 ? width : 8, 12, arrTextures[index]);
        });
        this.rank.hidden = !info.isHero && !info.isNoble;
        if (!this.rank.hidden) layer.setTile(this.rank, 13, 15, 0, 0, 13, 15, info.isHero ? TEX_HERO : TEX_NOBLE);

        this.values.replaceChildren();

        for (const [x, y, current, maximum] of [[77, 61, info.curHp, info.maxHp], [77, 75, info.curMp, info.maxMp], [198, 61, info.curCp, info.maxCp]]) {
            layer.digits(this.values, "/", 0xffdcdcdc, undefined, x - Math.trunc(layer.measureText("/") / 2), y);
            layer.digits(this.values, String(current), 0xffdcdcdc, undefined, x - 10 - layer.measureText(String(current)), y);
            layer.digits(this.values, String(maximum), 0xffdcdcdc, undefined, x + 6, y);
        }
        for (const [x, y, value] of [[77, 89, exp], [198, 75, weight]]) {
            const text = `${(y === 75 ? weightPercent : value * 100).toFixed(2)}%`;

            layer.digits(this.values, text, y === 89 ? 0xffb4b4b4 : 0xffdcdcdc, undefined, x - Math.trunc(layer.measureText(text) / 2), y);
        }
        this.drawText(198, 88, String(info.sp), VALUE_COLOR, "center");

        let title = info.title, name = info.name;

        if (title && layer.measureText(title) + layer.measureText(name) > 220) {
            if (layer.measureText(title) > 109) title = `${title.slice(0, 9)}..`;
            if (layer.measureText(name) > 109) name = `${name.slice(0, 9)}..`;
        }
        const karmaColor = info.karma > 0 ? Math.min(255, Math.max(info.karma, Math.trunc(info.karma / 16) + 100)) : 0;

        if (title) this.drawText(15, 9, title, 0xffa2f9ec);
        this.drawText(title ? layer.measureText(title) + 21 : 15, 9, name, (0xffff0000 | (255 - karmaColor) << 8 | (255 - karmaColor)) >>> 0);
        this.drawText(layer.measureText(layer.getManager().getSysString(430)) + 20, 25, this.clan && this.clan.clanId === info.clanId ? this.clan.name : layer.getManager().getSysString(431), 0xffdcdcdc);
        this.drawText(35, 46, `${info.level} ${layer.getManager().getClassName(info.classId)}`);

        [info.pAtk, info.pDef, info.accuracy, info.critical, info.atkSpd].forEach((value, index) => this.drawText(114, 132 + index * 15, String(value), VALUE_COLOR, "right"));
        [info.mAtk, info.mDef, info.evasion, Math.trunc((info.isRunning ? info.runSpd : info.walkSpd) * info.moveMultiplier), info.castSpd].forEach((value, index) => this.drawText(235, 132 + index * 15, String(value), VALUE_COLOR, "right"));
        [info.str, info.dex, info.con, info.int, info.wit, info.men].forEach((value, index) => {
            const modifier = this.henna ? this.henna.stats[[1, 4, 2, 0, 5, 3][index]] : 0;
            const text = modifier > 0 ? `${value} (+${modifier})` : modifier < 0 ? `${value}(${modifier})` : String(value);

            this.drawText([65, 148, 229][index % 3], index < 3 ? 236 : 252, text, VALUE_COLOR, "center");
        });
        this.drawText(114, 294, `${info.karma}${info.karma >= 999999 ? "+" : ""}`, VALUE_COLOR, "right");
        this.drawText(235, 294, `${info.pvpKills}/${info.pkKills}`, VALUE_COLOR, "right");
        this.drawText(114, 310, String(info.recommendations), VALUE_COLOR, "right");
        this.drawText(235, 310, String(info.recommendationsLeft), VALUE_COLOR, "right");
    }
}

export default NCDetailStatusWnd;
