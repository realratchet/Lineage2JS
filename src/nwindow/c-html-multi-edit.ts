import NDomLayer from "./ndom";

const arrFrameTextures = Array.from({ length: 18 }, (_, index) => `L2UI_CH3.multiedit.M_inputbox0${index % 9 + 1}${index >= 9 ? "_disable" : ""}`);
const arrScrollTextures = ["ScrollBarUpBtn", "ScrollBarUpOnBtn", "ScrollBarDownBtn", "ScrollBarDownOnBtn", "SliderBarTop", "SliderBarCenter", "SliderBarBottom"].map(name => `L2UI_CH3.ScrollBar.${name}`);
type MultiEditRow_T = { start: number, end: number, text: string };

function normalizeValue(value: string) { return value.replace(/\r\n?/g, "\n"); }

function rawIndex(value: string, index: number) {
    let offset = 0;

    for (let i = 0; i < index && offset < value.length; i++, offset++)
        if (value[offset] === "\r" && value[offset + 1] === "\n") offset++;

    return offset;
}

export class CHtmlMultiEdit {
    public static getTextures(): string[] { return [...arrFrameTextures, ...arrScrollTextures]; }
    public readonly element: HTMLDivElement;
    public readonly input: HTMLTextAreaElement;
    protected readonly layer: NDomLayer;
    protected readonly width: number;
    protected readonly height: number;
    protected readonly text: HTMLCanvasElement;
    protected readonly arrSlices: HTMLDivElement[];
    protected readonly thumb: HTMLDivElement;
    protected readonly thumbCenter: HTMLDivElement;
    protected readonly thumbBottom: HTMLDivElement;
    protected readonly rowHeight: number;
    protected readonly visibleRows: number;
    protected arrRows: MultiEditRow_T[] = [];
    protected value = "";
    protected pasteValue: string = null;
    protected inputStart = 0;
    protected inputEnd = 0;
    protected caretPosition = -1;
    protected caretRow = 0;
    protected caretDirection = 0;
    protected firstRow = 0;
    protected totalRows = 1;
    protected thumbPosition = 0;
    protected thumbLength = 0;
    protected blinkElapsed = 0;
    protected isCaretVisible = false;
    protected repeatElapsed = 0;
    protected repeatDirection = 0;
    protected isRepeatPressed = false;

