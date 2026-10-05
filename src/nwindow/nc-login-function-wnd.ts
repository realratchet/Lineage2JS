import NDomLayer from "./ndom";

const TEX_BACK = "L2UI_CH3.LobbyWnd.lobby_menuback";
const TEX_BUTTON = "L2UI_CH3.Button.BigButton";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.BigButton_down";

const BUTTON_LABELS = [154, 155, 156, 805, 1251]; // New Account, Lost Account, Options, Production Team, Replay (OnCreate 0x1009d9a0).
const BUTTON_Y = [8, 33, 58, 83, 107];

export class NCLoginFunctionWnd { // NCLoginFunctionWnd: 120x138, paint 0x1009d760, OnCommand 0x1009d360.
    public static getTextures(): string[] { return [TEX_BACK, TEX_BUTTON, TEX_BUTTON_DOWN, `?${TEX_BUTTON}_over`]; }

    public readonly element: HTMLDivElement;
    public onOption: (index: number) => void = null;

    protected readonly layer: NDomLayer;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        const manager = layer.getManager();

        this.layer = layer;
        this.element = layer.createWindow(0, 0, 120, 138, parent);

        layer.tile(this.element, 0, 0, 120, 138, 0, 0, 120, 138, TEX_BACK);

        BUTTON_LABELS.forEach((label, index) => {
            layer.button(this.element, 13, BUTTON_Y[index], 96, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(label), () => { if (this.onOption) this.onOption(index); });
        });
    }

    public placeOnScreen(parentWidth: number, parentHeight: number) { // SetAnchor(9 bottom-right, -34, -10) at 0x1009fdc8.
        this.layer.place(this.element, parentWidth - 120 - 34, parentHeight - 138 - 10);
    }

    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }
}

export default NCLoginFunctionWnd;
