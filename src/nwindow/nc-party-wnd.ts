import NCStatusWnd from "./nc-status-wnd";
import type NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";
import type { TooltipInfo_T } from "./nc-tooltip";
import type { PartyMember_T, AbnormalStatus_T } from "../network/game-packets";

const TEX_FRAME = "L2UI_CH3.FrameCtrl.smallbar";
const TEX_BACK = "L2UI_CH3.SmallWnd.SmallWindow_back";
const TEX_BUFF_BUTTON = "L2UI_CH3.PartyWnd.party_buffbutton";
const TEX_LEADER = "L2UI_CH3.PartyWnd.party_leadericon";
const TEX_DEBUFF = "L2UI_CH3.PlayerStatusWnd.debuff";
const arrBars = ["cpBar", "HpBar", "MpBar"].map(name => `L2UI_CH3.SmallWnd.${name}`);
const arrBarBacks = ["CpBar_back", "HpBar_back", "MpBar_back"].map(name => `L2UI_CH3.SmallWnd.${name}`);
const arrLootNames = [487, 488, 798, 799, 800];
const MEMBER_HEIGHT = 46;
const MAX_MEMBERS = 8;

function fitCentered(layer: NDomLayer, text: string, width: number) { // NCItemTooltip mode 0 0x1004cb30: trailing characters give way to "..", exhausted index leaves "."
    const full = layer.measureText(text), overflow = Math.trunc(full - width);

    if (overflow <= 0) return text;

    const dots = layer.measureText("..");
    let length = text.length - 1;

    while (length >= 0 && full - dots - layer.measureText(text.slice(0, length)) <= overflow) length--;

    return length < 0 ? "." : `${text.slice(0, length)}..`;
}

class NCPartyStatusWnd { // NCPartyStatusWnd: OnCreate 0x10114d80, paint 0x10115080, layout 0x1010dc00.
    public readonly element: HTMLDivElement;
    protected readonly arrBack: HTMLDivElement[];
    protected readonly arrBarBacks: HTMLDivElement[];
    protected readonly arrBarFills: HTMLDivElement[];
    protected readonly name: HTMLDivElement;
    protected readonly leader: HTMLDivElement;
    protected readonly leaderTooltip: TooltipInfo_T = { title: "", lines: [], description: "" };
    protected readonly effects: HTMLDivElement;
    public member: PartyMember_T = null;
    public leaderId = 0;
    public lootType = 0;
    public arrEffects: AbnormalStatus_T[] = [];
    protected width = 160;

