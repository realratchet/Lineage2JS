import NCTooltip from "./nc-tooltip";
import NCStatusWnd from "./nc-status-wnd";
import type NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";

const TEX_BACK1 = "L2UI_CH3.SmallWnd.SmallWindow_Back1";
const TEX_BACK2 = "L2UI_CH3.SmallWnd.SmallWindow_Back2";
const TEX_BACK3 = "L2UI_CH3.SmallWnd.SmallWindow_Back3_ex";
const TEX_EX_BACK1 = "L2UI_CH3.SmallWnd.SmallWindow2_Back1";
const TEX_EX_BACK2 = "L2UI_CH3.SmallWnd.SmallWindow2_Back2";
const TEX_EX_BACK3 = "L2UI_CH3.SmallWnd.SmallWindow2_Back3_ex";
const TEX_HPBAR = "L2UI_CH3.SmallWnd.HpBar";
const TEX_HPBAR_BACK = "L2UI_CH3.SmallWnd.HpBar_back";
const TEX_MPBAR = "L2UI_CH3.SmallWnd.MpBar";
const TEX_MPBAR_BACK = "L2UI_CH3.SmallWnd.MpBar_back";
const TEX_CLOSE = "L2UI_CH3.FrameCtrl.FrameCloseBtn";
const TEX_CLOSE_DOWN = "L2UI_CH3.FrameCtrl.FrameCloseOnBtn";
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

export class NCTargetStatusWnd extends NCStatusWnd { // NCTargetStatusWnd: NCConsole 0x10060e45 SetWindowRect(parentW/2 - 86, 0, 172, 46); paint 0x101132a0.
    public static getTextures(): string[] { return [...NCStatusWnd.getTextures(), TEX_BACK1, TEX_BACK2, TEX_BACK3, TEX_EX_BACK1, TEX_EX_BACK2, TEX_EX_BACK3, TEX_HPBAR, TEX_HPBAR_BACK, TEX_MPBAR, TEX_MPBAR_BACK, TEX_CLOSE, TEX_CLOSE_DOWN, `?${TEX_CLOSE}_over`, TEX_INFO, TEX_INFO_DOWN]; }

    protected readonly arrBars: HTMLDivElement[];
    protected readonly skills: HTMLDivElement;
    protected readonly infoButton: NDomButton_T;
    protected readonly closeButton: NDomButton_T;
    protected readonly tooltip = new NCTooltip();
    protected target: TargetStatus_T = null;
    protected isExpanded = false;

    public onClose: () => void = null;

    public constructor(layer: NDomLayer) {
        super(layer, "TargetStatusWnd", 0, 0, HEIGHT_COLLAPSED, 19);

        this.arrBars = [TEX_HPBAR_BACK, TEX_HPBAR, TEX_MPBAR_BACK, TEX_MPBAR].map(texture => layer.tile(this.element, 16, 0, 0, 6, 0, 0, 8, 6, texture));
        this.skills = layer.createWindow(0, 0, 0, HEIGHT_EXPANDED, this.element);
        this.skills.style.pointerEvents = "none";
        this.createSizeCtrl();
        this.closeButton = layer.button(this.element, 0, 6, 15, 15, TEX_CLOSE, TEX_CLOSE_DOWN, null, null, () => { if (this.onClose) this.onClose(); });
        this.infoButton = layer.button(this.element, 1, 6, 11, 13, TEX_INFO, TEX_INFO, TEX_INFO, null, () => this.toggleExpanded());
        this.update();
    }

    public placeOnScreen(screenWidth: number) {
        this.layer.place(this.element, Math.trunc(screenWidth * 0.5 - 86), 0);
        this.restoreWidth();
    }

    protected async loadIcons() {
        if (!this.target) return;

        const strings = this.layer.getManager().strings, skills = strings.npcPassiveSkills[this.target.npcId] || [];
        const icons = skills.map(id => strings.skillInfos[`${id}:1`]).filter(skill => skill && skill.icon).map(skill => skill.icon);

        await this.layer.loadTextures(icons);
        this.update();
    }

    protected toggleExpanded() { // 0x1010d640 swaps the info button textures and toggles between 46 and 76 px.
        const texture = this.isExpanded ? TEX_INFO : TEX_INFO_DOWN;

        this.isExpanded = !this.isExpanded;
        this.infoButton.setTextures(texture, texture, texture);
        this.update();
    }

    public setTarget(target: TargetStatus_T) {
        const previousNpcId = this.target ? this.target.npcId : 0;

        this.target = target;
        if (target && target.npcId !== previousNpcId) void this.loadIcons();
        this.setVisible(!!target);
        this.update();
    }

    protected update() {
        const layer = this.layer, strings = layer.getManager().strings, target = this.target, W = this.width, H = this.isExpanded ? HEIGHT_EXPANDED : HEIGHT_COLLAPSED, barW = W - 22;
        const [hpBack, hp, mpBack, mp] = this.arrBars;

        this.layoutFrame(H, this.isExpanded ? [TEX_EX_BACK1, TEX_EX_BACK2, TEX_EX_BACK3] : [TEX_BACK1, TEX_BACK2, TEX_BACK3], H);
        layer.place(this.closeButton, W - 19, 6);
        this.skills.replaceChildren();

        for (const bar of this.arrBars) bar.hidden = true;
        this.setName(target ? target.name : "", target && target.showHp ? getConColor(target.levelDifference) : NAME_COLOR, 12, 9, W - 30, true);

        if (!target) return;

        if (target.showHp) {
            layer.placeTile(hpBack, 16, 26, barW, 6, 0, 0, 8, 6, TEX_HPBAR_BACK);
            layer.placeTile(hp, 16, 26, barWidth(target.curHp, target.maxHp, barW), 6, 0, 0, 8, 6, TEX_HPBAR);

            if (target.showMp) {
                layer.placeTile(mpBack, 16, 33, barW, 6, 0, 0, 8, 6, TEX_MPBAR_BACK);
                layer.placeTile(mp, 16, 33, barWidth(target.curMp, target.maxMp, barW), 6, 0, 0, 8, 6, TEX_MPBAR);
            }
        }

        if (!this.isExpanded) return;

        (strings.npcPassiveSkills[target.npcId] || []).forEach((id, index) => {
            const skill = strings.skillInfos[`${id}:1`];

            if (!skill || !skill.icon || !layer.hasTexture(skill.icon)) return;

            const x = 18 + 18 * (index % 8), y = 40 + 18 * Math.floor(index / 8);
            const icon = layer.tile(this.skills, x, y, 15, 15, 0, 0, 32, 32, skill.icon);
            let tooltip: HTMLDivElement = null;

            icon.style.pointerEvents = "auto";
            icon.addEventListener("mouseenter", () => tooltip = this.tooltip.createDOM(layer, this.element, parseFloat(this.element.style.left) + x, parseFloat(this.element.style.top) + y, { title: skill.name, lines: [], description: skill.description, minimumWidth: 144 }));
            icon.addEventListener("mouseleave", () => { if (tooltip) tooltip.remove(); tooltip = null; });
        });
    }
}

export default NCTargetStatusWnd;
