import type NDomLayer from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCMinimizedWnd from "./nc-minimized-wnd";
import NCTooltip from "./nc-tooltip";
import { FontType_T } from "./nwindow-canvas";
import type { QuestLocation_T } from "./nc-quest-wnd";
import { SKIN_SLOTS } from "./skin-textures";

export type MapPartyMember_T = { objectId: number, name: string, x: number, y: number, z: number };
type MapPartyMarker_T = { element: HTMLDivElement, x: number, y: number, memberIndex: number, caption: HTMLDivElement };

type MapTargetMarker_T = { element: HTMLDivElement, x: number, y: number, worldX: number, worldY: number };

type MapGrid_T = { line: HTMLDivElement, label: HTMLDivElement, text: string };

type MapInfo_T = { scaleX: number, scaleY: number, originX: number, originY: number, width: number, height: number, x: number, y: number, texture: string };

const arrMapInfo: MapInfo_T[] = [
    { scaleX: 0.0050048828125, scaleY: 0.0050048828125, originX: 131072, originY: 262144, width: 1804, height: 2624, x: 0, y: 0, texture: "" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: -90624, originY: 236416, width: 653, height: 626, x: 242, y: 2536, texture: "L2Font-e.TownMap.map_talkin_island_village" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: -89344, originY: 145792, width: 768, height: 706, x: 269, y: 2079, texture: "L2Font-e.TownMap.map_gludin_village" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: -19968, originY: 117504, width: 606, height: 647, x: 592, y: 1932, texture: "L2Font-e.TownMap.map_gludio_castle_town" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 768, originY: 9344, width: 950, height: 740, x: 721, y: 1394, texture: "L2Font-e.TownMap.map_dark_elven_village" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 11840, originY: 138432, width: 657, height: 618, x: 763, y: 2042, texture: "L2Font-e.TownMap.map_dion_castle_town" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 11840, originY: 165120, width: 650, height: 510, x: 739, y: 2156, texture: "L2Font-e.TownMap.map_floran_village" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 75136, originY: 48768, width: 659, height: 623, x: 1086, y: 1595, texture: "L2Font-e.TownMap.map_town_of_oren" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 39168, originY: 42688, width: 633, height: 675, x: 907, y: 1568, texture: "L2Font-e.TownMap.map_elven_village" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 73536, originY: 140032, width: 950, height: 860, x: 1080, y: 2053, texture: "L2Font-e.TownMap.map_giran_castle_town" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 111104, originY: 70016, width: 740, height: 760, x: 1260, y: 1706, texture: "L2Font-e.TownMap.map_hunters_village" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 139264, originY: 16384, width: 821, height: 971, x: 1410, y: 1446, texture: "L2Font-e.TownMap.map_town_of_aden" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 101504, originY: 212608, width: 983, height: 839, x: 1227, y: 2436, texture: "L2Font-e.TownMap.map_heine" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: -52736, originY: -120832, width: 767, height: 701, x: 438, y: 743, texture: "L2Font-e.TownMap.map_orc_village" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 110144, originY: -187968, width: 557, height: 737, x: 1253, y: 401, texture: "L2Font-e.TownMap.map_dwarven_village" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 29760, originY: -55808, width: 993, height: 699, x: 851, y: 1063, texture: "L2Font-e.TownMap.map_rune_village" },
    { scaleX: 0.05000000074505806, scaleY: 0.05000000074505806, originX: 140256, originY: -64320, width: 763, height: 663, x: 1412, y: 1037, texture: "L2Font-e.TownMap.map_godard_castle_town" },
];
const cacheMapIds = new Map([[20, 3], [21, 2], [35, 1], [43, 9], [48, 5], [58, 6], [62, 13], [64, 14], [74, 10], [77, 11], [101, 7], [107, 4], [113, 8], [118, 12], [122, 12], [269, 16], [291, 15]]);
const TEX_ZOOM_IN = "L2UI_CH3.Minimap.MapButton_ZoomIn1";
const TEX_ZOOM_IN_DOWN = "L2UI_CH3.Minimap.MapButton_ZoomIn2";
const TEX_ZOOM_OUT = "L2UI_CH3.Minimap.MapButton_ZoomOut1";
const TEX_ZOOM_OUT_DOWN = "L2UI_CH3.Minimap.MapButton_ZoomOut2";

