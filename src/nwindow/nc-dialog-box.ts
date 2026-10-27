import NDomLayer, { NDomButton_T, NDomEdit_T, NDOM_EDIT_TEXTURES } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import { SKIN_SLOTS } from "./skin-textures";
import SystemMessage_T from "./system-message";
import SysString_T from "./sys-string";

const TEXT_COLOR = 0xffdcdcdc;
const TEXT_X = 41;
const TEXT_Y = 16;
const WRAP_WIDTH = 200;
const TEX_BACK = "L2UI_ch3.dialog.system_back";
const TEX_ICON = "L2UI_ch3.dialog.warningicon";
const TEX_BUTTON = SKIN_SLOTS.button;
const TEX_BUTTON_DOWN = SKIN_SLOTS.buttonDown;
const TEX_KEYPAD = "L2UI_ch3.Calculate.Calculate1_back";
const TEX_TIME = "L2UI_ch3.dialog.minibar_time1";
const TEX_TIME_BACK = "L2UI_ch3.dialog.minibar_back";
const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "bs", "all", "c"];

export enum DialogType_T { OK, OK_CANCEL, YES_NO } // No enum in the binary: console 0x10072e73 picks the OK/Cancel or Yes/No instance, OK-only comes from the dialog id.

export class NCDialogBox { // NCGaraDialogBox (vtable 0x101a11a0): OnCreate 0x100090f0, paint 0x100086a0, layout 0x100089d0.
    public static getTextures(): string[] { return [TEX_BACK, TEX_ICON, TEX_BUTTON, TEX_BUTTON_DOWN, `?${TEX_BUTTON}_over`, TEX_KEYPAD, TEX_TIME, TEX_TIME_BACK, ...NDOM_EDIT_TEXTURES, ...KEYPAD_KEYS.flatMap(key => [`L2UI_CH3.Calculate.Calculate1_${key}`, `L2UI_CH3.Calculate.Calculate1_${key}_down`])]; }

    public readonly element: HTMLDivElement;
    public isInGame = false;
    public owner: HTMLElement = null;

    protected readonly layer: NDomLayer;
    protected readonly textBox: HTMLDivElement;
    protected readonly okButton: NDomButton_T;
    protected readonly cancelButton: NDomButton_T;
    protected readonly background: HTMLDivElement;
    protected readonly keypad: HTMLDivElement;
    protected readonly quantityEditor: NDomEdit_T;
    public readonly textEditor: NDomEdit_T;
    protected onTextResult: (value: string) => boolean = null;
    protected readonly timer: HTMLDivElement;
    protected readonly timerFill: HTMLDivElement;
    protected timerFrame = 0;
    protected timerDuration = 0;
    protected timerElapsed = 0;
    protected isQuantity = false;
    protected quantityAllCount = 0;
    protected type = DialogType_T.OK_CANCEL;
    protected cancelOnReplace = true;
    protected onResult: (isOk: boolean, value?: string) => void = null;
    protected screenWidth = 0;
    protected screenHeight = 0;

