import type NDomLayer from "./ndom";
import { NDOM_SCROLL_TEXTURES, type NDomScrollPane_T } from "./ndom";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";

const TEX_LIST = "L2UI_CH3.ListCtrl.";
const arrClassGroups = [[2, 3, 8, 23, 36, 46, 48, 55, 57], [9, 24, 37], [5, 6, 20, 33], [21, 34], [12, 13, 27, 40], [16, 17, 30, 43, 52, 51], [14, 28, 41], [0, 1, 4, 7, 18, 19, 22, 31, 32, 35, 44, 45, 47, 53, 54, 56], [49, 50, 38, 39, 42, 25, 26, 29, 10, 11, 15], [88, 89, 93, 101, 108, 113, 114, 117, 118], [92, 102, 109], [90, 91, 99, 106], [100, 107], [94, 95, 103, 110], [97, 98, 105, 112, 116, 115], [96, 104, 111]];
const arrClassIcons = ["1", "2", "3", "4", "5", "6", "7", "1_1", "1_2", "1_3", "2_3", "3_3", "4_3", "5_3", "6_3", "7_3"].map(name => `L2UI_CH3.PartyWnd.party_styleicon${name}`);
const arrTooltipTextures = Array.from({ length: 9 }, (_, index) => `L2UI_CH3.Tooltip.Tooltip${index + 1}`);

export type ListColumn_T = { width: number, label: number, numeric: boolean, isClass?: boolean };
export type ListRow_T = { id: number | string, cells: string[], classId?: number };

export function getClassIcon(classId: number) {
    const group = arrClassGroups.findIndex(group => group.includes(classId));

    return arrClassIcons[group < 0 ? 0 : group];
}

export function paintListColumn(layer: NDomLayer, parent: HTMLElement, width: number, text: string, state: string) {
    parent.replaceChildren();
    for (let part = 0; part < 3; part++) {
        const normal = TEX_LIST + `tab${part + 1}`;
        const texture = state === "_over" && !layer.hasTexture(normal + state) ? normal : normal + state;

        layer.tile(parent, part === 0 ? 0 : part === 1 ? 8 : width - 8, 0, part === 1 ? width - 16 : 8, 19, 0, 0, 8, 19, texture);
    }
    const canvas = layer.getManager().canvas;

    layer.text(parent, text, 0xffe6dcbe, undefined, Math.trunc(width * 0.5 - Math.trunc(layer.measureText(text) / 2)), Math.trunc(19 * 0.5 - Math.trunc(canvas.getLineHeight() / 2)) + 1);
}

export function paintListSelection(layer: NDomLayer, parent: HTMLElement, width: number, y: number) {
    layer.tile(parent, 1, y - 1, width - 49, 17, 0, 0, 16, 13, TEX_LIST + "TextSelect");
    layer.tile(parent, width - 48, y - 1, 32, 17, 0, 0, 32, 13, TEX_LIST + "TextSelect2");
}

export function createClassTooltip(layer: NDomLayer, classId: number, x: number, anchorY: number) {
    const canvas = layer.getManager().canvas, root = layer.root.getBoundingClientRect();
    const width = 184, height = canvas.getLineHeight() + 16;
    const y = anchorY - height < 0 ? anchorY + 32 : anchorY - height;
    const tooltip = layer.createWindow(Math.max(0, Math.min(x, canvas.width - width)) - layer.toUI(root.left), y - layer.toUI(root.top), width, height, layer.root);
    const strings = layer.getManager().strings.sysStrings, label = strings[391], value = strings[(classId < 88 ? 247 : 1071) + classId];

    tooltip.classList.add("ndom-opaque", "ndom-tooltip");
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-label", `${label} : ${value}`);
    tooltip.style.zIndex = "2147483647";
    tooltip.style.pointerEvents = "none";
    tooltip.style.overflow = "hidden";
    arrTooltipTextures.forEach((texture, index) => layer.tile(tooltip, [0, 8, width - 8][index % 3], [0, 8, height - 8][Math.floor(index / 3)], index % 3 === 1 ? width - 16 : 8, Math.floor(index / 3) === 1 ? height - 16 : 8, 0, 0, 8, 8, texture));
    layer.text(tooltip, label, 0xffa3a3a3, undefined, 5, 11);
    layer.text(tooltip, " : ", 0xffdcdcdc, undefined, 5 + layer.measureText(label), 11);
    layer.text(tooltip, value, 0xffb09b79, undefined, 5 + layer.measureText(label) + layer.measureText(" : "), 11);
    return tooltip;
}