    public onAction: (objectId: number, shift: boolean, ctrl: boolean) => void = null;
    public onAssist: (objectId: number) => void = null;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement) {
        this.element = layer.createWindow(12, 0, this.width, MEMBER_HEIGHT, parent);
        this.element.hidden = true;
        this.arrBack = [1, 2, 3].map(index => layer.tile(this.element, 0, 0, 0, 0, 0, 0, 16, MEMBER_HEIGHT, `${TEX_BACK}${index === 3 ? "3_ex" : index}`));
        this.arrBarBacks = arrBarBacks.map(texture => layer.tile(this.element, 4, 0, 0, 6, 0, 0, 8, 6, texture));
        this.arrBarFills = arrBars.map(texture => layer.tile(this.element, 4, 0, 0, 5, 0, 0, 8, 6, texture));
        this.name = layer.text(this.element, "", 0xffdcdcdc, undefined, 0, 8);
        this.name.style.pointerEvents = "none";
        this.leader = layer.tile(this.element, 0, 8, 11, 11, 0, 0, 11, 11, TEX_LEADER);
        this.leader.hidden = true;
        layer.tooltip(this.element, this.leader, this.leaderTooltip, 0);
        this.effects = layer.createWindow(0, 0, 0, 0, this.element);
        this.effects.style.pointerEvents = "none";
        this.element.addEventListener("mousedown", event => {
            if (event.button !== 0 || !this.member) return;

            if (event.detail === 2) { // left double-click 0x1010db60: select the member's own target
                if (this.onAssist) this.onAssist(this.member.objectId);
                return;
            }

            if (event.detail > 1) return;
            if (layer.toUI(event.clientX) - layer.toUI(this.element.getBoundingClientRect().left) >= this.width - 10) return; // 0x1010daa0 leaves the last 10 px to the size control

            if (this.onAction) this.onAction(this.member.objectId, event.shiftKey, event.ctrlKey);
        });
    }

    public isEmpty() { return !this.member || !this.member.name; }

    public setMember(member: PartyMember_T, leaderId: number, lootType: number) {
        this.member = member;
        this.leaderId = leaderId;
        this.lootType = lootType;
    }

    public reset() {
        this.member = null;
        this.arrEffects = [];
        this.element.hidden = true;
    }

    public setWidth(width: number) { this.width = width; }

    public getIcon(id: number) {
        const skill = this.layer.getManager().strings.skillInfos[`${id}:1`];

        return skill && skill.icon;
    }

    protected isDebuff(id: number) {
        const skill = this.layer.getManager().strings.skillInfos[`${id}:1`];

        return !!(skill && skill.isDebuff);
    }

    public update(y: number, areEffectsVisible: boolean) {
        const layer = this.layer, manager = layer.getManager(), width = this.width, barWidth = width - 10, member = this.member;

        this.element.hidden = false;
        layer.place(this.element, 12, y, width, MEMBER_HEIGHT);
        layer.placeTile(this.arrBack[0], 0, 0, 16, MEMBER_HEIGHT, 0, 0, 16, MEMBER_HEIGHT, `${TEX_BACK}1`);
        layer.placeTile(this.arrBack[1], 16, 0, width - 32, MEMBER_HEIGHT, 0, 0, 16, MEMBER_HEIGHT, `${TEX_BACK}2`);
        layer.placeTile(this.arrBack[2], width - 16, 0, 19, MEMBER_HEIGHT, 0, 0, 19, MEMBER_HEIGHT, `${TEX_BACK}3_ex`);

        const values = [[member.curCp, member.maxCp], [member.curHp, member.maxHp], [member.curMp, member.maxMp]];

        for (let i = 0; i < 3; i++) {
            const [current, maximum] = values[i], fill = maximum ? Math.trunc(barWidth * Math.min(current, maximum) / maximum) : 0, rowY = 21 + i * 7;

            layer.placeTile(this.arrBarBacks[i], 4, rowY, barWidth, 6, 0, 0, 8, 6, arrBarBacks[i]);
            layer.placeTile(this.arrBarFills[i], 4, rowY, fill, 5, 0, 0, 8, 6, arrBars[i]);
        }

        const text = fitCentered(layer, member.name, width);

        layer.renderText(this.name, text, 0xffdcdcdc);
        layer.place(this.name, Math.trunc(width * 0.5 - Math.trunc(layer.measureText(text) / 2)), 8);

        this.leader.hidden = member.objectId !== this.leaderId;
        if (!this.leader.hidden) layer.place(this.leader, Math.trunc(width * 0.5 - Math.trunc(layer.measureText(member.name) / 2) - 11), 8);
        this.leaderTooltip.title = this.lootType >= 0 && this.lootType < arrLootNames.length ? `${manager.getSysString(489)} : ${manager.getSysString(arrLootNames[this.lootType])}` : "";

        this.effects.replaceChildren();
        if (!areEffectsVisible) return;

        const arrDebuffs: [number, number, string][] = [];

        for (let i = 0; i < Math.min(20, this.arrEffects.length); i++) {
            const id = this.arrEffects[i].id, icon = this.getIcon(id), x = Math.trunc(16 * (i % 10) + width + 1), iconY = i < 10 ? 5 : 21;

            if (this.isDebuff(id)) arrDebuffs.push([x, iconY, icon]);
            else if (icon && layer.hasTexture(icon)) layer.tile(this.effects, x, iconY, 16, 16, 0, 0, 32, 32, icon);
        }

        for (const [x, iconY, icon] of arrDebuffs) {
            if (icon && layer.hasTexture(icon)) layer.tile(this.effects, x, iconY, 16, 16, 0, 0, 32, 32, icon);
            layer.tile(this.effects, x, iconY, 16, 16, 0, 0, 26, 26, TEX_DEBUFF);
        }
    }
}

export class NCPartyWnd extends NCStatusWnd { // NCPartyWnd: NCConsole 0x10060fdc SetWindowRect(0, 152, 172, 46); OnCreate 0x10117530, relayout 0x10110820.
    public static getTextures(): string[] { return [...NCStatusWnd.getTextures(), `${TEX_BACK}1`, `${TEX_BACK}2`, `${TEX_BACK}3_ex`, TEX_BUFF_BUTTON, `${TEX_BUFF_BUTTON}_down`, TEX_LEADER, TEX_DEBUFF, ...arrBars, ...arrBarBacks]; }

    protected readonly button: NDomButton_T;
    protected readonly arrMembers: NCPartyStatusWnd[];
    protected areEffectsVisible = false;

    public onAction: (objectId: number, shift: boolean, ctrl: boolean) => void = null;
    public onAssist: (objectId: number) => void = null;

