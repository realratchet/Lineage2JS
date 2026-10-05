import NDomLayer, { NDomButton_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";

const TEXT_COLOR = 0xffdcdcdc;
const TEXT_X = 41;
const TEXT_Y = 16;
const WRAP_WIDTH = 200;
const TEX_BACK = "L2UI_ch3.dialog.system_back";
const TEX_ICON = "L2UI_ch3.dialog.warningicon";
const TEX_BUTTON = "L2UI_ch3.button.btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_ch3.button.btn1_normalon";

export enum DialogType_T { OK, OK_CANCEL, YES_NO } // No enum in the binary: console 0x10072e73 picks the OK/Cancel or Yes/No instance, OK-only comes from the dialog id.

function wrapLines(layer: NDomLayer, text: string, width: number): string[] { // DrawNormalText per-glyph wrap (0x10527d0a): break before a glyph past the width, spaces never break.
    const lines: string[] = [];
    let line = "", lineWidth = 0;

    for (const char of text) {
        if (char === "\n") {
            lines.push(line);
            line = "";
            lineWidth = 0;
            continue;
        }

        if (char.charCodeAt(0) < 0x20) continue;

        const advance = layer.measureText(char);

        if (advance === 0) continue;

        if (char !== " " && lineWidth + advance > width) {
            lines.push(line);
            line = "";
            lineWidth = 0;
        }

        line += char;
        lineWidth += advance;
    }

    lines.push(line);

    return lines;
}

export class NCDialogBox { // NCGaraDialogBox (vtable 0x101a11a0): OnCreate 0x100090f0, paint 0x100086a0, layout 0x100089d0.
    public static getTextures(): string[] { return [TEX_BACK, TEX_ICON, TEX_BUTTON, TEX_BUTTON_DOWN, `?${TEX_BUTTON}_over`]; }

    public readonly element: HTMLDivElement;

    protected readonly layer: NDomLayer;
    protected readonly textCanvas: HTMLCanvasElement;
    protected readonly okButton: NDomButton_T;
    protected readonly cancelButton: NDomButton_T;
    protected type = DialogType_T.OK_CANCEL;
    protected cancelOnReplace = true;
    protected onResult: (isOk: boolean) => void = null;
    protected screenWidth = 0;
    protected screenHeight = 0;

    public constructor(layer: NDomLayer) {

        this.layer = layer;
        this.element = layer.createWindow(0, 0, 256, 108);
        this.element.tabIndex = -1;
        this.element.hidden = true;

        layer.tile(this.element, 0, 0, 256, 108, 0, 0, 256, 108, TEX_BACK);
        layer.tile(this.element, 11, 15, 24, 24, 0, 0, 24, 24, TEX_ICON);

        this.textCanvas = document.createElement("canvas");
        this.textCanvas.className = "ndom-text ndom-absolute";
        layer.place(this.textCanvas, TEXT_X, TEXT_Y);
        this.element.appendChild(this.textCanvas);

        this.okButton = layer.button(this.element, 51, 75, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, null, () => this.close(true));
        this.cancelButton = layer.button(this.element, 131, 75, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, null, () => this.close(false));

        this.element.addEventListener("keydown", event => { // OnKeyDown 0x10007c70: Enter confirms only the OK-only ids, two-button boxes take it as Cancel.
            if (event.key !== "Enter") return;

            event.preventDefault();
            this.layer.getManager().playButtonSound(true);
            this.close(this.type === DialogType_T.OK);
        });
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) { // Console OK/Cancel instance 0x100619d0 is centred; the lobby Yes/No instance 0x1009d0f5 sits at W/2-101, H/2-44.
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;

        if (this.type === DialogType_T.YES_NO)
            this.layer.place(this.element, Math.trunc(screenWidth * 0.5 - 101), Math.trunc(screenHeight * 0.5 - 44));
        else
            this.layer.place(this.element, Math.trunc(screenWidth * 0.5 - 128), Math.trunc(screenHeight * 0.5 - 54));
    }

    public show(text: string, type: DialogType_T, onResult: (isOk: boolean) => void, cancelOnReplace = true) {
        const manager = this.layer.getManager();

        if (this.isOpen()) {
            if (this.cancelOnReplace) this.close(false);
            else this.hide();
        }

        this.type = type;
        this.onResult = onResult;
        this.cancelOnReplace = cancelOnReplace;

        switch (type) {
            case DialogType_T.OK:
                this.okButton.setLabel(manager.getSysString(140));
                this.layer.place(this.okButton, 90, 75);
                this.cancelButton.hidden = true;
                break;
            case DialogType_T.OK_CANCEL:
                this.okButton.setLabel(manager.getSysString(140));
                this.cancelButton.setLabel(manager.getSysString(141));
                this.layer.place(this.okButton, 51, 75);
                this.cancelButton.hidden = false;
                break;
            case DialogType_T.YES_NO:
                this.okButton.setLabel(manager.getSysString(184));
                this.cancelButton.setLabel(manager.getSysString(185));
                this.layer.place(this.okButton, 51, 75);
                this.cancelButton.hidden = false;
                break;
            default: throw new Error(`Unknown dialog type '${type}'.`);
        }

        this.renderText(text.split("\\n").join("\r\n"));
        this.placeOnScreen(this.screenWidth, this.screenHeight);
        this.element.hidden = false;
        this.element.focus();
    }

    public hide() {
        this.element.hidden = true;
        this.onResult = null;
    }

    public isOpen() { return !this.element.hidden; }

    protected close(isOk: boolean) {
        const onResult = this.onResult;

        this.hide();

        if (onResult) onResult(isOk);
    }

    protected renderText(text: string) {
        const nwindow = this.layer.getManager().canvas;
        const scale = nwindow.scale;
        const lines = wrapLines(this.layer, text, WRAP_WIDTH);
        const lineHeight = nwindow.getLineHeight(FontType_T.SMALL);
        const width = 256 - TEXT_X, height = 108 - TEXT_Y;

        this.textCanvas.width = Math.round(width * scale);
        this.textCanvas.height = Math.round(height * scale);
        this.textCanvas.style.width = `${width}px`;
        this.textCanvas.style.height = `${height}px`;

        const context = this.textCanvas.getContext("2d");

        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.imageSmoothingEnabled = false;

        for (let i = 0; i < lines.length; i++)
            nwindow.renderText(context, 0, i * lineHeight, TEXT_COLOR, lines[i], FontType_T.SMALL);
    }
}

export default NCDialogBox;
