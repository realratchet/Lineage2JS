import NWnd from "./nwnd";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCTooltip from "./nc-tooltip";
import { DigitFont_T } from "./nwindow-canvas";
import type NWindowCanvas from "./nwindow-canvas";
import type NWindowManager from "./nwindow-manager";
import type { NMouseEvent_T } from "./nwnd";
import type { AbnormalStatus_T } from "../network/game-packets";

type EffectItem_T = AbnormalStatus_T & { alpha: number, isFading: boolean, tooltipTime: number };

const TEX_BACK = "L2UI.EtcWndBack.AbnormalBack";
const TEX_DEBUFF = "L2UI_CH3.PlayerStatusWnd.debuff";

export class NCAbnormalStatusWnd extends NWnd {
    protected readonly grip: NCFrameCtrl;
    protected readonly tooltip = new NCTooltip();
    protected effects: EffectItem_T[] = [];
    protected secondaryEffects: AbnormalStatus_T[] = [];
    protected shortEffect: EffectItem_T = null;
    protected arrTimerElapsed = [0, 0];
    protected hoveredSlot = -1;

    public constructor() {
        super(173, 0);

        this.grip = this.addChild(new NCFrameCtrl(0, 0, 12, 26));
    }

    public getTextures(): string[] { return [TEX_BACK, TEX_DEBUFF, ...this.tooltip.getTextures()]; }

    public attach(manager: NWindowManager) {
        super.attach(manager);
        void this.loadIcons();
    }

    public setEffects(effects: AbnormalStatus_T[]) {
        this.effects = effects.map(effect => ({ ...effect, alpha: 255, isFading: true, tooltipTime: effect.duration }));
        this.hoveredSlot = -1;
        this.updateLayout();

        if (this.manager) void this.loadIcons();

        this.invalidate();
    }

    public setSecondaryEffects(effects: AbnormalStatus_T[]) {
        this.secondaryEffects = effects.slice(0, 10);
        this.updateLayout();

        if (this.manager) void this.loadIcons();

        this.invalidate();
    }

    public setShortEffect(effect: AbnormalStatus_T) {
        this.shortEffect = effect ? { ...effect, alpha: 255, isFading: true, tooltipTime: effect.duration } : null;
        this.updateLayout();

        if (this.manager) void this.loadIcons();

        this.invalidate();
    }

    public tick(deltaSeconds: number) {
        if (!this.manager) return;

        const delta = Math.fround(deltaSeconds);

        for (let i = 0; i < 2; i++) {
            const elapsed = this.arrTimerElapsed[i] + delta, period = (i ? 100 : 1000) * Math.fround(0.001);

            this.arrTimerElapsed[i] = Math.fround(elapsed);

            if (!(elapsed > period)) continue;

            this.arrTimerElapsed[i] = Math.fround(elapsed - period);
            this.onTimer(i ? 233 : 249);
        }
    }

    protected onTimer(id: number) {
        const count = this.effects.length;

        for (let i = 0; i < count + (this.shortEffect ? 1 : 0); i++) {
            const effect = i < count ? this.effects[i] : this.shortEffect;

            if (id === 249) {
                if (effect.duration <= 0) continue;

                effect.duration--;

                const skill = this.manager.strings.skillInfos[`${effect.id}:${effect.level}`];

                effect.tooltipTime = skill && skill.isDebuff ? -1 : effect.duration;
            } else if (effect.duration >= 0 && effect.duration <= 30) {
                if (i < count) {
                    if (effect.alpha < 0) { effect.alpha = 0; effect.isFading = false; }
                    else if (effect.alpha > 255) { effect.alpha = 255; effect.isFading = true; }
                } else {
                    if (effect.alpha === 0) effect.isFading = false;
                    if (effect.alpha === 255) effect.isFading = true;
                }

                effect.alpha += effect.isFading ? -25 : 25;

                if (effect.alpha < 0) { effect.alpha = 0; effect.isFading = false; }
                else if (effect.alpha > 255) { effect.alpha = 255; effect.isFading = true; }
            }
        }

        this.invalidate();
    }

    protected updateLayout() {
        const count = this.effects.length, secondaryCount = this.secondaryEffects.length + (this.shortEffect ? 1 : 0), rows = Math.ceil(Math.min(count, 30) / 10);

        this.width = count > 10 ? 272 : count || secondaryCount ? 12 + Math.max(count, secondaryCount) * 26 : 0;
        this.height = secondaryCount ? 26 + rows * 25 : count ? 1 + rows * 25 : 0;
        this.grip.height = this.height;
    }

