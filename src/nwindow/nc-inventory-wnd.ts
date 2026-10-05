import NDomLayer, { NDOM_SCROLL_TEXTURES } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { NDomButton_T, NDomScrollPane_T } from "./ndom";

const TEX_BACK = "L2UI_CH3.InventoryWnd.Inventory_Back";
const TEX_TAB = "L2UI_CH3.InventoryWnd.Inventory_tab2";
const TEX_TAB_SELECTED = "L2UI_CH3.InventoryWnd.Inventory_tab1";
const TEX_OUTLINE = "L2UI_CH3.InventoryWnd.Inventory_OutLine";
const TEX_OUTLINE_DOWN = "L2UI_CH3.InventoryWnd.Inventory_OutLine_down";
const TEX_FRAME_LEFT = "L2UI_CH3.FrameCtrl.FrameBackLeft";
const TEX_FRAME_MID = "L2UI_CH3.FrameCtrl.FrameBackMid";
const TEX_FRAME_RIGHT = "L2UI_CH3.FrameCtrl.FrameBackRight";
const TEX_CLOSE = "L2UI_CH3.FrameCtrl.FrameCloseBtn";
const TEX_CLOSE_DOWN = "L2UI_CH3.FrameCtrl.FrameCloseOnBtn";
const TEX_MINIMIZE = "L2UI_CH3.FrameCtrl.FrameMiniBtn";
const TEX_MINIMIZE_DOWN = "L2UI_CH3.FrameCtrl.FrameMiniOnBtn";
const TEX_ADENA = "L2UI.WindowIcon.WindowIconAdena";
const TEX_WEIGHT = "L2UI.WindowIcon.Weight";
const TEX_TRASH = "L2UI_CH3.InventoryWnd.Inventory_trash";
const arrWeightBars = [1, 2, 3, 4, 5].map(index => `L2UI_CH3.PlayerStatusWnd.PS_weightbar${index}`);

export type InventoryEntry_T = { objectId: number, itemId: number, name: string, icon: string, count: number, slot: number, isQuest: boolean, isMoney: boolean };

export class NCInventoryWnd { // NCConsole 0x10060bc2, NCInventoryWnd::OnCreate 0x10099a60, OnPaint 0x10095870.
    public static getTextures(): string[] { return [TEX_BACK, TEX_TAB, TEX_TAB_SELECTED, TEX_OUTLINE, TEX_OUTLINE_DOWN, TEX_FRAME_LEFT, TEX_FRAME_MID, TEX_FRAME_RIGHT, TEX_CLOSE, TEX_CLOSE_DOWN, TEX_MINIMIZE, TEX_MINIMIZE_DOWN, TEX_ADENA, TEX_WEIGHT, TEX_TRASH, ...arrWeightBars, "L2UI.NWindow.Number", ...NDOM_SCROLL_TEXTURES]; }

    public readonly element: HTMLDivElement;
    public onUse: (objectId: number) => void = null;
    public onChoose: (objectId: number) => void = null;
    protected readonly layer: NDomLayer;
    protected readonly equipment: HTMLDivElement;
    protected readonly bag: NDomScrollPane_T;
    protected readonly adena: HTMLCanvasElement;
    protected readonly count: HTMLCanvasElement;
    protected readonly weightBar: HTMLDivElement;
    protected readonly weightText: HTMLCanvasElement;
    protected limit = 0;
    protected readonly tabs: NDomButton_T[] = [];
    protected items: InventoryEntry_T[] = [];
    protected isQuest = false;
    protected chooseItemId = 0;

    public constructor(layer: NDomLayer) {
        this.layer = layer;
        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        this.element.setAttribute("role", "dialog");
        this.element.setAttribute("aria-label", layer.getManager().getSysString(138));
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);

        const frame = layer.createWindow(0, 0, 256, 20, this.element);

        layer.tile(frame, 0, 0, 16, 20, 0, 0, 16, 20, TEX_FRAME_LEFT);
        layer.tile(frame, 16, 0, 224, 20, 0, 0, 32, 20, TEX_FRAME_MID);
        layer.tile(frame, 240, 0, 16, 20, 0, 0, 16, 20, TEX_FRAME_RIGHT);
        layer.text(frame, layer.getManager().getSysString(138), 0xffc8d2dc, FontType_T.SMALL, 20, 5);

