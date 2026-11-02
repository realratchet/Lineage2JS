import type AssetManager from "../assets/asset-manager";
import fetchAsset from "../assets/asset-source";
import { isSkinImageUrl, type SkinTextures } from "./skin-textures";

type UIImage_T = { frames: ImageBitmap[], frameTime: number };
type Glyph_T = { u: number, v: number, w: number, h: number };
type Font_T = { css: string, lineHeight: number, baseline: number, texture?: string, glyphs?: Map<number, Glyph_T> };

declare const BITMAP_NAMEPLATES: boolean;

export enum FontType_T { SMALL, LARGE, BITMAP_LARGE }
export const NAMEPLATE_FONT = BITMAP_NAMEPLATES ? FontType_T.BITMAP_LARGE : FontType_T.LARGE;

export enum DigitFont_T { SMALL, NORMAL, LARGE } // NWindow 0x10013570 canvas digit strips for UCanvas::DrawSpecialDigit (Engine 0x105284e0): texture, cell width, cell height.

export const DIGIT_FONTS: [string, number, number][] = [["SEK.cbui13", 5, 5], ["L2UI.NWindow.Number", 8, 8], ["L2UI_CH3.Etc.XLargeNumber", 11, 14]];
export const DIGIT_CELLS = "0123456789HMP/%.C:";

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

export class NWindowCanvas { // Mirrors the two NWindow paint primitives: 0x10012d90 (texture tile) and 0x10012aa0 (text).
    public readonly element = document.createElement("canvas");
    protected readonly context = this.element.getContext("2d");
    protected readonly asset: AssetManager;
    protected readonly skin: SkinTextures;
    protected readonly textures = new Map<string, UIImage_T>();
    protected readonly pending = new Map<string, Promise<void>>();
    protected readonly fonts = new Map<FontType_T, Font_T>();
    protected readonly textContext = document.createElement("canvas").getContext("2d");
    protected readonly tinted = new Map<string, HTMLCanvasElement>();
    public scale = 1;
    public uiScale = 1;
    public cssScale = 1;
    public width = 0;
    public height = 0;
    public isAnimating = false;

    public constructor(asset: AssetManager, skin: SkinTextures) {
        this.asset = asset;
        this.skin = skin;
        this.element.className = "nwindow-canvas";
    }

    public resize(width: number, height: number) {
        const ratio = window.devicePixelRatio || 1;

        this.scale = ratio * this.uiScale;
        this.cssScale = this.uiScale;
        this.width = Math.floor(width / this.cssScale);
        this.height = Math.floor(height / this.cssScale);
        this.element.width = Math.round(this.width * this.scale);
        this.element.height = Math.round(this.height * this.scale);
        this.element.style.width = `${this.width * this.cssScale}px`;
        this.element.style.height = `${this.height * this.cssScale}px`;
    }

    public getScreenSize(uiScale: number) { return [Math.floor(window.innerWidth / uiScale), Math.floor(window.innerHeight / uiScale)]; }
    public toUI(client: number) { return Math.floor(client / this.cssScale); }

    public getTextureKey(path: string, useIntrinsicAlpha = true) {
        const key = (path[0] === "?" ? path.slice(1) : path).toLowerCase();

        return useIntrinsicAlpha ? key : `${key}:normal`;
    }

    public async loadTextures(paths: string[], useIntrinsicAlpha = true) {
        const missing = paths.filter(path => {
            const key = this.getTextureKey(path, useIntrinsicAlpha);

            return !this.textures.has(key) && !this.pending.has(key);
        });

        const pending = paths.map(path => this.pending.get(this.getTextureKey(path, useIntrinsicAlpha))).filter(Boolean);

        if (missing.length) {
            const loading = this.loadMissingTextures(missing, useIntrinsicAlpha);

            for (const path of missing) this.pending.set(this.getTextureKey(path, useIntrinsicAlpha), loading);

            pending.push(loading);
        }

        await Promise.all(pending);
    }

