import NWnd from "./nwnd";
import NCButton, { NCBUTTON_NO_OVER } from "./nc-button";
import NCFrameCtrl from "./nc-frame-ctrl";
import type NWindowCanvas from "./nwindow-canvas";
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

function getBarWidth(current: number, maximum: number, width: number) { return maximum ? Math.trunc(Math.imul(current, width) / maximum) : 0; }

export class NCOlympiadPlayerWnd extends NWnd {
    protected readonly dragStrip: NCFrameCtrl;
    protected readonly infoButton: NCButton;
    protected info: OlympiadUserInfo_T = null;
    protected readonly messages: string[] = ["", "", "", "", ""];
    protected messageIndex = 0;
    protected isExpanded = false;
    protected readonly side: number;

    public onExpand: (delta: number) => void = null;

    public constructor(side: number) {
        super(0, 0, 348, 46);

        this.side = side;
        this.dragStrip = this.addChild(new NCFrameCtrl(0, 0, 12, 46));
        this.infoButton = this.addChild(new NCButton(1, 6, 11, 13, TEX_INFO, TEX_INFO, null, NCBUTTON_NO_OVER));
        this.infoButton.onPress = () => this.toggleExpanded();
        this.isVisible = false;
    }

    public getTextures(): string[] { return [1, 2, 3].flatMap(index => [TEX_BACK + index, TEX_EXPANDED + index, TEX_STRIP + index]).concat([TEX_CP, TEX_HP, TEX_CP_BACK, TEX_HP_BACK, TEX_INFO, TEX_INFO_DOWN]); }
    public getObjectId() { return this.info ? this.info.objectId : -1; }
    public getInfo() { return this.info; }
    public getMessages() { return this.messages; }
    public getExpanded() { return this.isExpanded; }
    public placeOnScreen(width: number) { this.x = this.side === 1 ? 0 : Math.trunc(width - 348); this.y = 0; }
    public setInfo(info: OlympiadUserInfo_T) { this.info = info; this.invalidate(); }

    public reset() {
        this.info = null;
        this.messages.fill("");
        this.messageIndex = 0;
        this.invalidate();
    }

    public appendMessage(message: string) {
        this.messages[this.messageIndex] = message;
        this.messageIndex = (this.messageIndex + 1) % 5;
        this.invalidate();
    }

    protected toggleExpanded() {
        this.isExpanded = !this.isExpanded;
        this.height = this.isExpanded ? 126 : 46;
        this.dragStrip.height = this.height;
        this.infoButton.normalTexture = this.infoButton.downTexture = this.isExpanded ? TEX_INFO_DOWN : TEX_INFO;

        if (this.onExpand) this.onExpand(this.isExpanded ? 80 : -80);

        this.invalidate();
    }

    protected paintBackground(canvas: NWindowCanvas) {
        const height = this.height, texture = this.isExpanded ? TEX_EXPANDED : TEX_BACK;

        canvas.drawTile(12, 0, 16, height, 0, 0, 16, this.isExpanded ? height : 46, texture + "1");
        canvas.drawTile(28, 0, this.width - 44, height, 0, 0, 16, this.isExpanded ? height : 46, texture + "2");
        canvas.drawTile(this.width - 16, 0, 16, height, 0, 0, 16, this.isExpanded ? height : 46, texture + "3");
        canvas.drawTile(0, 0, 12, 8, 0, 0, 12, 8, TEX_STRIP + "1");
        canvas.drawTile(0, 8, 12, height - 8, 0, 0, 12, 8, TEX_STRIP + "2");
        canvas.drawTile(0, height - 8, 12, 8, 0, 0, 12, 8, TEX_STRIP + "3");
    }

    public onPaint(canvas: NWindowCanvas) {
        this.paintBackground(canvas);

        const info = this.info, width = this.width - 22;

        canvas.drawTile(16, 26, width, 6, 0, 0, 8, 6, TEX_CP_BACK);
        canvas.drawTile(16, 33, width, 6, 0, 0, 8, 6, TEX_HP_BACK);

        if (info) {
            if (info.maxCp) canvas.drawTile(16, 26, getBarWidth(info.curCp, info.maxCp, width), 6, 0, 0, 8, 6, TEX_CP);
            if (info.maxHp) canvas.drawTile(16, 33, getBarWidth(info.curHp, info.maxHp, width), 6, 0, 0, 8, 6, TEX_HP);

            canvas.drawText(25, 6, 0xffdcdcdc, info.name);
        }

        if (this.isExpanded)
            for (let i = 0; i < 5; i++) {
                const message = this.messages[(this.messageIndex + i) % 5];

                if (message) canvas.drawText(18, (i + 3) * 15, 0xffdcdcdc, message);
            }
    }
}

export default NCOlympiadPlayerWnd;
