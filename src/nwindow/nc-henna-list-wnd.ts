import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { HennaEquipEntry_T, HennaEquipList_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.HennaWnd.henna1_back";
const TEX_EMPTY = "NWindow.BlackTexture";

type HennaListRow_T = HennaEquipEntry_T & { name: string, description: string, icon: string };

export class NCHennaListWnd {
    public static getTextures() { return [TEX_BACK, TEX_EMPTY, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public readonly list: HTMLDivElement;
    public onOpen: (symbolId: number, isRemove: boolean) => void = null;
    protected readonly content: HTMLDivElement;
    protected readonly caption: HTMLCanvasElement;
    protected readonly heading: HTMLCanvasElement;
    protected readonly adena: HTMLCanvasElement;
    protected readonly thumb: HTMLDivElement;
    protected readonly thumbCenter: HTMLDivElement;
    protected readonly thumbBottom: HTMLDivElement;
    protected items: HennaListRow_T[] = [];
    protected isRemove = false;
    protected scroll = 0;
    protected selected = -1;
    protected thumbLength = 0;
    protected generation = 0;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        this.caption = NCFrameCtrl.createDOM(layer, this.element, 256, "", false, () => this.setVisible(false));
        this.heading = layer.text(this.element, "", 0xffdcdcdc, FontType_T.SMALL, 15, 28);
        this.adena = layer.text(this.element, "", 0xffdcdcdc, FontType_T.SMALL, 230, 374);
        this.list = layer.createWindow(7, 46, 241, 309, this.element);
        this.list.style.overflow = "hidden";
        this.content = layer.createWindow(0, 0, 226, 309, this.list);
        this.content.style.overflow = "hidden";
        this.thumb = layer.createWindow(226, 15, 15, 0, this.list);
        layer.tile(this.thumb, 0, 0, 15, 8, 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarTop");
        this.thumbCenter = layer.tile(this.thumb, 0, 8, 15, 8, 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarCenter");
        this.thumbBottom = layer.tile(this.thumb, 0, 8, 15, 8, 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarBottom");
        [-1, 1].forEach(direction => {
            const texture = direction < 0 ? "ScrollBarUp" : "ScrollBarDown";
            const button = layer.button(this.list, 226, direction < 0 ? 0 : 294, 15, 15, `L2UI_CH3.ScrollBar.${texture}Btn`, `L2UI_CH3.ScrollBar.${texture}OnBtn`);

            button.addEventListener("mousedown", event => {
                if (event.button === 0) this.setScroll(this.scroll + direction);
            });
        });
        this.thumb.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            const startY = layer.toUI(event.clientY), startPosition = this.thumb.offsetTop - 15;

            layer.beginDrag(moveEvent => {
                const travel = 279 - this.thumbLength;

                if (travel <= 0) return;
                const position = Math.max(0, Math.min(travel, Math.trunc(startPosition + layer.toUI(moveEvent.clientY) - startY)));

                if (position === this.thumb.offsetTop - 15) return;
                this.setScroll(Math.trunc(position * Math.max(0, this.items.length - 6) / travel));
                layer.place(this.thumb, 226, 15 + position);
            });
        });
        this.list.addEventListener("wheel", event => {
            event.preventDefault();
            const delta = typeof (event as any).wheelDelta === "number" ? Math.trunc((event as any).wheelDelta / 120) : -Math.sign(event.deltaY);

            this.setScroll(this.scroll - delta);
        });
        this.list.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2 || this.thumb.contains(event.target as Node) || (event.target as HTMLElement).closest(".ndom-button")) return;

            event.preventDefault();
            const rect = this.list.getBoundingClientRect(), x = layer.toUI(event.clientX - rect.left), y = layer.toUI(event.clientY - rect.top);

            if (x < 0 || x > 241 || y < 0 || y > 309) this.selected = -1;
            else if (x < 241 && y >= 9) {
                const index = Math.trunc((y - 9) / 48);

                if (index < 6 && this.scroll + index < this.items.length) this.selected = this.scroll + index;
            }
            const row = this.items[this.selected];

            if (row && this.onOpen) this.onOpen(row.symbolId, this.isRemove);
        });
        this.updateScroll();
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public getItems() { return this.items; }
    public getScroll() { return this.scroll; }
    public getSelectedIndex() { return this.selected; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (!visible) this.generation++;
    }
    public clear() {
        this.generation++;
        this.items = [];
        this.scroll = 0;
        this.selected = -1;
        this.content.replaceChildren();
        this.updateScroll();
    }
    public setScroll(position: number) {
        this.scroll = Math.max(0, Math.min(Math.trunc(position), this.items.length - 6));
        this.updateScroll();
        this.paintRows();
    }
    public async show(list: HennaEquipList_T, isRemove = false) {
        const manager = this.layer.getManager(), strings = manager.strings, generation = ++this.generation;

        this.items = [];
        this.isRemove = isRemove;
        list.hennas.forEach(item => {
            if (this.items.length >= 100) return;

            if (isRemove) {
                const henna = strings.hennas[item.symbolId];

                if (henna) this.items.push({ ...item, name: henna.name, description: henna.description, icon: henna.icon });
            } else {
                const info = strings.itemInfos[item.dyeItemId];

                if (info) this.items.push({ ...item, name: strings.itemNames[item.dyeItemId], description: info.addName, icon: strings.itemIcons[item.dyeItemId] });
            }
        });
        this.scroll = 0;
        this.selected = -1;
        const title = manager.getSysString(isRemove ? 652 : 651), adena = String(list.adena);

        this.element.setAttribute("aria-label", title);
        this.layer.renderText(this.caption, title, 0xffc8d2dc);
        this.layer.renderText(this.heading, manager.getSysString(isRemove ? 660 : 659), 0xffdcdcdc);
        this.layer.renderText(this.adena, adena, 0xffdcdcdc);
        this.layer.place(this.adena, 230 - this.layer.measureText(adena), 374);
        this.content.replaceChildren();
        this.updateScroll();
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
        await this.layer.loadTextures([...new Set(this.items.map(row => row.icon).filter(path => !!path))]);
        if (generation !== this.generation) return;

        this.paintRows();
    }
    protected updateScroll() {
        this.thumb.hidden = this.items.length <= 6;
        if (this.thumb.hidden) return;

        this.thumbLength = Math.max(15, Math.trunc(6 * 279 / this.items.length));
        this.layer.place(this.thumb, 226, 15 + Math.trunc((279 - this.thumbLength) * this.scroll / (this.items.length - 6)), 15, this.thumbLength);
        this.layer.place(this.thumbCenter, 0, 8, 15, Math.max(0, this.thumbLength - 16));
        this.layer.setTile(this.thumbCenter, 15, Math.max(0, this.thumbLength - 16), 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarCenter");
        this.layer.place(this.thumbBottom, 0, this.thumbLength - 8);
    }
    protected paintRows() {
        const layer = this.layer, manager = layer.getManager();

        this.content.replaceChildren();
        this.items.slice(this.scroll, this.scroll + 6).forEach((row, index) => {
            const element = layer.createWindow(0, index * 48, 226, 48, this.content);

            element.dataset.symbolId = String(row.symbolId);
            layer.tile(element, 5, 13, 32, 32, 0, 0, 32, 32, row.icon && layer.hasTexture(row.icon) ? row.icon : TEX_EMPTY);
            const lines = row.description ? [row.name] : manager.canvas.wrapText(row.name, 181);

            lines.forEach((line, index) => layer.text(element, line, 0xffdcdcdc, FontType_T.SMALL, 47, 11 + index * manager.canvas.getLineHeight(FontType_T.SMALL)));
            layer.text(element, row.description, 0xffdcdcdc, FontType_T.SMALL, 47, 23);
            layer.text(element, `${manager.getSysString(637)} ${row.price}`, 0xffdcdcdc, FontType_T.SMALL, 47, 36);
        });
    }
}

export default NCHennaListWnd;
