import NCFrameCtrl from "./nc-frame-ctrl";
import NCListCtrl from "./nc-list-ctrl";
import NCMinimizedWnd from "./nc-minimized-wnd";
import { NCComboBox } from "./nc-lobby-wnd";
import NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";
import type { PartyMatchList_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.PartyMatchWnd.PartyMatch1_Back";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_normalOn";
const TEX_SMALL = "L2UI_CH3.Button.SmallButton2";
const TEX_SMALL_DOWN = "L2UI_CH3.Button.SmallButton2_down";
const arrLocations = [-2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const arrLocationLabels = [1047, 1046, 1048, 1049, 1050, 1051, 1052, 1053, 1054, 1055, 1056, 1057, 1058, 1059, 1060, 1247, 1248];

export function getPartyLocation(layer: NDomLayer, location: number) {
    return location >= 1 && location <= 13 ? layer.getManager().getSysString(1047 + location) : location === 14 ? layer.getManager().getSysString(1247) : location === 15 ? layer.getManager().getSysString(1248) : "";
}

export class NCMatchWnd {
    public static getTextures() { return [TEX_BACK, TEX_BUTTON, TEX_BUTTON_DOWN, TEX_SMALL, TEX_SMALL_DOWN, ...NCFrameCtrl.getTextures(), ...NCListCtrl.getTextures(), ...NCMinimizedWnd.getTextures(), ...["textbox1", "textbox2", "textbox3"].map(name => `L2UI_CH3.Etc.${name}`), "L2UI_CH3.Button.downbutton", "L2UI_CH3.Button.downbutton_down"]; }
    public readonly element: HTMLDivElement;
    public readonly table: NCListCtrl;
    public readonly location: NCComboBox;
    public readonly level: NCComboBox;
    public readonly minimized: NCMinimizedWnd;
    public onConfig: (page: number, location: number, level: number) => void = null;
    public onJoin: (roomId: number, location: number) => void = null;
    public onCreate: () => void = null;
    protected readonly requestButtons: NDomButton_T[] = [];
    protected page = 1;
    protected locationIndex = 1;
    protected levelIndex = 1;
    protected elapsed = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 76, 600, 431);
        this.element.hidden = true;
        this.element.dataset.window = "party-match";
        layer.tile(this.element, 0, 20, 600, 411, 0, 0, 600, 411, TEX_BACK);
        this.minimized = new NCMinimizedWnd(layer, this.element, () => this.setVisible(true));
        NCFrameCtrl.createDOM(layer, this.element, 600, manager.getSysString(389), true, () => this.setVisible(false), null, () => this.minimized.minimize());
        [[1034, 80, 54], [1035, 260, 54]].forEach(([id, x, y]) => {
            const text = manager.getSysString(id);

            layer.text(this.element, text, 0xffdcdcdc, undefined, x - layer.measureText(text), y);
        });
        this.location = new NCComboBox(layer, this.element, 84, 52, 90, 17);
        this.location.setItems(arrLocationLabels.map(id => manager.getSysString(id)));
        this.location.setSelected(1);
        this.location.onChange = index => { this.locationIndex = index; };
        this.level = new NCComboBox(layer, this.element, 264, 52, 90, 17);
        this.level.setItems([manager.getSysString(1045), manager.getSysString(1046)]);
        this.level.setSelected(1);
        this.level.onChange = index => { this.levelIndex = index; };
        this.table = new NCListCtrl(layer, this.element, 7, 83, 585, 273, [{ width: 34, label: 416, numeric: true }, { width: 240, label: 413, numeric: false }, { width: 100, label: 408, numeric: false }, { width: 98, label: 1029, numeric: false }, { width: 72, label: 1030, numeric: false }, { width: 41, label: 1036, numeric: true }]);
        this.table.onDoubleClick = row => { if (this.onJoin) this.onJoin(Number(row.id), 0); };
        this.requestButtons.push(layer.button(this.element, 369, 50, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(1039), () => this.request(1)));
        this.requestButtons.push(layer.button(this.element, 233, 366, 64, 21, TEX_SMALL, TEX_SMALL_DOWN, null, manager.getSysString(1037), () => this.request(Math.max(1, this.page - 1))));
        this.requestButtons.push(layer.button(this.element, 303, 366, 64, 21, TEX_SMALL, TEX_SMALL_DOWN, null, manager.getSysString(1038), () => this.request(this.page + 1)));
        layer.button(this.element, 448, 402, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(1040), () => { if (this.onCreate) this.onCreate(); });
        this.requestButtons.push(layer.button(this.element, 523, 402, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(1041), () => {
            if (this.onJoin) this.onJoin(0, arrLocations[this.locationIndex]);
            this.setRequestsEnabled(false);
        }));
    }

    public placeOnScreen(width: number, height: number) {}
    public isVisible() { return !this.element.hidden; }
    public getPage() { return this.page; }
    public getLocation() { return arrLocations[this.locationIndex]; }
    public getLevelLimit() { return this.levelIndex; }
    public setVisible(visible: boolean) {
        this.location.setOpen(false);
        this.level.setOpen(false);
        if (visible && this.minimized.isVisible()) this.minimized.restore(true);
        this.element.hidden = !visible;
        this.minimized.hide();
        if (!visible) this.table.hideTooltip();
        else this.layer.activate(this.element);
    }
    public show(list: PartyMatchList_T) {
        this.page = list.page;
        this.table.setRows(list.rooms.slice(0, 15).map(room => ({ id: room.roomId, cells: [String(room.roomId), room.title, room.ownerName, getPartyLocation(this.layer, room.location), `${room.minLevel}-${room.maxLevel}`, `${room.members}/${room.maxMembers}`] })), true);
        this.setVisible(true);
    }
    public resetFilters() {
        this.locationIndex = this.levelIndex = 1;
        this.location.setSelected(1);
        this.level.setSelected(1);
    }
    public request(page: number) {
        if (this.onConfig) this.onConfig(page, arrLocations[this.locationIndex], this.levelIndex);
        this.setRequestsEnabled(false);
    }
    public tick(deltaTime: number) {
        this.elapsed += deltaTime;
        if (this.elapsed >= 5000) { this.elapsed %= 5000; this.setRequestsEnabled(true); }
        this.minimized.tick(deltaTime);
    }
    protected setRequestsEnabled(enabled: boolean) { this.requestButtons.forEach(button => { button.setEnabled(enabled); button.setAttribute("aria-disabled", String(!enabled)); }); }
}

export default NCMatchWnd;
