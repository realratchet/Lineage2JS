import NWnd from "./nwnd";
import NCButton from "./nc-button";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCTooltip from "./nc-tooltip";
import type NCCoolTimeIcon from "./nc-cool-time-icon";
import type { NMouseEvent_T } from "./nwnd";
import type NWindowCanvas from "./nwindow-canvas";

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

const SLOTS_PER_PAGE = 12; // ctor 0x10108ed0(12, 10, 32)
const PAGE_COUNT = 10;
const ICON_SIZE = 32;

const SLOT_OFFSETS = [33, 70, 107, 144, 186, 223, 260, 297, 339, 376, 413, 450]; // start 33 (0x10106994), step icon+5 (0x10106e05), +5 after slots 3 and 7 (0x10106dfc)

const RECT_NEXT = [[31, 13, 14, 14], [13, 1, 14, 14]]; // [x, y, w, h] vertical / horizontal: 0x10109377, 0x1010942d, 0x101094e3; relayout 0x10105b4c, 0x10105b28, 0x10105b6e.
const RECT_PREV = [[1, 13, 14, 14], [13, 31, 14, 14]];
const RECT_ROTATE = [[16, 489, 15, 15], [489, 16, 15, 15]];
const RECT_GRIP = [[0, 0, 46, 12], [0, 0, 12, 46]];

export type ShortcutEntry_T = { icon: string, label: string, tooltip: string, skillKey?: string, isAutoSoulShot?: boolean };

function setRect(wnd: NWnd, [x, y, w, h]: number[]) {
    wnd.x = x;
    wnd.y = y;
    wnd.width = w;
    wnd.height = h;
}

function setButtonTextures(button: NCButton, texture: string) {
    button.normalTexture = texture;
    button.downTexture = `${texture}_down`;
    button.overTexture = `${texture}_over`;
}

export class NCShortCutWnd extends NWnd { // NCShortCutWnd: NCConsole 0x10061d76 SetWindowPos(W - 46, H/2 - 252, 46, 504); paint 0x10106860.
    protected readonly grip: NCFrameCtrl;
    protected readonly nextButton: NCButton;
    protected readonly prevButton: NCButton;
    protected readonly rotateButton: NCButton;
    protected readonly tooltip = new NCTooltip();
    protected readonly entries: ShortcutEntry_T[] = new Array(SLOTS_PER_PAGE * PAGE_COUNT).fill(null);
    protected isHorizontal = false;
    protected page = 0;
    protected hoveredSlot = -1;
    protected pressedSlot = -1;

    public onUse: (page: number, slot: number) => void = null;
    public onAutoSoulShot: (page: number, slot: number) => void = null;

