import NDomLayer from "./ndom";

const TEX_BACK = "L2UI_CH3.Olympiad.olympiad_back";
const TEX_BUTTON = "L2UI_CH3.Button.btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.btn1_normalon";
const TEX_STRIP = "L2UI_CH3.FrameCtrl.smallbar";

export class NCOlympiadControlWnd {
    public static getTextures() { return [TEX_BACK, TEX_BUTTON, TEX_BUTTON_DOWN, ...[1, 2, 3].map(index => TEX_STRIP + index)]; }
    public readonly element: HTMLDivElement;
    public onStopObserving: () => void = null;
    public onOtherGame: () => void = null;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 0, 102, 56);
        this.element.hidden = true;
        this.element.setAttribute("role", "dialog");
        this.element.setAttribute("aria-label", "");
        layer.tile(this.element, 12, 0, 90, 56, 0, 0, 90, 56, TEX_BACK);
        const frame = layer.createWindow(0, 0, 12, 56, this.element);

        layer.tile(frame, 0, 0, 12, 8, 0, 0, 12, 8, TEX_STRIP + "1");
        layer.tile(frame, 0, 8, 12, 48, 0, 0, 12, 8, TEX_STRIP + "2");
        layer.tile(frame, 0, 48, 12, 8, 0, 0, 12, 8, TEX_STRIP + "3");
        frame.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            const x = layer.toUI(event.clientX) - this.element.offsetLeft, y = layer.toUI(event.clientY) - this.element.offsetTop;

            layer.beginDrag(moveEvent => layer.place(this.element, layer.toUI(moveEvent.clientX) - x, layer.toUI(moveEvent.clientY) - y));
        });
        layer.button(this.element, 19, 5, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, layer.getManager().getSysString(611), () => { if (this.onStopObserving) this.onStopObserving(); });
        layer.button(this.element, 19, 29, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, layer.getManager().getSysString(1252), () => { if (this.onOtherGame) this.onOtherGame(); });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 38), 0); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }
}

export default NCOlympiadControlWnd;
