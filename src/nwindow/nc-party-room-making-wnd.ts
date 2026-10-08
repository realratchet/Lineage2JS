import NDomLayer, { NDOM_EDIT_TEXTURES } from "./ndom";
import type { NDomEdit_T } from "./ndom";
import { NCComboBox } from "./nc-lobby-wnd";
import { FontType_T } from "./nwindow-canvas";
import type { PartyMatchDetail_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.PartyMatchWnd.PartyMatch3_Back";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_normalOn";

export type PartyRoomSettings_T = { roomId: number, maxMembers: number, minLevel: number, maxLevel: number, lootType: number, title: string };

export class NCPartyRoomMakingWnd {
    public static getTextures() { return [TEX_BACK, TEX_BUTTON, TEX_BUTTON_DOWN, ...NDOM_EDIT_TEXTURES, ...["textbox1", "textbox2", "textbox3"].map(name => `L2UI_CH3.Etc.${name}`), "L2UI_CH3.ListCtrl.TextSelect", "L2UI_CH3.ListCtrl.TextSelect2", "L2UI_CH3.Button.downbutton", "L2UI_CH3.Button.downbutton_down"]; }
    public readonly element: HTMLDivElement;
    public readonly title: NDomEdit_T;
    public readonly minimum: NDomEdit_T;
    public readonly maximum: NDomEdit_T;
    public readonly members: NCComboBox;
    public onSubmit: (settings: PartyRoomSettings_T) => void = null;
    public getLootType: () => number = null;
    protected roomId = 0;
    protected maxMembers = 10;
    protected lootType = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 356, 141);
        this.element.hidden = true;
        layer.tile(this.element, 0, 0, 356, 141, 0, 0, 356, 141, TEX_BACK);
        this.title = layer.edit(this.element, 103, 17, 236, 17);
        this.minimum = layer.edit(this.element, 131, 57, 26, 17, false, 0, true);
        this.maximum = layer.edit(this.element, 201, 57, 26, 17, false, 0, true);
        this.members = new NCComboBox(layer, this.element, 103, 37, 40, 17);
        this.members.setItems(Array.from({ length: 19 }, (_, index) => String(index + 2)));
        this.members.onChange = index => { this.maxMembers = index + 2; };
        [[413, 94, 20], [1042, 94, 40], [1030, 94, 60], [1043, 127, 60], [1044, 197, 60]].forEach(([id, x, y]) => {
            const text = manager.getSysString(id);

            layer.text(this.element, text, 0xffdcdcdc, FontType_T.SMALL, x - layer.measureText(text), y);
        });
        layer.button(this.element, 101, 110, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(140), () => this.submit());
        layer.button(this.element, 181, 110, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(141), () => this.setVisible(false));
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 178), Math.trunc(height * 0.5 - 70)); }
    public isVisible() { return !this.element.hidden; }

    public setVisible(isVisible: boolean) {
        this.members.setOpen(false);
        this.element.hidden = !isVisible;

        if (isVisible) this.layer.activate(this.element);
        else if (this.element.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    }

    public showCreate(playerLevel: number, clientLootType: number) {
        this.show({ roomId: 0, maxMembers: 10, minLevel: Math.max(1, playerLevel - 5), maxLevel: Math.min(78, playerLevel + 5), lootType: clientLootType, title: this.layer.getManager().getSystemMessage(1398) });
    }

    public showEdit(detail: PartyMatchDetail_T, clientLootType: number) { this.show({ ...detail, lootType: clientLootType }); }

    protected show(settings: PartyRoomSettings_T) {
        this.roomId = settings.roomId;
        this.maxMembers = settings.maxMembers;
        this.lootType = settings.lootType;
        this.title.setValue(settings.title);
        this.minimum.setValue(String(settings.minLevel));
        this.maximum.setValue(String(settings.maxLevel));
        this.members.setSelected(settings.maxMembers - 2);
        this.setVisible(true);
    }

    protected filterTitle(value: string) {
        const manager = this.layer.getManager();
        const replacement = manager.getSysString(740);
        let title = "";

        for (let i = 0; i < value.length; i++) {
            const character = value[i];

            if (character === "\r" || character === "\n" || manager.canvas.hasGlyphs(character)) title += character;
        }

        let search = title.replace(/[A-Z]/g, character => character.toLowerCase());

        manager.strings.obsceneWords.forEach(word => {
            if (!word) return;

            let index = search.indexOf(word);

            while (index >= 0) {
                title = title.slice(0, index) + replacement + title.slice(index + word.length);
                search = search.slice(0, index) + replacement + search.slice(index + word.length);
                index = search.indexOf(word);
            }
        });

        return title;
    }

    public submit() {
        const minLevel = Math.max(1, Math.min(78, parseInt(this.minimum.getValue().replace(/,/g, ""), 10) || 0));
        const maxLevel = Math.max(minLevel, Math.max(1, Math.min(78, parseInt(this.maximum.getValue().replace(/,/g, ""), 10) || 0)));
        const value = this.title.getValue();
        const title = value ? this.filterTitle(value) : this.layer.getManager().getSystemMessage(1398);

        if (this.onSubmit) this.onSubmit({ roomId: this.roomId, maxMembers: this.maxMembers, minLevel, maxLevel, lootType: this.getLootType ? this.getLootType() : this.lootType, title });

        this.setVisible(false);
    }
}

export default NCPartyRoomMakingWnd;