    protected async loadMissingTextures(missing: string[], useIntrinsicAlpha: boolean) {
        const byPackage = new Map<string, string[]>();
        const keysBySource = new Map<string, string[]>();
        const images: [string, string][] = [];

        for (const path of missing) {
            const key = this.getTextureKey(path, useIntrinsicAlpha), source = this.skin.resolve(path.replace(/^\?/, "").toLowerCase());

            if (isSkinImageUrl(source)) { images.push([key, source]); continue; }

            const name = source.split(".")[0].toLowerCase();

            if (!keysBySource.has(source.toLowerCase())) keysBySource.set(source.toLowerCase(), []);
            if (!byPackage.has(name)) byPackage.set(name, []);

            keysBySource.get(source.toLowerCase()).push(key);
            byPackage.get(name).push(path.startsWith("?") ? `?${source}` : source);
        }

        try {
            const decoded = (await Promise.all([...byPackage.values()].map(group => this.asset.decodeUITextures(group, useIntrinsicAlpha)))).flat();

            for (const texture of decoded) {
                const image = { frames: await Promise.all(texture.frames.map(frame => createImageBitmap(new ImageData(new Uint8ClampedArray(frame), texture.width, texture.height)))), frameTime: texture.frameTime };

                for (const key of keysBySource.get(texture.path.toLowerCase())) this.textures.set(key, image);
            }

            for (const [key, source] of images) {
                const response = await fetchAsset(source);

                if (!response.ok) throw new Error(`Skin image '${source}' for '${key}' failed to load.`);

                this.textures.set(key, { frames: [await createImageBitmap(await response.blob())], frameTime: 0 });
            }

            for (const path of missing) {
                const key = this.getTextureKey(path, useIntrinsicAlpha);

                if (!this.textures.has(key)) this.textures.set(key, null);
            }
        } finally {
            for (const path of missing) this.pending.delete(this.getTextureKey(path, useIntrinsicAlpha));
        }
    }

    public hasTexture(path: string, useIntrinsicAlpha = true): boolean { return !!this.textures.get(this.getTextureKey(path, useIntrinsicAlpha)); }
    public getTextureAnimation(path: string, useIntrinsicAlpha = true): UIImage_T { return this.textures.get(this.getTextureKey(path, useIntrinsicAlpha)); }

    public getTexture(path: string, useIntrinsicAlpha = true): ImageBitmap {
        const key = this.getTextureKey(path, useIntrinsicAlpha);

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
        context.imageSmoothingEnabled = true;
        this.isAnimating = false;
    }

    public drawTile(x: number, y: number, w: number, h: number, u: number, v: number, uw: number, vh: number, path: string, alpha: number = 0xff, color: number = 0xffffff) {
        this.renderTile(this.context, x, y, w, h, u, v, uw, vh, path, alpha, color);
    }

