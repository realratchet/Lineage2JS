import type NDomLayer from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import type { TownMap_T } from "../network/game-packets";
import SysString_T from "./sys-string";

const TEX_BACK = "L2UI.MinimapWnd.MinimapBack";
const TEX_MARKER = "town_map.icon_i00";

export class NTownMapWnd {
    public static getTextures() { return [TEX_BACK, TEX_MARKER, ...NCFrameCtrl.getTextures()]; }
    public readonly element: HTMLDivElement;
    protected readonly viewport: HTMLDivElement;
    protected readonly map: HTMLDivElement;
    protected readonly image: HTMLDivElement;
    protected readonly marker: HTMLDivElement;
    protected texture: string = null;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 0, 334, 354);
        this.element.hidden = true;
        this.viewport = layer.createWindow(3, 21, 328, 328, this.element);
        this.viewport.style.overflow = "hidden";
        this.map = layer.createWindow(0, 0, 512, 512, this.viewport);
        this.map.style.overflow = "hidden";
        this.image = layer.createWindow(0, 0, 512, 512, this.map);
        this.image.className = "ndom-tile";
        this.marker = layer.tile(this.map, 0, 0, 32, 32, 0, 0, 32, 32, TEX_MARKER);
        this.marker.style.pointerEvents = "none";
        const back = layer.tile(this.element, 0, 21, 334, 333, 0, 0, 334, 333, TEX_BACK);

        back.style.pointerEvents = "none";
        NCFrameCtrl.createDOM(layer, this.element, 334, layer.getManager().getSysString(SysString_T.Map));
        this.viewport.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            const x = layer.toUI(event.clientX) + this.viewport.scrollLeft, y = layer.toUI(event.clientY) + this.viewport.scrollTop;

            layer.beginDrag(e => { this.viewport.scrollLeft = x - layer.toUI(e.clientX); this.viewport.scrollTop = y - layer.toUI(e.clientY); }, () => layer.getManager().setCursor(""));
            layer.getManager().setCursor(layer.getManager().getCursor(3));
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }

    public async show(info: TownMap_T) {
        this.texture = info.texture;
        this.map.hidden = this.marker.hidden = true;
        this.setVisible(true);
        this.layer.activate(this.element);
        await this.layer.loadTextures([info.texture]);

        if (this.texture !== info.texture) return;

        // NTownMapWnd::SetMap 0x100b8d40: fixed512 map, invalid marker coordinates become0.
        const x = info.x >= 0 && info.x <= 512 ? info.x : 0, y = info.y >= 0 && info.y <= 512 ? info.y : 0;

        this.layer.setTile(this.image, 512, 512, 0, 0, 512, 512, info.texture);
        this.layer.place(this.marker, x, y);
        this.map.hidden = this.marker.hidden = false;
        this.viewport.scrollLeft = Math.max(0, Math.min(184, x - 164));
        this.viewport.scrollTop = Math.max(0, Math.min(184, y - 164));
    }
}

export default NTownMapWnd;
