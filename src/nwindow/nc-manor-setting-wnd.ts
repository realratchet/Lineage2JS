import NCFrameCtrl from "./nc-frame-ctrl";
import NCListCtrl, { type ListColumn_T, type ListRow_T } from "./nc-list-ctrl";
import { NCComboBox } from "./nc-lobby-wnd";
import { type default as NDomLayer, type NDomEdit_T, NDOM_EDIT_TEXTURES } from "./ndom";
import { createTextButton, getManorName, getRewardTooltip } from "./nc-manor-info-wnd";
import type { CropSettingRequest_T, ManorCropSetting_T, ManorCropSettings_T, ManorSeedSetting_T, ManorSeedSettings_T, SeedSettingRequest_T } from "../network/game-packets";

type AlertHandler_T = (message: string) => void;
type ConfirmHandler_T = (message: string, onOk: () => void) => void;

const TEX_SETTING_BACK = "L2UI_CH3.Manor.manor2_back";
const TEX_CHANGE_BACK = "L2UI_CH3.Manor.manor4_back";
const TEX_ADENA = "L2UI.WindowIcon.WindowIconAdena";
const arrTextBoxes = [1, 2, 3].map(index => `L2UI_CH3.Etc.textbox${index}`);
const arrComboTextures = ["L2UI_CH3.ListCtrl.TextSelect", "L2UI_CH3.ListCtrl.TextSelect2", "L2UI_CH3.Button.downbutton", "L2UI_CH3.Button.downbutton_down"];
const WIDTH = 600;
const HEIGHT = 326;
const CHANGE_WIDTH = 256;
const CHANGE_HEIGHT = 201;

function formatMessage(layer: NDomLayer, id: number, ...params: number[]) { return layer.getManager().getSystemMessage(id).replace(/\$s(\d)/g, (_match, index) => String(params[Number(index) - 1] ?? "")); }
function toInt(text: string) { return parseInt(text, 10) || 0; } // _wtoi

class NCManorInfoChangeWnd { // shared by NCManorSeedInfoChangeWnd / NCManorCropInfoChangeWnd
    public readonly element: HTMLDivElement;
    public onAlert: AlertHandler_T = null;
    protected readonly content: HTMLDivElement;
    protected readonly amountEdit: NDomEdit_T;
    protected readonly priceEdit: NDomEdit_T;
    protected name = "";
    protected limit = 0;
    protected minPrice = 0;
    protected maxPrice = 0;

    public constructor(protected readonly layer: NDomLayer, title: number, protected readonly arrLabels: number[]) {
        this.element = layer.createWindow(0, 0, CHANGE_WIDTH, CHANGE_HEIGHT);
        this.element.hidden = true;
        NCFrameCtrl.createDOM(layer, this.element, CHANGE_WIDTH, layer.getManager().getSysString(title), false, () => this.setVisible(false));
        layer.tile(this.element, 0, 20, CHANGE_WIDTH, CHANGE_HEIGHT - 20, 0, 0, CHANGE_WIDTH, CHANGE_HEIGHT - 20, TEX_CHANGE_BACK);
        this.content = layer.createWindow(0, 0, CHANGE_WIDTH, CHANGE_HEIGHT, this.element);
        this.content.style.pointerEvents = "none";
        createTextButton(layer, this.element, 51, 172, 140, () => this.onOk());
        createTextButton(layer, this.element, 131, 172, 141, () => this.setVisible(false));
        this.amountEdit = layer.edit(this.element, 145, 68, 68, 17, false, 10, true);
        this.priceEdit = layer.edit(this.element, 145, 118, 68, 17, false, 10, true);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 128), Math.trunc(height * 0.5 - 100)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        this.layer.setModal(this.element, visible);
    }

    protected open(name: string, limit: number, amount: string, price: string, minPrice: number, maxPrice: number) { // DoModal 0x10137de0: focus on the amount edit
        this.name = name;
        this.limit = limit;
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.amountEdit.setValue(amount);
        this.priceEdit.setValue(price);
        this.paint();
        this.setVisible(true);
        this.amountEdit.focus();
    }

    protected validate(limitMessage: number, priceMessage: number) {
        const amount = toInt(this.amountEdit.getValue()), price = toInt(this.priceEdit.getValue());

        if (amount < 0 || this.limit < amount) this.alert(formatMessage(this.layer, limitMessage, 0, this.limit));
        else if (amount && (this.minPrice > price || this.maxPrice < price)) this.alert(formatMessage(this.layer, priceMessage, this.minPrice, this.maxPrice));
        else return [amount, price];

        return null;
    }

    protected onOk() {}

    protected alert(message: string) { if (this.onAlert) this.onAlert(message); }

    protected paint() { // OnPaint 0x10138530
        const layer = this.layer, manager = layer.getManager(), parent = this.content;

        parent.replaceChildren();
        layer.text(parent, this.name, 0xffdcdcdc, undefined, 21, 40);
        this.arrLabels.forEach((label, index) => layer.text(parent, manager.getSysString(label), 0xffdcdcdc, undefined, 31, 71 + index * 25));
        layer.text(parent, this.limit.toLocaleString("en-US"), 0xffdcdcdc, undefined, 145, 96);
    }
}

