import NDomLayer from "./ndom";

const TEX_ICON = "L2UI_CH3.PartyMatchWnd.PartyMatchIcon";
const TEX_BACK = "NWindow.ChatBack";

export class NCMinimizedWnd {
    public static getTextures(texture = TEX_ICON) { return [texture, TEX_BACK]; }
    public readonly element: HTMLDivElement;
    protected readonly blink: HTMLDivElement;
    protected readonly caption: HTMLDivElement;
    protected readonly captionBack: HTMLDivElement;
    protected readonly captionText: HTMLDivElement;
    protected hasActivity = false;
    protected blinkPhase = false;
    protected timer = 0;
    protected isHovered = false;

    public constructor(protected readonly layer: NDomLayer, protected readonly parentElement: HTMLElement, protected readonly onRestore: () => void, texture = TEX_ICON, protected readonly captionId = 389, protected readonly isCaptionAbove = true) {
        this.element = layer.createWindow(0, 0, 32, 32);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        this.element.style.overflow = "visible";
        layer.tile(this.element, 0, 0, 32, 32, 0, 0, 32, 32, texture).style.pointerEvents = "none";
        this.blink = layer.tile(this.element, 0, 0, 32, 32, 0, 0, 32, 32, texture, 0xff388080);
        this.blink.style.pointerEvents = "none";
        this.caption = layer.createWindow(0, 0, 0, 0, this.element);
        this.captionBack = layer.tile(this.caption, 0, 0, 0, 0, 0, 0, 1, 1, TEX_BACK);
        this.captionText = layer.text(this.caption, layer.getManager().getSysString(captionId), 0xffdcdcdc, undefined, 0, 0);
        this.caption.hidden = true;
        this.caption.style.pointerEvents = "none";
        layer.createWindow(0, 0, 33, 33, this.element);
        this.element.addEventListener("mouseenter", () => { this.isHovered = true; this.paintCaption(); });
        this.element.addEventListener("mouseleave", () => { this.isHovered = false; this.caption.hidden = true; });
        this.element.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2) return;

            event.preventDefault();
            let x = layer.toUI(event.clientX), y = layer.toUI(event.clientY), wasDragged = false;
            const offsetX = x - this.element.offsetLeft, offsetY = y - this.element.offsetTop;

            layer.beginDrag(event => {
                const nextX = layer.toUI(event.clientX), nextY = layer.toUI(event.clientY);

                if (nextX !== x || nextY !== y) {
                    const [left, top] = layer.getManager().snapWindow(nextX - offsetX, nextY - offsetY, this.element.offsetWidth, this.element.offsetHeight, this.element);

                    layer.place(this.element, left, top);
                }
                x = nextX;
                y = nextY;
                wasDragged = true;
                this.paintCaption();
            }, event => {
                if (!wasDragged && event instanceof MouseEvent && (event.type === "mouseup" || event.type === "pointerup")) this.restore();
            });
        });
        this.paint();
    }

    public isVisible() { return !this.element.hidden; }
    public hide() { this.setVisible(false); }

    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;
        this.caption.hidden = true;
        this.isHovered = false;

        if (isVisible) this.layer.activate(this.element);
    }

    public minimize() {
        const x = Math.max(0, parseInt(this.parentElement.style.left)), y = parseInt(this.parentElement.style.top);

        if (x !== parseInt(this.element.style.left) || y !== parseInt(this.element.style.top)) this.layer.getManager().clearWindowDocking(this.element);
        this.layer.place(this.element, x, y);
        this.parentElement.hidden = true;
        this.setVisible(true);
        this.element.focus();
    }

    public place(x: number, y: number) {
        if (this.isVisible()) this.layer.place(this.element, this.element.offsetLeft + x - parseInt(this.parentElement.style.left), this.element.offsetTop + y - parseInt(this.parentElement.style.top));
        this.layer.place(this.parentElement, x, y);
    }

    public restore(isSilent = false) {
        if (!this.isVisible()) return;

        const x = parseInt(this.element.style.left), y = parseInt(this.element.style.top);

        if (x !== parseInt(this.parentElement.style.left) || y !== parseInt(this.parentElement.style.top)) {
            this.layer.place(this.parentElement, x, y);
            this.layer.saveWindowPosition(this.parentElement);
        }
        this.hide();
        if (!isSilent) this.layer.getManager().playWindowSound();
        this.parentElement.hidden = false;
        this.layer.activate(this.parentElement);
        this.onRestore();
        if (!isSilent) {
            this.parentElement.focus();
            this.hasActivity = false;
            this.timer = 0;
            this.paint();
        }
    }

    public setActivity() {
        if (!this.isVisible()) return;

        this.hasActivity = true;
        this.timer = 500;
        this.paint();
    }

    public tick(deltaMs: number) {
        if (!this.hasActivity) return;

        this.timer -= deltaMs;

        if (this.timer > 0) return;

        while (this.timer <= 0) {
            this.blinkPhase = !this.blinkPhase;
            this.timer += 500;
        }

        this.paint();
    }

    protected paint() { this.blink.hidden = !(this.hasActivity && this.blinkPhase); }

    protected paintCaption() {
        if (!this.isHovered || !this.isVisible()) return;

        const canvas = this.layer.getManager().canvas;
        const text = this.layer.getManager().getSysString(this.captionId);
        const width = canvas.measureText(text), height = canvas.getLineHeight();
        const left = parseInt(this.element.style.left), back = canvas.getTexture(TEX_BACK);

        this.layer.place(this.caption, Math.min(left, canvas.width - width) - left, this.isCaptionAbove ? -height : 32, width, height);
        this.layer.placeTile(this.captionBack, 0, 0, width, height, 0, 0, back.width, back.height, TEX_BACK);
        this.layer.renderText(this.captionText, text, 0xffdcdcdc);
        this.caption.hidden = false;
    }
}

export default NCMinimizedWnd;