export class NCListCtrl {
    public static getTextures() { return ["TextSelect", "TextSelect2", "tab1", "tab2", "tab3", "tab1_down", "tab2_down", "tab3_down"].map(name => TEX_LIST + name).concat([1, 2, 3].map(index => "?" + TEX_LIST + `tab${index}_over`), ["L2UI_CH3.Etc.textbackline"], arrClassIcons, NDOM_SCROLL_TEXTURES, arrTooltipTextures); }
    public readonly element: HTMLDivElement;
    public onDoubleClick: (row: ListRow_T) => void = null;
    public onSelection: (row: ListRow_T) => void = null;
    protected readonly list: NDomScrollPane_T;
    protected readonly headers: HTMLDivElement[] = [];
    protected strings: GameStrings_T;
    protected rows: ListRow_T[] = [];
    protected selectedIndex = -1;
    protected hoverIndex = -1;
    protected ascending: boolean[];
    protected tooltip: HTMLDivElement = null;
    protected tooltipRow: ListRow_T = null;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement, x: number, y: number, protected readonly width: number, protected readonly height: number, protected readonly columns: ListColumn_T[]) {
        this.strings = layer.getManager().strings;
        this.ascending = columns.map(() => true);
        this.element = layer.createWindow(x, y, width, height, parent);
        this.list = layer.scrollPane(this.element, 0, 19, width, height - 19, 17);
        this.list.content.style.width = `${width}px`;
        this.list.setAttribute("role", "listbox");
        const setScroll = this.list.setScroll;

        this.list.setScroll = (position, isClamped = true) => {
            setScroll(position, isClamped);
            this.list.content.style.top = "0px";
            this.paintRows();
        };
        this.list.content.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            this.selectedIndex = this.hoverIndex = this.hitRow(event.clientY);
            this.paintRows();
            const row = this.getSelectedRow();

            if (this.onSelection) this.onSelection(row);
            if (event.detail === 2 && row && this.onDoubleClick) this.onDoubleClick(row);
        });
        this.list.content.addEventListener("mousemove", event => { this.hoverIndex = this.hitRow(event.clientY); this.showTooltip(); });
        this.list.content.addEventListener("mouseleave", () => { this.hoverIndex = -1; this.hideTooltip(); });
        this.list.content.addEventListener("contextmenu", event => event.preventDefault());
        let columnX = 0;

        columns.forEach((column, index) => {
            const header = layer.button(this.element, columnX, 0, column.width, 19, null, null, null, null, () => this.sort(index));
            const face = layer.createWindow(0, 0, column.width, 19, header);
            let isDown = false, isHover = false;
            const paint = () => paintListColumn(layer, face, column.width, this.strings.sysStrings[column.label], isDown && isHover ? "_down" : isHover ? "_over" : "");

            face.style.pointerEvents = "none";
            header.dataset.listColumn = String(index);
            header.setAttribute("aria-label", this.strings.sysStrings[column.label]);
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
            columnX += column.width;
        });
        this.paintRows();
    }

    public getSelectedRow() { return this.rows[this.selectedIndex] || null; }
    public getRows() { return this.rows; }
    public getScroll() { return this.list.getScroll(); }
    public setScroll(position: number) { this.list.setScroll(position); }
    public hideTooltip() {
        if (this.tooltip) this.tooltip.remove();
        this.tooltip = null;
        this.tooltipRow = null;
    }

    public setStrings(strings: GameStrings_T) {
        this.strings = strings;
        this.headers.forEach((header, index) => paintListColumn(this.layer, header, this.columns[index].width, strings.sysStrings[this.columns[index].label], ""));
        this.paintRows();
    }

    public clear() { this.setRows([], true); }
    public setRows(rows: ListRow_T[], isReset = false) {
        this.rows = rows;
        if (isReset) { this.selectedIndex = this.hoverIndex = -1; this.list.setScroll(0); }
        this.list.setContentHeight(rows.length * 17);
        this.list.content.style.top = "0px";
        this.paintRows();
    }

    protected hitRow(clientY: number) {
        const y = this.layer.toUI(clientY - this.list.getBoundingClientRect().top);
        const index = Math.floor(y / 17) + this.list.getScroll() / 17;

        return y >= 0 && y < this.height - 19 && index < this.rows.length ? index : -1;
    }

    protected sort(column: number) {
        const selected = this.getSelectedRow(), direction = this.ascending[column] ? 1 : -1;

        this.rows.sort((a, b) => {
            if (this.columns[column].numeric) return ((parseInt(a.cells[column], 10) || 0) - (parseInt(b.cells[column], 10) || 0)) * direction;

            const left = a.cells[column].replace(/[A-Z]/g, value => value.toLowerCase()), right = b.cells[column].replace(/[A-Z]/g, value => value.toLowerCase());

            return (left < right ? -1 : left > right ? 1 : 0) * direction;
        });
        this.ascending[column] = !this.ascending[column];
        if (selected) this.selectedIndex = this.rows.indexOf(selected);
        this.paintRows();
    }

    protected paintRows() {
        const parent = this.list.content, layer = this.layer, first = this.list.getScroll() / 17, visibleRows = Math.ceil((this.height - 19) / 17);

        this.hideTooltip();
        parent.replaceChildren();
        parent.style.height = `${this.height - 19}px`;
        for (let visible = 1; visible <= visibleRows; visible += 2) layer.tile(parent, 0, visible * 17 - 1, this.width, 17, 0, 0, 8, 15, "L2UI_CH3.Etc.textbackline");
        for (let visible = 0; visible < visibleRows; visible++) {
            const index = first + visible, row = this.rows[index];

            if (!row) break;
            if (index === this.selectedIndex) paintListSelection(layer, parent, this.width, visible * 17);
            let x = 0;

            this.columns.forEach((column, cellIndex) => {
                const cell = layer.createWindow(x, visible * 17 + 2, column.width, 15, parent);

                cell.style.overflow = "hidden";
                cell.dataset.listRow = String(row.id);
                cell.dataset.listCell = String(cellIndex);
                if (column.isClass) layer.tile(cell, Math.trunc(column.width / 2) - 5, 1, 11, 11, 0, 0, 11, 11, getClassIcon(row.classId));
                else layer.text(cell, row.cells[cellIndex], 0xffdcdcdc, undefined, 10, 1);
                x += column.width;
            });
        }
        this.showTooltip();
    }

    protected showTooltip() {
        const row = this.rows[this.hoverIndex];

        if (this.hoverIndex !== this.selectedIndex || !row || row.classId === undefined || this.element.closest("[hidden]")) { this.hideTooltip(); return; }
        if (this.tooltipRow === row) return;

        this.hideTooltip();
        const rect = this.list.getBoundingClientRect();

        this.tooltipRow = row;
        this.tooltip = createClassTooltip(this.layer, row.classId, this.layer.toUI(rect.left), this.layer.toUI(rect.top) + (this.hoverIndex - this.list.getScroll() / 17) * 17 + 3);
    }
}

export default NCListCtrl;
