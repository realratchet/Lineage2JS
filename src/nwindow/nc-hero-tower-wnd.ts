import NCFrameCtrl from "./nc-frame-ctrl";
import NCListCtrl, { type ListRow_T, type ListColumn_T } from "./nc-list-ctrl";
import type NDomLayer from "./ndom";
import type { NDomEdit_T, NDomButton_T } from "./ndom";
import type { HeroEntry_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.HeroTower.herotower1_back";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_normal";
const TEX_DOWN = "L2UI_CH3.Button.Btn1_normalOn";

class HeroListCtrl extends NCListCtrl {
    public getCrest: (crestId: number, isAlly: boolean) => CanvasImageSource = null;
    protected entries: HeroEntry_T[] = [];
    protected arrCrests: { clan: CanvasImageSource, ally: CanvasImageSource }[] = [];

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        super(layer, parent, 7, 34, 586, 255, [{ width: 169, label: 393, numeric: false }, { width: 120, label: 391, numeric: false }, { width: 128, label: 604, numeric: false }, { width: 119, label: 605, numeric: false }, { width: 50, label: 1191, numeric: false }], 18, 13);
    }

    public setEntries(entries: HeroEntry_T[]) {
        this.entries = entries.slice(0, 1000);
        const manager = this.layer.getManager();

        this.arrCrests = this.entries.map(entry => ({ clan: this.getCrest ? this.getCrest(entry.clanCrestId, false) : null, ally: this.getCrest ? this.getCrest(entry.allyCrestId, true) : null }));
        this.setRows(this.entries.map((entry, index) => ({ id: index, cells: [entry.name, manager.getSysString((entry.classId < 88 ? 247 : 1071) + entry.classId), entry.clanName, entry.allyName, String(entry.count | 0)] })), true);
    }
    public getEntry(row: ListRow_T) { return row ? this.entries[Number(row.id)] : null; }
    public refreshCrests() { this.paintRows(); }

    protected paintCell(cell: HTMLElement, row: ListRow_T, cellIndex: number, column: ListColumn_T) {
        if (cellIndex !== 2) { super.paintCell(cell, row, cellIndex, column); return; }

        const { ally, clan } = this.arrCrests[Number(row.id)];
        let x = 10;

        for (const [image, width] of [[ally, 8], [clan, 16]] as [CanvasImageSource, number][]) {
            if (!image) continue;

            const canvas = document.createElement("canvas");

            canvas.width = width;
            canvas.height = 12;
            this.layer.place(canvas, x, 1, width, 12);
            canvas.style.pointerEvents = "none";
            canvas.getContext("2d").drawImage(image, 0, 4, width, 12, 0, 0, width, 12);
            cell.append(canvas);
            x += width;
        }
        this.layer.text(cell, row.cells[cellIndex], 0xffdcdcdc, undefined, x, 1);
    }
}

export class NCHeroTowerWnd {
    public static getTextures() { return [...NCFrameCtrl.getTextures(), ...NCListCtrl.getTextures(), TEX_BACK, TEX_BUTTON, TEX_DOWN, "L2UI_CH3.Etc.inputbox1", "L2UI_CH3.Etc.inputbox2", "L2UI_CH3.Etc.inputbox3"]; }
    public readonly element: HTMLDivElement;
    public readonly words: NDomEdit_T;
    public onWriteWords: (words: string) => void = null;
    public onDiary: (classId: number) => void = null;
    protected readonly list: HeroListCtrl;
    protected readonly submitButton: NDomButton_T;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement = layer.root) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 600, 326, parent);
        this.element.hidden = true;
        this.element.dataset.window = "heroTower";
        this.element.setAttribute("aria-label", manager.getSysString(1222));
        layer.tile(this.element, 0, 20, 600, 306, 0, 0, 600, 306, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 600, manager.getSysString(1222), false, () => this.setVisible(false));
        this.list = new HeroListCtrl(layer, this.element);
        this.list.onDoubleClick = () => this.openDiary();
        this.words = layer.edit(this.element, 25, 300, 405, 16, false, 64);
        this.submitButton = layer.button(this.element, 440, 297, 76, 23, TEX_BUTTON, TEX_DOWN, null, manager.getSysString(1192), () => this.submit());
        layer.button(this.element, 518, 297, 76, 23, TEX_BUTTON, TEX_DOWN, null, manager.getSysString(1193), () => this.openDiary());
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 300), Math.trunc(height * 0.5 - 163)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }
    public setCrestGetter(getter: (crestId: number, isAlly: boolean) => CanvasImageSource) { this.list.getCrest = getter; }
    public refreshCrests() { this.list.refreshCrests(); }
    public getList() { return this.list; }
    public getSelectedClassId() { const entry = this.list.getEntry(this.list.getSelectedRow()); return entry ? entry.classId : null; }
    public show(entries: HeroEntry_T[], isHero?: boolean) {
        this.list.setEntries(entries);
        this.setVisible(true);
        this.layer.activate(this.element);
        if (isHero !== undefined) { this.words.hidden = this.submitButton.hidden = !isHero; }
    }
    public submit() {
        const words = this.layer.getManager().filterText(this.words.getValue());

        if (this.onWriteWords) this.onWriteWords(words);
        this.words.setValue("");
    }
    public openDiary() {
        const classId = this.getSelectedClassId();

        if (classId !== null && this.onDiary) this.onDiary(classId);
    }
}

export default NCHeroTowerWnd;
