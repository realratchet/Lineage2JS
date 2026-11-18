import { type default as NDomLayer, NDOM_EDIT_TEXTURES, type NDomEdit_T, type NDomScrollPane_T } from "./ndom";
import { SKIN_SLOTS } from "./skin-textures";

type SearchPane_T = { pane: NDomScrollPane_T, x: number, y: number, height: number, order: number[] };

function normalizeName(name: string) { return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }

function wordScore(query: string, word: string) {
    if (word === query) return 1;
    if (word.startsWith(query)) return 0.95;
    if (word.includes(query)) return 0.9;
    if (query.length < 3) return 0;

    const arrRows: number[][] = [Array.from({ length: word.length + 1 }, (_, i) => i)];

    for (let i = 1; i <= query.length; i++) {
        const row = [i], previous = arrRows[i - 1];

        for (let j = 1; j <= word.length; j++) {
            row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(query[i - 1] !== word[j - 1]));
            if (i > 1 && j > 1 && query[i - 1] === word[j - 2] && query[i - 2] === word[j - 1]) row[j] = Math.min(row[j], arrRows[i - 2][j - 2] + 1);
        }
        arrRows.push(row);
    }

    return 0.9 * (1 - arrRows[query.length][word.length] / Math.max(query.length, word.length));
}

function matchScore(query: string, name: string) {
    if (name === query) return 1;
    if (name.startsWith(query)) return 0.98;
    if (name.includes(query)) return 0.96;

    const arrQuery = query.split(" "), arrWords = name.split(" ");

    return 0.9 * arrQuery.reduce((score, part) => score + Math.max(...arrWords.map(word => wordScore(part, word))), 0) / arrQuery.length;
}

export class NCItemSearch {
    public static getTextures() { return [...NDOM_EDIT_TEXTURES, SKIN_SLOTS.frameClose, SKIN_SLOTS.frameCloseDown]; }
    public readonly element: HTMLDivElement;
    protected readonly edit: NDomEdit_T;
    protected readonly arrPanes: SearchPane_T[];
    protected query = "";
    protected timer: number = null;

    public constructor(protected readonly layer: NDomLayer, protected readonly owner: HTMLElement, panes: NDomScrollPane_T[], protected readonly onChange: () => void) {
        this.arrPanes = panes.map<SearchPane_T>(pane => ({ pane, x: parseFloat(pane.style.left), y: parseFloat(pane.style.top), height: parseFloat(pane.style.height), order: [] }));
        const first = this.arrPanes[0], width = parseFloat(first.pane.style.width);

        this.element = layer.createWindow(first.x, first.y, width, 29, owner);
        this.element.classList.add("ndom-item-search");
        this.element.hidden = true;
        this.element.setAttribute("role", "search");
        this.edit = layer.edit(this.element, 4, 5, width - 28, 17, false, 100);
        this.edit.input.setAttribute("aria-label", "Search by name");
        this.edit.input.placeholder = "Search by name";
        const close = layer.button(this.element, width - 20, 6, 15, 15, SKIN_SLOTS.frameClose, SKIN_SLOTS.frameCloseDown, null, null, () => this.close());

        close.setAttribute("aria-label", "Close search");
        this.edit.input.addEventListener("input", event => {
            if ((event as InputEvent).isComposing) return;

            window.clearTimeout(this.timer);
            this.timer = window.setTimeout(() => {
                this.query = normalizeName(this.edit.getValue());
                this.arrPanes.forEach(({ pane }) => pane.setScroll(0));
                this.onChange();
                this.refresh();
            }, 100);
        });
        this.element.addEventListener("keydown", event => {
            event.stopPropagation();
            if (event.key !== "Escape") return;

            event.preventDefault();
            this.close();
        });
        window.addEventListener("keydown", event => {
            if (!event.ctrlKey || event.altKey || event.metaKey || event.code !== "KeyF" || !owner.getClientRects().length) return;

            const active = layer.getActiveWindow(), focused = document.activeElement;

            if (!active || !active.contains(owner)) return;
            if (focused.matches("input, textarea") && !owner.contains(focused)) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            this.open();
        }, true);
    }

    public isOpen() { return !this.element.hidden; }
    public getIndex(pane: number, index: number) { return this.arrPanes[pane].order[index] ?? index; }

    public open() {
        if (!this.isOpen()) {
            this.element.hidden = false;
            this.arrPanes.forEach(({ pane, x, y, height }) => {
                this.layer.place(pane, x, y + 35);
                pane.setHeight(height - 35);
                pane.setScroll(0);
            });
            this.onChange();
            this.refresh();
        }
        this.edit.focus();
        this.edit.input.select();
    }

    public close(focus = true) {
        if (!this.isOpen()) return;

        window.clearTimeout(this.timer);
        this.query = "";
        this.edit.setValue("");
        this.element.hidden = true;
        this.arrPanes.forEach(({ pane, x, y, height }) => {
            this.layer.place(pane, x, y);
            pane.setHeight(height);
            pane.setScroll(0);
        });
        this.onChange();
        this.refresh();
        if (focus) this.arrPanes.find(({ pane }) => !pane.hidden)!.pane.focus();
    }

    public refresh() {
        this.arrPanes.forEach(entry => {
            const arrItems = (Array.from(entry.pane.content.children) as HTMLElement[]).map((element, index) => ({ element, index, score: this.query ? matchScore(this.query, normalizeName(element.dataset.searchName || element.getAttribute("aria-label"))) : 1 }));

            if (this.query) arrItems.sort((a, b) => b.score - a.score || a.index - b.index);
            entry.order = arrItems.map(item => item.index);
            arrItems.forEach(({ element, score }, index) => {
                element.style.left = `${index % 6 * 37}px`;
                element.style.top = `${Math.trunc(index / 6) * 35}px`;
                element.classList.toggle("ndom-search-miss", !!this.query && score < 0.6);
            });
        });
    }
}

export default NCItemSearch;
