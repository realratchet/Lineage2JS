import { Say2_T } from "../network/game-packets";
import NCChatListBox from "./nc-chat-list-box";
import type NDomLayer from "./ndom";
import type { NDomButton_T, NDomEdit_T } from "./ndom";
import { DEFAULT_CHAT_FILTERS, type ChatFilter_T } from "./nc-chat-filter-wnd";

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
const LABEL_COLOR = 0xffe6dcbe;
const WIDTH = 348;
const WINDOW_NAME = "ChatWnd";

const TABS: [number, number, string][] = [[144, Say2_T.ALL, ""], [355, Say2_T.TRADE, "+"], [188, Say2_T.PARTY, "#"], [128, Say2_T.CLAN, "@"], [559, Say2_T.ALLIANCE, "$"]]; // 0x1005b245..0x1005b2f1 tab sysstring labels; send type per tab from jump table 0x1005a338.

const CHAT_FILTER_TYPES: { [type: number]: keyof ChatFilter_T } = { [Say2_T.ALL]: "normal", [Say2_T.SHOUT]: "shout", [Say2_T.TELL]: "tell", [Say2_T.PARTY]: "party", [Say2_T.CLAN]: "pledge", [Say2_T.TRADE]: "market", [Say2_T.ALLIANCE]: "ally", [Say2_T.HERO_VOICE]: "hero" };

const CHAT_COLORS: { [type: number]: [number, number] } = { [Say2_T.SHOUT]: [0xffff7200, Say2_T.SHOUT], [Say2_T.TELL]: [0xffff00ff, Say2_T.TELL], [Say2_T.PARTY]: [0xff00ff00, Say2_T.PARTY], [Say2_T.CLAN]: [0xff7d77ff, Say2_T.CLAN], [Say2_T.PETITION_PLAYER]: [0xff80ffff, Say2_T.PETITION_PLAYER], [Say2_T.PETITION_GM]: [0xff80ffff, Say2_T.PETITION_GM], [Say2_T.TRADE]: [0xffeaa5f5, Say2_T.TRADE], [Say2_T.ALLIANCE]: [0xff77ff99, Say2_T.ALLIANCE], [Say2_T.ANNOUNCEMENT]: [0xff80ffff, Say2_T.ANNOUNCEMENT], 11: [0xffff7200, Say2_T.SHOUT], [Say2_T.PARTYROOM_ALL]: [0xffdcdcdc, Say2_T.PARTYROOM_ALL], [Say2_T.PARTYROOM_COMMANDER]: [0xffffe87b, Say2_T.PARTYROOM_COMMANDER], [Say2_T.CHANNEL_ALL]: [0xff7b7df2, Say2_T.CHANNEL_ALL], [Say2_T.HERO_VOICE]: [0xff408cff, Say2_T.HERO_VOICE], [Say2_T.CRITICAL_ANNOUNCE]: [0xff00ffff, Say2_T.CRITICAL_ANNOUNCE] }; // NConsoleWnd 0x1007d200: [color, routed type]; anything missing takes the default branch 0x1007d352 (0xffdcdcdc, type 0).

const CHAT_PREFIXES = new Map<string, number>([["~", Say2_T.ALL], ["～", Say2_T.ALL], ["!", Say2_T.SHOUT], ["！", Say2_T.SHOUT], ["\"", Say2_T.TELL], ["”", Say2_T.TELL], ["#", Say2_T.PARTY], ["＃", Say2_T.PARTY], ["@", Say2_T.CLAN], ["＠", Say2_T.CLAN], ["&", Say2_T.PETITION_PLAYER], ["＆", Say2_T.PETITION_PLAYER], ["*", Say2_T.PETITION_GM], ["＊", Say2_T.PETITION_GM], ["+", Say2_T.TRADE], ["＋", Say2_T.TRADE], ["$", Say2_T.ALLIANCE], ["＄", Say2_T.ALLIANCE], ["%", Say2_T.HERO_VOICE], ["％", Say2_T.HERO_VOICE]]); // Prefix table 0x1023dbb8 (ASCII, fullwidth per type).

export class NCChatWnd { // NCChatWnd (vtable 0x101acbc8): NCConsole 0x10062948 SetWindow(0, H - 187, 348, 187), bottom anchored.
    public static getTextures(): string[] { return [TEX_BACK1, TEX_BACK2, TEX_BACK3, TEX_BACK4, TEX_SIZECONTROL, TEX_IME_EN, TEX_TAB1, TEX_TAB2, TEX_OPTION1, TEX_OPTION2, `?${TEX_OPTION1}_over`, TEX_MSN1, TEX_MSN2, `?${TEX_MSN1}_over`, ...NCChatListBox.getTextures()]; }

