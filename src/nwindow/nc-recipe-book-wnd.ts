import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES } from "./ndom";
import type { NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { RecipeInfo_T } from "../assets/decode-worker/decode-protocol";
import type { RecipeBook_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.RecipeWnd.Recipe2_Back";
const TEX_SELECTED = "L2UI.NWindow.item_click";
const TEX_TRASH = "L2UI_CH3.InventoryWnd.Inventory_trash";
const TEX_TRASH_DRAG = "L2UI_CH3.InventoryWnd.Inventory_trash_Drag";

type RecipeDrag_T = { recipe: RecipeInfo_T, isDragging: boolean };

export class NCRecipeBookWnd {
    public static getTextures() { return [TEX_BACK, TEX_SELECTED, TEX_TRASH, TEX_TRASH_DRAG, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onOpen: (id: number) => void = null;
    public onDelete: (recipe: RecipeInfo_T) => void = null;
    public onDrop: (id: number, clientX: number, clientY: number) => void = null;
    public onTooltip: (recipe: RecipeInfo_T, button: HTMLElement, isDetailed: boolean) => void = null;
    public onHideTooltip: () => void = null;
    protected readonly list: NDomScrollPane_T;
    protected readonly caption: HTMLCanvasElement;
    protected readonly counter: HTMLCanvasElement;
    protected readonly trash: HTMLDivElement;
    protected readonly trashNormal: HTMLElement;
    protected readonly trashDrag: HTMLElement;
    protected recipes: RecipeInfo_T[] = [];
    protected selected = -1;
    protected isDwarven = true;
    protected dwarfLimit = 0;
    protected commonLimit = 0;
    protected drag: RecipeDrag_T = null;
    protected generation = 0;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        this.caption = NCFrameCtrl.createDOM(layer, this.element, 256, "", false, () => this.setVisible(false));
        layer.text(this.element, layer.getManager().getSysString(649), 0xffdcdcdc, FontType_T.SMALL, 11, 32);
        this.counter = layer.text(this.element, "", 0xffb09b79, FontType_T.SMALL, 246, 33);
        this.list = layer.scrollPane(this.element, 9, 48, 239, 279, 35);
        this.trash = layer.createWindow(208, 347, 34, 34, this.element);
        this.trashNormal = layer.tile(this.trash, 0, 0, 32, 32, 0, 0, 32, 32, TEX_TRASH);
        this.trashDrag = layer.tile(this.trash, 0, 0, 32, 32, 0, 0, 32, 32, TEX_TRASH_DRAG);
        this.trashDrag.hidden = true;
        layer.tooltip(this.element, this.trash, layer.getManager().getSysString(890));
        this.list.addEventListener("wheel", event => {
            event.stopImmediatePropagation();
            const delta = typeof (event as any).wheelDelta === "number" ? Math.trunc((event as any).wheelDelta / 120) : -Math.sign(event.deltaY);

            this.list.setScroll(this.list.getScroll() - delta * 35);
        }, true);
        this.list.content.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            const index = this.getIndex(event), recipe = this.recipes[index];

            if (!recipe) return;
            if (event.detail === 2) {
                this.endDrag();
                this.selected = -1;
                this.paintSelection();
                if (this.onOpen) this.onOpen(recipe.id);
                return;
            }
            this.selected = index;
            this.paintSelection();
            this.drag = { recipe, isDragging: false };
            if (this.onTooltip) this.onTooltip(recipe, this.list.content.children[index] as HTMLElement, true);
        });
        window.addEventListener("mousemove", event => {
            if (!this.drag) return;
            if (!(event.buttons & 1) || !this.isVisible()) { this.endDrag(); return; }

            this.trashNormal.hidden = this.isOverTrash(event);
            this.trashDrag.hidden = !this.trashNormal.hidden;
            if (this.drag.isDragging) return;

            this.drag.isDragging = true;
            this.layer.getManager().setCursor(`url(${layer.getWrapUrl(layer.getManager().strings.itemIcons[this.drag.recipe.productId])}) 16 16, default`);
            document.documentElement.classList.add("ndom-item-drag");
        }, true);
        window.addEventListener("mouseup", event => {
            if (event.button !== 0 || !this.drag) return;

            const recipe = this.drag.recipe, isOverTrash = this.isOverTrash(event);

            this.endDrag();
            if (!this.isVisible()) return;
            if (isOverTrash) { if (this.onDelete) this.onDelete(recipe); }
            else if (this.onDrop) this.onDrop(recipe.id, event.clientX, event.clientY);
        }, true);
        window.addEventListener("blur", () => this.endDrag());
        window.addEventListener("pointercancel", () => this.endDrag());
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 558, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; if (!visible) { this.endDrag(); if (this.onHideTooltip) this.onHideTooltip(); } }
    public setLimits(dwarf: number, common: number) { this.dwarfLimit = dwarf; this.commonLimit = common; this.drawCounter(); }
    public async show(book: RecipeBook_T) {
        const strings = this.layer.getManager().strings;

        this.endDrag();
        this.selected = -1;
        this.list.content.replaceChildren();
        if (this.onHideTooltip) this.onHideTooltip();
        this.isDwarven = book.isDwarven;
        this.recipes = [];
        for (const entry of book.recipes) {
            const recipe = strings.recipes.find(recipe => recipe.id === entry.recipeId);

            if (recipe && this.recipes.length < 160) this.recipes.push(recipe);
        }
        const title = this.layer.getManager().getSysString(book.isDwarven ? 1215 : 1214);

        this.layer.renderText(this.caption, title, 0xffc8d2dc);
        this.element.setAttribute("aria-label", title);
        this.drawCounter();
        this.setVisible(true);
        this.element.focus();
        const generation = ++this.generation;

        await this.layer.loadTextures(this.recipes.map(recipe => strings.itemIcons[recipe.productId]));
        if (generation !== this.generation) return;

        this.list.content.replaceChildren();
        this.list.setContentHeight(279 + Math.max(0, Math.ceil(this.recipes.length / 6) - 8) * 35);
        this.recipes.forEach((recipe, index) => {
            const button = document.createElement("button");

            button.type = "button";
            button.tabIndex = -1;
            button.className = "ndom-inventory-item";
            button.setAttribute("aria-label", strings.itemNames[recipe.itemId]);
            button.dataset.recipeId = String(recipe.id);
            this.layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, index % 6 === 5 ? 38 : 37, 35);
            const selected = this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_SELECTED);

            selected.dataset.selected = "";
            selected.hidden = index !== this.selected;
            this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, strings.itemIcons[recipe.productId]);
            button.addEventListener("mouseenter", () => { if (this.onTooltip) this.onTooltip(recipe, button, index === this.selected); });
            button.addEventListener("mouseleave", () => { if (this.onHideTooltip) this.onHideTooltip(); });
            this.list.content.appendChild(button);
        });
    }

    protected drawCounter() {
        const text = `(${this.recipes.length}/${this.isDwarven ? this.dwarfLimit : this.commonLimit})`;

        this.layer.renderText(this.counter, text, 0xffb09b79);
        this.layer.place(this.counter, 246 - this.layer.measureText(text), 33);
    }
    protected getIndex(event: MouseEvent) {
        const rect = this.list.getBoundingClientRect(), x = this.layer.toUI(event.clientX - rect.left), y = this.layer.toUI(event.clientY - rect.top);

        if (x < 0 || x > 222 || y < 0 || y > 280) return -1;

        return (Math.min(7, Math.trunc(y / 35)) + Math.trunc(this.list.getScroll() / 35)) * 6 + Math.min(5, Math.trunc(x / 37));
    }
    protected isOverTrash(event: MouseEvent) {
        const rect = this.trash.getBoundingClientRect();

        if (!this.element.contains(document.elementFromPoint(event.clientX, event.clientY))) return false;

        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }
    protected paintSelection() { Array.from(this.list.content.children).forEach((button, index) => { (button.querySelector("[data-selected]") as HTMLElement).hidden = index !== this.selected; }); }
    protected endDrag() {
        this.drag = null;
        this.trashNormal.hidden = false;
        this.trashDrag.hidden = true;
        this.layer.getManager().setCursor("");
        document.documentElement.classList.remove("ndom-item-drag");
    }
}

export default NCRecipeBookWnd;