    public constructor(layer: NDomLayer) {

        this.layer = layer;
        this.element = layer.createWindow(0, 0, 256, 108);
        this.element.tabIndex = -1;
        this.element.hidden = true;

        this.background = layer.tile(this.element, 0, 0, 256, 108, 0, 0, 256, 108, TEX_BACK);
        layer.tile(this.element, 11, 15, 24, 24, 0, 0, 24, 24, TEX_ICON);

        this.textBox = layer.createWindow(TEXT_X, TEXT_Y, 256 - TEXT_X, 108 - TEXT_Y, this.element);
        this.textBox.style.overflow = "hidden";

        this.timer = layer.tile(this.element, 17, 61, 222, 6, 0, 0, 222, 6, TEX_TIME_BACK);
        this.timerFill = layer.tile(this.timer, 1, 1, 220, 4, 0, 0, 222, 6, TEX_TIME);
        this.timer.hidden = true;
        this.timer.setAttribute("role", "progressbar");
        this.timer.setAttribute("aria-label", "Invitation time remaining");
        this.timer.setAttribute("aria-valuemin", "0");

        this.okButton = layer.button(this.element, 51, 75, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, null, () => this.close(true));
        this.cancelButton = layer.button(this.element, 131, 75, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, null, () => this.close(false));
        this.quantityEditor = layer.edit(this.element, 50, 48, 156, 17, false, 0, true);
        this.quantityEditor.hidden = true;
        this.textEditor = layer.edit(this.element, 50, 48, 156, 17, false, 150);
        this.textEditor.hidden = true;
        this.element.focus = () => this.focus();
        this.keypad = layer.createWindow(256, 0, 108, 108);
        this.element.appendChild(this.keypad);
        this.keypad.hidden = true;
        layer.tile(this.keypad, 0, 0, 108, 108, 0, 0, 108, 108, TEX_KEYPAD);

        KEYPAD_KEYS.forEach((key, index) => {
            const x = index < 9 ? 7 + index % 3 * 25 : index === 9 ? 7 : index === 11 ? 32 : 82;
            const y = index < 9 ? 7 + Math.trunc(index / 3) * 25 : index === 10 ? 7 : index === 12 ? 57 : 82;
            const texture = `L2UI_CH3.Calculate.Calculate1_${key}`;

            const button = layer.button(this.keypad, x, y, index === 11 ? 47 : 23, index === 10 || index === 12 ? 47 : 23, texture, `${texture}_down`, null, null, () => {
                const editor = this.quantityEditor, input = editor.input;

                if (key === "all") editor.setValue(String(this.quantityAllCount));
                else if (key === "c") editor.setValue("0");
                else if (key === "bs") input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));
                else editor.appendValue(key);
            });
            button.addEventListener("mousedown", event => event.preventDefault());
        });

        this.element.addEventListener("keydown", event => this.onKeyDown(event));
    }

    protected onKeyDown(event: KeyboardEvent) { // OnKeyDown 0x10007c70 accepts input and kinds16/29/31.
        if (event.key !== "Enter") return;

        event.preventDefault();
        this.close(this.isQuantity || !this.textEditor.hidden || this.type === DialogType_T.OK);
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) { // Game Yes/No 0x10061a93: (347, H-110); lobby 0x1009d0f5: (W/2-101, H/2-44).
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;

        if (this.type === DialogType_T.YES_NO && this.isInGame)
            this.layer.place(this.element, 347, screenHeight - 110);
        else if (this.type === DialogType_T.YES_NO)
            this.layer.place(this.element, Math.trunc(screenWidth * 0.5 - 101), Math.trunc(screenHeight * 0.5 - 44));
        else
            this.layer.place(this.element, Math.trunc(screenWidth * 0.5 - 128), Math.trunc(screenHeight * 0.5 - 54));
    }

    public show(text: string, type: DialogType_T, onResult: (isOk: boolean, value?: string) => void, cancelOnReplace = true, timerDuration = 0, messageId = 0, isModal = false) {
        const manager = this.layer.getManager();

        if (this.isOpen()) {
            if (this.cancelOnReplace) this.close(false);
            else this.hide();
        }

        this.type = type;
        this.owner = null;
        this.isQuantity = false;
        this.textEditor.hidden = true;
        this.onTextResult = null;
        this.quantityEditor.hidden = this.keypad.hidden = true;
        this.element.style.width = "256px";
        this.layer.place(this.background, 0, 0, 256, 108);
        this.layer.setTile(this.background, 256, 108, 0, 0, 256, 108, TEX_BACK);
        this.onResult = onResult;
        this.cancelOnReplace = cancelOnReplace;

        switch (type) {
            case DialogType_T.OK:
                this.okButton.setLabel(manager.getSysString(SysString_T.OK));
                this.layer.place(this.okButton, 90, 75);
                this.cancelButton.hidden = true;
                break;
            case DialogType_T.OK_CANCEL:
                this.okButton.setLabel(manager.getSysString(SysString_T.OK));
                this.cancelButton.setLabel(manager.getSysString(SysString_T.Cancel));
                this.layer.place(this.okButton, 51, 75);
                this.cancelButton.hidden = false;
                break;
            case DialogType_T.YES_NO:
                this.okButton.setLabel(manager.getSysString(SysString_T.Yes));
                this.cancelButton.setLabel(manager.getSysString(SysString_T.No));
                this.layer.place(this.okButton, 51, 75);
                this.cancelButton.hidden = false;
                break;
            default: throw new Error(`Unknown dialog type '${type}'.`);
        }

        this.element.hidden = false;
        this.layer.setModal(this.element, isModal);
        if (messageId) manager.playSystemMessageSound(messageId); // NCGaraDialogBox::Show 0x100095c0 submits item_sound, then sys_msg_ref.
        this.renderText(text.split("\\n").join("\r\n"));
        this.placeOnScreen(this.screenWidth, this.screenHeight);
        this.element.focus();
        this.timer.hidden = timerDuration === 0;
        this.timerDuration = timerDuration;
        this.timerElapsed = 0;

        if (timerDuration) {
            this.timer.setAttribute("aria-valuemax", String(timerDuration));
            this.advanceTimer(0);
            let previous = performance.now();
            const tick = (now: number) => {
                this.advanceTimer(Math.trunc(now - previous));
                previous = now;
                if (this.isOpen() && this.timerElapsed < this.timerDuration) this.timerFrame = requestAnimationFrame(tick);
            };

            this.timerFrame = requestAnimationFrame(tick);
        }
    }

    public showQuantity(text: string, allCount: number, consumeType: number, onResult: (count: number, value?: string) => void, onError: (messageId: number) => void, isOverride = false, messageId = 0) {
        this.show(text, DialogType_T.OK_CANCEL, (isOk, value) => {
            if (!isOk) return;

            const count = value ? Number(value) : 1;

            if ((isOverride || consumeType === 3) && count > 2e9) { onError(SystemMessage_T.MaximumExceeded); return; }
            if (!isOverride && consumeType === 2 && count > 1e6) { onError(SystemMessage_T.TransferQuantityExceeded); return; }

            onResult(count, value);
        }, true, 0, messageId);
        this.isQuantity = true;
        this.quantityAllCount = allCount;
        this.element.style.width = "364px";
        this.layer.place(this.background, 0, 0, 364, 108);
        this.layer.setTile(this.background, 364, 108, 0, 0, 364, 108, TEX_BACK);
        this.quantityEditor.hidden = this.keypad.hidden = false;
        this.quantityEditor.setValue("");
        this.quantityEditor.focus();
    }

    public showText(text: string, onResult: (value: string) => boolean, value = "", widthLimit = 0, messageId = 0) {
        this.show(text, DialogType_T.OK_CANCEL, null, true, 0, messageId);
        this.onTextResult = onResult;
        this.textEditor.hidden = false;
        this.textEditor.setWidthLimit(widthLimit);
        this.textEditor.setValue(value);
        this.textEditor.focus();
    }

    public hide() {
        cancelAnimationFrame(this.timerFrame);
        this.timerFrame = 0;
        this.timer.hidden = true;
        this.element.hidden = true;
        if (this.layer.getModalWindows().includes(this.element)) this.layer.setModal(this.element, false);
        this.owner = null;
        this.onResult = null;
        this.onTextResult = null;
    }

    public isOpen() { return !this.element.hidden; }
    public isYesNo() { return this.type === DialogType_T.YES_NO; }
    public focus() {
        HTMLElement.prototype.focus.call(this.element);
        if (!this.quantityEditor.hidden) this.quantityEditor.focus();
        else if (!this.textEditor.hidden) this.textEditor.focus();
    }

    protected advanceTimer(elapsed: number) { // NCProgressBar::Paint 0x10007120; timer message 501 takes the dialog's No callback without sound.
        this.timerElapsed = Math.min(this.timerDuration, this.timerElapsed + elapsed);
        const width = 220 - Math.trunc(this.timerElapsed * 220 / this.timerDuration);

        this.layer.place(this.timerFill, 1, 1, width, 4);
        this.layer.setTile(this.timerFill, width, 4, 0, 0, 222, 6, TEX_TIME);
        this.timer.setAttribute("aria-valuenow", String(this.timerDuration - this.timerElapsed));
        if (this.timerElapsed === this.timerDuration) this.close(false);
    }

    protected close(isOk: boolean) {
        if (isOk && this.onTextResult && !this.onTextResult(this.textEditor.getValue())) return;

        const onResult = this.onResult;
        const value = this.isQuantity ? this.quantityEditor.getValue() : null;

        this.hide();

        if (onResult) onResult(isOk, value);
    }

    protected renderText(text: string) {
        const nwindow = this.layer.getManager().canvas;
        const lines = nwindow.wrapText(text.replace(/\\n/g, "\n"), WRAP_WIDTH);
        const lineHeight = nwindow.getLineHeight(FontType_T.SMALL);

        this.textBox.replaceChildren();

        for (let i = 0; i < lines.length; i++)
            this.layer.text(this.textBox, lines[i], TEXT_COLOR, FontType_T.SMALL, 0, i * lineHeight);
    }
}

export default NCDialogBox;