    public constructor(layer: NDomLayer, parent: HTMLElement, x: number, y: number, width = 50, height = 40) {
        this.layer = layer;
        this.width = width;
        this.height = height;
        this.rowHeight = layer.getManager().canvas.getLineHeight() + 2;
        this.visibleRows = Math.trunc((height - 2) / this.rowHeight);

        this.element = layer.createWindow(x, y, width, height, parent);
        this.element.style.overflow = "hidden";
        this.arrSlices = Array.from({ length: 9 }, (_, index) => {
            const column = index % 3, row = Math.trunc(index / 3), w = column === 1 ? width - 8 : 4, h = row === 1 ? height - 8 : 4;
            const path = arrFrameTextures[index + 9], image = layer.getManager().canvas.getTexture(path), corner = column !== 1 && row !== 1;

            return layer.tile(this.element, column === 2 ? width - 4 : column * 4, row === 2 ? height - 4 : row * 4, w, h, 0, 0, corner ? 4 : image.width, corner ? 4 : image.height, path);
        });

        this.text = document.createElement("canvas");
        const canvas = layer.getManager().canvas;

        this.text.style.position = "absolute";
        this.text.style.pointerEvents = "none";
        this.text.width = Math.round(width * canvas.scale);
        this.text.height = Math.round(height * canvas.scale);
        layer.place(this.text, 0, 0, width, height);
        this.input = document.createElement("textarea");
        this.input.spellcheck = false;
        this.input.wrap = "off";
        this.input.style.cssText = `position:absolute;box-sizing:border-box;resize:none;background:transparent;color:transparent;caret-color:transparent;border:0;outline:none;font:12px Arial;line-height:${this.rowHeight}px;padding:2px;overflow:hidden;`;
        layer.place(this.input, 0, 0, width - 15, height);
        this.element.append(this.text, this.input);

        this.input.addEventListener("focus", () => { this.paintFrame(); this.paint(); });
        this.input.addEventListener("blur", () => { this.paintFrame(); this.paint(); });
        this.input.addEventListener("paste", event => { this.pasteValue = event.clipboardData.getData("text/plain"); });
        this.input.addEventListener("beforeinput", () => { this.inputStart = this.input.selectionStart; this.inputEnd = this.input.selectionEnd; });
        this.input.addEventListener("input", event => this.updateValue(event as InputEvent));
        this.input.addEventListener("select", () => { if (document.activeElement === this.input) this.revealCaret(); this.paint(); });
        this.input.addEventListener("keydown", event => { this.caretDirection = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0; });
        this.input.addEventListener("keyup", () => { if (document.activeElement === this.input) this.revealCaret(); this.paint(); this.caretDirection = 0; });
        this.input.addEventListener("mousedown", () => { this.caretDirection = 0; });
        this.input.addEventListener("click", () => this.paint());
        this.input.addEventListener("scroll", () => { this.input.scrollTop = 0; this.input.scrollLeft = 0; });

        this.createArrow(0, -1);
        this.createArrow(height - 15, 1);
        this.thumb = layer.createWindow(width - 15, 15, 15, Math.max(height - 30, 0), this.element);
        layer.tile(this.thumb, 0, 0, 15, 8, 0, 0, 15, 8, arrScrollTextures[4]);
        this.thumbCenter = layer.tile(this.thumb, 0, 8, 15, 8, 0, 0, 15, 8, arrScrollTextures[5]);
        this.thumbBottom = layer.tile(this.thumb, 0, 8, 15, 8, 0, 0, 15, 8, arrScrollTextures[6]);
        this.thumb.addEventListener("mousedown", event => this.beginThumbDrag(event));
        this.element.addEventListener("wheel", event => {
            event.preventDefault();
            event.stopPropagation();
            const rows = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? Math.trunc(event.deltaY) : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? Math.trunc(event.deltaY * this.visibleRows) : Math.trunc(event.deltaY / 120);

            this.setFirstRow(this.firstRow + rows);
        }, { passive: false });
        this.updateRows();
    }

    public getValue() { return this.value; }

    public setValue(value: string) {
        this.value = value;
        this.input.value = value;
        this.updateRows();
        this.revealCaret();
        this.paint();
    }

    protected updateValue(event: InputEvent = null) {
        const previous = normalizeValue(this.value), current = this.input.value;
        let start = 0, end = previous.length, nextEnd = current.length;

        while (start < end && start < nextEnd && previous[start] === current[start]) start++;
        while (end > start && nextEnd > start && previous[end - 1] === current[nextEnd - 1]) { end--; nextEnd--; }

        let inserted = current.slice(start, nextEnd);

        if (event && (event.inputType === "insertLineBreak" || event.inputType === "insertParagraph")) inserted = inserted.replace(/\n/g, "\r\n");
        if (event && event.inputType === "insertFromPaste" && this.pasteValue !== null && normalizeValue(this.pasteValue) === inserted) inserted = this.pasteValue;

        let nextValue = this.value.slice(0, rawIndex(this.value, start)) + inserted + this.value.slice(rawIndex(this.value, end));
        const replacement = !event ? null : event.inputType === "insertFromPaste" ? this.pasteValue : event.inputType === "insertLineBreak" || event.inputType === "insertParagraph" ? "\r\n" : event.inputType === "insertText" ? event.data : null;

        if (replacement !== null) {
            const candidate = this.value.slice(0, rawIndex(this.value, this.inputStart)) + replacement + this.value.slice(rawIndex(this.value, this.inputEnd));

            if (normalizeValue(candidate) === current) nextValue = candidate;
        }
        this.value = nextValue;
        this.pasteValue = null;
        this.updateRows();
        this.revealCaret();
        this.paint();
    }