    public renderTile(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number, v: number, uw: number, vh: number, path: string, alpha: number = 0xff, color: number = 0xffffff) {
        const texture = color === 0xffffff ? this.getTexture(path) : this.getTintedImage(path, color);

        if (!texture || w <= 0 || h <= 0) return;

        context.globalAlpha = alpha / 255;

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

    public async loadFonts() {
        const fonts = await document.fonts.load("11px L2Tahoma");

        if (!fonts.length) throw new Error(`Tahoma font face was not registered.`);

        for (const [type, size, lineHeight] of [[FontType_T.SMALL, 11, 13], [FontType_T.LARGE, 12, 14]]) {
            const css = `${size}px L2Tahoma, Tahoma, sans-serif`;

            this.textContext.font = css;
            this.textContext.fontKerning = "none";

            const metrics = this.textContext.measureText("Ag");
            const baseline = (lineHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent;

            this.fonts.set(type, { css, lineHeight, baseline });
        }

        await this.loadTextures(DIGIT_FONTS.map(([texture]) => texture));

        if (BITMAP_NAMEPLATES) {
            const { bitmapFonts } = await this.asset.getGameStrings();
            const { texture, glyph } = bitmapFonts.large;
            const response = await fetchAsset(`assets/system/${glyph.toLowerCase()}`);

            if (!response.ok) throw new Error(`Bitmap font '${glyph}' failed to load.`);

            const glyphs = parseGlyphs(await response.arrayBuffer());

            await this.loadTextures([texture]);
            this.fonts.set(FontType_T.BITMAP_LARGE, { css: "", baseline: 0, texture, glyphs, lineHeight: glyphs.get(0x41).h });
        }
    }

    public getLineHeight(type: FontType_T = FontType_T.SMALL): number { return this.fonts.get(type).lineHeight; }
    public getFont(type: FontType_T = FontType_T.SMALL) { return this.fonts.get(type); }

    public hasGlyphs(text: string, type: FontType_T = FontType_T.SMALL): boolean {
        return !!text && !/[\x00-\x1f\x7f-\x9f\uD800-\uDFFF]/u.test(text);
    }

    public measureText(text: string, type: FontType_T = FontType_T.SMALL): number {
        const font = this.fonts.get(type);

        if (font.glyphs) {
            let width = 0, lineWidth = 0;

            for (const char of text) {
                if (char === "\n") { width = Math.max(width, lineWidth); lineWidth = 0; }
                else lineWidth += font.glyphs.get(char.codePointAt(0))?.w || 0;
            }

            return Math.max(width, lineWidth);
        }

        this.textContext.font = font.css;

        return Math.max(...text.split("\n").map(line => this.textContext.measureText(line).width));
    }

    public wrapText(text: string, width: number, continuationWidth = width): string[] {
        const lines: string[] = [];
        const tokens = text.replace(/[\x00-\x09\x0b-\x1f]/g, "").match(/[^ \n]+| +|\n/g) || [];
        let line = "", lineWidth = 0;

        for (const token of tokens) {
            if (token === "\n") {
                lines.push(line);
                line = "";
                lineWidth = 0;
                continue;
            }

            const advance = this.measureText(token);

            if (token[0] !== " " && line.trim().length && lineWidth + advance > (lines.length ? continuationWidth : width)) {
                lines.push(line.trimEnd());
                line = "";
                lineWidth = 0;
            }

            line += token;
            lineWidth += advance;
        }

        lines.push(line);

        return lines;
    }

    public measureDigits(text: string, type: DigitFont_T = DigitFont_T.NORMAL): number {
        let count = 0;

        for (let i = 0; i < text.length; i++)
            if (DIGIT_CELLS.includes(text[i])) count++;

        return count * DIGIT_FONTS[type][1];
    }

    public getTintedImage(path: string, color: number, alphaRef: number = -1, useIntrinsicAlpha = true): HTMLCanvasElement {
        const key = `${this.getTextureKey(path, useIntrinsicAlpha)}:${color & 0xffffff}` + (alphaRef < 0 ? "" : `:${alphaRef}`);
        let atlas = this.tinted.get(key);

        if (atlas) return atlas;

        const texture = this.getTexture(path, useIntrinsicAlpha);

        atlas = document.createElement("canvas");
        atlas.width = texture.width;
        atlas.height = texture.height;

        const context = atlas.getContext("2d", { willReadFrequently: true });

        context.drawImage(texture, 0, 0);

        const pixels = context.getImageData(0, 0, atlas.width, atlas.height);
        const data = pixels.data;
        const r = (color >>> 16) & 0xff, g = (color >>> 8) & 0xff, b = color & 0xff;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = data[i] * r / 255;
            data[i + 1] = data[i + 1] * g / 255;
            data[i + 2] = data[i + 2] * b / 255;
            if (data[i + 3] <= alphaRef) data[i + 3] = 0;
        }

        context.putImageData(pixels, 0, 0);
        this.tinted.set(key, atlas);

        return atlas;
    }

    public layoutWrappedText(x: number, y: number, text: string, width: number, lineSpacing: number, type: FontType_T, emit: (x: number, y: number, part: string) => void) { // FL2TextAlignParser::GetLineBuffer 0x10521cf0, English bitmap-font path.
        const tokens = text.match(/[^ \n]+| |\n/g) || [];
        const spaceWidth = this.measureText(" ", type), minSpaceWidth = Math.trunc(spaceWidth / 2) + 2;
        const lineHeight = this.getLineHeight(type) + lineSpacing;
        let line = "", lineWidth = 0, spaces: number[] = [], tokenIndex = 0, lineIndex = 0;
        const canvas = this;

        function drawLine(adjustment = 0) {
            const count = spaces.length;
            const delta = count ? Math.trunc(Math.abs(adjustment) / count) : 0;
            const remainder = count ? Math.abs(adjustment) - delta * count : 0;
            const direction = adjustment < 0 ? -1 : 1;
            let penX = x, spaceIndex = 0;

            for (const part of line.split(/( )/)) {
                if (part === " ") {
                    penX += spaces[spaceIndex] + direction * (delta + (spaceIndex < remainder ? 1 : 0));
                    spaceIndex++;
                } else {
                    emit(penX, y + lineIndex * lineHeight, part);
                    penX += canvas.measureText(part, type);
                }
            }

            lineIndex++;
            line = "";
            lineWidth = 0;
            spaces = [];
        }

        while (tokenIndex < tokens.length) {
            const token = tokens[tokenIndex];

            if (token === "\n") {
                drawLine();
                tokenIndex++;
                continue;
            }

            if (token === " ") {
                if (lineWidth + spaceWidth >= width) drawLine(width - lineWidth);
                else {
                    line += token;
                    lineWidth += spaceWidth;
                    spaces.push(spaceWidth);
                }

                tokenIndex++;
                continue;
            }

            const tokenWidth = this.measureText(token, type);
            const nextWidth = lineWidth + tokenWidth;

            if (nextWidth <= width) {
                line += token;
                lineWidth = nextWidth;
                tokenIndex++;
            } else if (!line) {
                let count = 0;

                while (count < token.length) {
                    const nextCount = count + (token.codePointAt(count) > 0xffff ? 2 : 1);
                    const nextWidth = this.measureText(token.slice(0, nextCount), type);

                    if (nextWidth >= width) break;

                    count = nextCount;
                }

                if (!count) return;

                line = token.slice(0, count);
                tokens[tokenIndex] = token.slice(count);
                if (count === token.length) tokenIndex++;
                drawLine();
            } else if (!spaces.length) {
                line += token;
                tokenIndex++;
                drawLine();
            } else if (nextWidth - width <= (spaceWidth - minSpaceWidth) * spaces.length) {
                line += token;
                tokenIndex++;
                drawLine(width - nextWidth);
            } else drawLine(width - lineWidth);
        }

        if (line) drawLine();
    }

    public renderText(context: CanvasRenderingContext2D, x: number, y: number, color: number, text: string, type: FontType_T = FontType_T.SMALL, isOutlined = false) {
        const font = this.fonts.get(type), transform = context.getTransform();

        if (font.glyphs) {
            const atlas = this.getTintedImage(font.texture, color);
            const startX = Math.trunc(x);
            let penX = startX, penY = Math.trunc(y);

            context.save();
            context.imageSmoothingEnabled = false;
            context.globalAlpha = ((color >>> 24) & 0xff) / 255;

            for (const char of text) {
                if (char === "\n") { penX = startX; penY += font.lineHeight; continue; }

                const glyph = font.glyphs.get(char.codePointAt(0));

                if (!glyph) continue;

                context.drawImage(atlas, glyph.u, glyph.v, glyph.w, glyph.h, penX, penY, glyph.w, glyph.h);
                penX += glyph.w;
            }

            context.restore();
            return;
        }

        if (!transform.b && !transform.c && transform.a && transform.d) {
            x = (Math.round(x * transform.a + transform.e) - transform.e) / transform.a;
            y = (Math.round(y * transform.d + transform.f) - transform.f) / transform.d;
        }

        context.save();
        context.font = font.css;
        context.fontKerning = "none";
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        context.fillStyle = `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
        context.globalAlpha = ((color >>> 24) & 0xff) / 255;

        if (isOutlined) context.lineJoin = "round";

        text.split("\n").forEach((line, index) => {
            const baseline = y + font.baseline + index * font.lineHeight;

            if (isOutlined) {
                context.strokeStyle = "#000";
                context.lineWidth = 2;
                context.strokeText(line, x, baseline);
                context.strokeStyle = context.fillStyle;
                context.lineWidth = 0.3;
                context.strokeText(line, x, baseline);
            }
            context.fillText(line, x, baseline);
        });
        context.restore();
    }
}

export default NWindowCanvas;
