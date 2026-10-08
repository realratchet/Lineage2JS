import NCClanWnd from "./nc-clan-wnd";
import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";
import type { ClanInfo_T, ClanMember_T, GMViewPledgeInfo_T, UserInfo_T } from "../network/game-packets";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";

class NCGMClanPage extends NCClanWnd {
    public constructor(layer: NDomLayer, parent: HTMLElement) {
        super(layer, parent);
        layer.place(this.element, 0, 20, 256, 335);
        this.element.dataset.window = "gm-clan-page";
        this.buttons[5].setLabel(this.strings.sysStrings[883]);
        this.updateEnabled();
    }

    public setStrings(strings: GameStrings_T) {
        super.setStrings(strings);
        this.buttons[5].setLabel(strings.sysStrings[883]);
    }

    public setClan(clan: ClanInfo_T) {
        const previous = this.clan;

        super.setClan({ ...clan, name: clan.name || (previous ? previous.name : ""), leaderName: clan.leaderName || (previous ? previous.leaderName : "") });
    }

    protected updateEnabled() {
        super.updateEnabled();
        [0, 1, 2, 3, 4, 6, 7, 8, 9, 10].forEach(index => {
            this.enabled[index] = false;
            this.buttons[index].setEnabled(false);
            this.buttons[index].setAttribute("aria-disabled", "true");
        });
    }

    protected paintHeader() {
        const layer = this.layer, strings = this.strings.sysStrings, clan = this.clan, parent = this.header;

        parent.replaceChildren();
        if (clan && clan.name) layer.text(parent, clan.name, 0xffb09b79, undefined, 19, 10);
        layer.text(parent, strings[342], 0xffa3a3a3, undefined, 19, 26);
        if (clan && clan.leaderName) layer.text(parent, clan.leaderName, 0xffb09b79, undefined, 61, 26);
        layer.text(parent, strings[88], 0xffa3a3a3, undefined, 192, 26);
        layer.text(parent, String(clan ? clan.level : 0), 0xffb09b79, undefined, 208, 26);
        layer.text(parent, strings[343], 0xffa3a3a3, undefined, 19, 42);
        if (!clan) return;

        if (clan.hasCastle) {
            layer.text(parent, strings[345], 0xffb09b79, undefined, 61, 42);
            if (clan.hasHideout) layer.text(parent, strings[344], 0xffb09b79, undefined, 63 + layer.measureText(strings[345]), 42);
        } else if (clan.hasHideout) layer.text(parent, strings[344], 0xffb09b79, undefined, 61, 42);
    }
}

export class NCGMClanWnd {
    public static getTextures() { return [...NCFrameCtrl.getTextures(), ...NCClanWnd.getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly clanWnd: NCGMClanPage;
    public onRequest: (targetName: string, kind: number) => void = null;
    public onAction: (action: string, selected: ClanMember_T) => void = null;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement = layer.root) {
        this.element = layer.createWindow(layer.root.clientWidth - 209, 100, 256, 355, parent);
        this.element.hidden = true;
        this.element.dataset.window = "gm-clan";
        NCFrameCtrl.createDOM(layer, this.element, 256, "", false, () => this.setVisible(false));
        this.clanWnd = new NCGMClanPage(layer, this.element);
        this.clanWnd.onAction = (action, selected) => { if (this.onAction) this.onAction(action, selected); };
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 209, 100); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        this.clanWnd.setVisible(visible);
    }
    public setStatus(status: UserInfo_T) { this.clanWnd.setStatus(status); }
    public setStrings(strings: GameStrings_T) { this.clanWnd.setStrings(strings); }
    public setInfo(info: GMViewPledgeInfo_T) {
        this.clanWnd.setClan(info.clan);
        this.clanWnd.clearMembers();
        info.members.forEach(member => this.clanWnd.addMember(member));
    }
    public toggle(targetName: string) {
        if (this.isVisible()) { this.setVisible(false); return; }

        if (this.onRequest) this.onRequest(targetName, 2);
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
    }
}

export default NCGMClanWnd;
