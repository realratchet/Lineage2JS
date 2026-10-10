import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES } from "./ndom";
import type { NDomScrollPane_T, NDomButton_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { ShopItem_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.StoreWnd.Store1_back";
const TEX_SELECTED = "L2UI.NWindow.item_click";
const TEX_UP = "L2UI_CH3.Button.UpButton";
const TEX_DOWN = "L2UI_CH3.Button.DownButton";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_Normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_NormalOn";

type ShopDrag_T = { side: number, item: ShopItem_T, isDragging: boolean };

export class NCShopWnd {
    public static getTextures() { return [TEX_BACK, TEX_SELECTED, TEX_UP, TEX_DOWN, TEX_BUTTON, TEX_BUTTON_DOWN, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onMove: (side: number, item: ShopItem_T, isPointer: boolean, isDrag: boolean) => void = null;
    public onConfirm: (isSell: boolean, items: ShopItem_T[]) => void = null;
    public onSelect: () => void = null;
    public onHide: () => void = null;
    public onClose: () => void = null;
    public onTooltip: (item: ShopItem_T, button: HTMLElement, isDetailed: boolean, context: number) => void = null;
    public onHideTooltip: () => void = null;
    protected readonly lists: NDomScrollPane_T[] = [];
    protected readonly selected: ShopItem_T[] = [null, null];
    protected readonly pressed = [-1, -1];
    protected readonly hoveredIndices = [-1, -1];
    protected heldSide = -1;
    protected hoveredSide = -1;
    protected hoveredIndex = -1;
    protected readonly labels: HTMLCanvasElement[] = [];
    protected readonly total: HTMLCanvasElement;
    protected readonly money: HTMLCanvasElement;
    protected readonly caption: HTMLCanvasElement;
    protected readonly okButton: NDomButton_T;
    protected readonly cancelButton: NDomButton_T;
    protected capacity = 160;
    protected isStore = false;
    protected items: ShopItem_T[][] = [[], []];
    protected isSell = false;
    protected drag: ShopDrag_T = null;
    protected generation = 0;

    public constructor(protected readonly layer: NDomLayer, protected readonly isPreview = false) {
        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        this.caption = NCFrameCtrl.createDOM(layer, this.element, 256, layer.getManager().getSysString(isPreview ? 847 : 136), false, () => this.setVisible(false), () => { if (this.onClose) this.onClose(); });
        this.labels.push(layer.text(this.element, "", 0xffdcdcdc, FontType_T.SMALL, 11, 32), layer.text(this.element, "", 0xffdcdcdc, FontType_T.SMALL, 11, 198), layer.text(this.element, "", 0xffdcdcdc, FontType_T.SMALL, 0, 331));
        const adena = layer.getManager().getSysString(134);

        layer.text(this.element, adena, 0xffdcdcdc, FontType_T.SMALL, 156 - layer.measureText(adena), 350);
        this.total = layer.text(this.element, "", 0xffdcdcdc, FontType_T.SMALL, 247, 331);
        this.money = layer.text(this.element, "", 0xffdcdcdc, FontType_T.SMALL, 247, 350);
        [48, 215].forEach((y, side) => {
            const rows = side ? 3 : 4;
            const list = layer.scrollPane(this.element, 9, y, 239, rows * 35 - 1, 35);

            list.tabIndex = -1;
            this.lists.push(list);
            list.addEventListener("wheel", event => {
                event.stopImmediatePropagation();
                const delta = typeof (event as any).wheelDelta === "number" ? Math.trunc((event as any).wheelDelta / 120) : -Math.sign(event.deltaY);

                list.setScroll(list.getScroll() - delta * 35);
            }, true);
            list.addEventListener("mousemove", event => {
                if (list.content.contains(event.target as Node) || event.target === list && (list.children[1] as HTMLElement).hidden)
                    this.hoverItem(side, this.getItemIndex(side, event));
            });
            list.content.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                event.preventDefault();
                const index = this.getItemIndex(side, event), item = this.items[side][index];

                this.pressed[side] = index;
                this.heldSide = side;
                if (!item) return;
                if (event.detail === 2) {
                    this.endDrag();
                    if (this.onMove) this.onMove(side, item, true, false);
                    return;
                }
                this.selected[side] = item;
                this.hoveredIndices[side] = index;
                this.hoveredSide = side;
                this.hoveredIndex = index;
                this.paintSelection(side);
                this.drag = { side, item, isDragging: false };
                if (this.onSelect) this.onSelect();
                layer.getManager().playPickupSound();
                if (this.onTooltip) this.onTooltip(item, list.content.children[index] as HTMLElement, true, this.getTooltipContext(side));
            });
        });
        layer.button(this.element, 112, 194, 15, 15, TEX_UP, TEX_UP, null, null, () => this.moveSelected(1));
        layer.button(this.element, 130, 194, 15, 15, TEX_DOWN, TEX_DOWN, null, null, () => this.moveSelected(0));
        this.okButton = layer.button(this.element, 51, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, layer.getManager().getSysString(140), () => {
            if (this.onConfirm) this.onConfirm(this.isSell, this.items[1]);
        });
        this.cancelButton = layer.button(this.element, 131, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, layer.getManager().getSysString(141), () => this.setVisible(false));
        window.addEventListener("mousemove", event => {
            if (!(event.buttons & 1)) this.heldSide = -1;
            if (this.heldSide >= 0) this.hoveredIndices[this.heldSide] = this.getItemIndex(this.heldSide, event);
            if (!this.drag) return;
            if (!(event.buttons & 1) || !this.isVisible()) { this.endDrag(); return; }
            if (this.drag.isDragging) return;

            this.drag.isDragging = true;
            this.layer.getManager().setCursor(`url(${layer.getWrapUrl(layer.getManager().strings.itemIcons[this.drag.item.itemId])}) 16 16, default`);
            document.documentElement.classList.add("ndom-item-drag");
        }, true);
        window.addEventListener("mouseup", event => {
            if (event.button === 0) this.heldSide = -1;
            if (event.button !== 0 || !this.drag) return;

            const drag = this.drag, target = document.elementFromPoint(event.clientX, event.clientY), list = this.lists[1 - drag.side];

            this.endDrag();
            if (!this.isVisible() || !target || !(list.content.contains(target) || target === list && (list.children[1] as HTMLElement).hidden)) return;
            if (this.onMove) this.onMove(drag.side, drag.item, true, true);
        }, true);
        window.addEventListener("blur", () => this.endDrag());
        window.addEventListener("pointercancel", () => this.endDrag());
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public isSellMode() { return this.isSell; }
    public isPreviewMode() { return this.isPreview; }
    public isStoreMode() { return this.isStore; }
    public getGrid(side: number) { return this.lists[side]; }
    public getItems(side: number) { return this.items[side]; }
    public getPressedItem(side: number) { return this.items[side][this.pressed[side]]; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (visible) return;

        this.generation++;
        this.endDrag();
        this.items = [[], []];
        this.selected.fill(null);
        this.pressed.fill(-1);
        this.hoveredIndices.fill(-1);
        this.heldSide = this.hoveredSide = this.hoveredIndex = -1;
        this.lists.forEach(list => { list.content.replaceChildren(); list.setContentHeight(0); });
        if (this.onHideTooltip) this.onHideTooltip();
        if (this.onHide) this.onHide();
    }

    public async show(isSell: boolean, money: number, items: ShopItem_T[], selectedItems: ShopItem_T[] = []) {
        this.setVisible(false);
        this.isSell = isSell;
        this.items = [items.slice(0, this.capacity).map(item => ({ ...item })), selectedItems.slice(0, this.capacity).map(item => ({ ...item }))];
        const strings = this.layer.getManager();

        const labels = this.getLabelIds();

        labels.forEach((id, index) => this.layer.renderText(this.labels[index], strings.getSysString(id), 0xffdcdcdc));
        this.layer.place(this.labels[2], 156 - this.layer.measureText(strings.getSysString(labels[2])), 331);
        this.drawAmount(this.money, String(money), 350);
        this.drawTotal();
        this.setVisible(true);
        await this.paintItems();
    }

    public transfer(side: number, item: ShopItem_T, count: number) {
        const source = this.items[side], destination = this.items[1 - side];

        if (!source.includes(item) || count <= 0) return;

        const consumeType = this.layer.getManager().strings.itemInfos[item.itemId].consumeType;
        const isStackable = consumeType >= 1 && consumeType <= 3;
        count = this.getTransferCount(item, count);
        if (!isStackable) count = 1;
        if (!(side === 1 && !this.isSell && !this.isPreview && !this.isStore)) {
            const existing = isStackable ? destination.find(entry => entry.itemId === item.itemId) : null;

            if (existing) existing.count += count;
            else if (destination.length < this.capacity) destination.push({ ...item, count });
        }
        if (this.isSell || this.isPreview || this.isStore || side === 1) {
            if (isStackable && item.count > count) item.count -= count;
            else source.splice(source.indexOf(item), 1);
        }
        this.selected[side] = null;
        this.pressed[side] = -1;
        if (this.onHideTooltip) this.onHideTooltip();
        this.drawTotal();
        void this.paintItems();
    }

    protected getTransferCount(item: ShopItem_T, count: number) { return this.isSell || this.isStore ? Math.min(count, item.count) : count; }
    protected moveSelected(side: number) { const item = this.getPressedItem(side); if (item && this.onMove) this.onMove(side, item, false, false); }
    protected getLabelIds() { return this.isPreview ? [811, 812, 813] : [this.isSell ? 138 : 137, this.isSell ? 137 : 139, this.isSell ? 143 : 142]; }
    protected getTooltipContext(side: number) { return this.isStore ? 0 : this.isSell ? 8 : side ? 4 : 7; }
    protected hoverItem(side: number, index: number) {
        if (this.heldSide >= 0 && this.heldSide !== side) index = this.hoveredIndices[side];
        else this.hoveredIndices[side] = index;

        if (this.hoveredSide === side && this.hoveredIndex === index) return;

        this.hoveredSide = side;
        this.hoveredIndex = index;
        const item = this.items[side][index], button = this.lists[side].content.children[index] as HTMLElement;

        if (item && this.onTooltip) this.onTooltip(item, button, item === this.selected[side], this.getTooltipContext(side));
        else if (this.onHideTooltip) this.onHideTooltip();
    }
    protected endDrag() {
        if (!this.drag) return;

        this.drag = null;
        this.layer.getManager().setCursor("");
        document.documentElement.classList.remove("ndom-item-drag");
    }
    protected getItemIndex(side: number, event: MouseEvent) {
        const list = this.lists[side], rect = list.getBoundingClientRect();
        const x = this.layer.toUI(event.clientX - rect.left), y = this.layer.toUI(event.clientY - rect.top);

        if (x < 0 || x > 222 || y < 0 || y > (side ? 3 : 4) * 35) return -1;

        return (list.getScroll() / 35 + Math.min((side ? 3 : 4) - 1, Math.trunc(y / 35))) * 6 + Math.min(5, Math.trunc(x / 37));
    }
    protected paintSelection(side: number) {
        this.lists[side].content.querySelectorAll<HTMLElement>("[data-selected]").forEach((frame, index) => frame.hidden = this.items[side][index] !== this.selected[side]);
    }
    protected async paintItems(scrollSide = -1) {
        const generation = ++this.generation, strings = this.layer.getManager().strings;

        await this.layer.loadTextures([...new Set(this.items.flat().map(item => strings.itemIcons[item.itemId]))]);
        if (generation !== this.generation) return;

        this.lists.forEach((list, side) => {
            list.content.replaceChildren();
            const rows = side ? 3 : 4;
            const rowCount = Math.ceil(this.items[side].length / 6);
            const scroll = rowCount >= rows ? Math.min(list.getScroll(), (rowCount - rows) * 35) : list.getScroll();

            if (scrollSide < 0 || scrollSide === side) {
                list.setContentHeight(rows * 35 - 1 + Math.max(0, rowCount - rows) * 35);
                list.setScroll(scroll, false);
            }
            this.items[side].forEach((item, index) => {
                const button = document.createElement("button");

                button.type = "button";
                button.tabIndex = -1;
                button.draggable = false;
                button.className = "ndom-inventory-item";
                button.dataset.objectId = String(item.objectId);
                button.dataset.itemId = String(item.itemId);
                button.setAttribute("aria-label", strings.itemNames[item.itemId]);
                this.layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, index % 6 === 5 ? 38 : 37, 35);
                const frame = this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_SELECTED);

                frame.dataset.selected = "";
                frame.hidden = item !== this.selected[side];
                this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, strings.itemIcons[item.itemId]);
                if (!this.isSell && !this.isPreview && !this.isStore && side === 0 && item.count > 0) this.layer.text(button, String(item.count), 0xffff0000, FontType_T.SMALL, 1, 1);
                button.addEventListener("mouseenter", () => this.hoverItem(side, index));
                button.addEventListener("mouseleave", () => {
                    if (this.hoveredSide !== side) return;

                    this.hoveredSide = this.hoveredIndex = -1;
                    if (this.onHideTooltip) this.onHideTooltip();
                });
                list.content.appendChild(button);
            });
            if (side === this.hoveredSide) {
                const item = this.items[side][this.hoveredIndex], button = list.content.children[this.hoveredIndex] as HTMLElement;

                if (item && this.onTooltip) this.onTooltip(item, button, item === this.selected[side], this.getTooltipContext(side));
            }
        });
    }
    protected drawTotal() {
        let total = 0n;

        for (const item of this.items[1]) total = BigInt.asIntN(64, total + BigInt(item.price) * BigInt(item.count));
        this.drawAmount(this.total, total.toString(), 331);
    }
    protected drawAmount(canvas: HTMLCanvasElement, value: string, y: number) {
        const text = value.replace(/(.)(?=(.{3})+$)/g, "$1,");

        this.layer.renderText(canvas, text, 0xffdcdcdc);
        this.layer.place(canvas, 247 - this.layer.measureText(text), y);
    }
}

export default NCShopWnd;