class NCManorSeedInfoChangeWnd extends NCManorInfoChangeWnd { // NConsole 0x10063fa1 (W*0.5-128, H*0.5-100, 256x201, sys1136), OnCreate 0x10138730
    public onChange: (amount: number, price: number) => void = null;

    public constructor(layer: NDomLayer) { super(layer, 1136, [1139, 1224, 1140]); }

    public show(seed: ManorSeedSetting_T, row: ListRow_T) { this.open(row.cells[0], seed.nextSaleLimit, row.cells[3], row.cells[4], seed.minPrice, seed.maxPrice); } // NCManorSeedInfoSettingWnd::OnChangeBtnClick 0x10138f60

    protected onOk() { // 0x10138050
        const values = this.validate(1558, 1557);

        if (!values) return;

        this.setVisible(false);
        if (this.onChange) this.onChange(values[0], values[1]);
    }
}

class NCManorCropInfoChangeWnd extends NCManorInfoChangeWnd { // NConsole 0x10064073 (W*0.5-128, H*0.5-100, 256x201, sys1145), OnCreate 0x10130260
    public onChange: (amount: number, price: number, reward: number) => void = null;
    protected readonly rewardCombo: NCComboBox;

    public constructor(layer: NDomLayer) {
        super(layer, 1145, [1225, 1226, 1149, 1150]);
        this.rewardCombo = new NCComboBox(layer, this.element, 145, 143, 68, 17);
        this.rewardCombo.setItems(["1", "2"]);
        this.rewardCombo.setSelected(0);
    }

    public show(crop: ManorCropSetting_T, row: ListRow_T) { // NCManorCropInfoSettingWnd::OnChangeBtnClick 0x10130b60
        this.rewardCombo.setSelected((toInt(row.cells[6]) || 1) - 1); // SetPrice 0x1012fa50
        this.open(row.cells[0], crop.nextPurchaseLimit, row.cells[4], row.cells[5], crop.minPrice, crop.maxPrice);
    }

    protected onOk() { // 0x1012ff00
        const values = this.validate(1560, 1559);

        if (!values) return;

        this.setVisible(false);
        if (this.onChange) this.onChange(values[0], values[1], this.rewardCombo.getSelected() + 1);
    }
}

class NCManorInfoSettingWnd { // NCManorInfoSettingWnd: OnCreate 0x10136ce0, paint 0x10136be0
    public readonly element: HTMLDivElement;
    public onAlert: AlertHandler_T = null;
    public onConfirm: ConfirmHandler_T = null;
    protected readonly content: HTMLDivElement;
    protected readonly list: NCListCtrl;
    protected manorId = 0;
    protected total = 0;

