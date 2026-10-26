import NCFrameCtrl from "./nc-frame-ctrl";
import NCListCtrl, { type ListRow_T } from "./nc-list-ctrl";
import { NCComboBox } from "./nc-lobby-wnd";
import { NDOM_EDIT_TEXTURES, type default as NDomLayer, type NDomEdit_T } from "./ndom";
import { createTextButton, getManorName, getRewardTooltip } from "./nc-manor-info-wnd";
import type { ManorProcureCropDetail_T, ManorSellCropList_T, ProcureCropRequest_T } from "../network/game-packets";

type SellEntry_T = { objectId: number, cropId: number, manorId: number, count: number };
type ProcureEntry_T = { manorId: number, remaining: number, price: number, rewardType: number };

const TEX_SELL_BACK = "L2UI_CH3.Manor.manor2_back";
const TEX_CHANGE_BACK = "L2UI_CH3.Manor.manor3_back";
const TEX_SMALL_BUTTON = "L2UI_CH3.Button.smallbutton2";
const TEX_SMALL_BUTTON_DOWN = "L2UI_CH3.Button.smallbutton2_down";
const WIDTH = 600;
const HEIGHT = 326;
const CHANGE_WIDTH = 336;
const CHANGE_HEIGHT = 306;

export class NCManorCropSellChangeWnd { // NCManorCropSellChangeWnd: NConsole 0x10063ecf (W*0.5-168, H*0.5-153, 336x306, sys1152), OnCreate 0x10133d60, paint 0x10133af0
    public readonly element: HTMLDivElement;
    public onConfirm: (count: number, entry: ProcureEntry_T) => void = null;
    public getMyCropCount: () => number = null;
    protected readonly content: HTMLDivElement;
    protected readonly list: NCListCtrl;
    protected readonly manorCombo: NCComboBox;
    protected readonly countEdit: NDomEdit_T;
    protected arrEntries: ProcureEntry_T[] = [];
    protected arrInfo = ["", "", ""];

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, CHANGE_WIDTH, CHANGE_HEIGHT);
        this.element.hidden = true;
        NCFrameCtrl.createDOM(layer, this.element, CHANGE_WIDTH, manager.getSysString(1152), false, () => this.setVisible(false));
        layer.tile(this.element, 0, 20, CHANGE_WIDTH, CHANGE_HEIGHT - 20, 0, 0, CHANGE_WIDTH, CHANGE_HEIGHT - 20, TEX_CHANGE_BACK);
        this.content = layer.createWindow(0, 0, CHANGE_WIDTH, CHANGE_HEIGHT, this.element);
        this.content.style.pointerEvents = "none";
        layer.button(this.element, 196, 240, 66, 21, TEX_SMALL_BUTTON, TEX_SMALL_BUTTON_DOWN, null, manager.getSysString(1158), () => this.onMax());
        createTextButton(layer, this.element, 91, 277, 140, () => this.onOk());
        createTextButton(layer, this.element, 171, 277, 141, () => this.setVisible(false));
        this.countEdit = layer.edit(this.element, 123, 241, 68, 17, false, 10, true);
        this.element.focus = () => this.countEdit.focus();
        this.manorCombo = new NCComboBox(layer, this.element, 123, 216, 138, 17);
        this.list = new NCListCtrl(layer, this.element, 7, 92, 322, 109, [{ width: 115, label: 1153, numeric: false }, { width: 70, label: 1154, numeric: true }, { width: 70, label: 1126, numeric: true }, { width: 67, label: 1127, numeric: false }]);
        this.paint();
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 168), Math.trunc(height * 0.5 - 153)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        if (!visible) this.list.hide();
        this.element.hidden = !visible;
        if (!visible) this.layer.setModal(this.element, false);
    }

    public setCrop(name: string, reward1: string, reward2: string) { // NCManorCropSellWnd::OnChangeBtnClick 0x101350e0
        this.arrInfo = [name, reward1, reward2];
        this.paint();
    }

    public showDetail(detail: ManorProcureCropDetail_T) { // 0x10133720
        const manager = this.layer.getManager();

        this.arrEntries = detail.manors.map(manor => ({ manorId: manor.manorId, remaining: manor.remaining, price: manor.price, rewardType: manor.rewardType }));
        this.list.setRows(this.arrEntries.map((entry, index) => ({ id: index, cells: [getManorName(manager, entry.manorId), String(entry.remaining), String(entry.price), String(entry.rewardType)] })), true);
        this.manorCombo.setItems(this.arrEntries.map(entry => getManorName(manager, entry.manorId)));
        this.countEdit.setValue(""); // DoModal 0x101335f0
        this.manorCombo.setSelected(0);
        this.setVisible(true);
        this.layer.setModal(this.element, true);
        this.countEdit.focus();
    }

    protected getEntry() { return this.arrEntries[this.manorCombo.getSelected()] || null; }

    protected onMax() { // 0x10134490
        const entry = this.getEntry();

        if (entry && entry.remaining !== -1) this.countEdit.setValue(String(Math.min(entry.remaining, this.getMyCropCount ? this.getMyCropCount() : 0)));
    }

    protected onOk() { // 0x101345e0
        const entry = this.getEntry();

        if (entry && this.onConfirm) this.onConfirm(parseInt(this.countEdit.getValue(), 10) || 0, entry);
        this.setVisible(false);
    }

    protected paint() {
        const layer = this.layer, manager = layer.getManager(), parent = this.content;

        parent.replaceChildren();
        [1124, 1134, 1135].forEach((label, index) => {
            layer.text(parent, manager.getSysString(label), 0xffdcdcdc, undefined, 15, 38 + index * 16);
            layer.text(parent, this.arrInfo[index], 0xffb09b79, undefined, 76, 38 + index * 16);
        });
        layer.text(parent, manager.getSysString(1153), 0xffdcdcdc, undefined, 75, 219);
        layer.text(parent, manager.getSysString(1156), 0xffdcdcdc, undefined, 75, 244);
    }
}

