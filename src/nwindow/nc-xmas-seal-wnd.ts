import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";
import SysString_T from "./sys-string";

const TEX_BACK = "L2UI.MinimapWnd.MinimapBack";
const WIDTH = 334;
const HEIGHT = 354;

export class NCXMasSealWnd { // NCXMasSealWnd: NConsole 0x10063654 (W*0.5-178, H*0.5-167, 334x354, title sys2), OnCreate 0x10121020, paint 0x10120f50
    public static getTextures(): string[] { return [...NCFrameCtrl.getTextures(), TEX_BACK]; }

    public readonly element: HTMLDivElement;
    protected readonly illustration: HTMLDivElement;
    protected itemId = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, WIDTH, HEIGHT);
        this.element.hidden = true;
        NCFrameCtrl.createDOM(layer, this.element, WIDTH, manager.getSysString(SysString_T.Item), false, () => this.setVisible(false));
        layer.tile(this.element, 0, 20, WIDTH, 333, 0, 0, WIDTH, 333, TEX_BACK);
        this.illustration = layer.createWindow(3, 21, 328, 329, this.element);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 178), Math.trunc(height * 0.5 - 167)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }

    public async toggle(itemId: number) { // NConsole 0x1006c500: set item 0x101210f0, then toggle 0x1005c210
        const texture = this.layer.getManager().strings.itemInfos[itemId].meshTextures[0];

        this.itemId = itemId;
        this.illustration.replaceChildren();
        if (texture) {
            await this.layer.loadTextures([texture]);
            if (this.itemId === itemId) this.layer.tile(this.illustration, 0, 0, 328, 329, 0, 0, 328, 329, texture);
        }

        this.setVisible(!this.isVisible());
    }
}

export default NCXMasSealWnd;
