import NCRecipeManufactureWnd from "./nc-recipe-manufacture-wnd";
import type NDomLayer from "./ndom";
import type { RecipeInfo_T } from "../assets/decode-worker/decode-protocol";
import { ItemType2_T } from "../network/game-packets";
import type { InventoryItem_T, RecipeShopItemInfo_T } from "../network/game-packets";

export class NCRecipeBuyManufactureWnd extends NCRecipeManufactureWnd {
    public onShopCreate: (objectId: number, recipeId: number, price: number) => void = null;
    public onShopBack: (objectId: number) => void = null;
    protected ownerId = 0;
    protected price = 0;

    public constructor(layer: NDomLayer) {
        super(layer);

        this.onCreate = recipeId => { if (this.onShopCreate) this.onShopCreate(this.ownerId, recipeId, this.price); };
        this.onBack = () => { if (this.onShopBack) this.onShopBack(this.ownerId); };
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 302, Math.trunc(height * 0.5 - 252)); }
    public async showShop(recipe: RecipeInfo_T, state: RecipeShopItemInfo_T, inventory: InventoryItem_T[]) {
        this.ownerId = state.objectId;
        this.price = state.price;
        await this.show(recipe, { ...state, isDwarven: true }, inventory);
    }
    public setInventory(items: InventoryItem_T[]) {
        if (!this.recipe) return;
        const normal = items.filter(item => !item.isEquipped && item.type2 !== ItemType2_T.TYPE2_QUEST), quest = items.filter(item => !item.isEquipped && item.type2 === ItemType2_T.TYPE2_QUEST);
        let count = 0;

        for (const item of normal)
            if (item.itemId === this.recipe.productId) count = count + item.count | 0;
        for (let i = 0; i < quest.length; i++) {
            if (quest[i].itemId !== this.recipe.productId) continue;
            if (!normal[i]) throw new Error(`Recipe retained-item count reads outside the normal inventory at '${i}'.`);
            count = count + normal[i].count | 0; // NCRecipeBuyManufactureWnd::Paint 100f15a2 indexes the normal bag after matching a quest item.
        }
        this.layer.renderText(this.inventoryCount, String(count), 0xffb09b79);
    }
    protected close() { this.setVisible(false); }
}

export default NCRecipeBuyManufactureWnd;
