import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES, NDOM_EDIT_TEXTURES } from "./ndom";
import type { NDomScrollPane_T, NDomEdit_T } from "./ndom";
import type NCInventoryWnd from "./nc-inventory-wnd";
import type { InventoryEntry_T } from "./nc-inventory-wnd";
import { FontType_T } from "./nwindow-canvas";
import type { MultiSellList_T, MultiSellEntry_T, MultiSellProduct_T, MultiSellIngredient_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.MultiSellWnd.multicell_back";
const TEX_PLUS = "L2UI_CH3.MultiSellWnd.Multisell_plusicon";
const TEX_ICONBOX = "L2ui_ch3.etc.iconbox";
const TEX_SELECTED = "L2UI.NWindow.item_click";

type MultiSellItem_T = MultiSellProduct_T | MultiSellIngredient_T;

export class NCVIPShopWnd {
    public static getTextures() { return [TEX_BACK, TEX_PLUS, TEX_SELECTED, TEX_ICONBOX, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES, ...NDOM_EDIT_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onConfirm: (listId: number, entryId: number, amount: number) => void = null;
    public onSelect: () => void = null;
    public onHide: () => void = null;
    protected readonly catalog: NDomScrollPane_T;
    protected readonly products: NDomScrollPane_T;
    protected readonly ingredients: NDomScrollPane_T;
    protected readonly quantity: NDomEdit_T;
    protected entries: MultiSellEntry_T[] = [];
    protected catalogItems: InventoryEntry_T[] = [];
    protected listId = 0;
    protected selectedIndex = -1;
    protected generation = 0;

    public constructor(protected readonly layer: NDomLayer, protected readonly inventory: NCInventoryWnd) {
        this.element = layer.createWindow(0, 0, 512, 401);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        layer.tile(this.element, 0, 20, 512, 381, 0, 0, 512, 381, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 512, layer.getManager().getSysString(136), false, () => this.setVisible(false));
        [[562, 11, 32], [564, 267, 32], [565, 267, 203]].forEach(([id, x, y]) => layer.text(this.element, layer.getManager().getSysString(id), 0xffdcdcdc, FontType_T.SMALL, x, y));
        const quantityLabel = layer.getManager().getSysString(808);

        layer.text(this.element, quantityLabel, 0xffdcdcdc, FontType_T.SMALL, 164 - layer.measureText(quantityLabel), 378);
        this.catalog = layer.scrollPane(this.element, 9, 48, 240, 314, 35);
        this.products = layer.scrollPane(this.element, 262, 45, 244, 150, 15, true);
        this.ingredients = layer.scrollPane(this.element, 262, 217, 244, 150, 15, true);
        this.quantity = layer.edit(this.element, 165, 374, 63, 17, false, 0, true);
        layer.button(this.element, 307, 372, 76, 23, "L2UI_CH3.Button.Btn1_Normal", "L2UI_CH3.Button.Btn1_NormalOn", null, layer.getManager().getSysString(140), () => {
            const entry = this.entries[this.selectedIndex];

            if (entry && this.onConfirm) this.onConfirm(this.listId, entry.entryId, parseInt(this.quantity.getValue().replace(/,/g, ""), 10) | 0);
        });
        layer.button(this.element, 387, 372, 76, 23, "L2UI_CH3.Button.Btn1_Normal", "L2UI_CH3.Button.Btn1_NormalOn", null, layer.getManager().getSysString(141), () => this.setVisible(false));
        [this.catalog, this.products, this.ingredients].forEach((pane, index) => {
            pane.addEventListener("wheel", event => {
                event.stopImmediatePropagation();
                const delta = typeof (event as any).wheelDelta === "number" ? Math.trunc((event as any).wheelDelta / 120) : -Math.sign(event.deltaY);

                pane.setScroll(pane.getScroll() - delta * (index ? 45 : 35));
                this.inventory.hideTooltip();
            }, true);
            pane.addEventListener("mouseleave", () => this.inventory.hideTooltip());
        });
        this.catalog.content.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            if (this.onSelect) this.onSelect();
            const rect = this.catalog.getBoundingClientRect(), x = layer.toUI(event.clientX - rect.left), y = layer.toUI(event.clientY - rect.top);
            const index = x >= 0 && x <= 222 && y >= 0 && y <= 315 ? (this.catalog.getScroll() / 35 + Math.min(8, Math.trunc(y / 35))) * 6 + Math.min(5, Math.trunc(x / 37)) : -1;

            this.selectedIndex = index < this.catalogItems.length ? index : -1;
            this.catalog.content.querySelectorAll<HTMLElement>("[data-selected]").forEach((frame, i) => frame.hidden = i !== this.selectedIndex);
            const entry = this.entries[this.selectedIndex];

            if (!entry) return;
            if (entry.mode === 0 || entry.mode === 1) {
                this.quantity.setValue("1");
                this.quantity.setEnabled(entry.mode === 1);
            }
            this.paintDetails(entry);
            const button = this.catalog.content.children[this.selectedIndex] as HTMLElement;

            this.inventory.showTooltip(this.catalogItems[this.selectedIndex], button, true);
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (visible) return;

        this.clear(0);
        if (this.onHide) this.onHide();
    }
    public clear(listId: number) {
        this.generation++;
        this.entries = [];
        this.catalogItems = [];
        this.listId = listId;
        this.selectedIndex = -1;
        this.catalog.content.replaceChildren();
        this.catalog.setContentHeight(0);
        this.products.content.replaceChildren();
        this.ingredients.content.replaceChildren();
        this.inventory.hideTooltip();
    }
    public async show(list: MultiSellList_T) {
        this.entries = list.entries;
        this.listId = list.listId;
        this.selectedIndex = -1;
        const generation = ++this.generation, strings = this.layer.getManager().strings;

        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
        await this.layer.loadTextures([...new Set(list.entries.flatMap(entry => [...entry.products, ...entry.ingredients].filter(Boolean).map(item => strings.itemIcons[item.itemId])))]);
        if (generation !== this.generation) return;

        this.catalog.content.replaceChildren();
        this.catalogItems = [];
        this.products.content.replaceChildren();
        this.ingredients.content.replaceChildren();
        this.catalog.setContentHeight(314 + Math.max(0, Math.ceil(this.entries.length / 6) - 9) * 35);
        this.catalog.setScroll(0);
        this.entries.forEach((entry, index) => {
            if (!entry.products[0]) throw new Error(`Missing MultiSell product for entry ${entry.entryId}.`);

            const item = this.getItem(entry.products[0]);

            this.catalogItems.push(item);
            const button = this.layer.createWindow(index % 6 * 37, Math.trunc(index / 6) * 35, 37, 35, this.catalog.content);
            const frame = this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_SELECTED);

            button.dataset.entryId = String(entry.entryId);
            frame.dataset.selected = "";
            frame.hidden = true;
            this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, strings.itemIcons[entry.products[0].itemId]);
            if (entry.products.length > 1) this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, TEX_PLUS);
            button.addEventListener("mouseenter", () => this.inventory.showTooltip(item, button, index === this.selectedIndex));
            button.addEventListener("mouseleave", () => this.inventory.hideTooltip());
        });
    }
    protected getItem(item: MultiSellItem_T, count = item.count): InventoryEntry_T {
        const strings = this.layer.getManager().strings;

        return { objectId: 0, itemId: item.itemId, name: strings.itemNames[item.itemId], icon: strings.itemIcons[item.itemId], count, enchant: item.enchantLevel, itemClass: item.type2, bodyPart: "bodyPart" in item ? item.bodyPart : strings.itemInfos[item.itemId].bodyPart, slot: -1, isQuest: item.type2 === 3, isMoney: item.type2 === 4, info: strings.itemInfos[item.itemId] };
    }
    protected paintDetails(entry: MultiSellEntry_T) {
        this.products.content.replaceChildren();
        this.ingredients.content.replaceChildren();
        const products = entry.products.slice(0, 50);

        for (let index = 0; index < products.length; index++) {
            if (!products[index]) { debugger; throw new Error(`Unqualified MultiSell duplicate product slot ${index} for entry ${entry.entryId}.`); }

            const item = this.getItem(products[index]);

            if (products.length === 1) this.products.setContentHeight(this.paintItemInfo(item), true);
            else this.paintIcon(this.products.content, item, 10, 5 + 36 * index);
            this.paintName(this.products, item, index, 180);
        }
        if (products.length > 1) this.products.setContentHeight(5 + 36 * products.length, true);
        entry.ingredients.forEach((ingredient, index) => {
            const item = this.getItem(ingredient, 0);

            this.paintIcon(this.ingredients.content, item, 10, 5 + 36 * index);
            this.layer.text(this.ingredients.content, `x ${ingredient.count}`, 0xffdcdcdc, FontType_T.SMALL, 46, 25 + 36 * index);
            this.paintName(this.ingredients, item, index, 170);
        });
        if (entry.ingredients.length) this.ingredients.setContentHeight(5 + 36 * entry.ingredients.length, true);
    }
    protected paintIcon(parent: HTMLElement, item: InventoryEntry_T, x: number, y: number) {
        this.layer.tile(parent, x, y, 34, 34, 0, 0, 34, 34, TEX_ICONBOX);
        this.layer.tile(parent, x + 1, y + 1, 32, 32, 0, 0, 32, 32, item.icon);
    }
    protected paintName(pane: NDomScrollPane_T, item: InventoryEntry_T, index: number, width: number) {
        const name = this.layer.createWindow(46, 10 + 36 * index, width, 14, pane.content);

        name.style.overflow = "hidden";
        name.dataset.itemName = String(item.itemId);
        const baseName = (item.enchant > 0 && item.itemClass < 4 ? `+${item.enchant} ` : "") + item.name;
        const extra = item.info.addName, count = item.count > 0 ? `x${item.count}` : "";
        const grade = item.info.crystalType > 0 && item.info.crystalType < 5 ? this.inventory.getItemTitle(item, 2).find(run => run[1] === 0)[0] : "";
        const baseWidth = this.layer.measureText(baseName), extraWidth = baseWidth + (extra ? this.layer.measureText(extra) + 2 : 0), gradeWidth = extraWidth + (grade ? 14 : 0);
        const overflow = gradeWidth + (count ? this.layer.measureText(count) + 2 : 0) - width;
        let reduction = 0, text = baseName;

        if (overflow > 0) {
            const dots = this.layer.measureText("..");
            let length = baseName.length - 1;

            while (length > 0 && baseWidth - this.layer.measureText(baseName.slice(0, length)) - dots <= overflow) length--;
            reduction = baseWidth - this.layer.measureText(baseName.slice(0, length)) - dots;
            if (reduction <= overflow) { debugger; throw new Error(`Unqualified MultiSell name tail overflow for item ${item.itemId}.`); }
            text = baseName.slice(0, length) + "..";
        }
        this.layer.text(name, text, 0xffdcdcdc, FontType_T.SMALL, 0, 0);
        if (extra) this.layer.text(name, extra, 0xffffd969, FontType_T.SMALL, baseWidth - reduction + 2, 0);
        if (grade) this.layer.tile(name, extraWidth - reduction + 2, 0, 12, 12, 0, 0, 12, 12, this.layer.getManager().strings.symbols[grade.slice(1)]);
        if (count) this.layer.text(name, count, 0xffdcdcdc, FontType_T.SMALL, gradeWidth - reduction + 2, 0);
        name.addEventListener("mouseenter", () => this.inventory.showTooltip(item, name, false));
        name.addEventListener("mouseleave", () => this.inventory.hideTooltip());
    }
    protected paintItemInfo(item: InventoryEntry_T) {
        const canvas = this.layer.getManager().canvas, height = canvas.getLineHeight(), parent = this.products.content;
        const lines = this.inventory.getItemLines(item, 0, 0, true);
        let x = 46, y = 4 + height + 8;

        this.paintIcon(parent, item, 9, 3);
        if (item.itemClass < 3 && lines[0] && lines[0].label !== null) { y += 20; x = 10; }
        lines.forEach((line, index) => {
            if (line.label === null) {
                this.layer.text(parent, line.value, 0xffb09b79, FontType_T.SMALL, x, y);
                if (index < lines.length - 1) y += 20;
                x = 10;
                return;
            }
            const label = `${line.label} : `;

            this.layer.text(parent, label, 0xffa3a3a3, FontType_T.SMALL, x, y);
            this.layer.text(parent, line.value, [111, 404, 496].some(id => this.layer.getManager().getSysString(id) === line.label) ? 0xffb09b79 : 0xffdcdcdc, FontType_T.SMALL, x + this.layer.measureText(label), y);
            if (index < lines.length - 1) y += height + 4;
            x = 10;
        });
        const description = item.info.description;

        if (description) {
            y += height + 4;
            for (const line of canvas.wrapText(description.replace(/\\n/g, "\n"), 200)) {
                this.layer.text(parent, line, 0xffb2becf, FontType_T.SMALL, 10, y);
                y += height;
            }
        }
        return y;
    }
}

export default NCVIPShopWnd;
