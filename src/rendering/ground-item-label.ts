import type NWindowCanvas from "../nwindow/nwindow-canvas";
import Nameplate from "./nameplate";

export class GroundItemLabel extends Nameplate {
    public setLabel(canvas: NWindowCanvas, text: string) {
        if (text === this.nameText) return;

        this.nameText = text;
        this.width = canvas.measureText(text);
        this.height = canvas.getLineHeight();
        const isResized = this.canvas.width !== this.width || this.canvas.height !== this.height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.center.set(1 - Math.trunc(this.width / 2) / this.width, 0);

        const context = this.canvas.getContext("2d");

        context.imageSmoothingEnabled = false;
        canvas.renderText(context, 0, 0, 0xffdcdcdc, text);
        if (isResized) {
            this.material.map.dispose();
            this.material.map = this.createTexture();
        } else this.material.map.needsUpdate = true;
    }
}

export default GroundItemLabel;
