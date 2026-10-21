import NCFrameCtrl from "./nc-frame-ctrl";
import NCTooltip, { type TooltipInfo_T } from "./nc-tooltip";
import type NCCoolTimeIcon from "./nc-cool-time-icon";
import type NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";

const TEXT_COLOR = 0xffdcdcdc;
const TEX_BACK = "L2UI_CH3.ShortcutWnd.shortcut_back";
const TEX_BACKV = "L2UI_CH3.ShortcutWnd.shortcut_backv";
const TEX_OUTLINE = "L2UI_CH3.Etc.menu_outline";
const TEX_OUTLINE_DOWN = "L2UI_CH3.Etc.menu_outline_down";
const TEX_TOGGLE = "L2_SkillTime.ToggleEffect.ToggleEffect001";
const TEX_NEXT = "L2UI_CH3.ShortcutWnd.shortcut_next";
const TEX_NEXTV = "L2UI_CH3.ShortcutWnd.shortcut_nextv";
const TEX_PREV = "L2UI_CH3.ShortcutWnd.shortcut_prev";
const TEX_PREVV = "L2UI_CH3.ShortcutWnd.shortcut_prevv";
const TEX_ROTATE = "L2UI_CH3.ShortcutWnd.shortcut_rotate";
const TEX_SMALLBAR1 = "L2UI_CH3.FrameCtrl.smallbar1";
const TEX_SMALLBAR2 = "L2UI_CH3.FrameCtrl.smallbar2";
const TEX_SMALLBAR3 = "L2UI_CH3.FrameCtrl.smallbar3";
const TEX_SMALLBAR_H1 = "L2UI_CH3.FrameCtrl.smallbar_h1";
const TEX_SMALLBAR_H2 = "L2UI_CH3.FrameCtrl.smallbar_h2";
const TEX_SMALLBAR_H3 = "L2UI_CH3.FrameCtrl.smallbar_h3";
const TEX_FKEYS = Array.from({ length: 12 }, (_, i) => `L2UI_CH3.ShortcutWnd.shortcut_f${String(i + 1).padStart(2, "0")}`);
const WINDOW_NAME = "ShortCutWnd";

const SLOTS_PER_PAGE = 12; // ctor 0x10108ed0(12, 10, 32)
const PAGE_COUNT = 10;
const ICON_SIZE = 32;

const SLOT_OFFSETS = [33, 70, 107, 144, 186, 223, 260, 297, 339, 376, 413, 450]; // start 33 (0x10106994), step icon+5 (0x10106e05), +5 after slots 3 and 7 (0x10106dfc)

const RECT_NEXT = [[31, 13, 14, 14], [13, 1, 14, 14]]; // [x, y, w, h] vertical / horizontal: 0x10109377, 0x1010942d, 0x101094e3; relayout 0x10105b4c, 0x10105b28, 0x10105b6e.
const RECT_PREV = [[1, 13, 14, 14], [13, 31, 14, 14]];
const RECT_ROTATE = [[16, 489, 15, 15], [489, 16, 15, 15]];
const RECT_GRIP = [[0, 0, 46, 12], [0, 0, 12, 46]];

export type ShortcutEntry_T = { icon: string, label: string, tooltip: string | TooltipInfo_T, skillKey?: string, isAutoSoulShot?: boolean, acronym?: string };

type ShortcutSlot_T = { icon: HTMLDivElement, outline: HTMLDivElement, outlineDown: HTMLDivElement, toggle: HTMLDivElement, acronym: HTMLDivElement, coolTime: HTMLDivElement, fkey: HTMLDivElement, coolTexture: string, coolColor: number };

export class NCShortCutWnd { // NCShortCutWnd: NCConsole 0x10061d76 SetWindowPos(W - 46, H/2 - 252, 46, 504); paint 0x10106860.
    public static getTextures(): string[] {
        return [
            TEX_BACK, TEX_BACKV, TEX_OUTLINE, TEX_OUTLINE_DOWN, TEX_TOGGLE, TEX_SMALLBAR1, TEX_SMALLBAR2, TEX_SMALLBAR3, TEX_SMALLBAR_H1, TEX_SMALLBAR_H2, TEX_SMALLBAR_H3, ...TEX_FKEYS,
            ...[TEX_NEXT, TEX_NEXTV, TEX_PREV, TEX_PREVV].flatMap(texture => [texture, `${texture}_down`, `?${texture}_over`]), TEX_ROTATE, `${TEX_ROTATE}_down`, `?${TEX_ROTATE}_over`
        ];
    }

