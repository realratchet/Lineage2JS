import NWnd, { NMouseEvent_T } from "./nwnd";
import type NWindowCanvas from "./nwindow-canvas";
import type NWindowManager from "./nwindow-manager";

const TEXT_COLOR = 0xffdcdcdc;
const CARET_BLINK = 500;

export enum EditMode_T { NORMAL = 1, PASSWORD = 2 } // NCEditBox ctor 0x100112c0 mode [0x214].

export class NCEditBox extends NWnd {
    public readonly mode: EditMode_T;
    public readonly maxLength: number;
    public text = "";
    public onSubmit: (text: string, isShift: boolean) => void = null;
    public onFocusLost: () => void = null;
    protected selectOnClick = true;
    protected isSelecting = false;
    protected isCaretVisible = true;
    protected caretTimer: number = null;

    public constructor(x: number, y: number, width: number, height: number, mode: EditMode_T = EditMode_T.NORMAL, maxLength: number = 0) {
        super(x, y, width, height);

        this.mode = mode;
        this.maxLength = maxLength;
    }

    public getTextures(): string[] { return ["L2UI_CH3.Etc.inputbox1", "L2UI_CH3.Etc.inputbox2", "L2UI_CH3.Etc.inputbox3", "L2UI_CH3.Etc.inputbox1_disable", "L2UI_CH3.Etc.inputbox2_disable", "L2UI_CH3.Etc.inputbox3_disable", "NWindow.WhiteTexture"]; }

    public attach(manager: NWindowManager) {
        super.attach(manager);
        window.clearInterval(this.caretTimer);

        this.caretTimer = window.setInterval(() => {
            this.isCaretVisible = !this.isCaretVisible;

            if (this.isFocused()) this.invalidate();
        }, CARET_BLINK);
    }

    public detach() {
        if (this.isFocused()) this.manager.blurText();

        window.clearInterval(this.caretTimer);
        this.caretTimer = null;
        super.detach();
    }

    public focus() { this.manager.focusText(this, this.text, this.mode === EditMode_T.PASSWORD, this.maxLength); }
    public isFocused() { return this.manager !== null && this.manager.isTextFocused(this); }

    public setText(text: string) {
        this.text = text;

        if (this.isFocused()) this.manager.focusText(this, text, this.mode === EditMode_T.PASSWORD, this.maxLength);

        this.invalidate();
    }

    public onTextInput(text: string) {
        this.text = text;
        this.invalidate();
    }

    public onTextSubmit(text: string, isShift: boolean = false) { if (this.onSubmit) this.onSubmit(text, isShift); }

    public onTextBlur() {
        this.manager.setTextSelection(this.text.length, this.text.length);
        this.selectOnClick = true;
        this.isSelecting = false;

        if (this.onFocusLost) this.onFocusLost();
    }

    public onMouseDown(event: NMouseEvent_T) {
        if (!this.isEnabled || event.button !== 0) return;
        if (!this.isFocused()) this.focus();

        this.isSelecting = false;

        if (this.selectOnClick) {
            this.manager.setTextSelection(0, this.manager.getCaretPosition(), "backward");
            return;
        }

        const caret = this.getClickPosition(event.x);

        this.manager.setTextSelection(caret, caret);
        this.isSelecting = true;
    }

    protected getClickPosition(mouseX: number): number {
        const canvas = this.manager.canvas;
        const shown = this.mode === EditMode_T.PASSWORD ? "*".repeat(this.text.length) : this.text;
        let start = 0;

        while (start < shown.length && canvas.measureText(shown.slice(start)) > this.width - 6) start++;

        let caret = this.manager.getCaretPosition();
        const x = canvas.measureText(shown.slice(start, caret));
        const distance = Math.abs(mouseX - x);
        let moved = 0;

        if (mouseX < x) {
            while (caret > 0 && moved < distance) moved += canvas.measureText(this.text[--caret]);
        } else {
            while (caret < this.text.length && moved < distance) moved += canvas.measureText(this.text[caret++]);
        }

        return caret;
    }

    public onMouseMove(event: NMouseEvent_T) {
        if (!this.isSelecting || !this.manager.isPressed(this) || !this.isFocused()) return;

        const anchor = this.manager.getCaretPosition();
        const caret = this.getClickPosition(event.x);

        this.manager.setTextSelection(Math.min(anchor, caret), Math.max(anchor, caret), caret < anchor ? "backward" : "forward");
    }

    public onMouseUp(event: NMouseEvent_T) {
        if (event.button !== 0) return;

        this.selectOnClick = false;
        this.isSelecting = false;
    }

    public onPaint(canvas: NWindowCanvas) {
        const suffix = this.isFocused() ? "" : "_disable";
        const W = this.width, H = this.height;

        canvas.drawTile(0, 0, 8, H, 0, 0, 8, 17, `L2UI_CH3.Etc.inputbox1${suffix}`);
        canvas.drawTile(8, 0, W - 16, H, 0, 0, 8, 17, `L2UI_CH3.Etc.inputbox2${suffix}`);
        canvas.drawTile(W - 8, 0, 8, H, 0, 0, 8, 17, `L2UI_CH3.Etc.inputbox3${suffix}`);

        const shown = this.mode === EditMode_T.PASSWORD ? "*".repeat(this.text.length) : this.text;
        let start = 0;

        while (start < shown.length && canvas.measureText(shown.slice(start)) > W - 6) start++;

        const visible = shown.slice(start);

        canvas.clip(0, 0, W, H);
        canvas.drawText(2, 2, TEXT_COLOR, visible);

        if (this.isFocused()) {
            if (this.isCaretVisible) {
                const caret = Math.max(0, this.manager.getCaretPosition() - start);

                canvas.drawText(2 + canvas.measureText(visible.slice(0, caret)) - (this.mode === EditMode_T.PASSWORD ? 0 : 1), 2, TEXT_COLOR, "|");
            }

            const selectionStart = this.manager.getSelectionStart();
            const selectionEnd = this.manager.getSelectionEnd();

            if (selectionEnd > selectionStart) {
                const anchor = this.manager.getCaretPosition();
                let x = canvas.measureText(shown.slice(start, anchor));

                if (anchor === selectionEnd) {
                    const width = canvas.measureText(this.text.slice(selectionStart, selectionEnd));

                    canvas.drawTile(2 + x - width, 2, width, 12, 0, 0, 1, 1, "NWindow.WhiteTexture", 0x80);
                } else {
                    for (let i = Math.max(start, selectionStart); i < selectionEnd; i++) {
                        const width = canvas.measureText(this.text[i]);

                        canvas.drawTile(1 + x, 2, width, 12, 0, 0, 1, 1, "NWindow.WhiteTexture", 0x80);
                        x += width;
                    }
                }
            }
        }

        canvas.unclip();
    }
}

export default NCEditBox;
