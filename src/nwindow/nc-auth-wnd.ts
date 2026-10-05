import NDomLayer, { NDOM_EDIT_TEXTURES, NDomButton_T, NDomEdit_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";

const TEXT_COLOR = 0xffdcdcdc;
const TEX_BACK = "L2UI_CH3.LoginWnd.logon_back";
const TEX_BUTTON = "L2UI_CH3.BUTTON.bigbutton";
const TEX_BUTTON_DOWN = "L2UI_CH3.BUTTON.bigbutton_down";
const SEND_RESET_INTERVAL = 1000;

export class NCAuthWnd { // NCAuthWnd: 256x108, OnCreate 0x1009f230, paint 0x1009ea90.
    public static getTextures(): string[] { return [TEX_BACK, TEX_BUTTON, TEX_BUTTON_DOWN, `?${TEX_BUTTON}_over`, ...NDOM_EDIT_TEXTURES]; }

    public readonly element: HTMLDivElement;
    public onLogin: (account: string, password: string) => void = null;
    public onExit: () => void = null;
    public onError: (text: string) => void = null;

    protected readonly layer: NDomLayer;
    protected readonly accountEdit: NDomEdit_T;
    protected readonly passwordEdit: NDomEdit_T;
    protected readonly loginButton: NDomButton_T;
    protected isSent = false;
    protected isBusy = false;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        const manager = layer.getManager();
        const id = manager.getSysString(150), pwd = manager.getSysString(151);

        this.layer = layer;
        this.element = layer.createWindow(0, 0, 256, 108, parent);

        layer.tile(this.element, 0, 0, 256, 108, 0, 0, 256, 108, TEX_BACK);
        layer.text(this.element, id, TEXT_COLOR, FontType_T.SMALL, 78 - layer.measureText(id), 23);
        layer.text(this.element, pwd, TEXT_COLOR, FontType_T.SMALL, 78 - layer.measureText(pwd), 45);

        this.accountEdit = layer.edit(this.element, 84, 20, 128, 17, false);
        this.passwordEdit = layer.edit(this.element, 84, 42, 128, 17, true);

        this.loginButton = layer.button(this.element, 31, 72, 96, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(152), () => this.login());
        layer.button(this.element, 131, 72, 96, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(153), () => { if (this.onExit) this.onExit(); });

        this.accountEdit.input.addEventListener("keydown", event => { // Tab links ID<->PW (0x1009f53b); only the password edit notifies Enter (0x100bf260).
            if (event.key !== "Tab") return;

            event.preventDefault();
            this.passwordEdit.focus();
        });
        this.passwordEdit.input.addEventListener("keydown", event => {
            if (event.key === "Tab") {
                event.preventDefault();
                this.accountEdit.focus();
            } else if (event.key === "Enter") {
                this.layer.getManager().playButtonSound(true);
                this.login();
            }
        });

        window.setInterval(() => { this.isSent = false; }, SEND_RESET_INTERVAL); // Timer 0xaff12013 (0x1009f25d) clears the sent flag [+0x110] every 1000 ms.
    }

    public placeOnScreen(parentWidth: number, parentHeight: number) {
        this.layer.place(this.element, Math.trunc(parentWidth * 0.5 - 128), Math.trunc(parentHeight * 0.5 - 54));
    }

    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;

        if (isVisible) this.accountEdit.focus();
    }

    public setBusy(isBusy: boolean) {
        this.isBusy = isBusy;
        this.loginButton.setEnabled(!isBusy);
    }

    public clear() {
        this.accountEdit.setValue("");
        this.passwordEdit.setValue("");
    }

    public getAccount() { return this.accountEdit.getValue(); }

    protected login() { // OnLogin 0x1009e3d0 (mode 0).
        const account = this.accountEdit.getValue(), password = this.passwordEdit.getValue();
        const manager = this.layer.getManager();

        if (this.isBusy) return;

        if (!account) {
            if (this.onError) this.onError(manager.getSystemMessage(86));
            return;
        }

        if (!password) {
            if (this.onError) this.onError(manager.getSystemMessage(87));
            return;
        }

        if (this.isSent) return;

        this.isSent = true;

        if (this.onLogin) this.onLogin(account, password);
    }
}

export default NCAuthWnd;
