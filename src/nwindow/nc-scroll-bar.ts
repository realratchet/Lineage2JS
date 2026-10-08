import NWnd from "./nwnd";
import NCButton, { NCBUTTON_NO_OVER } from "./nc-button";
import type NWindowCanvas from "./nwindow-canvas";
import type { NMouseEvent_T } from "./nwnd";

const TEX_TOP = "L2UI_CH3.ScrollBar.SliderBarTop";
const TEX_CENTER = "L2UI_CH3.ScrollBar.SliderBarCenter";
const TEX_BOTTOM = "L2UI_CH3.ScrollBar.SliderBarBottom";
const MIN_THUMB = 15;
const REPEAT_PERIOD = 100; // NCPushButton auto-repeat period (0x10003940).

class NCSliderBar extends NWnd { // NCSliderBar (vtable 0x101a6368): thumb only, no track texture.
    public thumbPos = 0;
    public thumbLen = 0;
    protected dragOffsetY = 0;
    protected isDragging = false;
    public readonly owner: NCScrollBar;

    public constructor(owner: NCScrollBar, x: number, y: number, width: number, height: number) {
        super(x, y, width, height);

        this.owner = owner;
    }

    public getTextures(): string[] { return [TEX_TOP, TEX_CENTER, TEX_BOTTOM]; }

    public onPaint(canvas: NWindowCanvas) { // OnPaint 0x1002c360.
        if (this.thumbLen <= 0) return;

        canvas.drawTile(0, this.thumbPos, 15, 8, 0, 0, 15, 8, TEX_TOP);
        canvas.drawTile(0, this.thumbPos + this.thumbLen - 8, 15, 8, 0, 0, 15, 8, TEX_BOTTOM);
        canvas.drawTile(0, this.thumbPos + 8, 15, this.thumbLen - 16, 0, 0, 15, 8, TEX_CENTER);
    }

    public onMouseDown(event: NMouseEvent_T) {
        if (event.button !== 0) return;

        if (this.owner.content > this.owner.view && event.y >= this.thumbPos && event.y <= this.thumbPos + this.thumbLen) {
            this.isDragging = true;
            this.dragOffsetY = event.y - this.thumbPos;
        }
    }

    public onMouseMove(event: NMouseEvent_T) {
        if (!this.isDragging || !this.manager.isPressed(this)) {
            this.isDragging = false;
            return;
        }

        const travel = this.height - this.thumbLen;

        if (travel <= 0) return;

        const position = Math.max(0, Math.min(travel, Math.trunc(event.y - this.dragOffsetY)));

        if (position === this.thumbPos) return;

        this.owner.setPosition(Math.trunc(position * (this.owner.content - this.owner.view) / travel)); // NCSliderBar::OnMouseMove, NWindow RVA 0x2c230: pixel offset, then signed integer division.
        this.thumbPos = position;
        this.invalidate();
    }

    public onMouseUp() { this.isDragging = false; }
}

class NCPushButton extends NCButton {
    protected timer: number = null;

    public onMouseDown(event: NMouseEvent_T) {
        super.onMouseDown(event);

        if (event.button !== 0 || !this.isEnabled) return;

        if (this.onPress) this.onPress();

        this.timer = window.setInterval(() => {
            if (!this.manager.isPressed(this)) return this.stop();
            if (this.manager.isHovered(this) && this.onPress) this.onPress(); // NCPushButton::OnMouseMove/OnTimer, RVAs 0x1940/0x19a0.
        }, REPEAT_PERIOD);
    }

    protected stop() {
        window.clearInterval(this.timer);
        this.timer = null;
    }

    public onMouseUp() { this.stop(); }
    public onClick() { }
    public detach() { this.stop(); super.detach(); }
}

export class NCScrollBar extends NWnd { // NCScrollWnd scrollbar column (0x1002bdc3..0x1002bfdb): up arrow, slider, down arrow, 15 px wide.
    protected readonly slider: NCSliderBar;
    protected readonly upButton: NCPushButton;
    protected readonly downButton: NCPushButton;
    public content = 0;
    public view = 0;
    public position = 0;
    public onScroll: (position: number) => void = null;

    public constructor(x: number, y: number, height: number) {
        super(x, y, 15, height);

        this.upButton = this.addChild(new NCPushButton(0, 0, 15, 15, "L2UI_CH3.ScrollBar.ScrollBarUpBtn", "L2UI_CH3.ScrollBar.ScrollBarUpOnBtn", null, NCBUTTON_NO_OVER));
        this.downButton = this.addChild(new NCPushButton(0, height - 15, 15, 15, "L2UI_CH3.ScrollBar.ScrollBarDownBtn", "L2UI_CH3.ScrollBar.ScrollBarDownOnBtn", null, NCBUTTON_NO_OVER));
        this.slider = this.addChild(new NCSliderBar(this, 0, 15, 15, height - 30));
        this.upButton.onPress = () => this.scrollBy(-1);
        this.downButton.onPress = () => this.scrollBy(1);
    }

    public setHeight(height: number) {
        this.height = height;
        this.downButton.y = height - 15;
        this.slider.height = height - 30;
        this.updateThumb();
    }

    public setRange(content: number, view: number) { // SetRange 0x1002c0a0: thumb = int(view * sliderH / content), min 15; hidden when everything fits.
        if (this.content === content && this.view === view && this.slider.thumbLen > 0) return;

        this.content = content;
        this.view = view;
        this.position = Math.max(0, Math.min(this.position, Math.max(0, content - view)));
        this.updateThumb();
    }

    protected updateThumb() {
        const slider = this.slider;

        if (this.content <= this.view) {
            slider.thumbLen = slider.height;
            slider.isVisible = false;
        } else {
            slider.isVisible = true;
            slider.thumbLen = Math.max(MIN_THUMB, Math.trunc(this.view * slider.height / this.content));
        }

        const travel = slider.height - slider.thumbLen;

        slider.thumbPos = this.content > this.view ? Math.trunc(travel * this.position / (this.content - this.view)) : 0;
        this.invalidate();
    }

    public setPosition(position: number) {
        const clamped = Math.max(0, Math.min(position, Math.max(0, this.content - this.view)));

        if (clamped === this.position) return;

        this.position = clamped;
        this.updateThumb();

        if (this.onScroll) this.onScroll(clamped);
    }

    public scrollBy(delta: number) { this.setPosition(this.position + delta); }
}

export default NCScrollBar;
