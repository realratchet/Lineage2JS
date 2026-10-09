import type NWindowCanvas from "../nwindow/nwindow-canvas";
import Nameplate from "./nameplate";

export class ChatBalloon extends Nameplate {
    protected text: string = null;
    protected color = 0;
    protected isChat = false;

    public setText(canvas: NWindowCanvas, text: string, color: number, isChat: boolean) { // UCanvas::DrawChatting 0x10518620: black-tinted 8px caps, stretched middle and tail around SmallFont text, 5px padding.
        if (text === this.text && color === this.color && isChat === this.isChat) return;

        this.text = text;
        this.color = color;
        this.isChat = isChat;

        const prefix = isChat ? "L2UI_ch3.ChatBack.balloon1_" : "L2UI_ch3.ChatBack.balloon2_", boxHeight = isChat ? 19 : 32, tailHeight = isChat ? 25 : 38;
        const lines = text.split("\n"), textWidth = Math.max(...lines.map(line => canvas.measureText(line))), textHeight = lines.length * canvas.getLineHeight();
        const half = Math.trunc(textWidth / 2);

        this.width = textWidth + 10;
        this.height = tailHeight;
        const isResized = this.canvas.width !== this.width || this.canvas.height !== this.height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.center.set(1 - (half + 5) / this.width, 1 - (textHeight + 5) / this.height);

        const context = this.canvas.getContext("2d");

        context.imageSmoothingEnabled = false;
        context.drawImage(canvas.getTintedImage(`${prefix}1`, 0), 0, 0, 8, boxHeight, 0, 0, 8, boxHeight);
        context.drawImage(canvas.getTintedImage(`${prefix}2`, 0), 0, 0, 8, boxHeight, 8, 0, half - 8, boxHeight);
        context.drawImage(canvas.getTintedImage(`${prefix}3`, 0), 0, 0, 8, tailHeight, half, 0, 8, tailHeight);
        context.drawImage(canvas.getTintedImage(`${prefix}2`, 0), 0, 0, 8, boxHeight, half + 8, 0, textWidth - half - 6, boxHeight);
        context.drawImage(canvas.getTintedImage(`${prefix}4`, 0), 0, 0, 8, boxHeight, textWidth + 2, 0, 8, boxHeight);
        canvas.renderText(context, 5, 5, color, text);
        if (isResized) {
            this.material.map.dispose();
            this.material.map = this.createTexture();
        } else this.material.map.needsUpdate = true;
    }
}

export default ChatBalloon;
