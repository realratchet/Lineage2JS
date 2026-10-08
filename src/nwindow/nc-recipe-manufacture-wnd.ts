import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES } from "./ndom";
import type { NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { RecipeInfo_T } from "../assets/decode-worker/decode-protocol";
import type { InventoryItem_T, RecipeItemMakeInfo_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.RecipeWnd.Recipe4_Back";
const TEX_MP = "L2UI_CH3.PlayerStatusWnd.ps_mpbar";
const TEX_TREE = "L2UI.RecipeWnd.RecipeTreeBtn";
const TEX_TREE_DOWN = "L2UI.RecipeWnd.RecipeTreeBtn_click";
const TEX_OUTLINE = "L2UI_CH3.Etc.menu_outline";
const TEX_OUTLINE_DOWN = "L2UI_CH3.Etc.menu_outline_down";
const TEX_SHORTAGE = "NWindow.ChatBack";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_Normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_NormalOn";

type RecipeMaterial_T = { itemId: number, count: number, required: number };

export function getRecipeMpWidth(current: number, maximum: number) { return maximum === 0 ? 0 : Math.min(165, Math.max(0, Math.trunc(Math.imul(current, 165) / maximum))); }

export class NCRecipeManufactureWnd {
    public static getTextures() { return [TEX_BACK, TEX_MP, TEX_TREE, TEX_TREE_DOWN, TEX_OUTLINE, TEX_OUTLINE_DOWN, TEX_SHORTAGE, TEX_BUTTON, TEX_BUTTON_DOWN, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onCreate: (id: number) => void = null;
    public onBack: (isDwarven: boolean) => void = null;
    public onTree: (recipe: RecipeInfo_T) => void = null;
    public onTooltip: (material: RecipeMaterial_T, button: HTMLElement, isDetailed: boolean) => void = null;
    public onHideTooltip: () => void = null;
    protected readonly header: HTMLDivElement;
    protected readonly result: HTMLDivElement;
    protected readonly mp: HTMLDivElement;
    protected readonly list: NDomScrollPane_T;
    protected readonly inventoryCount: HTMLCanvasElement;
    protected recipe: RecipeInfo_T = null;
    protected materials: RecipeMaterial_T[] = [];
    protected selected = -1;
    protected generation = 0;
    protected isDwarven = true;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(663), false, () => this.setVisible(false));
        this.element.setAttribute("aria-label", manager.getSysString(663));
        this.header = layer.createWindow(0, 20, 256, 90, this.element);
        layer.text(this.element, manager.getSysString(742), 0xffdcdcdc, FontType_T.SMALL, 11, 124);
        layer.text(this.element, manager.getSysString(743), 0xffdcdcdc, FontType_T.SMALL, 11, 290);
        layer.text(this.element, manager.getSysString(644), 0xffdcdcdc, FontType_T.SMALL, 18, 261);
        this.mp = layer.tile(this.element, 75, 261, 165, 12, 0, 0, 8, 12, TEX_MP);
        const countLabel = manager.getSysString(648), separatorX = 14 + layer.measureText(countLabel);

        layer.text(this.element, countLabel, 0xffa3a3a3, FontType_T.SMALL, 14, 313);
        layer.text(this.element, " : ", 0xffdcdcdc, FontType_T.SMALL, separatorX, 313);
        this.inventoryCount = layer.text(this.element, "", 0xffb09b79, FontType_T.SMALL, separatorX + layer.measureText(" : "), 313);
        this.result = layer.createWindow(14, 329, 226, 39, this.element);
        this.list = layer.scrollPane(this.element, 10, 141, 238, 103, 35);
        this.list.addEventListener("wheel", event => {
            event.stopImmediatePropagation();
            const delta = typeof (event as any).wheelDelta === "number" ? Math.trunc((event as any).wheelDelta / 120) : -Math.sign(event.deltaY);

            this.list.setScroll(this.list.getScroll() - delta * 35);
        }, true);
        this.list.content.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2) return;

            event.preventDefault();
            const button = (event.target as HTMLElement).closest("[data-material-index]") as HTMLElement;

            if (!button) return;
            this.selected = Number(button.dataset.materialIndex);
            manager.playPickupSound();
            if (this.onTooltip) this.onTooltip(this.materials[this.selected], button, true);
        });
        const outline = layer.tile(this.element, 205, 70, 36, 36, 0, 0, 34, 34, TEX_OUTLINE);
        const treeButton = layer.button(this.element, 206, 71, 32, 32, TEX_TREE, TEX_TREE_DOWN, null, null, () => { if (this.onTree) this.onTree(this.recipe); });

        treeButton.addEventListener("mouseenter", () => layer.setTile(outline, 36, 36, 0, 0, 34, 34, TEX_OUTLINE_DOWN));
        treeButton.addEventListener("mouseleave", () => layer.setTile(outline, 36, 36, 0, 0, 34, 34, TEX_OUTLINE));
        layer.tooltip(this.element, treeButton, manager.getSysString(662));
        layer.button(this.element, 11, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(645), () => { if (this.onCreate) this.onCreate(this.recipe.id); });
        layer.button(this.element, 91, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(543), () => {
            this.setVisible(false);
            if (this.onBack) this.onBack(this.isDwarven);
            manager.playWindowCloseSound();
        });
        layer.button(this.element, 171, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(646), () => this.close());
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 558, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; if (!visible && this.onHideTooltip) this.onHideTooltip(); }
    protected close() { this.setVisible(false); this.layer.getManager().playWindowCloseSound(); }
    public setInventory(items: InventoryItem_T[]) {
        if (!this.recipe) return;

        let count = 0;

        for (const item of items)
            if (!item.isEquipped && item.itemId === this.recipe.productId) count += item.count;
        this.layer.renderText(this.inventoryCount, String(count), 0xffb09b79);
    }
    public async show(recipe: RecipeInfo_T, state: RecipeItemMakeInfo_T, inventory: InventoryItem_T[]) {
        const manager = this.layer.getManager(), strings = manager.strings, generation = ++this.generation;

        this.recipe = recipe;
        this.isDwarven = state.isDwarven;
        this.selected = -1;
        this.header.replaceChildren();
        this.list.content.replaceChildren();
        this.result.replaceChildren();
        if (this.onHideTooltip) this.onHideTooltip();
        this.materials = recipe.materials.slice(0, 160).map(([itemId, required]) => ({ itemId, required, count: inventory.reduce((count, item) => count + (!item.isEquipped && item.itemId === itemId ? item.count : 0), 0) }));
        this.setInventory(inventory);
        const width = getRecipeMpWidth(state.curMp, state.maxMp);

        this.mp.hidden = !(width > 0);
        if (width > 0) {
            this.layer.place(this.mp, 75, 261, width, 12);
            this.layer.setTile(this.mp, width, 12, 0, 0, 8, 12, TEX_MP);
        }
        if (state.status === 0 || state.status === 1) {
            const text = manager.getSystemMessage(state.status === 0 ? 960 : 959).replace(/\$[sc](\d)/g, (match, index) => [strings.itemNames[recipe.productId], state.status === 0 ? "0" : String(recipe.count)][Number(index) - 1] ?? match);
            const lines = manager.canvas.wrapText(text.replace(/\\n/g, "\n"), 226);

            lines.forEach((line, index) => this.layer.text(this.result, line, 0xffb2becf, FontType_T.SMALL, 0, index * manager.canvas.getLineHeight(FontType_T.SMALL)));
        }
        this.setVisible(true);
        this.element.focus();
        const grade = strings.itemInfos[recipe.productId].crystalType, gradeSymbol = ["", "graded", "gradec", "gradeb", "gradea", "grades"][grade];

        await this.layer.loadTextures([strings.itemIcons[recipe.productId], ...this.materials.map(material => strings.itemIcons[material.itemId]), ...(gradeSymbol ? [strings.symbols[gradeSymbol]] : [])]);
        if (generation !== this.generation) return;

        this.layer.tile(this.header, 16, 29, 32, 32, 0, 0, 32, 32, strings.itemIcons[recipe.productId]);
        const name = strings.itemNames[recipe.productId];

        this.layer.text(this.header, name, 0xffdcdcdc, FontType_T.SMALL, 58, 28);
        if (gradeSymbol) this.layer.tile(this.header, 60 + this.layer.measureText(name), 28, 12, 12, 0, 0, 12, 12, strings.symbols[gradeSymbol]);
        [[320, recipe.mpCost], [642, `${recipe.successRate}%`], [647, recipe.count]].forEach(([id, value], index) => {
            const label = manager.getSysString(Number(id)), y = 44 + index * 16, x = 58 + this.layer.measureText(label);

            this.layer.text(this.header, label, 0xffa3a3a3, FontType_T.SMALL, 58, y);
            this.layer.text(this.header, " : ", 0xffdcdcdc, FontType_T.SMALL, x, y);
            this.layer.text(this.header, String(value), 0xffb09b79, FontType_T.SMALL, x + this.layer.measureText(" : "), y);
        });
        this.list.setContentHeight(103 + Math.max(0, Math.ceil(this.materials.length / 6) - 3) * 35);
        this.materials.forEach((material, index) => {
            const button = document.createElement("button");

            button.type = "button";
            button.tabIndex = -1;
            button.className = "ndom-inventory-item";
            button.dataset.materialIndex = String(index);
            button.dataset.itemId = String(material.itemId);
            button.setAttribute("aria-label", strings.itemNames[material.itemId]);
            this.layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, 37, 35);
            this.layer.tile(button, 0, 0, 32, 32, 0, 0, 32, 32, strings.itemIcons[material.itemId]);
            if (material.count < material.required) this.layer.tile(button, 0, 0, 32, 32, 0, 0, 32, 32, TEX_SHORTAGE);
            button.addEventListener("mouseenter", () => { if (this.onTooltip) this.onTooltip(material, button, true); });
            button.addEventListener("mouseleave", () => { if (this.onHideTooltip) this.onHideTooltip(); });
            this.list.content.appendChild(button);
        });
    }
}

export default NCRecipeManufactureWnd;