    public constructor(protected readonly layer: NDomLayer, title: number, columns: ListColumn_T[], arrButtons: [number, number, () => void][]) {
        this.element = layer.createWindow(0, 0, WIDTH, HEIGHT);
        this.element.hidden = true;
        NCFrameCtrl.createDOM(layer, this.element, WIDTH, layer.getManager().getSysString(title), false, () => this.setVisible(false));
        layer.tile(this.element, 0, 20, WIDTH, HEIGHT - 20, 0, 0, WIDTH, HEIGHT - 20, TEX_SETTING_BACK);
        this.content = layer.createWindow(0, 0, WIDTH, HEIGHT, this.element);
        this.content.style.pointerEvents = "none";
        this.list = new NCListCtrl(layer, this.element, 7, 73, 586, 199, columns);
        this.list.onDoubleClick = () => this.onChangeClick(); // OnListCtrl
        arrButtons.forEach(([x, label, onPress]) => createTextButton(layer, this.element, x, 297, label, onPress));
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 300), Math.trunc(height * 0.5 - 163)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        if (!visible) this.list.hide();
        this.element.hidden = !visible;
    }

    protected onChangeClick() {}

    protected confirm(messageId: number, onOk: () => void) { if (this.onConfirm) this.onConfirm(this.layer.getManager().getSystemMessage(messageId), onOk); } // 0x10139140 / 0x10139220: dialog 87 / 86

    protected setNextCells(arrIndices: number[], getValue: (row: ListRow_T, index: number) => string) {
        const rows = this.list.getRows();

        rows.forEach(row => arrIndices.forEach((cell, index) => row.cells[cell] = getValue(row, index)));
        this.list.setRows(rows);
        this.calcDefaultPriceSum();
    }

    protected calcDefaultPriceSum() {}

    protected paint() { // OnPaint 0x10138d50 / 0x10130950
        const layer = this.layer, manager = layer.getManager(), parent = this.content;

        parent.replaceChildren();
        layer.tile(parent, 107, 278, 16, 12, 0, 0, 16, 12, TEX_ADENA);
        layer.tile(parent, 126, 276, 8, 17, 0, 0, 8, 17, arrTextBoxes[0]);
        layer.tile(parent, 134, 276, 70, 17, 0, 0, 8, 17, arrTextBoxes[1]);
        layer.tile(parent, 204, 276, 8, 17, 0, 0, 8, 17, arrTextBoxes[2]);
        layer.text(parent, getManorName(manager, this.manorId), 0xffdcdcdc, undefined, 16, 47);
        layer.text(parent, manager.getSysString(1141), 0xffdcdcdc, undefined, 16, 279);
        layer.text(parent, this.total.toLocaleString("en-US"), 0xffdcdcdc, undefined, 130, 279);
    }
}

export class NCManorSeedInfoSettingWnd extends NCManorInfoSettingWnd { // NConsole 0x10063c53 (W*0.5-300, H*0.5-163, 600x326, sys1136), OnCreate 0x10139300
    public static getTextures(): string[] { return [...NCFrameCtrl.getTextures(), ...NCListCtrl.getTextures(), ...NDOM_EDIT_TEXTURES, ...arrTextBoxes, ...arrComboTextures, TEX_SETTING_BACK, TEX_CHANGE_BACK, TEX_ADENA, "L2UI_ch3.button.btn1_normal", "L2UI_ch3.button.btn1_normalon"]; }

    public readonly changeWnd: NCManorSeedInfoChangeWnd;
    public onSubmit: (manorId: number, items: SeedSettingRequest_T[]) => void = null;
    protected arrSeeds: ManorSeedSetting_T[] = [];

    public constructor(layer: NDomLayer) {
        super(layer, 1136, [{ width: 249, label: 1120, numeric: false }, { width: 80, label: 1137, numeric: true }, { width: 80, label: 1138, numeric: true }, { width: 80, label: 1139, numeric: true }, { width: 97, label: 1140, numeric: true }], [
            [8, 1142, () => this.onChangeClick()], [88, 1143, () => this.confirm(1601, () => this.setNextCells([3, 4], (row, index) => row.cells[1 + index]))], [168, 1144, () => this.confirm(1600, () => this.setNextCells([3, 4], () => "0"))], [438, 140, () => this.submit()], [518, 141, () => this.setVisible(false)]
        ]);
        this.changeWnd = new NCManorSeedInfoChangeWnd(layer);
        this.changeWnd.onChange = (amount, price) => { // NotifyChangeTomValue 0x10139c80
            const row = this.list.getSelectedRow();

            if (!row) return;

            row.cells[3] = String(amount);
            row.cells[4] = String(price);
            this.list.setRows(this.list.getRows());
            this.calcDefaultPriceSum();
        };
    }

    public placeOnScreen(width: number, height: number) {
        super.placeOnScreen(width, height);
        this.changeWnd.placeOnScreen(width, height);
    }

    public setVisible(visible: boolean) {
        if (!visible) this.changeWnd.setVisible(false);
        super.setVisible(visible);
    }

    public setAlertHandler(handler: AlertHandler_T) { this.onAlert = this.changeWnd.onAlert = handler; }

    public show(settings: ManorSeedSettings_T) { // OnShowSeedSetting 0x10139d40
        const manager = this.layer.getManager();

        this.manorId = settings.manorId;
        this.arrSeeds = settings.seeds;
        this.list.setRows(settings.seeds.map(seed => {
            const name = manager.strings.itemNames[seed.seedId];

            return { id: seed.seedId, cells: [name, String(seed.todaySales), String(seed.todayPrice), String(seed.nextSales), String(seed.nextPrice)], tooltip: getRewardTooltip(manager, name, seed.level, seed) }; // row type 0x80000
        }), true);
        this.calcDefaultPriceSum();
        this.setVisible(true);
    }

