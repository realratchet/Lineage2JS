import NCFrameCtrl from "./nc-frame-ctrl";
import NCListCtrl from "./nc-list-ctrl";
import NCMinimizedWnd from "./nc-minimized-wnd";
import { NCComboBox } from "./nc-lobby-wnd";
import NDomLayer, { type NDomButton_T } from "./ndom";
import type { PartyMatchList_T } from "../network/game-packets";
import { SKIN_SLOTS } from "./skin-textures";
import SysString_T from "./sys-string";

const TEX_BACK = "L2UI_CH3.PartyMatchWnd.PartyMatch1_Back";
const TEX_BUTTON = SKIN_SLOTS.button;
const TEX_BUTTON_DOWN = SKIN_SLOTS.buttonDown;
const TEX_SMALL = SKIN_SLOTS.smallButton;
const TEX_SMALL_DOWN = SKIN_SLOTS.smallButtonDown;
const arrLocations = [-2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const arrLocationLabels = [SysString_T.NearMe, SysString_T.AllLocations, SysString_T.TalkingIsland, SysString_T.Gludio, SysString_T.DarkElvenTer, SysString_T.ElvenTerritory, SysString_T.Dion, SysString_T.Giran, SysString_T.NeutralZone, SysString_T.Lyonn, SysString_T.Schuttgart, SysString_T.Oren, SysString_T.HuntersVillage, SysString_T.Innadril, SysString_T.Aden, SysString_T.Rune, SysString_T.Goddard];

export function getPartyLocation(layer: NDomLayer, location: number) {
    return location >= 1 && location <= 13 ? layer.getManager().getSysString(SysString_T.NearMe + location) : location === 14 ? layer.getManager().getSysString(SysString_T.Rune) : location === 15 ? layer.getManager().getSysString(SysString_T.Goddard) : "";
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
        NCFrameCtrl.createDOM(layer, this.element, 600, manager.getSysString(SysString_T.PartyMatching), true, () => this.setVisible(false), null, () => { this.table.hide(); this.minimized.minimize(); });
        [[SysString_T.LocCondition, 80, 54], [SysString_T.LevelCondition, 260, 54]].forEach(([id, x, y]) => {
            const text = manager.getSysString(id);

            layer.text(this.element, text, 0xffdcdcdc, undefined, x - layer.measureText(text), y);
        });
        this.location = new NCComboBox(layer, this.element, 84, 52, 90, 17);
        this.location.setItems(arrLocationLabels.map(id => manager.getSysString(id)));
        this.location.setSelected(1);
        this.location.onChange = index => { this.locationIndex = index; };
        this.level = new NCComboBox(layer, this.element, 264, 52, 90, 17);
        this.level.setItems([manager.getSysString(SysString_T.MyLevelRange), manager.getSysString(SysString_T.AllLocations)]);
        this.level.setSelected(1);
        this.level.onChange = index => { this.levelIndex = index; };
        this.table = new NCListCtrl(layer, this.element, 7, 83, 585, 273, [{ width: 34, label: SysString_T.Number, numeric: true }, { width: 240, label: SysString_T.RoomTitle, numeric: false }, { width: 100, label: SysString_T.PartyLeader, numeric: false }, { width: 98, label: SysString_T.Location, numeric: false }, { width: 72, label: SysString_T.LevelLimit, numeric: false }, { width: 41, label: SysString_T.PartySize, numeric: true }]);
        this.table.onDoubleClick = row => { if (this.onJoin) this.onJoin(Number(row.id), 0); };
        this.requestButtons.push(layer.button(this.element, 369, 50, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(SysString_T.ListUpdate), () => this.request(1)));
        this.requestButtons.push(layer.button(this.element, 233, 366, 64, 21, TEX_SMALL, TEX_SMALL_DOWN, null, manager.getSysString(SysString_T.PreviousPage), () => this.request(Math.max(1, this.page - 1))));
        this.requestButtons.push(layer.button(this.element, 303, 366, 64, 21, TEX_SMALL, TEX_SMALL_DOWN, null, manager.getSysString(SysString_T.NextPage), () => this.request(this.page + 1)));
        layer.button(this.element, 448, 402, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(SysString_T.CreateRoom), () => { if (this.onCreate) this.onCreate(); });
        this.requestButtons.push(layer.button(this.element, 523, 402, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(SysString_T.AutoAccept), () => {
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
        if (!visible) this.table.hide();
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