    public constructor(protected readonly coolTimes: Map<string, NCCoolTimeIcon>) {
        super(0, 0, 46, 504);

        this.grip = this.addChild(new NCFrameCtrl());
        this.nextButton = this.addChild(new NCButton(0, 0, 0, 0, TEX_NEXT, `${TEX_NEXT}_down`));
        this.prevButton = this.addChild(new NCButton(0, 0, 0, 0, TEX_PREV, `${TEX_PREV}_down`));
        this.rotateButton = this.addChild(new NCButton(0, 0, 0, 0, TEX_ROTATE, `${TEX_ROTATE}_down`));
        this.nextButton.onPress = () => this.nextPage();
        this.prevButton.onPress = () => this.prevPage();
        this.rotateButton.onPress = () => this.rotate();
        this.layoutChildren();

        window.addEventListener("keydown", event => {
            const target = event.target as HTMLElement;

            if (!this.isVisible || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

            const match = /^F(\d+)$/.exec(event.key);

            if (!match || Number(match[1]) > SLOTS_PER_PAGE) return;

            event.preventDefault();

            if (this.onUse) this.onUse(this.page, Number(match[1]) - 1);
        });
    }

    public getTextures(): string[] {
        return [
            TEX_BACK, TEX_BACKV, TEX_OUTLINE, TEX_OUTLINE_DOWN, TEX_TOGGLE, TEX_SMALLBAR1, TEX_SMALLBAR2, TEX_SMALLBAR3, TEX_SMALLBAR_H1, TEX_SMALLBAR_H2, TEX_SMALLBAR_H3, ...TEX_FKEYS, ...this.tooltip.getTextures(),
            ...[TEX_NEXT, TEX_NEXTV, TEX_PREV, TEX_PREVV].flatMap(texture => [texture, `${texture}_down`, `?${texture}_over`]), `?${TEX_ROTATE}_over`
        ];
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) {
        if (this.isHorizontal) return;

        this.x = Math.trunc(screenWidth - 46);
        this.y = Math.trunc(screenHeight * 0.5 - 252);
    }

    public getPage() { return this.page; }

    public hasCoolTime(key: string) {
        return this.isVisible && this.entries.slice(this.page * SLOTS_PER_PAGE, (this.page + 1) * SLOTS_PER_PAGE).some(entry => entry && entry.skillKey === key);
    }

    public clearSlots() {
        this.entries.fill(null);
        this.hoveredSlot = this.pressedSlot = -1;
        this.invalidate();
    }

    public setSlot(page: number, slot: number, entry: ShortcutEntry_T) {
        this.entries[page * SLOTS_PER_PAGE + slot] = entry;

        if (entry) void this.loadIcon(entry.icon);

        this.invalidate();
    }

    protected async loadIcon(path: string) {
        await this.manager.canvas.loadTextures([path]);

        this.invalidate();
    }

    protected nextPage() { // 0x10108c30 / 0x10108ca0 wrap between the first and last page.
        this.page = this.page < PAGE_COUNT - 1 ? this.page + 1 : 0;
        this.invalidate();
    }

    protected prevPage() {
        this.page = this.page > 0 ? this.page - 1 : PAGE_COUNT - 1;
        this.invalidate();
    }

    protected rotate() { // slot80 0x10106300 -> slot75 0x101058e0: swap w/h around x+W-H, y+H-W, clamped to >= 0.
        const w = this.width, h = this.height;

        this.isHorizontal = !this.isHorizontal;
        this.x = Math.max(0, this.x + w - h);
        this.y = Math.max(0, this.y + h - w);
        this.width = h;
        this.height = w;
        this.layoutChildren();
        this.invalidate();
    }

    protected layoutChildren() {
        const layout = this.isHorizontal ? 1 : 0;

        setRect(this.grip, RECT_GRIP[layout]);
        setRect(this.nextButton, RECT_NEXT[layout]);
        setRect(this.prevButton, RECT_PREV[layout]);
        setRect(this.rotateButton, RECT_ROTATE[layout]);
        setButtonTextures(this.nextButton, this.isHorizontal ? TEX_NEXTV : TEX_NEXT); // The vertical bar shows the left/right arrows (L2.4_20 capture); the "v" up/down pair belongs to the horizontal bar.
        setButtonTextures(this.prevButton, this.isHorizontal ? TEX_PREVV : TEX_PREV);
    }

    public getSlotAt(x: number, y: number): number { // 0x101060f0: cross axis 6..38, along axis offset..offset+32, both inclusive.
        const across = this.isHorizontal ? y : x, along = this.isHorizontal ? x : y;

        if (across < 6 || across > ICON_SIZE + 6) return -1;

        for (let i = 0; i < SLOTS_PER_PAGE; i++)
            if (along >= SLOT_OFFSETS[i] && along <= SLOT_OFFSETS[i] + ICON_SIZE) return i;

        return -1;
    }

    public onMouseMove(event: NMouseEvent_T) {
        const slot = this.getSlotAt(event.x, event.y);

        if (slot === this.hoveredSlot) return;

        this.hoveredSlot = slot;
        this.invalidate();
    }

    public onMouseLeave() {
        this.hoveredSlot = -1;
        this.invalidate();
    }

    public onMouseDown(event: NMouseEvent_T) {
        if (event.button === 2) {
            const slot = this.getSlotAt(event.x, event.y);

            if (slot >= 0 && this.onAutoSoulShot) this.onAutoSoulShot(this.page, slot);
            return;
        }
        if (event.button !== 0) return;

        this.pressedSlot = this.getSlotAt(event.x, event.y);
        if (this.pressedSlot >= 0) this.manager.playButtonSound(!!this.entries[this.page * SLOTS_PER_PAGE + this.pressedSlot]);
        this.invalidate();
    }

    public onClick(event: NMouseEvent_T) {
        const slot = this.getSlotAt(event.x, event.y);

        if (event.button !== 0 || slot < 0 || slot !== this.pressedSlot) return;

        if (this.onUse) this.onUse(this.page, slot);
    }

    protected drawSlot(canvas: NWindowCanvas, slot: number, offset: number) {
        const entry = this.entries[this.page * SLOTS_PER_PAGE + slot];
        const isPressed = slot === this.pressedSlot && this.manager.isPressed(this);
        const horizontal = this.isHorizontal;

        function tile(across: number, along: number, size: number, texture: string, color: number = 0xffffff) {
            if (horizontal) canvas.drawTile(along, across, size, size, 0, 0, size, size, texture, 255, color);
            else canvas.drawTile(across, along, size, size, 0, 0, size, size, texture, 255, color);
        }

        if (entry) {
            if (canvas.hasTexture(entry.icon)) tile(7, offset, ICON_SIZE, entry.icon);

            tile(6, offset - 1, 34, TEX_OUTLINE);

            if (isPressed) tile(6, offset - 1, 34, TEX_OUTLINE_DOWN);
            if (entry.isAutoSoulShot) tile(7, offset, ICON_SIZE, TEX_TOGGLE);

            const coolTime = this.coolTimes.get(entry.skillKey);

            if (coolTime && coolTime.texture && canvas.hasTexture(coolTime.texture)) tile(7, offset, ICON_SIZE, coolTime.texture, coolTime.color);
        }

        tile(4, offset - 1, 16, TEX_FKEYS[slot]);
    }

    public onPaint(canvas: NWindowCanvas) {
        const W = this.width, H = this.height, text = String(this.page + 1);

        if (this.isHorizontal) {
            canvas.drawTile(12, 0, 492, 46, 0, 0, 492, 46, TEX_BACK);
            canvas.drawTile(0, 0, 12, 8, 0, 0, 12, 8, TEX_SMALLBAR1);
            canvas.drawTile(0, 8, 12, H - 16, 0, 0, 12, 8, TEX_SMALLBAR2);
            canvas.drawTile(0, H - 8, 12, 8, 0, 0, 12, 8, TEX_SMALLBAR3);
        } else {
            canvas.drawTile(0, 12, 46, 492, 0, 0, 46, 492, TEX_BACKV);
            canvas.drawTile(0, 0, 8, 12, 0, 0, 8, 12, TEX_SMALLBAR_H3);
            canvas.drawTile(8, 0, W - 16, 12, 0, 0, 8, 12, TEX_SMALLBAR_H2);
            canvas.drawTile(W - 8, 0, 8, 12, 0, 0, 8, 12, TEX_SMALLBAR_H1);
        }

        const [centerX, digitY, tensX] = this.isHorizontal ? [19, 18, 14] : [22, 16, 17]; // 0x10106903 / 0x10106eb7: centred on the SmallFont extent (0x10012960); page 10 is placed per digit.

        if (this.page + 1 < 10) canvas.drawDigits(centerX - Math.trunc(canvas.measureText(text) / 2), digitY, TEXT_COLOR, text);
        else {
            canvas.drawDigits(tensX, digitY, TEXT_COLOR, "1");
            canvas.drawDigits(tensX + 4, digitY, TEXT_COLOR, "0");
        }

        for (let i = 0; i < SLOTS_PER_PAGE; i++) this.drawSlot(canvas, i, SLOT_OFFSETS[i]);
    }

    public paint(canvas: NWindowCanvas) { // slot63 0x101097e0: tooltip pass after the children, anchored at the icon corner.
        super.paint(canvas);

        if (!this.isVisible || this.hoveredSlot < 0) return;

        const entry = this.entries[this.page * SLOTS_PER_PAGE + this.hoveredSlot];

        if (!entry) return;

        const offset = SLOT_OFFSETS[this.hoveredSlot];

        canvas.setOrigin(this.getScreenX(), this.getScreenY());

        if (this.isHorizontal) this.tooltip.paint(canvas, this, offset, 7, entry.tooltip);
        else this.tooltip.paint(canvas, this, 7, offset, entry.tooltip);
    }
}

export default NCShortCutWnd;