    public readonly element: HTMLDivElement;
    protected readonly back: HTMLDivElement;
    protected readonly arrBars: HTMLDivElement[];
    protected readonly pageDigits: HTMLDivElement;
    protected readonly pageZero: HTMLDivElement;
    protected readonly arrSlots: ShortcutSlot_T[] = [];
    protected readonly grip: HTMLDivElement;
    protected readonly nextButton: NDomButton_T;
    protected readonly prevButton: NDomButton_T;
    protected readonly rotateButton: NDomButton_T;
    protected readonly tooltip = new NCTooltip();
    protected readonly entries: ShortcutEntry_T[] = new Array(SLOTS_PER_PAGE * PAGE_COUNT).fill(null);
    protected hoveredTooltip: HTMLDivElement = null;
    protected isHorizontal = false;
    protected page = 0;
    protected hoveredSlot = -1;
    protected pressedSlot = -1;
    protected pressedPage = 0;
    protected isPressed = false;
    protected isDragging = false;

    public onUse: (page: number, slot: number, ctrl: boolean, shift: boolean) => void = null;
    public onMove: (page: number, slot: number, targetPage: number, targetSlot: number) => void = null;
    public onDelete: (page: number, slot: number) => void = null;
    public onDrop: (page: number, slot: number, x: number, y: number) => boolean = null;
    public onDrag: (entry: ShortcutEntry_T) => void = null;
    public onDragMove: (x: number, y: number) => void = null;
    public onAutoSoulShot: (page: number, slot: number) => void = null;

    public constructor(protected readonly layer: NDomLayer, protected readonly coolTimes: Map<string, NCCoolTimeIcon>) {
        this.element = layer.createWindow(0, 0, 46, 504);
        this.element.hidden = true;
        this.element.classList.add("ndom-opaque");
        this.back = layer.tile(this.element, 0, 12, 46, 492, 0, 0, 46, 492, TEX_BACKV);
        this.arrBars = [0, 1, 2].map(() => layer.tile(this.element, 0, 0, 8, 12, 0, 0, 8, 12, TEX_SMALLBAR_H3));
        this.pageDigits = layer.digits(this.element, "", TEXT_COLOR, undefined, 0, 0);
        this.pageZero = layer.digits(this.element, "0", TEXT_COLOR, undefined, 0, 0);

        for (let i = 0; i < SLOTS_PER_PAGE; i++) {
            const icon = layer.tile(this.element, 0, 0, ICON_SIZE, ICON_SIZE, 0, 0, ICON_SIZE, ICON_SIZE, TEX_OUTLINE), outline = layer.tile(this.element, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE), outlineDown = layer.tile(this.element, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE_DOWN);
            const toggle = layer.tile(this.element, 0, 0, ICON_SIZE, ICON_SIZE, 0, 0, ICON_SIZE, ICON_SIZE, TEX_TOGGLE), acronym = layer.createWindow(0, 0, 0, 0, this.element), coolTime = layer.tile(this.element, 0, 0, ICON_SIZE, ICON_SIZE, 0, 0, ICON_SIZE, ICON_SIZE, TEX_OUTLINE);

            this.arrSlots.push({ icon, outline, outlineDown, toggle, acronym, coolTime, fkey: layer.tile(this.element, 0, 0, 16, 16, 0, 0, 16, 16, TEX_FKEYS[i]), coolTexture: null, coolColor: 0xffffff });
        }

        this.grip = NCFrameCtrl.createGrip(layer, this.element, 0, 0, 46, 12);
        this.nextButton = layer.button(this.element, 0, 0, 14, 14, TEX_NEXT, `${TEX_NEXT}_down`, null, null, () => this.nextPage());
        this.prevButton = layer.button(this.element, 0, 0, 14, 14, TEX_PREV, `${TEX_PREV}_down`, null, null, () => this.prevPage());
        this.rotateButton = layer.button(this.element, 0, 0, 15, 15, TEX_ROTATE, `${TEX_ROTATE}_down`, null, null, () => this.rotate());
        this.layoutChildren();
        this.element.addEventListener("mousedown", event => this.onMouseDown(event));
        this.element.addEventListener("mousemove", event => { if (!this.isPressed) this.setHoveredSlot(this.getSlotAtClient(event.clientX, event.clientY)); });
        this.element.addEventListener("mouseleave", () => this.setHoveredSlot(-1));

        window.addEventListener("keydown", event => {
            if (!this.isVisible()) return;

            const match = /^F(\d+)$/.exec(event.key);

            if (!match || Number(match[1]) > SLOTS_PER_PAGE) return;

            event.preventDefault();

            if (this.onUse) this.onUse(this.page, Number(match[1]) - 1, event.ctrlKey, event.shiftKey);
        }, true);
    }