const TEX_PARTY = "L2UI_CH3.Minimap.minimap_party";
const TEX_BACK = "L2UI_CH3.Minimap.MapBack";
const TEX_FOLDED = "L2UI_CH3.MenuIcon.menuicon3";
const TEX_TARGET = "L2UI.MinimapWnd.TargetPos";
const TEX_MARKER = "L2UI.MinimapWnd.MinimapPos";
const TEX_SHADOW = "L2UI_CH3.Minimap.MapShadow";
const TEX_SUN = "L2UI_CH3.Minimap.Map_Sun";
const TEX_MOON = "L2UI_CH3.Minimap.Map_Moon";
const TEX_QUEST = "L2UI_CH3.Minimap.MapIcon_Mark";
const TEX_BUTTON = SKIN_SLOTS.button;
const TEX_BUTTON_DOWN = SKIN_SLOTS.buttonDown;
const arrMaps = Array.from({ length: 6 }, (_, i) => `L2Font-e.Minimap.ch4_worldmap${i + 1}`);

export class NCMapWnd {
    public static getTextures() { return [TEX_BACK, TEX_MARKER, TEX_TARGET, TEX_PARTY, TEX_SHADOW, TEX_SUN, TEX_MOON, TEX_QUEST, TEX_BUTTON, TEX_BUTTON_DOWN, TEX_ZOOM_IN, TEX_ZOOM_IN_DOWN, TEX_ZOOM_OUT, TEX_ZOOM_OUT_DOWN, ...arrMapInfo.slice(1).map(info => info.texture), ...arrMaps, ...NCFrameCtrl.getTextures(), ...NCMinimizedWnd.getTextures(TEX_FOLDED), ...new NCTooltip().getTextures()]; }
    public readonly element: HTMLDivElement;
    public onShow: () => void = null;
    protected readonly layer: NDomLayer;
    protected readonly minimized: NCMinimizedWnd;
    protected readonly viewport: HTMLDivElement;
    protected readonly map: HTMLDivElement;
    protected readonly arrMapTiles: HTMLDivElement[] = [];
    protected readonly arrMapButtons: HTMLDivElement[] = [];
    protected readonly grid: HTMLDivElement;
    protected readonly arrGridColumns: MapGrid_T[] = [];
    protected readonly arrGridRows: MapGrid_T[] = [];
    protected readonly townMap: HTMLDivElement;
    protected readonly returnButton: HTMLDivElement;
    protected readonly zoneCaption: HTMLDivElement;
    protected zoneName: string = null;
    protected readonly clock: HTMLDivElement;
    protected readonly clockIcon: HTMLDivElement;
    protected clockText = "";
    protected clockDay = false;
    protected mapId = 0;
    protected worldScrollX = 0;
    protected worldScrollY = 0;
    protected worldX = 0;
    protected worldY = 0;
    protected worldZ = 0;
    protected readonly arrTargetMarkers: MapTargetMarker_T[] = [];
    protected readonly arrPartyMarkers: MapPartyMarker_T[] = [];
    protected readonly tooltip = new NCTooltip();
    protected partyMembers: readonly MapPartyMember_T[] = [];
    protected partyIndex = -1;
    protected partyTooltipIndex = -1;
    protected partyTimer = 0;
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
        this.element.tabIndex = -1;
        this.minimized = new NCMinimizedWnd(layer, this.element, () => this.setVisible(true), TEX_FOLDED, 925, false);
        layer.tile(this.element, 0, 20, 334, 363, 0, 0, 334, 363, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 334, layer.getManager().getSysString(447), true, () => this.setVisible(false), null, () => this.minimize()); // NWindow 0x10062182: minimap window title
        this.viewport = layer.createWindow(3, 21, 328, 328, this.element);
        this.viewport.style.overflow = "hidden";
        this.viewport.tabIndex = 0;
        this.viewport.setAttribute("aria-label", "World map. Use arrow keys or drag to pan.");

