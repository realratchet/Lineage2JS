import NCShopWnd from "./nc-shop-wnd";
import type NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import { WarehouseType_T } from "../network/game-packets";
import type { WarehouseList_T } from "../network/game-packets";

export class NCStoreWnd extends NCShopWnd {
    protected readonly counter: HTMLCanvasElement;
    protected type = WarehouseType_T.Private;
    protected maxCount = 0;

    public constructor(layer: NDomLayer) {
        super(layer);

        this.isStore = true;
        this.capacity = 200;
        this.counter = layer.text(this.element, "", 0xffb09b79, FontType_T.SMALL, 246, 198);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 80, 156); }
    public setLimit(limit: number) { this.maxCount = limit; this.drawTotal(); }
    public async showWarehouse(isWithdraw: boolean, list: WarehouseList_T) {
        this.type = list.type;
        const id = [0, 1216, 1217, 1218, 131][list.type], title = this.layer.getManager().getSysString(id);

        this.layer.renderText(this.caption, title, 0xffc8d2dc);
        this.element.setAttribute("aria-label", title);
        await this.show(isWithdraw, list.adena, list.items.map(item => ({ ...item, price: 0 })));
    }

    protected getLabelIds() { return this.isSell ? [132, 138, 135] : [138, 132, 135]; }
    protected drawTotal() {
        this.drawAmount(this.total, String(this.isSell ? 0 : this.items[1].length * 30), 331);
        this.counter.hidden = this.type === WarehouseType_T.Freight;
        const text = `(${this.items[this.isSell ? 0 : 1].length}/${this.type === WarehouseType_T.Private ? this.maxCount : 200})`;

        this.layer.renderText(this.counter, text, 0xffb09b79);
        this.layer.place(this.counter, 246 - this.layer.measureText(text), this.isSell ? 32 : 198);
    }
}

export default NCStoreWnd;