    public isVisible() { return !this.element.hidden; }

    public setVisible(isVisible: boolean) {
        if (!isVisible) this.cancelPress();
        this.element.hidden = !isVisible;
    }

    protected getX() { return parseFloat(this.element.style.left); }
    protected getY() { return parseFloat(this.element.style.top); }

    public placeOnScreen(screenWidth: number, screenHeight: number) {
        const owner = this.layer.getManager().getWindowOwner();
        const saved = owner === null ? null : localStorage.getItem(`wnd:${owner}:${WINDOW_NAME}:horizontal`);
        const horizontal = saved === null ? false : JSON.parse(saved);

        if (typeof horizontal !== "boolean") throw new Error(`Invalid shortcut orientation.`);
        if (horizontal !== this.isHorizontal) this.rotate(false);
        if (this.isHorizontal) return;

        this.layer.place(this.element, Math.trunc(screenWidth - 46), Math.trunc(screenHeight * 0.5 - 252));
    }

    public getPage() { return this.page; }

    public resetLayout() { if (this.isHorizontal) this.rotate(); }

    public hasCoolTime(key: string) {
        return this.isVisible() && this.entries.slice(this.page * SLOTS_PER_PAGE, (this.page + 1) * SLOTS_PER_PAGE).some(entry => entry && entry.skillKey === key);
    }

    public clearSlots() {
        this.entries.fill(null);
        this.hoveredSlot = this.pressedSlot = -1;
        this.update();
    }

    public setSlot(page: number, slot: number, entry: ShortcutEntry_T) {
        this.entries[page * SLOTS_PER_PAGE + slot] = entry;

        if (entry) void this.loadIcon(entry.icon);

        this.update();
    }

    protected async loadIcon(path: string) {
        await this.layer.loadTextures([path]);

        this.update();
    }

    protected nextPage() { // 0x10108c30 / 0x10108ca0 wrap between the first and last page.
        this.page = this.page < PAGE_COUNT - 1 ? this.page + 1 : 0;
        this.update();
    }

    protected prevPage() {
        this.page = this.page > 0 ? this.page - 1 : PAGE_COUNT - 1;
        this.update();
    }

    protected rotate(save = true) { // slot80 0x10106300 -> slot75 0x101058e0: swap w/h around x+W-H, y+H-W, clamped to >= 0.
        const w = this.element.offsetWidth || parseFloat(this.element.style.width), h = this.element.offsetHeight || parseFloat(this.element.style.height);

        this.isHorizontal = !this.isHorizontal;
        this.layer.place(this.element, Math.max(0, this.getX() + w - h), Math.max(0, this.getY() + h - w), h, w);
        this.layoutChildren();

        const owner = this.layer.getManager().getWindowOwner();

        if (save && owner !== null) {
            localStorage.setItem(`wnd:${owner}:${WINDOW_NAME}:horizontal`, JSON.stringify(this.isHorizontal));
            this.layer.saveWindowPosition(this.element);
        }
    }

    protected layoutChildren() {
        const layout = this.isHorizontal ? 1 : 0, layer = this.layer;

        layer.place(this.grip, ...RECT_GRIP[layout] as [number, number, number, number]);
        layer.place(this.nextButton, RECT_NEXT[layout][0], RECT_NEXT[layout][1]);
        layer.place(this.prevButton, RECT_PREV[layout][0], RECT_PREV[layout][1]);
        layer.place(this.rotateButton, RECT_ROTATE[layout][0], RECT_ROTATE[layout][1]);

        for (const [button, texture] of [[this.nextButton, this.isHorizontal ? TEX_NEXTV : TEX_NEXT], [this.prevButton, this.isHorizontal ? TEX_PREVV : TEX_PREV]] as [NDomButton_T, string][]) // The vertical bar shows the left/right arrows (L2.4_20 capture); the "v" up/down pair belongs to the horizontal bar.
            button.setTextures(texture, `${texture}_down`, layer.hasTexture(`${texture}_over`) ? `${texture}_over` : texture);

        if (this.isHorizontal) {
            layer.placeTile(this.back, 12, 0, 492, 46, 0, 0, 492, 46, TEX_BACK);
            layer.placeTile(this.arrBars[0], 0, 0, 12, 8, 0, 0, 12, 8, TEX_SMALLBAR1);
            layer.placeTile(this.arrBars[1], 0, 8, 12, 46 - 16, 0, 0, 12, 8, TEX_SMALLBAR2);
            layer.placeTile(this.arrBars[2], 0, 46 - 8, 12, 8, 0, 0, 12, 8, TEX_SMALLBAR3);
        } else {
            layer.placeTile(this.back, 0, 12, 46, 492, 0, 0, 46, 492, TEX_BACKV);
            layer.placeTile(this.arrBars[0], 0, 0, 8, 12, 0, 0, 8, 12, TEX_SMALLBAR_H3);
            layer.placeTile(this.arrBars[1], 8, 0, 46 - 16, 12, 0, 0, 8, 12, TEX_SMALLBAR_H2);
            layer.placeTile(this.arrBars[2], 46 - 8, 0, 8, 12, 0, 0, 8, 12, TEX_SMALLBAR_H1);
        }

        this.update();
    }

