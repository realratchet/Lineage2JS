import NWnd from "./nwnd";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCTooltip from "./nc-tooltip";
import { DigitFont_T } from "./nwindow-canvas";
import type NWindowCanvas from "./nwindow-canvas";
import type NWindowManager from "./nwindow-manager";
import type { NMouseEvent_T } from "./nwnd";
import type { AbnormalStatus_T } from "../network/game-packets";

const TEX_BACK = "L2UI.EtcWndBack.AbnormalBack";

export class NCAbnormalStatusWnd extends NWnd {
    protected readonly grip: NCFrameCtrl;
    protected readonly tooltip = new NCTooltip();
    protected effects: AbnormalStatus_T[] = [];
    protected receivedAt = 0;
    protected hoveredSlot = -1;

    public constructor() {
        super(173, 0);

        this.grip = this.addChild(new NCFrameCtrl(0, 0, 12, 26));
    }

    public getTextures(): string[] { return [TEX_BACK, ...this.tooltip.getTextures()]; }

    public attach(manager: NWindowManager) {
        super.attach(manager);
        void this.loadIcons();
    }

    public setEffects(effects: AbnormalStatus_T[]) {
        this.effects = effects;
        this.receivedAt = performance.now();
        this.hoveredSlot = -1;
        this.width = effects.length ? 12 + Math.min(effects.length, 10) * 26 : 0;
        this.height = effects.length ? 1 + Math.ceil(Math.min(effects.length, 30) / 10) * 25 : 0;
        this.grip.height = this.height;

        if (this.manager) void this.loadIcons();

        this.invalidate();
    }

    protected getIcon(id: number) { return this.manager.strings.skillIcons[id] || "NWindow.BlackTexture"; }

    protected async loadIcons() {
        await this.manager.canvas.loadTextures([...new Set(this.effects.slice(0, 30).map(effect => this.getIcon(effect.id)))]);
        this.invalidate();
    }

    protected getSlotAt(x: number, y: number): number {
        if (x < 13 || y < 1 || (x - 13) % 26 >= 24 || (y - 1) % 25 >= 24) return -1;

        const column = Math.floor((x - 13) / 26), row = Math.floor((y - 1) / 25), slot = row * 10 + column;

        return column < 10 && slot < Math.min(this.effects.length, 30) ? slot : -1;
    }

    public hitTest(x: number, y: number): NWnd {
        if (x >= 12 && this.getSlotAt(x, y) < 0) return null;

        return super.hitTest(x, y);
    }

    public onMouseMove(event: NMouseEvent_T) {
        this.hoveredSlot = this.getSlotAt(event.x, event.y);
        this.invalidate();
    }

    public onMouseLeave() {
        this.hoveredSlot = -1;
        this.invalidate();
    }

    public onPaint(canvas: NWindowCanvas) {
        const elapsed = performance.now() - this.receivedAt;

        // NCAbnormalStatusWnd: NWindow RVA 0x10e560 layout, 0x10eef0 countdown and flashing.
        for (let i = 0; i < Math.min(this.effects.length, 30); i++) {
            const effect = this.effects[i];
            const remaining = effect.duration < 0 ? -1 : Math.max(0, effect.duration - Math.floor(elapsed / 1000));
            const x = 13 + i % 10 * 26, y = 1 + Math.floor(i / 10) * 25;
            const alpha = remaining >= 0 && remaining <= 30 ? Math.min(255, Math.abs(11 - Math.floor(elapsed / 100) % 22) * 25) : 255;

            canvas.drawTile(x - 1, y - 1, 26, 26, 0, 0, 26, 26, TEX_BACK);
            canvas.drawTile(x, y, 24, 24, 0, 0, 32, 32, this.getIcon(effect.id), alpha);

            if (remaining >= 0 && remaining < 60) canvas.drawDigits(x + (remaining < 10 ? 7 : 2), y + 10, 0xccdcdcdc, String(remaining), DigitFont_T.LARGE);
        }

        const effect = this.effects[this.hoveredSlot];

        if (effect) {
            const remaining = effect.duration < 0 ? -1 : Math.max(0, effect.duration - Math.floor(elapsed / 1000));
            const name = this.manager.strings.skillNames[effect.id] || `skill#${effect.id}`;
            const duration = remaining < 0 ? "" : ` (${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")})`;

            this.tooltip.paint(canvas, this, 13 + this.hoveredSlot % 10 * 26, 1 + Math.floor(this.hoveredSlot / 10) * 25, `${name} Lv ${effect.level}${duration}`);
        }
    }
}

export default NCAbnormalStatusWnd;
