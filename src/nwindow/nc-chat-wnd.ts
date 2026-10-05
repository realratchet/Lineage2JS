import NWnd from "./nwnd";
import NCButton from "./nc-button";
import NCEditBox from "./nc-edit-box";
import NCTabControl from "./nc-tab-control";
import NCChatListBox, { NCChatSystemMsgWnd } from "./nc-chat-list-box";
import type NWindowCanvas from "./nwindow-canvas";
import type { NMouseEvent_T } from "./nwnd";

const TEX_BACK1 = "L2UI_CH3.ChatWnd.Chatting_Back1";
const TEX_BACK2 = "L2UI_CH3.ChatWnd.Chatting_Back2";
const TEX_BACK3 = "L2UI_CH3.ChatWnd.Chatting_Back3";
const TEX_BACK4 = "L2UI_CH3.ChatWnd.Chatting_Back4";
const TEX_SIZECONTROL = "L2UI_CH3.ChatWnd.Chatting_sizeControl";
const TEX_IME_EN = "L2UI_CH3.ChatWnd.Chatting_IMEen";
const TEX_TAB1 = "L2UI_CH3.ChatWnd.Chatting_Tab1";
const TEX_TAB2 = "L2UI_CH3.ChatWnd.Chatting_Tab2";
const TEX_OPTION1 = "L2UI_CH3.ChatWnd.Chatting_Option1";
const TEX_OPTION2 = "L2UI_CH3.ChatWnd.Chatting_Option2";
const TEX_MSN1 = "L2UI_CH3.Msn.chatting_msn5"; // NCChatWnd OnPaint re-skins the button from messenger status; an empty status (no messenger login) is msn5.
const TEX_MSN2 = "L2UI_CH3.Msn.chatting_msn5_down";
const MIN_HEIGHT = 187;
const MAX_HEIGHT = 502;
const RESIZE_STEP = 15;
const DEFAULT_COLOR = 0xffdcdcdc;

type ChatListFilter_T = { types: number[], hasSystem: boolean };

const TABS: [number, number][] = [[144, 0], [355, 8], [188, 3], [128, 4], [559, 9]]; // 0x1005b245..0x1005b2f1 tab sysstring labels; send type per tab from jump table 0x1005a338.

const DEFAULT_LIST_FILTERS: ChatListFilter_T[] = [ // Per-list enable flags +0x250..+0x270 and system flag +0x244 are not decoded; these are the defaults per tab.
    { types: [0, 1, 2, 3, 4, 8, 9, 17], hasSystem: true },
    { types: [8], hasSystem: false },
    { types: [3], hasSystem: false },
    { types: [4], hasSystem: false },
    { types: [9], hasSystem: false }
];

const CHAT_COLORS: { [type: number]: [number, number] } = { 1: [0xffff7200, 1], 2: [0xffff00ff, 2], 3: [0xff00ff00, 3], 4: [0xff7d77ff, 4], 6: [0xff80ffff, 6], 7: [0xff80ffff, 7], 8: [0xffeaa5f5, 8], 9: [0xff77ff99, 9], 10: [0xff80ffff, 10], 11: [0xffff7200, 1], 14: [0xffdcdcdc, 14], 15: [0xffffe87b, 15], 16: [0xff7b7df2, 16], 17: [0xff408cff, 17], 18: [0xff00ffff, 18] }; // NConsoleWnd 0x1007d200: [color, routed type]; anything missing takes the default branch 0x1007d352 (0xffdcdcdc, type 0).

const CHAT_PREFIXES = new Map<string, number>([["~", 0], ["～", 0], ["!", 1], ["！", 1], ["\"", 2], ["”", 2], ["#", 3], ["＃", 3], ["@", 4], ["＠", 4], ["&", 6], ["＆", 6], ["*", 7], ["＊", 7], ["+", 8], ["＋", 8], ["$", 9], ["＄", 9], ["%", 17], ["％", 17]]); // Prefix table 0x1023dbb8 (ASCII, fullwidth per type).

class NCResizeFrame extends NWnd { // NCResizeFrame 0xf007 (0x1005aab6): drag feeds OnResizeWnd; dragging up grows the window.
    protected readonly owner: NCChatWnd;

    public constructor(owner: NCChatWnd, x: number, y: number, width: number, height: number) {
        super(x, y, width, height);

        this.owner = owner;
    }

