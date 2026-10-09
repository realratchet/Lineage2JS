import NCListCtrl from "./nc-list-ctrl";
import NDomLayer, { NDOM_EDIT_TEXTURES, NDOM_SCROLL_TEXTURES } from "./ndom";
import type { NDomButton_T, NDomEdit_T, NDomScrollPane_T } from "./ndom";
import type { TooltipInfo_T } from "./nc-tooltip";
import { FontType_T } from "./nwindow-canvas";
import { Say2_T, type CommandChannelInfo_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.PartyCommandWnd.Herochat_back";
const TEX_TAB = "L2UI_CH3.PartyCommandWnd.herochat_tab2";
const TEX_TAB_SELECTED = "L2UI_CH3.PartyCommandWnd.herochat_tab1";
const TEX_TOGGLE = "L2UI_CH3.PartyCommandWnd.Herochat_btn1";
const TEX_TOGGLE_SELECTED = "L2UI_CH3.PartyCommandWnd.Herochat_btn2";
const TEX_BUTTON = "L2UI_CH3.Button.smallbutton2";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.smallbutton2_down";
const TEX_FRAME = "L2UI_CH3.FrameCtrl.smallbar";

type CommandChatLine_T = { text: string, color: number, indent: number };

export class NCCommandInfoWnd {
    public static getTextures() { return [TEX_BACK, TEX_TAB, TEX_TAB_SELECTED, "?" + TEX_TAB + "_over", TEX_TOGGLE, TEX_TOGGLE_SELECTED, TEX_BUTTON, TEX_BUTTON_DOWN, ...[1, 2, 3].map(index => TEX_FRAME + index), ...NCListCtrl.getTextures(), ...NDOM_EDIT_TEXTURES, ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public readonly table: NCListCtrl;
    public readonly input: NDomEdit_T;
    public readonly chat: NDomScrollPane_T;
    public readonly toggle: NDomButton_T;
    public onUpdate: () => void = null;
    public onLeave: () => void = null;
    public onOust: (name: string) => void = null;
    public onSay: (text: string, type: Say2_T) => void = null;
    protected readonly channelView: HTMLDivElement;
    protected readonly chatView: HTMLDivElement;
    protected readonly header: HTMLDivElement;
    protected readonly updateButton: NDomButton_T;
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly lines: CommandChatLine_T[] = [];
    protected readonly toggleTooltip: TooltipInfo_T = { title: "", lines: [], description: "" };
    protected info: CommandChannelInfo_T = { leaderName: "", memberCount: 0, parties: [] };
    protected selectedTab = 0;
    protected isAllMembers = false;
    protected isInChannel = false;
    protected isReady = true;
    protected elapsed = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(200, 200, 348, 187);
        this.element.hidden = true;
        this.element.setAttribute("role", "dialog");
        this.element.setAttribute("aria-label", manager.getSysString(491));
        layer.tile(this.element, 12, 0, 336, 187, 0, 0, 336, 187, TEX_BACK);
        const frame = layer.createWindow(0, 0, 12, 187, this.element);

        layer.tile(frame, 0, 0, 12, 8, 0, 0, 12, 8, TEX_FRAME + "1");
        layer.tile(frame, 0, 8, 12, 171, 0, 0, 12, 8, TEX_FRAME + "2");
        layer.tile(frame, 0, 179, 12, 8, 0, 0, 12, 8, TEX_FRAME + "3");
        frame.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            layer.dragWindow(this.element, event);
        });
        this.chatView = layer.createWindow(12, 0, 336, 140, this.element);
        this.channelView = layer.createWindow(12, 0, 336, 140, this.element);
        this.channelView.hidden = true;
        this.header = layer.createWindow(0, 0, 336, 62, this.channelView);
        this.header.style.pointerEvents = "none";
        this.table = new NCListCtrl(layer, this.channelView, 24, 25, 207, 101, [{ width: 160, label: 408, numeric: false }, { width: 47, label: 1036, numeric: true }], 17, 5);
        this.updateButton = layer.button(this.channelView, 244, 62, 65, 20, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(938), () => this.update());
        layer.button(this.channelView, 244, 86, 65, 20, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(681), () => {
            const row = this.table.getSelectedRow();

            if (row && this.onOust) this.onOust(row.cells[0]);
        });
        layer.button(this.channelView, 244, 110, 65, 20, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(1268), () => { if (this.onLeave) this.onLeave(); });
        this.chat = layer.scrollPane(this.chatView, 6, 5, 327, 134, 15, false, 8);
        this.chat.content.setAttribute("role", "log");
        const setScroll = this.chat.setScroll;

        this.chat.setScroll = (position, isClamped = true) => {
            setScroll(position, isClamped);
            this.chat.content.style.top = "0px";
            this.paintChat();
        };
        this.input = layer.edit(this.element, 35, 165, 308, 17, false, 0xa28);
        this.input.input.addEventListener("keydown", event => {
            if (event.key !== "Enter" || event.isComposing) return;

            event.preventDefault();
            this.submit();
        });
        this.toggle = layer.button(this.element, 18, 166, 15, 15, TEX_TOGGLE, TEX_TOGGLE, TEX_TOGGLE, null, null, isDown => {
            if (!isDown) return;

            this.isAllMembers = !this.isAllMembers;
            this.paintToggle();
        });
        this.toggle.setAttribute("role", "checkbox");
        layer.tooltip(this.element, this.toggle, this.toggleTooltip);
        [444, 491].forEach((id, index) => {
            const texture = index === 0 ? TEX_TAB_SELECTED : TEX_TAB;
            const tab = layer.tab(this.element, 24 + index * 64, 141, 64, 23, texture, TEX_TAB_SELECTED, manager.getSysString(id), "", () => this.selectTab(index));

            this.tabs.push(tab);
        });
        this.paintHeader();
        this.paintToggle();
    }

    public placeOnScreen(width: number, height: number) {}
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (!visible) this.input.input.blur();
    }
    public getInfo() { return this.info; }
    public getChatLines() { return this.lines; }
    public getSelectedTab() { return this.selectedTab; }
    public getIsInChannel() { return this.isInChannel; }
    public getIsReady() { return this.isReady; }
    public open() { this.setVisible(true); this.isInChannel = true; }
    public closeChannel() {
        this.setVisible(false);
        this.input.setValue("");
        this.lines.length = 0;
        this.chat.setContentHeight(0);
        this.chat.setScroll(0);
        this.isInChannel = false;
    }
    public setInfo(info: CommandChannelInfo_T) {
        this.info = info;
        this.table.setRows(info.parties.slice(0, 1000).map((party, index) => ({ id: index, cells: [party.leaderName, String(party.memberCount)] })), true);
        this.isReady = true;
        this.updateButton.setEnabled(true);
        this.paintHeader();
    }
    public addChat(name: string, text: string, type: Say2_T) {
        const color = type === Say2_T.PARTYROOM_COMMANDER ? 0xffffe87b : 0xff7b7df2;

        this.setVisible(true);
        this.appendChat(`${name}: ${text}`, color);
    }
    public tick(deltaTime: number) {
        this.elapsed += deltaTime;
        if (this.elapsed < 3000) return;

        this.elapsed %= 3000;
        this.isReady = true;
        this.updateButton.setEnabled(true);
    }
    public update() {
        if (!this.isReady) return;

        if (this.onUpdate) this.onUpdate();
        this.isReady = false;
        this.updateButton.setEnabled(false);
    }
    public selectTab(index: number) {
        if (index === 1) this.update();
        this.selectedTab = index;
        this.channelView.hidden = index !== 1;
        this.chatView.hidden = index !== 0;
        this.tabs.forEach((tab, tabIndex) => tab.setTextures(tabIndex === index ? TEX_TAB_SELECTED : TEX_TAB, TEX_TAB_SELECTED));
        if (index === 1) this.update();
    }
    public submit() {
        const text = this.input.getValue();

        if (text.length >= 255) this.appendChat(this.layer.getManager().getSystemMessage(971), 0xffdcdcdc);
        else if (this.onSay) this.onSay(text, this.isAllMembers ? Say2_T.PARTYROOM_COMMANDER : Say2_T.CHANNEL_ALL);
        this.input.setValue("");
    }
    protected appendChat(text: string, color: number) {
        if (!text) return;

        this.layer.getManager().canvas.wrapText(text, 305, 293).forEach((line, index) => {
            this.lines.push({ text: line, color, indent: index ? 12 : 0 });
            if (this.lines.length > 200) this.lines.shift();
        });
        this.chat.setContentHeight(this.lines.length * 15);
        this.chat.setScroll(Math.max(0, this.lines.length - 8) * 15);
    }
    protected paintChat() {
        this.chat.content.replaceChildren();
        const first = Math.trunc(this.chat.getScroll() / 15), canvas = this.layer.getManager().canvas;

        this.lines.slice(first, first + 8).forEach((line, index) => this.layer.text(this.chat.content, line.text, line.color, FontType_T.SMALL, 2 + line.indent, 9 - Math.trunc(canvas.getLineHeight() / 2) + index * 17));
    }
    protected paintToggle() {
        const texture = this.isAllMembers ? TEX_TOGGLE_SELECTED : TEX_TOGGLE;

        this.toggle.setTextures(texture, texture, texture);
        this.toggleTooltip.title = this.layer.getManager().getSysString(this.isAllMembers ? 1227 : 1228);
        this.toggle.setAttribute("aria-label", this.toggleTooltip.title);
        this.toggle.setAttribute("aria-checked", String(this.isAllMembers));
    }
    protected paintHeader() {
        this.header.replaceChildren();
        const layer = this.layer, manager = layer.getManager(), leader = manager.getSysString(1265);

        layer.text(this.header, leader, 0xffdcdcdc, FontType_T.SMALL, 22, 9);
        layer.text(this.header, this.info.leaderName, 0xffb09b79, FontType_T.SMALL, 27 + layer.measureText(leader), 9);
        [[1266, 29, this.info.partyCount ?? this.info.parties.length], [1267, 44, this.info.memberCount]].forEach(([id, y, value]) => {
            const label = manager.getSysString(id);

            layer.text(this.header, label, 0xffdcdcdc, FontType_T.SMALL, 243, y);
            layer.text(this.header, value.toLocaleString("en-US"), 0xffb09b79, FontType_T.SMALL, 248 + layer.measureText(label), y);
        });
    }
}

export default NCCommandInfoWnd;
