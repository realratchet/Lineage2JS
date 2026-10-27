import NCFrameCtrl from "./nc-frame-ctrl";
import NCListCtrl, { type ListRow_T } from "./nc-list-ctrl";
import type { default as NDomLayer, NDomButton_T } from "./ndom";
import type { SiegeInfo_T, SiegeClan_T } from "../network/game-packets";
import SystemMessage_T from "./system-message";
import SysString_T from "./sys-string";

type CrestGetter_T = (clanId: number, isAlly: boolean) => CanvasImageSource;

const TEX_BACK1 = "L2UI_ch3.SiegeWnd.Siege_Back1";
const TEX_BACK2 = "L2UI_CH3.SiegeWnd.Siege_Back2";
const TEX_DATE_BACK = "L2UI_ch3.SiegeWnd.siege_back31";
const TEX_PART_BACK = "L2UI_ch3.SiegeWnd.siege_back32";
const TEX_TAB = "L2UI_ch3.SiegeWnd.siege_Tab3";
const arrTabsSelected = ["L2UI_ch3.SiegeWnd.siege_Tab1", "L2UI_ch3.SiegeWnd.siege_Tab2", "L2UI_ch3.SiegeWnd.siege_Tab2"];
const TEX_BUTTON = "L2UI_ch3.button.btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_ch3.button.btn1_normalon";
const arrDefenderStatus = [0, SysString_T.Lord, SysString_T.Waiting, SysString_T.Approved, SysString_T.Refuse];
const WIDTH = 256;
const HEIGHT = 401;
const PAGE_HEIGHT = 253;

const cacheCrestUrls = new WeakMap<CanvasImageSource, string>();

function getCrestUrl(crest: CanvasImageSource) {
    if (!cacheCrestUrls.has(crest)) cacheCrestUrls.set(crest, (crest as HTMLCanvasElement).toDataURL());

    return cacheCrestUrls.get(crest);
}

function drawCrest(layer: NDomLayer, parent: HTMLElement, x: number, y: number, width: number, crest: CanvasImageSource) { // NWindow 0x100131f0: 16x12 sampled from v=4
    if (!crest) return false;

    const element = layer.createWindow(x, y, width, 12, parent);

    element.style.pointerEvents = "none";
    element.style.background = `url(${getCrestUrl(crest)}) 0 -4px no-repeat`;

    return true;
}

function formatTime(manager: ReturnType<NDomLayer["getManager"]>, time: number) { // NWindow 0x10083a90: appConvertIntToTime into system message 713 with "%2d" fields
    const date = new Date(time * 1000), pad = (value: number) => String(value).padStart(2, " ");

    return manager.getSystemMessage(SystemMessage_T.SiegeDateFormat).replace(/\$s(\d)/g, (match, index) => [String(date.getFullYear()), pad(date.getMonth() + 1), pad(date.getDate()), pad(date.getHours()), pad(date.getMinutes())][Number(index) - 1] ?? match);
}

class SiegeListCtrl extends NCListCtrl { // vtable 0x101cc1f8, paint 0x1010a400
    public getCrest: CrestGetter_T = null;
    public arrClans: SiegeClan_T[] = [];

    public constructor(layer: NDomLayer, parent: HTMLElement, protected readonly isDefender: boolean) {
        super(layer, parent, 7, 18, 242, 200, [{ width: 130, label: SysString_T.ClanName, numeric: false }, { width: 112, label: isDefender ? SysString_T.SiegeStatus : SysString_T.AllianceName, numeric: false }], 15, 12); // 0x1010a9c0
    }

    protected paintCell(cell: HTMLElement, row: ListRow_T, cellIndex: number) {
        const clan = this.arrClans[Number(row.id)];
        let x = 0;

        if (cellIndex === 0) {
            drawCrest(this.layer, cell, 0, 0, 16, this.getCrest && this.getCrest(clan.clanId, false));
            x = 17;
        } else if (!this.isDefender) {
            drawCrest(this.layer, cell, 0, 0, 8, this.getCrest && this.getCrest(clan.clanId, true));
            x = 9;
        }

        this.layer.text(cell, row.cells[cellIndex], 0xffdcdcdc, undefined, x, 1);
    }
}

