import { CanvasTexture, DoubleSide, NearestFilter, NoColorSpace, Sprite, SpriteMaterial } from "three";
import { FontType_T } from "../nwindow/nwindow-canvas";
import type NWindowCanvas from "../nwindow/nwindow-canvas";

export class Nameplate extends Sprite {
    protected readonly canvas = document.createElement("canvas");
    protected nameText: string = null;
    protected titleText: string = null;
    protected nameColor = 0;
    protected titleColor = 0;
    protected bracket: string = null;
    public width = 0;
    public height = 0;

    public constructor() {
        super(new SpriteMaterial({ depthTest: true, depthWrite: false, sizeAttenuation: false, side: DoubleSide, toneMapped: false, fog: false }));

        (this as any).isNameplate = true;
        this.material.map = this.createTexture();
        this.frustumCulled = false;
    }

    protected createTexture() {
        const texture = new CanvasTexture(this.canvas);

        texture.minFilter = texture.magFilter = NearestFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = NoColorSpace;
        texture.repeat.x = -1; // ue2-conventions.ts mirrors the camera projection.
        texture.offset.x = 1;

        return texture;
    }

    public update(canvas: NWindowCanvas, name: string, title: string, nameColor: number, titleColor: number, bracket: string) {
        if (name === this.nameText && title === this.titleText && nameColor === this.nameColor && titleColor === this.titleColor && bracket === this.bracket) return;

        this.nameText = name;
        this.titleText = title;
        this.nameColor = nameColor;
        this.titleColor = titleColor;
        this.bracket = bracket;

        const nameWidth = canvas.measureText(name, FontType_T.LARGE), lineHeight = canvas.getLineHeight(FontType_T.LARGE);
        const top = title ? -lineHeight * 2 : -16;
        const bottom = Math.max(0, lineHeight - 15);

        this.width = Math.max(nameWidth + (bracket ? 38 : 0), title ? canvas.measureText(title, FontType_T.LARGE) : 0);
        this.height = bottom - top;
        const isResized = this.canvas.width !== this.width || this.canvas.height !== this.height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.center.set(0.5, bottom / this.height);

        const context = this.canvas.getContext("2d"), nameX = Math.trunc(this.width / 2) - Math.trunc(nameWidth / 2);

        context.imageSmoothingEnabled = false;
        canvas.renderText(context, nameX, -15 - top, nameColor, name, FontType_T.LARGE);
        if (title) canvas.renderText(context, Math.trunc(this.width / 2) - Math.trunc(canvas.measureText(title, FontType_T.LARGE) / 2), -lineHeight * 2 - top, titleColor, title, FontType_T.LARGE);
        if (bracket) {
            const texture = canvas.getTexture(bracket);

            context.drawImage(texture, 0, 0, 19, 16, nameX - 19, -16 - top, 19, 16);
            context.drawImage(texture, 0, 0, 19, 16, nameX + nameWidth, -16 - top, 19, 16);
        }
        if (isResized) {
            this.material.map.dispose();
            this.material.map = this.createTexture();
        } else this.material.map.needsUpdate = true;
    }

    public dispose() {
        this.removeFromParent();
        this.material.map.dispose();
        this.material.dispose();
    }

    public raycast() {}
}

export default Nameplate;
