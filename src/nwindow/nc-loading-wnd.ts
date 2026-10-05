import type { NDomLayer } from "./ndom";

const TEX_LOADING = "L2Font-e.loading02-e"; // SetLoading 0x1009a600: localization.ini [English] English_LoadingTexture.

export class NCLoadingWnd { // NCLoadingWnd OnPaint 0x1009a7b0: the 1024x768 loading texture stretched over the whole screen, nothing else.
    public static getTextures(): string[] { return [TEX_LOADING]; }

    public readonly element: HTMLDivElement;
    protected readonly layer: NDomLayer;
    protected readonly image: HTMLDivElement;

    public constructor(layer: NDomLayer) {
        this.layer = layer;
        this.element = layer.createWindow(0, 0, 0, 0);
        this.image = layer.tile(this.element, 0, 0, 1024, 768, 0, 0, 1024, 768, TEX_LOADING);
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) {
        this.layer.place(this.element, 0, 0, screenWidth, screenHeight);
        this.layer.place(this.image, 0, 0, screenWidth, screenHeight);
        this.layer.setTile(this.image, screenWidth, screenHeight, 0, 0, 1024, 768, TEX_LOADING);
    }

    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }
}

export default NCLoadingWnd;
