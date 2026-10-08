import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { HennaItemInfo_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.HennaWnd.henna2_back";
const TEX_EMPTY = "NWindow.BlackTexture";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_Normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_NormalOn";

export class NCHennaInfoWnd {
    public static getTextures() { return [TEX_BACK, TEX_EMPTY, TEX_BUTTON, TEX_BUTTON_DOWN, ...NCFrameCtrl.getTextures()]; }
    public readonly element: HTMLDivElement;
    public onBack: (isRemove: boolean) => void = null;
    public onConfirm: (symbolId: number, isRemove: boolean) => void = null;
    protected readonly content: HTMLDivElement;
    protected readonly caption: HTMLCanvasElement;
    protected isRemove = false;
    protected symbolId = 0;
    protected dyeName = "";
    protected dyeDescription = "";
    protected dyeIcon = "";
    protected symbolName = "";
    protected symbolDescription = "";
    protected symbolIcon = "";
    protected price = 0;
    protected adena = 0;
    protected stats = [0, 0, 0, 0, 0, 0];
    protected equippedStats = [0, 0, 0, 0, 0, 0];
    protected generation = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        this.caption = NCFrameCtrl.createDOM(layer, this.element, 256, "", false, () => this.setVisible(false));
        this.content = layer.createWindow(0, 20, 256, 348, this.element);
        layer.button(this.element, 51, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(543), () => {
            this.setVisible(false);
            if (this.onBack) this.onBack(this.isRemove);
        });
        layer.button(this.element, 131, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(140), () => {
            if (this.onConfirm) this.onConfirm(this.symbolId, this.isRemove);
            this.setVisible(false);
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; if (!visible) this.generation++; }
    public async show(info: HennaItemInfo_T, isRemove = false) {
        const manager = this.layer.getManager(), strings = manager.strings, henna = strings.hennas[info.symbolId], dye = strings.itemInfos[info.dyeItemId], generation = ++this.generation;

        this.isRemove = isRemove;
        this.adena = info.adena;
        this.stats.fill(0);
        this.equippedStats.fill(0);
        if (henna && dye) {
            this.symbolId = info.symbolId;
            this.symbolName = henna.name;
            this.symbolDescription = henna.description;
            this.symbolIcon = henna.icon;
            this.dyeName = strings.itemNames[info.dyeItemId];
            this.dyeDescription = dye.addName;
            this.dyeIcon = strings.itemIcons[info.dyeItemId];
            this.price = info.price;
            this.stats = info.stats.slice();
            this.equippedStats = info.equippedStats.slice();
        }
        const title = manager.getSysString(isRemove ? 652 : 651);

        this.element.setAttribute("aria-label", title);
        this.layer.renderText(this.caption, title, 0xffc8d2dc);
        this.paint();
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
        await this.layer.loadTextures([this.dyeIcon, this.symbolIcon].filter(path => !!path));
        if (generation !== this.generation) return;

        this.paint();
    }
    protected paint() {
        const layer = this.layer, manager = layer.getManager(), gray = 0xffdcdcdc;

        this.content.replaceChildren();
        layer.text(this.content, manager.getSysString(this.isRemove ? 639 : 638), gray, FontType_T.SMALL, 18, 23);
        layer.text(this.content, manager.getSysString(this.isRemove ? 638 : 639), gray, FontType_T.SMALL, 18, 112);
        const dyeY = this.isRemove ? 141 : 51, symbolY = this.isRemove ? 51 : 141;

        if (this.dyeIcon) layer.tile(this.content, 16, dyeY, 32, 32, 0, 0, 32, 32, layer.hasTexture(this.dyeIcon) ? this.dyeIcon : TEX_EMPTY);
        if (this.symbolIcon) layer.tile(this.content, 16, symbolY, 32, 32, 0, 0, 32, 32, layer.hasTexture(this.symbolIcon) ? this.symbolIcon : TEX_EMPTY);
        if (this.isRemove) {
            layer.text(this.content, `${manager.getSysString(652)} ${this.symbolName}`, gray, FontType_T.SMALL, 58, 46);
            this.paintLines(this.symbolDescription, 58, 60);
            layer.text(this.content, this.dyeName, gray, FontType_T.SMALL, 58, 136);
            this.paintLines(this.dyeDescription, 58, 150);
        } else {
            manager.canvas.wrapText(this.dyeName, 196).forEach((line, index) => layer.text(this.content, line, gray, FontType_T.SMALL, 58, 46 + index * manager.canvas.getLineHeight(FontType_T.SMALL)));
            layer.text(this.content, this.symbolName, gray, FontType_T.SMALL, 58, 136);
            this.paintLines(this.symbolDescription, 58, 150);
        }
        layer.text(this.content, `${manager.getSysString(637)} ${this.price}`, gray, FontType_T.SMALL, 58, this.isRemove ? 164 : 74);
        layer.text(this.content, manager.getSysString(640), gray, FontType_T.SMALL, 18, 201);
        [[1, 4, 2], [0, 5, 3]].forEach((indices, column) => {
            indices.forEach((index, row) => {
                const y = 227 + row * 16, before = String(this.stats[index]), after = String(this.equippedStats[index]);

                layer.text(this.content, manager.getSysString(104 + column * 3 + row), 0xffa3a3a3, FontType_T.SMALL, 17 + column * 118, y);
                layer.text(this.content, before, 0xffb09b79, FontType_T.SMALL, 64 + column * 118 - Math.floor(layer.measureText(before) / 2), y);
                layer.text(this.content, ">", 0xffb09b79, FontType_T.SMALL, 78 + column * 118, y);
                layer.text(this.content, after, 0xffb09b79, FontType_T.SMALL, 97 + column * 118 - Math.floor(layer.measureText(after) / 2), y);
            });
        });
        const adena = String(this.adena);

        layer.text(this.content, adena, gray, FontType_T.SMALL, 229 - layer.measureText(adena), 309);
    }
    protected paintLines(text: string, x: number, y: number) {
        text.replace(/\\n/g, "\n").split("\n").forEach((line, index) => this.layer.text(this.content, line, 0xffdcdcdc, FontType_T.SMALL, x, y + index * this.layer.getManager().canvas.getLineHeight(FontType_T.SMALL)));
    }
}

export default NCHennaInfoWnd;
