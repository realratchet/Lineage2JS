import NCDetailStatusWnd from "./nc-detail-status-wnd";
import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";
import type { UserInfo_T, GMViewCharacterInfo_T } from "../network/game-packets";
import SysString_T from "./sys-string";

const cacheCrestUrls = new WeakMap<CanvasImageSource, string>();

function getCrestUrl(crest: CanvasImageSource) {
    if (!cacheCrestUrls.has(crest)) cacheCrestUrls.set(crest, (crest as HTMLCanvasElement).toDataURL());

    return cacheCrestUrls.get(crest);
}

export type GMClanInfo_T = { clanId: number, name: string, crestId: number };

class NCGMDetailStatusPage extends NCDetailStatusWnd {
    protected gmClan: GMClanInfo_T = null;
    protected crest: CanvasImageSource = null;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        super(layer, parent);
        layer.place(this.element, 0, 20, 256, 335);
    }

    public setGMClan(info: GMClanInfo_T, crest: CanvasImageSource) {
        this.gmClan = info;
        this.crest = crest;
        this.paint();
    }
    protected drawText(x: number, y: number, text: string, color: number = 0xffb09b79, align: CanvasTextAlign = "left") {
        if (y === 25) return;
        if (x === 235 && y === 177) return;
        if (x === 235 && y === 192) y++;

        super.drawText(x, y, text, color, align);
    }
    protected paint() {
        super.paint();
        if (!this.status) return;

        const layer = this.layer, info = this.status as UserInfo_T & GMViewCharacterInfo_T;
        const clan = this.gmClan && this.gmClan.clanId === info.clanId ? this.gmClan : null;
        const x = layer.measureText(layer.getManager().getSysString(SysString_T.ClanNameLabel)) + 20;

        if (clan) {
            if (this.crest) {
                const crest = layer.createWindow(x, 25, 16, 12, this.values);

                crest.style.background = `url(${getCrestUrl(this.crest)}) 0 -4px no-repeat`;
            }
            if (clan.name) super.drawText(x + (clan.crestId > 0 ? 20 : 0), 25, clan.name);
        } else super.drawText(x, 25, layer.getManager().getSysString(SysString_T.NoClan), 0xffdcdcdc);

        const speeds = [info.swimRunSpd, info.swimWalkSpd, info.flyRunSpd, info.flyWalkSpd, info.runSpd, info.walkSpd].map(speed => Math.trunc(speed * info.moveMultiplier));
        const text = `${speeds[0]},${speeds[1]}/${speeds[2]},${speeds[3]}/${speeds[4]},${speeds[5]}`;

        super.drawText(235, 208, text, 0xffb09b79, "right");
        super.drawText(235 - layer.measureText(text), 220, "Water/Air/Ground", 0xffa3a3a3);
    }
}

export class NCGMDetailStatusWnd {
    public static getTextures() { return [...NCFrameCtrl.getTextures(), ...NCDetailStatusWnd.getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly statusWnd: NCGMDetailStatusPage;
    public onRequest: (targetName: string, kind: number) => void = null;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement = layer.root) {
        this.element = layer.createWindow(0, 100, 256, 355, parent);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        NCFrameCtrl.createDOM(layer, this.element, 256, "", false, () => this.setVisible(false));
        this.statusWnd = new NCGMDetailStatusPage(layer, this.element);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, 100); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }
    public setClan(info: GMClanInfo_T, crest: CanvasImageSource = null) { this.statusWnd.setGMClan(info, crest); }
    public setCharacterInfo(info: GMViewCharacterInfo_T) {
        this.statusWnd.setStatus({ ...info, isHero: false, isNoble: false } as UserInfo_T);
    }
    public toggle(targetName: string) {
        if (this.isVisible()) { this.setVisible(false); return; }

        if (this.onRequest) this.onRequest(targetName, 1);
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
    }
}

export default NCGMDetailStatusWnd;