    public readonly element: HTMLDivElement;
    protected readonly lists: NCChatListBox[] = [];
    protected readonly systemPane: NCChatListBox;
    protected oldChatting = true;
    protected systemMsgWndDamage = true;
    protected systemMsgWndExpendableItem = true;
    protected readonly rows: HTMLDivElement;
    protected readonly back4: HTMLDivElement;
    protected readonly back1: HTMLDivElement;
    protected readonly imeMode: HTMLDivElement;
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly optionButton: NDomButton_T;
    protected readonly messengerButton: NDomButton_T;
    protected readonly editBox: NDomEdit_T;
    protected selected = 0;
    protected height = MIN_HEIGHT;
    protected resizeDelta = 0;
    protected filters: ChatFilter_T[];

    public onSend: (text: string, type: number, target: string) => void = null;
    public onBuildCommand: (command: string) => void = null;
    public onCommand: (command: string, isShift: boolean) => void = null;
    public onOptions: (index: number) => void = null;

    public constructor(protected readonly layer: NDomLayer) {
        const W = WIDTH, H = MIN_HEIGHT, manager = layer.getManager();
        const saved = localStorage.getItem("chatFilters");

        this.filters = saved === null ? DEFAULT_CHAT_FILTERS.map(filter => ({ ...filter })) : JSON.parse(saved);
        if (!Array.isArray(this.filters) || this.filters.length !== TABS.length || this.filters.some(filter => !filter || Object.keys(DEFAULT_CHAT_FILTERS[0]).some(key => typeof filter[key] !== "boolean"))) throw new Error(`Invalid chat filters.`);

        this.element = layer.createWindow(0, 0, W, H);
        this.element.hidden = true;
        this.element.classList.add("ndom-opaque");
        layer.tile(this.element, 0, 0, 348, 18, 0, 0, 348, 18, TEX_BACK2); // OnPaint 0x100544a0: 1:1 stacked tiles, Back3 rows = int((H - 82) / 15).
        layer.tile(this.element, 0, -3, 24, 10, 0, 0, 24, 10, TEX_SIZECONTROL);
        this.rows = layer.createWindow(0, 18, W, 0, this.element);
        this.back4 = layer.tile(this.element, 0, 0, 348, 18, 0, 0, 348, 18, TEX_BACK4);
        this.back1 = layer.tile(this.element, 0, 0, 348, 46, 0, 0, 348, 46, TEX_BACK1);
        this.imeMode = layer.tile(this.element, 24, 0, 15, 15, 0, 0, 15, 15, TEX_IME_EN); // IME mode 0x10064b10 has no browser equivalent; drawn as mode 1 (IMEen).

        for (let i = 0; i < TABS.length; i++) {
            const list = new NCChatListBox(layer, this.element, 0, 0, W - 10, H - 46);

            list.setVisible(i === 0);
            this.lists.push(list);
        }

        this.systemPane = new NCChatListBox(layer, this.element, 0, -130, W, 125, true); // 0x1005b165 hidden at create; ShowWindow 0x10053c2a keeps it hidden unless GL2SystemMsgWnd.
        this.systemPane.setVisible(false);

        TABS.forEach(([labelId], index) => { // NCTabButton (uclass 0x102b5350): paint 0x10002410 -> 0x10001000, state 0 selected [+0x200], 1 unselected [+0x204]; AddTab 0x1002ded0 lays them left to right.
            const texture = index === 0 ? TEX_TAB2 : TEX_TAB1, label = manager.getSysString(labelId);
            const tab = layer.button(this.element, 23 + index * 64, 0, 64, 23, texture, texture, texture, null, () => this.select(index));

            layer.text(tab, label, LABEL_COLOR, undefined, Math.trunc(64 * 0.5 + 2 - Math.trunc(layer.measureText(label) / 2)), Math.trunc(23 * 0.5 + 1 - Math.trunc(manager.canvas.getLineHeight() / 2)));
            this.tabs.push(tab);
        });

        this.optionButton = layer.button(this.element, 5, 0, 15, 15, TEX_OPTION1, TEX_OPTION2, null, null, () => { if (this.onOptions) this.onOptions(this.selected); });
        this.messengerButton = layer.button(this.element, 5, 0, 15, 15, TEX_MSN1, TEX_MSN2);
        this.editBox = layer.edit(this.element, 39, 0, 303, 16);
        this.editBox.input.addEventListener("keydown", event => {
            if (event.key === "Enter") this.submit(this.editBox.getValue(), event.shiftKey);
            if (event.key === "Escape") this.editBox.input.blur();
        });
        this.createResizeFrame();
        this.element.addEventListener("wheel", event => {
            if (!this.systemPane.element.contains(event.target as Node) && !this.lists.some(list => list.element.contains(event.target as Node))) this.lists[this.selected].onWheel(Math.sign(event.deltaY));
        });
        this.layout();
    }

