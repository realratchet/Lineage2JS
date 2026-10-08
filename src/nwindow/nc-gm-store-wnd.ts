import NCStoreWnd from "./nc-store-wnd";
import { WarehouseType_T } from "../network/game-packets";
import type NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";
import type { GMViewWarehouseWithdrawList_T } from "../network/game-packets";
import type { ShopItem_T } from "../network/game-packets";

export class NCGMStoreWnd extends NCStoreWnd {
    public onRequest: (targetName: string, kind: number) => void = null;
    public onQuantity: (side: number, item: ShopItem_T, maxCount: number) => void = null;

    public constructor(layer: NDomLayer) {
        super(layer);

        this.type = 0 as WarehouseType_T;
        layer.renderText(this.caption, "", 0xffc8d2dc);
        this.element.setAttribute("aria-label", "");
        this.getLabelIds().forEach((id, index) => layer.renderText(this.labels[index], layer.getManager().getSysString(id), 0xffdcdcdc));
        layer.place(this.labels[2], 156 - layer.measureText(layer.getManager().getSysString(135)), 331);
        this.drawAmount(this.money, "0", 350);
        this.drawTotal();
        this.okButton.setEnabled(false);
        this.cancelButton.setEnabled(false);
        for (const child of this.element.children) {
            const button = child as NDomButton_T;

            if (parseFloat(button.style.top) === 194 && (parseFloat(button.style.left) === 112 || parseFloat(button.style.left) === 130)) button.setEnabled(false);
        }
        this.onMove = (side, item) => {
            const consumeType = layer.getManager().strings.itemInfos[item.itemId].consumeType;

            if (consumeType >= 1 && consumeType <= 3 && item.count > 1) {
                if (this.onQuantity) this.onQuantity(side, item, item.count);
            } else this.transfer(side, item, 1);
        };
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 209, 100); }
    public toggle(targetName: string) {
        if (this.isVisible()) { this.setVisible(false); return; }

        if (this.onRequest) this.onRequest(targetName, 6);
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
    }
    public async setWarehouseInfo(info: GMViewWarehouseWithdrawList_T) {
        const pending = this.show(true, info.adena, info.items.map(item => ({ ...item, price: 0 })));

        this.layer.activate(this.element);
        this.element.focus();
        await pending;
    }
    public transferQuantity(side: number, count: number) {
        const item = this.getPressedItem(side);

        if (item && count !== 0) this.transfer(side, item, count);
    }
    protected drawTotal() {
        super.drawTotal();
        this.drawAmount(this.total, "0", 331);
    }
}

export default NCGMStoreWnd;