    protected getIcon(effect: AbnormalStatus_T) {
        const skill = this.manager.strings.skillInfos[`${effect.id}:${effect.level}`];

        return skill && skill.icon || "NWindow.BlackTexture";
    }

    protected async loadIcons() {
        await this.manager.canvas.loadTextures([...new Set([...this.effects.slice(0, 30), ...this.secondaryEffects, ...(this.shortEffect ? [this.shortEffect] : [])].map(effect => this.getIcon(effect)))]);
        this.invalidate();
    }

    protected getSlotAt(x: number, y: number): number {
        x -= 12;
        if (x < 0 || x > 270 || y < 0 || y > 108) return -1;

        const slot = Math.trunc(y / 27) * 10 + Math.trunc(x / 27);

        const secondaryStart = Math.ceil(Math.min(this.effects.length, 30) / 10) * 10;

        return slot < Math.min(this.effects.length, 30) || slot >= secondaryStart && slot < secondaryStart + this.secondaryEffects.length + (this.shortEffect ? 1 : 0) ? slot : -1;
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
        // NCAbnormalStatusWnd: NWindow RVA 0x10e560 layout, 0x10eef0 countdown and flashing.
        for (let i = 0; i < Math.min(this.effects.length, 30); i++) {
            const effect = this.effects[i];
            const skill = this.manager.strings.skillInfos[`${effect.id}:${effect.level}`];
            const remaining = effect.duration;
            const x = 13 + i % 10 * 26, y = 1 + Math.floor(i / 10) * 25;
            const alpha = effect.alpha;

            canvas.drawTile(x - 1, y - 1, 26, 26, 0, 0, 26, 26, TEX_BACK);
            canvas.drawTile(x, y, 24, 24, 0, 0, 32, 32, this.getIcon(effect), alpha);

            if (skill && skill.isDebuff) canvas.drawTile(x, y, 24, 24, 0, 0, 26, 26, TEX_DEBUFF, alpha);
            else if (remaining >= 0 && remaining < 60) canvas.drawDigits(x + (remaining < 10 ? 7 : 2), y + 10, 0xccdcdcdc, String(remaining), DigitFont_T.LARGE);
        }

        const secondaryRow = Math.ceil(Math.min(this.effects.length, 30) / 10);

        if (this.shortEffect) {
            const effect = this.shortEffect, skill = this.manager.strings.skillInfos[`${effect.id}:${effect.level}`];
            const remaining = effect.duration;
            const x = 13, y = 1 + secondaryRow * 25;
            const alpha = effect.alpha;

            canvas.drawTile(x - 1, y - 1, 26, 26, 0, 0, 26, 26, TEX_BACK);
            canvas.drawTile(x, y, 24, 24, 0, 0, 32, 32, this.getIcon(effect), alpha);

            if (!(skill && skill.isDebuff) && remaining >= 0 && remaining < 60) canvas.drawDigits(x + (remaining < 10 ? 7 : 2), y + 10, 0xccdcdcdc, String(remaining), DigitFont_T.LARGE);
        }

        this.secondaryEffects.forEach((effect, i) => {
            const x = 13 + (i + (this.shortEffect ? 1 : 0)) * 26, y = 1 + secondaryRow * 25;

            canvas.drawTile(x - 1, y - 1, 26, 26, 0, 0, 26, 26, TEX_BACK);
            canvas.drawTile(x, y, 24, 24, 0, 0, 32, 32, this.getIcon(effect));
        });

        const extraSlot = this.hoveredSlot - secondaryRow * 10;
        const isShort = this.shortEffect && extraSlot === 0, isSecondary = extraSlot >= (this.shortEffect ? 1 : 0);
        const effect = isShort ? this.shortEffect : isSecondary ? this.secondaryEffects[extraSlot - (this.shortEffect ? 1 : 0)] : this.effects[this.hoveredSlot];

        if (effect) {
            const time = isSecondary ? -1 : (effect as EffectItem_T).tooltipTime;
            const x = isShort ? 13 : isSecondary ? 13 + extraSlot * 26 : 13 + this.hoveredSlot % 10 * 26;
            const y = 1 + (isShort || isSecondary ? secondaryRow : Math.floor(this.hoveredSlot / 10)) * 25;

            this.tooltip.paint(canvas, this, x, y, NCTooltip.abnormal(this.manager.strings, effect.id, effect.level, time, isSecondary));
        }
    }
}

export default NCAbnormalStatusWnd;
