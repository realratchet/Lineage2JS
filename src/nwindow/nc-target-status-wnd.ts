import NWnd, { type NMouseEvent_T } from "./nwnd";
import NCTooltip from "./nc-tooltip";
import NCButton, { NCBUTTON_NO_OVER } from "./nc-button";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCNameCtrl, { NameAlign_T } from "./nc-name-ctrl";
import type NWindowCanvas from "./nwindow-canvas";
import type NWindowManager from "./nwindow-manager";

const TEX_BACK1 = "L2UI_CH3.SmallWnd.SmallWindow_Back1";
const TEX_BACK2 = "L2UI_CH3.SmallWnd.SmallWindow_Back2";
const TEX_BACK3 = "L2UI_CH3.SmallWnd.SmallWindow_Back3_ex";
const TEX_EX_BACK1 = "L2UI_CH3.SmallWnd.SmallWindow2_Back1";
const TEX_EX_BACK2 = "L2UI_CH3.SmallWnd.SmallWindow2_Back2";
const TEX_EX_BACK3 = "L2UI_CH3.SmallWnd.SmallWindow2_Back3_ex";
const TEX_SMALLBAR1 = "L2UI_CH3.FRAMECTRL.SmallBar1";
const TEX_SMALLBAR2 = "L2UI_CH3.FRAMECTRL.SmallBar2";
const TEX_SMALLBAR3 = "L2UI_CH3.FRAMECTRL.SmallBar3";
const TEX_HPBAR = "L2UI_CH3.SmallWnd.HpBar";
const TEX_HPBAR_BACK = "L2UI_CH3.SmallWnd.HpBar_back";
const TEX_MPBAR = "L2UI_CH3.SmallWnd.MpBar";
const TEX_MPBAR_BACK = "L2UI_CH3.SmallWnd.MpBar_back";
const TEX_INFO = "L2UI_CH3.TargetWnd.Target_InfoButton";
const TEX_INFO_DOWN = "L2UI_CH3.TargetWnd.Target_InfoButton_Down";
const HEIGHT_COLLAPSED = 46;
const HEIGHT_EXPANDED = 76;
const NAME_COLOR = 0xffdcdcdc;

export type TargetStatus_T = { npcId: number, name: string, curHp: number, maxHp: number, curMp: number, maxMp: number, showHp: boolean, showMp: boolean, levelDifference: number };

function getConColor(difference: number): number { // 0x101136cd-0x1011371e, keyed by MyTargetSelected's level difference.
    if (difference <= -9) return 0xffff0000;
    if (difference <= -6) return 0xffff9191;
    if (difference <= -3) return 0xfffafe91;
    if (difference <= 2) return 0xffdcdcdc;
    if (difference <= 5) return 0xffa2ffab;
    if (difference <= 8) return 0xffa2a8fc;

    return 0xff0000ff;
}

function barWidth(current: number, maximum: number, width: number) { return maximum ? Math.min(Math.trunc(width * current / maximum), width) : 0; }

export class NCTargetStatusWnd extends NWnd { // NCTargetStatusWnd: NCConsole 0x10060e45 SetWindowRect(parentW/2 - 86, 0, 172, 46); paint 0x101132a0.
    protected readonly nameCtrl: NCNameCtrl;
    protected readonly infoButton: NCButton;
    protected readonly closeButton: NCButton;
    protected readonly dragStrip: NCFrameCtrl;
    protected target: TargetStatus_T = null;
    protected isExpanded = false;
    protected hoveredSlot = -1;
    protected readonly tooltip = new NCTooltip();

    public onClose: () => void = null;

    public constructor() {
        super(0, 0, 172, HEIGHT_COLLAPSED);

        this.dragStrip = this.addChild(new NCFrameCtrl(0, 19, 12, this.height - 19));
        this.closeButton = this.addChild(new NCButton(this.width - 19, 6, 15, 15, "L2UI_CH3.FrameCtrl.FrameCloseBtn", "L2UI_CH3.FrameCtrl.FrameCloseOnBtn"));
        this.infoButton = this.addChild(new NCButton(1, 6, 11, 13, TEX_INFO, TEX_INFO, null, NCBUTTON_NO_OVER));
        this.nameCtrl = this.addChild(new NCNameCtrl(12, 9, this.width - 30, 14));
        this.nameCtrl.align = NameAlign_T.CENTER;
        this.closeButton.onPress = () => { if (this.onClose) this.onClose(); };
        this.infoButton.onPress = () => this.toggleExpanded();
        this.isVisible = false;
    }

    public getTextures(): string[] { return [TEX_BACK1, TEX_BACK2, TEX_BACK3, TEX_EX_BACK1, TEX_EX_BACK2, TEX_EX_BACK3, TEX_SMALLBAR1, TEX_SMALLBAR2, TEX_SMALLBAR3, TEX_HPBAR, TEX_HPBAR_BACK, TEX_MPBAR, TEX_MPBAR_BACK, TEX_INFO_DOWN, ...this.tooltip.getTextures()]; }

