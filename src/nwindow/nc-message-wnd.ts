import NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";

const TEXT_COLOR = 0xffdcdcdc;
const BAR_HEIGHT = 52;
const TEX_BACK = "sek.cbui141";

export class NCMessageWnd { // NCMessageWnd (vtable 0x101bd350): OnCreate 0x100b8460, paint 0x100b8540; NCGodWnd::ShowMessage 0x10090bd0 feeds it.
    public static getTextures(): string[] { return [TEX_BACK]; }

    public readonly element: HTMLDivElement;

    protected readonly layer: NDomLayer;
    protected readonly back: HTMLDivElement;
    protected readonly textBox: HTMLDivElement;
    protected readonly textLink: HTMLAnchorElement;
    protected text = "";
    protected screenWidth = 0;

    public constructor(layer: NDomLayer) {

        this.layer = layer;
        this.element = layer.createWindow(0, 0, 0, BAR_HEIGHT);
        this.element.hidden = true;

        this.back = layer.tile(this.element, 0, 0, 0, BAR_HEIGHT, 0, 0, 1, BAR_HEIGHT, TEX_BACK);

        this.textLink = document.createElement("a");
        this.textLink.target = "_blank";
        this.textLink.rel = "noopener noreferrer";
        this.textBox = layer.createWindow(0, 0, 0, BAR_HEIGHT, this.textLink);
        this.textBox.style.overflow = "hidden";
        this.element.appendChild(this.textLink);
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) { // NCGodWnd OnCreate 0x100912da / DefaultPosition 0x10090df0: (0, H-52, W, 52).
        this.screenWidth = screenWidth;
        this.layer.place(this.element, 0, screenHeight - BAR_HEIGHT, screenWidth, BAR_HEIGHT);
        this.layer.place(this.back, 0, 0, screenWidth, BAR_HEIGHT);
        this.layer.setTile(this.back, screenWidth, BAR_HEIGHT, 0, 0, screenWidth, BAR_HEIGHT, TEX_BACK);
        this.renderText();
    }

    public show(text: string, href?: string) {
        this.text = text;
        if (href) this.textLink.href = href;
        else this.textLink.removeAttribute("href");
        this.textLink.setAttribute("aria-label", text);
        this.renderText();
        this.element.hidden = false;
    }

    public hide() { this.element.hidden = true; }

    public isOpen() { return !this.element.hidden; }

    protected renderText() {
        const nwindow = this.layer.getManager().canvas;
        const width = Math.max(1, this.screenWidth);
        const lineHeight = nwindow.getLineHeight(FontType_T.SMALL);
        const textWidth = this.layer.measureText(this.text);

        this.layer.place(this.textBox, 0, 0, width, BAR_HEIGHT);
        this.textBox.replaceChildren();

        if (!this.text) return;

        if (textWidth < this.screenWidth) { // Narrower than the bar: centred on the unwrapped extent (0x100b8605); else (50,8) wrapping at GSEKScreenX-100 (0x100b866f).
            const x = Math.trunc(this.screenWidth * 0.5 - Math.trunc(textWidth / 2));
            const y = Math.trunc(BAR_HEIGHT * 0.5 - Math.trunc(lineHeight / 2));

            this.layer.text(this.textBox, this.text, TEXT_COLOR, FontType_T.SMALL, x, y);
            return;
        }

        const lines = nwindow.wrapText(this.text, this.screenWidth - 100);

        for (let i = 0; i < lines.length; i++)
            this.layer.text(this.textBox, lines[i], TEXT_COLOR, FontType_T.SMALL, 50, 8 + i * lineHeight);
    }
}

export default NCMessageWnd;
