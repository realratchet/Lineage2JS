import NDomLayer, { NDOM_EDIT_TEXTURES } from "./ndom";
import CHtmlMultiEdit from "./c-html-multi-edit";
import { FontType_T } from "./nwindow-canvas";
import { SKIN_SLOTS } from "./skin-textures";

const TEXT_COLOR = 0xffdcdcdc;
const LINK_COLOR = 0xff6699ff;
const LEVEL_COLOR = 0xffffcc00;
const LINE_SPACING = 6;
const BR_HEIGHT = 9;
const SCROLLBAR_RESERVE = 16;
const REPEAT_PERIOD = 100;
const MIN_THUMB = 15;
const TEX_UP = SKIN_SLOTS.scrollUp;
const TEX_UP_ON = SKIN_SLOTS.scrollUpDown;
const TEX_DOWN = SKIN_SLOTS.scrollDown;
const TEX_DOWN_ON = SKIN_SLOTS.scrollDownDown;
const TEX_THUMB_TOP = SKIN_SLOTS.scrollThumbTop;
const TEX_THUMB_CENTER = SKIN_SLOTS.scrollThumbCenter;
const TEX_THUMB_BOTTOM = SKIN_SLOTS.scrollThumbBottom;
const DEFAULT_FORE = "NWindow.BlackTexture";
const DEFAULT_BACK = "NWindow.WhiteTexture";
const TEXT_ENTITIES = [["&nbsp;", " "], ["&apos;", "'"], ["&quot;", "\""], ["&amp;", "&"], ["&lt;", "<"], ["&gt;", "> "], ["&#160;", " "]]; // 0x100449e0, table 0x102369e4.

const TAG_TABLE: [string, string[]][] = [ // Tag table 0x10234020, attribute lists verbatim (misspellings and unsorted lists included, both are binary-searched).
    ["A", ["ACTION", "CMD", "HREF", "LINK", "MSG"]], ["ADDRESS", []], ["B", []], ["BAR", ["ALIGN", "DISABLED", "HEIGHT", "MAX", "MIN", "NAME", "TOOLTIP", "VALUE", "WIDTH"]],
    ["BODY", ["DEFFIXEDFONT", "DEFFON"]], ["BR", []], ["BR1", []], ["BUTTON", ["ACTION", "BACK", "FORE", "HEIGHT", "VALUE", "WIDTH"]],
    ["CENTER", []], ["COMBOBOX", ["LIST", "SEL", "VAR", "WIDTH"]], ["COMMENT", []], ["EDIT", ["ACTION", "HEIGHT", "LENGTH", "TYPE", "VAR", "WIDTH"]],
    ["EXTEND", []], ["FONT", ["COLOR", "FACE", "SIZE", "FG", "B"]], ["H1", []], ["H2", []], ["H3", []], ["H4", []], ["H5", []], ["H6", []], ["H7", []], ["HEAD", []],
    ["HTML", ["HEIGHT", "IMGSRC", "NOSCROLLBAR", "QUERYDELAY", "TEXTANI", "WIDTH", "X", "Y"]], ["I", []], ["IMG", ["HEIGHT", "SRC", "TOOLTIP", "WIDTH"]],
    ["INPUT", ["CHECKED,", "DISABLED", "HEIGHT", "MAX", "MAXLENGTH", "MIN", "NAME", "SIZE", "TOOLTIP", "TYPE", "VALUE", "WIDTH"]], ["LEFT", []], ["LI", []],
    ["MULTIEDIT", ["HEIGHT", "VAR", "WIDTH"]], ["OL", ["TYP"]], ["OPTION", ["SELECTED", "TOOLTIP", "VALUE"]], ["P", ["ALIGN"]], ["PRE", []], ["RIGHT", []],
    ["SELECT", ["DISABLED", "HEIGHT", "MULTIPLE", "NAME", "SIZE", "TOOLTIP", "WIDTH"]], ["SPIN", ["NAME", "MAX", "MIN", "READONLY", "SIZE", "TOOLTIP", "VALU"]],
    ["STRIKE", []], ["SUB", []], ["SUP", []],
    ["TABLE", ["ALIGN,", "BACKGROUND", "BGCOLOR", "BORDER", "BORDERCOLOR", "BORDERCOLORDARK", "BORDERCOLORLIGHT", "CELLPADDING", "CELLSPACING", "HEIGHT", "WIDTH"]],
    ["TD", ["ALIGN", "BACKGROUND", "BGCOLOR", "BORDER", "FIXWIDTH", "HEIGHT", "VALIGN", "WIDTH"]], ["TEXTAREA", ["ALIGN", "DISABLED", "NAME", "ROWS", "TOOLTIP"]],
    ["TEXTCODE", []], ["TITLE", []], ["TR", []], ["TT", []], ["U", []], ["UL", ["TYPE"]], ["UNKNOWN", []], ["VAR", []],
    ["VOLUMN", ["DISABLED", "NAME", "MIN", "MAX", "READONL", "SIZE", "TOOLTIP", "VALUE"]]
];

const ALIGN_CSS = ["left", "center", "left", "right"]; // Alignment stack values (0x10041591, TD 0x1003dde0): CENTER=1, LEFT=2, RIGHT=3.
const VALIGN_CSS = ["top", "middle", "top", "bottom"];

type HtmlSegment_T = { text: string, color: number };
type HtmlWord_T = { element: HTMLSpanElement, segments: HtmlSegment_T[], space: Text, last: HTMLDivElement, advance: number };
type HtmlToken_T = { tag: string, isOpen: boolean, attrs: Record<string, string>, segments: HtmlSegment_T[] };
type HtmlBlock_T = { element: HTMLElement, paragraph: HTMLDivElement, paragraphAlign: number, width: number, minimumWidth: number, tables: HtmlTable_T[] };
type HtmlCell_T = { element: HTMLTableCellElement, block: HtmlBlock_T, fixedWidth: number };
type HtmlTable_T = { table: HTMLTableElement, frame: SVGSVGElement, row: HTMLTableRowElement, cell: HTMLTableCellElement, border: number, padding: number, spacing: number, width: number, height: number, isPercentage: boolean, rows: HtmlCell_T[][], columns: number[], naturalWidth: number, minimumWidth: number };
type HtmlLink_T = { target: string, isUnderlined: boolean };
type HtmlVariable_T = { name: string, isMultiline: boolean, edit: { getValue(): string, setValue(value: string): void } };

