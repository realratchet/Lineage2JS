import NCFrameCtrl from "./nc-frame-ctrl";
import NCListCtrl from "./nc-list-ctrl";
import NCMinimizedWnd from "./nc-minimized-wnd";
import NDomLayer, { NDOM_EDIT_TEXTURES, NDOM_SCROLL_TEXTURES, type NDomButton_T, type NDomEdit_T, type NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { PartyMatchDetail_T, PartyRoomMember_T } from "../network/game-packets";
import { SKIN_SLOTS } from "./skin-textures";
import SysString_T from "./sys-string";

const TEX_BACK = "L2UI_CH3.PartyMatchWnd.PartyMatch2_Back";
const TEX_BUTTON = SKIN_SLOTS.smallButton;
const TEX_BUTTON_DOWN = SKIN_SLOTS.smallButtonDown;

export class NCPartyRoomWnd {
    public static getTextures() { return [TEX_BACK, TEX_BUTTON, TEX_BUTTON_DOWN, ...NCFrameCtrl.getTextures(), ...NCListCtrl.getTextures(), ...NCMinimizedWnd.getTextures(), ...NDOM_EDIT_TEXTURES, ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public readonly table: NCListCtrl;
    public readonly input: NDomEdit_T;
    public readonly minimized: NCMinimizedWnd;
    public onSettings: (detail: PartyMatchDetail_T) => void = null;
    public onKick: (objectId: number) => void = null;
    public onInvite: (name: string, lootType: number) => void = null;
    public onTerminate: (mode: number) => void = null;
    public onChat: (text: string) => void = null;
    protected readonly header: HTMLDivElement;
    protected readonly chat: NDomScrollPane_T;
    protected readonly ownerButtons: NDomButton_T[] = [];
    protected detail: PartyMatchDetail_T = null;
    protected mode = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 76, 600, 431);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 600, 411, 0, 0, 600, 411, TEX_BACK);
        this.minimized = new NCMinimizedWnd(layer, this.element, () => this.setVisible(true));
        NCFrameCtrl.createDOM(layer, this.element, 600, manager.getSysString(SysString_T.PartyMatching), true, () => this.close(), null, () => { this.table.hide(); this.minimized.minimize(); });
        this.header = layer.createWindow(0, 20, 600, 82, this.element);
        this.table = new NCListCtrl(layer, this.element, 7, 123, 586, 172, [
            { width: 204, label: SysString_T.CharacterName, numeric: false }, { width: 54, label: SysString_T.ClassAbbreviation, numeric: true, isClass: true }, { width: 74, label: SysString_T.MemberLevel, numeric: true }, { width: 132, label: SysString_T.Location, numeric: false }, { width: 121, label: SysString_T.PartyMembership, numeric: false }
        ]);
        this.chat = layer.scrollPane(this.element, 7, 302, 586, 72, 17, false, 4);
        const chatViewport = layer.createWindow(0, 0, 571, 68, this.chat);

        chatViewport.style.overflow = "hidden";
        chatViewport.appendChild(this.chat.content);
        this.chat.content.setAttribute("role", "log");
        this.input = layer.edit(this.element, 7, 377, 436, 17, false, 131);
        this.input.input.addEventListener("keydown", event => {
            if (event.key !== "Enter" || event.isComposing) return;

            event.preventDefault();
            const text = this.input.getValue();

            if (text && this.onChat) this.onChat(text);
            this.input.setValue("");
        });
        this.ownerButtons.push(layer.button(this.element, 298, 402, 66, 21, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(SysString_T.SetRoom), () => {
            if (this.detail && this.onSettings) this.onSettings(this.detail);
        }));
        this.ownerButtons.push(layer.button(this.element, 373, 402, 66, 21, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(SysString_T.Kick), () => {
            const row = this.table.getSelectedRow();

            if (row && this.onKick) this.onKick(Number(row.id));
        }));
        this.ownerButtons.push(layer.button(this.element, 448, 402, 66, 21, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(SysString_T.InviteToParty), () => {
            const row = this.table.getSelectedRow();

            if (row && this.detail && this.onInvite) this.onInvite(row.cells[0], this.detail.lootType);
        }));
        layer.button(this.element, 523, 402, 66, 21, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(SysString_T.Terminate), () => this.close());
        this.setMode(0);
    }

    public placeOnScreen(width: number, height: number) {}
    public tick(deltaTime: number) { this.minimized.tick(deltaTime); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        if (visible && this.minimized.isVisible()) this.minimized.restore(true);
        this.element.hidden = !visible;
        this.minimized.hide();
        if (!visible) this.table.hide();
    }
    public show(detail: PartyMatchDetail_T) {
        this.detail = detail;
        this.paintHeader();
        this.setVisible(true);
        this.layer.activate(this.element);
    }
    public setMode(mode: number) {
        this.mode = mode;
        this.ownerButtons.forEach(button => button.setEnabled(mode === 1));
    }
    public setMembers(mode: number, members: PartyRoomMember_T[], isReset = true) {
        const manager = this.layer.getManager();

        this.setMode(mode);
        this.table.setRows(members.slice(0, 20).map(member => {
            const level = member.level < 10 ? "1 ~ 9" : member.level >= 70 ? "70 ~ 78" : `${Math.trunc(member.level / 10) * 10} ~ ${Math.trunc(member.level / 10) * 10 + 9}`;

            return { id: member.objectId, classId: member.classId, cells: [member.name, String(member.classId), level, this.getLocation(member.location), manager.getSysString(SysString_T.PartyCandidate + member.role)] };
        }), isReset);
        this.paintHeader();
    }
    public clearChat() {
        this.chat.content.replaceChildren();
        this.chat.setContentHeight(0);
        this.chat.setScroll(0);
    }
    public appendChat(text: string, color = 0xffdcdcdc) {
        if (!text) return;

        const canvas = this.layer.getManager().canvas;

        canvas.wrapText(text, 564, 552).forEach((line, index) => {
            const row = this.layer.createWindow(0, 0, 571, 17, this.chat.content);

            this.layer.text(row, line, color, FontType_T.SMALL, index ? 14 : 2, 9 - Math.trunc(canvas.getLineHeight(FontType_T.SMALL) / 2));
            if (this.chat.content.children.length > 40) this.chat.content.firstElementChild.remove();
        });
        Array.from(this.chat.content.children).forEach((row, index) => this.layer.place(row as HTMLElement, 0, index * 17));
        this.chat.setContentHeight(this.chat.content.children.length * 17);
        this.chat.setScroll(Math.max(0, this.chat.content.children.length - 4) * 17);
        this.minimized.setActivity();
    }
    public terminate() { // CPartyRoomWnd 0x100b1b40..0x100b1c00.
        if (this.mode !== 0 && this.mode !== 1 && this.mode !== 2) return;

        if (this.onTerminate) this.onTerminate(this.mode);
    }
    protected close() {
        this.terminate();
        this.setVisible(false);
    }
    protected getLocation(location: number) {
        return location >= 1 && location <= 13 ? this.layer.getManager().getSysString(SysString_T.NearMe + location) : location === 14 ? this.layer.getManager().getSysString(SysString_T.Rune) : location === 15 ? this.layer.getManager().getSysString(SysString_T.Goddard) : "";
    }
    protected paintHeader() {
        this.header.replaceChildren();
        if (!this.detail) return;

        const layer = this.layer, manager = layer.getManager(), detail = this.detail;
        const fields: [number, number, number, number, string][] = [[SysString_T.Number, 59, 68, 41, String(detail.roomId)], [SysString_T.RoomTitle, 59, 68, 56, detail.title], [SysString_T.Location, 59, 68, 71, this.getLocation(detail.location)], [SysString_T.PartySize, 254, 263, 71, `${this.table.getRows().length}/${detail.maxMembers}`], [SysString_T.LootDist, 59, 68, 86, manager.getSysString([SysString_T.FindersKeepers, SysString_T.Random, SysString_T.RandomIncludingSpoil, SysString_T.ByTurn, SysString_T.ByTurnIncludingSpoil][detail.lootType])], [SysString_T.LevelLimit, 254, 263, 86, `${detail.minLevel}-${detail.maxLevel}`]];

        fields.forEach(([id, right, x, y, value]) => {
            const label = manager.getSysString(id);

            layer.text(this.header, label, 0xffdcdcdc, FontType_T.SMALL, right - layer.measureText(label), y - 20);
            layer.text(this.header, value, 0xffb09b79, FontType_T.SMALL, x, y - 20);
        });
    }
}

export default NCPartyRoomWnd;
