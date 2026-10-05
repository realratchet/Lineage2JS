import type AssetManager from "../assets/asset-manager";

type UIImage_T = { frames: ImageBitmap[], frameTime: number };
type Glyph_T = { u: number, v: number, w: number, h: number };
type BitmapFont_T = { texture: string, glyphs: Map<number, Glyph_T>, lineHeight: number };

export enum FontType_T { SMALL, LARGE } // Engine.dll FontType: 0 SmallFont-r (all regular UI text), 1 LargeFont-r (nameplates).

export enum DigitFont_T { SMALL, NORMAL, LARGE } // NWindow 0x10013570 canvas digit strips for UCanvas::DrawSpecialDigit (Engine 0x105284e0): texture, cell width, cell height.

const DIGIT_FONTS: [string, number, number][] = [["SEK.cbui13", 5, 5], ["L2UI.NWindow.Number", 8, 8], ["L2UI_CH3.Etc.XLargeNumber", 11, 14]];
const DIGIT_CELLS = "0123456789HMP/%.C:";

const FONT_SOURCES: [FontType_T, string, string][] = [
    [FontType_T.SMALL, "assets/system/smallfont-r.gly", "L2Font-r.SmallFont-r"],
    [FontType_T.LARGE, "assets/system/largefont-r.gly", "L2Font-r.LargeFont-r"]
];

function parseGlyphs(buffer: ArrayBuffer): Map<number, Glyph_T> { // NL2Font::Load 0x10088a50 legacy layout; GetGlyph 0x10088400 takes the first range holding a non-empty rect.
    const view = new DataView(buffer);
    const glyphs = new Map<number, Glyph_T>();
    const rangeCount = view.getUint32(8, true);

    for (let range = 0, offset = 12; range < rangeCount; range++) {
        const first = view.getInt32(offset, true), count = view.getInt32(offset + 4, true);

        offset += 8;

        for (let i = 0; i < count; i++, offset += 16) {
            const u = view.getInt32(offset, true), w = view.getInt32(offset + 4, true), v = view.getInt32(offset + 8, true), h = view.getInt32(offset + 12, true);

            if (w > 0 && h > 0 && !glyphs.has(first + i)) glyphs.set(first + i, { u, v, w, h });
        }
    }

    return glyphs;
}

function cssColor(color: number): string {
    return `rgba(${(color >>> 16) & 0xff}, ${(color >>> 8) & 0xff}, ${color & 0xff}, ${((color >>> 24) & 0xff) / 255})`;
}

export class NWindowCanvas { // Mirrors the two NWindow paint primitives: 0x10012d90 (texture tile) and 0x10012aa0 (text).
    public readonly element = document.createElement("canvas");
    protected readonly context = this.element.getContext("2d");
    protected readonly asset: AssetManager;
    protected readonly textures = new Map<string, UIImage_T>();
    protected readonly pending = new Map<string, Promise<void>>();
    protected readonly fonts = new Map<FontType_T, BitmapFont_T>();
    protected readonly tinted = new Map<string, HTMLCanvasElement>();
    protected originX = 0;
    protected originY = 0;
    public scale = 1;
    public cssScale = 1;
    public width = 0;
    public height = 0;
    public needsRedraw = true;
    public isAnimating = false;

    public constructor(asset: AssetManager) {
        this.asset = asset;
        this.element.className = "nwindow-canvas";
    }

    public resize(width: number, height: number) { // UI pixels map to a whole number of device pixels, bitmap glyphs smear at fractional ratios like 1.5.
        const ratio = window.devicePixelRatio || 1;

        this.scale = Math.max(1, Math.floor(ratio));
        this.cssScale = this.scale / ratio;
        this.width = Math.floor(width / this.cssScale);
        this.height = Math.floor(height / this.cssScale);
        this.element.width = this.width * this.scale;
        this.element.height = this.height * this.scale;
        this.element.style.width = `${this.width * this.cssScale}px`;
        this.element.style.height = `${this.height * this.cssScale}px`;
        this.needsRedraw = true;
    }

    public toUI(client: number) { return Math.floor(client / this.cssScale); }

