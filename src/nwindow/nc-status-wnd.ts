import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";

const TEX_FRAME = "L2UI_CH3.FrameCtrl.smallbar";
const MIN_WIDTH = 172;
const MAX_WIDTH = 374;

export function fitName(layer: NDomLayer, text: string, width: number) { // 0x1002cb6d: drop trailing characters until the text fits, then append "..".
    if (layer.measureText(text) <= width) return text;

    while (text.length > 0 && layer.measureText(`${text}..`) > width) text = text.slice(0, -1);

    return `${text}..`;
}

export abstract class NCStatusWnd {
    public static getTextures(): string[] { return [TEX_FRAME + "1", TEX_FRAME + "2", TEX_FRAME + "3"]; }

    public readonly element: HTMLDivElement;
    protected readonly arrFrame: HTMLDivElement[];
    protected readonly arrBack: HTMLDivElement[];
    protected readonly grip: HTMLDivElement;
    protected readonly name: HTMLDivElement;
    protected sizeCtrl: HTMLDivElement = null;
    protected width = MIN_WIDTH;
    protected height: number;
    protected sizeDelta = 0;
    protected isSizing = false;

    public constructor(protected readonly layer: NDomLayer, protected readonly windowName: string, x: number, y: number, height: number, gripY = 0) {
        this.height = height;
        this.element = layer.createWindow(x, y, MIN_WIDTH, height);
        this.element.hidden = true;
        this.element.classList.add("ndom-opaque");
        this.arrFrame = [1, 2, 3].map(index => layer.tile(this.element, 0, 0, 12, 8, 0, 0, 12, 8, TEX_FRAME + index));
        this.arrBack = [0, 1, 2].map(() => layer.tile(this.element, 0, 0, 0, 0, 0, 0, 1, 1, TEX_FRAME + "1"));
        this.grip = NCFrameCtrl.createGrip(layer, this.element, 0, gripY, 12, height - gripY);
        this.name = layer.text(this.element, "", 0xffdcdcdc, undefined, 0, 0);
        this.name.style.pointerEvents = "none";
    }

    protected abstract update(): void;

    protected createSizeCtrl(y = 0) { // NCStatusSizeCtrl: 10 px grip on the right edge, cursor 6.
        const layer = this.layer, manager = layer.getManager(), ctrl = layer.createWindow(0, y, 10, this.height - y, this.element);

        ctrl.addEventListener("mouseenter", () => manager.setCursor(manager.getCursor(6)));
        ctrl.addEventListener("mouseleave", () => { if (!this.isSizing) manager.setCursor(""); });
        ctrl.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail > 1) return;

            event.preventDefault();
            this.isSizing = true;

            const grabX = layer.toUI(event.clientX) - parseFloat(this.element.style.left) - ctrl.offsetLeft;

            layer.beginDrag(move => this.resize(Math.trunc(layer.toUI(move.clientX) - parseFloat(this.element.style.left) - ctrl.offsetLeft - grabX)), () => {
                this.isSizing = false;
                if (!ctrl.matches(":hover")) manager.setCursor("");
            });
        });

        this.sizeCtrl = ctrl;
    }

    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }

    protected restoreWidth() {
        const owner = this.layer.getManager().getWindowOwner();
        const saved = owner === null ? null : localStorage.getItem(`wnd:${owner}:${this.windowName}:width`);
        const width = saved === null ? MIN_WIDTH : JSON.parse(saved);

        if (!Number.isInteger(width) || width < MIN_WIDTH || width > MAX_WIDTH) throw new Error(`Invalid status width.`);

        this.resize(width - this.width, false);
    }

    public resize(delta: number, save = true) {
        const size = Math.max(0, Math.min(MAX_WIDTH - MIN_WIDTH, this.sizeDelta + delta)), change = size - this.sizeDelta;

        this.sizeDelta = size;
        this.width += change;
        this.update();

        const owner = this.layer.getManager().getWindowOwner();

        if (save && change !== 0 && owner !== null) {
            localStorage.setItem(`wnd:${owner}:${this.windowName}:width`, JSON.stringify(this.width));
            this.layer.saveWindowPosition(this.element);
        }
    }

    protected layoutFrame(height: number, back: string[], sourceHeight: number, endOffset = 16, endWidth = 19) {
        const layer = this.layer, W = this.width;

        this.height = height;
        this.element.style.width = `${W}px`;
        this.element.style.height = `${height}px`;
        layer.placeTile(this.arrFrame[0], 0, 0, 12, 8, 0, 0, 12, 8, TEX_FRAME + "1");
        layer.placeTile(this.arrFrame[1], 0, 8, 12, height - 16, 0, 0, 12, 8, TEX_FRAME + "2");
        layer.placeTile(this.arrFrame[2], 0, height - 8, 12, 8, 0, 0, 12, 8, TEX_FRAME + "3");
        layer.placeTile(this.arrBack[0], 12, 0, 16, height, 0, 0, 16, sourceHeight, back[0]);
        layer.placeTile(this.arrBack[1], 28, 0, W - 28 - endOffset, height, 0, 0, 16, sourceHeight, back[1]);
        layer.placeTile(this.arrBack[2], W - endOffset, 0, endWidth, height, 0, 0, endWidth, sourceHeight, back[2]);
        layer.place(this.grip, 0, parseFloat(this.grip.style.top), 12, height - parseFloat(this.grip.style.top));
        if (this.sizeCtrl) layer.place(this.sizeCtrl, W - 10, parseFloat(this.sizeCtrl.style.top), 10, height - parseFloat(this.sizeCtrl.style.top));
    }

    protected setName(text: string, color: number, x: number, y: number, width: number, isCentered = false) {
        const fitted = fitName(this.layer, text, width);

        this.layer.renderText(this.name, fitted, color);
        this.layer.place(this.name, isCentered ? x + Math.trunc(width * 0.5 - this.layer.measureText(fitted) / 2) : x, y);
    }
}

export default NCStatusWnd;
