import { Say2_T, type Snoop_T } from "../network/game-packets";
import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES, type NDomCheckBox_T, type NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import { SKIN_SLOTS } from "./skin-textures";

const ROW_HEIGHT = 17; // NCListBox::OnPaint 0x10020cf5.
const VISIBLE_ROWS = 11; // The 195px Snoop viewport fits eleven rows.
const TEX_BACK = "L2UI.etcwnd.Petitionback";
const arrChannels = [[Say2_T.TRADE, 362, 15, 240, 0xffeaa5f5], [Say2_T.CLAN, 360, 84, 240, 0xff7d77ff], [Say2_T.PARTY, 361, 153, 240, 0xff00ff00], [Say2_T.SHOUT, 359, 222, 240, 0xffff7200], [Say2_T.TELL, 363, 15, 254, 0xffff00ff], [Say2_T.ALL, 383, 84, 254, 0xffdcdcdc], [Say2_T.ALLIANCE, 592, 153, 254, 0xff77ff99]];
type SnoopLine_T = { text: string, color: number, indent: number };

export class NCGMSnoopWnd {
    public static getTextures() { return [TEX_BACK, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, SKIN_SLOTS.checkBox, SKIN_SLOTS.checkBoxChecked]; }
    public readonly element: HTMLDivElement;
    public onQuit: (objectId: number) => void = null;
    protected readonly caption: HTMLDivElement;
    protected readonly chat: NDomScrollPane_T;
    protected readonly arrFilters: NDomCheckBox_T[];
    protected readonly lines: SnoopLine_T[] = [];
    protected conversationId = -1;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(15, 38, 300, 301);
        this.element.hidden = true;
        this.element.addEventListener("mousedown", () => this.activate());
        layer.tile(this.element, 0, 21, 300, 280, 0, 0, 300, 280, TEX_BACK);
        this.caption = NCFrameCtrl.createDOM(layer, this.element, 300, manager.getSysString(693), false, () => this.setVisible(false));
        this.chat = layer.scrollPane(this.element, 15, 38, 282, 195, ROW_HEIGHT, false, VISIBLE_ROWS);
        this.chat.content.setAttribute("role", "log");
        const setScroll = this.chat.setScroll;

        this.chat.setScroll = (position, isClamped = true) => {
            setScroll(position, isClamped);
            this.chat.content.style.top = "0px";
            this.paintChat();
        };
        this.arrFilters = arrChannels.map(([, id, x, y]) => {
            const control = layer.checkbox(this.element, x, y, 64, 12, manager.getSysString(id), null, true);

            control.tabIndex = 0;
            control.addEventListener("keydown", event => {
                if (event.repeat || event.key !== " " && event.key !== "Enter") return;

                event.preventDefault();
                control.setChecked(!control.getChecked());
            });
            return control;
        });
        layer.button(this.element, 110, 270, 64, 19, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, null, manager.getSysString(141), () => {
            this.setVisible(false);
            if (this.onQuit) this.onQuit(this.conversationId);
            this.reset();
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 15, 38); }
    public getConversationId() { return this.conversationId; }
    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;
        if (!isVisible && this.element.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    }
    public setConversation(objectId: number, name: string) {
        this.conversationId = objectId;
        const title = `${this.layer.getManager().getSysString(693)} - ${name}`;

        this.element.setAttribute("aria-label", title);
        this.layer.renderText(this.caption, title, 0xffc8d2dc);
    }

    public reset() {
        this.conversationId = -1;
        this.lines.length = 0;
        this.chat.setContentHeight(0);
        this.chat.setScroll(0);
    }

    public addChat(snoop: Snoop_T) {
        const index = arrChannels.findIndex(([type]) => type === snoop.type);

        if (index < 0) return;

        if (this.arrFilters[index].getChecked()) {
            const color = arrChannels[index][4];

            this.layer.getManager().canvas.wrapText(`${snoop.speaker}: ${snoop.message}`, 260, 248).forEach((text, index) => {
                this.lines.push({ text, color, indent: index ? 12 : 0 });
                if (this.lines.length > 200) this.lines.shift();
            });
            this.chat.setContentHeight(this.lines.length * ROW_HEIGHT);
            this.chat.setScroll(Math.max(0, this.lines.length - VISIBLE_ROWS) * ROW_HEIGHT);
        }
        this.setVisible(true);
    }

    protected paintChat() {
        this.chat.content.replaceChildren();
        const first = Math.trunc(this.chat.getScroll() / ROW_HEIGHT), canvas = this.layer.getManager().canvas;

        this.lines.slice(first, first + VISIBLE_ROWS).forEach((line, index) => this.layer.text(this.chat.content, line.text, line.color, FontType_T.SMALL, 2 + line.indent, 9 - Math.trunc(canvas.getLineHeight() / 2) + index * ROW_HEIGHT));
    }

    protected activate() {
        this.layer.activate(this.element);
        const parent = this.element.parentElement;

        if (parent !== this.layer.root && parent !== this.layer.consoleRoot) this.layer.activate(parent);
    }
}

export class NCGMSnoopManager {
    public readonly element: HTMLDivElement;

    public constructor(layer: NDomLayer, protected readonly windows: Pick<NCGMSnoopWnd, "element" | "setVisible">[]) {
        this.element = layer.createWindow(0, 0, 0, 0);
        this.element.className = "ndom-absolute";
        this.element.dataset.window = "gm-snoop-manager";
        windows.forEach(window => this.element.appendChild(window.element));
    }

    public placeOnScreen(width: number, height: number) {}
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (visible) this.windows.forEach(window => window.setVisible(true));
        this.windows.forEach(window => window.setVisible(false));
    }
}

export default NCGMSnoopWnd;
