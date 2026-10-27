import NDomLayer from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCHtmlViewer from "./nc-html-viewer";
import SysString_T from "./sys-string";

const WIDTH = 310;
const HEIGHT = 401;
const TITLE_SYSSTRING = SysString_T.Tutorial;
const TEX_BACK_TOP = "l2ui_ch3.tutorialwnd.tutorial_back1";
const TEX_BACK_MID = "l2ui_ch3.tutorialwnd.tutorial_back2";
const TEX_BACK_BOTTOM = "l2ui_ch3.tutorialwnd.tutorial_back3";

export class NCTutorialViewerWnd { // NConsole OnCreate 0x100624c0 creates it at (W-330, 20, 310x401); OnCreate 0x1011f4c0, OnPaint 0x1011ed80.
    public static getTextures(): string[] { return [TEX_BACK_TOP, TEX_BACK_MID, TEX_BACK_BOTTOM, ...NCFrameCtrl.getTextures(), ...NCHtmlViewer.getTextures()]; }

    public readonly element: HTMLDivElement;
    public onLink: (link: string) => void = null;
    public onPassCmd: (command: string) => void = null;
    public onFile: (path: string) => void = null;
    protected readonly viewer: NCHtmlViewer;

    public constructor(protected readonly layer: NDomLayer) {
        const middle = HEIGHT - 20 - 12 - 9, count = Math.trunc(middle / 12);

        this.element = layer.createWindow(0, 0, WIDTH, HEIGHT);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, WIDTH, 12, 0, 0, WIDTH, 12, TEX_BACK_TOP);
        for (let i = 0; i < count; i++) layer.tile(this.element, 0, 32 + i * 12, WIDTH, 12, 0, 0, WIDTH, 12, TEX_BACK_MID);
        layer.tile(this.element, 0, 32 + count * 12, WIDTH, middle - count * 12, 0, 0, WIDTH, middle - count * 12, TEX_BACK_MID);
        layer.tile(this.element, 0, HEIGHT - 9, WIDTH, 9, 0, 0, WIDTH, 9, TEX_BACK_BOTTOM);
        NCFrameCtrl.createDOM(layer, this.element, WIDTH, layer.getManager().getSysString(TITLE_SYSSTRING), false, () => this.hide());

        this.viewer = new NCHtmlViewer(layer, this.element, 8, 32, WIDTH - 8 - 7, middle);
        this.viewer.onLink = link => { if (this.onLink) this.onLink(link); }; // NCTutorialHtmlViewer 0x102c89e0: LINK 0x1005cc8e, BYPASS 0x1007276c
        this.viewer.onBypass = command => { if (this.onPassCmd) this.onPassCmd(command); };
        this.viewer.onFile = path => { if (this.onFile) this.onFile(path); };
        this.viewer.onHide = () => this.hide();
    }

    public placeOnScreen(screenWidth: number, _screenHeight: number) { this.layer.place(this.element, Math.trunc(screenWidth - WIDTH - 20), 20); }

    public async show(html: string) { // NConsole::ShowTutorialHtml 0x10068d70
        this.element.hidden = false;
        this.layer.activate(this.element);
        await this.viewer.setHtml(html);
    }

    public isVisible() { return !this.element.hidden; }
    public tick(deltaSeconds: number) { this.viewer.tick(deltaSeconds); }
    public hide() { this.element.hidden = true; }
    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }
}

export default NCTutorialViewerWnd;
