import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES } from "./ndom";
import type { NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { RecipeInfo_T } from "../assets/decode-worker/decode-protocol";
import type { RecipeShopManageList_T, RecipeShopListEntry_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.RecipeWnd.Recipe1_Back";
const TEX_SELECTED = "L2UI.NWindow.item_click";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_Normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_NormalOn";

export type RecipeShopRow_T = { recipe: RecipeInfo_T, price: number, initialCount: number };
type RecipeShopDrag_T = { side: number, item: RecipeShopRow_T, isDragging: boolean };

export class NCRecipeShopWnd {
    public static getTextures() { return [TEX_BACK, TEX_SELECTED, TEX_BUTTON, TEX_BUTTON_DOWN, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onPrice: (row: RecipeShopRow_T) => void = null;
    public onMessage: () => void = null;
    public onStart: (entries: RecipeShopListEntry_T[]) => void = null;
    public onQuit: () => void = null;
    public onCancel: () => void = null;
    public onTooltip: (row: RecipeShopRow_T, button: HTMLElement, context: number, isDetailed: boolean) => void = null;
    public onHideTooltip: () => void = null;
    protected readonly lists: NDomScrollPane_T[] = [];
    protected readonly caption: HTMLCanvasElement;
    protected readonly counter: HTMLCanvasElement;
    protected readonly pressed = [-1, -1];
    protected readonly selected: RecipeShopRow_T[] = [null, null];
    protected items: RecipeShopRow_T[][] = [[], []];
    protected drag: RecipeShopDrag_T = null;
    protected generation = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        this.caption = NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(663), false, () => this.setVisible(false), () => { if (this.onQuit) this.onQuit(); });
        layer.text(this.element, manager.getSysString(643), 0xffdcdcdc, FontType_T.SMALL, 11, 32);
        layer.text(this.element, manager.getSysString(661), 0xffdcdcdc, FontType_T.SMALL, 11, 198);
        this.counter = layer.text(this.element, "", 0xffb09b79, FontType_T.SMALL, 251, 198);
        [48, 215].forEach((y, side) => {
            const list = layer.scrollPane(this.element, 9, y, 239, 139, 35);

            this.lists.push(list);
            list.addEventListener("wheel", event => {
                event.stopImmediatePropagation();
                const delta = typeof (event as any).wheelDelta === "number" ? Math.trunc((event as any).wheelDelta / 120) : -Math.sign(event.deltaY);

                list.setScroll(list.getScroll() - delta * 35);
            }, true);
            list.content.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                event.preventDefault();
                const index = this.getItemIndex(side, event), item = this.items[side][index];

                this.pressed[side] = index;
                if (!item) return;
                if (event.detail === 2) {
                    this.endDrag();
                    this.move(side, item);
                    return;
                }
                this.selected[side] = item;
                this.paintSelection(side);
                this.drag = { side, item, isDragging: false };
                manager.playPickupSound();
                if (this.onTooltip) this.onTooltip(item, list.content.children[index] as HTMLElement, side ? 0x20 : 0, true);
            });
        });
        layer.button(this.element, 112, 194, 15, 15, "L2UI_CH3.ScrollBar.ScrollBarUpBtn", "L2UI_CH3.ScrollBar.ScrollBarUpOnBtn", null, null, () => {
            const row = this.getPressedItem(1);

            if (!row) return;
            this.items[1].splice(this.items[1].indexOf(row), 1);
            this.drawCounter();
            void this.paintItems();
        });
        layer.button(this.element, 130, 194, 15, 15, "L2UI_CH3.ScrollBar.ScrollBarDownBtn", "L2UI_CH3.ScrollBar.ScrollBarDownOnBtn", null, null, () => {
            const row = this.getPressedItem(0);

            if (row && this.onPrice) this.onPrice(row);
        });
        layer.button(this.element, 171, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(428), () => {
            const entries = this.items[1].map(row => ({ recipeId: row.recipe.id, cost: row.price }));

            if (this.onStart) this.onStart(entries);
            this.setVisible(false);
        });
        layer.button(this.element, 91, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(384), () => { if (this.onMessage) this.onMessage(); });
        layer.button(this.element, 11, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(385), () => {
            if (this.onQuit) this.onQuit();
            this.setVisible(false);
            manager.playWindowCloseSound();
        });
        window.addEventListener("mousemove", event => {
            if (!this.drag) return;
            if (!(event.buttons & 1) || !this.isVisible()) { this.endDrag(); return; }
            if (this.drag.isDragging) return;

            this.drag.isDragging = true;
            document.documentElement.style.cursor = `url(${layer.getWrapUrl(manager.strings.itemIcons[this.drag.item.recipe.productId])}) 16 16, default`;
            document.documentElement.classList.add("ndom-item-drag");
        }, true);
        window.addEventListener("mouseup", event => {
            if (event.button !== 0 || !this.drag) return;
            const drag = this.drag, target = document.elementFromPoint(event.clientX, event.clientY), destination = this.lists[1 - drag.side];

            this.endDrag();
            if (!this.isVisible() || !target || !(destination.content.contains(target) || target === destination && (destination.children[1] as HTMLElement).hidden)) return;
            if (this.getItemIndex(drag.side, event) >= 0) return;

            this.move(drag.side, drag.item);
        }, true);
        window.addEventListener("blur", () => this.endDrag());
        window.addEventListener("pointercancel", () => this.endDrag());
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 302, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public getGrid(side: number) { return this.lists[side]; }
    public getItems(side: number) { return this.items[side]; }
    public getPressedItem(side: number) { return this.items[side][this.pressed[side]]; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (visible) return;

        this.generation++;
        this.endDrag();
        this.items = [[], []];
        this.pressed.fill(-1);
        this.selected.fill(null);
        this.lists.forEach(list => { list.content.replaceChildren(); list.setContentHeight(0); });
        this.drawCounter();
        if (this.onHideTooltip) this.onHideTooltip();
    }
    public cancel() {
        if (this.onCancel) this.onCancel();
        this.setVisible(false);
        this.layer.getManager().playWindowCloseSound();
    }
    public async show(list: RecipeShopManageList_T) {
        this.setVisible(false);
        const manager = this.layer.getManager(), title = manager.getSysString(list.isDwarven ? 1213 : 1212);
        const add = (side: number, recipeId: number, initialCount: number, price: number) => {
            const recipe = manager.strings.recipes.find(recipe => recipe.id === recipeId);

            if (recipe && this.items[side].length < 160) this.items[side].push({ recipe, initialCount, price });
        };

        list.recipes.forEach(entry => add(0, entry.recipeId, entry.index, 0));
        list.items.forEach(entry => add(1, entry.recipeId, entry.unknown, entry.cost));
        this.layer.renderText(this.caption, title, 0xffc8d2dc);
        this.element.setAttribute("aria-label", title);
        this.drawCounter();
        this.setVisible(true);
        this.element.focus();
        await this.paintItems();
    }
    public transfer(row: RecipeShopRow_T, price: number) {
        if (!this.items[0].includes(row)) return;

        row.price = price | 0;
        this.selected[0] = null;
        this.pressed[0] = -1;
        if (!this.items[1].some(item => item.recipe.itemId === row.recipe.itemId) && this.items[1].length < 160) this.items[1].push({ ...row });
        this.drawCounter();
        void this.paintItems();
    }
    public remove(row: RecipeShopRow_T) {
        const index = this.items[1].indexOf(row);

        if (index < 0) return;
        this.items[1].splice(index, 1);
        this.selected[1] = null;
        this.pressed[1] = -1;
        this.drawCounter();
        void this.paintItems();
    }
    protected move(side: number, row: RecipeShopRow_T) {
        if (side) this.remove(row);
        else if (this.onPrice) this.onPrice(row);
    }
    protected getItemIndex(side: number, event: MouseEvent) {
        const list = this.lists[side], rect = list.getBoundingClientRect();
        const x = this.layer.toUI(event.clientX - rect.left), y = this.layer.toUI(event.clientY - rect.top);

        if (x < 0 || x > 222 || y < 0 || y > 139) return -1;

        return (this.lists[side].getScroll() / 35 + Math.min(3, Math.trunc(y / 35))) * 6 + Math.min(5, Math.trunc(x / 37));
    }
    protected paintSelection(side: number) {
        this.lists[side].content.querySelectorAll<HTMLElement>("[data-selected]").forEach((frame, index) => frame.hidden = this.items[side][index] !== this.selected[side]);
    }
    protected async paintItems() {
        const generation = ++this.generation, strings = this.layer.getManager().strings;

        await this.layer.loadTextures([...new Set(this.items.flat().map(row => strings.itemIcons[row.recipe.productId]).filter(path => !!path))]);
        if (generation !== this.generation) return;

        this.lists.forEach((list, side) => {
            list.content.replaceChildren();
            const rowCount = Math.ceil(this.items[side].length / 6);

            list.setContentHeight(139 + Math.max(0, rowCount - 4) * 35);
            this.items[side].forEach((item, index) => {
                const button = document.createElement("button");

                button.type = "button";
                button.tabIndex = -1;
                button.draggable = false;
                button.className = "ndom-inventory-item";
                button.dataset.recipeId = String(item.recipe.id);
                button.dataset.itemId = String(item.recipe.itemId);
                button.setAttribute("aria-label", strings.itemNames[item.recipe.itemId] ?? "");
                this.layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, index % 6 === 5 ? 38 : 37, 35);
                const frame = this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_SELECTED);

                frame.dataset.selected = "";
                frame.hidden = item !== this.selected[side];
                if (strings.itemIcons[item.recipe.productId]) this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, strings.itemIcons[item.recipe.productId]);
                button.addEventListener("mouseenter", () => { if (this.onTooltip) this.onTooltip(item, button, side ? 0x20 : 0, item === this.selected[side]); });
                button.addEventListener("mouseleave", () => { if (this.onHideTooltip) this.onHideTooltip(); });
                list.content.appendChild(button);
            });
        });
    }
    protected drawCounter() {
        const text = `(${this.items[1].length}/20)`;

        this.layer.renderText(this.counter, text, 0xffb09b79);
        this.layer.place(this.counter, 251 - this.layer.measureText(text), 198);
    }
    protected endDrag() {
        if (!this.drag) return;

        this.drag = null;
        document.documentElement.style.cursor = "";
        document.documentElement.classList.remove("ndom-item-drag");
    }
}

export default NCRecipeShopWnd;