    public async loadTextures(paths: string[]) {
        const missing = paths.filter(path => {
            const key = path.replace(/^\?/, "").toLowerCase();

            return !this.textures.has(key) && !this.pending.has(key);
        });

        const pending = paths.map(path => this.pending.get(path.replace(/^\?/, "").toLowerCase())).filter(Boolean);

        if (missing.length) {
            const loading = this.loadMissingTextures(missing);

            for (const path of missing) this.pending.set(path.replace(/^\?/, "").toLowerCase(), loading);

            pending.push(loading);
        }

        await Promise.all(pending);
    }

    protected async loadMissingTextures(missing: string[]) {
        const byPackage = new Map<string, string[]>();

        for (const path of missing) {
            const name = path.replace(/^\?/, "").split(".")[0].toLowerCase();

            if (!byPackage.has(name)) byPackage.set(name, []);

            byPackage.get(name).push(path);
        }

        try {
            const decoded = (await Promise.all([...byPackage.values()].map(group => this.asset.decodeUITextures(group)))).flat();

            for (const texture of decoded)
                this.textures.set(texture.path.toLowerCase(), { frames: await Promise.all(texture.frames.map(frame => createImageBitmap(new ImageData(new Uint8ClampedArray(frame), texture.width, texture.height)))), frameTime: texture.frameTime });

            for (const path of missing) {
                const key = path.replace(/^\?/, "").toLowerCase();

                if (!this.textures.has(key)) this.textures.set(key, null);
            }
        } finally {
            for (const path of missing) this.pending.delete(path.replace(/^\?/, "").toLowerCase());
        }

        this.needsRedraw = true;
    }

    public hasTexture(path: string): boolean { return !!this.textures.get(path.toLowerCase()); }

    public getTexture(path: string): ImageBitmap {
        const key = path.toLowerCase();

        if (!this.textures.has(key) && !this.pending.has(key)) throw new Error(`UI texture '${path}' was never loaded.`);

        const image = this.textures.get(key);

        if (!image) return null;
        if (image.frames.length === 1) return image.frames[0];

        this.isAnimating = true;

        return image.frames[Math.floor(performance.now() / image.frameTime) % image.frames.length];
    }

    public beginFrame() {
        const context = this.context;

        context.setTransform(this.scale, 0, 0, this.scale, 0, 0);
        context.clearRect(0, 0, this.width, this.height);
        context.imageSmoothingEnabled = false;
        this.originX = this.originY = 0;
        this.isAnimating = false;
    }

    public setOrigin(x: number, y: number) {
        this.originX = x;
        this.originY = y;
    }

    public drawTile(x: number, y: number, w: number, h: number, u: number, v: number, uw: number, vh: number, path: string, alpha: number = 0xff, color: number = 0xffffff) {
        const texture = color === 0xffffff ? this.getTexture(path) : this.getTintedImage(path, color);

        if (!texture || w <= 0 || h <= 0) return;

        const context = this.context;

        context.globalAlpha = alpha / 255;
        x += this.originX;
        y += this.originY;

        if (u >= 0 && v >= 0 && u + uw <= texture.width && v + vh <= texture.height) {
            context.drawImage(texture, u, v, uw, vh, x, y, w, h);
        } else {
            const stepX = w / uw, stepY = h / vh;

            for (let ty = v; ty < v + vh;) {
                const sy = ((ty % texture.height) + texture.height) % texture.height;
                const sh = Math.min(texture.height - sy, v + vh - ty);

                for (let tx = u; tx < u + uw;) {
                    const sx = ((tx % texture.width) + texture.width) % texture.width;
                    const sw = Math.min(texture.width - sx, u + uw - tx);

                    context.drawImage(texture, sx, sy, sw, sh, x + (tx - u) * stepX, y + (ty - v) * stepY, sw * stepX, sh * stepY);
                    tx += sw;
                }

                ty += sh;
            }
        }

        context.globalAlpha = 1;
    }

    public fillRect(x: number, y: number, w: number, h: number, color: number) {
        this.context.fillStyle = cssColor(color);
        this.context.fillRect(x + this.originX, y + this.originY, w, h);
    }

    public async loadFonts() {
        await this.loadTextures([...FONT_SOURCES.map(([, , texture]) => texture), ...DIGIT_FONTS.map(([texture]) => texture)]);

        for (const [type, gly, texture] of FONT_SOURCES) {
            const glyphs = parseGlyphs(await (await fetch(gly)).arrayBuffer());

            this.fonts.set(type, { texture, glyphs, lineHeight: glyphs.get(0x41).h });
        }
    }

