import type NWindowCanvas from "./nwindow-canvas";
import type NWindowManager from "./nwindow-manager";

export type NMouseEvent_T = { x: number, y: number, button: number, shift: boolean, ctrl: boolean };

export class NWnd {
    public x = 0;
    public y = 0;
    public width = 0;
    public height = 0;
    public isVisible = true;
    public isEnabled = true;
    public parent: NWnd = null;
    public manager: NWindowManager = null;
    public readonly children: NWnd[] = [];

    public constructor(x: number = 0, y: number = 0, width: number = 0, height: number = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    public getTextures(): string[] { return []; }
    public placeOnScreen(_screenWidth: number, _screenHeight: number) { }

    public addChild<T extends NWnd>(child: T): T {
        child.parent = this;
        this.children.push(child);

        if (this.manager) child.attach(this.manager);

        return child;
    }

    public attach(manager: NWindowManager) {
        this.manager = manager;

        for (const child of this.children) child.attach(manager);
    }

    public getScreenX(): number { return this.parent ? this.parent.getScreenX() + this.x : this.x; }
    public getScreenY(): number { return this.parent ? this.parent.getScreenY() + this.y : this.y; }

    public setVisible(isVisible: boolean) {
        this.isVisible = isVisible;
        this.invalidate();
    }

    public invalidate() { if (this.manager) this.manager.invalidate(); }

    public paint(canvas: NWindowCanvas) {
        if (!this.isVisible) return;

        canvas.setOrigin(this.getScreenX(), this.getScreenY());
        this.onPaint(canvas);

        for (const child of this.children) child.paint(canvas);
    }

    public onPaint(_canvas: NWindowCanvas) { }

    public hitTest(x: number, y: number): NWnd {
        if (!this.isVisible || x < 0 || y < 0 || x >= this.width || y >= this.height) return null;

        for (let i = this.children.length - 1; i >= 0; i--) {
            const child = this.children[i];
            const hit = child.hitTest(x - child.x, y - child.y);

            if (hit) return hit;
        }

        return this;
    }

    public onMouseDown(_event: NMouseEvent_T) { }
    public onMouseUp(_event: NMouseEvent_T) { }
    public onMouseMove(_event: NMouseEvent_T) { }
    public onMouseEnter() { }
    public onMouseLeave() { }
    public onClick(_event: NMouseEvent_T) { }
    public onWheel(_delta: number): boolean { return false; }
}

export default NWnd;
