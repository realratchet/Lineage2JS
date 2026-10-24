import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";
import { NDOM_SCROLL_TEXTURES, type NDomEdit_T, type NDomScrollPane_T } from "./ndom";

type ChatLine_T = { text: string, color: number };
const TEX_BACK = "L2UI_CH3.msn_back3";

export class L2ChatWnd {
    public static getTextures() { return [TEX_BACK, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onClose: () => void = null;
    public onSend: (message: string) => void = null;
    protected readonly peerLabel: HTMLDivElement;
    protected readonly history: NDomScrollPane_T;
    protected readonly edit: NDomEdit_T;
    protected readonly arrLines: ChatLine_T[] = [];
    protected peer = "";
    protected isActive = false;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(200 + Math.floor(Math.random() * 200), 150 + Math.floor(Math.random() * 150), 256, 401, layer.consoleRoot);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        this.element.style.overflow = "hidden";
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, layer.getManager().getSysString(997), true, () => { if (this.onClose) this.onClose(); }, null, () => this.setVisible(false));
        this.peerLabel = layer.text(this.element, "", 0xffdcdcdc, undefined, 11, 54);
        this.history = layer.scrollPane(this.element, 9, 96, 238, 252, 18, false, 14);
        this.history.content.setAttribute("role", "log");
        const setScroll = this.history.setScroll;

        this.history.setScroll = (position, isClamped = true) => {
            setScroll(position, isClamped);
            this.history.content.style.top = "0px";
            this.paintHistory();
        };
        this.history.addEventListener("wheel", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.history.setScroll(this.history.getScroll() + Math.trunc(event.deltaY / 120) * 18);
        }, true);
        this.edit = layer.edit(this.element, 8, 360, 239, 16);
        this.edit.input.setAttribute("aria-label", layer.getManager().getSysString(997));
        this.edit.input.addEventListener("keydown", event => {
            if (event.key !== "Enter" || event.isComposing) return;

            event.preventDefault();
            const message = this.edit.getValue();

            if (message && this.onSend) this.onSend(message);
        });
    }

    public getPeer() { return this.peer; }
    public getActive() { return this.isActive; }
    public isVisible() { return !this.element.hidden; }
    public setPeer(peer: string) {
        this.peer = peer;
        this.isActive = true;
        this.layer.renderText(this.peerLabel, peer, 0xffdcdcdc);
    }
    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;
        if (!isVisible && this.element.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    }
    public show() {
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
    }
    public clearEdit() { this.edit.setValue(""); }
    public reset() {
        this.setVisible(false);
        this.isActive = false;
        this.peer = "";
        this.arrLines.length = 0;
        this.clearEdit();
        this.layer.renderText(this.peerLabel, "", 0xffdcdcdc);
        this.history.setContentHeight(0);
        this.history.setScroll(0);
    }

    public addMessage(speaker: string, message: string, color = 0xffdcdcdc) {
        if (speaker) {
            this.addLine(`${speaker}:`, 0xff929292);
            this.addLine(message, 0xffdcdcdc, true);
        } else this.addLine(message, color);
    }

    protected addLine(text: string, color: number, isIndented = false) {
        const canvas = this.layer.getManager().canvas, width = isIndented ? 204 : 216;
        const arrLines: string[] = [];
        let line = "", lineWidth = 0;

        for (let i = 0; i < text.length; i++) {
            const character = text[i], code = text.charCodeAt(i);

            if (!code) break;
            if (code < 0x20 && code !== 0x0a && code !== 0x0d) continue;

            const advance = code < 0x20 ? 0 : canvas.measureText(character);

            if (lineWidth + advance > width) {
                if (!line) break;
                arrLines.push(line);
                line = "";
                lineWidth = 0;
                if (advance > width) break;
            }
            line += character;
            lineWidth += advance;
            if (code === 0x0a) {
                arrLines.push(line);
                line = "";
                lineWidth = 0;
            }
        }
        if (line) arrLines.push(line);
        if (!arrLines.length) return;

        let scroll = this.history.getScroll();

        arrLines.forEach(line => {
            this.arrLines.push({ text: isIndented ? `   ${line}` : line, color });
            if (this.arrLines.length > 200) this.arrLines.shift();
            else if (this.arrLines.length > 14) scroll += 18;
        });
        this.history.setContentHeight(this.arrLines.length * 18);
        this.history.setScroll(scroll);
    }

    protected paintHistory() {
        this.history.content.replaceChildren();
        const first = Math.trunc(this.history.getScroll() / 18);

        this.arrLines.slice(first, first + 14).forEach((line, index) => this.layer.text(this.history.content, line.text, line.color, undefined, 4, 4 + index * 18));
    }
}

export default L2ChatWnd;
