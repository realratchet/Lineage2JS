import NCFrameCtrl from "./nc-frame-ctrl";
import NCListCtrl, { type ListColumn_T, type ListRow_T } from "./nc-list-ctrl";
import { NCComboBox } from "./nc-lobby-wnd";
import type { default as NDomLayer, NDomButton_T } from "./ndom";
import type { ManorCropInfo_T, ManorDefaultInfo_T, ManorEntry_T, ManorRewards_T, ManorSeedInfo_T } from "../network/game-packets";

type Manager_T = ReturnType<NDomLayer["getManager"]>;

const TEX_UP_BACK = "L2UI_CH3.Manor.manor1_back1";
const TEX_DOWN_BACK = "L2UI_CH3.Manor.manor1_back2";
const TEX_TAB = "L2UI_CH3.Manor.manor1_tab2";
const TEX_TAB_SELECTED = "L2UI_CH3.Manor.manor1_tab1";
const TEX_BUTTON = "L2UI_ch3.button.btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_ch3.button.btn1_normalon";
const arrManorNames = [0, 1049, 1052, 1053, 1057, 1060, 1059, 1248];
const WIDTH = 600;
const HEIGHT = 326;
const PAGE_HEIGHT = 278;

export function getManorName(manager: Manager_T, manorId: number) { return arrManorNames[manorId] ? manager.getSysString(arrManorNames[manorId]) : ""; } // NConsole 0x1006b290

export function getRewardTooltip(manager: Manager_T, name: string, level: number, rewards: ManorRewards_T) { // NWindow 0x10031b10: name, Lv, Reward Type 1/2
    const strings = manager.strings;

    return { title: name, lines: [{ label: manager.getSysString(537), value: String(level) }, { label: manager.getSysString(1134), value: strings.itemNames[rewards.reward1ItemId] }, { label: manager.getSysString(1135), value: strings.itemNames[rewards.reward2ItemId] }], description: "" };
}

export function createTextButton(layer: NDomLayer, parent: HTMLElement, x: number, y: number, label: number, onPress: () => void) { return layer.button(parent, x, y, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, layer.getManager().getSysString(label), onPress); } // NCTextButton 0x100034e0 type 0: btn1 76x23

class NCManorInfoDownWnd { // NCManorInfoDownWnd: OnCreate 0x10136960, paint 0x10136860
    public readonly element: HTMLDivElement;
    public onBypass: (command: string) => void = null;
    protected readonly content: HTMLDivElement;
    protected readonly list: NCListCtrl;
    protected isButtonHidden = false;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement, protected readonly label: number, columns: ListColumn_T[]) {
        this.element = layer.createWindow(0, 48, WIDTH, PAGE_HEIGHT, parent);
        layer.tile(this.element, 0, 0, WIDTH, PAGE_HEIGHT, 0, 0, WIDTH, PAGE_HEIGHT, TEX_DOWN_BACK);
        this.content = layer.createWindow(0, 0, WIDTH, PAGE_HEIGHT, this.element);
        this.content.style.pointerEvents = "none";
        this.list = new NCListCtrl(layer, this.element, 7, 42, 586, 199, columns);
    }

    public hide() { this.list.hide(); }

    protected paint() {
        this.content.replaceChildren();
        this.layer.text(this.content, this.layer.getManager().getSysString(this.label), 0xffdcdcdc, undefined, 16, 15);
    }

    protected bypass(command: string) { if (this.onBypass) this.onBypass(command); }
}

class NCManorSeedInfoWnd extends NCManorInfoDownWnd { // NCManorSeedInfoWnd: OnCreate 0x1013afd0, OnShowSeedInfo 0x1013a6e0, paint 0x1013ad20
    public shownManorId = -1;
    protected readonly button: NDomButton_T;
    protected readonly timeCombo: NCComboBox;
    protected readonly manorCombo: NCComboBox;
    protected arrManorIds: number[] = [];

    public constructor(layer: NDomLayer, parent: HTMLElement, label = 1113, columns: ListColumn_T[] = [{ width: 329, label: 1120, numeric: false }, { width: 80, label: 1121, numeric: true }, { width: 80, label: 1122, numeric: true }, { width: 97, label: 1123, numeric: true }], buttonLabel = 1119, protected readonly ask = 3) {
        super(layer, parent, label, columns);

        const manager = layer.getManager();

        this.button = createTextButton(layer, this.element, 518, 249, buttonLabel, () => this.onButton());
        this.timeCombo = new NCComboBox(layer, this.element, 164, 12, 70, 17);
        this.timeCombo.setItems([manager.getSysString(1116), manager.getSysString(1117)]);
        this.timeCombo.setSelected(0);
        this.manorCombo = new NCComboBox(layer, this.element, 354, 12, 130, 17);
        this.timeCombo.onChange = this.manorCombo.onChange = () => this.request();
    }