class NCSiegeDateInfoWnd { // NCSiegeDateInfoWnd: OnCreate 0x1010c160, paint 0x1010b240
    public readonly element: HTMLDivElement;
    protected readonly content: HTMLDivElement;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement) {
        this.element = layer.createWindow(0, 148, WIDTH, PAGE_HEIGHT, parent);
        layer.tile(this.element, 0, 0, WIDTH, PAGE_HEIGHT, 0, 0, WIDTH, PAGE_HEIGHT, TEX_DATE_BACK);
        this.content = layer.createWindow(0, 0, WIDTH, PAGE_HEIGHT, this.element);
        this.content.style.pointerEvents = "none";
    }

    public setTimes(serverTime: number, siegeTime: number, isOwner: boolean) { // 0x1010b600
        const layer = this.layer, manager = layer.getManager();

        this.content.replaceChildren();
        layer.text(this.content, manager.getSysString(SysString_T.CurrentTime), 0xffdcdcdc, undefined, 10, 30);
        layer.text(this.content, formatTime(manager, serverTime), 0xffdcdcdc, undefined, 80, 30);
        layer.text(this.content, manager.getSysString(SysString_T.SiegeDate), 0xffdcdcdc, undefined, 10, 50);
        if (siegeTime > 0) layer.text(this.content, formatTime(manager, siegeTime), 0xffdcdcdc, undefined, 80, 50);
        else if (siegeTime === 0 && !isOwner) layer.text(this.content, manager.getSysString(SysString_T.Undecided), 0xffdcdcdc, undefined, 80, 50);
        // TODO: owner siege-time choice control (80,60,126,15) has no Lisvus request to drive it.
    }
}

class NCSiegePartInfoWnd { // NCSiegePartInfoWnd: OnCreate 0x1010c610, paint 0x1010a850
    public readonly element: HTMLDivElement;
    public readonly list: SiegeListCtrl;
    public onParticipate: () => void = null;
    public onCancelApplication: () => void = null;
    public onApprove: (clan: SiegeClan_T) => void = null;
    public onRefuse: (clan: SiegeClan_T) => void = null;
    public isRequested = false;
    protected readonly header: HTMLDivElement;
    protected readonly arrButtons: NDomButton_T[];
    protected isListed = false;
    protected approvedCount = 0;
    protected waitingCount = 0;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement, protected readonly isDefender: boolean) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 148, WIDTH, PAGE_HEIGHT, parent);
        layer.tile(this.element, 0, 0, WIDTH, PAGE_HEIGHT, 0, 0, WIDTH, PAGE_HEIGHT, TEX_PART_BACK);
        this.header = layer.createWindow(0, 0, WIDTH, 18, this.element);
        this.header.style.pointerEvents = "none";
        this.list = new SiegeListCtrl(layer, this.element, isDefender);
        this.arrButtons = ([[158, SysString_T.Participate, () => this.onParticipate && this.onParticipate()], [158, SysString_T.CancelApplication, () => this.onCancelApplication && this.onCancelApplication()], [80, SysString_T.Approve, () => this.approve()], [158, SysString_T.CancelSiege, () => this.refuse()]] as [number, number, () => void][])
            .map(([x, label, onClick]) => layer.button(this.element, x, 224, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(label), onClick));
        this.reset();
    }

    public reset() { // 0x1010be60
        this.list.arrClans = [];
        this.list.setRows([], true);
        this.isListed = false;
        this.isRequested = false;
        this.approvedCount = 0;
        this.waitingCount = 0;
        this.paintHeader();
    }

    public addClans(clans: SiegeClan_T[], userClanId: number) { // 0x1010bf20 per clan
        const manager = this.layer.getManager(), rows = this.list.getRows().slice();

        for (const clan of clans) {
            let status = clan.allyName;

            if (this.isDefender) {
                status = arrDefenderStatus[clan.type] ? manager.getSysString(arrDefenderStatus[clan.type]) : "";
                if (clan.type === 1 || clan.type === 2) this.waitingCount++;
                else if (clan.type === 3) this.approvedCount++;
            }

            rows.push({ id: this.list.arrClans.length, cells: [clan.name, status] });
            this.list.arrClans.push(clan);
            if (clan.clanId === userClanId) this.isListed = true;
        }

        this.list.setRows(rows);
        this.paintHeader();
    }

    public updateButtons(isOwner: boolean) { // 0x1010b050
        const [participate, cancelApplication, approve, refuse] = this.arrButtons;

        this.isRequested = true;
        participate.hidden = this.isListed || isOwner;
        cancelApplication.hidden = !this.isListed || isOwner;
        approve.hidden = refuse.hidden = !(this.isDefender && isOwner);
    }

    protected paintHeader() {
        const manager = this.layer.getManager();
        const text = this.isDefender ? `${manager.getSysString(SysString_T.ClansDefending)}/${manager.getSysString(SysString_T.ClansWaiting)} : ${this.approvedCount}/${this.waitingCount}` : `${manager.getSysString(SysString_T.ClansAttacking)} : ${this.list.arrClans.length}`;

        this.header.replaceChildren();
        this.layer.text(this.header, text, 0xffdcdcdc, undefined, 14, 2);
    }

    protected getSelectedClan() {
        const row = this.list.getSelectedRow();

        return row ? this.list.arrClans[Number(row.id)] : null;
    }

    protected approve() { // 0x1010ae00
        const clan = this.getSelectedClan();

        if (clan && clan.type === 2 && this.onApprove) this.onApprove(clan);
    }

    protected refuse() { // 0x1010af20
        const clan = this.getSelectedClan();

        if (clan && (clan.type === 2 || clan.type === 3) && this.onRefuse) this.onRefuse(clan);
    }
}

