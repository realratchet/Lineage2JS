import type NDomLayer from "./ndom";

const TEX_LOGO = "L2Font-e.replay_logo-e";
const TEX_MINI_LOGO = "L2Font-e.mini_logo-e";

export class NCReplayLogoWnd {
    public static getTextures() { return [TEX_LOGO, TEX_MINI_LOGO]; }
    public readonly element: HTMLDivElement;
    protected readonly logo: HTMLDivElement;
    protected readonly miniLogo: HTMLDivElement;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 0, 0, 0);
        this.element.classList.add("ndom-opaque");
        this.element.hidden = true;
        this.element.style.pointerEvents = "none";
        this.element.setAttribute("aria-hidden", "true");
        layer.setBackground(this.element);
        this.logo = layer.tile(this.element, 0, 0, 256, 64, 0, 0, 256, 64, TEX_LOGO);
        this.miniLogo = layer.tile(this.element, 0, 0, 232, 120, 0, 0, 232, 120, TEX_MINI_LOGO);
    }

    public placeOnScreen(width: number, height: number) {
        const scale = Math.max(width / 1024, height / 768), logoScale = Math.fround(scale * 0.7), miniScale = Math.fround(scale * 0.8);
        const margin = Math.trunc(logoScale * 30);

        this.layer.place(this.element, 0, 0, width, height);
        this.layer.placeTile(this.logo, margin, margin, Math.trunc(logoScale * 256), Math.trunc(logoScale * 64), 0, 0, 256, 64, TEX_LOGO);
        this.layer.placeTile(this.miniLogo, Math.trunc(width - miniScale * 256), Math.trunc(height - miniScale * 120), Math.trunc(miniScale * 232), Math.trunc(miniScale * 120), 0, 0, 232, 120, TEX_MINI_LOGO);
    }

    public setVisible(visible: boolean) { this.element.hidden = !visible; }
}

export default NCReplayLogoWnd;
