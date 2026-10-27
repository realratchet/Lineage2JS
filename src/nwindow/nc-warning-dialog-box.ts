import NCDialogBox, { DialogType_T } from "./nc-dialog-box";
import type NDomLayer from "./ndom";
import SysString_T from "./sys-string";

export class NCWarningDialogBox extends NCDialogBox { // CWarningDialogBox 0x101a12e0: Show 0x100083f0, Hide 0x10008480, OK 0x10009050.
    public onExit: () => void = null;
    protected isExit = false;

    public constructor(layer: NDomLayer) {
        super(layer);

        this.type = DialogType_T.OK;
        this.okButton.setLabel(layer.getManager().getSysString(SysString_T.OK));
        layer.place(this.okButton, 90, 75);
        this.cancelButton.hidden = true;
    }

    public showWarning(text: string, isExit = false) {
        if (isExit) this.isExit = true;
        if (text === null) return;

        this.renderText(text);
        this.element.hidden = false;
        this.layer.setModal(this.element, true);
        this.element.focus();
    }

    public hide() {
        if (!this.layer.getModalWindows().includes(this.element)) this.element.hidden = true;
    }

    protected onKeyDown(_event: KeyboardEvent) { } // CWarningDialogBox uses CWnd 0x10034ad0, without Gara's Enter action.

    protected forceHide() { // CWarningDialogBox 0x100083d0 always calls EndModal after base Hide.
        const isModal = this.layer.getModalWindows().includes(this.element);

        super.hide();
        if (!isModal) this.layer.setModal(this.element, false);
    }

    protected close(_isOk: boolean) {
        if (this.isExit) {
            if (!this.onExit) throw new Error(`Warning exit handler is not installed.`);

            this.onExit();
            return;
        }
        this.forceHide();
        this.isExit = false;
    }
}

export default NCWarningDialogBox;