    public show(manorId: number, isButtonHidden: boolean, rows: ListRow_T[], manors: ManorEntry_T[]) {
        const manager = this.layer.getManager();

        this.isButtonHidden = isButtonHidden;
        this.list.setRows(rows, true);
        this.arrManorIds = manors.map(manor => manor.id);
        this.manorCombo.setItems(manors.map(manor => getManorName(manager, manor.id)));
        this.manorCombo.setSelected(this.arrManorIds.indexOf(manorId));
        this.button.hidden = isButtonHidden;
        this.paint();
    }

    public request() { this.bypass(`manor_menu_select?ask=${this.ask}&state=${this.getManorId()}&time=${this.timeCombo.getSelected()}`); } // 0x1013aef0

    protected getManorId() { return this.manorCombo.getSelected() < 0 ? -1 : this.arrManorIds[this.manorCombo.getSelected()]; }
    protected onButton() { this.bypass("manor_menu_select?ask=1&state=-1&time=0"); } // 0x1013a610

    protected paint() {
        super.paint();

        const manager = this.layer.getManager(), name = getManorName(manager, this.shownManorId);

        if (!this.isButtonHidden && name) this.layer.text(this.content, manager.getSystemMessage(1605).replace("$s1", name), 0xffdcdcdc, undefined, 16, 250);
    }
}

class NCManorCropInfoWnd extends NCManorSeedInfoWnd { // NCManorCropInfoWnd: OnCreate 0x10132e00, OnShowCropInfo 0x10132630, paint 0x10132c30
    public constructor(layer: NDomLayer, parent: HTMLElement) {
        super(layer, parent, 1114, [{ width: 269, label: 1124, numeric: false }, { width: 80, label: 1154, numeric: true }, { width: 80, label: 1125, numeric: true }, { width: 80, label: 1126, numeric: true }, { width: 77, label: 1127, numeric: false }], 1130, 4);
    }

    protected onButton() { this.bypass("manor_menu_select?ask=2&state=-1&time=0"); } // 0x10132470
}

class NCManorDefaultInfoWnd extends NCManorInfoDownWnd { // NCManorDefaultInfoWnd: OnCreate 0x10136300, OnShowManorDefaultInfo 0x10135d60, paint 0x10136210
    protected readonly arrButtons: NDomButton_T[];

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        super(layer, parent, 1131, [{ width: 169, label: 1124, numeric: false }, { width: 50, label: 537, numeric: true }, { width: 80, label: 1132, numeric: true }, { width: 80, label: 1133, numeric: true }, { width: 95, label: 1134, numeric: false }, { width: 112, label: 1135, numeric: false }]);
        this.arrButtons = [createTextButton(layer, this.element, 438, 249, 1119, () => this.bypass("manor_menu_select?ask=1&state=-1&time=0")), createTextButton(layer, this.element, 518, 249, 1130, () => this.bypass("manor_menu_select?ask=2&state=-1&time=0"))];
    }

    public show(isButtonHidden: boolean, rows: ListRow_T[]) {
        this.isButtonHidden = isButtonHidden;
        this.list.setRows(rows, true);
        this.arrButtons.forEach(button => button.hidden = isButtonHidden);
        this.paint();
    }

    public request() { this.bypass("manor_menu_select?ask=5&state=-1&time=0"); }
}

export class NCManorInfoWnd { // NCManorInfoWnd: NConsole 0x10063b7f (W*0.5-300, H*0.5-163, 600x326, sys738), OnCreate 0x10137a20
    public static getTextures(): string[] { return [...NCFrameCtrl.getTextures(), ...NCListCtrl.getTextures(), TEX_UP_BACK, TEX_DOWN_BACK, TEX_TAB, TEX_TAB_SELECTED, TEX_BUTTON, TEX_BUTTON_DOWN, ...["textbox1", "textbox2", "textbox3"].map(name => `L2UI_CH3.Etc.${name}`), "L2UI_CH3.ListCtrl.TextSelect", "L2UI_CH3.ListCtrl.TextSelect2", "L2UI_CH3.Button.downbutton", "L2UI_CH3.Button.downbutton_down"]; }

