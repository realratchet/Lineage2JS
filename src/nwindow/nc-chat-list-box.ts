import NCScrollBar from "./nc-scroll-bar";
import type NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";

const TEX_SYSTEM = "L2UI_CH3.ChatWnd.chatting_system";
const MAX_LINES = 200;
const ROW_HEIGHT = 15;
const TEXT_X = 23;
const TEXT_Y = 14;
const INDENT = 12;

type ChatLine_T = { text: string, color: number, indent: number };
type ChatEntry_T = { text: string, color: number };

export class NCChatListBox { // NCChatListBox (vtable 0x101ac928), ctor 0x1005a520(200, 9, 15); scroll column on the left at (5,10).
    public readonly element: HTMLDivElement;
    protected readonly back: HTMLDivElement = null;
    protected readonly text: HTMLDivElement;
    protected readonly scrollBar: NCScrollBar;
    protected readonly lines: ChatLine_T[] = [];
    protected readonly pending: ChatEntry_T[] = [];
    protected width: number;
    protected height: number;
    protected rows = 9;
    protected scrollTop = 0;
    protected isScheduled = false;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement, x: number, y: number, width: number, height: number, isSystem = false) {
        this.width = width;
        this.height = height;
        this.element = layer.createWindow(x, y, width, height, parent);
        this.element.style.overflow = "hidden";
        if (isSystem) this.back = layer.tile(this.element, 0, 0, width, height, 0, 0, width, 128, TEX_SYSTEM);
        this.text = layer.createWindow(0, 0, width, height, this.element);
        this.text.style.pointerEvents = "none";
        this.scrollBar = new NCScrollBar(layer, this.element, 5, isSystem ? 5 : 10, isSystem ? height - 9 : height - 10); // NCChatSystemMsgWnd (vtable 0x101aca78): OnCreate 0x100540f0 scroll column (5,5)..(5,H-19), paint 0x10056900.
        this.scrollBar.onScroll = position => {
            this.scrollTop = position;
            this.invalidate();
        };
        this.element.addEventListener("wheel", event => this.onWheel(Math.sign(event.deltaY)));
    }

    public static getTextures(): string[] { return [TEX_SYSTEM]; }

    protected getWrapWidth() { return this.back ? this.width - 10 - 16 - 6 : this.width - 16 - 6; } // The system pane wraps at the chat lists' width (W - 10): both panes break the same line in the L2.4_20 capture.

    public isVisible() { return !this.element.hidden; }

    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;
        this.invalidate();
    }

    public addString(text: string, color: number) {
        this.pending.push({ text, color });

        if (this.pending.length > MAX_LINES) this.pending.shift();

        this.invalidate();
    }

    public resize(width: number, height: number) { // ResizeChatListBox 0x10054b30: slider H-40, down arrow at H-15.
        this.width = width;
        this.height = height;
        this.layer.place(this.element, 0, 0, width, height);
        this.scrollBar.setHeight(height - 10);
        this.invalidate();
    }

    public onWheel(delta: number): boolean {
        this.scrollBar.scrollBy(delta);

        return true;
    }

    protected invalidate() {
        if (this.isScheduled) return;

        this.isScheduled = true;
        requestAnimationFrame(() => {
            this.isScheduled = false;
            if (this.isVisible()) this.render();
        });
    }

    protected pushLine(line: ChatLine_T) { // AddString 0x10021510: drop the oldest line at 200, otherwise follow the bottom once rows are full.
        if (this.lines.length >= MAX_LINES) this.lines.shift();
        else if (this.lines.length >= this.rows) this.scrollTop++;

        this.lines.push(line);
    }

    protected flush() {
        const canvas = this.layer.getManager().canvas;

        for (const entry of this.pending) {
            if (!entry.text) continue;

            canvas.wrapText(entry.text, this.getWrapWidth(), this.getWrapWidth() - INDENT).forEach((text, index) => {
                this.pushLine({ text, color: entry.color, indent: index ? INDENT : 0 });
            });
        }

        this.pending.length = 0;
    }

    protected render() { // OnPaint 0x10056530
        this.flush();

        const rows = Math.trunc((this.height - 10) / ROW_HEIGHT);

        if (rows !== this.rows) {
            this.rows = rows;

            if (this.lines.length >= rows) this.scrollTop = this.lines.length - rows;
        }

        if (this.lines.length < this.rows) this.scrollTop = 0;

        this.scrollBar.setRange(this.lines.length, this.rows);
        this.scrollBar.setPosition(this.scrollTop);
        this.text.replaceChildren();

        for (let row = 0; row < this.rows && this.scrollTop + row < this.lines.length; row++) {
            const line = this.lines[this.scrollTop + row];

            this.layer.text(this.text, line.text, line.color, FontType_T.SMALL, TEXT_X + line.indent, TEXT_Y + row * ROW_HEIGHT);
        }
    }
}

export default NCChatListBox;