    protected onChangeClick() { // 0x10138f60
        const row = this.list.getSelectedRow();

        if (row) this.changeWnd.show(this.getSeed(row), row);
    }

    protected getSeed(row: ListRow_T) { return this.arrSeeds.find(seed => seed.seedId === row.id); }

    protected calcDefaultPriceSum() { // 0x10139b90: next sales * castle produce price
        this.total = this.list.getRows().reduce((total, row) => total + toInt(row.cells[3]) * this.getSeed(row).castleProducePrice, 0);
        this.paint();
    }

    protected submit() { // OnOKBtnClick 0x101399f0
        if (this.onSubmit) this.onSubmit(this.manorId, this.list.getRows().map(row => ({ seedId: Number(row.id), sales: toInt(row.cells[3]), price: toInt(row.cells[4]) })));
        this.setVisible(false);
    }
}

export class NCManorCropInfoSettingWnd extends NCManorInfoSettingWnd { // NConsole 0x10063d27 (W*0.5-300, H*0.5-163, 600x326, sys1145), OnCreate 0x10130fc0
    public static getTextures(): string[] { return NCManorSeedInfoSettingWnd.getTextures(); }

    public readonly changeWnd: NCManorCropInfoChangeWnd;
    public onSubmit: (manorId: number, items: CropSettingRequest_T[]) => void = null;
    protected arrCrops: ManorCropSetting_T[] = [];

    public constructor(layer: NDomLayer) {
        super(layer, 1145, [{ width: 149, label: 1124, numeric: false }, { width: 70, label: 1146, numeric: true }, { width: 70, label: 1147, numeric: true }, { width: 70, label: 1148, numeric: false }, { width: 70, label: 1225, numeric: true }, { width: 70, label: 1149, numeric: true }, { width: 87, label: 1150, numeric: false }], [
            [8, 1142, () => this.onChangeClick()], [88, 1143, () => this.confirm(1601, () => this.setNextCells([4, 5, 6], (row, index) => row.cells[1 + index]))], [168, 1151, () => this.confirm(1600, () => this.setNextCells([4, 5, 6], () => "0"))], [438, 140, () => this.submit()], [518, 141, () => this.setVisible(false)]
        ]);
        this.changeWnd = new NCManorCropInfoChangeWnd(layer);
        this.changeWnd.onChange = (amount, price, reward) => { // NotifyChangeTomValue 0x101319f0
            const row = this.list.getSelectedRow();

            if (row) {
                row.cells[4] = String(amount);
                row.cells[5] = String(price);
                row.cells[6] = String(reward);
                this.list.setRows(this.list.getRows());
            }
            this.calcDefaultPriceSum();
        };
    }

    public placeOnScreen(width: number, height: number) {
        super.placeOnScreen(width, height);
        this.changeWnd.placeOnScreen(width, height);
    }

    public setVisible(visible: boolean) {
        if (!visible) this.changeWnd.setVisible(false);
        super.setVisible(visible);
    }

    public setAlertHandler(handler: AlertHandler_T) { this.onAlert = this.changeWnd.onAlert = handler; }

    public show(settings: ManorCropSettings_T) { // OnShowCropSetting 0x10131ad0
        const manager = this.layer.getManager();

        this.manorId = settings.manorId;
        this.arrCrops = settings.crops;
        this.list.setRows(settings.crops.map(crop => {
            const name = manager.strings.itemNames[crop.cropId];

            return { id: crop.cropId, cells: [name, String(crop.todayBuy), String(crop.todayPrice), String(crop.todayRewardType), String(crop.nextBuy), String(crop.nextPrice), String(crop.nextRewardType)], tooltip: getRewardTooltip(manager, name, crop.level, crop) }; // row type 0x100000
        }), true);
        this.calcDefaultPriceSum();
        this.setVisible(true);
    }

    protected onChangeClick() { // 0x10130b60
        const row = this.list.getSelectedRow();

        if (row) this.changeWnd.show(this.arrCrops.find(crop => crop.cropId === row.id), row);
    }

    protected calcDefaultPriceSum() { // 0x101318e0: next buy * next price
        this.total = this.list.getRows().reduce((total, row) => total + toInt(row.cells[4]) * toInt(row.cells[5]), 0);
        this.paint();
    }

    protected submit() { // OnOKBtnClick 0x10131710
        if (this.onSubmit) this.onSubmit(this.manorId, this.list.getRows().map(row => ({ cropId: Number(row.id), sales: toInt(row.cells[4]), price: toInt(row.cells[5]), rewardType: toInt(row.cells[6]) })));
        this.setVisible(false);
    }
}

export default NCManorSeedInfoSettingWnd;