    public constructor(layer: NDomLayer) {
        super(layer, "PartyWnd", 0, 152, MEMBER_HEIGHT, 18);

        this.name.hidden = true;
        this.arrMembers = Array.from({ length: MAX_MEMBERS }, () => {
            const member = new NCPartyStatusWnd(layer, this.element);

            member.onAction = (objectId, shift, ctrl) => { if (this.onAction) this.onAction(objectId, shift, ctrl); };
            member.onAssist = objectId => { if (this.onAssist) this.onAssist(objectId); };

            return member;
        });
        this.button = layer.button(this.element, 1, 7, 11, 13, TEX_BUFF_BUTTON, `${TEX_BUFF_BUTTON}_down`, null, null, () => { this.areEffectsVisible = !this.areEffectsVisible; this.update(); }); // 0x1010ded0
        layer.tooltip(this.element, this.button, layer.getManager().getSysString(881), 0);
        this.button.addEventListener("mousedown", event => { if (event.detail > 1) event.stopImmediatePropagation(); }, true);
        this.createSizeCtrl();
        this.update();
    }

    public placeOnScreen() { this.restoreWidth(); }

    public getCount() { return this.arrMembers.filter(member => !member.isEmpty()).length; }

    public addMember(member: PartyMember_T, leaderId: number, lootType: number) { // 0x10115630
        const slot = this.arrMembers.find(entry => entry.isEmpty());

        this.setVisible(true);
        if (!slot) return;

        slot.setMember(member, leaderId, lootType);
        void this.loadIcons(slot);
        this.update();
    }

    public updateMember(member: PartyMember_T) { // 0x101107c0
        const slot = this.arrMembers.find(entry => !entry.isEmpty() && entry.member.objectId === member.objectId);

        if (slot) slot.setMember(member, slot.leaderId, slot.lootType);
        if (!this.getCount()) this.setVisible(false);
        this.update();
    }

    public deleteMember(name: string) { // 0x101156a0: later members shift up one slot, their effect lists move with them
        const index = this.arrMembers.findIndex(entry => !entry.isEmpty() && entry.member.name === name);

        if (index < 0) return;

        for (let i = index; i < MAX_MEMBERS - 1; i++) {
            const next = this.arrMembers[i + 1];

            if (next.isEmpty()) { this.arrMembers[i].reset(); continue; }

            this.arrMembers[i].setMember(next.member, next.leaderId, next.lootType);
            this.arrMembers[i].arrEffects = next.arrEffects;
            next.reset();
        }
        this.arrMembers[MAX_MEMBERS - 1].reset();

        if (!this.getCount()) this.setVisible(false);
        this.update();
    }

    public deleteAll() { // 0x101158c0
        for (const member of this.arrMembers) member.reset();

        this.update();
        this.setVisible(false);
    }

    public setEffects(objectId: number, effects: AbnormalStatus_T[]) { // 0x10115980 clears, 0x10115920 appends
        const slot = this.arrMembers.find(entry => !entry.isEmpty() && entry.member.objectId === objectId);

        if (!slot) return;

        slot.arrEffects = effects;
        void this.loadIcons(slot);
    }

    protected async loadIcons(slot: NCPartyStatusWnd) {
        await this.layer.loadTextures([...new Set(slot.arrEffects.slice(0, 20).map(effect => slot.getIcon(effect.id)).filter(Boolean))]);
        this.update();
    }

    protected update() {
        const layer = this.layer, width = this.width, count = this.getCount(), height = MEMBER_HEIGHT * count;

        this.height = height;
        this.element.style.width = `${width}px`;
        this.element.style.height = `${height}px`;

        for (const frame of this.arrFrame) frame.hidden = count <= 0;
        if (count > 0) {
            layer.placeTile(this.arrFrame[0], 0, 0, 12, 8, 0, 0, 12, 8, `${TEX_FRAME}1`);
            layer.placeTile(this.arrFrame[1], 0, 8, 12, height - 16, 0, 0, 12, 8, `${TEX_FRAME}2`);
            layer.placeTile(this.arrFrame[2], 0, height - 8, 12, 8, 0, 0, 12, 8, `${TEX_FRAME}3`);
        }
        layer.place(this.grip, 0, 18, 12, Math.max(0, height - 18));
        if (this.sizeCtrl) layer.place(this.sizeCtrl, width - 10, 0, 10, height);

        let y = 0;

        for (const member of this.arrMembers) {
            member.setWidth(width - 12);
            if (member.isEmpty()) { member.element.hidden = true; continue; }

            member.update(y, this.areEffectsVisible);
            y += MEMBER_HEIGHT;
        }
    }
}

export default NCPartyWnd;