    public onMouseDown(event: NMouseEvent_T) {
        if (event.button !== 0) return;

        let lastY = this.getScreenY() + event.y;

        const onMove = (move: MouseEvent) => {
            if (!(move.buttons & 1)) { onUp(); return; }

            const y = this.manager.canvas.toUI(move.clientY);

            this.owner.onResizeWnd(lastY - y);
            lastY = y;
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove, true);
            window.removeEventListener("mouseup", onUp, true);
            window.removeEventListener("blur", onUp);
        };

        window.addEventListener("mousemove", onMove, true);
        window.addEventListener("mouseup", onUp, true);
        window.addEventListener("blur", onUp);
    }
}

export class NCChatWnd extends NWnd { // NCChatWnd (vtable 0x101acbc8): NCConsole 0x10062948 SetWindow(0, H - 187, 348, 187), bottom anchored.
    protected readonly lists: NCChatListBox[] = [];
    protected readonly systemPane: NCChatSystemMsgWnd;
    protected readonly tabControl: NCTabControl;
    protected readonly optionButton: NCButton;
    protected readonly messengerButton: NCButton;
    protected readonly editBox: NCEditBox;
    protected readonly resizeFrame: NCResizeFrame;
    protected resizeDelta = 0;

    public onSend: (text: string, type: number, target: string) => void = null;
    public onBuildCommand: (command: string) => void = null;

    public constructor() {
        super(0, 0, 348, MIN_HEIGHT);

        const W = this.width, H = this.height;

        for (let i = 0; i < TABS.length; i++) {
            const list = this.addChild(new NCChatListBox(0, 0, W - 10, H - 46));

            list.isVisible = i === 0;
            this.lists.push(list);
        }

        this.systemPane = this.addChild(new NCChatSystemMsgWnd(0, -130, W, 125)); // 0x1005b165 hidden at create; ShowWindow 0x10053c2a keeps it hidden unless GL2SystemMsgWnd.
        this.systemPane.isVisible = false;

        this.tabControl = this.addChild(new NCTabControl(23, H - 46, 320, 23));
        this.tabControl.onSelect = index => this.selectTab(index);

        for (const [labelId] of TABS) this.tabControl.addTab(labelId, 64, 23, TEX_TAB2, TEX_TAB1);

        this.optionButton = this.addChild(new NCButton(5, H - 20, 15, 15, TEX_OPTION1, TEX_OPTION2));
        this.messengerButton = this.addChild(new NCButton(5, H - 39, 15, 15, TEX_MSN1, TEX_MSN2));
        this.editBox = this.addChild(new NCEditBox(39, H - 22, 303, 16));
        this.editBox.onSubmit = text => this.submit(text);
        this.resizeFrame = this.addChild(new NCResizeFrame(this, 0, 0, 24, 10));
    }

    public getTextures(): string[] { return [TEX_BACK1, TEX_BACK2, TEX_BACK3, TEX_BACK4, TEX_SIZECONTROL, TEX_IME_EN]; }

    public placeOnScreen(_screenWidth: number, screenHeight: number) {
        this.x = 0;
        this.y = screenHeight - this.height;
    }

    public setSystemMsgWnd(isVisible: boolean) { this.systemPane.setVisible(isVisible); }

    public hitTest(x: number, y: number): NWnd { // The system pane hangs above the chat's own rect.
        const hit = this.systemPane.hitTest(x - this.systemPane.x, y - this.systemPane.y);

        return hit || super.hitTest(x, y);
    }

    public focusInput() { this.editBox.focus(); }
    public isInputFocused() { return this.editBox.isFocused(); }

    public addCreatureSay(name: string, text: string, type: number) { // NConsoleWnd 0x1007d200 -> NCConsole 0x1005d580 "%s: %s" (0x101ad5e8).
        const [color, routed] = CHAT_COLORS[type] || [DEFAULT_COLOR, 0];

        if (routed === 6 || routed === 7 || routed === 14 || routed === 15 || routed === 16) return; // 0x1005d5e9..0x1005d622: 6/7 go to the petition window, 14 to the party room, 15/16 to [+0x264].

        const sender = routed === 10 ? this.manager.getSysString(328) : name;

        this.addChat(routed === 18 ? text : `${sender}: ${text}`, color, routed);
    }

    public addSystemMessage(text: string, color: number) { this.addChat(text, color, 5); } // 0x1005c250 -> AddChat(text, record+0x14, 5, 0).

