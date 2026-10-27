import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES, type NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { RecipeInfo_T } from "../assets/decode-worker/decode-protocol";
import type { RecipeBook_T } from "../network/game-packets";
import SysString_T from "./sys-string";

const TEX_BACK = "L2UI_CH3.RecipeWnd.Recipe2_Back";
const TEX_SELECTED = "L2UI.NWindow.item_click";
const TEX_TRASH = "L2UI_CH3.InventoryWnd.Inventory_trash";
const TEX_TRASH_DRAG = "L2UI_CH3.InventoryWnd.Inventory_trash_Drag";

export class NCRecipeBookWnd {
    public static getTextures() { return [TEX_BACK, TEX_SELECTED, TEX_TRASH, TEX_TRASH_DRAG, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onOpen: (id: number) => void = null;
    public onDelete: (recipe: RecipeInfo_T) => void = null;
    public onDrop: (id: number, clientX: number, clientY: number) => void = null;
    public onTooltip: (recipe: RecipeInfo_T, button: HTMLElement, isDetailed: boolean) => void = null;
    public onHideTooltip: () => void = null;
    public onHide: () => void = null;
    protected readonly list: NDomScrollPane_T;
    protected readonly caption: HTMLDivElement;
    protected readonly counter: HTMLDivElement;
    protected readonly trash: HTMLDivElement;
    protected readonly trashNormal: HTMLElement;
    protected readonly trashDrag: HTMLElement;
    protected recipes: RecipeInfo_T[] = [];
    protected selected = -1;
    protected isDwarven = true;
    protected dwarfLimit = 0;
    protected commonLimit = 0;
    protected pressed = -1;
    protected hoverIndex = -1;
    protected isArmed = false;
    protected isHeld = false;
    protected isDragging = false;
    protected generation = 0;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.tabIndex = -1;
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        this.caption = NCFrameCtrl.createDOM(layer, this.element, 256, "", false, () => this.setVisible(false));
        layer.text(this.element, layer.getManager().getSysString(SysString_T.RecipeBook), 0xffdcdcdc, FontType_T.SMALL, 11, 32);
        this.counter = layer.text(this.element, "", 0xffb09b79, FontType_T.SMALL, 246, 33);
        this.list = layer.scrollPane(this.element, 9, 48, 239, 279, 35);
        this.list.tabIndex = -1;
        this.list.addEventListener("scroll", () => this.showRecipeTooltip());
        this.trash = layer.createWindow(208, 347, 34, 34, this.element);
        this.trashNormal = layer.tile(this.trash, 0, 0, 32, 32, 0, 0, 32, 32, TEX_TRASH);
        this.trashDrag = layer.tile(this.trash, 0, 0, 32, 32, 0, 0, 32, 32, TEX_TRASH_DRAG);
        this.trashDrag.hidden = true;
        layer.tooltip(this.element, this.trash, layer.getManager().getSysString(SysString_T.Destruction));
        this.list.addEventListener("wheel", event => {
            event.stopImmediatePropagation();
            const delta = typeof (event as any).wheelDelta === "number" ? Math.trunc((event as any).wheelDelta / 120) : -Math.sign(event.deltaY);

            this.list.setScroll(this.list.getScroll() - delta * 35);
        }, true);
        this.list.addEventListener("mousedown", event => {
            if (event.button !== 0 && event.button !== 2) return;
            if (event.target !== this.list && !this.list.content.contains(event.target as Node)) return;

            event.preventDefault();
            this.list.focus();
            if (event.button !== 0) return;

            layer.beginDrag(moveEvent => {
                if (document.activeElement !== this.list) return;

                this.moveRecipe(moveEvent);
            }, stopEvent => {
                this.isHeld = false;
                const recipe = this.recipes[this.pressed], armed = this.isArmed;
                const release = stopEvent instanceof MouseEvent && (stopEvent.type === "mouseup" || stopEvent.type === "pointerup") && stopEvent.button === 0 && document.activeElement === this.list;
                const overTrash = release && this.isOverTrash(stopEvent);

                this.endDrag();
                if (release) this.isArmed = false;
                if (!release || !recipe || !this.isVisible()) return;
                if (overTrash) { if (this.onDelete) this.onDelete(recipe); }
                else if (armed && this.onDrop) this.onDrop(recipe.id, stopEvent.clientX, stopEvent.clientY);
            });
            this.isHeld = true;
            this.pressed = this.getIndex(event);
            const recipe = this.recipes[this.pressed];

            if (event.detail === 2) {
                this.selected = this.pressed = -1;
                this.isArmed = false;
                this.paintSelection();
                this.showRecipeTooltip();
                if (recipe && this.onOpen) this.onOpen(recipe.id);
                return;
            }
            this.hoverIndex = this.pressed;
            if (!recipe) { this.showRecipeTooltip(); return; }

            this.selected = this.pressed;
            this.isArmed = true;
            this.paintSelection();
            this.showRecipeTooltip();
        });
        this.list.addEventListener("mousemove", event => {
            if (event.target !== this.list && !this.list.content.contains(event.target as Node)) {
                if (this.onHideTooltip) this.onHideTooltip();
                return;
            }
            if (!(event.buttons & 1) || (this.isHeld && document.activeElement === this.list)) this.moveRecipe(event);
            else this.showRecipeTooltip();
        });
        this.list.addEventListener("mouseenter", () => this.showRecipeTooltip());
        this.list.addEventListener("mouseleave", () => { if (this.onHideTooltip) this.onHideTooltip(); });
        this.list.addEventListener("contextmenu", event => event.preventDefault());
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 558, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; if (!visible) { this.endDrag(); if (this.onHideTooltip) this.onHideTooltip(); if (this.onHide) this.onHide(); } }
    public getGrid() { return this.list; }
    public setLimits(dwarf: number, common: number) { this.dwarfLimit = dwarf; this.commonLimit = common; this.drawCounter(); }
    public async show(book: RecipeBook_T) {
        const strings = this.layer.getManager().strings;

        this.endDrag();
        this.selected = this.pressed = this.hoverIndex = -1;
        this.list.content.replaceChildren();
        this.list.setScroll(0);
        if (this.onHideTooltip) this.onHideTooltip();
        this.isDwarven = book.isDwarven;
        this.recipes = [];
        for (const entry of book.recipes) {
            const recipe = strings.recipes.find(recipe => recipe.id === entry.recipeId);

            if (recipe && this.recipes.length < 160) this.recipes.push(recipe);
        }
        const title = this.layer.getManager().getSysString(book.isDwarven ? SysString_T.DwarfRecipeBook : SysString_T.GeneralRecipeBook);

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
    protected moveRecipe(event: MouseEvent) {
        this.hoverIndex = this.getIndex(event);
        if (document.activeElement === this.list) {
            const recipe = this.recipes[this.pressed];

            if (this.isArmed && recipe) {
                this.isDragging = true;
                this.layer.getManager().setCursor(`url(${this.layer.getWrapUrl(this.layer.getManager().strings.itemIcons[recipe.productId])}) 16 16, default`);
                document.documentElement.classList.add("ndom-item-drag");
            }
            this.trashNormal.hidden = this.isOverTrash(event);
            this.trashDrag.hidden = !this.trashNormal.hidden;
        }
        this.showRecipeTooltip();
    }
    protected showRecipeTooltip() {
        const recipe = this.recipes[this.hoverIndex], button = this.list.content.children[this.hoverIndex] as HTMLElement;
        const hovered = this.list.querySelector(":scope > :hover");

        if (!recipe || !button || !this.list.matches(":hover") || (hovered && hovered !== this.list.content) || !this.isVisible()) {
            if (this.onHideTooltip) this.onHideTooltip();
            return;
        }
        if (this.onTooltip) this.onTooltip(recipe, button, this.hoverIndex === this.selected);
    }
    protected endDrag() {
        if (this.isHeld) this.layer.cancelDrag();
        if (this.isDragging) {
            this.layer.getManager().setCursor("");
            document.documentElement.classList.remove("ndom-item-drag");
        }
        this.isDragging = false;
        this.trashNormal.hidden = false;
        this.trashDrag.hidden = true;
    }
}

export default NCRecipeBookWnd;
