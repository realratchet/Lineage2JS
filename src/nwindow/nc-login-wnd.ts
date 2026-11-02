import NDomLayer from "./ndom";
import NCAuthWnd from "./nc-auth-wnd";
import NCLoginFunctionWnd from "./nc-login-function-wnd";

const TEX_LOGO = "L2Font-e.start_logo-e"; // localization.ini [English] English_LogoTexture / English_MiniLogoTexture (read at 0x1009f7e0).
const TEX_MINI_LOGO = "L2Font-e.mini_logo-e";

export class NCLoginWnd { // NCLoginWnd: NCGodWnd::OnCreate 0x100910a0 places it at (0, 0, GodW, GodH - 52); paint 0x1009efd0.
    public static getTextures(): string[] { return [TEX_LOGO, TEX_MINI_LOGO, ...NCAuthWnd.getTextures(), ...NCLoginFunctionWnd.getTextures()]; }

    public readonly element: HTMLDivElement;
    public readonly auth: NCAuthWnd;
    public readonly loginFunction: NCLoginFunctionWnd;
    public onLogin: (account: string, password: string) => void = null;
    public onExit: () => void = null;

    protected readonly layer: NDomLayer;
    protected readonly logo: HTMLDivElement;

    public constructor(layer: NDomLayer) {
        this.layer = layer;
        this.element = layer.createWindow(0, 0, 0, 0);

        layer.tile(this.element, 0, 0, 232, 120, 0, 0, 232, 120, TEX_MINI_LOGO);
        this.logo = layer.tile(this.element, 0, 0, 256, 256, 0, 0, 256, 256, TEX_LOGO);

        this.auth = new NCAuthWnd(layer, this.element);
        this.loginFunction = new NCLoginFunctionWnd(layer, this.element);

        this.auth.onLogin = (account, password) => { if (this.onLogin) this.onLogin(account, password); };
        this.auth.onExit = () => { if (this.onExit) this.onExit(); };
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) {
        const width = screenWidth, height = screenHeight - 52;

        this.layer.place(this.element, 0, 0, width, height);
        this.layer.place(this.logo, Math.trunc(width * 0.5 - 128), Math.trunc(height * 0.05));
        this.auth.placeOnScreen(width, height);
        this.loginFunction.placeOnScreen(width, height);
    }

    public setVisible(isVisible: boolean, isAuthVisible: boolean = isVisible) { // Slot 75 0x1009e780: login mode shows Auth and Function; server selection keeps the logos and Function.
        this.element.hidden = !isVisible;
        this.auth.setVisible(isAuthVisible);
        this.loginFunction.setVisible(isVisible);
    }

    public setBusy(isBusy: boolean) { this.auth.setBusy(isBusy); }
}

export default NCLoginWnd;