    public readonly element: HTMLDivElement;
    public onBypass: (command: string) => void = null;
    protected readonly seedWnd: NCManorSeedInfoWnd;
    protected readonly cropWnd: NCManorCropInfoWnd;
    protected readonly defaultWnd: NCManorDefaultInfoWnd;
    protected readonly arrTabs: NDomButton_T[] = [];

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager(), up = layer.createWindow(0, 20, WIDTH, 28);

        this.element = layer.createWindow(0, 0, WIDTH, HEIGHT);
        this.element.hidden = true;
        NCFrameCtrl.createDOM(layer, this.element, WIDTH, manager.getSysString(738), false, () => this.setVisible(false));
        this.element.appendChild(up);
        layer.tile(up, 0, 0, WIDTH, 28, 0, 0, WIDTH, 28, TEX_UP_BACK); // NCManorInfoUpWnd: OnCreate 0x101371f0, paint 0x10136fa0
        [1113, 1114, 1115].forEach((label, index) => this.arrTabs.push(layer.tab(up, 12 + index * 94, 5, 94, 23, TEX_TAB, TEX_TAB_SELECTED, manager.getSysString(label), null, () => this.onTabClick(index))));

        this.seedWnd = new NCManorSeedInfoWnd(layer, this.element);
        this.cropWnd = new NCManorCropInfoWnd(layer, this.element);
        this.defaultWnd = new NCManorDefaultInfoWnd(layer, this.element);
        this.getPages().forEach(page => page.onBypass = command => { if (this.onBypass) this.onBypass(command); });
        this.selectTab(0);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 300), Math.trunc(height * 0.5 - 163)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        if (!visible) this.getPages().forEach(page => page.hide());
        this.element.hidden = !visible;
    }

    public showSeedInfo(info: ManorSeedInfo_T, manors: ManorEntry_T[]) { // 0x10137730
        const manager = this.layer.getManager();

        if (!this.isVisible()) this.seedWnd.shownManorId = info.manorId; // 0x1013a600

        this.seedWnd.show(info.manorId, info.isButtonHidden, info.seeds.map(seed => {
            const name = manager.strings.itemNames[seed.seedId];

            return { id: seed.seedId, cells: [name, String(seed.remaining), String(seed.startAmount), String(seed.price)], tooltip: getRewardTooltip(manager, name, seed.level, seed) };
        }), manors);
        this.setVisible(true);
        this.selectTab(0);
    }

    public showCropInfo(info: ManorCropInfo_T, manors: ManorEntry_T[]) { // 0x10137800
        const manager = this.layer.getManager();

        this.cropWnd.show(info.manorId, info.isButtonHidden, info.crops.map(crop => {
            const name = manager.strings.itemNames[crop.cropId];

            return { id: crop.cropId, cells: [name, String(crop.remaining), String(crop.startAmount), String(crop.price), String(crop.rewardType)], tooltip: getRewardTooltip(manager, name, crop.level, crop) };
        }), manors);
        this.setVisible(true);
        this.selectTab(1);
    }

    public showDefaultInfo(info: ManorDefaultInfo_T) { // 0x101378c0
        const manager = this.layer.getManager(), strings = manager.strings;

        this.defaultWnd.show(info.isButtonHidden, info.crops.map(crop => {
            const name = strings.itemNames[crop.cropId];

            return { id: crop.cropId, cells: [name, String(crop.level), String(crop.seedPrice), String(crop.cropPrice), strings.itemNames[crop.reward1ItemId], strings.itemNames[crop.reward2ItemId]], tooltip: getRewardTooltip(manager, name, crop.level, crop) };
        }));
        this.setVisible(true);
        this.selectTab(2);
    }

    protected getPages() { return [this.seedWnd, this.cropWnd, this.defaultWnd]; }

    protected selectTab(index: number) {
        this.arrTabs.forEach((tab, i) => {
            tab.setTextures(i === index ? TEX_TAB_SELECTED : TEX_TAB, TEX_TAB_SELECTED);
            tab.setAttribute("aria-selected", String(i === index));
        });
        this.getPages().forEach((page, i) => {
            if (i !== index) page.hide();
            page.element.hidden = i !== index;
        });
    }

    protected onTabClick(index: number) { // NCManorInfoUpWnd::OnTabClick 0x101373a0
        this.selectTab(index);
        this.getPages()[index].request();
    }
}

export default NCManorInfoWnd;
