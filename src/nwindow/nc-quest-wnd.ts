import type NDomLayer from "./ndom";
import { NDOM_SCROLL_TEXTURES, type NDomScrollPane_T } from "./ndom";
import NCTooltip from "./nc-tooltip";
import { ItemType2_T, type QuestState_T, type InventoryItem_T } from "../network/game-packets";
import type { GameStrings_T, QuestInfo_T } from "../assets/decode-worker/decode-protocol";

const TEX_PATH = "L2UI_CH3.QUESTWND.";
const TEX_CHECK = "L2UI.Control.CheckBox";
const TEX_CHECKED = "L2UI.ActionWnd.CheckBox_checked"; // Core 0x1014dfed resolves the native Control request with outerIndex -1.
const TEX_SELECT = "L2UI_CH3.ListCtrl.TextSelect";
const TEX_SELECT_END = "L2UI_CH3.ListCtrl.TextSelect2";
const TEX_OUTLINE = "L2UI_CH3.Etc.menu_outline";

type QuestNode_T = { kind: number, info: QuestInfo_T, completed: boolean, expanded: boolean, selected: boolean, children: QuestNode_T[], available: number[] };
export type QuestLocation_T = { id: number, name: string, x: number, y: number, z: number, unk0: number };

export class NCQuestWnd {
    public static getTextures() { return ["QuestWndBack", "QuestWndToolTipBtn", "QuestWndPlusBtn", "QuestWndMinusBtn", "QuestWndDownBtn", "QuestWndUpBtn", "QUESTWNDPANEL1", "QUESTWNDPANEL2", "QUESTWNDPANEL3", ...Array.from({ length: 5 }, (_, i) => `QuestWndInfoIcon_${i + 1}`)].map(name => TEX_PATH + name).concat([TEX_CHECK, TEX_CHECKED, TEX_SELECT, TEX_SELECT_END, TEX_OUTLINE, "L2UI_CH3.BUTTON.Btn1_normal", "L2UI_CH3.BUTTON.Btn1_normalOn", ...NDOM_SCROLL_TEXTURES, ...new NCTooltip().getTextures()]); }
    public readonly element: HTMLDivElement;
    public onShow: () => void = null;
    public onHide: () => void = null;
    public onAbort: (id: number) => void = null;
    public onLocationChange: (location: QuestLocation_T) => void = null;
    protected readonly list: NDomScrollPane_T;
    protected readonly count: HTMLCanvasElement;
    protected readonly checkbox: HTMLDivElement;
    protected strings: GameStrings_T;
    protected states: QuestState_T[] = [];
    protected inventory: InventoryItem_T[] = [];
    protected nodes: QuestNode_T[] = [];
    protected current: QuestNode_T = null;
    protected cachedQuestId = 0;
    protected location: QuestLocation_T = null;
    protected isLocationChecked = true;
    protected help: HTMLDivElement = null;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement) {
        this.strings = layer.getManager().strings;
        this.element = layer.createWindow(0, 66, 256, 335, parent);
        this.element.hidden = true;
        this.element.dataset.window = "quest";
        layer.tile(this.element, 0, 0, 256, 335, 0, 0, 256, 335, TEX_PATH + "QuestWndBack");
        layer.text(this.element, this.strings.sysStrings[324], 0xffdcdcdc, undefined, 11, 12);
        this.count = layer.text(this.element, "(0/15)", 0xffb09b79, undefined, 190, 12);
        this.list = layer.scrollPane(this.element, 7, 27, 242, 274, 16);
        this.list.content.style.width = "226px";
        this.list.content.style.overflow = "hidden";
        this.list.setAttribute("role", "tree");
        layer.button(this.element, 91, 306, 77, 23, "L2UI_CH3.BUTTON.Btn1_normal", "L2UI_CH3.BUTTON.Btn1_normalOn", "L2UI_CH3.BUTTON.Btn1_normal", this.strings.sysStrings[385], () => {
            const selected = this.nodes.find(node => node.selected);

            if (this.onAbort) this.onAbort(selected ? selected.info.id : -1);
        });

        this.checkbox = layer.checkbox(this.element, 10, 310, 100, 12, this.strings.sysStrings[860], checked => {
            this.isLocationChecked = checked;
            this.updateLocation();
        }, true);

        const help = layer.createWindow(232, 10, 15, 15, this.element);

        help.dataset.questHelp = "true";
        layer.tile(help, 0, 0, 15, 15, 0, 0, 15, 15, TEX_PATH + "QuestWndToolTipBtn");
        help.addEventListener("mouseenter", () => this.showHelp(help));
        help.addEventListener("mouseleave", () => this.hideHelp());
    }

    public setVisible(isVisible: boolean) {
        if (isVisible) {
            this.element.hidden = false;
            this.clear();
            if (this.onShow) this.onShow();
        } else {
            this.element.hidden = true;
            this.hideHelp();
            if (this.onHide) this.onHide();
        }
    }

    public clear() {
        this.states = [];
        this.nodes = [];
        this.current = null;
        this.list.setScroll(0);
        this.paint();
    }

    public setStrings(strings: GameStrings_T) { this.strings = strings; }
    public getLocation() { return this.location; }

    public clearLocation() {
        if (!this.location) return;

        this.location = null;
        if (this.onLocationChange) this.onLocationChange(null);
    }

    public async setStates(states: QuestState_T[]) {
        states = states.filter(state => this.strings.quests.some(info => info.tag !== 0 && info.id === state.id));
        this.states = states;
        const nodes: QuestNode_T[] = [];
        const textures: string[] = [];

        for (const state of states) {
            const mask = state.condition & 0x80000000 ? state.condition : state.condition > 0 ? (2 ** Math.min(state.condition, 30) - 1) | 0 : 0;
            const progress: number[] = [];

            for (let bit = 0; bit < 30; bit++) if (mask & (1 << bit)) progress.push(bit + 1);

            let parent: QuestNode_T = null;

            progress.forEach((progressId, index) => {
                const info = this.strings.quests.find(info => info.tag !== 0 && info.id === state.id && info.progressId === progressId);

                if (!info) {
                    if (progressId === 1) throw new Error(`Quest ${state.id} has no initial quest data.`);
                    parent = null;
                    return;
                }
                if (progressId === 1) {
                    parent = { kind: 1, info, completed: false, expanded: false, selected: false, children: [], available: [] };
                    nodes.push(parent);
                }
                if (!parent) return;

                const completed = index !== progress.length - 1;
                const description: QuestNode_T = { kind: 3, info, completed, expanded: false, selected: false, children: [], available: info.itemIds.map(() => 0) };
                const node: QuestNode_T = { kind: 2, info, completed, expanded: false, selected: false, children: [description], available: [] };

                parent.children.push(node);
                info.itemIds.forEach(id => textures.push(this.strings.itemIcons[id]));
            });
        }
        for (const node of nodes) if (node.info.id === this.cachedQuestId) {
            node.expanded = node.selected = true;
            const progress = node.children[node.children.length - 1];

            progress.expanded = progress.selected = true;
        }
        await this.layer.loadTextures([...new Set(textures)]);
        if (this.states !== states) return;

        this.nodes = nodes;
        this.current = null;
        this.list.setScroll(0);
        this.paint();
    }

    public setInventory(inventory: InventoryItem_T[]) {
        this.inventory = inventory;
        this.paint();
    }

    protected paint() {
        const layer = this.layer;

        this.list.content.replaceChildren();
        layer.renderText(this.count, `(${this.states.length}/15)`, 0xffb09b79);
        const isVisible = !this.element.closest("[hidden]");

        if (isVisible) for (const node of this.nodes) if (node.expanded) for (const progress of node.children) this.current = progress;
        if (isVisible && this.current) {
            this.cachedQuestId = this.current.expanded ? this.current.info.id : 0;
            const description = this.current.children[this.current.children.length - 1];

            if (description && description.kind === 3) description.available = description.info.itemIds.map(id => {
                let count = 0;

                for (const item of this.inventory) if (!item.isEquipped && item.type2 !== ItemType2_T.TYPE2_MONEY && item.itemId === id) count = count + item.count | 0;

                return count;
            });
        }
        let y = 5;

        for (const node of this.nodes) y += this.paintNode(node, this.nodes, 3, y);

        this.list.setContentHeight(y);
        if (isVisible) this.updateLocation();
    }

    protected paintNode(node: QuestNode_T, siblings: QuestNode_T[], x: number, y: number): number {
        const layer = this.layer, canvas = layer.getManager().canvas, info = node.info;
        const lineHeight = canvas.getLineHeight();
        let height = 0;

        if (node.kind === 3) {
            const button = layer.createWindow(x, y, 34, 32, this.list.content);

            button.style.zIndex = "1";
            button.dataset.questDescription = "true";
            button.addEventListener("mousedown", event => {
                if (event.button !== 0 || event.detail === 2) return;

                siblings.forEach(sibling => sibling.selected = false);
                this.current = node;
                this.paint();
            });
            return this.paintDescription(node, x, y);
        }

        const title = node.kind === 1 ? info.title : info.progressTitle || info.title;
        const width = canvas.measureText(title);
        const button = layer.createWindow(x, y, width + 32, 14, this.list.content);

        button.style.zIndex = "1";
        button.setAttribute("role", "treeitem");
        button.setAttribute("aria-label", title);
        button.setAttribute("aria-expanded", String(node.expanded));
        button.setAttribute("aria-selected", String(node.selected));
        button.dataset.questId = String(info.id);
        button.dataset.progressId = String(node.kind === 1 ? 0 : info.progressId);
        button.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2) return;

            const rect = button.getBoundingClientRect();

            siblings.forEach(sibling => sibling.selected = false);
            node.expanded = !node.expanded;
            if (node.expanded) node.selected = true;
            if (layer.toUI(event.clientX - rect.left) === 0 && layer.toUI(event.clientY - rect.top) === 0) node.expanded = !node.expanded;
            this.current = node;
            this.paint();
        });
        const texture = node.kind === 1 ? node.expanded ? "QuestWndMinusBtn" : "QuestWndPlusBtn" : node.expanded ? "QuestWndUpBtn" : "QuestWndDownBtn";

        layer.tile(button, 0, 0, 14, 14, 0, 0, 14, 14, TEX_PATH + texture);
        if (node.kind === 1) {
            if (node.expanded) {
                layer.tile(this.list.content, x + 14, y + 1, 177, 13, 0, 0, 16, 13, TEX_SELECT);
                layer.tile(this.list.content, x + 191, y + 1, 32, 13, 0, 0, 32, 13, TEX_SELECT_END);
            }
            layer.text(this.list.content, title, 0xffdcdcdc, undefined, x + 19, y + 2);
            const level = info.minLevel > 0 ? info.maxLevel > 0 ? `${info.minLevel}~${info.maxLevel}` : `${info.minLevel} ${this.strings.sysStrings[859]}` : this.strings.sysStrings[866];

            layer.text(this.list.content, `(${this.strings.sysStrings[922]}:${level})`, 0xffb09b79, undefined, x + 19, y + lineHeight + 2);
            if (info.classification >= 0 && info.classification <= 3) {
                const icons = info.classification < 2 ? [4, info.classification + 1] : [3, info.classification - 1];

                icons.forEach((icon, index) => layer.tile(this.list.content, x + 24 + width + index * 11, y, 11, 11, 0, 0, 11, 11, TEX_PATH + `QuestWndInfoIcon_${icon}`));
            }
            height = lineHeight + 21;
        } else {
            layer.text(this.list.content, title, 0xffdcdcdc, undefined, x + 19, y);
            if (info.entityName) layer.tile(this.list.content, x + 24 + width, y, 11, 11, 0, 0, 11, 11, TEX_PATH + "QuestWndInfoIcon_5");
            if (node.completed && info.unk1) layer.text(this.list.content, this.strings.sysStrings[898], 0xffb09b79, undefined, x + width + (info.entityName ? 40 : 24), y);
            height = 19;
        }
        if (node.expanded) for (const child of node.children) height += this.paintNode(child, node.children, x + 7, y + height);

        return height;
    }

    protected paintDescription(node: QuestNode_T, x: number, y: number) {
        const layer = this.layer, canvas = layer.getManager().canvas, info = node.info;
        const lines = canvas.wrapText(info.description.replace(/\\n/g, "\n"), 226 - x - 5);
        const textHeight = lines.length * canvas.getLineHeight(), height = textHeight + info.itemIds.length * 37 + 10;

        layer.tile(this.list.content, x - 5, y - 2, 211, 8, 0, 0, 211, 8, TEX_PATH + "QUESTWNDPANEL1");
        layer.tile(this.list.content, x - 5, y + 6, 211, height - 16, 0, 0, 211, 8, TEX_PATH + "QUESTWNDPANEL2");
        layer.tile(this.list.content, x - 5, y + height - 10, 211, 8, 0, 0, 211, 8, TEX_PATH + "QUESTWNDPANEL3");
        lines.forEach((line, index) => layer.text(this.list.content, line, 0xff8c8c8c, undefined, x, y + index * canvas.getLineHeight()));
        info.itemIds.forEach((id, index) => {
            const itemY = y + textHeight + index * 37;
            const required = info.itemCounts[index] | 0;
            const available = node.completed && info.unk2 ? this.strings.sysStrings[898] : String(node.available[index]);
            const target = required > 0 ? String(required) : required === 0 ? this.strings.sysStrings[858] : `${-required | 0}${this.strings.sysStrings[859]}`;

            layer.tile(this.list.content, x, itemY + 5, 32, 32, 0, 0, 32, 32, this.strings.itemIcons[id]);
            layer.tile(this.list.content, x - 1, itemY + 4, 34, 34, 0, 0, 34, 34, TEX_OUTLINE);
            layer.text(this.list.content, this.strings.itemNames[id], 0xffb09b79, undefined, x + 37, itemY + 5);
            layer.text(this.list.content, `(${available}/${target})`, 0xffdcdcdc, undefined, x + 37, itemY + canvas.getLineHeight() + 10);
        });

        return height;
    }

    protected updateLocation() {
        const node = this.current;

        if (!this.isLocationChecked || !node || node.kind !== 2 || node.completed || !node.info.entityName) { this.clearLocation(); return; }

        const info = node.info;
        const location = { id: info.id, name: info.entityName, x: info.questX, y: info.questY, z: info.questZ, unk0: info.unk0 };

        this.location = location;
        if (this.onLocationChange) this.onLocationChange(location);
    }

    protected hideHelp() {
        if (this.help) this.help.remove();
        this.help = null;
    }

    protected showHelp(anchor: HTMLElement) {
        this.hideHelp();
        const layer = this.layer, canvas = layer.getManager().canvas;
        const width = 184, height = 5 * (canvas.getLineHeight() + 6) + 10;
        const rect = anchor.getBoundingClientRect(), parentRect = this.element.getBoundingClientRect();
        const x = Math.max(0, Math.min(layer.toUI(rect.left), canvas.width - width));
        let y = layer.toUI(rect.top) - height;

        if (y < 0) y = layer.toUI(rect.top) + 32;
        const help = this.help = layer.createWindow(x - layer.toUI(parentRect.left), y - layer.toUI(parentRect.top), width, height, this.element);

        help.classList.add("ndom-opaque", "ndom-tooltip");
        help.setAttribute("role", "tooltip");
        help.style.zIndex = "2147483647";
        help.style.pointerEvents = "none";
        new NCTooltip().getTextures().forEach((texture, index) => {
            const col = index % 3, row = Math.trunc(index / 3);

            layer.tile(help, [0, 8, width - 8][col], [0, 8, height - 8][row], [8, width - 16, 8][col], [8, height - 16, 8][row], 0, 0, 8, 8, texture);
        });
        for (let index = 0; index < 5; index++) {
            const texture = TEX_PATH + `QuestWndInfoIcon_${index + 1}`, image = canvas.getTexture(texture);
            const y = 5 + index * (canvas.getLineHeight() + 6);

            layer.tile(help, 5, y, image.width, image.height, 0, 0, image.width, image.height, texture);
            layer.text(help, this.strings.sysStrings[861 + index], 0xffdcdcdc, undefined, image.width + 10, y);
        }
    }
}

export default NCQuestWnd;