    public getSlotAt(x: number, y: number): number { // 0x101060f0: cross axis 6..38, along axis offset..offset+32, both inclusive.
        const across = this.isHorizontal ? y : x, along = this.isHorizontal ? x : y;

        if (across < 6 || across > ICON_SIZE + 6) return -1;

        for (let i = 0; i < SLOTS_PER_PAGE; i++)
            if (along >= SLOT_OFFSETS[i] && along <= SLOT_OFFSETS[i] + ICON_SIZE) return i;

        return -1;
    }

    protected getLocal(clientX: number, clientY: number): [number, number] {
        const rect = this.element.getBoundingClientRect();

        return [this.layer.toUI(clientX - rect.left), this.layer.toUI(clientY - rect.top)];
    }

    protected getSlotAtClient(clientX: number, clientY: number) { return this.getSlotAt(...this.getLocal(clientX, clientY)); }

    protected isOwnTarget(target: Element) { return !!target && this.element.contains(target) && ![this.grip, this.nextButton, this.prevButton, this.rotateButton].some(child => child.contains(target)); }

    protected onMouseDown(event: MouseEvent) {
        if (!this.isOwnTarget(event.target as Element)) return;

        if (event.button === 2) {
            const slot = this.getSlotAtClient(event.clientX, event.clientY);

            if (slot >= 0 && this.onAutoSoulShot) this.onAutoSoulShot(this.page, slot);
            return;
        }
        if (event.button !== 0) return;

        event.preventDefault();
        this.pressedSlot = this.getSlotAtClient(event.clientX, event.clientY);
        this.pressedPage = this.page;
        this.isPressed = true;
        this.isDragging = false;
        this.setHoveredSlot(-1);
        this.update();
        this.layer.beginDrag(move => {
            const entry = this.entries[this.pressedPage * SLOTS_PER_PAGE + this.pressedSlot];

            if (this.pressedSlot >= 0 && entry && !this.isDragging) {
                this.isDragging = true;
                if (this.onDrag) this.onDrag(entry);
            }
            if (this.isDragging && this.onDragMove) this.onDragMove(this.layer.toUI(move.clientX), this.layer.toUI(move.clientY));
        }, up => this.onMouseUp(up as MouseEvent));
    }

    protected onMouseUp(event: MouseEvent) { // NWindow 0x10107df0: register destination, delete source, then register the old destination.
        const source = this.pressedSlot, page = this.pressedPage;

        this.cancelPress();

        if (!(event instanceof MouseEvent) || event.type !== "mouseup" && event.type !== "pointerup") return;

        const [x, y] = this.getLocal(event.clientX, event.clientY), slot = this.getSlotAt(x, y);
        const target = document.elementFromPoint(event.clientX, event.clientY), isOwn = this.isOwnTarget(target);

        if (source < 0 || !this.entries[page * SLOTS_PER_PAGE + source]) return;

        if (slot === source && this.page === page) {
            if (isOwn && this.onUse) this.onUse(page, source, event.ctrlKey, event.shiftKey);
            return;
        }

        if (this.onDrop && this.onDrop(page, source, this.layer.toUI(event.clientX), this.layer.toUI(event.clientY))) return;

        if (isOwn) {
            if (slot >= 0 && this.onMove) this.onMove(page, source, this.page, slot);
            return;
        }
        if (target && target.closest(".ndom-edit")) return;

        const width = this.element.offsetWidth, height = this.element.offsetHeight;
        const dx = x < 0 ? x + 30 : x > width ? x - 30 : x, dy = y < 0 ? y + 30 : y > height ? y - 30 : y;

        if ((dx < 0 || dy < 0 || dx > width || dy > height) && this.onDelete) this.onDelete(page, source);
    }

