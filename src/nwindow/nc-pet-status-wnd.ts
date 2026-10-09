import NWnd, { type NMouseEvent_T } from "./nwnd";
import NCButton from "./nc-button";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCNameCtrl from "./nc-name-ctrl";
import NCStatusSizeCtrl from "./nc-status-size-ctrl";
import NCTooltip from "./nc-tooltip";
import type NWindowCanvas from "./nwindow-canvas";
import type NWindowManager from "./nwindow-manager";
import type { PetStatus_T, AbnormalStatus_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.SmallWnd.smallwindow_back";
const TEX_FRAME = "L2UI_CH3.FrameCtrl.smallbar";
const arrBars = ["HPBAR", "MPBAR", "FATIGUEBAR"].map(name => `L2UI_CH3.SmallWnd.${name}`);
const TEX_BUTTON = "L2UI_CH3.Etc.pet_button";

class NCStatusButton extends NCButton {
    public onMouseDown(event: NMouseEvent_T) { if (!(event.clickCount > 1)) super.onMouseDown(event); }
    public onClick(event: NMouseEvent_T) { if (!(event.clickCount > 1)) super.onClick(event); }
}

export class NCPetStatusWnd extends NWnd {
    public onTargetAction: (objectId: number, shift: boolean) => void = null;
    protected readonly button: NCButton;
    protected readonly resizeCtrl: NCStatusSizeCtrl;
    protected readonly nameCtrl: NCNameCtrl;
    protected readonly tooltip = new NCTooltip();
    protected info: PetStatus_T = null;
    protected effects: AbnormalStatus_T[] = [];
    protected areEffectsVisible = false;
    protected gaugeMaximum = 10000;
    protected gaugeElapsed = 0;
    protected isGaugePaused = true;
    protected isGaugeInitialized = false;
    protected frameDelta = 0;
    protected sizeDelta = 0;

    public constructor(protected readonly statusType: number = 2) {
        super(0, 76, 172, 46);

        this.isVisible = false;
        this.addChild(new NCFrameCtrl(0, 0, 12, 46));
        this.button = this.addChild(new NCStatusButton(1, 6, 11, 13, TEX_BUTTON, `${TEX_BUTTON}_down`));
        this.button.onPress = () => { this.areEffectsVisible = !this.areEffectsVisible; this.invalidate(); };
        this.nameCtrl = this.addChild(new NCNameCtrl(12, 6, this.width - 12, 14));
        this.resizeCtrl = this.addChild(new NCStatusSizeCtrl(this));
    }

    public getTextures(): string[] { return [TEX_BACK + "1", TEX_BACK + "2", TEX_BACK + "3_ex", TEX_FRAME + "1", TEX_FRAME + "2", TEX_FRAME + "3", ...arrBars, ...arrBars.map(path => `${path}_BACK`), ...this.tooltip.getTextures()]; }

    public attach(manager: NWindowManager) {
        super.attach(manager);
        void this.loadIcons();
    }

    public setInfo(info: PetStatus_T) {
        this.info = info;
        this.nameCtrl.setText(info.name || "");
        this.invalidate();
    }

    public showStatus() {
        if (this.isVisible) return;

        this.setVisible(!!this.info && this.info.objectId !== -1 && this.info.statusType === this.statusType);
        this.setEffects([]);
        this.manager.bringToFront(this);
    }

    public setEffects(effects: AbnormalStatus_T[]) {
        this.effects = effects;
        if (this.manager) void this.loadIcons();
        this.invalidate();
    }

    protected getIcon(id: number) {
        const skill = this.manager.strings.skillInfos[`${id}:1`];

        return skill && skill.icon;
    }

    protected async loadIcons() {
        await this.manager.canvas.loadTextures([...new Set(this.effects.slice(0, 20).map(effect => this.getIcon(effect.id)).filter(Boolean))]);
        this.invalidate();
    }

    public resize(delta: number) {
        const size = Math.max(0, Math.min(202, this.sizeDelta + delta)), change = size - this.sizeDelta;

        this.sizeDelta = size;
        this.width += change;
        this.nameCtrl.width += change;
        this.resizeCtrl.x += change;
        this.invalidate();
    }

    public setRemainTime(maximum: number, remaining: number) {
        if (!this.isGaugeInitialized) {
            this.setEffects([]);
            this.isGaugeInitialized = true;
            this.gaugeMaximum = maximum >>> 0;
            this.isGaugePaused = false;
        } else this.gaugeElapsed = (this.gaugeMaximum - remaining) >>> 0;

        this.invalidate();
    }

    public resetGauge() {
        this.isGaugePaused = true;
        this.gaugeElapsed = 0;
        this.isGaugeInitialized = false;
        this.invalidate();
    }

    public tick(deltaTime: number) { this.frameDelta = Math.fround(deltaTime / 1000); }

    public hitTest(x: number, y: number): NWnd {
        const hit = super.hitTest(x, y);

        return hit === this.nameCtrl ? this : hit;
    }

    public onMouseDown(event: NMouseEvent_T) {
        if (event.button !== 0 || event.clickCount > 1 || event.x <= 13 || !this.info || this.info.objectId <= 0) return;

        if (this.onTargetAction) this.onTargetAction(this.info.objectId, event.shift);
    }

    protected paintGauge(canvas: NWindowCanvas, width: number) {
        if (!this.isGaugePaused) {
            this.gaugeElapsed = (this.gaugeElapsed + Math.trunc(this.frameDelta * 1000)) >>> 0;
            if (this.gaugeElapsed >= this.gaugeMaximum) {
                this.gaugeElapsed = this.gaugeMaximum;
                this.isGaugePaused = true;
            } else canvas.isAnimating = true;
        }
        if (!this.gaugeMaximum) throw new Error(`Invalid summon gauge maximum ${this.gaugeMaximum}.`);

        const fill = (width - Math.trunc((Math.imul(this.gaugeElapsed, width) >>> 0) / this.gaugeMaximum)) | 0;

        canvas.drawTile(16, 33, width, 6, 0, 0, width, 6, `${arrBars[2]}_BACK`);
        canvas.drawTile(16, 33, fill, 6, 0, 0, width, 6, arrBars[2]);
    }

    public onPaint(canvas: NWindowCanvas) {
        const width = this.width, height = this.height, barWidth = width - 22;

        canvas.drawTile(0, 0, 12, 8, 0, 0, 12, 8, TEX_FRAME + "1");
        canvas.drawTile(0, 8, 12, height - 16, 0, 0, 12, 8, TEX_FRAME + "2");
        canvas.drawTile(0, height - 8, 12, 8, 0, 0, 12, 8, TEX_FRAME + "3");
        canvas.drawTile(12, 0, 16, height, 0, 0, 16, height, TEX_BACK + "1");
        canvas.drawTile(28, 0, width - 44, height, 0, 0, 16, height, TEX_BACK + "2");
        canvas.drawTile(width - 16, 0, 19, height, 0, 0, 19, height, TEX_BACK + "3_ex");
        if (!this.info) return;

        for (let i = 0; i < (this.statusType === 1 ? 2 : 3); i++) {
            const current = i === 0 ? this.info.curHp : i === 1 ? this.info.curMp : this.info.curFood, maximum = i === 0 ? this.info.maxHp : i === 1 ? this.info.maxMp : this.info.maxFood;

            // NWindow 0x1010f930/0x1010f950/0x1010f975 leave zero-maximum widths undefined.
            if (!maximum) throw new Error(`Invalid pet status bar maximum ${maximum}.`);

            const fill = Math.trunc(Math.imul(current, barWidth) / maximum), y = 19 + i * 7;

            canvas.drawTile(16, y, barWidth, 5, 0, 0, 8, 6, `${arrBars[i]}_BACK`);
            if (fill > 0) canvas.drawTile(16, y, fill, this.statusType === 1 ? 5 : 6, 0, 0, 8, 6, arrBars[i]);
        }
        if (this.statusType === 1) this.paintGauge(canvas, barWidth);

        if (this.areEffectsVisible) for (let i = 0; i < Math.min(20, this.effects.length); i++) {
            const icon = this.getIcon(this.effects[i].id);

            const texture = icon && canvas.getTexture(icon);

            if (texture) canvas.drawTile(width + 1 + i % 10 * 16, 5 + Math.trunc(i / 10) * 16, 16, 16, 0, 0, texture.width, texture.height, icon);
        }
    }

    public paint(canvas: NWindowCanvas) {
        super.paint(canvas);
        if (this.isVisible && this.manager.isHovered(this.button)) this.tooltip.paint(canvas, this.button, 0, 0, this.manager.getSysString(881), 0);
    }
}

export default NCPetStatusWnd;
