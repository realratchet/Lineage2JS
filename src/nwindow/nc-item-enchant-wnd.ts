import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES, type NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { InventoryEntry_T } from "./nc-inventory-wnd";
import { SKIN_SLOTS } from "./skin-textures";

const TEX_BACK = "L2UI_CH3.InventoryWnd.itemenchant_back";
const TEX_OUTLINE = "L2UI_CH3.etc.iconbox";
const TEX_SELECTED = "L2UI.NWindow.item_click";
const TEX_BUTTON = SKIN_SLOTS.button;
const TEX_BUTTON_DOWN = SKIN_SLOTS.buttonDown;

export class NCItemEnchantWnd {
    public static getTextures() { return [TEX_BACK, TEX_OUTLINE, TEX_SELECTED, TEX_BUTTON, TEX_BUTTON_DOWN, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onConfirm: (objectId: number) => void = null;
    public onTooltip: (item: InventoryEntry_T, button: HTMLElement, isDetailed: boolean) => void = null;
    public onHideTooltip: () => void = null;
    protected readonly caption: HTMLDivElement;
    protected readonly list: NDomScrollPane_T;
    protected readonly frames: HTMLDivElement[] = [];
    protected items: InventoryEntry_T[] = [];
    protected selected = -1;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        this.caption = NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(1220), false, () => this.setVisible(false));
        this.caption.parentElement.style.overflow = "hidden";
        layer.text(this.element, manager.getSysString(1221), 0xffdcdcdc, FontType_T.SMALL, 11, 32);
        this.list = layer.scrollPane(this.element, 9, 48, 240, 318, 35, false, 9);
        this.list.content.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.target !== this.list.content) return;

            this.select(-1);
        });
        layer.button(this.element, 51, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(140), () => {
            const item = this.items[this.selected];
            if (item && this.onConfirm) this.onConfirm(item.objectId);
        });
        layer.button(this.element, 131, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(141), () => {
            if (this.onConfirm) this.onConfirm(-1);
            this.setVisible(false);
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        if (visible) {
            this.element.hidden = false;
            return;
        }

        this.items = [];
        this.selected = -1;
        this.frames.length = 0;
        this.list.content.replaceChildren();
        this.element.hidden = true;
        if (this.onHideTooltip) this.onHideTooltip();
    }

    public async show(itemId: number, items: InventoryEntry_T[]) {
        this.setVisible(false);
        this.items = items;
        await this.layer.loadTextures([...new Set(items.map(item => item.icon))]);
        if (this.items !== items) return;

        const manager = this.layer.getManager();
        const title = `${manager.strings.itemNames[itemId]}(${manager.getSysString(1220)})`;

        this.layer.renderText(this.caption, title, 0xffc8d2dc);
        this.element.setAttribute("aria-label", title);
        this.list.setContentHeight(Math.max(9, Math.ceil(items.length / 6)) * 35);
        this.list.setScroll(0);
        items.forEach((item, index) => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "ndom-inventory-item";
            button.draggable = false;
            button.dataset.objectId = String(item.objectId);
            button.setAttribute("aria-label", item.name);
            this.layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, 37, 35);
            this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE);
            this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, item.icon);
            const frame = this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_SELECTED);

            frame.hidden = true;
            this.frames.push(frame);
            button.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                this.select(index);
            });
            button.addEventListener("keydown", event => {
                if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                this.select(index);
            });
            button.addEventListener("mouseenter", () => { if (this.onTooltip) this.onTooltip(item, button, this.selected === index); });
            button.addEventListener("mouseleave", () => { if (this.onHideTooltip) this.onHideTooltip(); });
            this.list.content.appendChild(button);
        });
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
    }

    protected select(index: number) {
        this.selected = index;
        this.frames.forEach((frame, frameIndex) => { frame.hidden = frameIndex !== index; });
        if (this.onHideTooltip) this.onHideTooltip();
        const item = this.items[index], button = this.list.content.children[index] as HTMLElement;
        if (item && this.onTooltip) this.onTooltip(item, button, true);
    }
}

export default NCItemEnchantWnd;
