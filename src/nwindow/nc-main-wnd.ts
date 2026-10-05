import type NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCSkillWnd from "./nc-skill-wnd";
import NCActionWnd from "./nc-action-wnd";
import NCDetailStatusWnd from "./nc-detail-status-wnd";
import type NCCoolTimeIcon from "./nc-cool-time-icon";

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
    public static getTextures() { return [TEX_BACK, ...arrTabs.flatMap(tab => [tab.texture, `${tab.texture}On`]), ...NCFrameCtrl.getTextures(), ...NCSkillWnd.getTextures(), ...NCActionWnd.getTextures(), ...NCDetailStatusWnd.getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly skillWnd: NCSkillWnd;
    public readonly actionWnd: NCActionWnd;
    public readonly detailStatusWnd: NCDetailStatusWnd;
    public onSelect: (tab: MainTab_T) => void = null;
    protected readonly caption: HTMLCanvasElement;
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly pages: Record<MainTab_T, HTMLDivElement>;
    protected selectedTab: MainTab_T = "status";

    public constructor(protected readonly layer: NDomLayer, coolTimes: Map<string, NCCoolTimeIcon>) {
        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 46, 0, 0, 256, 46, TEX_BACK);
        this.caption = NCFrameCtrl.createDOM(layer, this.element, 256, layer.getManager().getSysString(433));
        this.detailStatusWnd = new NCDetailStatusWnd(layer, this.element);
        this.skillWnd = new NCSkillWnd(layer, coolTimes, this.element);
        this.actionWnd = new NCActionWnd(layer, this.element);
        this.pages = { status: this.detailStatusWnd.element, skills: this.skillWnd.element, actions: this.actionWnd.element, clan: layer.createWindow(0, 66, 256, 335, this.element), quest: layer.createWindow(0, 66, 256, 335, this.element) };

        arrTabs.forEach((entry, index) => {
            const select = () => this.selectTab(entry.type);
            const tab = layer.tab(this.element, 12 + index * 44, 25, 44, 41, entry.texture, `${entry.texture}On`, null, layer.getManager().getSysString(entry.tooltip), select);

            this.tabs.push(tab);
        });
        this.selectTab("status");
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 266, Math.max(0, height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; this.element.querySelectorAll(".ndom-tooltip").forEach(element => element.remove()); }
    public getSelectedTab() { return this.selectedTab; }

    public selectTab(type: MainTab_T) {
        this.element.querySelectorAll(".ndom-tooltip").forEach(element => element.remove());
        this.selectedTab = type;
        arrTabs.forEach((entry, index) => {
            const selected = entry.type === type;

            this.pages[entry.type].hidden = !selected;
            this.tabs[index].setTextures(selected ? `${entry.texture}On` : entry.texture, `${entry.texture}On`);
            this.tabs[index].setAttribute("aria-selected", String(selected));
            if (!selected) return;

            const title = this.layer.getManager().getSysString(entry.title);

            this.layer.renderText(this.caption, title, 0xffc8d2dc);
            this.element.setAttribute("aria-label", title);
        });
        if (this.onSelect) this.onSelect(type);
    }
}

export default NCMainWnd;
