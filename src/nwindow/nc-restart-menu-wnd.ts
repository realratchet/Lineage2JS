import type NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";
import { SKIN_SLOTS } from "./skin-textures";

const TEX_BACK = "L2UI_CH3.SystemMenuWnd.system2_back";
const TEX_BUTTON = SKIN_SLOTS.bigButton;
const TEX_BUTTON_DOWN = SKIN_SLOTS.bigButtonDown;

const BUTTON_LABELS = [0x174, 0x176, 0x177, 0x175, 0x1d1]; // village, hideaway, castle, siege HQ, fixed (0x100b7518..0x100b77f4); index is the restart type sent.
const BUTTON_Y = [6, 30, 54, 78, 102];

export class NCRestartMenuWnd { // NCRestartMenuWnd: NCConsole 0x10064824 SetWindowPos(W/2 - 64, H/2 - 64, 128, 128); paint 0x100b6aa0.
    public static getTextures(): string[] { return [TEX_BACK, TEX_BUTTON, TEX_BUTTON_DOWN, `?${TEX_BUTTON}_over`]; }

    public readonly element: HTMLDivElement;
    protected readonly buttons: NDomButton_T[] = [];
    protected isActive = false;

    public onRestart: (type: number) => void = null;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 128, 128);
        this.element.hidden = true;
        this.element.style.overflow = "hidden";
        layer.tile(this.element, 0, 0, 141, 131, 0, 0, 141, 131, TEX_BACK); // 0x100b6b15 draws a 141x131 rect; only the part inside the window is decoded.

        for (let i = 0; i < BUTTON_LABELS.length; i++)
            this.buttons.push(layer.button(this.element, 16, BUTTON_Y[i], 96, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(BUTTON_LABELS[i]), () => this.restart(i)));
    }

    public isVisible() { return !this.element.hidden; }
    public getIsActive() { return this.isActive; }
    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }

    public placeOnScreen(screenWidth: number, screenHeight: number) { this.layer.place(this.element, Math.trunc(screenWidth * 0.5 - 64), Math.trunc(screenHeight * 0.5 - 64)); }

    public setOptions(available: boolean[]) { // 0x100b6280 / 0x100b6200: unavailable buttons are hidden, the rest keep their slots.
        for (let i = 0; i < this.buttons.length; i++)
            this.buttons[i].hidden = !available[i];
        this.isActive = true;
    }

    protected restart(type: number) { // 0x100b62c0..0x100b6500: send the type, then hide.
        if (this.onRestart) this.onRestart(type);

        this.setVisible(false);
        this.isActive = false;
    }
}

export default NCRestartMenuWnd;
