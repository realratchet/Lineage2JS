import NCInventoryWnd from "./nc-inventory-wnd";
import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";
import type { InventoryEntry_T } from "./nc-inventory-wnd";
import type { GMViewItemList_T } from "../network/game-packets";

export class NCGMInventoryWnd extends NCInventoryWnd {
    public onRequest: (targetName: string, kind: number) => void = null;

    public constructor(layer: NDomLayer) {
        super(layer);

        this.element.children[1].remove();
        NCFrameCtrl.createDOM(layer, this.element, 256, "", false, () => this.setVisible(false));
        this.folded.remove();
        this.crystal.hidden = this.trash.hidden = true;
        this.weightBar.parentElement.hidden = true;
        [this.equipment, ...this.arrBags.map(bag => bag.content)].forEach(grid => {
            grid.addEventListener("mousedown", event => {
                if (event.button !== 2 && !(event.button === 0 && event.detail === 2)) return;

                this.endDrag();
                event.preventDefault();
                event.stopImmediatePropagation();
            }, true);
            grid.addEventListener("dblclick", event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
            grid.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                event.stopImmediatePropagation();
            }, true);
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 201, 100); }
    public getItems() { return this.items; }
    public getGrid(isQuest: boolean) { return this.arrBags[Number(isQuest)]; }
    public getEquipment() { return this.equipment; }
    public toggle(targetName: string) {
        if (this.isVisible()) { this.setVisible(false); return; }

        if (this.onRequest) this.onRequest(targetName, 5);
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
    }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        this.folded.hidden = this.caption.hidden = true;
        this.crystal.hidden = this.trash.hidden = true;
        if (visible) {
            this.hideBags();
            this.getBag().hidden = false;
        } else {
            this.tooltip.hidden = true;
            this.endDrag();
        }
    }
    public async setInventoryInfo(info: GMViewItemList_T, entries: InventoryEntry_T[]) {
        const counts = [0, 0, 0], equipped = new Set(info.items.filter(item => item.isEquipped).map(item => item.objectId));
        const items = entries.map(item => ({ ...item, isMoney: false, slot: equipped.has(item.objectId) && item.slot < 0 ? 15 : item.slot })).filter(item => counts[item.slot >= 0 ? 2 : Number(item.isQuest)]++ < (item.slot >= 0 ? 15 : 160));

        this.endDrag();
        this.items = [];
        this.arrBagOrder.forEach(order => order.length = 0);
        this.selection.clear();
        this.paintItems();
        if (info.showWindow) {
            this.limit = info.inventoryLimit;
            this.setVisible(true);
            this.layer.activate(this.element);
            this.element.focus();
        }
        await this.setItems(items, true);
    }
    protected paintItems(preserveScroll: boolean = false, preserveTooltip: boolean = false) {
        super.paintItems(preserveScroll, preserveTooltip);
        let money = 0;

        for (const item of this.items)
            if (item.slot < 0 && !item.isQuest && item.itemId === 57) money = money + item.count | 0;
        const text = money.toLocaleString("en-US");

        this.layer.renderText(this.adena, text, 0xffdcdcdc);
        this.layer.place(this.adena, 199 - this.layer.measureText(text), 356);
    }
    protected addItem(parent: HTMLElement, x: number, y: number, item: InventoryEntry_T) {
        if (item.slot >= 15) return;

        super.addItem(parent, x, y, item);
    }
    protected updateDragTargets(event: MouseEvent = null) {}
    protected dropItem(item: InventoryEntry_T, event: MouseEvent) {}
    protected minimize() {}
}

export default NCGMInventoryWnd;
