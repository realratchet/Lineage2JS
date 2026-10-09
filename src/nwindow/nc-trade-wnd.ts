import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES } from "./ndom";
import type { NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { TradeItem_T } from "../network/game-packets";

const TEX_BACK = "L2UI_ch3.TradeWnd.Trade_Back";
const TEX_OUTLINE = "L2ui_ch3.etc.iconbox";
const TEX_SELECTED = "L2UI.NWindow.item_click";
const TEX_ARROW = "l2ui_ch3.button.downbutton";
const TEX_BUTTON = "L2UI_ch3.button.btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_ch3.button.btn1_normalon";

type TradeDrag_T = { item: TradeItem_T, icon: string, isDragging: boolean };

export class NCTradeWnd {
    public static getTextures() { return [TEX_BACK, TEX_OUTLINE, TEX_SELECTED, TEX_ARROW, TEX_BUTTON, TEX_BUTTON_DOWN, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onConfirm: (isConfirmed: boolean) => void = null;
    public onOffer: (item: TradeItem_T, isDrop: boolean) => void = null;
    public onSelect: () => void = null;
    public onTooltip: (item: TradeItem_T, button: HTMLElement, isDetailed: boolean) => void = null;
    public onHideTooltip: () => void = null;
    protected readonly layer: NDomLayer;
    protected readonly lists: NDomScrollPane_T[] = [];
    protected readonly names: HTMLCanvasElement[] = [];
    protected readonly items: TradeItem_T[][] = [[], [], []];
    protected readonly rowCounts = [0, 0, 0];
    protected readonly selectedItems: TradeItem_T[] = [null, null, null];
    protected getSelectedItem() { return this.selectedItems[0]; }
    protected pressedIndex = -1;
    protected hoveredMode = -1;
    protected hoveredIndex = -1;
    protected readonly hoveredIndices = [-1, -1, -1];
    protected heldMode = -1;
    protected drag: TradeDrag_T = null;

    public constructor(layer: NDomLayer) {

        this.layer = layer;
        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        this.element.addEventListener("keydown", event => {
            if (event.key !== "Tab" && event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, layer.getManager().getSysString(445), false, () => {
            if (this.onConfirm) this.onConfirm(false);
            this.setVisible(false);
        });
        [35, 200, 295].forEach((y, mode) => {
            const rows = mode === 0 ? 4 : 2;
            const list = layer.scrollPane(this.element, 9, y, 239, rows * 35 - 1, 35);
            const setScroll = list.setScroll;

            list.setScroll = position => {
                if (this.rowCounts[mode] <= rows) return;

                setScroll(position);
            };
            list.addEventListener("wheel", event => {
                event.stopImmediatePropagation();
                // ponytail: deltaY fallback moves one row; verify native wheel units before extending it.
                const delta = typeof (event as any).wheelDelta === "number" ? Math.trunc((event as any).wheelDelta / 120) : -Math.sign(event.deltaY);
                const count = this.rowCounts[mode], page = list.getScroll() / 35;
                const next = delta > 0 ? Math.max(0, page - delta) : count >= rows ? Math.min(page - delta, count - rows) : 0;

                setScroll(next * 35, false);
            }, true);

            list.setContentHeight(rows * 35 - 1);
            list.tabIndex = -1;
            list.style.outline = "none";
            this.lists.push(list);
            list.addEventListener("mousemove", event => {
                if (list.content.contains(event.target as Node) || event.target === list && (list.children[1] as HTMLElement).hidden)
                    this.hoverItem(mode, this.getItemIndex(mode, event));
            });
            list.content.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                event.preventDefault();
                list.focus();
                this.heldMode = mode;
                const index = this.getItemIndex(mode, event);

                if (mode === 0) this.pressedIndex = index;
                if (event.detail === 2) { // NCTradeItemWnd::OnLButtonDblClk 0x1011a250 replaces the second button-down.
                    this.endDrag();
                    if (mode === 0 && index >= 0 && index < this.items[mode].length && this.onOffer) this.onOffer(this.items[mode][index], true);
                    return;
                }
                if (index < 0 || index >= this.items[mode].length) return;

                const item = this.items[mode][index];
                this.selectedItems[mode] = item;
                this.hoveredIndices[mode] = index;
                this.hoveredMode = mode;
                this.hoveredIndex = index;

                if (mode === 0) {
                    this.paintSelection();
                    this.drag = { item, icon: layer.getManager().strings.itemIcons[item.itemId], isDragging: false };
                }

                if (this.onSelect) this.onSelect();
                layer.getManager().playPickupSound();
                const button = list.content.children[index] as HTMLElement;

                if (this.onTooltip) this.onTooltip(item, button, true);
            });
        });
        this.names.push(layer.text(this.element, "", 0xffdcdcdc, FontType_T.SMALL, 11, 184), layer.text(this.element, "", 0xffdcdcdc, FontType_T.SMALL, 11, 278));
        layer.button(this.element, 140, 181, 15, 15, TEX_ARROW, TEX_ARROW, TEX_ARROW, null, () => {
            const item = this.items[0][this.pressedIndex];

            if (item && this.onOffer) this.onOffer(item, false);
        }).setAttribute("aria-label", "Offer selected item");
        [true, false].forEach((isConfirmed, index) => {
            const button = layer.button(this.element, 51 + index * 80, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, layer.getManager().getSysString(140 + index), () => {
                if (this.onConfirm) this.onConfirm(isConfirmed);
            });

            button.setAttribute("aria-label", layer.getManager().getSysString(140 + index));
        });
        window.addEventListener("mousemove", event => {
            if (!(event.buttons & 1)) this.heldMode = -1;
            if (this.heldMode >= 0) this.hoveredIndices[this.heldMode] = this.getItemIndex(this.heldMode, event);
            if (!this.drag) return;
            if (!(event.buttons & 1) || !this.isVisible()) { this.endDrag(); return; }
            const item = this.items[0][this.pressedIndex];

            if (!item) return;

            const icon = layer.getManager().strings.itemIcons[item.itemId];

            this.drag.item = item;
            if (this.drag.isDragging && this.drag.icon === icon) return;

            this.drag.icon = icon;
            this.drag.isDragging = true;
            document.documentElement.style.cursor = `url(${layer.getWrapUrl(this.drag.icon)}) 16 16, default`;
            document.documentElement.classList.add("ndom-item-drag");
        }, true);
        window.addEventListener("mouseup", event => {
            if (event.button !== 0) return;

            this.heldMode = -1;
            if (!this.drag) return;

            const item = this.items[0][this.pressedIndex];

            this.endDrag();
            const list = this.lists[1], target = document.elementFromPoint(event.clientX, event.clientY);

            if (!item || !this.isVisible() || !target || !(list.content.contains(target) || target === list && (list.children[1] as HTMLElement).hidden)) return;

            if (this.onOffer) this.onOffer(item, true);
        }, true);
        window.addEventListener("blur", () => { this.heldMode = -1; this.endDrag(); });
        window.addEventListener("pointercancel", () => { this.heldMode = -1; this.endDrag(); });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 302, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;

        if (isVisible)
            this.lists.forEach((list, mode) => this.recalculateRows(mode, this.items[mode].length));

        if (!isVisible) {
            this.heldMode = -1;
            this.endDrag();
            this.hoveredMode = this.hoveredIndex = -1;
            if (this.onHideTooltip) this.onHideTooltip();
        }
    }

    public reset() {
        this.endDrag();
        this.clearSelection();
        this.hoveredMode = this.hoveredIndex = -1;
        if (this.onHideTooltip) this.onHideTooltip();
        this.names.forEach(name => this.layer.renderText(name, "", 0xffdcdcdc));
        this.lists.forEach((list, mode) => {
            this.selectedItems[mode] = null;
            this.items[mode] = [];
            list.content.replaceChildren();
        });
    }

    public setNames(own: string, other: string) { [own, other].forEach((name, index) => this.layer.renderText(this.names[index], name, 0xffdcdcdc)); }
    public getPressedItem() { return this.items[0][this.pressedIndex]; }
    public clearSelection() {
        this.selectedItems[0] = null;
        this.pressedIndex = -1;
        this.paintSelection();
    }

    public recalculateRows(mode: number, itemCount: number) {
        const rows = mode === 0 ? 4 : 2;
        const count = this.rowCounts[mode] = Math.ceil(itemCount / 6);

        this.lists[mode].setContentHeight(rows * 35 - 1 + Math.max(0, count - rows) * 35, count < rows);
    }

    public async setItems(mode: number, items: TradeItem_T[], recalculatedItemCount = items.length) {
        this.items[mode] = items;
        if (recalculatedItemCount !== null) this.recalculateRows(mode, recalculatedItemCount);
        if (!items.includes(this.selectedItems[mode])) this.selectedItems[mode] = null;
        if (mode === this.hoveredMode && this.onHideTooltip) this.onHideTooltip();
        const strings = this.layer.getManager().strings;

        await this.layer.loadTextures([...new Set(items.map(item => strings.itemIcons[item.itemId]))]);
        if (this.items[mode] !== items) return;

        const list = this.lists[mode];

        list.content.replaceChildren();
        items.forEach((item, index) => {
            const button = document.createElement("button");

            button.type = "button";
            button.tabIndex = -1;
            button.draggable = false;
            button.className = "ndom-inventory-item";
            button.dataset.objectId = String(item.objectId);
            button.setAttribute("aria-label", strings.itemNames[item.itemId]);
            this.layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, index % 6 === 5 ? 38 : 37, 35);
            this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE);
            this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, strings.itemIcons[item.itemId]);
            if (mode === 0) {
                const frame = this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_SELECTED);

                frame.hidden = item !== this.getSelectedItem();
            }

            list.content.appendChild(button);
            button.addEventListener("mouseenter", () => this.hoverItem(mode, index));
            button.addEventListener("mouseleave", () => {
                if (this.hoveredMode !== mode) return;

                this.hoveredMode = this.hoveredIndex = -1;
                if (this.onHideTooltip) this.onHideTooltip();
            });
        });

        if (mode === this.hoveredMode) {
            const item = items[this.hoveredIndex], button = list.content.children[this.hoveredIndex] as HTMLElement;

            if (item && this.onTooltip) this.onTooltip(item, button, item === this.selectedItems[mode]);
        }
    }

    protected getItemIndex(mode: number, event: MouseEvent) {
        const list = this.lists[mode], rect = list.getBoundingClientRect();
        const x = this.layer.toUI(event.clientX - rect.left), y = this.layer.toUI(event.clientY - rect.top), rows = mode === 0 ? 4 : 2;

        if (x < 0 || x > 222 || y < 0 || y > rows * 35) return -1;

        return (list.getScroll() / 35 + Math.min(rows - 1, Math.trunc(y / 35))) * 6 + Math.min(5, Math.trunc(x / 37));
    }

    protected hoverItem(mode: number, index: number) {
        if (this.heldMode >= 0 && this.heldMode !== mode) index = this.hoveredIndices[mode];
        else this.hoveredIndices[mode] = index;

        if (this.hoveredMode === mode && this.hoveredIndex === index) return;

        this.hoveredMode = mode;
        this.hoveredIndex = index;
        const item = this.items[mode][index], button = this.lists[mode].content.children[index] as HTMLElement;

        if (item && this.onTooltip) this.onTooltip(item, button, item === this.selectedItems[mode]);
        else if (this.onHideTooltip) this.onHideTooltip();
    }

    protected paintSelection() {
        const buttons = this.lists[0].content.children;

        for (let index = 0; index < buttons.length; index++)
            (buttons[index].lastElementChild as HTMLElement).hidden = this.items[0][index] !== this.getSelectedItem();
    }

    protected endDrag() {
        if (!this.drag) return;

        this.drag = null;
        document.documentElement.style.cursor = "";
        document.documentElement.classList.remove("ndom-item-drag");
    }
}

export default NCTradeWnd;
