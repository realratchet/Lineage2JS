import NCFrameCtrl from "./nc-frame-ctrl";
import NCListCtrl, { type ListRow_T } from "./nc-list-ctrl";
import { createQuestHelp } from "./nc-quest-wnd";
import type NDomLayer from "./ndom";
import type { QuestInfo_T } from "../assets/decode-worker/decode-protocol";
import SysString_T from "./sys-string";

const TEX_PATH = "L2UI_CH3.QUESTWND.";

class QuestListCtrl extends NCListCtrl {
    protected paintCell(cell: HTMLElement, row: ListRow_T, index: number) {
        if (index === 3) this.layer.tile(cell, 10, 0, 15, 15, 0, 0, 15, 15, `${TEX_PATH}QuestWndInfoIcon_${Number(row.cells[index]) % 2 + 1}`);
        else this.layer.text(cell, row.cells[index], 0xffdcdcdc, undefined, 10, 1);
    }
}

export class NCQuestListInfoWnd {
    public static getTextures() { return [`${TEX_PATH}questinfo_back`, `${TEX_PATH}QuestWndToolTipBtn`, `${TEX_PATH}QuestWndInfoIcon_1`, `${TEX_PATH}QuestWndInfoIcon_2`, ...NCFrameCtrl.getTextures(), ...NCListCtrl.getTextures(), "L2UI_CH3.button.btn1_normal", "L2UI_CH3.button.btn1_normalon"]; }
    public readonly element: HTMLDivElement;
    public onLocation: (quest: QuestInfo_T) => void = null;
    protected readonly list: NCListCtrl;
    protected help: HTMLDivElement = null;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 600, 326);
        this.element.hidden = true;
        this.element.dataset.window = "quest-list-info";
        layer.tile(this.element, 0, 20, 600, 306, 0, 0, 600, 306, `${TEX_PATH}questinfo_back`);
        NCFrameCtrl.createDOM(layer, this.element, 600, manager.getSysString(SysString_T.QuestIntroduction), false, () => this.setVisible(false));
        this.list = new QuestListCtrl(layer, this.element, 7, 49, 586, 237, [{ width: 212, label: SysString_T.QuestName, numeric: false }, { width: 130, label: SysString_T.Requirements, numeric: false }, { width: 52, label: SysString_T.QuestLevel, numeric: true }, { width: 40, label: SysString_T.Repeat, numeric: true }, { width: 152, label: SysString_T.ContactNPC, numeric: false }], 17, 13);
        const help = layer.createWindow(578, 30, 15, 15, this.element);

        layer.tile(help, 0, 0, 15, 15, 0, 0, 15, 15, `${TEX_PATH}QuestWndToolTipBtn`);
        help.addEventListener("mouseenter", () => { this.hideHelp(); this.help = createQuestHelp(layer, this.element, help, 2); });
        help.addEventListener("mouseleave", () => this.hideHelp());
        layer.button(this.element, 518, 297, 76, 23, "L2UI_CH3.button.btn1_normal", "L2UI_CH3.button.btn1_normalon", "L2UI_CH3.button.btn1_normal", manager.getSysString(SysString_T.QuestLocation), () => {
            const row = this.list.getSelectedRow();
            const quest = row && manager.strings.quests.slice(0, 2000).find(quest => quest.tag !== 0 && quest.id === row.id && quest.progressId === 1);

            if (quest && this.onLocation) this.onLocation(quest);
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 163)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (!visible) { this.list.hide(); this.hideHelp(); }
    }

    public show() {
        const strings = this.layer.getManager().strings;

        this.list.setStrings(strings);
        this.list.setRows(strings.quests.slice(0, 2000).filter(quest => quest.tag !== 0 && quest.progressId === 1).map(quest => ({ id: quest.id, cells: [quest.title, quest.raceRestriction, quest.minLevel > 0 ? quest.maxLevel > 0 ? `${quest.minLevel}~${quest.maxLevel}` : `${quest.minLevel} ${strings.sysStrings[SysString_T.Abnormal]}` : strings.sysStrings[SysString_T.NoLimitExists], String(quest.classification), strings.npcNames[quest.unk3]], tooltip: { title: quest.shortDescription, lines: [], description: "" } })), true);
        this.setVisible(true);
    }

    protected hideHelp() {
        if (this.help) this.help.remove();
        this.help = null;
    }
}

export default NCQuestListInfoWnd;
