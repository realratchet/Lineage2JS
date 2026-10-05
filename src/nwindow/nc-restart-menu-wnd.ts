import NWnd from "./nwnd";
import NCButton from "./nc-button";
import type NWindowCanvas from "./nwindow-canvas";

const TEX_BACK = "L2UI_CH3.SystemMenuWnd.system2_back";
const TEX_BUTTON = "L2UI_CH3.button.bigbutton";
const TEX_BUTTON_DOWN = "L2UI_CH3.button.bigbutton_down";

const BUTTON_LABELS = [0x174, 0x176, 0x177, 0x175, 0x1d1]; // village, hideaway, castle, siege HQ, fixed (0x100b7518..0x100b77f4); index is the restart type sent.
const BUTTON_Y = [6, 30, 54, 78, 102];

export class NCRestartMenuWnd extends NWnd { // NCRestartMenuWnd: NCConsole 0x10064824 SetWindowPos(W/2 - 64, H/2 - 64, 128, 128); paint 0x100b6aa0.
    protected readonly buttons: NCButton[] = [];

    public onRestart: (type: number) => void = null;

    public constructor() {
        super(0, 0, 128, 128);

        for (let i = 0; i < BUTTON_LABELS.length; i++) {
            const button = this.addChild(new NCButton(16, BUTTON_Y[i], 96, 23, TEX_BUTTON, TEX_BUTTON_DOWN));

            button.onPress = () => this.restart(i);
            this.buttons.push(button);
        }

        this.isVisible = false;
    }

    public getTextures(): string[] { return [TEX_BACK]; }

    public placeOnScreen(screenWidth: number, screenHeight: number) {
        this.x = Math.trunc(screenWidth * 0.5 - 64);
        this.y = Math.trunc(screenHeight * 0.5 - 64);
    }

    public setOptions(available: boolean[]) { // 0x100b6280 / 0x100b6200: unavailable buttons are hidden, the rest keep their slots.
        for (let i = 0; i < this.buttons.length; i++)
            this.buttons[i].setVisible(available[i]);
    }

    protected restart(type: number) { // 0x100b62c0..0x100b6500: send the type, then hide.
        if (this.onRestart) this.onRestart(type);

        this.setVisible(false);
    }

    public onPaint(canvas: NWindowCanvas) {
        for (let i = 0; i < this.buttons.length; i++)
            this.buttons[i].label = this.manager.getSysString(BUTTON_LABELS[i]);

        canvas.clip(0, 0, this.width, this.height); // 0x100b6b15 draws a 141x131 rect; only the part inside the window is decoded.
        canvas.drawTile(0, 0, 141, 131, 0, 0, 141, 131, TEX_BACK);
        canvas.unclip();
    }
}

export default NCRestartMenuWnd;