    public attach(manager: NWindowManager) {
        super.attach(manager);
        void this.loadIcons();
    }

    protected async loadIcons() {
        if (!this.target) return;

        const skills = this.manager.strings.npcPassiveSkills[this.target.npcId] || [];
        const icons = skills.map(id => this.manager.strings.skillInfos[`${id}:1`]).filter(skill => skill && skill.icon).map(skill => skill.icon);

        await this.manager.canvas.loadTextures(icons);
        this.invalidate();
    }

    public placeOnScreen(screenWidth: number) {
        this.x = Math.trunc(screenWidth * 0.5 - 86);
        this.y = 0;
    }

    protected toggleExpanded() { // 0x1010d640 swaps the info button textures and toggles between 46 and 76 px.
        this.isExpanded = !this.isExpanded;
        this.hoveredSlot = -1;
        this.height = this.isExpanded ? HEIGHT_EXPANDED : HEIGHT_COLLAPSED;
        this.dragStrip.height = this.height - 19;
        this.infoButton.normalTexture = this.infoButton.downTexture = this.isExpanded ? TEX_INFO_DOWN : TEX_INFO;
        this.invalidate();
    }

    public setTarget(target: TargetStatus_T) {
        const previousNpcId = this.target ? this.target.npcId : 0;

        this.target = target;
        if (!target || target.npcId !== previousNpcId) this.hoveredSlot = -1;
        if (this.manager && target && target.npcId !== previousNpcId) void this.loadIcons();
        this.invalidate();
        this.setVisible(!!target);

        if (target) this.nameCtrl.setText(target.name, target.showHp ? getConColor(target.levelDifference) : NAME_COLOR);
    }

    public onMouseMove(event: NMouseEvent_T) {
        this.hoveredSlot = -1;

        if (this.target && this.isExpanded) {
            const skills = this.manager.strings.npcPassiveSkills[this.target.npcId] || [];

            for (let i = 0; i < skills.length; i++) {
                const x = 18 + 18 * (i % 8), y = 40 + 18 * Math.floor(i / 8);

                if (event.x >= x && event.x <= x + 15 && event.y >= y && event.y <= y + 15) {
                    this.hoveredSlot = i;
                    break;
                }
            }
        }

        this.invalidate();
    }

    public onMouseLeave() {
        this.hoveredSlot = -1;
        this.invalidate();
    }

    public onPaint(canvas: NWindowCanvas) {
        const W = this.width, H = this.height, barW = W - 22;
        const sourceHeight = this.isExpanded ? HEIGHT_EXPANDED : HEIGHT_COLLAPSED;

        canvas.drawTile(12, 0, 16, H, 0, 0, 16, sourceHeight, this.isExpanded ? TEX_EX_BACK1 : TEX_BACK1);
        canvas.drawTile(28, 0, W - 44, H, 0, 0, 16, sourceHeight, this.isExpanded ? TEX_EX_BACK2 : TEX_BACK2);
        canvas.drawTile(W - 16, 0, 19, H, 0, 0, 19, sourceHeight, this.isExpanded ? TEX_EX_BACK3 : TEX_BACK3);
        canvas.drawTile(0, 0, 12, 8, 0, 0, 12, 8, TEX_SMALLBAR1);
        canvas.drawTile(0, 8, 12, H - 16, 0, 0, 12, 8, TEX_SMALLBAR2);
        canvas.drawTile(0, H - 8, 12, 8, 0, 0, 12, 8, TEX_SMALLBAR3);

        const target = this.target;

        if (!target) return;

        if (target.showHp) {
            canvas.drawTile(16, 26, barW, 6, 0, 0, 8, 6, TEX_HPBAR_BACK);
            canvas.drawTile(16, 26, barWidth(target.curHp, target.maxHp, barW), 6, 0, 0, 8, 6, TEX_HPBAR);

            if (target.showMp) {
                canvas.drawTile(16, 33, barW, 6, 0, 0, 8, 6, TEX_MPBAR_BACK);
                canvas.drawTile(16, 33, barWidth(target.curMp, target.maxMp, barW), 6, 0, 0, 8, 6, TEX_MPBAR);
            }
        }

        if (this.isExpanded) {
            const skills = this.manager.strings.npcPassiveSkills[target.npcId] || [];

            skills.forEach((id, index) => {
                const skill = this.manager.strings.skillInfos[`${id}:1`];

                if (skill && skill.icon) canvas.drawTile(18 + 18 * (index % 8), 40 + 18 * Math.floor(index / 8), 15, 15, 0, 0, 32, 32, skill.icon);
            });

            const skill = this.manager.strings.skillInfos[`${skills[this.hoveredSlot]}:1`];

            if (skill) this.tooltip.paint(canvas, this, 18 + 18 * (this.hoveredSlot % 8), 40 + 18 * Math.floor(this.hoveredSlot / 8), { title: skill.name, lines: [], description: skill.description, minimumWidth: 144 });
        }
    }
}

export default NCTargetStatusWnd;
