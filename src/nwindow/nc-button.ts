import NWnd, { type NMouseEvent_T } from "./nwnd";
import type NWindowCanvas from "./nwindow-canvas";

export const NCBUTTON_NO_OVER = 0x2; // NCButton::Initialize 0x10001660 flags: bit 2 suppresses the implicit '%s_over' texture.

const LABEL_ENABLED = 0xffe6dcbe;
const LABEL_DISABLED = 0xffa0a0a0;

export class NCButton extends NWnd {
    public normalTexture: string;
    public downTexture: string;
    public overTexture: string;
    public label: string = null;
    public labelOffsetX = 0;
    public labelOffsetY = 0;
    public u = 0;
    public v = 0;
    public onPress: () => void = null;

    public constructor(x: number, y: number, width: number, height: number, normalTexture: string = null, downTexture: string = null, overTexture: string = null, flags: number = 0) {
        super(x, y, width, height);

        this.normalTexture = normalTexture;
        this.downTexture = downTexture;
        this.overTexture = overTexture || (normalTexture && !(flags & NCBUTTON_NO_OVER) ? `${normalTexture}_over` : null);
    }

    public getTextures(): string[] {
        const textures = [this.normalTexture, this.downTexture].filter(Boolean);

        if (this.overTexture) textures.push(this.overTexture === `${this.normalTexture}_over` ? `?${this.overTexture}` : this.overTexture);

        return textures;
    }

    protected getState(): 0 | 1 | 2 {
        if (!this.manager.isHovered(this)) return 0;

        return this.manager.isPressed(this) ? 1 : 2;
    }

    public onPaint(canvas: NWindowCanvas) {
        const state = this.getState();
        const over = this.overTexture && canvas.hasTexture(this.overTexture) ? this.overTexture : this.normalTexture;
        const texture = state === 1 ? this.downTexture || this.normalTexture : state === 2 ? over : this.normalTexture;

        if (texture) canvas.drawTile(0, 0, this.width, this.height, this.u, this.v, this.width, this.height, texture);

        if (this.label) {
            const width = canvas.measureText(this.label);

            canvas.drawText(Math.trunc(this.width * 0.5 + this.labelOffsetX - width / 2), Math.trunc(this.height * 0.5 + this.labelOffsetY - canvas.getLineHeight() / 2), this.isEnabled ? LABEL_ENABLED : LABEL_DISABLED, this.label);
        }
    }

    public onMouseDown(event: NMouseEvent_T) {
        if (event.button !== 0) return;

        this.manager.playButtonSound(this.isEnabled);
        this.invalidate();
    }

    public onClick(event: NMouseEvent_T) {
        if (event.button === 0 && this.isEnabled && this.onPress) this.onPress();
    }
}

export default NCButton;
