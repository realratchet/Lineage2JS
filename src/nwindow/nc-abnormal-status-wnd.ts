import NCFrameCtrl from "./nc-frame-ctrl";
import NCTooltip from "./nc-tooltip";
import { DigitFont_T } from "./nwindow-canvas";
import type NDomLayer from "./ndom";
import type { AbnormalStatus_T } from "../network/game-packets";

type EffectItem_T = AbnormalStatus_T & { alpha: number, isFading: boolean, tooltipTime: number };
type EffectSlot_T = { back: HTMLDivElement, icon: HTMLDivElement, debuff: HTMLDivElement, digits: HTMLDivElement };

const TEX_BACK = "L2UI.EtcWndBack.AbnormalBack";
const TEX_DEBUFF = "L2UI_CH3.PlayerStatusWnd.debuff";
const TEX_FRAME = "L2UI_CH3.FrameCtrl.smallbar";

export class NCAbnormalStatusWnd {
    public static getTextures(): string[] { return [TEX_BACK, TEX_DEBUFF, TEX_FRAME + "1", TEX_FRAME + "2", TEX_FRAME + "3", "NWindow.BlackTexture"]; }

    public readonly element: HTMLDivElement;
    protected readonly arrFrame: HTMLDivElement[];
    protected readonly arrSlots: EffectSlot_T[] = [];
    protected readonly slots: HTMLDivElement;
    protected readonly grip: HTMLDivElement;
    protected readonly tooltip = new NCTooltip();
    protected effects: EffectItem_T[] = [];
    protected secondaryEffects: AbnormalStatus_T[] = [];
    protected shortEffect: EffectItem_T = null;
    protected arrTimerElapsed = [0, 0];
    protected hoveredSlot = -1;
    protected hoveredTooltip: HTMLDivElement = null;
    protected width = 0;
    protected height = 0;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(173, 0, 0, 0);
        this.element.hidden = true;
        this.element.classList.add("ndom-opaque");
        this.arrFrame = [1, 2, 3].map(index => layer.tile(this.element, 0, 0, 12, 8, 0, 0, 12, 8, TEX_FRAME + index));
        this.slots = layer.createWindow(0, 0, 0, 0, this.element);
        this.grip = NCFrameCtrl.createGrip(layer, this.element, 0, 0, 12, 0);
        this.element.addEventListener("mousemove", event => {
            const rect = this.element.getBoundingClientRect();

            this.setHoveredSlot(this.getSlotAt(layer.toUI(event.clientX - rect.left), layer.toUI(event.clientY - rect.top)));
        });
        this.element.addEventListener("mouseleave", () => this.setHoveredSlot(-1));
    }

    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }
    public placeOnScreen() { }
    public getEffects() { return this.effects; }

    public setEffects(effects: AbnormalStatus_T[]) {
        this.effects = effects.map(effect => ({ ...effect, alpha: 255, isFading: true, tooltipTime: effect.duration }));
        this.hoveredSlot = -1;
        void this.loadIcons();
    }

    public setSecondaryEffects(effects: AbnormalStatus_T[]) {
        this.secondaryEffects = effects.slice(0, 10);
        void this.loadIcons();
    }

    public setShortEffect(effect: AbnormalStatus_T) {
        this.shortEffect = effect ? { ...effect, alpha: 255, isFading: true, tooltipTime: effect.duration } : null;
        void this.loadIcons();
    }

    public tick(deltaSeconds: number) {
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
        const count = this.effects.length, strings = this.layer.getManager().strings;

        for (let i = 0; i < count + (this.shortEffect ? 1 : 0); i++) {
            const effect = i < count ? this.effects[i] : this.shortEffect;

            if (id === 249) {
                if (effect.duration <= 0) continue;

                effect.duration--;

                const skill = strings.skillInfos[`${effect.id}:${effect.level}`];

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

        this.update();
    }

    protected updateLayout() {
        const count = this.effects.length, secondaryCount = this.secondaryEffects.length + (this.shortEffect ? 1 : 0), rows = Math.ceil(Math.min(count, 30) / 10);
        const H = secondaryCount ? 26 + rows * 25 : count ? 1 + rows * 25 : 0, layer = this.layer;

        this.width = count > 10 ? 272 : count || secondaryCount ? 12 + Math.max(count, secondaryCount) * 26 : 0;
        this.height = H;
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${H}px`;
        layer.place(this.grip, 0, 0, 12, H);
        layer.placeTile(this.arrFrame[0], 0, 0, H ? 12 : 0, 8, 0, 0, 12, 8, TEX_FRAME + "1");
        layer.placeTile(this.arrFrame[1], 0, 8, 12, H - 16, 0, 0, 12, 8, TEX_FRAME + "2");
        layer.placeTile(this.arrFrame[2], 0, H - 8, H ? 12 : 0, 8, 0, 0, 12, 8, TEX_FRAME + "3");
    }

    protected getIcon(effect: AbnormalStatus_T) {
        const skill = this.layer.getManager().strings.skillInfos[`${effect.id}:${effect.level}`];

        return skill && skill.icon || "NWindow.BlackTexture";
    }

    protected async loadIcons() {
        await this.layer.loadTextures([...new Set([...this.effects.slice(0, 30), ...this.secondaryEffects, ...(this.shortEffect ? [this.shortEffect] : [])].map(effect => this.getIcon(effect)))]);
        this.updateLayout();
        this.update();
    }

    protected getSlotAt(x: number, y: number): number {
        x -= 12;
        if (x < 0 || x > 270 || y < 0 || y > 108) return -1;

        const slot = Math.trunc(y / 27) * 10 + Math.trunc(x / 27);

        const secondaryStart = Math.ceil(Math.min(this.effects.length, 30) / 10) * 10;

        return slot < Math.min(this.effects.length, 30) || slot >= secondaryStart && slot < secondaryStart + this.secondaryEffects.length + (this.shortEffect ? 1 : 0) ? slot : -1;
    }

    protected setHoveredSlot(slot: number) {
        if (slot === this.hoveredSlot) return;

        this.hoveredSlot = slot;
        this.updateTooltip();
    }

    protected getSlot(index: number) {
        const layer = this.layer;

        while (this.arrSlots.length <= index) {
            const back = layer.tile(this.slots, 0, 0, 26, 26, 0, 0, 26, 26, TEX_BACK), icon = layer.tile(this.slots, 0, 0, 24, 24, 0, 0, 32, 32, TEX_BACK), debuff = layer.tile(this.slots, 0, 0, 24, 24, 0, 0, 26, 26, TEX_DEBUFF);

            this.arrSlots.push({ back, icon, debuff, digits: layer.digits(this.slots, "", 0xccdcdcdc, DigitFont_T.LARGE, 0, 0) });
        }

        return this.arrSlots[index];
    }

    protected paintSlot(index: number, x: number, y: number, effect: AbnormalStatus_T, alpha: number, isDebuff: boolean, remaining: number) {
        const slot = this.getSlot(index), layer = this.layer, showDigits = !isDebuff && remaining >= 0 && remaining < 60, icon = this.getIcon(effect);

        slot.back.hidden = false;
        slot.icon.hidden = !layer.hasTexture(icon);
        layer.place(slot.back, x - 1, y - 1);
        if (!slot.icon.hidden) {
            layer.place(slot.icon, x, y);
            layer.setTile(slot.icon, 24, 24, 0, 0, 32, 32, icon);
            layer.setAlpha(slot.icon, alpha);
        }
        slot.debuff.hidden = !isDebuff;
        if (isDebuff) {
            layer.place(slot.debuff, x, y);
            layer.setAlpha(slot.debuff, alpha);
        }
        slot.digits.hidden = !showDigits;
        if (showDigits) {
            layer.renderDigits(slot.digits, String(remaining), 0xccdcdcdc, DigitFont_T.LARGE);
            layer.place(slot.digits, x + (remaining < 10 ? 7 : 2), y + 10);
        }
    }

    protected update() { // NCAbnormalStatusWnd: NWindow RVA 0x10e560 layout, 0x10eef0 countdown and flashing.
        const strings = this.layer.getManager().strings, secondaryRow = Math.ceil(Math.min(this.effects.length, 30) / 10);
        let index = 0;

        for (let i = 0; i < Math.min(this.effects.length, 30); i++) {
            const effect = this.effects[i], skill = strings.skillInfos[`${effect.id}:${effect.level}`];

            this.paintSlot(index++, 13 + i % 10 * 26, 1 + Math.floor(i / 10) * 25, effect, effect.alpha, !!(skill && skill.isDebuff), effect.duration);
        }

        if (this.shortEffect) {
            const effect = this.shortEffect, skill = strings.skillInfos[`${effect.id}:${effect.level}`];
            const isDebuff = !!(skill && skill.isDebuff);

            this.paintSlot(index++, 13, 1 + secondaryRow * 25, effect, effect.alpha, false, isDebuff ? -1 : effect.duration);
        }

        this.secondaryEffects.forEach((effect, i) => this.paintSlot(index++, 13 + (i + (this.shortEffect ? 1 : 0)) * 26, 1 + secondaryRow * 25, effect, 255, false, -1));

        for (let i = index; i < this.arrSlots.length; i++) {
            const slot = this.arrSlots[i];

            slot.back.hidden = slot.icon.hidden = slot.debuff.hidden = slot.digits.hidden = true;
        }

        this.updateTooltip();
    }

    protected updateTooltip() {
        const secondaryRow = Math.ceil(Math.min(this.effects.length, 30) / 10), extraSlot = this.hoveredSlot - secondaryRow * 10;
        const isShort = this.shortEffect && extraSlot === 0, isSecondary = extraSlot >= (this.shortEffect ? 1 : 0);
        const effect = this.hoveredSlot < 0 ? null : isShort ? this.shortEffect : isSecondary ? this.secondaryEffects[extraSlot - (this.shortEffect ? 1 : 0)] : this.effects[this.hoveredSlot];

        if (this.hoveredTooltip) this.hoveredTooltip.remove();
        this.hoveredTooltip = null;

        if (!effect) return;

        const time = isSecondary ? -1 : (effect as EffectItem_T).tooltipTime;
        const x = isShort ? 13 : isSecondary ? 13 + extraSlot * 26 : 13 + this.hoveredSlot % 10 * 26;
        const y = 1 + (isShort || isSecondary ? secondaryRow : Math.floor(this.hoveredSlot / 10)) * 25;

        this.hoveredTooltip = this.tooltip.createDOM(this.layer, this.element, parseFloat(this.element.style.left) + x, parseFloat(this.element.style.top) + y, NCTooltip.abnormal(this.layer.getManager().strings, effect.id, effect.level, time, isSecondary));
    }
}

export default NCAbnormalStatusWnd;
