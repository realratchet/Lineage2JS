import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES } from "./ndom";
import type { NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { RecipeInfo_T } from "../assets/decode-worker/decode-protocol";
import { ItemType2_T } from "../network/game-packets";
import type { InventoryItem_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.RecipeWnd.Recipe5_Back";
const TEX_NODE = "L2UI.RecipeWnd.RecipeTreeIconBack";
const TEX_OPEN = "L2UI.RecipeWnd.RecipeTreeIconBack_click";
const TEX_LEAF = "L2UI.RecipeWnd.RecipeTreeIconDisableBack";
const TEX_PLUS = "L2UI.RecipeWnd.TreePlus";
const TEX_MINUS = "L2UI.RecipeWnd.TreeMinus";
const TEX_SHORTAGE = "NWindow.ChatBack";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_Normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_NormalOn";
const arrGrades = ["", "graded", "gradec", "gradeb", "gradea", "grades"];

type RecipeNode_T = { itemId: number, required: number, available: number, isExpanded: boolean, children: RecipeNode_T[] };

export class NCRecipeTreeWnd {
    public static getTextures() { return [TEX_BACK, TEX_NODE, TEX_OPEN, TEX_LEAF, TEX_PLUS, TEX_MINUS, TEX_SHORTAGE, TEX_BUTTON, TEX_BUTTON_DOWN, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    protected readonly header: HTMLDivElement;
    protected readonly list: NDomScrollPane_T;
    protected root: RecipeNode_T = null;
    protected generation = 0;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, layer.getManager().getSysString(662), false, () => this.setVisible(false));
        this.header = layer.createWindow(0, 20, 256, 88, this.element);
        this.list = layer.scrollPane(this.element, 7, 108, 242, 254, 15, true);
        const viewport = layer.createWindow(0, 0, 226, 246, this.list);

        viewport.style.overflow = "hidden";
        viewport.appendChild(this.list.content);
        layer.place(this.list.content, 0, 0, 226);
        this.list.addEventListener("wheel", event => {
            event.stopImmediatePropagation();
            const delta = typeof (event as any).wheelDelta === "number" ? Math.trunc((event as any).wheelDelta / 120) : -Math.sign(event.deltaY);

            this.list.setScroll(this.list.getScroll() - delta * 45);
        }, true);
        layer.button(this.element, 91, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, layer.getManager().getSysString(646), () => {
            this.root = null;
            this.list.content.replaceChildren();
            this.list.setScroll(0, false);
            this.setVisible(false);
            layer.getManager().playWindowCloseSound();
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 558, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }

    public async show(recipe: RecipeInfo_T, inventory: InventoryItem_T[]) {
        const strings = this.layer.getManager().strings, generation = ++this.generation;
        const makeNode = (itemId: number, successRate: number, required: number): RecipeNode_T => {
            if (!strings.itemInfos[itemId]) return null;

            const match = strings.recipes.find(entry => entry.productId === itemId && entry.successRate === successRate);

            return { itemId, required, available: inventory.reduce((count, item) => count + (item.itemId === itemId && !item.isEquipped && item.type2 !== ItemType2_T.TYPE2_QUEST ? item.count : 0), 0), isExpanded: false, children: match ? match.materials.map(([id, count]) => makeNode(id, 100, count)).filter(node => !!node) : [] };
        };
        this.root = makeNode(recipe.productId, recipe.successRate, 0);
        this.header.replaceChildren();
        this.list.content.replaceChildren();
        this.list.setScroll(0, false);
        const ids: number[] = [];
        function collect(node: RecipeNode_T) { ids.push(node.itemId); node.children.forEach(collect); }
        collect(this.root);
        const grade = strings.itemInfos[recipe.productId]?.crystalType ?? 0;

        this.setVisible(true);
        this.element.focus();
        await this.layer.loadTextures([...ids.map(id => strings.itemIcons[id]), grade ? strings.symbols[arrGrades[grade]] : null].filter(path => !!path));
        if (generation !== this.generation) return;

        const name = strings.itemNames[recipe.productId];

        this.layer.tile(this.header, 16, 29, 32, 32, 0, 0, 32, 32, strings.itemIcons[recipe.productId]);
        this.layer.text(this.header, name, 0xffdcdcdc, FontType_T.SMALL, 58, 28);
        if (grade) this.layer.tile(this.header, 60 + this.layer.measureText(name), 28, 12, 12, 0, 0, 12, 12, strings.symbols[arrGrades[grade]]);
        [[320, String(recipe.mpCost)], [642, `${recipe.successRate}%`]].forEach(([id, value], index) => {
            const label = this.layer.getManager().getSysString(id as number), x = 58 + this.layer.measureText(label);

            this.layer.text(this.header, label, 0xffa3a3a3, FontType_T.SMALL, 58, 44 + index * 16);
            this.layer.text(this.header, " : ", 0xffdcdcdc, FontType_T.SMALL, x, 44 + index * 16);
            this.layer.text(this.header, value as string, 0xffb09b79, FontType_T.SMALL, x + this.layer.measureText(" : "), 44 + index * 16);
        });
        this.layer.text(this.header, `Lv.${recipe.level}`, 0xffdcdcdc, FontType_T.SMALL, 214, 57);
        this.paintRows();
    }

    protected paintRows() {
        this.list.content.replaceChildren();
        let y = 5;
        const paint = (node: RecipeNode_T, x: number) => {
            const strings = this.layer.getManager().strings, name = strings.itemNames[node.itemId];
            const row = document.createElement("button");

            row.type = "button";
            row.tabIndex = -1;
            row.className = "ndom-inventory-item";
            row.setAttribute("aria-label", name);
            row.dataset.itemId = String(node.itemId);
            this.layer.place(row, x, y, this.layer.measureText(name) + 34 + (node.children.length ? 16 : 0), 32);
            this.layer.tile(row, 0, 0, 32, 32, 0, 0, 32, 32, strings.itemIcons[node.itemId]);
            this.layer.tile(row, 0, 0, 32, 32, 0, 0, 32, 32, node.isExpanded ? TEX_OPEN : node.children.length ? TEX_NODE : TEX_LEAF);
            if (node.children.length) this.layer.tile(row, -14, 10, 12, 12, 0, 0, 12, 12, node.isExpanded ? TEX_MINUS : TEX_PLUS);
            this.layer.text(row, name, 0xffdcdcdc, FontType_T.SMALL, 37, 4);
            if (node !== this.root) {
                this.layer.text(row, `(${node.available}/${node.required})`, 0xffdcdcdc, FontType_T.SMALL, 37, 18);
                if (node.available < node.required) this.layer.tile(row, 0, 0, 32, 32, 0, 0, 32, 32, TEX_SHORTAGE);
            }
            row.addEventListener("mousedown", event => {
                if (event.button !== 0 || event.detail === 2 || !node.children.length) return;
                const rect = row.getBoundingClientRect();

                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
                if (event.clientX === rect.left && event.clientY === rect.top) return;

                event.preventDefault();
                node.isExpanded = !node.isExpanded;
                this.paintRows();
            });
            this.list.content.appendChild(row);
            y += 37;
            if (node.isExpanded) node.children.forEach(child => paint(child, x + 16));
        };

        if (this.root) paint(this.root, 15);
        this.list.setContentHeight(y - 5 + 21, true);
    }
}

export default NCRecipeTreeWnd;
