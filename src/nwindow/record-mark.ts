import type NDomLayer from "./ndom";
import { DigitFont_T } from "./nwindow-canvas";

const TEX_MARK = "L2UI_CH3.Etc.Record_Mark";

export class RecordMark {
    public static getTextures() { return [TEX_MARK]; }
    public readonly element: HTMLDivElement;
    protected readonly mark: HTMLDivElement;
    protected readonly timer: HTMLDivElement;
    protected blinkTime = 0;
    protected seconds = -1;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 20, 55, 44);
        this.element.classList.add("ndom-opaque");
        this.element.style.pointerEvents = "none";
        this.element.hidden = true;
        this.mark = layer.tile(this.element, 11, 0, 32, 32, 0, 0, 32, 32, TEX_MARK);
        this.timer = layer.digits(this.element, "", 0xffffffff, DigitFont_T.LARGE, 0, 30, 204);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 181, 20); }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }

    public update(now: number, elapsed: number): void {
        if (this.element.hidden) return;

        // UCanvas::DrawRecordMark 0x7ec3d0: 2s cycle, mark visible before 1.5s.
        if (now - this.blinkTime > 2) this.blinkTime = now;
        this.mark.hidden = now - this.blinkTime >= 1.5;
        const seconds = elapsed === null ? -1 : Math.trunc(elapsed);

        if (seconds === this.seconds) return;
        this.seconds = seconds;
        const text = seconds < 0 ? "" : `${String(Math.trunc(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

        this.layer.renderDigits(this.timer, text, 0xffffffff, DigitFont_T.LARGE, 204);
    }
}

export default RecordMark;