    public getLineHeight(type: FontType_T = FontType_T.SMALL): number { return this.fonts.get(type).lineHeight; }

    public measureText(text: string, type: FontType_T = FontType_T.SMALL): number {
        const font = this.fonts.get(type);
        let width = 0;

        for (let i = 0; i < text.length; i++) {
            const glyph = font.glyphs.get(text.charCodeAt(i));

            if (glyph) width += glyph.w;
        }

        return width;
    }

    public measureDigits(text: string, type: DigitFont_T = DigitFont_T.NORMAL): number {
        let count = 0;

        for (let i = 0; i < text.length; i++)
            if (DIGIT_CELLS.includes(text[i])) count++;

        return count * DIGIT_FONTS[type][1];
    }

    public drawDigits(x: number, y: number, color: number, text: string, type: DigitFont_T = DigitFont_T.NORMAL) {
        this.renderDigits(this.context, x + this.originX, y + this.originY, color, text, type);
    }

    public renderDigits(context: CanvasRenderingContext2D, x: number, y: number, color: number, text: string, type: DigitFont_T = DigitFont_T.NORMAL) {
        const [texture, cellW, cellH] = DIGIT_FONTS[type];
        const atlas = this.getTintedImage(texture, color);
        let penX = Math.trunc(x);
        const penY = Math.trunc(y);

        context.globalAlpha = ((color >>> 24) & 0xff) / 255;

        for (let i = 0; i < text.length; i++) {
            const cell = DIGIT_CELLS.indexOf(text[i]);

            if (cell < 0) continue;

            context.drawImage(atlas, cell * cellW, 0, cellW, cellH, penX, penY, cellW, cellH);
            penX += cellW;
        }

        context.globalAlpha = 1;
    }

    public getTintedImage(path: string, color: number): HTMLCanvasElement {
        const key = `${path.toLowerCase()}:${color & 0xffffff}`;
        let atlas = this.tinted.get(key);

        if (atlas) return atlas;

        const texture = this.getTexture(path);

        atlas = document.createElement("canvas");
        atlas.width = texture.width;
        atlas.height = texture.height;

        const context = atlas.getContext("2d");

        context.drawImage(texture, 0, 0);

        const pixels = context.getImageData(0, 0, atlas.width, atlas.height);
        const data = pixels.data;
        const r = (color >>> 16) & 0xff, g = (color >>> 8) & 0xff, b = color & 0xff;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = data[i] * r / 255;
            data[i + 1] = data[i + 1] * g / 255;
            data[i + 2] = data[i + 2] * b / 255;
        }

        context.putImageData(pixels, 0, 0);
        this.tinted.set(key, atlas);

        return atlas;
    }

    public renderText(context: CanvasRenderingContext2D, x: number, y: number, color: number, text: string, type: FontType_T = FontType_T.SMALL) { // Engine.dll DrawNormalText 0x10527880: one 1:1 quad per glyph, pen advances by the glyph width.
        const font = this.fonts.get(type);
        const atlas = this.getTintedImage(font.texture, color);
        const startX = Math.trunc(x);
        let penX = startX, penY = Math.trunc(y);

        context.globalAlpha = ((color >>> 24) & 0xff) / 255;

        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);

            if (code === 0x0a) {
                penX = startX;
                penY += font.lineHeight;
                continue;
            }

            if (code < 0x20) continue;

            const glyph = font.glyphs.get(code);

            if (!glyph) continue;

            context.drawImage(atlas, glyph.u, glyph.v, glyph.w, glyph.h, penX, penY, glyph.w, glyph.h);
            penX += glyph.w;
        }

        context.globalAlpha = 1;
    }

    public drawText(x: number, y: number, color: number, text: string, type: FontType_T = FontType_T.SMALL) {
        this.renderText(this.context, x + this.originX, y + this.originY, color, text, type);
    }

    public clip(x: number, y: number, w: number, h: number) {
        this.context.save();
        this.context.beginPath();
        this.context.rect(x + this.originX, y + this.originY, w, h);
        this.context.clip();
    }

    public unclip() { this.context.restore(); }
}

export default NWindowCanvas;
