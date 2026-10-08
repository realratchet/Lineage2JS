import NCShopWnd from "./nc-shop-wnd";
import type NDomLayer from "./ndom";
import type { PackageSendableList_T } from "../network/game-packets";

export class NCDeliverWnd extends NCShopWnd {
    protected targetId = 0;
    public constructor(layer: NDomLayer) {
        super(layer);

        this.isStore = true;
        this.element.tabIndex = -1;
        const title = layer.getManager().getSysString(557);

        layer.renderText(this.caption, title, 0xffc8d2dc);
        this.element.setAttribute("aria-label", title);
    }

    public getTargetId() { return this.targetId; }
    public setVisible(visible: boolean) {
        super.setVisible(visible);
        if (!visible) this.targetId = 0;
    }
    public async showPackage(list: PackageSendableList_T) {
        const pending = this.show(false, list.adena, list.items.map(item => ({ ...item, price: 0 })));

        this.targetId = list.targetId;
        this.layer.activate(this.element);
        this.element.focus();
        await pending;
    }
    protected getLabelIds() { return [138, 560, 561]; }
    protected drawTotal() { this.drawAmount(this.total, String(this.items[1].length * 1000), 331); }
}

export default NCDeliverWnd;