function measureHtmlTable(table: HtmlTable_T) { // NWindow 0x1003e2e2..0x1003e477.
    const minimums: number[] = [];

    for (const row of table.rows) for (let i = 0; i < row.length; i++) {
        const cell = row[i], block = cell.block;

        for (const nested of block.tables) {
            measureHtmlTable(nested);
            block.width = Math.max(block.width, nested.naturalWidth);
            block.minimumWidth = Math.max(block.minimumWidth, nested.minimumWidth);
        }
        const width = cell.fixedWidth > 0 ? cell.fixedWidth : block.width;

        if (i === table.columns.length) {
            table.columns.push(width - 2 * table.padding);
            minimums.push(block.minimumWidth - 2 * table.padding);
        } else {
            table.columns[i] = Math.max(table.columns[i], width);
            minimums[i] = Math.max(minimums[i], block.minimumWidth);
        }
    }
    table.naturalWidth = table.columns.reduce((total, width) => total + width + 2 * (table.padding + table.border) + table.spacing, table.spacing + 2 * table.border);
    table.minimumWidth = minimums.reduce((total, width) => total + width, table.spacing + 2 * table.border);
}

function layoutHtmlTable(table: HtmlTable_T, availableWidth: number) { // NWindow 0x1003ce00 / 0x1003be40.
    let width = table.isPercentage ? Math.trunc(table.width * availableWidth / 100) : table.width;

    if (table.naturalWidth >= availableWidth && width === 0) width = availableWidth;

    const columns = table.columns.map(value => availableWidth > table.naturalWidth && width === 0 ? value : Math.trunc(table.naturalWidth > 0 ? value * width / table.naturalWidth : value * width));
    const sizes = columns.map(() => 0), inset = 2 * (table.padding + table.border);
    let outerWidth = 0;

    table.rows.forEach(row => {
        let rowWidth = table.spacing + 2 * table.border;

        row.forEach((cell, i) => {
            const allocated = Math.max(cell.block.minimumWidth, columns[i]);
            let cellWidth = allocated;

            for (const nested of cell.block.tables)
                cellWidth = Math.max(cellWidth, layoutHtmlTable(nested, allocated));

            sizes[i] = Math.max(sizes[i], cellWidth);
            rowWidth += cellWidth + inset + table.spacing;
        });
        outerWidth = Math.max(outerWidth, rowWidth);
    });
    table.table.style.width = `${outerWidth}px`;
    const edge = `${table.border + table.spacing}px`;

    table.table.style.gridTemplateColumns = sizes.length > 0 ? [edge, ...sizes.map((value, i) => `${value + inset + (i + 1 < sizes.length ? table.spacing : 0)}px`), edge].join(" ") : "none";
    table.table.style.gridTemplateRows = table.rows.map(row => row.length > 0 ? "auto" : `${inset}px`).join(" ");
    table.table.style.paddingTop = `${table.border + table.spacing}px`;
    table.table.style.paddingBottom = `${table.border + (table.rows.length > 0 ? table.spacing : 0)}px`;
    table.rows.forEach((row, y) => row.forEach((cell, x) => {
        cell.element.style.gridRow = `${y + 1}`;
        cell.element.style.gridColumn = `${x + 2}`;
        cell.element.style.width = `${sizes[x]}px`;
    }));

    return outerWidth;
}

function layoutHtmlTableHeight(table: HtmlTable_T) { // NWindow 0x1003d098..0x1003d1ef.
    table.table.style.height = "auto";
    table.table.style.gridTemplateRows = table.rows.map(row => row.length > 0 ? "auto" : `${2 * (table.padding + table.border)}px`).join(" ");
    const inset = 2 * (table.padding + table.border);
    const heights = getComputedStyle(table.table).gridTemplateRows.split(" ").map(value => parseFloat(value) - inset);
    const naturalHeight = table.table.offsetHeight;
    const total = heights.reduce((sum, height) => sum + height, 0);

    if (table.height > naturalHeight && total > 0) {
        const available = table.height - 2 * table.border - table.rows.length * inset - (table.rows.length + 1) * table.spacing;

        table.table.style.gridTemplateRows = heights.map(height => `${Math.trunc(height * available / total) + inset}px`).join(" ");
        table.table.style.alignContent = "start";
    }
    table.table.style.height = `${Math.max(naturalHeight, table.height)}px`;
    for (const row of table.rows) for (const cell of row) {
        const inner = cell.block.element, align = cell.element.style.verticalAlign;
        const height = cell.element.offsetHeight - inset;
        const contentHeight = inner.offsetHeight + (parseFloat(inner.style.marginBottom) || 0);
        const offset = align === "middle" ? Math.trunc(height / 2) - Math.trunc(contentHeight / 2) : align === "bottom" ? height - contentHeight : 0;

        inner.style.transform = `translateY(${offset}px)`;
    }
}

function drawHtmlTableFrame(table: HtmlTable_T) { // NWindow 0x1003bf10..0x1003bfee.
    if (!table.frame) return;

    const width = table.table.clientWidth, height = table.table.clientHeight, rects: SVGRectElement[] = [];

    function line(x1: number, y1: number, x2: number, y2: number) {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");

        rect.setAttribute("x", `${Math.min(x1, x2)}`);
        rect.setAttribute("y", `${Math.min(y1, y2)}`);
        rect.setAttribute("width", `${Math.abs(x2 - x1) + 1}`);
        rect.setAttribute("height", `${Math.abs(y2 - y1) + 1}`);
        rect.setAttribute("fill", cssColor(TEXT_COLOR));
        rects.push(rect);
    }
    table.frame.setAttribute("width", `${Math.max(1, width)}`);
    table.frame.setAttribute("height", `${Math.max(1, height)}`);

    for (let i = 0; i < table.border; i++) {
        const right = width - i - 1, bottom = height - i - 1;

        line(i, i, right, i);
        line(i, bottom, right, bottom);
        line(i, i, i, bottom);
        line(right, i, right, bottom);
    }
    table.frame.replaceChildren(...rects);
}

