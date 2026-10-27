import NDomLayer from "./ndom";
import { SKIN_SLOTS } from "./skin-textures";
import SysString_T from "./sys-string";

const TEX_BACK = "L2UI_CH3.etc.broadcast_back";
const TEX_STRIP = "L2UI_CH3.FrameCtrl.smallbar";

export class NCObserverWnd {
    public static getTextures() { return [TEX_BACK, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, ...[1, 2, 3].map(index => `${TEX_STRIP}${index}`)]; }
    public readonly element: HTMLDivElement;
    public onReturn: () => void = null;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 0, 102, 32);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        layer.tile(this.element, 12, 0, 90, 32, 0, 0, 90, 32, TEX_BACK);
        const frame = layer.createWindow(0, 0, 12, 32, this.element);

        layer.tile(frame, 0, 0, 12, 8, 0, 0, 12, 8, `${TEX_STRIP}1`);
        layer.tile(frame, 0, 8, 12, 16, 0, 0, 12, 8, `${TEX_STRIP}2`);
        layer.tile(frame, 0, 24, 12, 8, 0, 0, 12, 8, `${TEX_STRIP}3`);
        frame.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            layer.dragWindow(this.element, event);
        });
        const label = layer.getManager().getSysString(SysString_T.Return);

        layer.button(this.element, 19, 5, 76, 23, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, null, label, () => { if (this.onReturn) this.onReturn(); }).setAttribute("aria-label", label);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 51), 0); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }
    public focus() {
        this.layer.activate(this.element);
        this.element.focus();
    }
}

export default NCObserverWnd;
