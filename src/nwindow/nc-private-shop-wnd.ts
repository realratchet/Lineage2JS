import NCShopWnd from "./nc-shop-wnd";
import type NDomLayer from "./ndom";
import type { NDomButton_T, NDomCheckBox_T } from "./ndom";
import type { ShopItem_T, PrivateStoreSellList_T, PrivateStoreSellItem_T, PrivateStoreManageSell_T } from "../network/game-packets";

export class NCPrivateShopWnd extends NCShopWnd {
    public onQuit: () => void = null;
    public onMessage: () => void = null;
    protected readonly quitButton: NDomButton_T;
    protected readonly messageButton: NDomButton_T;
    protected readonly packageCheckbox: NDomCheckBox_T;
    protected readonly counter: HTMLCanvasElement;
    protected maxCount = 0;
    protected isOwn = false;
    protected ownerId = 0;
    protected isPackage = false;

    public constructor(layer: NDomLayer) {
        super(layer);

        this.isStore = true;
        layer.renderText(this.caption, "", 0xffc8d2dc);
        this.element.setAttribute("aria-label", "");
        this.element.tabIndex = -1;
        layer.place(this.okButton, 164, 372);
        this.cancelButton.hidden = true;
        this.quitButton = layer.button(this.element, 10, 372, 76, 23, "L2UI_CH3.Button.Btn1_Normal", "L2UI_CH3.Button.Btn1_NormalOn", null, layer.getManager().getSysString(385), () => {
            if (this.onQuit) this.onQuit();
            this.setVisible(false);
        });
        this.messageButton = layer.button(this.element, 87, 372, 76, 23, "L2UI_CH3.Button.Btn1_Normal", "L2UI_CH3.Button.Btn1_NormalOn", null, layer.getManager().getSysString(384), () => { if (this.onMessage) this.onMessage(); });
        this.packageCheckbox = layer.checkbox(this.element, 11, 350, 100, 23, layer.getManager().getSysString(1198));
        this.counter = layer.text(this.element, "", 0xffb09b79, undefined, 251, 198);
        this.quitButton.hidden = this.messageButton.hidden = this.packageCheckbox.hidden = this.counter.hidden = true;
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 302, Math.trunc(height * 0.5 - 252)); }
    public getOwnerId() { return this.ownerId; }
    public isPackageMode() { return !this.isOwn && this.isPackage; }
    public isOwnMode() { return this.isOwn; }
    public getPackageChecked() { return this.packageCheckbox.getChecked(); }
    public getOriginalCount(item: ShopItem_T) { return (item as ShopItem_T & { originalCount: number }).originalCount; }
    public setLimit(limit: number) { this.maxCount = limit; this.drawTotal(); }
    public async showManageStore(list: PrivateStoreManageSell_T) {
        this.setOwnMode(true);
        const pending = this.show(false, list.adena, list.items.map(item => ({ ...item, type1: item.type2, originalCount: item.count, referencePrice: item.price, price: 0 })), list.listed.map(item => ({ ...item, type1: item.type2, originalCount: item.count })));

        this.ownerId = list.playerId;
        this.packageCheckbox.setChecked(list.isPackage);
        this.layer.activate(this.element);
        this.element.focus();
        await pending;
    }
    public setVisible(visible: boolean) {
        super.setVisible(visible);
        if (!visible) this.ownerId = 0;
    }
    public async showStore(list: PrivateStoreSellList_T) {
        this.setOwnMode(false);
        const pending = this.show(false, list.adena, list.items.map(item => ({ ...item, type1: item.type2 })));
        const title = this.layer.getManager().getSysString(498) + (list.isPackage ? ` - ${this.layer.getManager().getSysString(1198)}` : "");

        this.ownerId = list.storePlayerId;
        this.isPackage = list.isPackage;
        this.layer.renderText(this.caption, title, 0xffc8d2dc);
        this.element.setAttribute("aria-label", title);
        this.layer.activate(this.element);
        this.element.focus();
        await pending;
    }
    public needsPriceConfirmation() {
        return this.items[1].some((item: ShopItem_T & PrivateStoreSellItem_T) => item.referencePrice > 0 && (item.price >= (item.referencePrice * 5 | 0) || item.price <= Math.trunc(item.referencePrice / 5)));
    }
    public transfer(side: number, item: ShopItem_T, count: number) {
        if (this.isOwn) {
            if (!this.items[side].includes(item) || count <= 0) return;
            if (side === 0 && !this.canAdd(item, count)) {
                this.selected[side] = null;
                this.paintSelection(side);
                void this.paintItems();
                return;
            }
            const consumeType = this.layer.getManager().strings.itemInfos[item.itemId].consumeType;
            const existing = side === 0 && consumeType >= 1 && consumeType <= 3 ? this.items[1].find(entry => entry.itemId === item.itemId) : null;

            if (existing) existing.price = item.price;
            super.transfer(side, item, count);
            return;
        }
        if (!this.isPackage) { super.transfer(side, item, count); return; }
        if (!this.items[side].includes(item)) return;

        this.items[1 - side] = this.items[side];
        this.items[side] = [];
        if (this.items[1 - side].includes(this.selected[side])) this.selected[1 - side] = this.selected[side];
        this.pressed[side] = -1;
        this.drawTotal();
        void this.paintItems(side);
    }
    protected setOwnMode(isOwn: boolean) {
        this.isOwn = isOwn;
        this.quitButton.hidden = this.messageButton.hidden = this.packageCheckbox.hidden = this.counter.hidden = !isOwn;
        this.okButton.setLabel(this.layer.getManager().getSysString(isOwn ? 428 : 140));
    }
    protected canAdd(item: ShopItem_T, count: number, itemId = item.itemId) {
        const contribution = BigInt(count) * BigInt(item.price);

        if (contribution > 2000000000n || contribution < 0) return false;
        let existing = 0;

        for (const entry of this.items[1]) existing = existing + Math.imul(entry.count | 0, entry.itemId === itemId ? item.price : entry.price) | 0;
        const total = Number(contribution) + existing | 0;

        return total >= 0 && total <= 2000000000;
    }
    protected getTransferCount(item: ShopItem_T, count: number) { return this.isOwn ? count : super.getTransferCount(item, count); }
    protected getLabelIds() { return this.isOwn ? [138, 137, 143] : [137, 139, 142]; }
    protected getTooltipContext(side: number) { return this.isOwn ? side ? 4 : 0 : this.isPackage || side === 0 ? 4 : 0; }
    protected drawTotal() {
        super.drawTotal();
        if (!this.counter) return;

        const text = `(${this.items[1].length}/${this.maxCount})`;

        this.layer.renderText(this.counter, text, 0xffb09b79);
        this.layer.place(this.counter, 251 - this.layer.measureText(text), 198);
    }
    protected drawAmount(canvas: HTMLCanvasElement, value: string, y: number) { super.drawAmount(canvas, BigInt.asIntN(32, BigInt(value)).toString(), y); }
}

export default NCPrivateShopWnd;
