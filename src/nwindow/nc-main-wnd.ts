import type { default as NDomLayer, NDomButton_T } from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCSkillWnd from "./nc-skill-wnd";
import NCActionWnd from "./nc-action-wnd";
import NCQuestWnd from "./nc-quest-wnd";
import NCClanWnd from "./nc-clan-wnd";
import NCDetailStatusWnd from "./nc-detail-status-wnd";
import type NCCoolTimeIcon from "./nc-cool-time-icon";
import type { default as Skin, DetailStatusWndView_T, SkillWndView_T, ActionWndView_T, QuestWndView_T, ClanWndView_T } from "./skin";

const TEX_BACK = "L2UI_CH3.TabButton.MainWndTabBack";
const arrTabs: { type: MainTab_T, title: number, tooltip: number, texture: string }[] = [
    { type: "status", title: 433, tooltip: 194, texture: "L2UI_CH3.TabButton.MainWndTabBtn1" },
    { type: "skills", title: 119, tooltip: 196, texture: "L2UI_CH3.TabButton.MainWndTabBtn2" },
    { type: "actions", title: 127, tooltip: 197, texture: "L2UI_CH3.TabButton.MainWndTabBtn3" },
    { type: "clan", title: 439, tooltip: 895, texture: "L2UI_CH3.TabButton.MainWndTabBtn4" },
    { type: "quest", title: 118, tooltip: 198, texture: "L2UI_CH3.TabButton.MainWndTabBtn5" }
];

export type MainTab_T = "status" | "skills" | "actions" | "clan" | "quest";

export class NCMainWnd { // C4 NWindow RVA 0x5d8a0: five 44x41 tabs at (12,25), 256x335 pages at (0,66).
    public static getTextures() { return [TEX_BACK, ...arrTabs.flatMap(tab => [tab.texture, `${tab.texture}On`]), ...NCFrameCtrl.getTextures(), ...NCSkillWnd.getTextures(), ...NCActionWnd.getTextures(), ...NCQuestWnd.getTextures(), ...NCClanWnd.getTextures(), ...NCDetailStatusWnd.getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly skillWnd: SkillWndView_T;
    public readonly actionWnd: ActionWndView_T;
    public readonly questWnd: QuestWndView_T;
    public readonly clanWnd: ClanWndView_T;
    public readonly detailStatusWnd: DetailStatusWndView_T;
    public onSelect: (tab: MainTab_T) => void = null;
    protected readonly caption: HTMLDivElement;
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly pages: Record<MainTab_T, HTMLDivElement>;
    protected selectedTab: MainTab_T = "status";

    public constructor(protected readonly layer: NDomLayer, coolTimes: Map<string, NCCoolTimeIcon>, skin: Skin) {
        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 46, 0, 0, 256, 46, TEX_BACK);
        this.caption = NCFrameCtrl.createDOM(layer, this.element, 256, layer.getManager().getSysString(433), false, () => this.setVisible(false));
        this.detailStatusWnd = skin.createDetailStatusWnd(layer, this.element);
        this.skillWnd = skin.createSkillWnd(layer, coolTimes, this.element);
        this.actionWnd = skin.createActionWnd(layer, this.element);
        this.questWnd = skin.createQuestWnd(layer, this.element);
        this.clanWnd = skin.createClanWnd(layer, this.element);
        this.pages = { status: this.detailStatusWnd.element, skills: this.skillWnd.element, actions: this.actionWnd.element, clan: this.clanWnd.element, quest: this.questWnd.element };
        Object.values(this.pages).forEach(page => page.tabIndex = -1);

        arrTabs.forEach((entry, index) => {
            const select = () => this.selectTab(entry.type);
            const tab = layer.tab(this.element, 12 + index * 44, 25, 44, 41, entry.texture, `${entry.texture}On`, null, layer.getManager().getSysString(entry.tooltip), select);

            this.tabs.push(tab);
        });
        this.selectTab("status");
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 266, Math.max(0, height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        this.element.querySelectorAll(".ndom-tooltip").forEach(element => element.remove());
        this.skillWnd.setVisible(visible && this.selectedTab === "skills");
        this.clanWnd.setVisible(visible && this.selectedTab === "clan");
        if (visible && this.selectedTab === "quest") { // NCMainWnd Show 0x10064a1d / 0x1005f1a4 each show the selected page.
            this.questWnd.setVisible(true);
            this.questWnd.setVisible(true);
        } else this.questWnd.setVisible(false);
    }
    public getSelectedTab() { return this.selectedTab; }

    public selectTab(type: MainTab_T) {
        this.element.querySelectorAll(".ndom-tooltip").forEach(element => element.remove());
        if (type === "skills") this.skillWnd.setVisible(false);
        this.selectedTab = type;
        arrTabs.forEach((entry, index) => {
            const selected = entry.type === type;

            if (entry.type === "quest") this.questWnd.setVisible(selected);
            else if (entry.type === "skills") this.skillWnd.setVisible(selected);
            else if (entry.type === "clan") this.clanWnd.setVisible(selected);
            else this.pages[entry.type].hidden = !selected;
            this.tabs[index].setTextures(selected ? `${entry.texture}On` : entry.texture, `${entry.texture}On`);
            this.tabs[index].setAttribute("aria-selected", String(selected));
            if (!selected) return;

            const title = this.layer.getManager().getSysString(entry.title);

            this.layer.renderText(this.caption, title, 0xffc8d2dc);
            this.element.setAttribute("aria-label", title);
        });
        this.pages[type].focus();
        if (this.onSelect) this.onSelect(type);
    }
}

export default NCMainWnd;
