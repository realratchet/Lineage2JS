import NWnd from "./nwnd";
import type NWindowCanvas from "./nwindow-canvas";

const TEXT_COLOR = 0xffdcdcdc;
const CARET_BLINK = 500;

export enum EditMode_T { NORMAL = 1, PASSWORD = 2 } // NCEditBox ctor 0x100112c0 mode [0x214].

export class NCEditBox extends NWnd {
    public readonly mode: EditMode_T;
    public readonly maxLength: number;
    public text = "";
    public onSubmit: (text: string) => void = null;
    public onFocusLost: () => void = null;

    public constructor(x: number, y: number, width: number, height: number, mode: EditMode_T = EditMode_T.NORMAL, maxLength: number = 0) {
        super(x, y, width, height);

        this.mode = mode;
        this.maxLength = maxLength;
    }

    public getTextures(): string[] { return ["L2UI_CH3.Etc.inputbox1", "L2UI_CH3.Etc.inputbox2", "L2UI_CH3.Etc.inputbox3", "L2UI_CH3.Etc.inputbox1_disable", "L2UI_CH3.Etc.inputbox2_disable", "L2UI_CH3.Etc.inputbox3_disable"]; }

    public focus() { this.manager.focusText(this, this.text, this.mode === EditMode_T.PASSWORD, this.maxLength); }
    public isFocused() { return this.manager.isTextFocused(this); }

    public setText(text: string) {
        this.text = text;

        if (this.isFocused()) this.manager.focusText(this, text, this.mode === EditMode_T.PASSWORD, this.maxLength);

        this.invalidate();
    }

    public onTextInput(text: string) {
        this.text = text;
        this.invalidate();
    }

    public onTextSubmit(text: string) { if (this.onSubmit) this.onSubmit(text); }

    public onTextBlur() { if (this.onFocusLost) this.onFocusLost(); }

    public onMouseDown() { if (this.isEnabled) this.focus(); }

    public onPaint(canvas: NWindowCanvas) {
        const suffix = this.isEnabled ? "" : "_disable";
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
            canvas.isAnimating = true;

            if (Math.floor(performance.now() / CARET_BLINK) % 2 === 0) {
                const caret = Math.max(0, this.manager.getCaretPosition() - start);

                canvas.drawText(2 + canvas.measureText(visible.slice(0, caret)) - 1, 2, TEXT_COLOR, "|");
            }
        }

        canvas.unclip();
    }
}

export default NCEditBox;
