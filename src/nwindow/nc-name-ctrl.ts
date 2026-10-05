import NWnd from "./nwnd";
import type NWindowCanvas from "./nwindow-canvas";

export enum NameAlign_T { LEFT, CENTER }

export class NCNameCtrl extends NWnd {
    public text = "";
    public color = 0xffdcdcdc;
    public align = NameAlign_T.LEFT;

    public setText(text: string, color: number = this.color) {
        if (text === this.text && color === this.color) return;

        this.text = text;
        this.color = color;
        this.invalidate();
    }

    public onPaint(canvas: NWindowCanvas) { // 0x1002cb6d: drop trailing characters until the text fits, then append "..".
        let text = this.text;

        if (canvas.measureText(text) > this.width) {
            while (text.length > 0 && canvas.measureText(`${text}..`) > this.width) text = text.slice(0, -1);

            text = `${text}..`;
        }

        const x = this.align === NameAlign_T.CENTER ? Math.trunc(this.width * 0.5 - canvas.measureText(text) / 2) : 0;

        canvas.drawText(x, 0, this.color, text);
    }
}

export default NCNameCtrl;
