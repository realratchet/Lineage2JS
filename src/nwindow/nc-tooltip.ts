import type NWnd from "./nwnd";
import type NWindowCanvas from "./nwindow-canvas";

const TEXT_COLOR = 0xffdcdcdc;
const TEX_SLICES = Array.from({ length: 9 }, (_, i) => `L2UI_ch3.Tooltip.Tooltip${i + 1}`);

export class NCTooltip { // Tooltip helper owned by every NCWnd ([wnd+0x8c], NCWnd::OnCreate 0x100360d6); nine 8x8 slices.
    public getTextures(): string[] { return TEX_SLICES; }

    public paint(canvas: NWindowCanvas, wnd: NWnd, anchorX: number, anchorY: number, text: string) { // 0x10032560: box above the window-relative anchor, flipped 32 px below it at the top edge, kept on screen horizontally.
        if (!text) return;

        const w = Math.trunc(canvas.measureText(text) + 10), h = Math.trunc(canvas.getLineHeight() + 10);
        const screenX = wnd.getScreenX(), screenY = wnd.getScreenY();
        let x = anchorX, y = anchorY - h;

        if (screenX + w + x > canvas.width) x -= screenX + w + x - canvas.width;
        else if (screenX + x < 0) x = -screenX;

        if (screenY + y < 0) y = anchorY + 32;

        const [tex1, tex2, tex3, tex4, tex5, tex6, tex7, tex8, tex9] = TEX_SLICES;

        canvas.drawTile(x, y, 8, 8, 0, 0, 8, 8, tex1);
        canvas.drawTile(x + 8, y, w - 16, 8, 0, 0, 8, 8, tex2);
        canvas.drawTile(x + w - 8, y, 8, 8, 0, 0, 8, 8, tex3);
        canvas.drawTile(x, y + 8, 8, h - 16, 0, 0, 8, 8, tex4);
        canvas.drawTile(x + 8, y + 8, w - 16, h - 16, 0, 0, 8, 8, tex5);
        canvas.drawTile(x + w - 8, y + 8, 8, h - 16, 0, 0, 8, 8, tex6);
        canvas.drawTile(x, y + h - 8, 8, 8, 0, 0, 8, 8, tex7);
        canvas.drawTile(x + 8, y + h - 8, w - 16, 8, 0, 0, 8, 8, tex8);
        canvas.drawTile(x + w - 8, y + h - 8, 8, 8, 0, 0, 8, 8, tex9);
        canvas.drawText(x + 5, y + 5, TEXT_COLOR, text);
    }
}

export default NCTooltip;
