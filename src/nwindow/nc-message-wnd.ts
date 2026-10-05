import NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";

const TEXT_COLOR = 0xffdcdcdc;
const BAR_HEIGHT = 52;
const TEX_BACK = "sek.cbui141";

function wrapLines(layer: NDomLayer, text: string, width: number): string[] { // DrawNormalText per-glyph wrap (0x10527d0a): break before a glyph past the width, spaces never break.
    const lines: string[] = [];
    let line = "", lineWidth = 0;

    for (const char of text) {
        if (char === "\n") {
            lines.push(line);
            line = "";
            lineWidth = 0;
            continue;
        }

        if (char.charCodeAt(0) < 0x20) continue;

        const advance = layer.measureText(char);

        if (advance === 0) continue;

        if (char !== " " && lineWidth + advance > width) {
            lines.push(line);
            line = "";
            lineWidth = 0;
        }

        line += char;
        lineWidth += advance;
    }

    lines.push(line);

    return lines;
}

export class NCMessageWnd { // NCMessageWnd (vtable 0x101bd350): OnCreate 0x100b8460, paint 0x100b8540; NCGodWnd::ShowMessage 0x10090bd0 feeds it.
    public static getTextures(): string[] { return [TEX_BACK]; }

    public readonly element: HTMLDivElement;

    protected readonly layer: NDomLayer;
    protected readonly back: HTMLDivElement;
    protected readonly textCanvas: HTMLCanvasElement;
    protected text = "";
    protected screenWidth = 0;

    public constructor(layer: NDomLayer) {

        this.layer = layer;
        this.element = layer.createWindow(0, 0, 0, BAR_HEIGHT);
        this.element.hidden = true;

        this.back = layer.tile(this.element, 0, 0, 0, BAR_HEIGHT, 0, 0, 1, BAR_HEIGHT, TEX_BACK);

        this.textCanvas = document.createElement("canvas");
        this.textCanvas.className = "ndom-text ndom-absolute";
        layer.place(this.textCanvas, 0, 0);
        this.element.appendChild(this.textCanvas);
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) { // NCGodWnd OnCreate 0x100912da / DefaultPosition 0x10090df0: (0, H-52, W, 52).
        this.screenWidth = screenWidth;
        this.layer.place(this.element, 0, screenHeight - BAR_HEIGHT, screenWidth, BAR_HEIGHT);
        this.layer.place(this.back, 0, 0, screenWidth, BAR_HEIGHT);
        this.layer.setTile(this.back, screenWidth, BAR_HEIGHT, 0, 0, screenWidth, BAR_HEIGHT, TEX_BACK);
        this.renderText();
    }

    public show(text: string) {
        this.text = text;
        this.renderText();
        this.element.hidden = false;
    }

    public hide() { this.element.hidden = true; }

    public isOpen() { return !this.element.hidden; }

    protected renderText() {
        const nwindow = this.layer.getManager().canvas;
        const scale = nwindow.scale;
        const width = Math.max(1, this.screenWidth);
        const lineHeight = nwindow.getLineHeight(FontType_T.SMALL);
        const textWidth = this.layer.measureText(this.text);

        this.textCanvas.width = Math.round(width * scale);
        this.textCanvas.height = Math.round(BAR_HEIGHT * scale);
        this.textCanvas.style.width = `${width}px`;
        this.textCanvas.style.height = `${BAR_HEIGHT}px`;

        const context = this.textCanvas.getContext("2d");

        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.imageSmoothingEnabled = false;

        if (!this.text) return;

        if (textWidth < this.screenWidth) { // Narrower than the bar: centred on the unwrapped extent (0x100b8605); else (50,8) wrapping at GSEKScreenX-100 (0x100b866f).
            const x = Math.trunc(this.screenWidth * 0.5 - Math.trunc(textWidth / 2));
            const y = Math.trunc(BAR_HEIGHT * 0.5 - Math.trunc(lineHeight / 2));

            nwindow.renderText(context, x, y, TEXT_COLOR, this.text, FontType_T.SMALL);
            return;
        }

        const lines = wrapLines(this.layer, this.text, this.screenWidth - 100);

        for (let i = 0; i < lines.length; i++)
            nwindow.renderText(context, 50, 8 + i * lineHeight, TEXT_COLOR, lines[i], FontType_T.SMALL);
    }
}

export default NCMessageWnd;
