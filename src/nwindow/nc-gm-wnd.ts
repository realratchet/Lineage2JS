import NCFrameCtrl from "./nc-frame-ctrl";
import type { default as NDomLayer, NDomButton_T, NDomEdit_T } from "./ndom";

enum GMControl_T { TeleportTo = 0xf0f00d, InstantMove = 0xf0f03d, Recall = 0xf0f00e, CharacterInfo = 0xf0f007, PledgeInfo = 0xf0f006, QuestInfo = 0xf0f008, InventoryInfo = 0xf0f00a, Debug = 0xf0f05d, WarehouseInfo = 0xf0f00c, SkillInfo = 0xf0f00b, PetitionChat = 0xf0f03f, SendHome = 0xf0f03e, NpcLookup = 0xf0f01c, ItemLookup = 0xf0f02c, SkillLookup = 0xf0f03c, ForcePetition = 0xf0f016, ServerTransfer = 0xf0f123 }

const TEX_BACK = "l2ui_ch3.siegewnd.siege_back31";
const TEX_BUTTON = "sek.cbui91";
const TEX_DOWN = "sek.cbui93";
const arrButtons = [[GMControl_T.TeleportTo, 10, 75, 899], [GMControl_T.InstantMove, 74, 75, 900], [GMControl_T.Recall, 138, 75, 688], [GMControl_T.CharacterInfo, 10, 96, 433], [GMControl_T.PledgeInfo, 74, 96, 138], [GMControl_T.QuestInfo, 138, 96, 119], [GMControl_T.InventoryInfo, 10, 117, 118], [GMControl_T.Debug, 74, 117, 901], [GMControl_T.WarehouseInfo, 138, 117, 131], [GMControl_T.SkillInfo, 10, 138, 439], [GMControl_T.PetitionChat, 74, 138, 902], [GMControl_T.SendHome, 138, 138, 903], [GMControl_T.NpcLookup, 10, 159, 690], [GMControl_T.ItemLookup, 74, 159, 691], [GMControl_T.SkillLookup, 138, 159, 692], [GMControl_T.ForcePetition, 10, 180, 1274], [GMControl_T.ServerTransfer, 74, 180, 1275]];

export class NCGMWnd {
    public static getTextures() { return [...NCFrameCtrl.getTextures(), TEX_BACK, TEX_BUTTON, TEX_DOWN, "NWindow.ChatBack"]; }
    public readonly element: HTMLDivElement;
    public readonly target: NDomEdit_T;
    public onView: (targetName: string, kind: number) => void = null;
    public onCommand: (command: string) => void = null;
    public onConfirm: (systemMessage: number, targetName: string, onReply: (isOk: boolean) => void) => void = null;
    public onInfo: (text: string) => void = null;
    public onServerTransfer: (serverId: number) => void = null;
    public onMessage: (systemMessage: number) => void = null;
    protected readonly buttons = new Map<number, NDomButton_T>();
    protected readonly width: number;
    protected playerName = "";

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement = layer.root) {
        const buttonWidth = Math.max(54, ...arrButtons.map(([, , , text]) => Math.ceil(layer.measureText(layer.getManager().getSysString(text))) + 12));

        this.width = Math.max(256, buttonWidth * 3 + 40);
        this.element = layer.createWindow(0, 0, this.width, 276, parent);
        this.element.hidden = true;
        this.element.dataset.window = "gm";
        layer.tile(this.element, 0, 20, this.width, 256, 0, 0, 256, 256, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, this.width, "", false, () => this.setVisible(false));
        layer.text(this.element, layer.getManager().getSysString(50), 0xffdcdcdc, undefined, 7, 55);
        this.target = layer.edit(this.element, 35, 55, 112, 14, false, 128);
        Array.from(this.target.children).slice(0, 3).forEach(child => child.remove());
        const background = layer.tile(this.target, 0, 0, 112, 14, 0, 0, 32, 32, "NWindow.ChatBack");

        this.target.prepend(background);
        this.target.input.setAttribute("aria-label", layer.getManager().getSysString(50));
        for (const [id, x, y, text] of arrButtons) {
            const button = layer.button(this.element, 10 + (x - 10) / 64 * (buttonWidth + 10), y, buttonWidth, 18, TEX_BUTTON, TEX_DOWN, TEX_BUTTON, layer.getManager().getSysString(text), () => this.press(id), null, 54);

            button.dataset.controlId = String(id);
            this.buttons.set(id, button);
        }
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - this.width - 1, height - 327); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }
    public getButtons() { return this.buttons; }
    public setPlayerName(name: string) { this.playerName = name; }
    public toggle() {
        if (this.isVisible()) { this.setVisible(false); return; }

        this.setVisible(true);
        this.layer.activate(this.element);
        this.target.focus();
    }
    public press(id: number) {
        const target = this.target.getValue();
        const views = [GMControl_T.CharacterInfo, GMControl_T.SkillInfo, GMControl_T.QuestInfo, GMControl_T.InventoryInfo, GMControl_T.PledgeInfo, GMControl_T.WarehouseInfo];
        const index = views.indexOf(id);

        if (index >= 0) {
            if (!target) { if (this.onMessage) this.onMessage(364); return; }

            if (this.onView) this.onView(target, index + 1);
            return;
        }
        if (id === GMControl_T.InstantMove) { this.command("instant_move"); return; }
        if (id === GMControl_T.ServerTransfer) {
            const number = target.match(/^\s*([+-]?\d+)/);

            if (this.onServerTransfer) this.onServerTransfer(number ? Number(number[1]) | 0 : 0);
            return;
        }
        if (!target) return;

        switch (id) {
            case GMControl_T.TeleportTo: this.command(`teleportto ${target}`); break;
            case GMControl_T.Debug: this.command(`debug ${target}`); break;
            case GMControl_T.PetitionChat: this.command(`add_peti_chat ${target}`); break;
            case GMControl_T.ForcePetition: this.command(`force_peti ${target} ${this.playerName}`); break;
            case GMControl_T.Recall: case GMControl_T.SendHome:
                if (this.onConfirm) this.onConfirm(id === GMControl_T.Recall ? 1220 : 1221, target, isOk => {
                    if (isOk) this.command(`${id === GMControl_T.Recall ? "recall" : "sendhome"} ${target}`);
                });
                break;
            case GMControl_T.NpcLookup: case GMControl_T.ItemLookup: case GMControl_T.SkillLookup: this.lookup(id, target); break;
            default: throw new Error(`Unknown GM control ${id}.`);
        }
    }
    protected command(command: string) { if (this.onCommand) this.onCommand(command); }
    protected lookup(id: number, target: string) {
        const strings = this.layer.getManager().strings;
        const name = target.toLowerCase();
        let rows: [number, string][];

        if (id === GMControl_T.NpcLookup) rows = Object.keys(strings.npcNames).map(key => [Number(key) + 1000000, strings.npcNames[key]]);
        else if (id === GMControl_T.ItemLookup) {
            const keys = Object.keys(strings.itemInfos);

            rows = [];
            for (const templateClass of ["etc", "armor", "weapon"])
                for (const key of keys)
                    if (strings.itemInfos[key].templateClass === templateClass && strings.itemNames[key]) rows.push([Number(key), strings.itemNames[key]]);
        } else rows = Object.keys(strings.skillInfos).map(key => [Number(key.split(":")[0]), strings.skillInfos[key].name]);

        for (const [classId, text] of rows) {
            if (text.toLowerCase() !== name) continue;

            if (this.onInfo) this.onInfo(`ClassID:${classId} Name:${text}`);
            return;
        }
    }
}

export default NCGMWnd;
