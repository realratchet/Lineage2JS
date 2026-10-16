import NCShopWnd from "./nc-shop-wnd";
import type NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import { WarehouseType_T, type ShopItem_T, type WarehouseList_T } from "../network/game-packets";
import type { StoreWndView_T, GMStoreWndView_T } from "./skin";

export class NCStoreWnd extends NCShopWnd {
    public onDrop: (side: number, target: Element) => boolean = null;
    public onTransfer: () => void = null;
    protected readonly counter: HTMLCanvasElement;
    protected readonly arrDestinations: [StoreWndView_T | GMStoreWndView_T, number][];
    protected type = WarehouseType_T.Private;
    protected maxCount = 0;

    public constructor(layer: NDomLayer) {
        super(layer);

        this.isStore = true;
        this.capacity = 200;
        this.arrDestinations = [[this, 1], [this, 0]];
        this.counter = layer.text(this.element, "", 0xffb09b79, FontType_T.SMALL, 246, 198);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 80, 156); }
    public setLimit(limit: number) { this.maxCount = limit; this.drawTotal(); }
    public setDestination(side: number, wnd: StoreWndView_T | GMStoreWndView_T, targetSide: number) { this.arrDestinations[this.getLogicalSide(side)] = [wnd, wnd.getLogicalSide(targetSide)]; }
    public updateFee() { this.drawTotal(); }
    public transfer(side: number, item: ShopItem_T, count: number) {
        if (!this.items[side].includes(item) || count <= 0) return;

        const [wnd] = this.arrDestinations[this.getLogicalSide(side)];

        super.transfer(side, item, count);
        if (wnd !== this) void wnd.paintItems();
        if (this.onTransfer) this.onTransfer();
    }
    public async show(isSell: boolean, money: number, items: ShopItem_T[], selectedItems: ShopItem_T[] = []) {
        if (isSell !== this.isSell) this.doubleClicked.reverse();

        await super.show(isSell, money, items, selectedItems);
    }
    public async showWarehouse(isWithdraw: boolean, list: WarehouseList_T) {
        this.type = list.type;
        const id = [0, 1216, 1217, 1218, 131][list.type], title = this.layer.getManager().getSysString(id);

        this.layer.renderText(this.caption, title, 0xffc8d2dc);
        this.element.setAttribute("aria-label", title);
        await this.show(isWithdraw, list.adena, list.items.map(item => ({ ...item, price: 0 })));
    }

    protected getLabelIds() { return this.isSell ? [132, 138, 135] : [138, 132, 135]; }
    public getLogicalSide(side: number) { return this.isSell ? 1 - side : side; }
    protected getDestinationItems(side: number) {
        const [wnd, targetSide] = this.arrDestinations[this.getLogicalSide(side)];

        return wnd.getItems(wnd.getLogicalSide(targetSide));
    }
    protected dropItem(side: number, _item: ShopItem_T, event: MouseEvent) {
        const item = this.getPressedItem(side), list = this.lists[side], rect = list.getBoundingClientRect();
        const x = this.layer.toUI(event.clientX - rect.left), y = this.layer.toUI(event.clientY - rect.top);

        if (!item || x >= 0 && x <= 239 && y >= 0 && y <= (side ? 104 : 139)) return;
        const target = document.elementFromPoint(event.clientX, event.clientY);

        if (target && this.onDrop && this.onDrop(side, target) && this.onMove) this.onMove(side, item, true, true);
    }
    protected drawTotal() {
        this.drawAmount(this.total, String(this.isSell ? 0 : this.items[1].length * 30), 331);
        this.counter.hidden = this.type === WarehouseType_T.Freight;
        const text = `(${this.items[this.isSell ? 0 : 1].length}/${this.type === WarehouseType_T.Private ? this.maxCount : 200})`;

        this.layer.renderText(this.counter, text, 0xffb09b79);
        this.layer.place(this.counter, 246 - this.layer.measureText(text), this.isSell ? 32 : 198);
    }
}

export default NCStoreWnd;
