import NDomLayer from "./ndom";
import NCHtmlViewer from "./nc-html-viewer";
import { FontType_T } from "./nwindow-canvas";

const TITLE_COLOR = 0xffc8d2dc;
const WIDTH = 310;
const HEIGHT = 401;
const TITLE_HEIGHT = 20;
const TITLE_SYSSTRING = 0x1bc;
const TEX_BACK = "L2UI_ch3.NpcWnd.Npc1_back";
const TEX_FRAME_LEFT = "L2UI_CH3.FrameCtrl.FrameBackLeft";
const TEX_FRAME_MID = "L2UI_CH3.FrameCtrl.FrameBackMid";
const TEX_FRAME_RIGHT = "L2UI_CH3.FrameCtrl.FrameBackRight";
const TEX_CLOSE = "L2UI_CH3.FrameCtrl.FrameCloseBtn";
const TEX_CLOSE_DOWN = "L2UI_CH3.FrameCtrl.FrameCloseOnBtn";

export class NCNPCHtmlViewer { // NCNPCHtmlViewer (vtable 0x101a8b70): NCConsole 0x100608f4 chat instance 310x401, OnCreate 0x1003f510, paint 0x1003c840.
    public static getTextures(): string[] { return [TEX_BACK, TEX_FRAME_LEFT, TEX_FRAME_MID, TEX_FRAME_RIGHT, TEX_CLOSE, TEX_CLOSE_DOWN, `?${TEX_CLOSE}_over`, ...NCHtmlViewer.getTextures()]; }

    public readonly element: HTMLDivElement;
    public onBypass: (command: string) => void = null;
    public onLink: (path: string) => void = null;
    public onFile: (path: string) => void = null;
    public onClose: () => void = null;
    protected readonly layer: NDomLayer;
    protected readonly frame: HTMLDivElement;
    protected readonly viewer: NCHtmlViewer;
    protected titleText: HTMLCanvasElement = null;
    protected readonly titleId: number;

    public constructor(layer: NDomLayer, height = HEIGHT, titleId = TITLE_SYSSTRING, background = TEX_BACK) {
        this.layer = layer;
        this.titleId = titleId;

        this.element = layer.createWindow(0, 0, WIDTH, height);
        this.element.hidden = true;
        layer.tile(this.element, 0, TITLE_HEIGHT, WIDTH, height - TITLE_HEIGHT, 0, 0, WIDTH, height - TITLE_HEIGHT, background);

        this.frame = layer.createWindow(0, 0, WIDTH, TITLE_HEIGHT, this.element); // NCFrameCtrl ctor(1,0,0) at (0,0,W,20), paint 0x10011caa..0x10011d14.
        layer.tile(this.frame, 0, 0, 16, TITLE_HEIGHT, 0, 0, 16, TITLE_HEIGHT, TEX_FRAME_LEFT);
        layer.tile(this.frame, 16, 0, WIDTH - 32, TITLE_HEIGHT, 0, 0, 32, TITLE_HEIGHT, TEX_FRAME_MID);
        layer.tile(this.frame, WIDTH - 16, 0, 16, TITLE_HEIGHT, 0, 0, 16, TITLE_HEIGHT, TEX_FRAME_RIGHT);
        this.setTitle(layer.getManager().getSysString(titleId));

        const close = layer.button(this.frame, WIDTH - 23, 3, 15, 15, TEX_CLOSE, TEX_CLOSE_DOWN, null, null, () => {
            layer.getManager().playWindowCloseSound();
            this.hide();

            if (this.onClose) this.onClose();
        });
        close.setAttribute("aria-label", "Close");

        this.frame.addEventListener("mousedown", event => { if (event.button === 0 && !close.contains(event.target as Node)) this.beginDrag(event); });

        this.viewer = new NCHtmlViewer(layer, this.element, 7, 30, WIDTH - 14, height - 37);
        this.viewer.onBypass = command => { if (this.onBypass) this.onBypass(command); };
        this.viewer.onLink = path => { if (this.onLink) this.onLink(path); };
        this.viewer.onFile = path => { if (this.onFile) this.onFile(path); };
        this.viewer.onHide = () => this.hide();
    }

    protected setTitle(title: string) { // Title text 0x10011d84: x=20, y=int(H/2 - textH/2 + 2).
        if (this.titleText) this.titleText.remove();

        const lineHeight = this.layer.getManager().canvas.getLineHeight(FontType_T.SMALL);

        this.titleText = title ? this.layer.text(this.frame, title, TITLE_COLOR, FontType_T.SMALL, 20, Math.trunc(TITLE_HEIGHT / 2 - lineHeight / 2 + 2)) : null;
    }

    protected beginDrag(event: MouseEvent) {
        event.preventDefault();
        this.layer.dragWindow(this.element, event);
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) { this.layer.place(this.element, 0, Math.trunc(screenHeight * 0.5 - 252)); } // NCConsole 0x100608f4: SetWindowPos(0, int(H*0.5 - 252), 310, 401).

    public async show(html: string) {
        this.element.hidden = false;
        this.layer.activate(this.element);
        await this.viewer.setHtml(html);
        this.setTitle(this.viewer.title || this.layer.getManager().getSysString(this.titleId));
    }

    public async showPacket(html: string, caption: string) {
        this.element.hidden = false;
        this.layer.activate(this.element);
        if (caption) this.setTitle(caption);
        if (html) await this.viewer.setHtml(html);
    }

    public isVisible() { return !this.element.hidden; }
    public tick(deltaSeconds: number) { this.viewer.tick(deltaSeconds); }
    public hide() { this.element.hidden = true; }
    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }
}

export default NCNPCHtmlViewer;
