import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES, NDomScrollPane_T } from "./ndom";
import { EXPERIENCE_TABLE } from "./nc-lobby-wnd";
import { FontType_T } from "./nwindow-canvas";
import type { EnchantSkill_T, EnchantSkillInfo_T, AquireSkillEntry_T, AquireSkillInfo_T } from "../network/game-packets";

const TEX_LIST = "L2UI_CH3.SkillTrainWnd.SkillTrain1";
const TEX_AQUIRE_INFO = "L2UI_CH3.SkillTrainWnd.SkillTrain2";
const TEX_INFO = "L2UI_CH3.SkillTrainWnd.skillenchant_back";
const TEX_OUTLINE = "l2ui_ch3.InventoryWnd.Inventory_OutLine";
const TEX_OUTLINE_DOWN = "l2ui_ch3.InventoryWnd.Inventory_OutLine_down";
const TEX_SELECT = "L2UI_CH3.ListCtrl.TextSelect";
const TEX_SELECT_END = "L2UI_CH3.ListCtrl.TextSelect2";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_Normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_NormalOn";
const TEX_DEFAULT_ICON = "NWindow.BlackTexture";

type TrainStatus_T = { level: number, exp: number, sp: number };

export class NCTrainWnd {
    public static getTextures() { return [TEX_LIST, TEX_INFO, TEX_AQUIRE_INFO, TEX_OUTLINE, TEX_OUTLINE_DOWN, TEX_SELECT, TEX_SELECT_END, TEX_BUTTON, TEX_BUTTON_DOWN, TEX_DEFAULT_ICON, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public readonly list: NDomScrollPane_T;
    public readonly listView: HTMLDivElement;
    public readonly infoView: HTMLDivElement;
    public onInfo: (id: number, level: number) => void = null;
    public onEnchant: (id: number, level: number) => void = null;
    public onAquireInfo: (id: number, level: number, mode: number) => void = null;
    public onAquire: (id: number, level: number, mode: number) => void = null;
    protected readonly infoBack: HTMLDivElement;
    protected readonly learningHeading: HTMLCanvasElement;
    protected readonly details: HTMLDivElement;
    protected readonly listSp: HTMLCanvasElement;
    protected readonly infoSp: HTMLCanvasElement;
    protected readonly infoSpLabel: HTMLCanvasElement;
    protected readonly infoExp: HTMLCanvasElement;
    protected rows: (EnchantSkill_T | AquireSkillEntry_T)[] = [];
    protected info: EnchantSkillInfo_T | AquireSkillInfo_T = null;
    protected status: TrainStatus_T = null;
    protected selected = -1;
    protected generation = 0;
    protected isEnchantList = true;
    protected isEnchantInfo = true;
    protected aquireMode = 0;

    public constructor(protected readonly layer: NDomLayer, parent?: HTMLElement) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 401, parent);
        this.element.hidden = true;
        this.element.setAttribute("aria-label", manager.getSysString(477));
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(477), false, () => this.setVisible(false));
        this.listView = layer.createWindow(0, 20, 256, 381, this.element);
        layer.tile(this.listView, 0, 0, 256, 381, 0, 0, 256, 381, TEX_LIST);
        layer.text(this.listView, manager.getSysString(364), 0xffdcdcdc, FontType_T.SMALL, 11, 12);
        layer.text(this.listView, manager.getSysString(92), 0xffdcdcdc, FontType_T.SMALL, 130, 326);
        this.listSp = layer.text(this.listView, "", 0xffdcdcdc, FontType_T.SMALL, 224, 326);
        this.list = layer.scrollPane(this.listView, 20, 27, 230, 274, 40);
        this.list.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2 || !this.list.content.contains(event.target as Node) && event.target !== this.list) return;

            event.preventDefault();
            const rect = this.list.getBoundingClientRect(), x = layer.toUI(event.clientX - rect.left), y = layer.toUI(event.clientY - rect.top);

            if (x < 0 || x > 230 || y < 0 || y > 274) this.selected = -1;
            else if (x < 230 && y >= 1) {
                const visible = Math.trunc((y - 1) / 40), index = this.list.getScroll() / 40 + visible;

                if (visible < 7 && index < this.rows.length) this.selected = index;
            }
            this.paintRows();
            const row = this.rows[this.selected];

            if (!row) return;

            if (this.isEnchantList) {
                if (this.onInfo) this.onInfo(row.id, row.nextLevel);
            } else if (this.onAquireInfo) this.onAquireInfo(row.id, row.nextLevel, this.aquireMode);
        });
        this.infoView = layer.createWindow(0, 20, 256, 381, this.element);
        this.infoView.hidden = true;
        this.infoBack = layer.tile(this.infoView, 0, 0, 256, 381, 0, 0, 256, 381, TEX_INFO);
        layer.text(this.infoView, manager.getSysString(366), 0xffdcdcdc, FontType_T.SMALL, 11, 12);
        this.learningHeading = layer.text(this.infoView, manager.getSysString(367), 0xffdcdcdc, FontType_T.SMALL, 11, 155);
        this.details = layer.createWindow(0, 0, 256, 349, this.infoView);
        this.infoExp = layer.text(this.infoView, "", 0xffdcdcdc, FontType_T.SMALL, 224, 306);
        this.infoSp = layer.text(this.infoView, "", 0xffdcdcdc, FontType_T.SMALL, 224, 326);
        this.infoSpLabel = layer.text(this.infoView, manager.getSysString(92), 0xffdcdcdc, FontType_T.SMALL, 130, 326);
        this.infoSpLabel.hidden = true;
        layer.button(this.infoView, 51, 352, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(368), () => {
            if (!this.info) return;

            if (this.isEnchantInfo) {
                if (this.onEnchant) this.onEnchant(this.info.id, this.info.level);
            } else if (this.onAquire) this.onAquire(this.info.id, this.info.level, (this.info as AquireSkillInfo_T).mode);
        });
        layer.button(this.infoView, 131, 352, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(369), () => this.showList());
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public getItems() { return this.rows; }
    public getInfo() { return this.info; }
    public getSelectedIndex() { return this.selected; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (!visible) this.generation++;
    }
    public setStatus(status: TrainStatus_T) {
        this.status = status;
        this.infoSpLabel.hidden = this.isEnchantInfo || !status;
        const layer = this.layer, sp = status ? String(status.sp) : "", exp = status && status.level >= 1 && status.level <= 78 ? String(status.exp - EXPERIENCE_TABLE[status.level]) : "";

        [[this.listSp, sp, 326], [this.infoSp, sp, 326], [this.infoExp, exp, 306]].forEach(([element, value, y]) => {
            layer.renderText(element as HTMLCanvasElement, value as string, 0xffdcdcdc);
            layer.place(element as HTMLCanvasElement, 224 - layer.measureText(value as string), y as number);
        });
    }
    public showList() {
        this.listView.hidden = false;
        this.infoView.hidden = true;
        this.paintRows();
    }
    public async showEnchantList(rows: EnchantSkill_T[]) {
        this.isEnchantList = true;
        await this.showRows(rows);
    }
    public async showAquireList(rows: AquireSkillEntry_T[], mode = 0) {
        this.isEnchantList = false;
        this.aquireMode = mode;
        await this.showRows(rows);
    }
    protected async showRows(rows: (EnchantSkill_T | AquireSkillEntry_T)[]) {
        const generation = ++this.generation, strings = this.layer.getManager().strings;

        this.rows = rows.slice(0, 100);
        this.info = null;
        this.selected = -1;
        this.details.replaceChildren();
        this.list.setContentHeight(this.rows.length * 40);
        this.list.setScroll(0);
        this.showList();
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
        this.paintRows();
        await this.layer.loadTextures([...new Set(this.rows.map(row => strings.skillInfos[`${row.id}:${row.nextLevel}`]?.icon || (this.isEnchantList ? strings.skillIcons[row.id] : null)).filter(path => !!path))]);
        if (generation !== this.generation) return;

        this.paintRows();
    }
    public async showEnchantInfo(info: EnchantSkillInfo_T) {
        this.isEnchantInfo = true;
        await this.showInfo(info);
    }
    public async showAquireInfo(info: AquireSkillInfo_T) {
        this.isEnchantInfo = false;
        await this.showInfo(info);
    }
    protected async showInfo(info: EnchantSkillInfo_T | AquireSkillInfo_T) {
        const generation = ++this.generation, strings = this.layer.getManager().strings;
        const skill = strings.skillInfos[`${info.id}:${info.level}`], icon = skill?.icon || (this.isEnchantInfo ? strings.skillIcons[info.id] : null);

        this.info = info;
        this.layer.setTile(this.infoBack, 256, 381, 0, 0, 256, 381, this.isEnchantInfo ? TEX_INFO : TEX_AQUIRE_INFO);
        this.layer.place(this.learningHeading, 11, this.isEnchantInfo ? 155 : 200);
        this.infoExp.hidden = !this.isEnchantInfo;
        this.infoSpLabel.hidden = this.isEnchantInfo || !this.status;
        this.listView.hidden = true;
        this.infoView.hidden = false;
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
        this.paintInfo();
        await this.layer.loadTextures([...new Set([icon, ...this.getRequirements().map(row => strings.itemIcons[row.itemId])].filter(path => !!path))]);
        if (generation !== this.generation) return;

        this.paintInfo();
    }
    protected paintRows() {
        const layer = this.layer, strings = layer.getManager().strings;

        this.list.content.replaceChildren();
        this.rows.forEach((row, index) => {
            const y = 1 + index * 40, skill = strings.skillInfos[`${row.id}:${row.nextLevel}`];
            const requestedIcon = skill?.icon || (this.isEnchantList ? strings.skillIcons[row.id] : null), icon = requestedIcon && layer.hasTexture(requestedIcon) ? requestedIcon : TEX_DEFAULT_ICON;
            const element = layer.createWindow(0, y, 215, 40, this.list.content);

            element.dataset.skillId = String(row.id);
            element.dataset.skillLevel = String(row.nextLevel);
            if (index === this.selected) {
                layer.tile(element, 0, -4, 181, 40, 0, 0, 16, 13, TEX_SELECT);
                layer.tile(element, 181, -4, 32, 40, 0, 0, 32, 13, TEX_SELECT_END);
            }
            layer.tile(element, -1, -1, 34, 34, 0, 0, 34, 34, TEX_OUTLINE_DOWN);
            layer.tile(element, -1, -1, 35, 35, 0, 0, 35, 35, TEX_OUTLINE);
            layer.tile(element, 0, 0, 32, 32, 0, 0, 32, 32, icon);
            layer.text(element, skill?.name || (this.isEnchantList ? strings.skillNames[row.id] : "") || "", 0xffdcdcdc, FontType_T.SMALL, 34, 3);
            if (this.isEnchantList) layer.text(element, skill?.enchantName || "", 0xffb09b79, FontType_T.SMALL, 34, 19);
            else {
                const levelLabel = layer.getManager().getSysString(88);
                const level = row.nextLevel > 0 ? String(row.nextLevel) : layer.getManager().getSysString(371);

                layer.text(element, levelLabel, 0xffa3a3a3, FontType_T.SMALL, 34, 19);
                layer.text(element, level, 0xffb09b79, FontType_T.SMALL, 36 + layer.measureText(levelLabel), 19);
                this.drawCost(element, 365, (row as AquireSkillEntry_T).spCost, 76, 19);
            }
        });
    }
    protected paintInfo() {
        const info = this.info;

        if (!info) return;
        const layer = this.layer, manager = layer.getManager(), strings = manager.strings, skill = strings.skillInfos[`${info.id}:${info.level}`];
        const requestedIcon = skill?.icon || (this.isEnchantInfo ? strings.skillIcons[info.id] : null), icon = requestedIcon && layer.hasTexture(requestedIcon) ? requestedIcon : TEX_DEFAULT_ICON;

        this.details.replaceChildren();
        layer.tile(this.details, 13, 29, 34, 34, 0, 0, 34, 34, TEX_OUTLINE_DOWN);
        layer.tile(this.details, 13, 29, 35, 35, 0, 0, 35, 35, TEX_OUTLINE);
        layer.tile(this.details, 14, 30, 32, 32, 0, 0, 32, 32, icon);
        layer.text(this.details, skill?.name || (this.isEnchantInfo ? strings.skillNames[info.id] : "") || "", 0xffdcdcdc, FontType_T.SMALL, 51, 32);
        if (this.isEnchantInfo) {
            const enchantInfo = info as EnchantSkillInfo_T;
            const rateLabel = manager.getSysString(642);

            layer.text(this.details, skill?.enchantName || "", 0xffb09b79, FontType_T.SMALL, 51, 48);
            layer.text(this.details, rateLabel, 0xffa3a3a3, FontType_T.SMALL, 13, 68);
            layer.text(this.details, `${enchantInfo.rate}%`, 0xffb09b79, FontType_T.SMALL, 18 + layer.measureText(rateLabel), 68);
            this.drawWrapped(skill?.enchantDescription || "", 13, 91, 230, 0xffb2becf);
            this.drawCost(this.details, 1219, enchantInfo.expCost, 13, 175);
            this.drawCost(this.details, 365, info.spCost, 13, 191);
        } else {
            const label = manager.getSysString(88), level = String(info.level), x = 53 + layer.measureText(label);

            layer.text(this.details, label, 0xffa3a3a3, FontType_T.SMALL, 51, 48);
            layer.text(this.details, level, 0xffb09b79, FontType_T.SMALL, x, 48);
            layer.text(this.details, skill ? manager.getSysString(skill.type) : "", 0xffb09b79, FontType_T.SMALL, x + layer.measureText(level) + 10, 48);
            this.drawCost(this.details, 320, skill ? skill.mpConsume : 0, 13, 68);
            if (skill && skill.hpConsume > 0) this.drawCost(this.details, 321, skill.hpConsume, 13, 80);
            this.drawWrapped(skill?.description || "", 13, 102, 230, 0xffb2becf);
            this.drawCost(this.details, 365, info.spCost, 13, 220);
        }
        this.getRequirements().forEach((row, index) => {
            const y = (this.isEnchantInfo ? 213 : 242) + index * 34, requested = strings.itemIcons[row.itemId], texture = requested && layer.hasTexture(requested) ? requested : TEX_DEFAULT_ICON;

            layer.tile(this.details, 13, y, 32, 32, 0, 0, 32, 32, texture);
            this.drawWrapped(`${strings.itemNames[row.itemId] || ""} X ${row.count}`, 49, y, 140, 0xffdcdcdc);
        });
    }
    protected drawCost(parent: HTMLElement, id: number, value: number, x: number, y: number) {
        const layer = this.layer, label = layer.getManager().getSysString(id);

        layer.text(parent, label, 0xffa3a3a3, FontType_T.SMALL, x, y);
        layer.text(parent, " : ", 0xffdcdcdc, FontType_T.SMALL, x + layer.measureText(label), y);
        layer.text(parent, String(value), 0xffb09b79, FontType_T.SMALL, x + layer.measureText(`${label} : `), y);
    }
    protected getRequirements() {
        const strings = this.layer.getManager().strings;

        return this.info.requirements.filter(row => !!strings.itemInfos[row.itemId]).slice(0, 4);
    }
    protected drawWrapped(text: string, x: number, y: number, width: number, color: number) {
        const canvas = this.layer.getManager().canvas;

        canvas.wrapText(text, width).forEach((line, index) => this.layer.text(this.details, line, color, FontType_T.SMALL, x, y + index * canvas.getLineHeight(FontType_T.SMALL)));
    }
}

export default NCTrainWnd;
