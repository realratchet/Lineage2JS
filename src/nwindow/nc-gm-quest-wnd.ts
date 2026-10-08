import NCQuestWnd from "./nc-quest-wnd";
import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";
import { ItemType2_T, type InventoryItem_T, type GMViewQuestList_T } from "../network/game-packets";

class NCGMQuestPage extends NCQuestWnd {
    public constructor(layer: NDomLayer, parent: HTMLElement) {
        super(layer, parent);

        this.element.children[4].remove();
        this.checkbox.remove();
        this.element.dataset.window = "gm-quest";
        layer.place(this.element, 0, 20, 256, 335);
    }

    public clear() {
        this.inventory = [];
        super.clear();
    }
    public isVisible() { return !this.element.hidden; }
    protected updateLocation() {}
}

export class NCGMQuestWnd {
    public static getTextures() { return [...NCFrameCtrl.getTextures(), ...NCQuestWnd.getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly questWnd: NCGMQuestPage;
    public onRequest: (targetName: string, kind: number) => void = null;
    public onShowQuestList: () => void = null;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement = layer.root) {
        this.element = layer.createWindow(0, 100, 256, 355, parent);
        this.element.hidden = true;
        NCFrameCtrl.createDOM(layer, this.element, 256, "", false, () => this.setVisible(false));
        this.questWnd = new NCGMQuestPage(layer, this.element);
        this.questWnd.onShow = () => { if (this.onShowQuestList) this.onShowQuestList(); };
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 209, 100); }
    public isVisible() { return !this.element.hidden; }
    public getQuestWnd() { return this.questWnd; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        this.questWnd.setVisible(visible);
    }
    public toggle(targetName: string) {
        if (this.isVisible()) { this.setVisible(false); return; }

        if (this.onRequest) this.onRequest(targetName, 4);
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
    }
    public async setQuestList(info: GMViewQuestList_T) {
        this.questWnd.clear();
        this.questWnd.setInventory(info.items.map(item => ({ itemId: item.itemId, count: item.count, isEquipped: false, type2: ItemType2_T.TYPE2_QUEST })) as InventoryItem_T[]);
        await this.questWnd.setStates(info.quests);
    }
}

export default NCGMQuestWnd;