        // NCMinimapWnd bounds 0x1025cce0 / 0x1025cd28 exclude the tiles' padded right/bottom edges.
        const map = this.map = layer.createWindow(0, 0, 1804, 2624, this.viewport);

        map.style.overflow = "hidden";

        // NCMinimapWnd::OnPaint 0x100bbf6b: two columns, three rows of 1024px tiles.
        arrMaps.forEach((path, index) => this.arrMapTiles.push(layer.tile(map, index % 2 * 1024, Math.trunc(index / 2) * 1024, 1024, 1024, 0, 0, 1024, 1024, path)));
        this.townMap = layer.tile(map, 0, 0, 653, 626, 0, 0, 653, 626, arrMapInfo[1].texture);
        this.townMap.hidden = true;
        this.grid = layer.createWindow(0, 0, 328, 328, map);
        this.grid.style.overflow = "hidden";
        this.grid.style.pointerEvents = "none";
        for (const arr of [this.arrGridColumns, this.arrGridRows]) for (let i = 0; i < 6; i++) {
            const line = layer.createWindow(0, 0, 1, 1, this.grid), label = layer.text(this.grid, "", 0xffdcdcdc, undefined, 0, 0);

            line.style.background = "rgba(0,0,0,0.25098039215686274)";
            arr.push({ line, label, text: "" });
        }
        for (let i = 1; i < arrMapInfo.length; i++) {
            const info = arrMapInfo[i], button = layer.button(map, info.x, info.y, 26, 26, TEX_ZOOM_IN, TEX_ZOOM_IN_DOWN, null, null, () => this.enterMap(i));

            button.setAttribute("aria-label", `Open ${info.texture.split("map_")[1].replaceAll("_", " ")} map`);
            button.setAttribute("role", "button");
            button.tabIndex = 0;
            button.addEventListener("keydown", event => {
                if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                layer.getManager().playButtonSound(true);
                this.enterMap(i);
            });
            button.addEventListener("mousedown", event => event.stopPropagation());
            this.arrMapButtons.push(button);
        }
        this.returnButton = layer.button(this.viewport, 301, 301, 24, 24, TEX_ZOOM_OUT, TEX_ZOOM_OUT_DOWN, null, null, () => this.returnToWorld());
        this.returnButton.hidden = true;
        this.returnButton.setAttribute("aria-label", "Return to world map");
        this.returnButton.setAttribute("role", "button");
        this.returnButton.tabIndex = 0;
        this.returnButton.addEventListener("keydown", event => {
            if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            layer.getManager().playButtonSound(true);
            this.returnToWorld();
        });
        this.returnButton.addEventListener("mousedown", event => event.stopPropagation());
        this.marker = layer.tile(map, 0, 0, 32, 32, 0, 0, 32, 32, TEX_MARKER);
        this.questMarker = layer.tile(map, 0, 0, 32, 32, 0, 0, 32, 32, TEX_QUEST);
        for (let i = 0; i < 8; i++) {
            const element = layer.button(map, 0, 0, 16, 16, TEX_PARTY, TEX_PARTY, TEX_PARTY);

            map.insertBefore(element, this.questMarker);
            element.hidden = true;
            element.addEventListener("mousedown", event => event.stopPropagation());
            this.arrPartyMarkers.push({ element, x: 0, y: 0, memberIndex: -1, caption: null });
        }
        this.questMarker.hidden = true;
        this.questMarker.style.pointerEvents = "none";
        this.marker.title = "You are here";
        this.marker.setAttribute("aria-label", "Your position");
        const shadow = layer.tile(this.element, 3, 331, 329, 23, 0, 0, 329, 23, TEX_SHADOW);

