import { FontType_T } from "./nwindow-canvas";
import type { NDomLayer, NDomButton_T } from "./ndom";
import { SKIN_SLOTS } from "./skin-textures";

const TEXT_COLOR = 0xffdcdcdc;
const COMBO_ROW = 17;
const TEX_TEXTBOX1 = "L2UI_CH3.Etc.textbox1";
const TEX_TEXTBOX2 = "L2UI_CH3.Etc.textbox2";
const TEX_TEXTBOX3 = "L2UI_CH3.Etc.textbox3";
const TEX_TEXTSELECT = SKIN_SLOTS.listSelect;
const TEX_TEXTSELECT2 = SKIN_SLOTS.listSelectEnd;
const TEX_DOWNBUTTON = "L2UI_CH3.Button.downbutton";
const TEX_DOWNBUTTON_DOWN = "L2UI_CH3.Button.downbutton_down";

export class NCComboBox { // NCComboBox OnCreate 0x100064d0, OnPaint 0x10005e40; the list drops below the box in 17px rows.
    public static getTextures(): string[] { return [TEX_TEXTBOX1, TEX_TEXTBOX2, TEX_TEXTBOX3, TEX_TEXTSELECT, TEX_TEXTSELECT2, TEX_DOWNBUTTON, TEX_DOWNBUTTON_DOWN, `?${TEX_DOWNBUTTON}_over`]; }
    public readonly element: HTMLDivElement;
    public onChange: (index: number) => void = null;
    protected readonly layer: NDomLayer;
    protected readonly caption: HTMLDivElement;
    protected readonly button: NDomButton_T;
    protected readonly list: HTMLDivElement;
    protected readonly width: number;
    protected readonly height: number;
    protected items: string[] = [];
    protected selected = -1;
    protected readonly onOutside = (event: MouseEvent) => { if (!this.element.contains(event.target as Node)) this.setOpen(false); };

    public constructor(layer: NDomLayer, parent: HTMLElement, x: number, y: number, width: number, height: number) {
        const top = Math.trunc(height * 0.5 - (COMBO_ROW >> 1));

        this.layer = layer;
        this.width = width;
        this.height = height;
        this.element = layer.createWindow(x, y, width, height, parent);

        layer.tile(this.element, 0, top, 8, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX1);
        layer.tile(this.element, 8, top, width - 16, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX2);
        layer.tile(this.element, width - 8, top, 8, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX3);
        this.caption = layer.text(this.element, "", TEXT_COLOR, FontType_T.SMALL, 5, this.getTextY());
        this.caption.hidden = true;
        this.button = layer.button(this.element, Math.trunc(width - 15 - 1), Math.trunc(height * 0.5 - 7), 15, 15, TEX_DOWNBUTTON, TEX_DOWNBUTTON_DOWN, null, null, () => this.setOpen(this.list.hidden));
        this.list = layer.createWindow(0, height, width, 0, this.element);
        this.list.hidden = true;

        this.element.addEventListener("mousedown", event => { // slot68 0x10005c60: a press on the closed box opens the list
            if (event.button !== 0 || this.list.contains(event.target as Node) || this.button.contains(event.target as Node)) return;
            if (this.list.hidden) this.setOpen(true);
        });
    }

    protected getTextY() { return (COMBO_ROW >> 1) - (this.layer.getManager().canvas.getLineHeight() >> 1); }

    public setItems(items: string[]) {
        this.items = items;
        this.list.replaceChildren();
        this.layer.place(this.list, 0, this.height, this.width, items.length * COMBO_ROW);

        items.forEach((item, index) => {
            const row = this.layer.createWindow(0, index * COMBO_ROW, this.width, COMBO_ROW, this.list);

            this.layer.tile(row, 0, 0, 8, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX1);
            this.layer.tile(row, 8, 0, this.width - 16, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX2);
            this.layer.tile(row, this.width - 8, 0, 8, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX3);

            const highlight = [this.layer.tile(row, 1, 0, this.width - 32, 16, 0, 0, 16, 13, TEX_TEXTSELECT), this.layer.tile(row, this.width - 31, 0, 32, 16, 0, 0, 32, 13, TEX_TEXTSELECT2)];

            for (const element of highlight) element.hidden = true;

            this.layer.text(row, item, TEXT_COLOR, FontType_T.SMALL, 5, this.getTextY());
            row.addEventListener("mouseenter", () => { for (const element of highlight) element.hidden = false; });
            row.addEventListener("mouseleave", () => { for (const element of highlight) element.hidden = true; });
            row.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                this.layer.getManager().playButtonSound(true);
                this.setSelected(index);
                this.setOpen(false);

                if (this.onChange) this.onChange(index);
            });
        });

        this.setSelected(-1);
    }

    public setSelected(index: number) {
        this.selected = index;
        this.caption.hidden = index < 0 || index >= this.items.length;

        if (!this.caption.hidden) this.layer.renderText(this.caption, this.items[index], TEXT_COLOR);
    }

    public getSelected() { return this.selected; }
    public isOpen() { return !this.list.hidden; }

    public setOpen(isOpen: boolean) {
        this.list.hidden = !isOpen || this.items.length === 0;
        this.element.style.zIndex = this.list.hidden ? "" : "1";

        if (this.list.hidden) window.removeEventListener("mousedown", this.onOutside, true);
        else window.addEventListener("mousedown", this.onOutside, true);
    }
}

export default NCComboBox;