    protected createResizeFrame() { // NCResizeFrame 0xf007 (0x1005aab6): drag feeds OnResizeWnd; dragging up grows the window.
        const manager = this.layer.getManager(), frame = this.layer.createWindow(0, 0, 24, 10, this.element);
        let isSizing = false;

        frame.addEventListener("mouseenter", () => manager.setCursor(manager.getCursor(5)));
        frame.addEventListener("mouseleave", () => { if (!isSizing) manager.setCursor(""); });
        frame.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            isSizing = true;

            let lastY = this.layer.toUI(event.clientY);

            this.layer.beginDrag(move => {
                const y = this.layer.toUI(move.clientY);

                this.onResizeWnd(lastY - y);
                lastY = y;
            }, () => {
                isSizing = false;
                if (!frame.matches(":hover")) manager.setCursor("");
            });
        });
    }

    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }

    public placeOnScreen(_screenWidth: number, screenHeight: number) {
        const owner = this.layer.getManager().getWindowOwner();
        const saved = owner === null ? null : localStorage.getItem(`wnd:${owner}:${WINDOW_NAME}:height`);
        const height = saved === null ? MIN_HEIGHT : JSON.parse(saved);

        if (!Number.isInteger(height) || height < MIN_HEIGHT || height > MAX_HEIGHT || (height - MIN_HEIGHT) % RESIZE_STEP !== 0) throw new Error(`Invalid chat height.`);

        this.resizeDelta = 0;
        this.onResizeWnd(height - this.height, false);
        this.layer.place(this.element, 0, screenHeight - this.height);
    }

    public resetLayout() {
        this.resizeDelta = 0;
        this.onResizeWnd(MIN_HEIGHT - this.height);
    }

    public setOldChatting(isEnabled: boolean) { this.oldChatting = isEnabled; }
    public getFilter(index: number) { return this.filters[index]; }
    public setFilter(index: number, filter: ChatFilter_T) {
        this.filters[index] = { ...filter };
        localStorage.setItem("chatFilters", JSON.stringify(this.filters));
    }

    public setSystemMessageFilters(damage: boolean, expendableItem: boolean) { this.systemMsgWndDamage = damage; this.systemMsgWndExpendableItem = expendableItem; }

    public setSystemMsgWnd(isVisible: boolean) { this.systemPane.setVisible(isVisible); }

    public focusInput() { this.editBox.focus(); }
    public isInputFocused() { return document.activeElement === this.editBox.input; }

    public addCreatureSay(name: string, text: string, type: number) { // NConsoleWnd 0x1007d200 -> NCConsole 0x1005d580 "%s: %s" (0x101ad5e8).
        const [color, routed] = CHAT_COLORS[type] || [DEFAULT_COLOR, Say2_T.ALL];

        if (routed === Say2_T.PETITION_PLAYER || routed === Say2_T.PETITION_GM || routed === Say2_T.PARTYROOM_ALL || routed === Say2_T.PARTYROOM_COMMANDER || routed === Say2_T.CHANNEL_ALL) return; // 0x1005d5e9..0x1005d622: 6/7 go to the petition window, 14 to the party room, 15/16 to [+0x264].

        const sender = routed === Say2_T.ANNOUNCEMENT ? this.layer.getManager().getSysString(328) : name;

        this.addChat(routed === Say2_T.CRITICAL_ANNOUNCE ? text : `${sender}: ${text}`, color, routed);
    }

    public addSystemMessage(text: string, color: number, group: number = 0) { this.addChat(text, color, Say2_T.GM, group); } // NWindow 0x10081af2 -> 0x1005c2b0 forwards record+0x10.

    protected addChat(text: string, color: number, type: number, group: number = 0) { // AddChat 0x10052f40, case table 0x10053920 / 0x100538f4; 11..16 and > 18 are dropped.
        switch (type) {
            case Say2_T.PETITION_PLAYER: case Say2_T.PETITION_GM: case Say2_T.ANNOUNCEMENT: case Say2_T.CRITICAL_ANNOUNCE:
                for (const list of this.lists) list.addString(text, color);
                break;
            case Say2_T.GM:
                for (let i = 0; i < this.lists.length; i++)
                    if (group === 2 || this.filters[i].system && (group !== 3 || this.filters[i].damage) && (group !== 7 || this.filters[i].useitems)) this.lists[i].addString(text, color);

                if (group !== 3 && group !== 7 || group === 3 && this.systemMsgWndDamage || group === 7 && this.systemMsgWndExpendableItem)
                    this.systemPane.addString(text, color);
                break;
            case Say2_T.ALL: case Say2_T.SHOUT: case Say2_T.TELL: case Say2_T.PARTY: case Say2_T.CLAN: case Say2_T.TRADE: case Say2_T.ALLIANCE: case Say2_T.HERO_VOICE:
                for (let i = 0; i < this.lists.length; i++)
                    if (this.filters[i].chat && this.filters[i][CHAT_FILTER_TYPES[type]]) this.lists[i].addString(text, color);
                break;
        }
    }

    protected select(index: number) { // 0x10001a50: the first tab starts selected; selecting the current one does nothing.
        if (index === this.selected) return;

        this.selected = index;
        this.tabs.forEach((tab, i) => {
            const texture = i === index ? TEX_TAB2 : TEX_TAB1;

            tab.setTextures(texture, texture, texture);
        });

        if (this.oldChatting) {
            const text = this.editBox.getValue();

            this.editBox.setValue(TABS[index][2] + (["+", "＋", "#", "＃", "@", "＠", "$", "＄"].includes(text.charAt(0)) ? text.slice(1) : text));
        }

        for (let i = 0; i < this.lists.length; i++)
            this.lists[i].setVisible(i === index);
    }

    protected submit(line: string, isShift: boolean = false) { // Enter handler 0x10059a3a..0x10059f66; U+FF02 is a tell prefix (0x10059aff) outside the strip list.
        this.editBox.setValue("");

        this.sendText(line, isShift);
        if (line && this.oldChatting) this.editBox.setValue(TABS[this.selected][2]);
    }

    public dispatchCommand(line: string, isShift: boolean = false) {
        if (line.startsWith("//")) {
            const command = line.slice(2).trim();

            if (command && this.onBuildCommand) this.onBuildCommand(command);

            return true;
        }
        if (line.startsWith("/") || line.startsWith("／")) {
            if (this.onCommand) this.onCommand(line, isShift);
            return true;
        }

        return false;
    }

    public sendText(line: string, isShift: boolean = false) {
        if (this.dispatchCommand(line, isShift)) return;

        const first = line.charAt(0);
        const hasPrefix = CHAT_PREFIXES.has(first);
        const type = first === "＂" ? Say2_T.TELL : hasPrefix ? CHAT_PREFIXES.get(first) : this.oldChatting ? Say2_T.ALL : TABS[this.selected][1];

        if (type === Say2_T.TELL) return this.sendTell(line);

        const text = hasPrefix ? line.slice(1) : line;

        if (text && this.onSend) this.onSend(text, type, "");
    }

    protected sendTell(line: string) { // 0x10059bff..0x10059da2: target runs to ' ' or U+3000; no target sends the whole line untargeted.
        const rest = line.slice(1);
        let length = 0;

        while (length < rest.length && rest[length] !== " " && rest[length] !== "　") length++;

        if (!this.onSend) return;

        if (length === 0) return this.onSend(line, Say2_T.TELL, "");
        if (rest.length <= length + 1) return;

        this.onSend(rest.slice(length + 1), Say2_T.TELL, rest.slice(0, length));
    }

    public onResizeWnd(delta: number, save = true) { // OnResizeWnd 0x10054d50: 15 px steps, 187 <= H <= 502, grows upward; the delta resets either way.
        this.resizeDelta += delta;

        if (this.resizeDelta < RESIZE_STEP && this.resizeDelta > -RESIZE_STEP) return;

        const step = Math.trunc(this.resizeDelta / RESIZE_STEP) * RESIZE_STEP;
        const height = this.height + step;

        this.resizeDelta = 0;

        if (height < MIN_HEIGHT || height > MAX_HEIGHT) return;

        this.height = height;
        this.layer.place(this.element, parseFloat(this.element.style.left), parseFloat(this.element.style.top) - step, WIDTH, height);
        this.layout();

        const owner = this.layer.getManager().getWindowOwner();

        if (save && owner !== null) {
            localStorage.setItem(`wnd:${owner}:${WINDOW_NAME}:height`, JSON.stringify(this.height));
            this.layer.saveWindowPosition(this.element);
        }
    }

    protected layout() {
        const layer = this.layer, H = this.height;

        this.rows.replaceChildren();

        for (let i = 0, rows = Math.trunc((H - 82) / 15); i < rows; i++)
            layer.tile(this.rows, 0, 15 * i, 348, 15, 0, 0, 348, 15, TEX_BACK3);

        layer.place(this.back4, 0, H - 64);
        layer.place(this.back1, 0, H - 46);
        layer.place(this.imeMode, 24, H - 20);
        layer.place(this.editBox, 39, H - 22);
        layer.place(this.optionButton, 5, H - 20);
        layer.place(this.messengerButton, 5, H - 39);
        this.tabs.forEach((tab, index) => layer.place(tab, 23 + index * 64, H - 46));

        for (const list of this.lists) list.resize(WIDTH - 10, H - 46);
    }
}

export default NCChatWnd;