function compareNoCase(a: string, b: string) {
    const x = a.toLowerCase(), y = b.toLowerCase();

    return x < y ? -1 : x > y ? 1 : 0;
}

function binarySearch(names: string[], key: string) { // 0x1003aaa0 / 0x1003ab00: lo/hi binary search, wcscmp against the towupper'd name.
    let lo = 0, hi = names.length;

    while (hi > lo) {
        const mid = lo + Math.trunc((hi - lo) / 2);
        const result = names[mid] < key ? -1 : names[mid] > key ? 1 : 0;

        if (result === 0) return mid;
        if (result < 0) lo = mid + 1;
        else hi = mid;
    }

    return -1;
}

const TAG_NAMES = TAG_TABLE.map(entry => entry[0]);

function isSpace(c: string) { return c === " " || c === "\t" || c === "\r" || c === "\n"; }
function isLetter(c: string) { return !!c && /[A-Za-z]/.test(c); }

function atoi(value: string) {
    const match = /^\s*[+-]?\d+/.exec(value || "");

    return match ? parseInt(match[0], 10) : 0;
}

function parseColor(value: string) { // 0x1003b980: "LEVEL", else wcstoul("0xff" + value, 16).
    if (value === "LEVEL") return LEVEL_COLOR;

    const digits = /^[0-9A-Fa-f]*/.exec(value)[0];

    return digits.length > 6 ? 0xffffffff : parseInt(`ff${digits}`, 16) >>> 0;
}

function cssColor(color: number) { return `rgba(${(color >>> 16) & 0xff}, ${(color >>> 8) & 0xff}, ${color & 0xff}, ${((color >>> 24) & 0xff) / 255})`; }

function skipSpaces(html: string, i: number) {
    while (i < html.length && isSpace(html[i])) i++;

    return i;
}

function skipTag(html: string, i: number) { // 0x10044910: unknown tags and comments end after the first '>' or before the next '<'.
    for (i++; i < html.length; i++) {
        if (html[i] === "<") return i;
        if (html[i] === ">") return i + 1;
    }

    return i;
}

function parseAttributes(html: string, i: number, attrNames: string[], attrs: Record<string, string>) { // 0x10046b80: names stop at space/'='/'>'/'<', values are "quoted" or stop at space/'>'/'<'.
    while (i < html.length) {
        i = skipSpaces(html, i);

        if (i >= html.length || html[i] === "<") return i;
        if (html[i] === ">") return i + 1;

        const start = i;

        while (i < html.length && !isSpace(html[i]) && html[i] !== "=" && html[i] !== ">" && html[i] !== "<") i++;

        const name = html.slice(start, i).toUpperCase();
        let value = "";

        i = skipSpaces(html, i);

        if (html[i] === "=" || html[i] === "\"") {
            if (html[i] === "=") i = skipSpaces(html, i + 1);

            if (html[i] === "\"") {
                const end = html.indexOf("\"", i + 1);

                value = html.slice(i + 1, end < 0 ? html.length : end);
                i = end < 0 ? html.length : end + 1;
            } else {
                const valueStart = i;

                while (i < html.length && !isSpace(html[i]) && html[i] !== ">" && html[i] !== "<") i++;

                value = html.slice(valueStart, i);
            }
        }

        if (i === start) i++;

        const index = binarySearch(attrNames, name);

        if (index >= 0 && !(attrNames[index] in attrs)) attrs[attrNames[index]] = value;
    }

    return i;
}

function parseTextRun(html: string, start: number): [HtmlSegment_T[], number] { // Text run 0x10045550: lowercase <font>/</font> stay inside the run; whitespace is trimmed and collapsed to one space.
    let end = html[start] === "<" ? start + 1 : start;

    while (end < html.length) {
        if (html[end] === "<" && !html.startsWith("<font", end) && !html.startsWith("</font", end)) break;

        end++;
    }

    const chars: string[] = [], colors: number[] = [];
    let color: number = null, i = start;

    while (i < end) {
        if (html.startsWith("</font", i)) {
            color = null;
            i = skipTag(html, i);
            continue;
        }

        if (html.startsWith("<font", i)) {
            const close = html.indexOf(">", i);
            const tag = html.slice(i, close < 0 ? end : close);
            const match = /color=(?:"([^"]*)"|([^\s>"]*))/.exec(tag);

            if (match) color = parseColor(match[1] !== undefined ? match[1] : match[2]);

            i = close < 0 ? end : close + 1;
            continue;
        }

        chars.push(html[i]);
        colors.push(color);
        i++;
    }

    const segments: HtmlSegment_T[] = [];
    let hasText = false, hasSpace = false;

    for (let k = 0; k < chars.length; k++) {
        if (isSpace(chars[k])) {
            if (hasText) hasSpace = true;
            continue;
        }

        let last = segments[segments.length - 1];

        if (!last || last.color !== colors[k]) segments.push(last = { text: "", color: colors[k] });

        if (hasSpace) last.text += " ";

        last.text += chars[k];
        hasText = true;
        hasSpace = false;
    }

    for (const segment of segments)
        for (const [entity, value] of TEXT_ENTITIES)
            while (segment.text.includes(entity))
                segment.text = segment.text.split(entity).join(value);

    return [segments, end];
}