    protected addChat(text: string, color: number, type: number) { // AddChat 0x10052f40, case table 0x10053920 / 0x100538f4; 11..16 and > 18 are dropped.
        switch (type) {
            case 6: case 7: case 10: case 18:
                for (const list of this.lists) list.addString(text, color);
                break;
            case 5:
                for (let i = 0; i < this.lists.length; i++)
                    if (DEFAULT_LIST_FILTERS[i].hasSystem) this.lists[i].addString(text, color);

                this.systemPane.addString(text, color);
                break;
            case 0: case 1: case 2: case 3: case 4: case 8: case 9: case 17:
                for (let i = 0; i < this.lists.length; i++)
                    if (DEFAULT_LIST_FILTERS[i].types.includes(type)) this.lists[i].addString(text, color);
                break;
        }
    }

    protected selectTab(index: number) {
        for (let i = 0; i < this.lists.length; i++)
            this.lists[i].setVisible(i === index);
    }

    protected submit(line: string) { // Enter handler 0x10059a3a..0x10059f66; U+FF02 is a tell prefix (0x10059aff) outside the strip list.
        this.editBox.setText("");

        if (line.startsWith("//")) {
            const command = line.slice(2).trim();

            if (command && this.onBuildCommand) this.onBuildCommand(command);

            return;
        }

        const first = line.charAt(0);
        const hasPrefix = CHAT_PREFIXES.has(first);
        const type = first === "＂" ? 2 : hasPrefix ? CHAT_PREFIXES.get(first) : TABS[this.tabControl.selected][1];

        if (type === 2) return this.sendTell(line);

        const text = hasPrefix ? line.slice(1) : line;

        if (text && this.onSend) this.onSend(text, type, "");
    }

    protected sendTell(line: string) { // 0x10059bff..0x10059da2: target runs to ' ' or U+3000; no target sends the whole line untargeted.
        const rest = line.slice(1);
        let length = 0;

        while (length < rest.length && rest[length] !== " " && rest[length] !== "　") length++;

        if (!this.onSend) return;

        if (length === 0) return this.onSend(line, 2, "");
        if (rest.length <= length + 1) return;

        this.onSend(rest.slice(length + 1), 2, rest.slice(0, length));
    }

    public onResizeWnd(delta: number) { // OnResizeWnd 0x10054d50: 15 px steps, 187 <= H <= 502, grows upward; the delta resets either way.
        this.resizeDelta += delta;

        if (this.resizeDelta < RESIZE_STEP && this.resizeDelta > -RESIZE_STEP) return;

        const step = Math.trunc(this.resizeDelta / RESIZE_STEP) * RESIZE_STEP;
        const height = this.height + step;

        this.resizeDelta = 0;

        if (height < MIN_HEIGHT || height > MAX_HEIGHT) return;

        this.y -= step;
        this.height = height;
        this.editBox.y = height - 22;
        this.tabControl.y = height - 46;
        this.optionButton.y = height - 20;
        this.messengerButton.y = height - 39;

        for (const list of this.lists) list.resize(this.width - 10, height - 46);

        this.invalidate();
    }

    public onWheel(delta: number): boolean { return this.lists[this.tabControl.selected].onWheel(delta); }

    public onPaint(canvas: NWindowCanvas) { // OnPaint 0x100544a0: 1:1 stacked tiles, Back3 rows = int((H - 82) / 15).
        const H = this.height;

        canvas.clip(0, -3, this.width, H + 3);
        canvas.drawTile(0, 0, 348, 18, 0, 0, 348, 18, TEX_BACK2);
        canvas.drawTile(0, -3, 24, 10, 0, 0, 24, 10, TEX_SIZECONTROL);

        for (let i = 0, rows = Math.trunc((H - 82) / 15); i < rows; i++)
            canvas.drawTile(0, 18 + 15 * i, 348, 15, 0, 0, 348, 15, TEX_BACK3);

        canvas.drawTile(0, H - 64, 348, 18, 0, 0, 348, 18, TEX_BACK4);
        canvas.drawTile(0, H - 46, 348, 46, 0, 0, 348, 46, TEX_BACK1);
        canvas.drawTile(24, H - 20, 15, 15, 0, 0, 15, 15, TEX_IME_EN); // IME mode 0x10064b10 has no browser equivalent; drawn as mode 1 (IMEen).
        canvas.unclip();
    }
}

export default NCChatWnd;