export class NCManorCropSellWnd { // NCManorCropSellWnd: NConsole 0x10063dfb (W*0.5-300, H*0.5-163, 600x326, sys1152), OnCreate 0x10135230, paint 0x10135020
    public static getTextures(): string[] { return [...NCFrameCtrl.getTextures(), ...NCListCtrl.getTextures(), ...NDOM_EDIT_TEXTURES, TEX_SELL_BACK, TEX_CHANGE_BACK, TEX_SMALL_BUTTON, TEX_SMALL_BUTTON_DOWN, "L2UI_ch3.button.btn1_normal", "L2UI_ch3.button.btn1_normalon", ...["textbox1", "textbox2", "textbox3"].map(name => `L2UI_CH3.Etc.${name}`), "L2UI_CH3.ListCtrl.TextSelect", "L2UI_CH3.ListCtrl.TextSelect2", "L2UI_CH3.Button.downbutton", "L2UI_CH3.Button.downbutton_down"]; }

    public readonly element: HTMLDivElement;
    public readonly changeWnd: NCManorCropSellChangeWnd;
    public onBypass: (command: string) => void = null;
    public onProcure: (items: ProcureCropRequest_T[]) => void = null;
    protected readonly list: NCListCtrl;
    protected arrEntries: SellEntry_T[] = [];

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, WIDTH, HEIGHT);
        this.element.hidden = true;
        NCFrameCtrl.createDOM(layer, this.element, WIDTH, manager.getSysString(1152), false, () => this.setVisible(false));
        layer.tile(this.element, 0, 20, WIDTH, HEIGHT - 20, 0, 0, WIDTH, HEIGHT - 20, TEX_SELL_BACK); // NCManorInfoSettingWnd 0x10136ce0, paint 0x10136be0
        this.list = new NCListCtrl(layer, this.element, 7, 73, 586, 199, [{ width: 149, label: 1124, numeric: false }, { width: 70, label: 1153, numeric: false }, { width: 70, label: 1154, numeric: true }, { width: 70, label: 1126, numeric: true }, { width: 70, label: 1127, numeric: false }, { width: 70, label: 1155, numeric: true }, { width: 87, label: 1156, numeric: true }]);
        createTextButton(layer, this.element, 8, 297, 1142, () => this.onChange());
        createTextButton(layer, this.element, 438, 297, 1157, () => this.onSell());
        createTextButton(layer, this.element, 518, 297, 141, () => this.setVisible(false));

        this.changeWnd = new NCManorCropSellChangeWnd(layer);
        this.changeWnd.getMyCropCount = () => this.getMyCropCount();
        this.changeWnd.onConfirm = (count, entry) => this.notifyChangeSellValue(count, entry);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 300), Math.trunc(height * 0.5 - 163)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        if (!visible) this.list.hide();
        this.element.hidden = !visible;
    }

    public showSellCropList(info: ManorSellCropList_T) { // 0x101349e0
        const manager = this.layer.getManager(), strings = manager.strings;

        this.arrEntries = info.crops.map(crop => ({ objectId: crop.objectId, cropId: crop.cropId, manorId: crop.procureManorId, count: 0 }));
        this.list.setRows(info.crops.map((crop, index) => {
            const name = strings.itemNames[crop.cropId];

            return { id: index, cells: [name, getManorName(manager, crop.procureManorId), String(crop.remaining), String(crop.price), String(crop.rewardType), String(crop.ownedCount), "0", String(crop.level), strings.itemNames[crop.reward1ItemId], strings.itemNames[crop.reward2ItemId]], tooltip: getRewardTooltip(manager, name, crop.level, crop) };
        }), true);
        this.setVisible(true);
    }

    protected getSelected(): [ListRow_T, SellEntry_T] {
        const row = this.list.getSelectedRow();

        return row ? [row, this.arrEntries[Number(row.id)]] : [null, null];
    }

    protected getMyCropCount() { // GetMyCropCnt 0x10134e80
        const [row] = this.getSelected();

        return row ? parseInt(row.cells[5], 10) : 0;
    }

    protected notifyChangeSellValue(count: number, procure: ProcureEntry_T) { // 0x10134800
        const [row, entry] = this.getSelected();

        if (!row) return;

        entry.manorId = procure.manorId;
        entry.count = count;
        row.cells.splice(1, 4, getManorName(this.layer.getManager(), procure.manorId), String(procure.remaining), String(procure.price), String(procure.rewardType));
        row.cells[6] = String(count);
        this.list.setRows(this.list.getRows());
    }

    protected onChange() { // 0x101350e0
        const [row, entry] = this.getSelected();

        if (!row) return;

        if (this.onBypass) this.onBypass(`manor_menu_select?ask=9&state=${entry.cropId}&time=0`);
        this.changeWnd.setCrop(row.cells[0], row.cells[8], row.cells[9]);
    }

    protected onSell() { // 0x10135790
        const items = this.list.getRows().filter(row => parseInt(row.cells[6], 10)).map(row => {
            const entry = this.arrEntries[Number(row.id)];

            return { objectId: entry.objectId, itemId: entry.cropId, manorId: entry.manorId, count: parseInt(row.cells[6], 10) };
        });

        if (this.onProcure) this.onProcure(items);
        this.setVisible(false);
    }
}

export default NCManorCropSellWnd;
