import type NDomLayer from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import { NCComboBox } from "./nc-lobby-wnd";
import { FontType_T } from "./nwindow-canvas";
import type { PackageTarget_T } from "../network/game-packets";

const TEX_BACK = "L2UI_ch3.DeliverWnd.Warehouse_back";

export class NCSelectDeliverWnd {
    public static getTextures() { return [TEX_BACK]; }
    public readonly element: HTMLDivElement;
    public onConfirm: (objectId: number) => void = null;
    protected readonly combo: NCComboBox;
    protected targets: PackageTarget_T[] = [];
    protected selected = -1;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 201);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        layer.tile(this.element, 0, 20, 256, 181, 0, 0, 256, 181, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(558), false, () => this.setVisible(false));
        layer.text(this.element, manager.getSystemMessage(664), 0xffdcdcdc, FontType_T.SMALL, 11, 32);
        this.combo = new NCComboBox(layer, this.element, 39, 61, 178, 17);
        this.combo.onChange = index => { this.selected = index; };
        layer.button(this.element, 51, 172, 76, 23, "L2UI_CH3.Button.Btn1_Normal", "L2UI_CH3.Button.Btn1_NormalOn", null, manager.getSysString(140), () => {
            if (this.selected < 0) return;

            if (this.onConfirm) this.onConfirm(this.targets[this.selected].objectId);
            this.setVisible(false);
        });
        layer.button(this.element, 131, 172, 76, 23, "L2UI_CH3.Button.Btn1_Normal", "L2UI_CH3.Button.Btn1_NormalOn", null, manager.getSysString(141), () => this.setVisible(false));
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (visible) return;

        this.targets = [];
        this.selected = -1;
        this.combo.setOpen(false);
        this.combo.setItems([]);
    }
    public show(targets: PackageTarget_T[]) {
        this.setVisible(false);
        this.targets = targets.slice(0, 8);
        this.combo.setItems(this.targets.map(target => target.name));
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
    }
}

export default NCSelectDeliverWnd;