    protected updateRows() {
        const canvas = this.layer.getManager().canvas, budget = Math.trunc(this.width) - 36;
        const arrLines = this.value.split("\n");
        let offset = 0;

        this.arrRows = [];
        this.totalRows = 0;
        this.caretPosition = -1;
        this.caretDirection = 0;
        for (let i = 0; i < arrLines.length; i++) {
            const line = arrLines[i], shown = i < arrLines.length - 1 && line.endsWith("\r") ? line.slice(0, -1) : line;
            let width = 0, start = 0, count = 1;

            for (let j = 0; j < shown.length; j++) {
                const advance = canvas.measureText(shown[j]);

                width += advance;
                if (width > budget) { count++; width = advance; }
            }
            this.totalRows += count;
            do {
                let end = start, rowWidth = 0;

                while (end < shown.length && rowWidth + canvas.measureText(shown[end]) <= budget) rowWidth += canvas.measureText(shown[end++]);
                this.arrRows.push({ start: offset + start, end: offset + end, text: shown.slice(start, end) });
                if (end === start) break; // 100277bb/1004981f: empty row-end advances the logical row.
                start = end;
            } while (start < shown.length);
            offset += line.length + 1;
        }
        this.setFirstRow(this.firstRow);
    }

    protected getCaretRow() {
        const position = rawIndex(this.value, this.input.selectionDirection === "backward" ? this.input.selectionStart : this.input.selectionEnd);

        if (position === this.caretPosition) return this.caretRow;

        let row = this.arrRows.length - 1;

        for (let i = 0; i < this.arrRows.length; i++) {
            if (position > this.arrRows[i].end) continue;
            row = i;
            break;
        }
        // 1002a3f0/1002a6c8: Left can retain the following row at a shared wrap boundary; Right stays on the preceding row.
        if (this.caretDirection < 0 && position < this.caretPosition && this.caretRow > row && this.arrRows[this.caretRow].start === position)
            row = this.caretRow;

        this.caretPosition = position;
        this.caretRow = row;

        return row;
    }

    protected revealCaret() {
        const row = this.getCaretRow();

        if (row < this.firstRow) this.setFirstRow(row);
        else if (row >= this.firstRow + this.visibleRows) this.setFirstRow(row - this.visibleRows + 1);
    }

    protected setFirstRow(row: number) {
        this.firstRow = Math.max(0, Math.min(row, this.totalRows - this.visibleRows));
        this.updateThumb();
        this.paint();
    }

    protected paintFrame() {
        this.arrSlices.forEach((slice, index) => {
            const column = index % 3, row = Math.trunc(index / 3), path = arrFrameTextures[index + (document.activeElement === this.input ? 0 : 9)];
            const image = this.layer.getManager().canvas.getTexture(path), corner = column !== 1 && row !== 1;

            this.layer.setTile(slice, column === 1 ? this.width - 8 : 4, row === 1 ? this.height - 8 : 4, 0, 0, corner ? 4 : image.width, corner ? 4 : image.height, path);
        });
    }

    protected paint() {
        const canvas = this.layer.getManager().canvas, context = this.text.getContext("2d");

        context.setTransform(canvas.scale, 0, 0, canvas.scale, 0, 0);
        context.clearRect(0, 0, this.width, this.height);
        for (let i = 0; i < this.visibleRows && i + this.firstRow < this.arrRows.length; i++)
            canvas.renderText(context, 2, 2 + i * this.rowHeight, 0xffdcdcdc, this.arrRows[i + this.firstRow].text);

        if (document.activeElement !== this.input || !this.isCaretVisible) return;

        const row = this.getCaretRow(), entry = this.arrRows[row];
        const position = rawIndex(this.value, this.input.selectionDirection === "backward" ? this.input.selectionStart : this.input.selectionEnd);

        if (entry && row >= this.firstRow && row < this.firstRow + this.visibleRows)
            canvas.renderText(context, 2 + canvas.measureText(this.value.slice(entry.start, Math.min(position, entry.end))) - 3, 2 + (row - this.firstRow) * this.rowHeight, 0xffdcdcdc, "|");
    }

