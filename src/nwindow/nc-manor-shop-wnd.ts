import NCShopWnd from "./nc-shop-wnd";
import type NDomLayer from "./ndom";
import type { ManorItem_T, ShopItem_T } from "../network/game-packets";

export type ManorShopItem_T = ShopItem_T & { initialCount: number };

export class NCManorShopWnd extends NCShopWnd {
    public onQuantity: (side: number, item: ManorShopItem_T, allCount: number) => void = null;
    public onSubmit: (isSell: boolean, listId: number, items: ManorShopItem_T[]) => void = null;
    protected listId = 0;

    public constructor(layer: NDomLayer) {
        super(layer);
        this.isStore = true;
        const title = layer.getManager().getSysString(738);

        layer.renderText(this.caption, title, 0xffc8d2dc);
        this.element.setAttribute("aria-label", title);
        this.onMove = (side, item, isPointer, isDrag) => {
            const consumeType = layer.getManager().strings.itemInfos[item.itemId].consumeType;
            const isStackable = consumeType >= 1 && consumeType <= 3;
            const needsQuantity = isStackable && (item.count > 1 || !this.isSell && (side === 0 || isPointer && !isDrag));

            if (needsQuantity) {
                const row = item as ManorShopItem_T;

                if (this.onQuantity) this.onQuantity(side, row, row.initialCount);
            } else this.transfer(side, item, 1);
        };
        this.onConfirm = (isSell, items) => {
            if (this.onSubmit) this.onSubmit(isSell, this.listId, items.filter(item => item.count > 0) as ManorShopItem_T[]);
            this.setVisible(false);
        };
    }

    public getListId() { return this.listId; }
    public async showManor(isSell: boolean, money: number, listId: number, rows: ManorItem_T[]) {
        this.listId = listId;
        const items = rows.filter(row => !!this.layer.getManager().strings.itemInfos[row.itemId]).map(row => {
            const item = row as ManorItem_T & Partial<ShopItem_T>;

            return { ...item, bodyPart: item.bodyPart ?? 0, enchantLevel: item.enchantLevel ?? 0, customType2: item.customType2 ?? 0, initialCount: row.count };
        });
        const painting = super.show(isSell, money, items);

        this.layer.activate(this.element);
        this.element.focus();
        await painting;
    }
    protected getTooltipContext(side: number) { return this.isSell ? 8 : side ? 4 : 5; }
}

export default NCManorShopWnd;
