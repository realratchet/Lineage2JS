import type NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";
import { SKIN_SLOTS } from "./skin-textures";

const TEX_TOP = SKIN_SLOTS.scrollThumbTop;
const TEX_CENTER = SKIN_SLOTS.scrollThumbCenter;
const TEX_BOTTOM = SKIN_SLOTS.scrollThumbBottom;
const MIN_THUMB = 15;
const REPEAT_PERIOD = 100; // NCPushButton auto-repeat period (0x10003940).

export class NCScrollBar { // NCScrollWnd scrollbar column (0x1002bdc3..0x1002bfdb): up arrow, slider, down arrow, 15 px wide.
    public readonly element: HTMLDivElement;
    protected readonly slider: HTMLDivElement;
    protected readonly thumb: HTMLDivElement;
    protected readonly thumbCenter: HTMLDivElement;
    protected readonly thumbBottom: HTMLDivElement;
    protected readonly downButton: NDomButton_T;
    protected height: number;
    protected thumbPos = 0;
    protected thumbLen = 0;
    public content = 0;
    public view = 0;
    public position = 0;
    public onScroll: (position: number) => void = null;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement, x: number, y: number, height: number) {
        this.height = height;
        this.element = layer.createWindow(x, y, 15, height, parent);
        this.createPushButton(0, SKIN_SLOTS.scrollUp, SKIN_SLOTS.scrollUpDown, -1);
        this.downButton = this.createPushButton(height - 15, SKIN_SLOTS.scrollDown, SKIN_SLOTS.scrollDownDown, 1);
        this.slider = layer.createWindow(0, 15, 15, height - 30, this.element); // NCSliderBar (vtable 0x101a6368): thumb only, no track texture.
        this.thumb = layer.createWindow(0, 0, 15, 0, this.slider);
        layer.tile(this.thumb, 0, 0, 15, 8, 0, 0, 15, 8, TEX_TOP);
        this.thumbCenter = layer.tile(this.thumb, 0, 8, 15, 0, 0, 0, 15, 8, TEX_CENTER);
        this.thumbBottom = layer.tile(this.thumb, 0, 0, 15, 8, 0, 0, 15, 8, TEX_BOTTOM);
        this.slider.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();

            const y = layer.toUI(event.clientY - this.slider.getBoundingClientRect().top);

            if (this.content <= this.view || y < this.thumbPos || y > this.thumbPos + this.thumbLen) return;

            const dragOffsetY = y - this.thumbPos;

            layer.beginDrag(move => { // NCSliderBar::OnMouseMove, NWindow RVA 0x2c230: pixel offset, then signed integer division.
                const travel = this.height - 30 - this.thumbLen;

                if (travel <= 0) return;

                const position = Math.max(0, Math.min(travel, Math.trunc(layer.toUI(move.clientY - this.slider.getBoundingClientRect().top) - dragOffsetY)));

                if (position === this.thumbPos) return;

                this.setPosition(Math.trunc(position * (this.content - this.view) / travel));
                this.thumbPos = position;
                this.layoutThumb();
            });
        });
    }

    protected createPushButton(y: number, normal: string, down: string, direction: number) { // NCPushButton::OnMouseMove/OnTimer, RVAs 0x1940/0x19a0.
        const manager = this.layer.getManager();
        let timer: number = null, isHovered = false;
        const button = this.layer.button(this.element, 0, y, 15, 15, normal, down, normal, null, null, isDown => {
            window.clearInterval(timer);
            timer = null;

            if (!isDown) return;

            manager.playButtonSound(true);
            this.scrollBy(direction);
            timer = window.setInterval(() => { if (isHovered) this.scrollBy(direction); }, REPEAT_PERIOD);
        });

        button.addEventListener("mouseenter", () => isHovered = true);
        button.addEventListener("mouseleave", () => isHovered = false);

        return button;
    }

    public setHeight(height: number) {
        this.height = height;
        this.element.style.height = `${height}px`;
        this.layer.place(this.downButton, 0, height - 15);
        this.slider.style.height = `${height - 30}px`;
        this.updateThumb();
    }

    public setRange(content: number, view: number) { // SetRange 0x1002c0a0: thumb = int(view * sliderH / content), min 15; hidden when everything fits.
        if (this.content === content && this.view === view && this.thumbLen > 0) return;

        this.content = content;
        this.view = view;
        this.position = Math.max(0, Math.min(this.position, Math.max(0, content - view)));
        this.updateThumb();
    }

    protected updateThumb() {
        const sliderHeight = this.height - 30;

        this.thumbLen = this.content <= this.view ? sliderHeight : Math.max(MIN_THUMB, Math.trunc(this.view * sliderHeight / this.content));
        this.thumbPos = this.content > this.view ? Math.trunc((sliderHeight - this.thumbLen) * this.position / (this.content - this.view)) : 0;
        this.thumb.hidden = this.content <= this.view;
        this.layoutThumb();
    }

    protected layoutThumb() { // OnPaint 0x1002c360.
        this.layer.place(this.thumb, 0, this.thumbPos, 15, this.thumbLen);
        this.layer.placeTile(this.thumbCenter, 0, 8, 15, this.thumbLen - 16, 0, 0, 15, 8, TEX_CENTER);
        this.layer.place(this.thumbBottom, 0, this.thumbLen - 8);
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
