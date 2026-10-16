import type NDomLayer from "./ndom";
import type { ZoneName_T } from "../assets/decode-worker/decode-protocol";

const TEX_DECO = "L2UI_ch3.PlayerStatusWnd.fontdeco";

export class NCZoneTitleWnd {
    public static getTextures() { return [TEX_DECO]; }
    public readonly element: HTMLDivElement;
    protected readonly canvas = document.createElement("canvas");
    protected readonly context = this.canvas.getContext("2d");
    protected readonly lines = ["", "", ""];
    protected readonly widths = [0, 0, 0];
    protected readonly cacheWidths = new Map<string, number>();
    protected previousZone: ZoneName_T = null;
    protected pendingTitle: string = null;
    protected sampleTime = 0;
    protected changeTime = 0;
    protected elapsed = 0;
    protected alpha = 255;
    protected shadowAlpha = 255;
    protected width = 0;
    protected lineHeight = 0;
    protected ascent = 0;
    protected font = "";

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.createWindow(0, 0, 0, 0);
        this.element.classList.add("ndom-opaque");
        this.element.style.pointerEvents = "none";
        this.element.hidden = true;
        this.element.appendChild(this.canvas);
        const info = layer.getManager().strings.trueFonts.zonetitle;

        if (!info) throw new Error(`Zone title TrueFont is not configured.`);

        this.font = `${info.italic ? "italic " : ""}${info.weight} ${Math.round(info.size * 96 / 72)}px L2ZoneTitle, ${info.name}`;
        this.setFont();
        const metrics = this.context.measureText("A");

        this.ascent = Math.round(metrics.fontBoundingBoxAscent);
        this.lineHeight = this.ascent + Math.round(metrics.fontBoundingBoxDescent);
    }

    protected setFont() {
        this.context.font = this.font;
        this.context.fontKerning = "none";
        this.context.textBaseline = "alphabetic";
    }

    public placeOnScreen(width: number, height: number) {
        this.layer.place(this.element, Math.trunc(width / 2) - Math.trunc(this.width / 2) - 100, Math.trunc(height / 5) - 80);
    }

    public reset() {
        this.previousZone = null;
        this.pendingTitle = null;
        this.sampleTime = this.changeTime = 0;
        this.clear();
    }

    public clear() {
        this.lines.fill("");
        this.elapsed = 0;
        this.element.hidden = true;
    }

    public updateZone(deltaSeconds: number, position: { x: number; y: number; z: number; }, enabled: boolean) {
        if (this.pendingTitle !== null) {
            if (enabled) this.setTitle(this.pendingTitle);
            this.pendingTitle = null;
        }
        this.sampleTime += deltaSeconds;
        this.changeTime += deltaSeconds;

        if (this.sampleTime <= 2) return;

        this.sampleTime = 0;
        const zone = this.layer.getManager().getZoneNameInfo(position.x, position.y, position.z);

        if (!zone || zone === this.previousZone || this.changeTime <= 8) return;

        if (!this.previousZone || zone.name !== this.previousZone.name) this.pendingTitle = zone.name;
        this.previousZone = zone;
        this.changeTime = 0;
    }

    public setTitle(text: string) {
        const lines = text.split("\n", 3);

        this.setFont();
        for (let i = 0; i < 3; i++) {
            this.lines[i] = lines[i] || "";
            this.widths[i] = 0;
            for (let j = 0; j < this.lines[i].length; j++) {
                const char = this.lines[i][j];

                if (!this.cacheWidths.has(char)) this.cacheWidths.set(char, Math.round(this.context.measureText(char).width)); // shortcut: browser advances omit GDI hinting; replace when native glyph metrics are available.
                this.widths[i] += this.cacheWidths.get(char);
            }
        }
        this.width = Math.max(...this.widths);
        this.canvas.width = Math.max(256, this.width + 103);
        this.canvas.height = Math.max(256, 80 + this.lineHeight * 3 + 13);
        this.setFont();
        this.paint();
    }

    public tick(deltaSeconds: number) { // NWindow 0x10121380: replacing a title does not restart its elapsed time.
        if (!this.lines[0]) return;

        if (this.element.hidden) {
            const canvas = this.layer.getManager().canvas;

            this.placeOnScreen(canvas.width, canvas.height);
            this.element.hidden = false;
        }
        this.elapsed += deltaSeconds;

        if (this.elapsed > 8) { this.clear(); return; }

        const alpha = this.alpha, shadowAlpha = this.shadowAlpha;

        if (this.elapsed < 2) {
            this.alpha = Math.trunc(this.elapsed * 127.5);
            this.shadowAlpha = Math.trunc(this.elapsed * 85);
        } else if (this.elapsed > 4) {
            this.alpha = Math.max(0, Math.trunc(255 - (this.elapsed - 4) * 127.5));
            this.shadowAlpha = Math.max(0, Math.trunc(255 - (this.elapsed - 4) * 170));
        }
        if (alpha !== this.alpha || shadowAlpha !== this.shadowAlpha) this.paint();
    }

    protected drawText(text: string, x: number, y: number) {
        for (let i = 0; i < text.length; i++) {
            this.context.fillText(text[i], x, y + this.ascent);
            x += this.cacheWidths.get(text[i]);
        }
    }

    protected paint() {
        const ctx = this.context;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.globalAlpha = this.alpha / 255;
        ctx.drawImage(this.layer.getManager().canvas.getTexture(TEX_DECO), 0, 0, 256, 256);
        for (let i = 0; i < 3; i++) {
            const x = 100 + Math.trunc(this.width / 2) - Math.trunc(this.widths[i] / 2);

            ctx.globalAlpha = this.shadowAlpha / 255;
            ctx.fillStyle = "#000000";
            this.drawText(this.lines[i], x + 3, 80 + i * this.lineHeight + (i === 0 ? 3 : i * 3));
            ctx.globalAlpha = this.alpha / 255;
            ctx.fillStyle = "#f0f0dc";
            this.drawText(this.lines[i], x, 80 + i * this.lineHeight + i * 5);
        }
    }
}

export default NCZoneTitleWnd;
