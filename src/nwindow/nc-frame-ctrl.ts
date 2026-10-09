import NWnd from "./nwnd";
import type NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { NMouseEvent_T } from "./nwnd";

export class NCFrameCtrl extends NWnd {
    public static getTextures(): string[] { return ["FrameBackLeft", "FrameBackMid", "FrameBackRight", "FrameCloseBtn", "FrameCloseOnBtn", "FrameMiniBtn", "FrameMiniOnBtn"].map(name => `L2UI_CH3.FrameCtrl.${name}`); }

    public static createDOM(layer: NDomLayer, element: HTMLDivElement, width: number, title: string, hasMinimize: boolean = false, onClose: () => void = null, onBeforeClose: () => void = null, onMinimize: () => void = null) {
        const frame = layer.createWindow(0, 0, width, 20, element);

        element.setAttribute("role", "dialog");
        element.setAttribute("aria-label", title);
        layer.tile(frame, 0, 0, 16, 20, 0, 0, 16, 20, "L2UI_CH3.FrameCtrl.FrameBackLeft");
        layer.tile(frame, 16, 0, width - 32, 20, 0, 0, 32, 20, "L2UI_CH3.FrameCtrl.FrameBackMid");
        layer.tile(frame, width - 16, 0, 16, 20, 0, 0, 16, 20, "L2UI_CH3.FrameCtrl.FrameBackRight");
        const caption = layer.text(frame, title, 0xffc8d2dc, FontType_T.SMALL, 20, 5);

        const closeWindow = () => { if (onClose) onClose(); else element.hidden = true; };
        const closeFrame = () => { if (onBeforeClose) onBeforeClose(); layer.getManager().playWindowCloseSound(); closeWindow(); };
        const close = layer.button(frame, width - 23, 3, 15, 15, "L2UI_CH3.FrameCtrl.FrameCloseBtn", "L2UI_CH3.FrameCtrl.FrameCloseOnBtn", null, null, closeFrame);

        if (hasMinimize) { // Minimize (W-40, 3) exists when the parent style has bit 0x2000; it folds the window to its title bar.
            const minimize = layer.button(frame, width - 40, 3, 15, 15, "L2UI_CH3.FrameCtrl.FrameMiniBtn", "L2UI_CH3.FrameCtrl.FrameMiniOnBtn", null, null, () => {
                if (onMinimize) { onMinimize(); return; }
                for (const child of element.children)
                    if (child !== frame) (child as HTMLElement).hidden = !(child as HTMLElement).hidden;
            });

            minimize.setAttribute("aria-label", "Minimize");
        }

        close.tabIndex = 0;
        close.setAttribute("role", "button");
        close.setAttribute("aria-label", "Close");
        close.addEventListener("keydown", event => {
            if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            layer.getManager().playButtonSound(true);
            closeFrame();
        });
        element.addEventListener("keydown", event => { if (event.key === "Escape") closeWindow(); });
        frame.addEventListener("mousedown", event => {
            if (event.button !== 0 || close.contains(event.target as Node)) return;

            event.preventDefault();
            layer.dragWindow(element, event);
        });

        return caption;
    }

    public onMouseDown(event: NMouseEvent_T) {
        if (event.button !== 0) return;

        let root: NWnd = this;

        while (root.parent) root = root.parent;

        this.manager.beginDrag(root, event.x + this.getScreenX(), event.y + this.getScreenY());
    }
}

export default NCFrameCtrl;