    protected updateThumb() {
        const trackHeight = Math.max(Math.trunc(this.height) - 30, 0), overflow = this.totalRows > this.visibleRows;

        this.thumbLength = Math.max(15, overflow ? Math.trunc(this.visibleRows * trackHeight / this.totalRows) : trackHeight);
        this.thumbPosition = overflow ? Math.trunc((trackHeight - this.thumbLength) * this.firstRow / (this.totalRows - this.visibleRows)) : 0;
        this.thumb.hidden = !overflow;
        this.layer.place(this.thumb, this.width - 15, 15 + this.thumbPosition, 15, this.thumbLength);
        this.layer.place(this.thumbBottom, 0, this.thumbLength - 8);
        this.layer.place(this.thumbCenter, 0, 8, 15, Math.max(0, this.thumbLength - 16));
        this.layer.setTile(this.thumbCenter, 15, Math.max(0, this.thumbLength - 16), 0, 0, 15, 8, arrScrollTextures[5]);
    }

    protected createArrow(y: number, direction: number) {
        const index = direction < 0 ? 0 : 2, button = this.layer.tile(this.element, this.width - 15, y, 15, 15, 0, 0, 15, 15, arrScrollTextures[index]);
        const paint = () => this.layer.setTile(button, 15, 15, 0, 0, 15, 15, arrScrollTextures[index + (this.repeatDirection === direction && this.isRepeatPressed ? 1 : 0)]);

        button.style.pointerEvents = "auto";
        button.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2) return;

            event.preventDefault();
            event.stopPropagation();
            this.repeatDirection = direction;
            this.repeatElapsed = 0;
            this.isRepeatPressed = true;
            this.layer.getManager().playButtonSound(true);
            this.setFirstRow(this.firstRow + direction);
            paint();
            this.layer.beginDrag(move => {
                const rect = button.getBoundingClientRect();

                this.isRepeatPressed = move.clientX >= rect.left && move.clientX <= rect.right && move.clientY >= rect.top && move.clientY <= rect.bottom;
                paint();
            }, () => {
                this.repeatDirection = 0;
                this.isRepeatPressed = false;
                paint();
            });
        });
    }

    protected beginThumbDrag(event: MouseEvent) {
        if (event.button !== 0 || event.detail === 2 || this.totalRows <= this.visibleRows) return;

        event.preventDefault();
        event.stopPropagation();
        const startY = this.layer.toUI(event.clientY), startPosition = this.thumbPosition;

        this.layer.beginDrag(move => {
            const travel = Math.max(Math.trunc(this.height) - 30, 0) - this.thumbLength;

            const desired = Math.trunc(startPosition + this.layer.toUI(move.clientY) - startY), delta = desired - this.thumbPosition;
            let position = this.thumbPosition;

            if (delta > 0 && position < travel) position = Math.min(desired, travel);
            else if (delta < 0 && position > 0) position = Math.max(desired, 0);
            else return;

            this.thumbPosition = position;
            this.firstRow = Math.trunc((this.totalRows - this.visibleRows) * position / travel);
            this.layer.place(this.thumb, this.width - 15, 15 + position);
            this.paint();
        });
    }

    public tick(deltaSeconds: number) {
        const delta = Math.fround(deltaSeconds), blinkPeriod = 500 * Math.fround(0.001), blinkElapsed = this.blinkElapsed + delta;

        this.blinkElapsed = Math.fround(blinkElapsed);
        if (blinkElapsed > blinkPeriod) {
            this.blinkElapsed = Math.fround(blinkElapsed - blinkPeriod);
            this.isCaretVisible = !this.isCaretVisible;
            if (document.activeElement === this.input) this.paint();
        }
        if (!this.repeatDirection) return;

        const repeatPeriod = 200 * Math.fround(0.001), repeatElapsed = this.repeatElapsed + delta;

        this.repeatElapsed = Math.fround(repeatElapsed);
        if (repeatElapsed > repeatPeriod) {
            this.repeatElapsed = Math.fround(repeatElapsed - repeatPeriod);
            if (this.isRepeatPressed) this.setFirstRow(this.firstRow + this.repeatDirection);
        }
    }
}

export default CHtmlMultiEdit;