function tokenizeHtml(html: string): HtmlToken_T[] { // Build loop 0x10046f80 with tag parse 0x100446d0.
    const tokens: HtmlToken_T[] = [];
    let i = 0;

    while (i < html.length) {
        if (html[i] === "<") {
            let j = skipSpaces(html, i + 1);

            if (html[j] === "!") {
                if (html[j + 1] === "-") {
                    i = skipTag(html, i);
                    continue;
                }

                j = skipSpaces(html, j + 1);
            }

            const isOpen = html[j] !== "/";

            if (!isOpen) j = skipSpaces(html, j + 1);

            if (!html.startsWith("font", j) && isLetter(html[j])) {
                const nameStart = j;

                while (j < html.length && !isSpace(html[j]) && html[j] !== ">" && html[j] !== "<") j++;

                const index = binarySearch(TAG_NAMES, html.slice(nameStart, j).toUpperCase());

                if (index < 0) {
                    i = skipTag(html, i);
                    continue;
                }

                const token: HtmlToken_T = { tag: TAG_NAMES[index], isOpen, attrs: {}, segments: null };

                i = parseAttributes(html, j, TAG_TABLE[index][1], token.attrs);
                tokens.push(token);
                continue;
            }
        }

        const [segments, end] = parseTextRun(html, i);

        if (segments.length > 0) tokens.push({ tag: "TEXTCODE", isOpen: true, attrs: {}, segments });

        i = end;
    }

    return tokens;
}

function parseCommand(text: string, match: string): string {
    let i = 0;

    while (text[i] === " " || text[i] === "\t") i++;

    if (compareNoCase(text.slice(i, i + match.length), match) !== 0) return null;

    i += match.length;

    if (/[A-Za-z0-9]/.test(text[i] || "")) return null;

    while (text[i] === " " || text[i] === "\t") i++;

    return text.slice(i);
}

function parseTokens(text: string): string[] {
    const tokens: string[] = [];
    let i = 0;

    while (true) {
        let token = "";

        while (text[i] === " " || text[i] === "\t") i++;

        if (text[i] === "\"") {
            for (i++; i < text.length && text[i] !== "\""; i++) {
                let c = text[i];

                if (c === "\\") {
                    c = text[++i];

                    if (c === undefined) break;
                }

                if (token.length < 255) token += c;
            }

            if (text[i] === "\"") i++;
        } else for (; i < text.length && text[i] !== " " && text[i] !== "\t"; i++)
            if (token.length < 255) token += text[i];

        if (token.length === 0) return tokens;

        tokens.push(token);
    }
}

export class NCHtmlViewer { // NCHtmlViewer (vtable 0x101a8a18) on NCScrollWnd: content laid out at W-16 (0x1004188e), scrollbar in the right 15 px.
    public static getTextures(): string[] { return [TEX_UP, TEX_UP_ON, TEX_DOWN, TEX_DOWN_ON, TEX_THUMB_TOP, TEX_THUMB_CENTER, TEX_THUMB_BOTTOM, ...NDOM_EDIT_TEXTURES, `?${DEFAULT_FORE}`, `?${DEFAULT_BACK}`]; }

    public readonly element: HTMLDivElement;
    public title: string = null;
    public onBypass: (command: string) => void = null;
    public onWrite: (kind: string, arg1: string, arg2: string, arg3: string, arg4: string, arg5: string) => void = null;
    public onLink: (path: string) => void = null;
    public onFile: (path: string) => void = null;
    public onHide: () => void = null;
    protected readonly layer: NDomLayer;
    protected readonly width: number;
    protected readonly height: number;
    protected readonly content: HTMLDivElement;
    protected readonly scrollBar: HTMLDivElement;
    protected readonly thumb: HTMLDivElement;
    protected readonly thumbCenter: HTMLDivElement;
    protected readonly thumbBottom: HTMLDivElement;
    protected background: HTMLDivElement = null;
    protected variables: HtmlVariable_T[] = [];
    protected arrMultiEdits: CHtmlMultiEdit[] = [];
    protected arrTextLayouts: (() => boolean)[] = [];
    protected arrTables: HtmlTable_T[] = [];
    protected contentHeight = 0;
    protected scroll = 0;
    protected thumbPos = 0;
    protected thumbLen = 0;
    protected loadSerial = 0;

    public constructor(layer: NDomLayer, parent: HTMLElement, x: number, y: number, width: number, height: number) {
        this.layer = layer;
        this.width = width;
        this.height = height;

        this.element = layer.createWindow(x, y, width, height, parent);
        this.element.style.overflow = "hidden";
        this.content = layer.createWindow(0, 0, width - SCROLLBAR_RESERVE, null, this.element);

        this.scrollBar = layer.createWindow(width - 15, 0, 15, height, this.element);
        this.pushButton(layer.button(this.scrollBar, 0, 0, 15, 15, TEX_UP, TEX_UP_ON, TEX_UP), -1);
        this.pushButton(layer.button(this.scrollBar, 0, height - 15, 15, 15, TEX_DOWN, TEX_DOWN_ON, TEX_DOWN), 1);

        this.thumb = layer.createWindow(0, 15, 15, height - 30, this.scrollBar);
        layer.tile(this.thumb, 0, 0, 15, 8, 0, 0, 15, 8, TEX_THUMB_TOP);
        this.thumbCenter = layer.tile(this.thumb, 0, 8, 15, 8, 0, 0, 15, 8, TEX_THUMB_CENTER);
        this.thumbBottom = layer.tile(this.thumb, 0, 8, 15, 8, 0, 0, 15, 8, TEX_THUMB_BOTTOM);
        this.thumb.addEventListener("mousedown", event => this.beginThumbDrag(event));
        this.element.addEventListener("wheel", event => this.scrollBy(Math.sign(event.deltaY) * this.getLineStep()));

        new ResizeObserver(() => { // Content laid out while hidden measures 0 tall; re-measure once it is shown.
            setTimeout(() => {
                this.arrTextLayouts = this.arrTextLayouts.filter(layout => !layout());
                for (let i = this.arrTables.length - 1; i >= 0; i--) layoutHtmlTableHeight(this.arrTables[i]);
                this.arrTables.forEach(drawHtmlTableFrame);
                this.contentHeight = this.content.offsetHeight;
                this.setScroll(this.scroll);
            }, 0);
        }).observe(this.content);
    }

    protected getLineStep() { return this.layer.getManager().canvas.getLineHeight(FontType_T.SMALL); } // Scroll line step [+0xfc] = GetTextExtent("A").cy (0x1003ae71); positions round up to it (0x1002bc02).

