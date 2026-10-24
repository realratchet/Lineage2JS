import NCStatusWnd from "./nc-status-wnd";
import type NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";
import type { PetStatus_T, AbnormalStatus_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.SmallWnd.smallwindow_back";
const arrBars = ["HPBAR", "MPBAR", "FATIGUEBAR"].map(name => `L2UI_CH3.SmallWnd.${name}`);
const TEX_BUTTON = "L2UI_CH3.Etc.pet_button";
const HEIGHT = 46;

export class NCPetStatusWnd extends NCStatusWnd {
    public static getTextures(): string[] { return [...NCStatusWnd.getTextures(), `${TEX_BACK}1`, `${TEX_BACK}2`, `${TEX_BACK}3_ex`, TEX_BUTTON, `${TEX_BUTTON}_down`, `?${TEX_BUTTON}_over`, ...arrBars, ...arrBars.map(path => `${path}_BACK`)]; }

    public onTargetAction: (objectId: number, shift: boolean) => void = null;
    protected readonly arrBarBacks: HTMLDivElement[];
    protected readonly arrBarFills: HTMLDivElement[];
    protected readonly effects: HTMLDivElement;
    protected readonly button: NDomButton_T;
    protected info: PetStatus_T = null;
    protected arrEffects: AbnormalStatus_T[] = [];
    protected areEffectsVisible = false;
    protected gaugeMaximum = 10000;
    protected gaugeElapsed = 0;
    protected isGaugePaused = true;
    protected isGaugeInitialized = false;

    public constructor(layer: NDomLayer, protected readonly statusType: number = 2) {
        super(layer, statusType === 1 ? "SummonedStatusWnd" : "PetStatusWnd", 0, 76, HEIGHT);

        this.arrBarBacks = arrBars.map(texture => layer.tile(this.element, 16, 0, 0, 5, 0, 0, 8, 6, `${texture}_BACK`));
        this.arrBarFills = arrBars.map(texture => layer.tile(this.element, 16, 0, 0, 5, 0, 0, 8, 6, texture));
        this.effects = layer.createWindow(0, 0, 0, 0, this.element);
        this.effects.style.pointerEvents = "none";
        this.button = layer.button(this.element, 1, 6, 11, 13, TEX_BUTTON, `${TEX_BUTTON}_down`, null, null, () => { this.areEffectsVisible = !this.areEffectsVisible; this.update(); });
        layer.tooltip(this.element, this.button, layer.getManager().getSysString(881), 0);
        this.button.addEventListener("mousedown", event => { if (event.detail > 1) event.stopImmediatePropagation(); }, true);
        this.createSizeCtrl();
        this.element.addEventListener("mousedown", event => {
            const target = event.target as Node;

            if (event.button !== 0 || event.detail > 1 || this.button.contains(target) || this.grip.contains(target) || this.sizeCtrl.contains(target) || !this.info || this.info.objectId <= 0) return;
            if (layer.toUI(event.clientX) - layer.toUI(this.element.getBoundingClientRect().left) <= 13) return;

            if (this.onTargetAction) this.onTargetAction(this.info.objectId, event.shiftKey);
        });
        this.update();
    }

    public placeOnScreen() { this.restoreWidth(); }

    public setInfo(info: PetStatus_T) {
        this.info = info;
        this.update();
    }

    public setVisible(visible: boolean) {
        super.setVisible(visible);
        if (visible && (!this.info || this.info.objectId === -1 || this.info.statusType !== this.statusType)) super.setVisible(false);
    }

    public showStatus() {
        if (this.isVisible()) return;

        this.setVisible(!!this.info && this.info.objectId !== -1 && this.info.statusType === this.statusType);
        this.setEffects([]);
    }

    public setEffects(effects: AbnormalStatus_T[]) {
        this.arrEffects = effects;
        void this.loadIcons();
    }

    protected getIcon(id: number) {
        const skill = this.layer.getManager().strings.skillInfos[`${id}:1`];

        return skill && skill.icon;
    }

    protected async loadIcons() {
        await this.layer.loadTextures([...new Set(this.arrEffects.slice(0, 20).map(effect => this.getIcon(effect.id)).filter(Boolean))]);
        this.update();
    }

    public setRemainTime(maximum: number, remaining: number) {
        if (!this.isGaugeInitialized) {
            this.setEffects([]);
            this.isGaugeInitialized = true;
            this.gaugeMaximum = maximum >>> 0;
            this.isGaugePaused = false;
        } else this.gaugeElapsed = (this.gaugeMaximum - remaining) >>> 0;

        this.update();
    }

    public resetGauge() {
        this.isGaugePaused = true;
        this.gaugeElapsed = 0;
        this.isGaugeInitialized = false;
        this.update();
    }

    public tick(deltaTime: number) {
        if (this.isGaugePaused || !this.isVisible() || !this.info || this.statusType !== 1) return;

        this.gaugeElapsed = (this.gaugeElapsed + Math.trunc(Math.fround(deltaTime / 1000) * 1000)) >>> 0;
        if (this.gaugeElapsed >= this.gaugeMaximum) {
            this.gaugeElapsed = this.gaugeMaximum;
            this.isGaugePaused = true;
        }

        this.updateGauge();
    }

    protected updateGauge() {
        const barWidth = this.width - 22;

        if (!this.info || this.statusType !== 1) return;
        if (!this.gaugeMaximum) throw new Error(`Invalid summon gauge maximum ${this.gaugeMaximum}.`);

        const fill = (barWidth - Math.trunc((Math.imul(this.gaugeElapsed, barWidth) >>> 0) / this.gaugeMaximum)) | 0;

        this.layer.placeTile(this.arrBarBacks[2], 16, 33, barWidth, 6, 0, 0, barWidth, 6, `${arrBars[2]}_BACK`);
        this.layer.placeTile(this.arrBarFills[2], 16, 33, fill, 6, 0, 0, barWidth, 6, arrBars[2]);
    }

    protected update() {
        const layer = this.layer, width = this.width, barWidth = width - 22, info = this.info;

        this.layoutFrame(HEIGHT, [`${TEX_BACK}1`, `${TEX_BACK}2`, `${TEX_BACK}3_ex`], HEIGHT);
        this.setName(info ? info.name || "" : "", 0xffdcdcdc, 12, 6, width - 12);
        this.effects.replaceChildren();

        for (let i = 0; i < 3; i++) {
            const isShown = !!info && i < (this.statusType === 1 ? 2 : 3);

            this.arrBarBacks[i].hidden = this.arrBarFills[i].hidden = !isShown;
            if (!isShown) continue;

            const current = i === 0 ? info.curHp : i === 1 ? info.curMp : info.curFood, maximum = i === 0 ? info.maxHp : i === 1 ? info.maxMp : info.maxFood;

            // NWindow 0x1010f930/0x1010f950/0x1010f975 leave zero-maximum widths undefined.
            if (!maximum) throw new Error(`Invalid pet status bar maximum ${maximum}.`);

            const fill = Math.trunc(Math.imul(current, barWidth) / maximum), y = 19 + i * 7;

            layer.placeTile(this.arrBarBacks[i], 16, y, barWidth, 5, 0, 0, 8, 6, `${arrBars[i]}_BACK`);
            layer.placeTile(this.arrBarFills[i], 16, y, fill, this.statusType === 1 ? 5 : 6, 0, 0, 8, 6, arrBars[i]);
        }

        this.updateGauge();

        if (info && this.areEffectsVisible) for (let i = 0; i < Math.min(20, this.arrEffects.length); i++) {
            const icon = this.getIcon(this.arrEffects[i].id), texture = icon && layer.hasTexture(icon) && layer.getManager().canvas.getTexture(icon);

            if (texture) layer.tile(this.effects, width + 1 + i % 10 * 16, 5 + Math.trunc(i / 10) * 16, 16, 16, 0, 0, texture.width, texture.height, icon);
        }
    }
}

export default NCPetStatusWnd;
