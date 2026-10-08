import type NDomLayer from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCTooltip from "./nc-tooltip";
import type { QuestLocation_T } from "./nc-quest-wnd";

const TEX_BACK = "L2UI_CH3.Minimap.MapBack";
const TEX_MARKER = "L2UI.MinimapWnd.MinimapPos";
const TEX_SHADOW = "L2UI_CH3.Minimap.MapShadow";
const TEX_QUEST = "L2UI_CH3.Minimap.MapIcon_Mark";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_Normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_NormalOn";
const arrMaps = Array.from({ length: 6 }, (_, i) => `L2Font-e.Minimap.ch4_worldmap${i + 1}`);

export class NCMapWnd {
    public static getTextures() { return [TEX_BACK, TEX_MARKER, TEX_SHADOW, TEX_QUEST, TEX_BUTTON, TEX_BUTTON_DOWN, ...arrMaps, ...NCFrameCtrl.getTextures(), ...new NCTooltip().getTextures()]; }
    public readonly element: HTMLDivElement;
    protected readonly layer: NDomLayer;
    protected readonly viewport: HTMLDivElement;
    protected readonly marker: HTMLDivElement;
    protected readonly questMarker: HTMLDivElement;
    protected questLocation: QuestLocation_T = null;
    protected questCaption: HTMLDivElement = null;
    protected questX = 0;
    protected questY = 0;
    protected mouseX = -1;
    protected mouseY = -1;
    protected positionX = 0;
    protected positionY = 0;

    public constructor(layer: NDomLayer) {
        this.layer = layer;
        this.element = layer.createWindow(0, 0, 334, 383);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 334, 363, 0, 0, 334, 363, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 334, "Map");
        this.viewport = layer.createWindow(3, 21, 328, 328, this.element);
        this.viewport.style.overflow = "hidden";
        this.viewport.tabIndex = 0;
        this.viewport.setAttribute("aria-label", "World map. Use arrow keys or drag to pan.");

        // NCMinimapWnd bounds 0x1025cce0 / 0x1025cd28 exclude the tiles' padded right/bottom edges.
        const map = layer.createWindow(0, 0, 1804, 2624, this.viewport);

        map.style.overflow = "hidden";

        // NCMinimapWnd::OnPaint 0x100bbf6b: two columns, three rows of 1024px tiles.
        arrMaps.forEach((path, index) => layer.tile(map, index % 2 * 1024, Math.trunc(index / 2) * 1024, 1024, 1024, 0, 0, 1024, 1024, path));
        this.marker = layer.tile(map, 0, 0, 32, 32, 0, 0, 32, 32, TEX_MARKER);
        this.questMarker = layer.tile(map, 0, 0, 32, 32, 0, 0, 32, 32, TEX_QUEST);
        this.questMarker.hidden = true;
        this.questMarker.style.pointerEvents = "none";
        this.marker.title = "You are here";
        this.marker.setAttribute("aria-label", "Your position");
        layer.tile(this.element, 3, 331, 329, 23, 0, 0, 329, 23, TEX_SHADOW).style.pointerEvents = "none";

        const label = layer.getManager().getSysString(887);
        const center = () => this.centerPosition();
        const current = layer.button(this.element, 249, 355, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, label, center);

        current.tabIndex = 0;
        current.setAttribute("role", "button");
        current.setAttribute("aria-label", label);
        current.addEventListener("keydown", event => {
            if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            layer.getManager().playButtonSound(true);
            center();
        });
        this.viewport.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            this.viewport.focus();