    protected pushButton(button: HTMLElement, direction: number) {
        button.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            this.scrollBy(direction * this.getLineStep());

            const timer = window.setInterval(() => {
                if (button.matches(":hover")) this.scrollBy(direction * this.getLineStep());
            }, REPEAT_PERIOD);
            const stop = () => {
                window.clearInterval(timer);
                window.removeEventListener("mouseup", stop, true);
                window.removeEventListener("blur", stop);
            };

            window.addEventListener("mouseup", stop, true);
            window.addEventListener("blur", stop);
        });
    }

    protected beginThumbDrag(event: MouseEvent) {
        if (event.button !== 0) return;

        event.preventDefault();

        const startY = this.layer.toUI(event.clientY), startPos = this.thumbPos, step = this.getLineStep();

        this.layer.beginDrag(moveEvent => {
            const travel = this.height - 30 - this.thumbLen;

            if (travel <= 0) return;

            const position = Math.max(0, Math.min(travel, Math.trunc(startPos + this.layer.toUI(moveEvent.clientY) - startY)));

            this.setScroll(Math.ceil(Math.trunc(position * (this.contentHeight - this.height) / travel) / step) * step);
            this.thumbPos = position;
            this.layer.place(this.thumb, 0, 15 + position);
        });
    }

    public scrollBy(delta: number) { this.setScroll(this.scroll + delta); }

    public setScroll(position: number) {
        this.scroll = Math.max(0, Math.min(position, this.contentHeight - this.height));
        this.content.style.top = `${-this.scroll}px`;
        this.updateThumb();
    }

    protected updateThumb() { // 0x1002c0a0 / 0x1002c150: thumb = view*sliderH/content (min 15), offset = (sliderH-len)*scroll/(content-view).
        const sliderH = this.height - 30, isScrollable = this.contentHeight > this.height;

        this.scrollBar.hidden = !isScrollable;

        if (!isScrollable) return;

        this.thumbLen = Math.max(MIN_THUMB, Math.trunc(this.height * sliderH / this.contentHeight));
        this.thumbPos = Math.trunc((sliderH - this.thumbLen) * this.scroll / (this.contentHeight - this.height));

        this.layer.place(this.thumb, 0, 15 + this.thumbPos, 15, this.thumbLen);
        const centerLen = Math.max(0, this.thumbLen - 16);

        this.layer.place(this.thumbCenter, 0, 8, 15, centerLen);
        this.layer.setTile(this.thumbCenter, 15, centerLen, 0, 0, 15, 8, TEX_THUMB_CENTER);
        this.layer.place(this.thumbBottom, 0, this.thumbLen - 8);
    }

    public tick(deltaSeconds: number) { this.arrMultiEdits.forEach(edit => edit.tick(deltaSeconds)); }

    public async setHtml(html: string) { // Load from string 0x100419d0: tokenize, build, layout, create controls.
        const serial = ++this.loadSerial;
        const tokens = tokenizeHtml(html);
        const textures: string[] = [];

        for (const token of tokens) {
            if (token.tag === "MULTIEDIT") textures.push(...CHtmlMultiEdit.getTextures());
            if (token.tag === "IMG" && token.attrs.SRC) textures.push(`?${token.attrs.SRC}`);
            if (token.tag === "HTML" && token.attrs.IMGSRC) textures.push(`?${token.attrs.IMGSRC}`);
            if (token.tag === "BUTTON") {
                const fore = token.attrs.FORE || DEFAULT_FORE;

                textures.push(`?${fore}`, `?${fore}_over`, `?${token.attrs.BACK || DEFAULT_BACK}`);
            }
        }

        await this.layer.loadTextures(textures);

        if (serial !== this.loadSerial) return;

        this.content.replaceChildren();
        this.variables = [];
        this.arrMultiEdits = [];
        this.title = null;

        if (this.background) this.background.remove();

        this.background = null;
        this.build(tokens);
        this.contentHeight = this.content.offsetHeight;
        this.setScroll(0);
    }

    protected build(tokens: HtmlToken_T[]) {
        const blocks: HtmlBlock_T[] = [{ element: this.content, paragraph: null, paragraphAlign: 0, width: 0, minimumWidth: 0, tables: [] }];
        const aligns: number[] = [];
        const tables: HtmlTable_T[] = [], root = blocks[0];
        this.arrTextLayouts = [];
        this.arrTables = [];
        let link: HtmlLink_T = null, isTitle = false, backgroundPath: string = null;

        const getAlign = () => aligns.length > 0 ? aligns[aligns.length - 1] : 0;
        const getBlock = () => blocks[blocks.length - 1];
        const addRow = () => {
            const block = getBlock(), row = document.createElement("div");

            block.paragraph = null;
            row.style.textAlign = ALIGN_CSS[getAlign()];
            row.style.fontSize = "0";
            row.style.lineHeight = "0";
            block.element.appendChild(row);

            return row;
        };
        const addHolder = (row: HTMLElement, width: number, height: number) => {
            const holder = document.createElement("span");

            holder.style.display = "inline-block";
            holder.style.position = "relative";
            holder.style.verticalAlign = "top";
            holder.style.width = `${width}px`;
            holder.style.height = `${height}px`;
            row.appendChild(holder);
            getBlock().width = Math.max(getBlock().width, width);
            getBlock().minimumWidth = Math.max(getBlock().minimumWidth, width);

            return holder;
        };
        const closeCell = (table: HtmlTable_T) => {
            if (!table.cell) return;

            const inner = getBlock().element;

            if (inner.childElementCount > 0) inner.style.marginBottom = `${-LINE_SPACING}px`; // A cell's last line has no trailing pitch: title rows are 19px tall in the L2.4_20 capture.
            else if (inner.style.minHeight) inner.style.minHeight = `${Math.max(0, parseFloat(inner.style.minHeight) - LINE_SPACING)}px`;

            blocks.pop();
            aligns.pop();
            table.cell = null;
        };

        for (const token of tokens) {
            const attrs = token.attrs;

            if (isTitle && token.tag === "TEXTCODE") {
                this.title = (this.title ? `${this.title} ` : "") + token.segments.map(segment => segment.text).join("");
                continue;
            }

            switch (token.tag) {
                case "TEXTCODE": this.arrTextLayouts.push(this.addTextRun(getBlock(), getAlign(), token.segments, link)); break;
                case "TITLE": isTitle = token.isOpen; break;
                case "HTML": if (token.isOpen && attrs.IMGSRC) backgroundPath = attrs.IMGSRC; break;
                case "CENTER":
                    if (token.isOpen) aligns.push(1);
                    else aligns.pop();
                    break;
                case "A": // Layout 0x100415bd: LINK -> mode 1, ACTION -> mode 2, CMD -> mode 9 (target not kept for CMD).
                    if (!token.isOpen) link = null;
                    else if ("LINK" in attrs) link = { target: attrs.LINK, isUnderlined: true };
                    else if ("ACTION" in attrs) link = { target: attrs.ACTION, isUnderlined: false };
                    else if ("CMD" in attrs) link = { target: null, isUnderlined: false };
                    else link = null;
                    break;
                case "BR": if (token.isOpen) addRow().style.height = `${BR_HEIGHT}px`; break;
                case "BR1": if (token.isOpen) getBlock().paragraph = null; break;
                case "IMG": { // IMG 0x100409c0, drawn 1:1 from the texture origin (0x1004122f).
                    if (!token.isOpen) break;

                    const width = atoi(attrs.WIDTH), height = atoi(attrs.HEIGHT);
                    const holder = addHolder(addRow(), width, height);

                    if (width > 0 && height > 0 && attrs.SRC && this.layer.hasTexture(attrs.SRC))
                        this.layer.tile(holder, 0, 0, width, height, 0, 0, width, height, attrs.SRC);
                    break;
                }
                case "BUTTON": { // BUTTON 0x10040a91: defaults 10x10, fore = normal, back = down; VALUE "&$NNN;" is a sysstring id (0x1003d71a).
                    if (!token.isOpen) break;

                    const width = "WIDTH" in attrs ? atoi(attrs.WIDTH) : 10, height = "HEIGHT" in attrs ? atoi(attrs.HEIGHT) : 10;
                    const fore = attrs.FORE || DEFAULT_FORE, back = attrs.BACK || DEFAULT_BACK, value = attrs.VALUE || "";
                    const label = value.startsWith("&$") && value.endsWith(";") ? this.layer.getManager().getSysString(atoi(value.slice(2))) : value;
                    const action = attrs.ACTION || "";
                    const holder = addHolder(addRow(), width, height);

                    this.layer.button(holder, 0, 0, width, height, this.layer.hasTexture(fore) ? fore : null, this.layer.hasTexture(back) ? back : null, null, label, () => this.dispatch(action));
                    break;
                }
                case "EDIT": { // EDIT 0x10040bfd: defaults 50x15, element height HEIGHT+6, TYPE "password" masks.
                    if (!token.isOpen) break;

                    const width = "WIDTH" in attrs ? atoi(attrs.WIDTH) : 50, height = "HEIGHT" in attrs ? atoi(attrs.HEIGHT) : 15;
                    const row = addRow();
                    const holder = addHolder(row, width, height);
                    const edit = this.layer.edit(holder, 0, 0, width, height, attrs.TYPE === "password", atoi(attrs.LENGTH));

                    holder.style.marginBottom = `${LINE_SPACING}px`;

                    this.variables.push({ name: attrs.VAR, isMultiline: false, edit });
                    break;
                }
                case "MULTIEDIT": { // 0x10040b7e: defaults 50x40, HEIGHT+6 layout.
                    if (!token.isOpen) break;

                    const width = "WIDTH" in attrs ? atoi(attrs.WIDTH) : 50, height = "HEIGHT" in attrs ? atoi(attrs.HEIGHT) : 40;
                    const holder = addHolder(addRow(), width, height);
                    const edit = new CHtmlMultiEdit(this.layer, holder, 0, 0, width, height);

                    holder.style.marginBottom = `${LINE_SPACING}px`;
                    edit.input.setAttribute("aria-label", attrs.VAR || "");
                    this.arrMultiEdits.push(edit);
                    this.variables.push({ name: attrs.VAR, isMultiline: true, edit });
                    break;
                }
                case "TABLE": { // TABLE 0x1003e110: border 0, cellpadding 1, cellspacing 2 by default (ctor 0x1003dfb0); "ALIGN," never matches.
                    if (!token.isOpen) {
                        const table = tables.pop();

                        if (table) closeCell(table);
                        break;
                    }

                    const table = document.createElement("table");
                    const spacing = "CELLSPACING" in attrs ? atoi(attrs.CELLSPACING) : 2;

                    table.style.display = "inline-grid";
                    table.style.boxSizing = "border-box";
                    table.style.position = "relative";
                    table.style.padding = "0";
                    table.style.rowGap = `${spacing}px`;
                    table.style.borderCollapse = "separate";
                    table.style.borderSpacing = `${spacing}px`;
                    table.style.verticalAlign = "top";

                    const frame = atoi(attrs.BORDER) > 0 ? document.createElementNS("http://www.w3.org/2000/svg", "svg") : null;

                    if (frame) {
                        frame.style.position = "absolute";
                        frame.style.left = frame.style.top = "0";
                        frame.style.overflow = "visible";
                        frame.style.pointerEvents = "none";
                        table.appendChild(frame);
                    }

                    if ("BGCOLOR" in attrs) table.style.backgroundColor = cssColor(parseColor(attrs.BGCOLOR));

                    addRow().appendChild(table);
                    const entry: HtmlTable_T = { table, frame, row: null, cell: null, border: atoi(attrs.BORDER), padding: "CELLPADDING" in attrs ? atoi(attrs.CELLPADDING) : 1, spacing, width: atoi(attrs.WIDTH), height: atoi(attrs.HEIGHT), isPercentage: !!attrs.WIDTH && attrs.WIDTH.endsWith("%"), rows: [], columns: [], naturalWidth: 0, minimumWidth: 0 };

                    getBlock().tables.push(entry);
                    this.arrTables.push(entry);
                    tables.push(entry);
                    break;
                }
                case "TR": {
                    const table = tables[tables.length - 1];

                    if (!table) break;

                    closeCell(table);
                    table.row = token.isOpen ? table.table.insertRow() : null;
                    if (table.row) {
                        table.row.style.display = "contents";
                        (table.row.parentElement as HTMLElement).style.display = "contents";
                        table.rows.push([]);
                    }
                    break;
                }
                case "TD": { // TD 0x1003dde0: ALIGN pushed on the alignment stack, VALIGN TOP=2 BOTTOM=3 CENTER=1 (absent=1), WIDTH may end in '%'.
                    const table = tables[tables.length - 1];

                    if (!table) break;

                    closeCell(table);

                    if (!token.isOpen) break;
                    if (!table.row) {
                        table.row = table.table.insertRow();
                        table.row.style.display = "contents";
                        (table.row.parentElement as HTMLElement).style.display = "contents";
                        table.rows.push([]);
                    }

                    const cell = table.row.insertCell(), inner = document.createElement("div");
                    const align = "ALIGN" in attrs ? ["CENTER", "RIGHT", "LEFT"].findIndex(keyword => compareNoCase(attrs.ALIGN, keyword) === 0) : -1;
                    const valign = "VALIGN" in attrs ? ["CENTER", "TOP", "BOTTOM"].findIndex(keyword => compareNoCase(attrs.VALIGN, keyword) === 0) + 1 : 1;

                    cell.style.display = "flex";
                    cell.style.flexDirection = "column";
                    cell.style.justifyContent = "flex-start";
                    cell.style.padding = `${table.padding}px`;
                    cell.style.verticalAlign = VALIGN_CSS[valign];

                    if (table.border > 0) cell.style.border = `${table.border}px solid ${cssColor(TEXT_COLOR)}`;
                    if ("HEIGHT" in attrs) inner.style.minHeight = `${Math.max(0, atoi(attrs.HEIGHT))}px`;
                    if ("BGCOLOR" in attrs) cell.style.backgroundColor = cssColor(parseColor(attrs.BGCOLOR));

                    cell.appendChild(inner);
                    table.cell = cell;
                    const block: HtmlBlock_T = { element: inner, paragraph: null, paragraphAlign: 0, width: attrs.WIDTH && !attrs.WIDTH.endsWith("%") ? Math.max(0, atoi(attrs.WIDTH)) : 0, minimumWidth: 0, tables: [] };

                    table.rows[table.rows.length - 1].push({ element: cell, block, fixedWidth: atoi(attrs.FIXWIDTH) });
                    blocks.push(block);
                    aligns.push([1, 3, 2, 0][align < 0 ? 3 : align]);
                    break;
                }
            }
        }

        for (const table of root.tables) measureHtmlTable(table);

        this.arrTextLayouts.unshift(() => {
            if (this.content.clientWidth <= 0) return false;

            for (const table of root.tables) layoutHtmlTable(table, this.content.clientWidth);

            return true;
        });
        this.arrTextLayouts = this.arrTextLayouts.filter(layout => !layout());
        for (let i = this.arrTables.length - 1; i >= 0; i--) layoutHtmlTableHeight(this.arrTables[i]);
        this.arrTables.forEach(drawHtmlTableFrame);
        if (this.arrTextLayouts.length > 0)
            setTimeout(() => {
                this.arrTextLayouts = this.arrTextLayouts.filter(layout => !layout());
                for (let i = this.arrTables.length - 1; i >= 0; i--) layoutHtmlTableHeight(this.arrTables[i]);
                this.arrTables.forEach(drawHtmlTableFrame);
            }, 0);

        if (backgroundPath && this.layer.hasTexture(backgroundPath)) {
            const width = this.content.offsetHeight > this.height ? this.width - SCROLLBAR_RESERVE : this.width;

            this.background = this.layer.tile(this.element, 0, 0, width, this.height, 0, 0, width, this.height, backgroundPath);
            this.element.insertBefore(this.background, this.content);
        }
    }

    protected addTextRun(block: HtmlBlock_T, align: number, segments: HtmlSegment_T[], link: HtmlLink_T) { // Text element 0x1003cc90: line pitch is glyph height + 6; adjacent runs continue on the same line (0x1003bc77).
        if (!block.paragraph || block.paragraphAlign !== align || align === 1) { // NWindow 0x1003bbcf..0x1003bc88: centered text runs do not share a line.
            const paragraph = document.createElement("div");

            paragraph.style.textAlign = ALIGN_CSS[align];
            paragraph.style.fontSize = "0";
            paragraph.style.lineHeight = "0";
            paragraph.style.wordSpacing = `${this.layer.measureText(" ")}px`;
            paragraph.style.minWidth = `${this.layer.measureText("A")}px`;
            block.element.appendChild(paragraph);
            block.paragraph = paragraph;
            block.paragraphAlign = align;
        }

        const paragraph = block.paragraph, layer = this.layer;
        block.width = Math.max(block.width, layer.measureText(segments.map(segment => segment.text).join("")));
        block.minimumWidth = Math.max(block.minimumWidth, layer.measureText("A"));
        const arrWords: HtmlWord_T[] = [], arrTexts: HTMLDivElement[] = [];
        let word: HTMLSpanElement = null;

        function draw(parent: HTMLElement, text: string, color: number) {
            const element = layer.text(parent, text, color, FontType_T.SMALL, null, null, !!link && link.isUnderlined);

            arrTexts.push(element);
            element.style.marginBottom = `${LINE_SPACING}px`;

            return element;
        }

        for (const segment of segments) {
            const color = link ? LINK_COLOR : segment.color === null ? TEXT_COLOR : segment.color;
            const parts = segment.text.split(" ");

            for (let i = 0; i < parts.length; i++) {
                if (i > 0) {
                    const space = document.createTextNode(" ");
                    if (arrWords.length > 0) arrWords[arrWords.length - 1].space = space;
                    word = null;
                    paragraph.appendChild(space);
                }

                if (parts[i].length === 0) continue;

                if (!word) {
                    word = document.createElement("span");
                    word.style.whiteSpace = "nowrap";
                    paragraph.appendChild(word);
                    arrWords.push({ element: word, segments: [], space: null, last: null, advance: 0 });

                    if (link && link.target !== null) {
                        const target = link.target;

                        word.addEventListener("click", () => {
                            this.layer.getManager().playButtonSound(true);
                            if (link.isUnderlined) { if (this.onFile) this.onFile(target); }
                            else this.dispatch(target);
                        });
                    }
                }

                arrWords[arrWords.length - 1].segments.push({ text: parts[i], color });
            }
        }

        return () => {
            const width = paragraph.clientWidth;

            if (width <= 0) return false;

            for (const entry of arrWords) {
                if (entry.segments.reduce((total, segment) => total + layer.measureText(segment.text), 0) <= width) {
                    entry.segments.forEach(segment => draw(entry.element, segment.text, segment.color));
                    entry.last = arrTexts[arrTexts.length - 1];
                    continue;
                }

                entry.element.style.whiteSpace = "normal";
                let chunk: HTMLSpanElement = null, advance = 0;

                for (const segment of entry.segments) {
                    let start = 0;

                    for (let i = 0; i < segment.text.length; i++) {
                        const glyphWidth = layer.measureText(segment.text[i]);

                        // FL2TextAlignParser::DivideTokenWithWidth uses a strict width comparison.
                        if (chunk && advance + glyphWidth >= width) {
                            if (i > start) draw(chunk, segment.text.slice(start, i), segment.color);
                            start = i;
                            entry.element.appendChild(document.createElement("wbr"));
                            chunk = null;
                            advance = 0;
                        }
                        if (!chunk) {
                            chunk = document.createElement("span");
                            chunk.style.whiteSpace = "nowrap";
                            entry.element.appendChild(chunk);
                        }
                        advance += glyphWidth;
                    }
                    if (start < segment.text.length) draw(chunk, segment.text.slice(start), segment.color);
                }
                entry.last = arrTexts[arrTexts.length - 1];
            }

            const alignment = paragraph.style.textAlign;
            paragraph.style.textAlign = "left";
            const bounds = paragraph.getBoundingClientRect(), scale = bounds.width / width;
            const lines = new Map<number, { end: number, spaces: HtmlWord_T[] }>(), spaceWidth = layer.measureText(" ");
            let lastLine = -Infinity;

            for (const text of arrTexts) {
                const rect = text.getBoundingClientRect();
                let line = lines.get(rect.top);

                if (!line) lines.set(rect.top, line = { end: rect.right, spaces: [] });
                line.end = Math.max(line.end, rect.right);
                lastLine = Math.max(lastLine, rect.top);
            }
            for (const entry of arrWords) {
                if (!entry.space) continue;

                const rect = entry.last.getBoundingClientRect(), line = lines.get(rect.top);
                entry.advance = spaceWidth;

                if (rect.top !== lastLine && Math.abs(rect.right - line.end) < 0.01) {
                    if ((bounds.right - line.end) / scale <= spaceWidth) {
                        entry.advance = 0;
                        continue;
                    }
                    line.end += spaceWidth * scale;
                }
                line.spaces.push(entry);
            }
            for (const [top, line] of lines) {
                if (top === lastLine || line.spaces.length === 0) continue;

                const extra = Math.max(0, Math.round((bounds.right - line.end) / scale));
                const advance = Math.floor(extra / line.spaces.length), remainder = extra % line.spaces.length;

                for (let i = 0; i < line.spaces.length; i++)
                    line.spaces[i].advance += advance + (i < remainder ? 1 : 0);
            }
            for (const entry of arrWords) {
                if (!entry.space) continue;

                entry.space.replaceWith(document.createElement("wbr"));
                const text = draw(entry.element, " ", entry.segments[entry.segments.length - 1].color);
                text.style.minWidth = text.style.maxWidth = `${entry.advance}px`;
                text.style.overflow = "hidden";
            }
            paragraph.style.textAlign = alignment;
            return true;
        };
    }

    protected getVariable(name: string): string { // 0x1003c1b0: first control whose VAR matches (wcscmp).
        const variable = this.variables.find(entry => entry.name === name);

        return variable ? variable.edit.getValue() : null;
    }

    public dispatch(target: string): number { // Console link handler 0x10072560: BYPASS args re-tokenized, first "-h" dropped and hides the window, "$var" replaced by the edit value.
        if (!target) return 0;

        let rest = parseCommand(target, "BYPASS");

        if (rest !== null) {
            let command = "", isHide = false;
            const tokens = parseTokens(rest);

            if (tokens.length === 0) return 0;

            for (const token of tokens) {
                if (!isHide && token === "-h") {
                    isHide = true;
                    continue;
                }

                const value = token[0] === "$" ? this.getVariable(token.slice(1)) : token;

                if (value === null) continue;

                command = command ? `${command} ${value}` : value;
            }

            if (this.onBypass) this.onBypass(command);
            if (isHide && this.onHide) this.onHide();

            return isHide ? 2 : 1;
        }

        rest = parseCommand(target, "WRITE");

        if (rest !== null) {
            const tokens = parseTokens(rest);

            if (tokens.length < 4) return 0;

            const value = this.getVariable(tokens[3]);

            if (value === null) return 0;

            let arg4 = "-", arg5 = "-";

            if (tokens[0] === "4" || tokens[0] === "5" || tokens[0] === "7") {
                if (tokens.length < 5) return 0;

                arg4 = this.getVariable(tokens[4]);
                if (arg4 === null) return 0;
            }
            if (tokens[0] === "4" || tokens[0] === "7") {
                if (tokens.length < 6) return 0;

                arg5 = this.getVariable(tokens[5]);
                if (arg5 === null) return 0;
            }
            if (this.onWrite) this.onWrite(tokens[0], tokens[1], tokens[2], value, arg4, arg5);
            return 1;
        }

        rest = parseCommand(target, "LINK");

        if (rest !== null) {
            const tokens = parseTokens(rest);

            if (tokens.length && this.onLink) this.onLink(tokens[0]);
            return 1;
        }

        debugger;
        return 0;
    }
}

export default NCHtmlViewer;
