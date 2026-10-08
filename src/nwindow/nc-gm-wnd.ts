import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";
import type { NDomButton_T, NDomEdit_T } from "./ndom";

const TEX_BACK = "l2ui_ch3.siegewnd.siege_back31";
const TEX_BUTTON = "sek.cbui91";
const TEX_DOWN = "sek.cbui93";
const arrButtons = [[0xf0f00d, 10, 75, 899], [0xf0f03d, 74, 75, 900], [0xf0f00e, 138, 75, 688], [0xf0f007, 10, 96, 433], [0xf0f006, 74, 96, 138], [0xf0f008, 138, 96, 119], [0xf0f00a, 10, 117, 118], [0xf0f05d, 74, 117, 901], [0xf0f00c, 138, 117, 131], [0xf0f00b, 10, 138, 439], [0xf0f03f, 74, 138, 902], [0xf0f03e, 138, 138, 903], [0xf0f01c, 10, 159, 690], [0xf0f02c, 74, 159, 691], [0xf0f03c, 138, 159, 692], [0xf0f016, 10, 180, 1274], [0xf0f123, 74, 180, 1275]];

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
    protected playerName = "";

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement = layer.root) {
        this.element = layer.createWindow(0, 0, 256, 276, parent);
        this.element.hidden = true;
        this.element.dataset.window = "gm";
        layer.tile(this.element, 0, 20, 256, 256, 0, 0, 256, 256, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, "", false, () => this.setVisible(false));
        layer.text(this.element, layer.getManager().getSysString(50), 0xffdcdcdc, undefined, 7, 55);
        this.target = layer.edit(this.element, 35, 55, 112, 14, false, 128);
        Array.from(this.target.children).slice(0, 3).forEach(child => child.remove());
        const background = layer.tile(this.target, 0, 0, 112, 14, 0, 0, 32, 32, "NWindow.ChatBack");

        this.target.prepend(background);
        this.target.input.setAttribute("aria-label", layer.getManager().getSysString(50));
        for (const [id, x, y, text] of arrButtons) {
            const button = layer.button(this.element, x, y, 54, 18, TEX_BUTTON, TEX_DOWN, TEX_BUTTON, layer.getManager().getSysString(text), () => this.press(id));

            button.dataset.controlId = String(id);
            this.buttons.set(id, button);
        }
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 257, height - 327); }
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
        const views = [0xf0f007, 0xf0f00b, 0xf0f008, 0xf0f00a, 0xf0f006, 0xf0f00c];
        const index = views.indexOf(id);

        if (index >= 0) {
            if (!target) { if (this.onMessage) this.onMessage(364); return; }

            if (this.onView) this.onView(target, index + 1);
            return;
        }
        if (id === 0xf0f03d) { this.command("instant_move"); return; }
        if (id === 0xf0f123) {
            const number = target.match(/^\s*([+-]?\d+)/);

            if (this.onServerTransfer) this.onServerTransfer(number ? Number(number[1]) | 0 : 0);
            return;
        }
        if (!target) return;

        switch (id) {
            case 0xf0f00d: this.command(`teleportto ${target}`); break;
            case 0xf0f05d: this.command(`debug ${target}`); break;
            case 0xf0f03f: this.command(`add_peti_chat ${target}`); break;
            case 0xf0f016: this.command(`force_peti ${target} ${this.playerName}`); break;
            case 0xf0f00e: case 0xf0f03e:
                if (this.onConfirm) this.onConfirm(id === 0xf0f00e ? 1220 : 1221, target, isOk => {
                    if (isOk) this.command(`${id === 0xf0f00e ? "recall" : "sendhome"} ${target}`);
                });
                break;
            case 0xf0f01c: case 0xf0f02c: case 0xf0f03c: this.lookup(id, target); break;
            default: throw new Error(`Unknown GM control ${id}.`);
        }
    }
    protected command(command: string) { if (this.onCommand) this.onCommand(command); }
    protected lookup(id: number, target: string) {
        const strings = this.layer.getManager().strings;
        const name = target.toLowerCase();
        let rows: [number, string][];

        if (id === 0xf0f01c) rows = Object.keys(strings.npcNames).map(key => [Number(key) + 1000000, strings.npcNames[key]]);
        else if (id === 0xf0f02c) {
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
