import type NDomLayer from "./ndom";
import { DigitFont_T } from "./nwindow-canvas";

const TEX_MARK = "L2UI_CH3.Etc.Record_Mark";

export class RecordMark {
    public static getTextures() { return [TEX_MARK]; }
    public readonly element: HTMLDivElement;
    protected readonly mark: HTMLDivElement;
    protected readonly timer = document.createElement("canvas");
    protected blinkTime = 0;
    protected seconds = -1;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 20, 55, 44);
        this.element.classList.add("ndom-opaque");
        this.element.style.pointerEvents = "none";
        this.element.hidden = true;
        this.mark = layer.tile(this.element, 11, 0, 32, 32, 0, 0, 32, 32, TEX_MARK);
        this.timer.width = 55;
        this.timer.height = 14;
        this.timer.style.position = "absolute";
        this.timer.style.left = "0px";
        this.timer.style.top = "30px";
        this.element.appendChild(this.timer);
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
        const context = this.timer.getContext("2d");

        context.clearRect(0, 0, this.timer.width, this.timer.height);
        if (seconds < 0) return;

        const text = `${String(Math.trunc(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
        const canvas = this.layer.getManager().canvas;

        this.timer.width = canvas.measureDigits(text, DigitFont_T.LARGE);
        canvas.renderDigits(context, 0, 0, 0xffffffff, text, DigitFont_T.LARGE, 204);
    }
}

export default RecordMark;
