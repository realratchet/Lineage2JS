import NWnd, { type NMouseEvent_T } from "./nwnd";

type ResizableStatus_T = NWnd & { resize(delta: number): void };

export class NCStatusSizeCtrl extends NWnd {
    protected grabX = 0;
    protected isSizing = false;

    public constructor(protected readonly status: ResizableStatus_T) { super(status.width - 10, 0, 10, status.height); }

    public onMouseDown(event: NMouseEvent_T) {
        if (event.button !== 0 || event.clickCount > 1) return;

        this.grabX = event.x;
        this.isSizing = true;
    }

    public onMouseMove(event: NMouseEvent_T) {
        if (event.x >= 0 && event.x <= this.width && event.y >= 0 && event.y <= this.height) this.manager.setCursor(this.manager.getCursor(6));
        else if (!this.isSizing) this.manager.setCursor("");

        if (this.isSizing) this.status.resize(Math.trunc(event.x - this.grabX));
    }

    public onMouseLeave() { if (!this.isSizing) this.manager.setCursor(""); }
    public onMouseUp(event: NMouseEvent_T) {
        if (event.button !== 0) return;

        this.isSizing = false;
        if (event.x < 0 || event.x > this.width || event.y < 0 || event.y > this.height) window.addEventListener("mousemove", () => { if (!this.manager.isHovered(this)) this.manager.setCursor(""); }, { capture: true, once: true });
    }
    public onMouseCancel() { this.isSizing = false; this.manager.setCursor(""); }
}

export default NCStatusSizeCtrl;
