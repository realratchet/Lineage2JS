import NWnd from "./nwnd";
import type NWindowCanvas from "./nwindow-canvas";

const TEXT_COLOR = 0xffdcdcdc;

export class NCStatusBarCtrl extends NWnd { // HP bar inside NCPlayerStatusWnd (paint 0x10112c10, value setter 0x10112bb0).
    protected readonly label: string;
    protected readonly fillTexture: string;
    protected readonly backTexture: string;
    protected readonly warnTexture: string;
    protected readonly sourceWidth: number;
    protected readonly sourceHeight: number;
    protected current = 0;
    protected maximum = 0;
    protected isWarning = false;

    public constructor(x: number, y: number, width: number, height: number, label: string, fillTexture: string, backTexture: string, warnTexture: string, sourceWidth: number, sourceHeight: number) {
        super(x, y, width, height);

        this.label = label;
        this.fillTexture = fillTexture;
        this.backTexture = backTexture;
        this.warnTexture = warnTexture;
        this.sourceWidth = sourceWidth;
        this.sourceHeight = sourceHeight;
    }

    public getTextures(): string[] { return [this.fillTexture, this.backTexture, this.warnTexture]; }

    public setValue(current: number, maximum: number) { // 0x10112be0: warning below 30% of max, max/10 truncated first.
        this.current = current;
        this.maximum = maximum;
        this.isWarning = current < Math.trunc(maximum / 10) * 3;
    }

    public onPaint(canvas: NWindowCanvas) {
        const width = Math.trunc(this.width), height = Math.trunc(this.height);
        const fill = this.current ? Math.trunc(this.current * this.width / this.maximum) : 0;

        canvas.drawTile(0, 0, width, height, 0, 0, this.sourceWidth, this.sourceHeight, this.backTexture);
        canvas.drawTile(0, 0, fill, height, 0, 0, this.sourceWidth, this.sourceHeight, this.fillTexture);

        if (this.isWarning) canvas.drawTile(0, 0, fill, height, 0, 0, this.sourceWidth, this.sourceHeight, this.warnTexture);

        const slash = canvas.measureDigits("/"), current = String(this.current);

        canvas.drawDigits(9, 2, TEXT_COLOR, this.label);
        canvas.drawDigits(Math.trunc(this.width * 0.5 - slash / 2), 2, TEXT_COLOR, "/");
        canvas.drawDigits(Math.trunc(this.width * 0.5 - canvas.measureText(current) - 6 - 2), 2, TEXT_COLOR, current); // regular-font extent 0x10012960, as in the lobby panel
        canvas.drawDigits(Math.trunc(this.width * 0.5 + 6 - 2), 2, TEXT_COLOR, String(this.maximum));
    }
}

export default NCStatusBarCtrl;
