import NCPrivateShopWnd from "./nc-private-shop-wnd";
import type { ShopItem_T, PrivateStoreBuyList_T, PrivateStoreManageBuy_T, PrivateStoreBuyItem_T } from "../network/game-packets";

type PrivateBuyItem_T = ShopItem_T & { ownedCount: number, maxCount: number, referencePrice: number };
const TEX_ZERO = "NWindow.ChatBack";

export class NCPrivateBuyWnd extends NCPrivateShopWnd {
    public static getTextures() { return [...NCPrivateShopWnd.getTextures(), TEX_ZERO]; }
    public canMove(item: ShopItem_T) { return (item as PrivateBuyItem_T).ownedCount > 0; }
    public getTooltipCount(item: ShopItem_T) { const count = item.count | 0; return count > 0 ? count : (item as PrivateBuyItem_T).ownedCount; }
    public getMaxCount(item: ShopItem_T) { return (item as PrivateBuyItem_T).maxCount; }
    public getOwnedCount(item: ShopItem_T) { return (item as PrivateBuyItem_T).ownedCount; }
    public async showManageBuyStore(list: PrivateStoreManageBuy_T) {
        this.setVisible(false);
        this.setOwnMode(true);
        if (!list.items.length && !list.listed.length) return;

        const strings = this.layer.getManager().strings;
        const items = list.items.filter(item => strings.itemInfos[item.itemId]?.templateClass != null).map(item => this.makeManageItem(item, false));
        const listed = list.listed.filter(item => strings.itemInfos[item.itemId]?.templateClass != null).map(item => this.makeManageItem(item, true));
        const pending = this.show(false, list.adena, items, listed);

        this.ownerId = list.playerId;
        this.layer.activate(this.element);
        this.element.focus();
        await pending;
    }
    public async showBuyStore(list: PrivateStoreBuyList_T) {
        this.setOwnMode(false);
        this.setVisible(false);
        if (!list.items.length) return;

        const pending = this.show(false, list.adena, list.items.map(item => ({ ...item, ownedCount: item.count, type1: item.type2, customType2: 0 })));

        this.ownerId = list.storePlayerId;
        this.layer.activate(this.element);
        this.element.focus();
        await pending;
    }
    public transfer(side: number, item: ShopItem_T, count: number) {
        const source = this.items[side] as PrivateBuyItem_T[], destination = this.items[1 - side] as PrivateBuyItem_T[];
        const entry = item as PrivateBuyItem_T;

        if (!source.includes(entry) || count <= 0 || !this.isOwn && !this.canMove(item)) return;

        const consumeType = this.layer.getManager().strings.itemInfos[item.itemId].consumeType;
        const isStackable = consumeType >= 1 && consumeType <= 3;

        if (this.isOwn) {
            this.selected[side] = null;
            if (side === 0 && !this.canAdd(item, count, item.objectId)) {
                this.paintSelection(side);
                void this.paintItems();
                return;
            }
            if (side === 0) {
                const existing = isStackable ? destination.find(target => target.itemId === item.itemId) : null;

                if (existing) { existing.count += count; existing.price = item.price; }
                else if (isStackable) { if (destination.length < this.capacity) destination.push({ ...entry, count }); }
                else {
                    for (let i = destination.length - 1; i >= 0; i--)
                        if (destination[i].itemId === item.itemId && destination[i].enchantLevel === item.enchantLevel) destination.splice(i, 1);
                    for (let i = 0; i < Math.min(count, 100) && destination.length < this.capacity; i++) destination.push({ ...entry, count: 1 });
                }
            } else {
                if (isStackable && entry.count > count) entry.count -= count;
                else source.splice(source.indexOf(entry), 1);
            }
        } else {
            if (!isStackable) count = 1;
            const existing = isStackable ? destination.find(target => target.itemId === item.itemId) : null;

            if (existing) { existing.count += count; existing.maxCount += count; }
            else if (destination.length < this.capacity) destination.push({ ...entry, count });
            if (isStackable && entry.count > count) { entry.count -= count; entry.maxCount -= count; }
            else source.splice(source.indexOf(entry), 1);
        }
        this.selected[side] = null;
        this.pressed[side] = -1;
        if (this.onHideTooltip) this.onHideTooltip();
        this.drawTotal();
        void this.paintItems();
    }
    protected setOwnMode(isOwn: boolean) { super.setOwnMode(isOwn); this.packageCheckbox.hidden = true; }
    protected makeManageItem(item: PrivateStoreBuyItem_T, isListed: boolean): PrivateBuyItem_T {
        const info = this.layer.getManager().strings.itemInfos[item.itemId];

        return { ...item, ownedCount: item.count, type1: item.type2, customType2: info.weight, enchantLevel: info.templateClass === "weapon" ? info.soulshots : item.enchantLevel, type2: info.templateClass === "armor" ? info.mpBonus : item.type2, maxCount: isListed ? item.maxCount : -1 };
    }
    protected getLabelIds() { return this.isOwn ? [138, 502, 142] : [503, 137, 143]; }
    protected getTooltipContext(side: number) { return this.isOwn ? side ? 0x808 : 0 : side ? 0 : 0x808; }
    protected async paintItems(scrollSide = -1) {
        const generation = this.generation + 1;

        await super.paintItems(scrollSide);
        if (generation !== this.generation) return;
        if (this.isOwn) return;

        this.items[0].forEach((item, index) => {
            if ((item as PrivateBuyItem_T).ownedCount === 0) this.layer.tile(this.lists[0].content.children[index] as HTMLElement, 1, 1, 32, 32, 0, 0, 32, 32, TEX_ZERO);
        });
    }
}

export default NCPrivateBuyWnd;