        shadow.style.pointerEvents = "none";
        shadow.style.overflow = "hidden";
        this.zoneCaption = layer.text(shadow, "", 0xffdcdcdc, undefined, 22, 3);
        this.clockIcon = layer.tile(this.element, 7, 27, 25, 25, 0, 0, 25, 25, TEX_MOON);
        this.clock = layer.text(this.element, "", 0xffdcdcdc, FontType_T.LARGE, 32, 40);
        this.clockIcon.style.pointerEvents = this.clock.style.pointerEvents = "none";

        const label = layer.getManager().getSysString(887);
        const center = () => this.centerPosition();
        const current = layer.button(this.element, 249, 355, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, label, center);

        const partyLabel = layer.getManager().getSysString(1223);
        const party = layer.button(this.element, 89, 355, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, partyLabel, () => this.cyclePartyMember());

        party.tabIndex = 0;
        party.setAttribute("role", "button");
        party.setAttribute("aria-label", partyLabel);
        party.addEventListener("keydown", event => {
            if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            layer.getManager().playButtonSound(true);
            this.cyclePartyMember();
        });
        const targetLabel = layer.getManager().getSysString(886);
        const target = layer.button(this.element, 169, 355, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, targetLabel, () => this.centerQuestLocation());

        target.tabIndex = 0;
        target.setAttribute("role", "button");
        target.setAttribute("aria-label", targetLabel);
        target.addEventListener("keydown", event => {
            if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            layer.getManager().playButtonSound(true);
            this.centerQuestLocation();
        });
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
            layer.beginDrag(e => { this.viewport.scrollLeft = x - layer.toUI(e.clientX); this.viewport.scrollTop = y - layer.toUI(e.clientY); }, () => layer.getManager().setCursor(""));
            layer.getManager().setCursor(layer.getManager().getCursor(3));
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
            this.paintPartyCaptions();
        });
        this.viewport.addEventListener("mouseleave", () => { this.mouseX = this.mouseY = -1; this.hideQuestCaption(); this.hidePartyCaptions(); });
        this.viewport.addEventListener("scroll", () => { this.layer.place(this.returnButton, 301 + this.viewport.scrollLeft, 301 + this.viewport.scrollTop); this.paintGrid(); this.paintPlayerMarker(); this.paintTargetMarkers(); this.paintPartyMarkers(); this.paintQuestCaption(); });
    }

    public placeOnScreen(width: number, height: number) { this.minimized.place(Math.max(0, width - 354), Math.max(0, height * 0.5 - 252)); }
    protected minimize() { this.setVisible(false); this.minimized.minimize(); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        if (visible && this.minimized.isVisible()) { this.minimized.restore(true); return; }

        this.element.hidden = !visible;
        this.minimized.hide();
        if (visible) {
            if (this.onShow) this.onShow();
            this.worldScrollX = this.worldScrollY = 0;
            this.paintPartyMarkers();
            return;
        }

        this.hideQuestCaption();
        this.hidePartyCaptions();
        window.clearTimeout(this.partyTimer);
        this.partyTimer = 0;
        this.partyTooltipIndex = -1;
    }

    public setPartyMembers(members: readonly MapPartyMember_T[]) {
        this.partyMembers = members;
        if (!members.length) {
            window.clearTimeout(this.partyTimer);
            this.partyTimer = 0;
            this.partyTooltipIndex = -1;
        }
        this.paintPartyMarkers();
    }

    protected cyclePartyMember() {
        if (!this.partyMembers.length) return;

        this.partyIndex = (this.partyIndex + 1) % this.partyMembers.length;
        this.partyTooltipIndex = this.partyIndex;
        const member = this.partyMembers[this.partyIndex];
        this.centerLocation(member.x, member.y, member.z);
        window.clearTimeout(this.partyTimer);
        this.partyTimer = window.setTimeout(() => { this.partyTimer = 0; this.partyTooltipIndex = -1; this.paintPartyCaptions(); }, 2000);
        this.paintTargetMarkers();
        this.paintPartyMarkers();
        this.paintQuestCaption();
    }

    protected paintPartyMarkers() {
        let count = 0;

        for (let i = 0; i < this.partyMembers.length && count < this.arrPartyMarkers.length; i++) {
            const member = this.partyMembers[i];

            if (member.x === -1 && member.y === -1) continue;

            const [x, y] = this.project(member.x, member.y, true);
            const screenX = x - this.viewport.scrollLeft, screenY = y - this.viewport.scrollTop;

            if (screenX < 12 || screenX > 316 || screenY < 12 || screenY >= 316) continue;

            const marker = this.arrPartyMarkers[count++];

            marker.x = x;
            marker.y = y;
            marker.memberIndex = i;
            marker.element.hidden = false;
            marker.element.setAttribute("aria-label", member.name);
            this.layer.place(marker.element, x, y);
        }
        for (; count < this.arrPartyMarkers.length; count++) {
            this.arrPartyMarkers[count].element.hidden = true;
            this.arrPartyMarkers[count].memberIndex = -1;
        }
        this.paintPartyCaptions();
    }

    protected hidePartyCaptions() {
        for (const marker of this.arrPartyMarkers) if (marker.caption) { marker.caption.remove(); marker.caption = null; }
    }

    protected paintPartyCaptions() {
        this.hidePartyCaptions();
        if (!this.isVisible()) return;

        for (const marker of this.arrPartyMarkers) {
            if (marker.element.hidden) continue;

            const x = marker.x - this.viewport.scrollLeft, y = marker.y - this.viewport.scrollTop;
            const isHovered = this.mouseX >= x && this.mouseX <= x + 16 && this.mouseY >= y && this.mouseY <= y + 16;

            if (!isHovered && marker.memberIndex !== this.partyTooltipIndex) continue;

            const rect = marker.element.getBoundingClientRect();

            marker.caption = this.tooltip.createDOM(this.layer, this.element, this.layer.toUI(rect.left), this.layer.toUI(rect.top), this.partyMembers[marker.memberIndex].name, 0);
        }
    }

    public setTargetLocations(locations: readonly { x: number, y: number, z: number }[]) {
        for (const marker of this.arrTargetMarkers) marker.element.remove();
        this.arrTargetMarkers.length = 0;

        for (const location of locations) {
            const x = Math.trunc(location.x), y = Math.trunc(location.y);
            const [mapX, mapY] = this.project(x, y, true);
            const element = this.layer.tile(this.map, mapX, mapY, 32, 32, 0, 0, 32, 32, TEX_TARGET);

            this.map.insertBefore(element, this.questMarker);
            element.style.pointerEvents = "none";
            this.arrTargetMarkers.push({ element, x: mapX, y: mapY, worldX: x, worldY: y });
        }

        this.paintTargetMarkers();
    }

    protected paintGrid() {
        this.grid.hidden = this.mapId !== 0;
        if (this.mapId) return;

        const spacing = Math.trunc(arrMapInfo[0].scaleX * 12288), scrollX = Math.trunc(this.viewport.scrollLeft), scrollY = Math.trunc(this.viewport.scrollTop);

        this.layer.place(this.grid, scrollX, scrollY);
        for (let axis = 0; axis < 2; axis++) {
            const arr = axis ? this.arrGridRows : this.arrGridColumns, scroll = axis ? scrollY : scrollX;
            let position = spacing - scroll % spacing, index = 20 + Math.trunc(scroll / spacing) + axis;

            for (const entry of arr) {
                const text = `${index++}`;

                if (entry.text !== text) { entry.text = text; this.layer.renderText(entry.label, text, 0xffdcdcdc); entry.label.setAttribute("aria-label", text); }
                const width = Math.trunc(this.layer.measureText(text)), height = this.layer.getManager().canvas.getLineHeight();

                entry.label.hidden = position <= (axis ? 20 : 15);
                this.layer.place(entry.label, axis ? 0 : position - Math.trunc(width / 2), axis ? position - Math.trunc(height / 2) : 2);
                this.layer.place(entry.line, axis ? width : position, axis ? position : height, axis ? 328 - width : 1, axis ? 1 : 328 - height);
                position += spacing;
            }
        }
    }

    protected paintPlayerMarker() {
        const x = this.positionX - this.viewport.scrollLeft, y = this.positionY - this.viewport.scrollTop;

        this.marker.hidden = x < 12 || x > 316 || y < 12 || y >= 316;
    }

    protected paintTargetMarkers() {
        for (const marker of this.arrTargetMarkers) {
            const x = marker.x - this.viewport.scrollLeft, y = marker.y - this.viewport.scrollTop;

            marker.element.hidden = x < 12 || x > 316 || y < 12 || y >= 316;
        }
    }

    public getQuestLocation() { return this.questLocation; }
    public setQuestLocation(location: QuestLocation_T) {
        this.questLocation = location;
        this.questMarker.hidden = !location;
        if (!location) { this.hideQuestCaption(); return; }

        const x = Math.trunc(location.x), y = Math.trunc(location.y);

        [this.questX, this.questY] = this.project(x, y, true);
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

    public setFacing(yaw: number) { this.marker.style.transform = `rotate(${yaw + Math.PI * 0.5}rad)`; }

    public setTime(time: number) {
        let hour = Math.trunc(time), minute = Math.trunc((time - hour) * 60);

        if (minute >= 60) { minute -= 60; hour++; }
        const day = hour >= 6 && hour <= 24; // NCMinimapWnd::OnPaint 0x100bc9b1 uses 6..24 inclusive.
        const period = hour >= 12 ? "PM" : "AM";

        if (hour >= 12) hour -= 12;
        if (!hour) hour = 12;
        const text = `${period} ${`${hour}`.padStart(2, "0")} : ${`${minute}`.padStart(2, "0")}`;

        if (text !== this.clockText) {
            this.clockText = text;
            this.layer.renderText(this.clock, text, 0xffdcdcdc, FontType_T.LARGE);
            this.clock.setAttribute("aria-label", text);
        }
        if (day !== this.clockDay) {
            this.clockDay = day;
            this.layer.setTile(this.clockIcon, 25, 25, 0, 0, 25, 25, day ? TEX_SUN : TEX_MOON);
        }
    }

    protected project(x: number, y: number, special: boolean = false) {
        // NCMinimapWnd::WorldToMap 0x100b9430; tables 0x1025cbc0 / 0x1025cc08 / 0x1025cc50 / 0x1025cc98.
        x = Math.trunc(x);
        y = Math.trunc(y);
        if (special && x >= 40459 && x <= 50172 && y >= 241581 && y <= 251111) return [100, 1334];

        const info = arrMapInfo[this.mapId], sign = this.mapId ? -1 : 1;

        return [Math.trunc((x + sign * info.originX) * info.scaleX), Math.trunc((y + sign * info.originY) * info.scaleY)];
    }

    protected getMapId(x: number, y: number, z: number) { return cacheMapIds.get(this.layer.getManager().getZoneNameInfo(x, y, z)?.id) || 0; }

    protected setMapId(id: number) {
        this.mapId = id;
        const info = arrMapInfo[id];

        this.layer.place(this.map, 0, 0, info.width, info.height);
        for (const tile of this.arrMapTiles) tile.hidden = id !== 0;
        for (const button of this.arrMapButtons) button.hidden = id !== 0;
        this.townMap.hidden = id === 0;
        this.paintGrid();
        this.returnButton.hidden = id === 0;
        this.viewport.setAttribute("aria-label", `${id ? "Town" : "World"} map. Use arrow keys or drag to pan.`);
        if (id) {
            this.layer.place(this.townMap, 0, 0, info.width, info.height);
            this.layer.setTile(this.townMap, info.width, info.height, 0, 0, info.width, info.height, info.texture);
        }
        this.setPosition(this.worldX, this.worldY, false, this.worldZ);
        for (const marker of this.arrTargetMarkers) {
            [marker.x, marker.y] = this.project(marker.worldX, marker.worldY, true);
            this.layer.place(marker.element, marker.x, marker.y);
        }
        this.setQuestLocation(this.questLocation);
        this.paintTargetMarkers();
        this.paintPartyMarkers();
    }

    protected enterMap(id: number) {
        this.worldScrollX = this.viewport.scrollLeft;
        this.worldScrollY = this.viewport.scrollTop;
        this.setMapId(id);
        const info = arrMapInfo[id], [x, y] = this.project(this.worldX, this.worldY);
        const inside = x >= 0 && x <= info.width && y >= 0 && y <= info.height;

        this.scrollTo(inside ? x - 164 : 0, inside ? y - 164 : 0);
    }

    protected returnToWorld() {
        if (!this.mapId) return;

        this.setMapId(0);
        this.scrollTo(this.worldScrollX, this.worldScrollY);
        this.centerPosition();
    }

    protected scrollTo(x: number, y: number) {
        const info = arrMapInfo[this.mapId];

        this.viewport.scrollLeft = Math.max(0, Math.min(info.width - 328, x));
        this.viewport.scrollTop = Math.max(0, Math.min(info.height - 328, y));
        this.layer.place(this.returnButton, 301 + this.viewport.scrollLeft, 301 + this.viewport.scrollTop);
        this.paintGrid();
        this.paintPlayerMarker();
        this.paintTargetMarkers();
        this.paintPartyMarkers();
        this.paintQuestCaption();
    }

    public setPosition(x: number, y: number, center: boolean = false, z: number = this.worldZ) {
        this.worldX = x;
        this.worldY = y;
        this.worldZ = z;
        const height = Math.trunc(z);
        const name = this.layer.getManager().getZoneName(x, y, z);

        if (name !== this.zoneName) {
            this.zoneName = name;
            const text = `${this.layer.getManager().getSysString(471)} : ${name}`;

            this.layer.renderText(this.zoneCaption, text, 0xffdcdcdc);
            this.zoneCaption.setAttribute("aria-label", text);
        }

        [this.positionX, this.positionY] = this.project(x, y, height >= -6874 && height <= -4874);
        this.layer.place(this.marker, this.positionX - 16, this.positionY - 16);
        this.paintPlayerMarker();
        if (center) this.centerPosition();
    }

    public openPosition(x: number, y: number, z: number) {
        this.setPosition(x, y, false, z);
        this.setMapId(this.getMapId(x, y, z));
        this.centerPosition();
    }

    protected centerLocation(x: number, y: number, z: number) {
        if (this.mapId !== this.getMapId(x, y, z)) this.setMapId(0);
        const isSpecial = x >= 40459 && x <= 50172 && y >= 241581 && y <= 251111 && z >= -6874 && z <= -4874;
        const [mapX, mapY] = this.project(x, y);

        this.scrollTo(isSpecial ? 0 : mapX - 164, isSpecial ? 1334 : mapY - 164);
    }

    protected centerQuestLocation() {
        if (this.questLocation) this.centerLocation(this.questLocation.x, this.questLocation.y, 0);
    }

    protected centerPosition() { this.centerLocation(this.worldX, this.worldY, this.worldZ); }
}

export default NCMapWnd;
