import { Say2_T } from "../network/game-packets";
import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_EDIT_TEXTURES, NDOM_SCROLL_TEXTURES, type NDomButton_T, type NDomEdit_T, type NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import { SKIN_SLOTS } from "./skin-textures";

const TEX_BACK = "L2UI_ch3.PetitionWnd.petition2_back";

type PetitionLine_T = { text: string, color: number, indent: number };

export class NCPetitionWnd {
    public static getTextures() { return [TEX_BACK, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, ...NCFrameCtrl.getTextures(), ...NDOM_EDIT_TEXTURES, ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public readonly input: NDomEdit_T;
    public onSay: (text: string) => void = null;
    public onCancel: () => void = null;
    public onEvaluate: () => void = null;
    public onBegin: () => void = null;
    public onEnd: () => void = null;
    protected readonly chat: NDomScrollPane_T;
    protected readonly evaluate: NDomButton_T;
    protected readonly lines: PetitionLine_T[] = [];

    public constructor(protected readonly layer: NDomLayer, protected readonly isGM = false) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 310, 412);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 310, 392, 0, 0, 310, 392, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 310, manager.getSysString(isGM ? 472 : 470), false, () => this.setVisible(false));
        this.chat = layer.scrollPane(this.element, 8, 37, 294, 312, 17, false, 17);
        this.chat.content.setAttribute("role", "log");
        const setScroll = this.chat.setScroll;

        this.chat.setScroll = (position, isClamped = true) => {
            setScroll(position, isClamped);
            this.chat.content.style.top = "0px";
            this.paintChat();
        };
        this.input = layer.edit(this.element, 7, 357, 296, 17, false, 1024);
        this.input.input.addEventListener("keydown", event => {
            if (event.key !== "Enter" || event.isComposing) return;

            event.preventDefault();
            const text = this.input.getValue();

            if (text.length && this.onSay) this.onSay(text);
            this.input.setValue("");
        });
        layer.button(this.element, 80, 383, 76, 23, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, null, manager.getSysString(isGM ? 474 : 473), () => {
            if (isGM) { if (this.onBegin) this.onBegin(); return; }

            this.evaluate.setEnabled(false);
            if (this.onCancel) this.onCancel();
        });
        this.evaluate = layer.button(this.element, 160, 383, 76, 23, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, null, manager.getSysString(isGM ? 475 : 849), () => {
            const callback = isGM ? this.onEnd : this.onEvaluate;

            if (callback) callback();
        });
        if (!isGM) this.evaluate.setEnabled(false);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, this.isGM ? 0 : 106, Math.trunc(height * 0.5 - (this.isGM ? 252 : 192))); } // NCConsole 0x10082e63; NCConsoleWnd 0x1006062f.
    public setEvaluationEnabled(isEnabled: boolean) { this.evaluate.setEnabled(isEnabled); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;
        if (isVisible) { if (!this.isGM) this.focus(); }
        else { this.input.input.blur(); if (!this.isGM) this.evaluate.setEnabled(false); }
    }

    public focus() { this.layer.activate(this.element); if (this.isGM) this.input.focus(); }

    public reset() {
        this.lines.length = 0;
        this.input.setValue("");
        if (!this.isGM) this.evaluate.setEnabled(false);
        this.chat.setContentHeight(0);
        this.chat.setScroll(0);
    }

    public addChat(name: string, text: string, type: Say2_T) {
        this.addString(`${name}: ${text}`, type === Say2_T.PETITION_PLAYER ? 0xffdcdcdc : 0xff80ffff);
        this.setVisible(true);
    }

    public addString(text: string, color: number) {
        if (!text) return;

        this.layer.getManager().canvas.wrapText(text, 272, 260).forEach((line, index) => {
            this.lines.push({ text: line, color, indent: index ? 12 : 0 });
            if (this.lines.length > 200) this.lines.shift();
        });
        this.chat.setContentHeight(this.lines.length * 17);
        this.chat.setScroll(Math.max(0, this.lines.length - 17) * 17);
    }

    protected paintChat() {
        this.chat.content.replaceChildren();
        const first = Math.trunc(this.chat.getScroll() / 17), canvas = this.layer.getManager().canvas;

        this.lines.slice(first, first + 17).forEach((line, index) => this.layer.text(this.chat.content, line.text, line.color, FontType_T.SMALL, 2 + line.indent, 9 - Math.trunc(canvas.getLineHeight() / 2) + index * 17));
    }
}

export default NCPetitionWnd;
