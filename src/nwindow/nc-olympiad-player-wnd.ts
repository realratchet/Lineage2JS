import NCFrameCtrl from "./nc-frame-ctrl";
import type NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";
import type { OlympiadUserInfo_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.SmallWnd.SmallWindow_Back";
const TEX_EXPANDED = "L2UI_CH3.SmallWnd.SmallWindow3_Back";
const TEX_STRIP = "L2UI_CH3.FrameCtrl.smallbar";
const TEX_CP = "L2UI_CH3.SmallWnd.CpBar";
const TEX_HP = "L2UI_CH3.SmallWnd.HpBar";
const TEX_CP_BACK = "L2UI_CH3.SmallWnd.CpBar_back";
const TEX_HP_BACK = "L2UI_CH3.SmallWnd.HpBar_back";
const TEX_INFO = "L2UI_CH3.TargetWnd.Target_InfoButton";
const TEX_INFO_DOWN = "L2UI_CH3.TargetWnd.Target_InfoButton_Down";
const WIDTH = 348;

function getBarWidth(current: number, maximum: number, width: number) { return maximum ? Math.trunc(Math.imul(current, width) / maximum) : 0; }

export class NCOlympiadPlayerWnd {
    public static getTextures(): string[] { return [1, 2, 3].flatMap(index => [`${TEX_BACK}${index}`, `${TEX_EXPANDED}${index}`, `${TEX_STRIP}${index}`]).concat([TEX_CP, TEX_HP, TEX_CP_BACK, TEX_HP_BACK, TEX_INFO, TEX_INFO_DOWN]); }

    public readonly element: HTMLDivElement;
    protected readonly arrBack: HTMLDivElement[];
    protected readonly arrStrip: HTMLDivElement[];
    protected readonly cpBar: HTMLDivElement;
    protected readonly hpBar: HTMLDivElement;
    protected readonly name: HTMLDivElement;
    protected readonly lines: HTMLDivElement;
    protected readonly grip: HTMLDivElement;
    protected readonly infoButton: NDomButton_T;
    protected info: OlympiadUserInfo_T = null;
    protected readonly messages: string[] = ["", "", "", "", ""];
    protected messageIndex = 0;
    protected isExpanded = false;
    protected readonly side: number;

    public onExpand: (delta: number) => void = null;

    public constructor(protected readonly layer: NDomLayer, side: number) {
        this.side = side;
        this.element = layer.createWindow(0, 0, WIDTH, 46);
        this.element.hidden = true;
        this.arrBack = [layer.tile(this.element, 12, 0, 16, 46, 0, 0, 16, 46, `${TEX_BACK}1`), layer.tile(this.element, 28, 0, WIDTH - 44, 46, 0, 0, 16, 46, `${TEX_BACK}2`), layer.tile(this.element, WIDTH - 16, 0, 16, 46, 0, 0, 16, 46, `${TEX_BACK}3`)];
        this.arrStrip = [layer.tile(this.element, 0, 0, 12, 8, 0, 0, 12, 8, `${TEX_STRIP}1`), layer.tile(this.element, 0, 8, 12, 38, 0, 0, 12, 8, `${TEX_STRIP}2`), layer.tile(this.element, 0, 38, 12, 8, 0, 0, 12, 8, `${TEX_STRIP}3`)];
        layer.tile(this.element, 16, 26, WIDTH - 22, 6, 0, 0, 8, 6, TEX_CP_BACK);
        layer.tile(this.element, 16, 33, WIDTH - 22, 6, 0, 0, 8, 6, TEX_HP_BACK);
        this.cpBar = layer.tile(this.element, 16, 26, 0, 6, 0, 0, 8, 6, TEX_CP);
        this.hpBar = layer.tile(this.element, 16, 33, 0, 6, 0, 0, 8, 6, TEX_HP);
        this.name = layer.text(this.element, "", 0xffdcdcdc, undefined, 25, 6);
        this.lines = layer.createWindow(0, 0, WIDTH, 126, this.element);
        this.lines.style.pointerEvents = "none";
        this.grip = NCFrameCtrl.createGrip(layer, this.element, 0, 0, 12, 46);
        this.infoButton = layer.button(this.element, 1, 6, 11, 13, TEX_INFO, TEX_INFO, TEX_INFO, null, () => this.toggleExpanded());
        this.update();
    }

    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }
    public getObjectId() { return this.info ? this.info.objectId : -1; }
    public getInfo() { return this.info; }
    public getMessages() { return this.messages; }
    public getExpanded() { return this.isExpanded; }
    public placeOnScreen(width: number) { this.layer.place(this.element, this.side === 1 ? 0 : Math.trunc(width - WIDTH), 0); }
    public setInfo(info: OlympiadUserInfo_T) { this.info = info; this.update(); }

    public reset() {
        this.info = null;
        this.messages.fill("");
        this.messageIndex = 0;
        this.update();
    }

    public appendMessage(message: string) {
        this.messages[this.messageIndex] = message;
        this.messageIndex = (this.messageIndex + 1) % 5;
        this.update();
    }

    protected toggleExpanded() {
        const texture = this.isExpanded ? TEX_INFO : TEX_INFO_DOWN;

        this.isExpanded = !this.isExpanded;
        this.infoButton.setTextures(texture, texture, texture);

        if (this.onExpand) this.onExpand(this.isExpanded ? 80 : -80);

        this.update();
    }

    protected update() {
        const height = this.isExpanded ? 126 : 46, texture = this.isExpanded ? TEX_EXPANDED : TEX_BACK, info = this.info, layer = this.layer;

        this.element.style.height = `${height}px`;
        layer.place(this.grip, 0, 0, 12, height);
        layer.placeTile(this.arrBack[0], 12, 0, 16, height, 0, 0, 16, height, `${texture}1`);
        layer.placeTile(this.arrBack[1], 28, 0, WIDTH - 44, height, 0, 0, 16, height, `${texture}2`);
        layer.placeTile(this.arrBack[2], WIDTH - 16, 0, 16, height, 0, 0, 16, height, `${texture}3`);
        layer.placeTile(this.arrStrip[1], 0, 8, 12, height - 8, 0, 0, 12, 8, `${TEX_STRIP}2`);
        layer.placeTile(this.arrStrip[2], 0, height - 8, 12, 8, 0, 0, 12, 8, `${TEX_STRIP}3`);
        layer.placeTile(this.cpBar, 16, 26, info && info.maxCp ? getBarWidth(info.curCp, info.maxCp, WIDTH - 22) : 0, 6, 0, 0, 8, 6, TEX_CP);
        layer.placeTile(this.hpBar, 16, 33, info && info.maxHp ? getBarWidth(info.curHp, info.maxHp, WIDTH - 22) : 0, 6, 0, 0, 8, 6, TEX_HP);
        layer.renderText(this.name, info ? info.name : "", 0xffdcdcdc);
        this.lines.replaceChildren();

        if (this.isExpanded)
            for (let i = 0; i < 5; i++) {
                const message = this.messages[(this.messageIndex + i) % 5];

                if (message) layer.text(this.lines, message, 0xffdcdcdc, undefined, 18, (i + 3) * 15);
            }
    }
}

export default NCOlympiadPlayerWnd;