        const close = layer.button(frame, 233, 3, 15, 15, TEX_CLOSE, TEX_CLOSE_DOWN, null, null, () => this.setVisible(false));
        const minimize = layer.button(frame, 216, 3, 15, 15, TEX_MINIMIZE, TEX_MINIMIZE_DOWN, null, null, () => { // style 0x3002 carries the 0x2000 minimize bit.
            for (const child of this.element.children)
                if (child !== frame) (child as HTMLElement).hidden = !(child as HTMLElement).hidden;
        });

        minimize.setAttribute("aria-label", "Minimize");

        close.tabIndex = 0;
        close.setAttribute("role", "button");
        close.setAttribute("aria-label", "Close");
        close.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            this.layer.getManager().playButtonSound(true);
            this.setVisible(false);
        });
        this.element.addEventListener("keydown", event => { if (event.key === "Escape") this.setVisible(false); });
        frame.addEventListener("mousedown", event => {
            if (event.button !== 0 || close.contains(event.target as Node) || minimize.contains(event.target as Node)) return;

            event.preventDefault();

            const startX = layer.toUI(event.clientX) - this.element.offsetLeft, startY = layer.toUI(event.clientY) - this.element.offsetTop;

            layer.beginDrag(e => layer.place(this.element, layer.toUI(e.clientX) - startX, layer.toUI(e.clientY) - startY));
        });
        this.equipment = layer.createWindow(8, 31, 240, 122, this.element);
        this.bag = layer.scrollPane(this.element, 9, 189, 236, 139, 35); // NCInvenItemWnd on NCScrollWnd, 6x4 grid of 37x35 cells.

        [2, 118].forEach((id, index) => {
            const select = () => {
                this.isQuest = index === 1;
                this.bag.setScroll(0);
                this.paintItems();
            };
            const label = layer.getManager().getSysString(id);
            const tab = layer.button(this.element, 12 + index * 94, 159, 94, 23, TEX_TAB, TEX_TAB_SELECTED, null, label, select);

            tab.tabIndex = 0;
            tab.setAttribute("role", "button");
            tab.setAttribute("aria-label", label);
            tab.addEventListener("keydown", event => {
                if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                this.layer.getManager().playButtonSound(true);
                select();
            });
            this.tabs.push(tab);
        });
        layer.tile(this.element, 98, 355, 16, 12, 0, 0, 16, 12, TEX_ADENA);
        this.adena = layer.text(this.element, "0", 0xffdcdcdc, FontType_T.SMALL, 199, 356);
        this.count = layer.text(this.element, "", 0xffb09b79, FontType_T.SMALL, 0, 162);
        layer.tile(this.element, 98, 372, 16, 12, 0, 0, 16, 12, TEX_WEIGHT);

        const weight = layer.createWindow(117, 372, 85, 12, this.element); // NCInvenWeightWnd at (117, 372, 85, 12), OnPaint 0x10095630.

        this.weightBar = layer.tile(weight, 0, 0, 0, 12, 0, 0, 1, 12, arrWeightBars[0]);
        this.weightText = document.createElement("canvas");
        this.weightText.className = "ndom-text ndom-absolute";
        weight.appendChild(this.weightText);

        const trash = layer.tile(this.element, 208, 351, 34, 34, 0, 0, 34, 34, TEX_TRASH); // OnCreate 0x1009a015: trash drop target at (208, 351), tooltip sysstring 890.

        trash.title = layer.getManager().getSysString(890);
        this.setWeight(0, 0);
    }

    public setWeight(current: number, maximum: number) {
        const width = maximum > 0 ? Math.trunc(current * 85 / maximum) : 0;
        const percent = width > 0 ? current / maximum * 100 : 0;
        const index = percent > 100 ? 4 : percent > 80 ? 3 : percent > 66.6 ? 2 : percent > 50 ? 1 : 0;
        const canvas = this.layer.getManager().canvas, scale = canvas.scale, text = `${percent.toFixed(2)}%`;

        this.weightBar.hidden = width <= 0;
        if (width > 0) {
            this.weightBar.style.width = `${width}px`;
            this.layer.setTile(this.weightBar, width, 12, 0, 0, width, 12, arrWeightBars[index]);
        }

        const textWidth = canvas.measureText(text); // 0x100957d5 measures with the text font, 0x10095811 draws digits.

        this.weightText.width = Math.round(85 * scale);
        this.weightText.height = Math.round(12 * scale);
        this.weightText.style.width = "85px";
        this.weightText.style.height = "12px";
        this.layer.place(this.weightText, 0, 0);

        const context = this.weightText.getContext("2d");

        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.imageSmoothingEnabled = false;
        canvas.renderDigits(context, Math.trunc(85 * 0.5 - textWidth / 2), 2, 0xffdcdcdc, text);
    }

    public setLimit(limit: number) {
        this.limit = limit;
        this.paintItems();
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 302, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;

        if (!isVisible) this.chooseItemId = 0;
    }

    public chooseItem(itemId: number) {
        this.chooseItemId = itemId;
        this.setVisible(true);
        this.paintItems();
    }
    public clearChoice() {
        this.chooseItemId = 0;
        this.paintItems();
    }

    public async setItems(items: InventoryEntry_T[]) {
        this.items = items;
        await this.layer.loadTextures([...new Set(items.map(item => item.icon))]);

        if (this.items !== items) return;

        this.paintItems();
    }

    protected paintItems() {
        this.equipment.replaceChildren();
        this.bag.content.replaceChildren();
        this.tabs.forEach((tab, index) => {
            const isSelected = (index === 1) === this.isQuest;

            tab.setTextures(isSelected ? TEX_TAB_SELECTED : TEX_TAB, TEX_TAB_SELECTED);
            tab.setAttribute("aria-pressed", String(isSelected));
        });

        let index = 0, money = 0;

        for (const item of this.items) {
            if (item.isMoney) { money += item.count; continue; }
            if (!this.layer.hasTexture(item.icon)) continue;

            if (item.slot >= 0) {
                // NCEquipItemWnd::OnPaint 0x1009414f..0x10094264.
                this.addItem(this.equipment, [7, 46, 85, 130, 169][item.slot % 5] - 1, 6 + Math.trunc(item.slot / 5) * 38, item);
            } else if (item.isQuest === this.isQuest) {
                // NCInvenItemWnd::OnPaint 0x1009528f..0x10095369.
                this.addItem(this.bag.content, index % 6 * 37, Math.trunc(index / 6) * 35, item);
                index++;
            }
        }

        this.bag.setContentHeight(Math.ceil(index / 6) * 35);

        const count = `(${this.items.filter(item => !item.isMoney).length}/${this.limit})`;

        this.layer.renderText(this.count, count, 0xffb09b79);
        this.layer.place(this.count, Math.trunc(256 - this.layer.measureText(count) - 5), 162); // OnPaint 0x10095a7b: "(%d/%d)" at width - textWidth - 5.

        const text = money.toLocaleString("en-US");

        this.layer.renderText(this.adena, text, 0xffdcdcdc);
        this.layer.place(this.adena, 199 - this.layer.measureText(text), 356);
    }

    protected addItem(parent: HTMLElement, x: number, y: number, item: InventoryEntry_T) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "ndom-inventory-item";
        button.dataset.objectId = String(item.objectId);
        button.title = `${item.name}${item.count > 1 ? ` (${item.count.toLocaleString("en-US")})` : ""}`;
        button.setAttribute("aria-label", button.title);
        this.layer.place(button, x, y, 34, 34);
        this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, item.icon);

        const outline = this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE);
        const use = () => {
            if (this.chooseItemId) {
                if (item.itemId === this.chooseItemId) {
                    this.chooseItemId = 0;
                    if (this.onChoose) this.onChoose(item.objectId);
                }

                return;
            }

            if (this.onUse) this.onUse(item.objectId);
        };

        button.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            this.layer.getManager().playButtonSound(!this.chooseItemId || item.itemId === this.chooseItemId);
            this.layer.setTile(outline, 34, 34, 0, 0, 34, 34, TEX_OUTLINE_DOWN);
        });
        for (const type of ["mouseup", "mouseleave"]) button.addEventListener(type, () => this.layer.setTile(outline, 34, 34, 0, 0, 34, 34, TEX_OUTLINE));
        button.addEventListener("click", event => { if (event.button === 0) use(); });
        button.addEventListener("keydown", event => {
            if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            this.layer.getManager().playButtonSound(!this.chooseItemId || item.itemId === this.chooseItemId);
            use();
        });
        parent.appendChild(button);
    }
}

export default NCInventoryWnd;