    protected cancelPress() {
        if (!this.isPressed) return;

        this.pressedSlot = -1;
        this.isPressed = false;
        this.isDragging = false;
        if (this.onDrag) this.onDrag(null);
        this.update();
    }

    protected setHoveredSlot(slot: number) { // slot63 0x101097e0: tooltip pass after the children, anchored at the icon corner.
        const entry = slot < 0 ? null : this.entries[this.page * SLOTS_PER_PAGE + slot];

        this.hoveredSlot = slot;
        if (this.hoveredTooltip) this.hoveredTooltip.remove();
        this.hoveredTooltip = null;

        if (!entry || !entry.tooltip) return;

        const offset = SLOT_OFFSETS[slot], x = this.getX() + (this.isHorizontal ? offset : 7), y = this.getY() + (this.isHorizontal ? 7 : offset);

        this.hoveredTooltip = this.tooltip.createDOM(this.layer, this.element, x, y, entry.tooltip);
    }

    protected placeSlotTile(element: HTMLDivElement, across: number, along: number, size: number, texture: string, color: number = 0xffffff) {
        if (this.isHorizontal) this.layer.placeTile(element, along, across, size, size, 0, 0, size, size, texture, color);
        else this.layer.placeTile(element, across, along, size, size, 0, 0, size, size, texture, color);
    }

    public renderCoolTimes() {
        for (let i = 0; i < SLOTS_PER_PAGE; i++) {
            const slot = this.arrSlots[i], entry = this.entries[this.page * SLOTS_PER_PAGE + i];
            const coolTime = entry && this.coolTimes.get(entry.skillKey), texture = coolTime && coolTime.texture && this.layer.hasTexture(coolTime.texture) ? coolTime.texture : null, color = coolTime ? coolTime.color : 0xffffff;

            if (texture === slot.coolTexture && color === slot.coolColor) continue;

            slot.coolTexture = texture;
            slot.coolColor = color;
            slot.coolTime.hidden = !texture;
            if (texture) this.placeSlotTile(slot.coolTime, 7, SLOT_OFFSETS[i], ICON_SIZE, texture, color);
        }
    }

    protected update() {
        const layer = this.layer, text = String(this.page + 1);
        const [centerX, digitY, tensX] = this.isHorizontal ? [19, 18, 14] : [22, 16, 17]; // 0x10106903 / 0x10106eb7: centred on the SmallFont extent (0x10012960); page 10 is placed per digit.

        this.pageZero.hidden = this.page + 1 < 10;
        if (this.page + 1 < 10) {
            layer.renderDigits(this.pageDigits, text, TEXT_COLOR);
            layer.place(this.pageDigits, centerX - Math.trunc(layer.measureText(text) / 2), digitY);
        } else {
            layer.renderDigits(this.pageDigits, "1", TEXT_COLOR);
            layer.place(this.pageDigits, tensX, digitY);
            layer.place(this.pageZero, tensX + 4, digitY);
        }

        for (let i = 0; i < SLOTS_PER_PAGE; i++) {
            const slot = this.arrSlots[i], entry = this.entries[this.page * SLOTS_PER_PAGE + i], offset = SLOT_OFFSETS[i];
            const isPressed = this.isPressed && i === this.pressedSlot;

            slot.icon.hidden = slot.outline.hidden = slot.outlineDown.hidden = slot.toggle.hidden = true;
            slot.acronym.replaceChildren();
            slot.coolTexture = null;
            slot.coolColor = 0xffffff;
            slot.coolTime.hidden = true;
            this.placeSlotTile(slot.fkey, 4, offset - 1, 16, TEX_FKEYS[i]);

            if (!entry) continue;

            if (layer.hasTexture(entry.icon)) this.placeSlotTile(slot.icon, 7, offset, ICON_SIZE, entry.icon);

            this.placeSlotTile(slot.outline, 6, offset - 1, 34, TEX_OUTLINE);

            if (isPressed) this.placeSlotTile(slot.outlineDown, 6, offset - 1, 34, TEX_OUTLINE_DOWN);
            if (entry.isAutoSoulShot) this.placeSlotTile(slot.toggle, 7, offset, ICON_SIZE, TEX_TOGGLE);

            if (entry.acronym) {
                for (let j = 0; j < entry.acronym.length; j++) {
                    const x = 11 + Math.trunc(j / 2) * 13, y = offset + 4 + j % 2 * 13;

                    layer.text(slot.acronym, entry.acronym[j], TEXT_COLOR, undefined, this.isHorizontal ? y : x, this.isHorizontal ? x : y);
                }
            }
        }

        this.renderCoolTimes();
    }
}

export default NCShortCutWnd;