            const x = layer.toUI(event.clientX) + this.viewport.scrollLeft, y = layer.toUI(event.clientY) + this.viewport.scrollTop;
            layer.beginDrag(e => { this.viewport.scrollLeft = x - layer.toUI(e.clientX); this.viewport.scrollTop = y - layer.toUI(e.clientY); });
        });
        this.viewport.addEventListener("keydown", event => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;

            event.preventDefault();
            if (event.key === "Home") this.centerPosition();
            else if (event.key === "ArrowLeft") this.viewport.scrollLeft -= 32;
            else if (event.key === "ArrowRight") this.viewport.scrollLeft += 32;
            else if (event.key === "ArrowUp") this.viewport.scrollTop -= 32;
            else this.viewport.scrollTop += 32;
        });
        this.viewport.addEventListener("wheel", event => {
            event.preventDefault();
            this.viewport.scrollLeft += event.deltaX;
            this.viewport.scrollTop += event.deltaY;
        }, { passive: false });
        this.viewport.addEventListener("mousemove", event => {
            const rect = this.viewport.getBoundingClientRect();

            this.mouseX = layer.toUI(event.clientX - rect.left);
            this.mouseY = layer.toUI(event.clientY - rect.top);
            this.paintQuestCaption();
        });
        this.viewport.addEventListener("mouseleave", () => { this.mouseX = this.mouseY = -1; this.hideQuestCaption(); });
        this.viewport.addEventListener("scroll", () => this.paintQuestCaption());
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.max(0, width - 354), Math.max(0, height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; if (!visible) this.hideQuestCaption(); }

    public setQuestLocation(location: QuestLocation_T) {
        this.questLocation = location;
        this.questMarker.hidden = !location;
        if (!location) { this.hideQuestCaption(); return; }

        const x = Math.trunc(location.x), y = Math.trunc(location.y);

        if (x >= 40459 && x <= 50172 && y >= 241581 && y <= 251111) { this.questX = 100; this.questY = 1334; }
        else { this.questX = Math.trunc((x + 131072) * 0.0050048828125); this.questY = Math.trunc((y + 262144) * 0.0050048828125); }
        this.layer.place(this.questMarker, this.questX, this.questY - 20);
        this.paintQuestCaption();
    }

    protected hideQuestCaption() { if (this.questCaption) { this.questCaption.remove(); this.questCaption = null; } }

    protected paintQuestCaption() {
        this.hideQuestCaption();
        if (!this.questLocation || !this.isVisible()) return;

        const x = this.questX - this.viewport.scrollLeft, y = this.questY - this.viewport.scrollTop;

        if (x < 5 || x > 323 || y < 5 || y >= 323 || this.mouseX < x || this.mouseX > x + 20 || this.mouseY < y - 20 || this.mouseY > y) return;

        const strings = this.layer.getManager().strings, info = strings.quests.find(info => info.tag && info.id === this.questLocation.id);
        const name = this.questLocation.name, title = info ? info.title : "", lineHeight = this.layer.getManager().canvas.getLineHeight();
        const width = Math.max(this.layer.measureText(name), this.layer.measureText(title)) + 16, height = lineHeight * 2 + 18;
        let left = Math.max(5, x - 5), top = Math.max(5, y + 5);

        if (left + width > 323) left = 323 - width;
        if (top + height > 323) top = 323 - height;
        this.questCaption = this.layer.createWindow(3 + left, 21 + top, width, height, this.element);
        this.questCaption.classList.add("ndom-tooltip", "ndom-opaque");
        this.questCaption.style.pointerEvents = "none";
        this.questCaption.setAttribute("role", "tooltip");
        this.questCaption.setAttribute("aria-label", `${name}\n${title}`);
        const widths = [8, width - 16, 8], heights = [8, height - 16, 8], xs = [0, 8, width - 8], ys = [0, 8, height - 8];

        for (let i = 0; i < 9; i++) this.layer.tile(this.questCaption, xs[i % 3], ys[Math.trunc(i / 3)], widths[i % 3], heights[Math.trunc(i / 3)], 0, 0, 8, 8, `L2UI_ch3.Tooltip.Tooltip${i + 1}`);
        this.layer.text(this.questCaption, name, 0xffdcdcdc, undefined, 8, 8);
        this.layer.text(this.questCaption, title, 0xffdcdcdc, undefined, 8, lineHeight + 10);
    }

    public setPosition(x: number, y: number, center: boolean = false) {
        // NCMinimapWnd::WorldToMap 0x100b9430; tables 0x1025cbc0 / 0x1025cc08 / 0x1025cc50 / 0x1025cc98.
        x = Math.trunc((x + 131072) * 0.0050048828125);
        y = Math.trunc((y + 262144) * 0.0050048828125);
        this.positionX = x;
        this.positionY = y;
        this.layer.place(this.marker, x - 16, y - 16);
        if (center) this.centerPosition();
    }

    protected centerPosition() { this.viewport.scrollLeft = this.positionX - 164; this.viewport.scrollTop = this.positionY - 164; }
}

export default NCMapWnd;
