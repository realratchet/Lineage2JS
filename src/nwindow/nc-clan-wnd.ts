import type NDomLayer from "./ndom";
import NCListCtrl, { getClassIcon, paintListColumn, paintListSelection, createClassTooltip } from "./nc-list-ctrl";
import { type NDomButton_T, type NDomScrollPane_T } from "./ndom";
import type { ClanInfo_T, ClanMember_T, UserInfo_T } from "../network/game-packets";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";

const TEX_PATH = "L2UI_CH3.BloodHoodWnd.";
const arrActions = ["invite", "title", "deleteTitle", "dismiss", "privileges", "authorize", "declareWar", "endWar", "leave", "setCrest", "deleteCrest", "penalty", "setInsignia", "deleteInsignia", "community"];
const arrLabels = [330, 331, 842, 338, 666, 667, 1205, 1206, 337, 332, 843, 1207, 1208, 1209, 387];
const arrColumns = [124, 32, 32, 52];
const arrHeaderLabels = [50, 88, 391, 346];

type ClanRow_T = ClanMember_T & { dataObjectId: number, dataClassId: number, tooltipClassId: number };

function foldName(name: string) { return name.replace(/[A-Z]/g, value => value.toLowerCase()); }

export class NCClanWnd {
    public static getTextures() { return ["BloodHood_Back", "BloodHood_Logon", "BloodHood_Logoff"].map(name => TEX_PATH + name).concat(["L2UI_CH3.BUTTON.Btn1_normal", "L2UI_CH3.BUTTON.Btn1_normalOn"], NCListCtrl.getTextures()); }
    public readonly element: HTMLDivElement;
    public onAction: (action: string, selected: ClanMember_T) => void = null;
    protected readonly header: HTMLDivElement;
    protected readonly list: NDomScrollPane_T;
    protected readonly buttons: NDomButton_T[] = [];
    protected readonly headers: HTMLDivElement[] = [];
    protected strings: GameStrings_T;
    protected status: UserInfo_T = null;
    protected clan: ClanInfo_T = null;
    protected rows: ClanRow_T[] = [];
    protected selectedIndex = -1;
    protected hoverIndex = -1;
    protected displayedCount = 0;
    protected ascending = [true, true, true, true];
    protected enabled = arrActions.map(() => true);
    protected tooltip: HTMLDivElement = null;
    protected tooltipRow: ClanRow_T = null;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement) {
        this.strings = layer.getManager().strings;
        this.element = layer.createWindow(0, 66, 256, 335, parent);
        this.element.hidden = true;
        this.element.dataset.window = "clan";
        layer.tile(this.element, 0, 0, 256, 335, 0, 0, 256, 335, TEX_PATH + "BloodHood_Back");
        this.header = layer.createWindow(0, 0, 256, 62, this.element);
        this.list = layer.scrollPane(this.element, 8, 81, 240, 118, 17);
        this.list.content.style.width = "240px";
        this.list.setAttribute("role", "listbox");
        const setScroll = this.list.setScroll;

        this.list.setScroll = (position, isClamped = true) => {
            setScroll(position, isClamped);
            this.list.content.style.top = "0px";
            this.paintRows();
        };
        this.list.content.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            this.selectedIndex = this.hitRow(event.clientY);
            this.hoverIndex = this.selectedIndex;
            this.paintRows();
        });
        this.list.content.addEventListener("mousemove", event => { this.hoverIndex = this.hitRow(event.clientY); this.showTooltip(); });
        this.list.content.addEventListener("mouseleave", () => { this.hoverIndex = -1; this.hideTooltip(); });
        this.list.content.addEventListener("contextmenu", event => event.preventDefault());
        let x = 8;

        arrColumns.forEach((width, index) => {
            const header = layer.button(this.element, x, 62, width, 19, null, null, null, null, () => this.sort(index));
            const face = layer.createWindow(0, 0, width, 19, header);
            let isDown = false, isHover = false;
            const paint = () => this.paintColumn(face, index, isDown && isHover ? "_down" : isHover ? "_over" : "");

            face.style.pointerEvents = "none";
            header.dataset.clanColumn = String(index);
            header.setAttribute("aria-label", this.strings.sysStrings[arrHeaderLabels[index]]);
            header.addEventListener("mouseenter", () => { isHover = true; paint(); });
            header.addEventListener("mouseleave", () => { isHover = false; paint(); });
            header.addEventListener("mousedown", event => {
                if (event.button !== 0) return;
                if (event.detail === 2) { event.stopImmediatePropagation(); return; }

                isDown = true;
                paint();
                const up = () => { isDown = false; paint(); window.removeEventListener("mouseup", up, true); };

                window.addEventListener("mouseup", up, true);
            }, true);
            header.addEventListener("wheel", event => this.list.setScroll(this.list.getScroll() + Math.sign(event.deltaY) * 17));
            this.headers.push(face);
            paint();
            x += width;
        });
        arrActions.forEach((action, index) => {
            const button = layer.button(this.element, 11 + index % 3 * 80, [202, 227, 252, 281, 306][Math.floor(index / 3)], 76, 23, "L2UI_CH3.BUTTON.Btn1_normal", "L2UI_CH3.BUTTON.Btn1_normalOn", "L2UI_CH3.BUTTON.Btn1_normal", this.strings.sysStrings[arrLabels[index]], () => {
                const row = this.rows[this.selectedIndex];

                if (this.onAction) this.onAction(action, row ? { name: row.name, level: row.level, classId: row.dataClassId, objectId: row.dataObjectId, isOnline: row.isOnline } : null);
            });

            button.dataset.clanAction = action;
            button.addEventListener("mousedown", event => { if (event.detail === 2) event.stopImmediatePropagation(); }, true);
            this.buttons.push(button);
        });
        this.paintHeader();
        this.paintRows();
    }

    public setStrings(strings: GameStrings_T) {
        this.strings = strings;
        this.buttons.forEach((button, index) => button.setLabel(strings.sysStrings[arrLabels[index]]));
        this.headers.forEach((header, index) => this.paintColumn(header, index, ""));
        this.paintHeader();
    }

    public setStatus(status: UserInfo_T) { this.status = status; this.updateEnabled(); }
    public setClan(clan: ClanInfo_T) { this.clan = clan; this.paintHeader(); }

    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;
        if (!isVisible) this.hideTooltip();
        if (isVisible) { this.refreshList(); this.updateEnabled(); }
    }

    public clearMembers() {
        this.rows = [];
        this.selectedIndex = this.hoverIndex = -1;
        this.displayedCount = 0;
        this.list.setContentHeight(0);
        this.list.setScroll(0);
    }

    public addMember(member: ClanMember_T) {
        const row = this.rows.find(row => foldName(row.name) === foldName(member.name));

        if (row) {
            row.level = member.level;
            if (member.classId > -1) row.classId = member.classId;
            row.objectId = member.objectId;
            row.isOnline = member.objectId > 0;
            this.paintRows();
            return;
        }
        if (this.rows.length >= 1000) return;

        this.rows.push({ ...member, isOnline: member.objectId > 0, dataObjectId: member.objectId, dataClassId: member.classId, tooltipClassId: member.classId > -1 ? member.classId : 0 });
        this.refreshList();
    }

    public updateMember(member: ClanMember_T) {
        const row = this.rows.find(row => member.name && foldName(row.name) === foldName(member.name));

        if (!row) return;

        row.level = member.level;
        row.objectId = member.objectId;
        row.isOnline = member.objectId > 0;
        if (row.isOnline) {
            if (member.classId > -1) row.classId = member.classId;
            row.dataObjectId = member.objectId;
            row.dataClassId = member.classId;
            row.tooltipClassId = row.classId > -1 ? row.classId : 0;
        }
        this.paintRows();
    }

    public deleteMember(name: string) {
        const index = this.rows.findIndex(row => foldName(row.name) === foldName(name));

        if (index < 0) return;

        this.rows.splice(index, 1);
        this.paintRows();
    }

    protected refreshList() {
        this.displayedCount = this.rows.length;
        this.list.setContentHeight(this.displayedCount * 17, true);
        this.list.content.style.top = "0px";
        this.paintRows();
    }

    protected hitRow(clientY: number) {
        const y = this.layer.toUI(clientY - this.list.getBoundingClientRect().top);
        const row = Math.floor(y / 17) + this.list.getScroll() / 17;

        return y >= 0 && y < 118 && row < this.displayedCount ? row : -1;
    }

    protected sort(column: number) {
        const selected = this.rows[this.selectedIndex];
        const direction = this.ascending[column] ? 1 : -1;

        this.rows.sort((a, b) => {
            if (column === 1) return (a.level - b.level) * direction;

            const left = column === 0 ? foldName(a.name) : column === 2 ? a.classId > -1 ? String(a.classId) : "" : a.isOnline ? "1" : "2";
            const right = column === 0 ? foldName(b.name) : column === 2 ? b.classId > -1 ? String(b.classId) : "" : b.isOnline ? "1" : "2";

            return (left < right ? -1 : left > right ? 1 : 0) * direction;
        });
        this.ascending[column] = !this.ascending[column];
        if (selected) this.selectedIndex = this.rows.indexOf(selected);
        this.paintRows();
    }

    protected paintColumn(parent: HTMLElement, index: number, state: string) {
        paintListColumn(this.layer, parent, arrColumns[index], this.strings.sysStrings[arrHeaderLabels[index]], state);
    }

    protected paintRows() {
        const parent = this.list.content, layer = this.layer, first = this.list.getScroll() / 17;

        this.hideTooltip();
        parent.replaceChildren();
        parent.style.height = "118px";
        for (let visible = 1; visible < 8; visible += 2) layer.tile(parent, 0, visible * 17 - 1, 240, 17, 0, 0, 8, 15, "L2UI_CH3.Etc.textbackline");
        for (let visible = 0; visible < 7; visible++) {
            const index = first + visible, row = this.rows[index];

            if (!row || index > this.displayedCount) break;
            if (index === this.selectedIndex) {
                paintListSelection(layer, parent, 240, visible * 17);
            }
            let x = 0;

            arrColumns.forEach((width, column) => {
                const cell = layer.createWindow(x, visible * 17 + 2, width, 15, parent);

                cell.style.overflow = "hidden";
                cell.dataset.clanMember = row.name;
                if (column < 2) layer.text(cell, column === 0 ? row.name : String(row.level), 0xffdcdcdc, undefined, 10, 1);
                else if (column === 2 && row.classId > -1) {
                    layer.tile(cell, Math.trunc(width / 2) - 5, 1, 11, 11, 0, 0, 11, 11, getClassIcon(row.classId));
                } else if (column === 3) layer.tile(cell, Math.trunc(width / 2) - 16, 1, 32, 11, 0, 0, 32, 11, TEX_PATH + (row.isOnline ? "BloodHood_Logon" : "BloodHood_Logoff"));
                x += width;
            });
        }
        this.showTooltip();
    }

    protected hideTooltip() {
        if (this.tooltip) this.tooltip.remove();
        this.tooltip = null;
        this.tooltipRow = null;
    }

    protected showTooltip() {
        const row = this.rows[this.hoverIndex];

        if (this.hoverIndex !== this.selectedIndex || !row || this.element.closest("[hidden]")) { this.hideTooltip(); return; }
        if (this.tooltipRow === row) return;

        this.hideTooltip();
        const rect = this.list.getBoundingClientRect();

        this.tooltipRow = row;
        this.tooltip = createClassTooltip(this.layer, row.tooltipClassId, this.layer.toUI(rect.left), this.layer.toUI(rect.top) + (this.hoverIndex - this.list.getScroll() / 17) * 17 + 3);
    }

    protected paintHeader() {
        const layer = this.layer, strings = this.strings.sysStrings, clan = this.clan, parent = this.header;

        parent.replaceChildren();
        layer.text(parent, clan && clan.name ? clan.name : strings[431], 0xffb09b79, undefined, 19, 10);
        layer.text(parent, strings[342], 0xffa3a3a3, undefined, 19, 26);
        layer.text(parent, clan ? clan.leaderName : "", 0xffb09b79, undefined, 61, 26);
        layer.text(parent, strings[88], 0xffa3a3a3, undefined, 192, 26);
        layer.text(parent, strings[343], 0xffa3a3a3, undefined, 19, 42);
        if (!clan || !clan.name) return;

        layer.text(parent, strings[clan.dissolving === 3 ? 341 : clan.isAtWar ? 340 : 894], 0xffb09b79, undefined, 192, 10);
        layer.text(parent, String(clan.level), 0xffb09b79, undefined, 208, 26);
        if (clan.hasHideout > 0) {
            const name = this.strings.residences[clan.hasHideout];

            layer.text(parent, name, 0xffb09b79, undefined, 61, 42);
            if (clan.hasCastle > 0) {
                const width = layer.measureText(name);

                layer.text(parent, ",", 0xffb09b79, undefined, 61 + width, 42);
                layer.text(parent, this.strings.residences[clan.hasCastle], 0xffb09b79, undefined, 65 + width, 42);
            }
        } else layer.text(parent, clan.hasCastle > 0 ? this.strings.residences[clan.hasCastle] : strings[27], 0xffb09b79, undefined, 61, 42);
    }

    protected updateEnabled() {
        if (!this.status) return;

        const user = this.status, leader = !!(user.clanRelation & 0x40);

        if (leader) this.enabled = arrActions.map(action => action !== "leave");
        else {
            [0, 1, 3, 5, 6, 7, 9, 12, 13].forEach(index => this.enabled[index] = false);
            [4, 8, 11, 14].forEach(index => this.enabled[index] = true);
        }
        if (user.pledgePrivileges[0] & 1) this.enabled[0] = true;
        if (user.pledgePrivileges[0] & 2) this.enabled[1] = true;
        if (user.pledgePrivileges[0] & 8) this.enabled[9] = true;
        if (user.pledgePrivileges[1] & 4) this.enabled[6] = this.enabled[7] = true;
        if (user.clanId <= 0) this.enabled.fill(false);
        if (user.isNoble) this.enabled[1] = this.enabled[2] = true;
        this.buttons.forEach((button, index) => { button.setEnabled(this.enabled[index]); button.setAttribute("aria-disabled", String(!this.enabled[index])); });
    }
}

export default NCClanWnd;