export class NCSiegeInfoMainWnd { // NCSiegeInfoMainWnd: NConsole 0x100635a0 (0, H*0.5-252, 256x401, sys593), OnCreate 0x1010cc00, paint 0x1010b790
    public static getTextures(): string[] { return [...NCFrameCtrl.getTextures(), ...NCListCtrl.getTextures(), TEX_BACK1, TEX_BACK2, TEX_DATE_BACK, TEX_PART_BACK, TEX_TAB, ...arrTabsSelected, TEX_BUTTON, TEX_BUTTON_DOWN]; }

    public readonly element: HTMLDivElement;
    public onRequestList: (castleId: number, isDefender: boolean) => void = null;
    public onParticipate: (castleId: number, isDefender: boolean) => void = null;
    public onCancelApplication: (castleId: number, isDefender: boolean) => void = null;
    public onApprove: (castleId: number, clan: SiegeClan_T) => void = null;
    public onRefuse: (castleId: number, clan: SiegeClan_T) => void = null;
    protected readonly content: HTMLDivElement;
    protected readonly dateWnd: NCSiegeDateInfoWnd;
    protected readonly arrPartWnds: NCSiegePartInfoWnd[];
    protected readonly arrTabs: NDomButton_T[] = [];
    protected getCrest: CrestGetter_T = null;
    protected info: SiegeInfo_T = null;
    protected userClanId = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, WIDTH, HEIGHT);
        this.element.hidden = true;
        NCFrameCtrl.createDOM(layer, this.element, WIDTH, manager.getSysString(SysString_T.SiegeInformation), false, () => this.setVisible(false));
        layer.tile(this.element, 0, 20, WIDTH, 105, 0, 0, WIDTH, 105, TEX_BACK1);
        layer.tile(this.element, 0, 125, WIDTH, 23, 0, 0, WIDTH, 23, TEX_BACK2);
        this.content = layer.createWindow(0, 0, WIDTH, 125, this.element);
        this.content.style.pointerEvents = "none";

        this.dateWnd = new NCSiegeDateInfoWnd(layer, this.element);
        this.arrPartWnds = [false, true].map(isDefender => {
            const wnd = new NCSiegePartInfoWnd(layer, this.element, isDefender);

            wnd.onParticipate = () => { if (this.onParticipate) this.onParticipate(this.getCastleId(), isDefender); };
            wnd.onCancelApplication = () => { if (this.onCancelApplication) this.onCancelApplication(this.getCastleId(), isDefender); };
            wnd.onApprove = clan => { if (this.onApprove) this.onApprove(this.getCastleId(), clan); };
            wnd.onRefuse = clan => { if (this.onRefuse) this.onRefuse(this.getCastleId(), clan); };

            return wnd;
        });

        [SysString_T.SiegeDate, SysString_T.AttackInfo, SysString_T.DefenseInfo].forEach((label, index) => this.arrTabs.push(layer.tab(this.element, 12 + index * 74, 125, 74, 23, TEX_TAB, arrTabsSelected[index], manager.getSysString(label), null, () => this.selectTab(index))));
        this.selectTab(0);
    }

    public placeOnScreen(_screenWidth: number, screenHeight: number) { this.layer.place(this.element, 0, Math.trunc(screenHeight * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        if (visible) this.layer.getManager().playWindowSound();
        this.element.hidden = !visible;
        this.reset();
        if (visible) this.selectTab(0);
    }

    public setCrestGetter(getter: CrestGetter_T) { this.getCrest = this.arrPartWnds[0].list.getCrest = this.arrPartWnds[1].list.getCrest = getter; }

    public show(info: SiegeInfo_T, userClanId: number) { // NConsole 0x100721f0 -> Show, 0x1010c2d0
        this.setVisible(true);
        this.info = info;
        this.userClanId = userClanId;
        this.dateWnd.setTimes(info.serverTime, info.siegeTime, this.isOwner());
        this.paint();
    }

    public addClans(isDefender: boolean, clans: SiegeClan_T[]) { if (this.info) this.arrPartWnds[isDefender ? 1 : 0].addClans(clans, this.userClanId); } // 0x1010c340 / 0x1010c350

    protected getCastleId() { return this.info ? this.info.castleId : 0; }
    protected isOwner() { return !!this.info && this.info.ownerPrivileges !== 0; }

    protected reset() { // 0x1010c270
        this.info = null;
        this.arrPartWnds.forEach(wnd => wnd.reset());
        this.dateWnd.setTimes(0, 0, false);
        this.paint();
    }

    protected selectTab(index: number) { // 0x1010bb00
        this.arrTabs.forEach((tab, i) => {
            tab.setTextures(i === index ? arrTabsSelected[i] : TEX_TAB, arrTabsSelected[i]);
            tab.setAttribute("aria-selected", String(i === index));
        });
        this.dateWnd.element.hidden = index !== 0;
        this.arrPartWnds.forEach((wnd, i) => {
            wnd.element.hidden = index !== i + 1;
            if (index !== i + 1) return;

            if (!wnd.isRequested && this.info && this.onRequestList) this.onRequestList(this.info.castleId, i === 1);
            wnd.updateButtons(this.isOwner());
        });
        if (index === 0 && this.info) this.dateWnd.setTimes(this.info.serverTime, this.info.siegeTime, this.isOwner());
    }

    protected paint() {
        const layer = this.layer, manager = layer.getManager(), info = this.info, parent = this.content;
        const castleName = info ? manager.strings.residences[info.castleId] : null;

        parent.replaceChildren();
        if (castleName) layer.text(parent, castleName, 0xffb09b79, undefined, 120 - Math.trunc(layer.measureText(castleName) / 2), 41);
        [SysString_T.Lord, SysString_T.ClanRelation, SysString_T.AllianceRelation].forEach((id, index) => layer.text(parent, manager.getSysString(id), 0xffa3a3a3, undefined, 20, 70 + index * 16));

        if (!info || !info.ownerLeaderName) {
            layer.text(parent, manager.getSysString(SysString_T.NoCastleOwner), 0xffdcdcdc, undefined, 80, 70);
            return;
        }

        const isCrest = drawCrest(layer, parent, 80, 86, 16, this.getCrest && this.getCrest(info.ownerId, false));

        layer.text(parent, info.ownerLeaderName, 0xffdcdcdc, undefined, 80, 70);
        layer.text(parent, info.ownerName, 0xffdcdcdc, undefined, isCrest ? 100 : 80, 86);
        if (!info.ownerAllyName) layer.text(parent, manager.getSysString(SysString_T.NoAlliance), 0xffdcdcdc, undefined, 80, 102);
        else layer.text(parent, info.ownerAllyName, 0xffdcdcdc, undefined, drawCrest(layer, parent, 88, 102, 8, this.getCrest && this.getCrest(info.ownerId, true)) ? 100 : 80, 102);
    }
}

export default NCSiegeInfoMainWnd;
