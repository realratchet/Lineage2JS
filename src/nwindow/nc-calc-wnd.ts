import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";
import type { NDomEdit_T } from "./ndom";
import { SKIN_SLOTS } from "./skin-textures";

const TEX_BACK = "l2ui_ch3.calculate.calculate2_back";
const TEX_BUTTON = "L2UI_ch3.button.btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_ch3.button.btn1_normalon";
const arrKeys = ["7", "8", "9", "add", "ce", "4", "5", "6", "sub", "c", "1", "2", "3", "mul", "bs", "0", "00", "div", "eq"];
const arrChars = ["7", "8", "9", "+", "", "4", "5", "6", "-", "", "1", "2", "3", "*", "", "0", "00", "/", "="];
const MAX_RESULT = 1.0000000200408773e20;
const WIDTH = 256;
const HEIGHT = 211;

enum CalcOp_T { NONE = -1, ADD, SUB, MUL, DIV }
enum CalcState_T { TYPING, FRESH, OPERATOR, OPERAND }

function format(value: number) { return Object.is(value, -0) ? "-0" : value.toFixed(0); } // %.0f

function apply(left: number, right: number, op: CalcOp_T) { // 0x1011eb90
    switch (op) {
        case CalcOp_T.NONE: return right;
        case CalcOp_T.ADD: return left + right;
        case CalcOp_T.SUB: return left - right;
        case CalcOp_T.MUL: return left * right;
        case CalcOp_T.DIV: return right === 0 ? 0 : left / right;
        default: throw new Error(`Unknown calculator operator ${op}.`);
    }
}

export class NCCalcWnd { // NCCalcWnd: NCConsole 0x100604b5 centred SetWindowRect(256x211), title sys669; OnCreate 0x1011fb90, display char handler 0x1011f640.
    public static getTextures(): string[] { return [TEX_BACK, TEX_BUTTON, TEX_BUTTON_DOWN, SKIN_SLOTS.edit1, SKIN_SLOTS.edit2, SKIN_SLOTS.edit3, ...NCFrameCtrl.getTextures(), ...arrKeys.flatMap(key => [`L2UI_CH3.Calculate.Calculate2_${key}`, `L2UI_CH3.Calculate.Calculate2_${key}_down`])]; }

    public readonly element: HTMLDivElement;
    protected readonly display: NDomEdit_T;
    protected accumulator = 0;
    protected op = CalcOp_T.NONE;
    protected state = CalcState_T.FRESH;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, WIDTH, HEIGHT);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, WIDTH, HEIGHT - 20, 0, 0, WIDTH, HEIGHT - 20, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, WIDTH, manager.getSysString(669), false, () => this.setVisible(false));
        this.display = layer.edit(this.element, 34, 40, 188, 17, false, 0, true);
        this.display.input.addEventListener("beforeinput", event => {
            if (event.inputType !== "insertText" || !event.data) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            for (const char of event.data) this.onChar(char);
        }, true);
        this.display.input.addEventListener("keydown", event => {
            if (event.key !== "Enter") return;

            event.preventDefault();
            this.onChar("=");
        });

        let x = 35, y = 66, width = 35;

        for (let i = 0; i < arrKeys.length; i++) {
            if (i === 0 || i === 5 || i === 10 || i === 15) {
                x = 35;
                if (i) y += 27;
            } else x += width + 4;

            width = i === 16 ? 73 : 35;
            layer.button(this.element, x, y, width, 24, `L2UI_CH3.Calculate.Calculate2_${arrKeys[i]}`, `L2UI_CH3.Calculate.Calculate2_${arrKeys[i]}_down`, null, null, () => this.press(i));
        }

        layer.button(this.element, 91, 182, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(646), () => { // 0x1011f950
            this.reset();
            this.setVisible(false);
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc((width - WIDTH) * 0.5), Math.trunc((height - HEIGHT) * 0.5)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (visible) this.reset();
    }

    public show() { // NConsole 0x10069840, NCCalcWnd::Show 0x1011f970
        this.setVisible(true);
        this.display.focus();
    }

    protected press(index: number) { // 0x1011f140
        switch (arrKeys[index]) {
            case "ce": this.setText("0"); break;
            case "c": this.reset(); break;
            case "bs": this.display.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" })); break;
            default: for (const char of arrChars[index]) this.onChar(char);
        }
    }

    protected getText() { return this.display.getValue(); }
    protected setText(text: string) { this.display.setValue(text); }
    protected getNumber() { const text = this.getText(); return text ? parseFloat(text) || 0 : 0; } // _wtof

    protected reset() { // 0x1011ef80
        this.accumulator = 0;
        this.op = CalcOp_T.NONE;
        this.state = CalcState_T.FRESH;
        this.setText(format(0));
    }

    protected isOverflow(left: number, right: number, op: CalcOp_T, result: number) { // 0x1011efc0: only positive add/multiply results beyond the limit reset the calculator
        if (op !== CalcOp_T.ADD && op !== CalcOp_T.MUL || left <= 0 || right <= 0 || result >= 0 && result <= MAX_RESULT) return false;

        this.reset();

        return true;
    }

    protected setOp(char: string) {
        switch (char) {
            case "*": this.op = CalcOp_T.MUL; break;
            case "+": this.op = CalcOp_T.ADD; break;
            case "-": this.op = CalcOp_T.SUB; break;
            case "/": this.op = CalcOp_T.DIV; break;
        }
    }

    protected onChar(char: string) {
        if (char >= "0" && char <= "9") {
            if ((this.state === CalcState_T.TYPING || this.state === CalcState_T.OPERAND) && this.getText() === "0") {
                if (char === "0") return;
                this.setText("");
            }

            if (this.state === CalcState_T.FRESH) {
                this.setText("");
                this.state = CalcState_T.TYPING;
            } else if (this.state === CalcState_T.OPERATOR) {
                this.accumulator = this.getNumber();
                this.setText("");
                this.state = CalcState_T.OPERAND;
            }

            this.setText(this.getText() + char);
            return;
        }

        if (char !== "*" && char !== "+" && char !== "-" && char !== "/" && char !== "=") return;

        switch (this.state) {
            case CalcState_T.TYPING:
                this.accumulator = this.getNumber();
                break;
            case CalcState_T.OPERAND: {
                const right = this.getNumber(), result = apply(this.accumulator, right, this.op);

                if (this.isOverflow(this.accumulator, right, this.op, result)) { this.setOp(char); return; }

                this.accumulator = right;
                this.setText(format(result));
                break;
            }
            case CalcState_T.OPERATOR: {
                if (char !== "=") { this.setOp(char); return; }

                const left = this.getNumber(), result = apply(left, this.accumulator, this.op);

                if (!this.isOverflow(left, this.accumulator, this.op, result)) this.setText(format(result));
                return;
            }
        }

        this.state = CalcState_T.OPERATOR;
        this.setOp(char);
    }
}

export default NCCalcWnd;
