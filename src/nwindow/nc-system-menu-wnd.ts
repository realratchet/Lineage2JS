import type NDomLayer from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import { FontType_T } from "./nwindow-canvas";

const TEX_BACK = "L2UI_CH3.SystemMenuWnd.systemmenu_back";
const TEXT_COLOR = 0xffdcdcdc;
const WIDTH = 172;
const HEIGHT = 295;
const arrIcons = Array.from({ length: 7 }, (_, i) => `L2UI_CH3.SystemMenuWnd.systemicon${i + 1}`);
const arrLabels: [number, string][] = [[387, "(Alt+B)"], [711, "(Alt+R)"], [145, null], [470, null], [146, null], [147, null], [148, null]]; // paint 0x100b6ca0: sysstring "%s %s" with the hotkey suffix.

export type SystemMenuItem_T = "community" | "macro" | "help" | "petition" | "options" | "restart" | "exit";

const arrItems: SystemMenuItem_T[] = ["community", "macro", "help", "petition", "options", "restart", "exit"];

export class NCSystemMenuWnd { // NCSystemMenuWnd (vtable 0x101bd030): NCConsole 0x10061869 SetWindowPos(W-172, H-295-46, 172, 295), style 0x3002; OnCreate 0x100b7860.
    public static getTextures() { return [TEX_BACK, ...arrIcons.flatMap(path => [path, `${path}_down`, `?${path}_over`]), ...NCFrameCtrl.getTextures()]; }
    public readonly element: HTMLDivElement;
    public onSelect: (item: SystemMenuItem_T) => void = null;
    protected readonly layer: NDomLayer;

    public constructor(layer: NDomLayer) {
        const manager = layer.getManager();

        this.layer = layer;
        this.element = layer.createWindow(0, 0, WIDTH, HEIGHT);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, WIDTH, HEIGHT - 20, 0, 0, WIDTH, HEIGHT - 20, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, WIDTH, manager.getSysString(446), true);

        arrIcons.forEach((path, index) => { // icon buttons 36x36 at (13, 29 + 37i), labels at (51, 43 + 37i).
            const [labelId, suffix] = arrLabels[index];
            const label = suffix ? `${manager.getSysString(labelId)} ${suffix}` : manager.getSysString(labelId);
            const button = layer.button(this.element, 13, 29 + index * 37, 36, 36, path, `${path}_down`, null, null, () => { if (this.onSelect) this.onSelect(arrItems[index]); });

            button.setAttribute("role", "button");
            button.setAttribute("aria-label", label);
            layer.text(this.element, label, TEXT_COLOR, FontType_T.SMALL, 51, 43 + index * 37);
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - WIDTH, height - HEIGHT - 46); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }
}

export default NCSystemMenuWnd;
