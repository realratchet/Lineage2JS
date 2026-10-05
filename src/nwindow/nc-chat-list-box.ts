import NWnd from "./nwnd";
import NCScrollBar from "./nc-scroll-bar";
import NWindowCanvas, { FontType_T } from "./nwindow-canvas";

const TEX_SYSTEM = "L2UI_CH3.ChatWnd.chatting_system";
const MAX_LINES = 200;
const ROW_HEIGHT = 15;
const TEXT_X = 23;
const TEXT_Y = 14;
const INDENT = 12;

type ChatLine_T = { text: string, color: number, indent: number };
type ChatEntry_T = { text: string, color: number };

function splitLine(canvas: NWindowCanvas, text: string, maxWidth: number): [string, string] { // 0x100137e0 / 0x10013be0: per-glyph wrap, the glyph that passes maxWidth starts the next line; '\n' ends one.
    let width = 0;

    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);

        if (code === 0x0a) return [text.slice(0, i + 1), text.slice(i + 1)];
        if (code < 0x20) continue;

        width += canvas.measureText(text[i], FontType_T.SMALL);

        if (width > maxWidth) return [text.slice(0, i), text.slice(i)];
    }

    return [text, ""];
}

export class NCChatListBox extends NWnd { // NCChatListBox (vtable 0x101ac928), ctor 0x1005a520(200, 9, 15); scroll column on the left at (5,10).
    protected readonly scrollBar: NCScrollBar;
    protected readonly lines: ChatLine_T[] = [];
    protected readonly pending: ChatEntry_T[] = [];
    protected rows = 9;
    protected scrollTop = 0;

    public constructor(x: number, y: number, width: number, height: number) {
        super(x, y, width, height);

        this.scrollBar = this.addChild(new NCScrollBar(5, 10, height - 10));
        this.scrollBar.onScroll = position => {
            this.scrollTop = position;
            this.invalidate();
        };
    }

    protected getWrapWidth() { return this.width - 16 - 6; }

    public addString(text: string, color: number) {
        this.pending.push({ text, color });

        if (this.pending.length > MAX_LINES) this.pending.shift();

        this.invalidate();
    }

    public resize(width: number, height: number) { // ResizeChatListBox 0x10054b30: slider H-40, down arrow at H-15.
        this.width = width;
        this.height = height;
        this.scrollBar.setHeight(height - 10);
        this.invalidate();
    }

    public onWheel(delta: number): boolean {
        this.scrollBar.scrollBy(delta);

        return true;
    }

    protected pushLine(line: ChatLine_T) { // AddString 0x10021510: drop the oldest line at 200, otherwise follow the bottom once rows are full.
        if (this.lines.length >= MAX_LINES) this.lines.shift();
        else if (this.lines.length >= this.rows) this.scrollTop++;

        this.lines.push(line);
    }

    protected flush(canvas: NWindowCanvas) {
        for (const entry of this.pending) {
            let [line, rest] = splitLine(canvas, entry.text, this.getWrapWidth());
            let indent = 0;

            while (line) {
                this.pushLine({ text: line, color: entry.color, indent });
                [line, rest] = splitLine(canvas, rest, this.getWrapWidth() - INDENT);
                indent = INDENT;
            }
        }

        this.pending.length = 0;
    }

    public onPaint(canvas: NWindowCanvas) { // OnPaint 0x10056530
        this.flush(canvas);

        const rows = Math.trunc((this.height - 10) / ROW_HEIGHT);

        if (rows !== this.rows) {
            this.rows = rows;

            if (this.lines.length >= rows) this.scrollTop = this.lines.length - rows;
        }

        if (this.lines.length < this.rows) this.scrollTop = 0;

        this.scrollBar.setRange(this.lines.length, this.rows);
        this.scrollBar.setPosition(this.scrollTop);

        canvas.clip(0, 0, this.width, this.height);

        for (let row = 0; row < this.rows && this.scrollTop + row < this.lines.length; row++) {
            const line = this.lines[this.scrollTop + row];

            canvas.drawText(TEXT_X + line.indent, TEXT_Y + row * ROW_HEIGHT, line.color, line.text, FontType_T.SMALL);
        }

        canvas.unclip();
    }
}

export class NCChatSystemMsgWnd extends NCChatListBox { // NCChatSystemMsgWnd (vtable 0x101aca78): OnCreate 0x100540f0 scroll column (5,5)..(5,H-19), paint 0x10056900.
    public constructor(x: number, y: number, width: number, height: number) {
        super(x, y, width, height);

        this.scrollBar.y = 5;
        this.scrollBar.setHeight(height - 9);
    }

    protected getWrapWidth() { return this.width - 10 - 16 - 6; } // Wraps at the chat lists' width (W - 10): both panes break the same line in the L2.4_20 capture.

    public getTextures(): string[] { return [TEX_SYSTEM]; }

    public onPaint(canvas: NWindowCanvas) {
        canvas.clip(0, 0, this.width, this.height);
        canvas.drawTile(0, 0, this.width, this.height, 0, 0, this.width, 128, TEX_SYSTEM);
        canvas.unclip();

        super.onPaint(canvas);
    }
}

export default NCChatListBox;
