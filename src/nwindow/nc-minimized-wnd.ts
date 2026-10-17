import NDomLayer from "./ndom";

const TEX_ICON = "L2UI_CH3.PartyMatchWnd.PartyMatchIcon";
const TEX_BACK = "NWindow.ChatBack";

export class NCMinimizedWnd {
    public static getTextures() { return [TEX_ICON, TEX_BACK]; }
    public readonly element: HTMLDivElement;
    protected readonly icon: HTMLCanvasElement;
    protected readonly caption: HTMLCanvasElement;
    protected hasActivity = false;
    protected blinkPhase = false;
    protected timer = 0;
    protected isHovered = false;

    public constructor(protected readonly layer: NDomLayer, protected readonly parentElement: HTMLElement, protected readonly onRestore: () => void) {
        this.element = layer.createWindow(0, 0, 32, 32);
        this.element.hidden = true;
        this.element.style.overflow = "visible";
        this.icon = document.createElement("canvas");
        this.icon.width = this.icon.height = 32;
        this.icon.style.pointerEvents = "none";
        this.element.appendChild(this.icon);
        this.caption = layer.text(this.element, layer.getManager().getSysString(389), 0xffdcdcdc, undefined, 0, 0);
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

    protected paint() {
        const canvas = this.layer.getManager().canvas;
        const context = this.icon.getContext("2d");

        context.clearRect(0, 0, 32, 32);
        context.drawImage(canvas.getTexture(TEX_ICON), 0, 0, 32, 32, 0, 0, 32, 32);

        if (this.hasActivity && this.blinkPhase) context.drawImage(canvas.getTintedImage(TEX_ICON, 0xff388080), 0, 0, 32, 32, 0, 0, 32, 32);
    }

    protected paintCaption() {
        if (!this.isHovered || !this.isVisible()) return;

        const canvas = this.layer.getManager().canvas;
        const text = this.layer.getManager().getSysString(389);
        const width = canvas.measureText(text), height = canvas.getLineHeight();
        const left = parseInt(this.element.style.left);
        const context = this.caption.getContext("2d");

        this.layer.place(this.caption, Math.min(left, canvas.width - width) - left, -height);
        context.clearRect(0, 0, this.caption.width, this.caption.height);
        context.drawImage(canvas.getTexture(TEX_BACK), 0, 0, width, height);
        canvas.renderText(context, 0, 0, 0xffdcdcdc, text);
        this.caption.hidden = false;
    }
}

export default NCMinimizedWnd;
