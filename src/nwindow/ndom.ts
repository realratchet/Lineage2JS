import NCTooltip, { type TooltipInfo_T } from "./nc-tooltip";
import { DIGIT_CELLS, DIGIT_FONTS, DigitFont_T, FontType_T } from "./nwindow-canvas";
import type NWindowManager from "./nwindow-manager";
import { SKIN_SLOTS } from "./skin-textures";

const CARET_BLINK = 500;
const TEXT_COLOR = 0xffdcdcdc;
const LABEL_ENABLED = 0xffe6dcbe;
const LABEL_DISABLED = 0xffa0a0a0;
const ATLAS_WIDTH = 2048;
const MIN_THUMB = 15;

type AtlasEntry_T = { url: string, x: number, y: number, width: number, height: number, atlasWidth: number, atlasHeight: number, frames: [number, number][], frameTime: number };
type ModalWindow_T = { element: HTMLElement };

function encodeBitmap(canvas: HTMLCanvasElement): Blob { // 32bpp BITMAPV4 with RGBA bitfields: raw canvas bytes, no PNG compression pass.
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const header = new DataView(new ArrayBuffer(122));

    header.setUint16(0, 0x4d42, true);
    header.setUint32(2, 122 + pixels.byteLength, true);
    header.setUint32(10, 122, true);
    header.setUint32(14, 108, true);
    header.setInt32(18, canvas.width, true);
    header.setInt32(22, -canvas.height, true);
    header.setUint16(26, 1, true);
    header.setUint16(28, 32, true);
    header.setUint32(30, 3, true);
    header.setUint32(34, pixels.byteLength, true);
    header.setUint32(54, 0x000000ff, true);
    header.setUint32(58, 0x0000ff00, true);
    header.setUint32(62, 0x00ff0000, true);
    header.setUint32(66, 0xff000000, true);
    header.setUint32(70, 0x73524742, true);

    return new Blob([header.buffer, pixels], { type: "image/bmp" });
}

function selectionHtml(x: number, width: number) { return `<b style="left:${x}px;top:2px;width:${width}px;height:12px"></b>`; } // NWindow.WhiteTexture at alpha 0x80.

function glyphHtml(x: number, y: number, w: number, h: number, u: number, v: number) { return `<i style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;background-position:${-u}px ${-v}px"></i>`; }

export type NDomCheckBox_T = HTMLDivElement & { setChecked(checked: boolean): void, getChecked(): boolean };
export type NDomButton_T = HTMLDivElement & { setLabel(label: string): void, setEnabled(isEnabled: boolean): void, setTextures(normal: string, down: string, over?: string): void };
export type NDomScrollPane_T = HTMLDivElement & { content: HTMLDivElement, setContentHeight(height: number, preserveScroll?: boolean): void, setScroll(position: number, isClamped?: boolean): void, getScroll(): number };
export type NDomEdit_T = HTMLDivElement & { input: HTMLInputElement, getValue(): string, setValue(value: string): void, appendValue(value: string): void, setEnabled(isEnabled: boolean): void, setWidthLimit(width: number): void, focus(): void };

export class NDomLayer {
    protected readonly tooltips = new NCTooltip();
    public readonly root = document.createElement("div");
    public readonly consoleRoot = document.createElement("div");
    protected readonly manager: NWindowManager;
    protected readonly atlas = new Map<string, AtlasEntry_T>();
    protected readonly tileAnimations = new WeakMap<HTMLElement, Animation>();
    protected readonly cacheWrapUrls = new Map<string, string>();
    protected readonly cacheTintUrls = new Map<string, string>();
    protected readonly windowNames = new Map<HTMLElement, string>();
    protected readonly windowPositions = new Map<HTMLElement, [number, number]>();
    protected readonly arrModalWindows: ModalWindow_T[] = [];
    protected readonly modalBlocker = document.createElement("div");
    protected stopDrag: () => void = null;
    protected activeWindow: HTMLElement = null;
    protected zOrder = 0;
    protected isTransparencyMode = false;

    public constructor(manager: NWindowManager) {
        this.manager = manager;
        this.root.className = "ndom-layer";
        this.consoleRoot.className = "ndom-console";
        this.root.appendChild(this.consoleRoot);

        this.modalBlocker.className = "ndom-absolute ndom-opaque ndom-modal-blocker";
        this.modalBlocker.style.inset = "0";
        this.modalBlocker.hidden = true;
        this.modalBlocker.setAttribute("aria-hidden", "true");
        this.modalBlocker.addEventListener("mousedown", event => event.preventDefault());
        this.root.appendChild(this.modalBlocker);

        for (const type of ["keydown", "keyup"])
            window.addEventListener(type, event => {
                const modal = this.arrModalWindows[this.arrModalWindows.length - 1];

                if (!modal || modal.element.contains(event.target as Node)) return;

                event.preventDefault();
                event.stopImmediatePropagation();
            }, { capture: true, passive: false });

        window.addEventListener("focusin", event => {
            const modal = this.arrModalWindows[this.arrModalWindows.length - 1];

            if (modal && !modal.element.contains(event.target as Node)) modal.element.focus();
        }, true);

        for (const type of ["mousedown", "mouseup", "click", "dblclick", "wheel", "keydown", "keyup", "contextmenu"])
            this.root.addEventListener(type, event => { if (event.target !== this.root) event.stopPropagation(); });

        this.root.addEventListener("contextmenu", event => event.preventDefault());

        window.addEventListener("mousedown", event => {
            let wnd = event.target instanceof Element && this.root.contains(event.target) ? event.target : null;

            while (wnd && wnd.parentElement !== this.root && wnd.parentElement !== this.consoleRoot) wnd = wnd.parentElement;
            if (wnd === this.consoleRoot) wnd = null;

            this.activate(wnd as HTMLElement);
        }, true);
        new MutationObserver(records => {
            for (const { target } of records)
                if (target instanceof HTMLElement && target !== this.consoleRoot && (target.parentElement === this.root || target.parentElement === this.consoleRoot) && !target.hidden && !target.classList.contains("ndom-opaque")) this.activate(target);
        }).observe(this.root, { subtree: true, attributeFilter: ["hidden"] });

        window.addEventListener("resize", () => this.resize());
        document.body.appendChild(this.root);
        this.resize();
    }

    public resize() {
        const canvas = this.manager.canvas;

        this.root.style.width = `${canvas.width}px`;
        this.root.style.height = `${canvas.height}px`;
        this.root.style.transform = `scale(${canvas.cssScale})`;
    }

    public getManager() { return this.manager; }
    public getModalWindows() { return this.arrModalWindows.map(entry => entry.element); }
    public getWindows() { return [...this.consoleRoot.children, ...this.root.children].filter(wnd => wnd !== this.consoleRoot) as HTMLElement[]; }

    public setConsoleWindows(windows: HTMLElement[]) {
        for (const wnd of windows)
            if (wnd !== this.consoleRoot && wnd !== this.modalBlocker) this.consoleRoot.appendChild(wnd);
        this.updateTransparency();
    }

    public setBackground(wnd: HTMLElement) { wnd.classList.add("ndom-back"); } // NCGodWnd children (login, lobby, loading screens) stay behind every popup window.

    public activate(wnd: HTMLElement) {
        if (wnd && wnd !== this.activeWindow && !wnd.classList.contains("ndom-back")) wnd.style.zIndex = String(++this.zOrder);

        if (this.arrModalWindows.length) {
            this.modalBlocker.style.zIndex = String(++this.zOrder);
            wnd = this.arrModalWindows[this.arrModalWindows.length - 1].element;
            wnd.style.zIndex = String(++this.zOrder);
        }

        this.activeWindow = wnd;
        this.updateTransparency();
    }

    public setModal(wnd: HTMLElement, isModal: boolean) { // NWindow 0x10034c10/30, manager 0x1003a6f0/720.
        const index = this.arrModalWindows.findIndex(entry => entry.element === wnd);

        if (isModal) {
            if (index !== -1) return;

            this.cancelDrag();
            this.arrModalWindows.push({ element: wnd });
            this.modalBlocker.hidden = false;
            wnd.tabIndex = -1;
            wnd.setAttribute("role", "dialog");
            wnd.setAttribute("aria-modal", "true");
            this.activate(wnd);
            wnd.focus();
        } else {
            if (index !== -1) {
                this.arrModalWindows.splice(index, 1);
                this.modalBlocker.hidden = this.arrModalWindows.length === 0;
                if (wnd.hidden && wnd.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
            }
            const modal = this.arrModalWindows[this.arrModalWindows.length - 1];

            if (modal || index !== -1 && wnd.hidden) this.activate(null);
            if (modal) modal.element.focus();
            wnd.removeAttribute("aria-modal");
        }
    }

    public setTransparencyMode(isEnabled: boolean) {
        this.isTransparencyMode = isEnabled;
        this.updateTransparency();
    }

    protected updateTransparency() { // NWindow 0x10038ecd: with GIsTransparencyMode, every top window but the active one and style 0x80000 ones paints with the canvas flag at +0x70.
        for (const wnd of this.getWindows())
            wnd.classList.toggle("ndom-inactive", this.isTransparencyMode && wnd.parentElement === this.consoleRoot && wnd !== this.activeWindow && !wnd.classList.contains("ndom-opaque"));
    }

    public toUI(client: number) { return this.manager.canvas.toUI(client); }

    public beginDrag(onMove: (event: MouseEvent) => void, onStop: (event?: Event) => void = null) {
        this.cancelDrag();

        const move = (event: MouseEvent) => {
            if (!(event.buttons & 1)) { stop(event); return; }

            onMove(event);
        };
        const stop = (event?: Event) => {
            if (event instanceof MouseEvent && (event.type === "mouseup" || event.type === "pointerup") && event.button !== 0) return;

            window.removeEventListener("mousemove", move, true);
            window.removeEventListener("mouseup", stop, true);
            window.removeEventListener("pointerup", stop, true);
            window.removeEventListener("pointercancel", stop, true);
            window.removeEventListener("blur", stop);
            this.stopDrag = null;

            if (onStop) onStop(event);
        };

        window.addEventListener("mousemove", move, true);
        window.addEventListener("mouseup", stop, true);
        window.addEventListener("pointerup", stop, true);
        window.addEventListener("pointercancel", stop, true);
        window.addEventListener("blur", stop);
        this.stopDrag = stop;
    }

    public cancelDrag() { if (this.stopDrag) this.stopDrag(); }

    public dragWindow(element: HTMLElement, event: MouseEvent, place: (x: number, y: number) => void = (x, y) => this.place(element, x, y)) {
        const x = this.toUI(event.clientX) - element.offsetLeft, y = this.toUI(event.clientY) - element.offsetTop, startX = element.offsetLeft, startY = element.offsetTop;

        this.beginDrag(moveEvent => {
            const [nextX, nextY] = this.manager.snapWindow(this.toUI(moveEvent.clientX) - x, this.toUI(moveEvent.clientY) - y, element.offsetWidth, element.offsetHeight, element);

            place(nextX, nextY);
        }, () => {
            if (element.offsetLeft !== startX || element.offsetTop !== startY) this.saveWindowPosition(element);
        });
    }

    public saveWindowPosition(element: HTMLElement) {
        if (this.windowNames.has(element)) this.manager.saveWindowPosition(this.windowNames.get(element), parseFloat(element.style.left), parseFloat(element.style.top));
    }

    public restoreWindow(element: HTMLElement, name: string) {
        if (!this.windowPositions.has(element)) this.windowPositions.set(element, [parseFloat(element.style.left), parseFloat(element.style.top)]);

        const position = this.manager.loadWindowPosition(name, parseFloat(element.style.width), parseFloat(element.style.height));

        this.windowNames.set(element, name);

        if (position) this.place(element, position[0], position[1]);
    }

    public resetWindowPositions() {
        for (const [element, position] of this.windowPositions) this.place(element, position[0], position[1]);
    }

    public async loadTextures(paths: string[], tinted: [string, number][] = []) { // tinted copies share the atlas image of the same call
        const canvas = this.manager.canvas;

        await canvas.loadTextures([...paths, ...tinted.map(([path]) => path)]);

        const requests = [...new Map<string, [string, number]>([...paths.map(path => [path, 0xffffff] as [string, number]), ...tinted].map(([path, tint]) => {
            const key = path.replace(/^\?/, "").toLowerCase(), atlasKey = tint === 0xffffff ? key : `${key}:${tint & 0xffffff}`;

            return [atlasKey, [key, tint]];
        })).entries()].filter(([atlasKey, [key]]) => !this.atlas.has(atlasKey) && canvas.hasTexture(key));

        if (requests.length === 0) return;

        const keys = requests.map(([atlasKey]) => atlasKey);
        const animations: { frames: (ImageBitmap | HTMLCanvasElement)[], frameTime: number }[] = requests.map(([, [key, tint]]) => tint === 0xffffff ? canvas.getTextureAnimation(key) : { frames: [canvas.getTintedImage(key, tint)], frameTime: 0 });
        const images = animations.flatMap(image => image.frames);
        const atlasWidth = Math.max(ATLAS_WIDTH, ...images.map(image => image.width));
        const places: [number, number][] = [];
        let x = 0, y = 0, shelf = 0;

        for (const i of images.map((_, i) => i).sort((a, b) => images[b].height - images[a].height)) {
            if (x + images[i].width > atlasWidth) {
                x = 0;
                y += shelf + 1;
                shelf = 0;
            }

            places[i] = [x, y];
            x += images[i].width + 1;
            shelf = Math.max(shelf, images[i].height);
        }

        const atlas = document.createElement("canvas");

        atlas.width = atlasWidth;
        atlas.height = y + shelf;

        const context = atlas.getContext("2d", { willReadFrequently: true });

        images.forEach((image, i) => context.drawImage(image, places[i][0], places[i][1]));

        const url = URL.createObjectURL(encodeBitmap(atlas));

        let first = 0;
        keys.forEach((key, i) => {
            const image = animations[i], frames = places.slice(first, first + image.frames.length);

            if (!this.atlas.has(key)) this.atlas.set(key, { url, x: frames[0][0], y: frames[0][1], width: image.frames[0].width, height: image.frames[0].height, atlasWidth, atlasHeight: atlas.height, frames, frameTime: image.frameTime });
            first += image.frames.length;
        });
    }

    public hasTexture(path: string) { return this.atlas.has(path.toLowerCase()); }

    public getWrapUrl(path: string): string {
        const key = path.toLowerCase();

        if (!this.cacheWrapUrls.has(key)) {
            const image = this.manager.canvas.getTexture(path);
            const canvas = document.createElement("canvas");

            canvas.width = image.width;
            canvas.height = image.height;
            canvas.getContext("2d").drawImage(image, 0, 0);
            this.cacheWrapUrls.set(key, canvas.toDataURL());
        }

        return this.cacheWrapUrls.get(key);
    }

    public createWindow(x: number, y: number, width: number, height: number, parent: HTMLElement = this.root): HTMLDivElement {
        const wnd = document.createElement("div");

        wnd.className = "ndom-window";
        this.place(wnd, x, y, width, height);
        parent.appendChild(wnd);

        return wnd;
    }

    public place(element: HTMLElement, x: number, y: number, width: number = null, height: number = null) {
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;

        if (width !== null) element.style.width = `${width}px`;
        if (height !== null) element.style.height = `${height}px`;
    }

    public setTile(element: HTMLElement, w: number, h: number, u: number, v: number, uw: number, vh: number, path: string, color: number = 0xffffff) {
        const tinted = color === 0xffffff ? null : this.atlas.get(`${path.toLowerCase()}:${color & 0xffffff}`);

        if (tinted) color = 0xffffff;

        const entry = tinted || this.atlas.get(path.toLowerCase());

        if (!entry) throw new Error(`UI texture '${path}' was not loaded for the DOM layer.`);

        const scaleX = w / uw, scaleY = h / vh;

        const previous = this.tileAnimations.get(element);

        if (previous) { previous.cancel(); this.tileAnimations.delete(element); }

        if (color !== 0xffffff || u < 0 || v < 0 || u + uw > entry.width || v + vh > entry.height) { // Wrapping and tinted tiles need the texture on its own.
            element.style.backgroundImage = `url(${color === 0xffffff ? this.getWrapUrl(path) : this.getTintUrl(path, color)})`;
            element.style.backgroundSize = `${entry.width * scaleX}px ${entry.height * scaleY}px`;
            element.style.backgroundPosition = `${-u * scaleX}px ${-v * scaleY}px`;
            return;
        }

        element.style.backgroundImage = `url(${entry.url})`;
        element.style.backgroundSize = `${entry.atlasWidth * scaleX}px ${entry.atlasHeight * scaleY}px`;
        element.style.backgroundPosition = `${-(entry.x + u) * scaleX}px ${-(entry.y + v) * scaleY}px`;
        if (entry.frames.length > 1) {
            const frames = [...entry.frames, entry.frames[0]].map(([x, y]) => ({ backgroundPosition: `${-(x + u) * scaleX}px ${-(y + v) * scaleY}px`, easing: "steps(1, end)" }));
            const animation = element.animate(frames, { duration: entry.frameTime * entry.frames.length, iterations: Infinity });

            animation.startTime = 0;
            this.tileAnimations.set(element, animation);
        }
    }

    public tile(parent: HTMLElement, x: number, y: number, w: number, h: number, u: number, v: number, uw: number, vh: number, path: string, color: number = 0xffffff): HTMLDivElement {
        const element = document.createElement("div");

        element.className = "ndom-tile";
        this.place(element, x, y, w, h);
        this.setTile(element, w, h, u, v, uw, vh, path, color);
        parent.appendChild(element);

        return element;
    }

    public placeTile(element: HTMLElement, x: number, y: number, w: number, h: number, u: number, v: number, uw: number, vh: number, path: string, color: number = 0xffffff) {
        element.hidden = w <= 0 || h <= 0;

        if (element.hidden) return;

        this.place(element, x, y, w, h);
        this.setTile(element, w, h, u, v, uw, vh, path, color);
    }

    public getTintUrl(path: string, color: number, alphaRef: number = -1): string {
        const key = `${path.toLowerCase()}:${color & 0xffffff}:${alphaRef}`;

        if (!this.cacheTintUrls.has(key)) this.cacheTintUrls.set(key, URL.createObjectURL(encodeBitmap(this.manager.canvas.getTintedImage(path, color, alphaRef))));

        return this.cacheTintUrls.get(key);
    }

    public setAlpha(element: HTMLElement, alpha: number) { element.style.setProperty("--alpha", alpha >= 0xff ? "" : String(alpha / 255)); }

    protected setGlyphs(element: HTMLElement, html: string, width: number, height: number, texture: string, color: number, alphaRef: number = -1) {
        const alpha = (color >>> 24) & 0xff;

        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
        element.style.opacity = alpha === 0xff ? "" : String(alpha / 255);
        element.style.setProperty("--glyphs", `url(${this.getTintUrl(texture, color, alphaRef)})`);
        element.innerHTML = html;
    }

    public renderText(element: HTMLElement, text: string, color: number, font: FontType_T = FontType_T.SMALL, isUnderlined: boolean = false) { // Engine.dll DrawNormalText 0x10527880: one 1:1 quad per glyph, pen advances by the glyph width.
        const nwindow = this.manager.canvas, { texture, glyphs, lineHeight } = nwindow.getFont(font);
        const width = Math.max(1, nwindow.measureText(text, font));
        let html = "", penX = 0, penY = 0;

        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);

            if (code === 0x0a) {
                penX = 0;
                penY += lineHeight;
                continue;
            }

            if (code < 0x20) continue;

            const glyph = glyphs.get(code);

            if (!glyph) continue;

            html += glyphHtml(penX, penY, glyph.w, glyph.h, glyph.u, glyph.v);
            penX += glyph.w;
        }

        if (isUnderlined) html += `<b style="left:0;top:${lineHeight - 1}px;width:${width}px;height:1px;background:#${(color & 0xffffff).toString(16).padStart(6, "0")}"></b>`; // LINK underline occupies the last font row, L2.4_20 capture.

        this.setGlyphs(element, html, width, lineHeight, texture, color);
    }

    public text(parent: HTMLElement, text: string, color: number = TEXT_COLOR, font: FontType_T = FontType_T.SMALL, x: number = null, y: number = null, isUnderlined: boolean = false): HTMLDivElement {
        const element = document.createElement("div");

        element.className = x === null ? "ndom-text" : "ndom-text ndom-absolute";
        this.renderText(element, text, color, font, isUnderlined);

        if (x !== null) this.place(element, x, y);
        if (parent) parent.appendChild(element);

        return element;
    }

    public renderDigits(element: HTMLElement, text: string, color: number, type: DigitFont_T = DigitFont_T.NORMAL, alphaRef: number = -1) { // UCanvas::DrawSpecialDigit (Engine 0x105284e0): fixed cells, characters outside the strip are skipped.
        const [texture, cellW, cellH] = DIGIT_FONTS[type];
        let html = "", count = 0;

        for (let i = 0; i < text.length; i++) {
            const cell = DIGIT_CELLS.indexOf(text[i]);

            if (cell < 0) continue;

            html += glyphHtml(count * cellW, 0, cellW, cellH, cell * cellW, 0);
            count++;
        }

        this.setGlyphs(element, html, Math.max(1, count * cellW), cellH, texture, color, alphaRef);
    }

    public digits(parent: HTMLElement, text: string, color: number = TEXT_COLOR, type: DigitFont_T = DigitFont_T.NORMAL, x: number = null, y: number = null, alphaRef: number = -1): HTMLDivElement {
        const element = document.createElement("div");

        element.className = x === null ? "ndom-text" : "ndom-text ndom-absolute";
        this.renderDigits(element, text, color, type, alphaRef);

        if (x !== null) this.place(element, Math.trunc(x), Math.trunc(y));
        if (parent) parent.appendChild(element);

        return element;
    }

    public wrappedText(parent: HTMLElement, x: number, y: number, color: number, text: string, width: number, lineSpacing = 0, font: FontType_T = FontType_T.SMALL) {
        this.manager.canvas.layoutWrappedText(x, y, text, width, lineSpacing, font, (penX, penY, part) => this.text(parent, part, color, font, Math.trunc(penX), Math.trunc(penY)));
    }

    public measureText(text: string, font: FontType_T = FontType_T.SMALL) { return this.manager.canvas.measureText(text, font); }

    public button(parent: HTMLElement, x: number, y: number, w: number, h: number, normal: string, down: string, over: string = null, label: string = null, onPress: () => void = null, onHold: (isDown: boolean) => void = null): NDomButton_T { // NCButton states (0x100010ec); NCExButton 0x100017d0 / 0x10001810 notifies both edges without click audio.
        const element = document.createElement("div") as NDomButton_T;
        const face = document.createElement("div");
        const caption = document.createElement("div");
        let textures = { normal, down, over: over || (this.hasTexture(`${normal}_over`) ? `${normal}_over` : normal) };
        let isEnabled = true, isHover = false, isDown = false, text = label;

        const update = () => {
            const texture = isDown && isHover ? textures.down : isHover ? textures.over : textures.normal;

            face.hidden = !texture;
            if (texture) this.setTile(face, w, h, 0, 0, w, h, texture);
        };
        const updateLabel = () => {
            caption.hidden = !text;

            if (!text) return;

            this.renderText(caption, text, isEnabled ? LABEL_ENABLED : LABEL_DISABLED);
            caption.style.left = `${Math.trunc(w * 0.5 - Math.trunc(this.measureText(text) / 2))}px`;
            caption.style.top = `${Math.trunc(h * 0.5 - Math.trunc(this.manager.canvas.getLineHeight() / 2))}px`;
        };

        element.className = "ndom-button";
        element.style.overflow = "hidden";
        face.className = "ndom-tile";
        this.place(face, 0, 0, w, h);
        caption.className = "ndom-text ndom-absolute";
        element.append(face, caption);
        this.place(element, x, y, w, h);
        element.addEventListener("mouseenter", () => { isHover = true; update(); });
        element.addEventListener("mouseleave", () => { isHover = false; update(); });
        element.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            isDown = true;
            update();

            if (onHold) onHold(true);
            else this.manager.playButtonSound(isEnabled);

            const stop = () => {
                if (isDown && onHold) onHold(false);
                isDown = false;
                update();
                window.removeEventListener("mouseup", up, true);
                window.removeEventListener("mousemove", move, true);
                window.removeEventListener("pointercancel", stop, true);
                window.removeEventListener("blur", stop);
            };
            const up = (event: MouseEvent) => {
                if (event.button !== 0) return;

                const wasDown = isDown;

                stop();

                if (wasDown && isEnabled && element.contains(event.target as Node) && onPress) onPress();
            };
            const move = (event: MouseEvent) => { if (!(event.buttons & 1)) stop(); };

            window.addEventListener("mouseup", up, true);
            window.addEventListener("mousemove", move, true);
            window.addEventListener("pointercancel", stop, true);
            window.addEventListener("blur", stop);
        });

        element.setLabel = value => { text = value; updateLabel(); };
        element.setEnabled = value => { isEnabled = value; updateLabel(); };
        element.setTextures = (normalTexture, downTexture, overTexture) => {
            textures = { normal: normalTexture, down: downTexture, over: overTexture || normalTexture };
            update();
        };

        update();
        updateLabel();
        parent.appendChild(element);

        return element;
    }

    public tooltip(parent: HTMLElement, button: HTMLElement, info: string | TooltipInfo_T, topOffset = 32) { this.tooltips.bind(this, parent, button, info, topOffset); }

    public tab(parent: HTMLElement, x: number, y: number, w: number, h: number, normal: string, selected: string, label: string, tooltip: string, onSelect: () => void): NDomButton_T { // NCTabButton 0x10001b90, 0x10001a50: selected stays state 1; unselected hover uses state 2.
        let isEnabled = true, isSelected = normal === selected;
        const select = () => { // 0x10002a50 / 0x1002e550.
            if (!isEnabled) return;

            if (!isSelected) this.manager.playWindowSound();
            onSelect();
            this.manager.playWindowSound();
        };
        const tab = this.button(parent, x, y, w, h, normal, label ? normal : selected, label ? normal === selected || !this.hasTexture(`${normal}_over`) ? normal : `${normal}_over` : selected, label, null, isDown => { if (isDown) select(); });
        const setTextures = tab.setTextures, setEnabled = tab.setEnabled;

        tab.setTextures = (normal, down) => {
            isSelected = normal === selected;
            setTextures(normal, label ? normal : down, label ? normal === selected || !this.hasTexture(`${normal}_over`) ? normal : `${normal}_over` : down);
        };
        tab.setEnabled = value => { isEnabled = value; setEnabled(value); };
        tab.tabIndex = 0;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-label", tooltip || label);
        tab.addEventListener("mousedown", event => { if (event.button === 0) event.preventDefault(); });
        if (tooltip) this.tooltip(parent, tab, tooltip);
        tab.addEventListener("keydown", event => {
            if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            select();
        });

        return tab;
    }

    public checkbox(parent: HTMLElement, x: number, y: number, w: number, h: number, label: string, onChange: (checked: boolean) => void = null, checked = false): NDomCheckBox_T {
        const element = this.createWindow(x, y, w, h, parent) as NDomCheckBox_T;
        const icon = this.tile(element, 0, 0, 12, 12, 0, 0, 12, 12, SKIN_SLOTS.checkBox);

        element.setAttribute("role", "checkbox");
        element.setAttribute("aria-label", label);
        this.text(element, label, 0xffdcdcdc, FontType_T.SMALL, 16, 0);
        element.getChecked = () => checked;
        element.setChecked = value => {
            checked = value;
            element.setAttribute("aria-checked", String(value));
            this.setTile(icon, 12, 12, 0, 0, 12, 12, value ? SKIN_SLOTS.checkBoxChecked : SKIN_SLOTS.checkBox);
        };
        element.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2 || element.getAttribute("aria-disabled") === "true") return;

            element.setChecked(!checked);
            if (onChange) onChange(checked);
        });
        element.setChecked(checked);
        return element;
    }

    public scrollPane(parent: HTMLElement, x: number, y: number, w: number, h: number, step: number, isPixel = false, visibleRows = Math.ceil(h / step)): NDomScrollPane_T { // NCScrollWnd OnCreate 0x1002bd60: buttons at (W-15, 0) and (W-15, H-15) always shown, slider hidden when content fits (0x1002c104).
        const element = this.createWindow(x, y, w, h, parent) as NDomScrollPane_T;
        const content = this.createWindow(0, 0, w - 15, 0, element);
        const thumb = this.createWindow(w - 15, 15, 15, 0, element);
        const thumbCenter = this.tile(thumb, 0, 8, 15, 8, 0, 0, 15, 8, SKIN_SLOTS.scrollThumbCenter);
        const thumbBottom = this.tile(thumb, 0, 8, 15, 8, 0, 0, 15, 8, SKIN_SLOTS.scrollThumbBottom);
        const viewRows = visibleRows;
        let scroll = 0, contentHeight = 0, thumbLen = 0;

        const update = () => {
            const sliderH = h - 30;
            const contentRows = isPixel ? contentHeight : Math.ceil(contentHeight / step), visibleRows = isPixel ? h : viewRows;

            thumb.hidden = contentRows <= visibleRows;
            if (thumb.hidden) return;

            thumbLen = Math.max(MIN_THUMB, Math.trunc(visibleRows * sliderH / contentRows));
            this.place(thumb, w - 15, 15 + Math.trunc((sliderH - thumbLen) * (isPixel ? scroll : scroll / step) / (contentRows - visibleRows)), 15, thumbLen);
            this.place(thumbCenter, 0, 8, 15, Math.max(0, thumbLen - 16));
            this.setTile(thumbCenter, 15, Math.max(0, thumbLen - 16), 0, 0, 15, 8, SKIN_SLOTS.scrollThumbCenter);
            this.place(thumbBottom, 0, thumbLen - 8);
        };
        const pushButton = (button: HTMLElement, direction: number) => {
            button.tabIndex = -1;
            button.addEventListener("mousedown", event => {
                if (event.button !== 0 && event.button !== 2) return;

                event.preventDefault();
                button.focus();
                if (event.detail === 2) event.stopImmediatePropagation();
            }, true);
            button.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                element.setScroll(scroll + direction * step);
            });
        };

        element.style.overflow = "hidden";
        element.content = content;
        element.getScroll = () => scroll;
        const setScroll = (position: number, isClamped = true) => {
            if (isPixel) {
                if (!isClamped) scroll = position;
                else if (position < scroll && scroll > 0) scroll = Math.max(0, position);
                else if (position > scroll && scroll < contentHeight - h) scroll = Math.min(contentHeight - h, position);
            } else scroll = Math.max(0, isClamped ? Math.min(Math.ceil(position / step), Math.ceil(contentHeight / step) - viewRows) * step : Math.ceil(position / step) * step);
            content.style.top = `${-scroll}px`;
            update();
            element.dispatchEvent(new Event("scroll"));
        };
        element.setScroll = setScroll;
        element.setContentHeight = (height, preserveScroll = false) => {
            contentHeight = height;
            content.style.height = `${height}px`;
            if (preserveScroll) update();
            else setScroll(scroll);
        };

        pushButton(this.button(element, w - 15, 0, 15, 15, SKIN_SLOTS.scrollUp, SKIN_SLOTS.scrollUpDown, SKIN_SLOTS.scrollUp), -1);
        pushButton(this.button(element, w - 15, h - 15, 15, 15, SKIN_SLOTS.scrollDown, SKIN_SLOTS.scrollDownDown, SKIN_SLOTS.scrollDown), 1);
        this.tile(thumb, 0, 0, 15, 8, 0, 0, 15, 8, SKIN_SLOTS.scrollThumbTop);
        thumb.tabIndex = -1;
        thumb.addEventListener("mousedown", event => {
            if (event.button !== 0 && event.button !== 2) return;

            event.preventDefault();
            thumb.focus();
            if (event.button !== 0 || event.detail === 2) return;

            const startY = this.toUI(event.clientY), startPos = thumb.offsetTop - 15;

            this.beginDrag(moveEvent => {
                const travel = h - 30 - thumbLen;

                if (thumb.hidden || travel <= 0) return;

                const position = Math.max(0, Math.min(travel, Math.trunc(startPos + this.toUI(moveEvent.clientY) - startY)));

                if (position === thumb.offsetTop - 15) return;

                element.setScroll(isPixel ? Math.ceil(Math.trunc(position * Math.max(0, contentHeight - h) / travel) / step) * step : Math.trunc(position * (Math.ceil(contentHeight / step) - viewRows) / travel) * step, !isPixel);
                this.place(thumb, w - 15, 15 + position);
            });
        });
        element.addEventListener("wheel", event => element.setScroll(scroll + Math.sign(event.deltaY) * step));
        element.setContentHeight(0);

        return element;
    }

    public edit(parent: HTMLElement, x: number, y: number, w: number, h: number, isPassword: boolean = false, maxLength: number = 0, isNumeric: boolean = false): NDomEdit_T { // NCEditBox paint 0x1000ef50: inputbox1/2/3 three-slice (source 8x17), text at (2,2), '*' for passwords, '|' caret.
        const element = document.createElement("div") as NDomEdit_T;
        const left = this.tile(element, 0, 0, 8, h, 0, 0, 8, 17, SKIN_SLOTS.edit1);
        const middle = this.tile(element, 8, 0, w - 16, h, 0, 0, 8, 17, SKIN_SLOTS.edit2);
        const right = this.tile(element, w - 8, 0, 8, h, 0, 0, 8, 17, SKIN_SLOTS.edit3);
        const input = document.createElement("input");
        const overlay = document.createElement("div");
        const text = this.text(overlay, "", TEXT_COLOR, FontType_T.SMALL, 2, 2);
        const caret = this.text(overlay, "|", TEXT_COLOR, FontType_T.SMALL, 0, 2);
        const selection = document.createElement("div");
        const nwindow = this.manager.canvas;
        let timer: number = null;
        let selectOnClick = true;
        let isCaretVisible = true;
        let isNumericInputEnabled = true;
        let widthLimit = 0;

        function getCaret() { return (input.selectionDirection === "backward" ? input.selectionEnd : input.selectionStart) || 0; }

        function formatNumber() {
            const caret = getCaret();
            const oldCommas = input.value.slice(0, caret).split(",").length - 1;
            const value = input.value.replace(/,/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const newCaret = caret + value.slice(0, caret).split(",").length - 1 - oldCommas;

            input.value = value;
            input.setSelectionRange(newCaret, newCaret);
        }

        function getClickPosition(mouseX: number) {
            const shown = isPassword ? "*".repeat(input.value.length) : input.value;
            let start = 0;

            while (start < shown.length && nwindow.measureText(shown.slice(start)) > w - 6) start++;

            let caret = getCaret();
            const x = nwindow.measureText(shown.slice(start, caret));
            const distance = Math.abs(mouseX - x);
            let moved = 0;

            if (mouseX < x) {
                while (caret > 0 && moved < distance) moved += nwindow.measureText(input.value[--caret]);
            } else {
                while (caret < input.value.length && moved < distance) moved += nwindow.measureText(input.value[caret++]);
            }

            return caret;
        }

        const draw = () => {
            const shown = isPassword ? "*".repeat(input.value.length) : input.value;
            let start = 0;

            while (start < shown.length && nwindow.measureText(shown.slice(start)) > w - 6) start++;

            const visible = shown.slice(start), isFocused = document.activeElement === input;

            this.renderText(text, visible, TEXT_COLOR);
            caret.hidden = !isFocused || !isCaretVisible;

            if (!caret.hidden) this.place(caret, 2 + nwindow.measureText(visible.slice(0, Math.max(0, getCaret() - start))) - (isPassword ? 0 : 1), 2);

            const selectionStart = input.selectionStart || 0, selectionEnd = input.selectionEnd || 0;
            let html = "";

            if (isFocused && selectionEnd > selectionStart) {
                const anchor = getCaret();
                let x = nwindow.measureText(shown.slice(start, anchor));

                if (anchor === selectionEnd) {
                    const width = nwindow.measureText(input.value.slice(selectionStart, selectionEnd));

                    html = selectionHtml(2 + x - width, width);
                } else {
                    for (let i = Math.max(start, selectionStart); i < selectionEnd; i++) {
                        const width = nwindow.measureText(input.value[i]);

                        html += selectionHtml(1 + x, width);
                        x += width;
                    }
                }
            }

            selection.innerHTML = html;
        };

        element.className = "ndom-edit";
        this.place(element, x, y, w, h);
        input.className = "ndom-input";
        input.type = isPassword ? "password" : "text";
        input.autocomplete = "off";
        input.spellcheck = false;

        if (maxLength > 0) input.maxLength = maxLength;

        input.addEventListener("beforeinput", event => {
            if (!widthLimit || event.inputType !== "insertText" || !event.data) return;
            if (/[\x00-\x1f]/.test(event.data) || this.measureText(input.value) + this.measureText(event.data) >= widthLimit) event.preventDefault();
        });

        if (isNumeric) {
            function deleteNumber(isBackward: boolean) { // NCEditBox::OnKeyDown 0x1000fec0: Delete routes through Right/Backspace; Backspace skips a preceding comma.
                let caret = getCaret();

                if (!isBackward) {
                    if (caret === input.value.length) return;
                    caret++;
                }

                if (input.value[caret - 1] === ",") caret--;
                if (caret === 0) return;

                input.setRangeText("", caret - 1, caret, "end");
                isNumericInputEnabled = true;
                if (input.value.length > 1) formatNumber();

                if (!isBackward && input.value[getCaret()] === ",")
                    input.setSelectionRange(getCaret() + 1, getCaret() + 1);
            }

            function deleteSelection() {
                const count = input.selectionEnd - input.selectionStart, caret = getCaret();
                const isBackward = caret === input.selectionEnd;

                input.setSelectionRange(caret, caret);
                for (let i = 0; i < count; i++) deleteNumber(isBackward);

                return count > 0;
            }

            input.inputMode = "numeric";
            input.addEventListener("keydown", event => {
                if (event.key !== "Backspace" && event.key !== "Delete") return;

                event.preventDefault();
                if (!deleteSelection() && !(event.key === "Delete" && event.shiftKey))
                    deleteNumber(event.key === "Backspace");
                draw();
            });
            input.addEventListener("beforeinput", event => {
                if (!event.data) return;

                if (event.inputType === "insertText") { // NCEditBox::OnChar 0x1000f9c0 deletes selection through the key handlers before appending.
                    event.preventDefault();

                    for (const char of event.data) {
                        if (char < "0" || char > "9") continue;

                        isNumericInputEnabled = this.measureText(input.value) + this.measureText(char) < w - 12;
                        if (!isNumericInputEnabled) continue;

                        deleteSelection();
                        const caret = getCaret();

                        input.setRangeText(char, caret, caret, "end");
                        formatNumber();
                    }

                    draw();
                    return;
                }

                const value = input.value.slice(0, input.selectionStart) + event.data + input.value.slice(input.selectionEnd);

                if (/[^0-9]/.test(event.data) || this.measureText(value) >= w - 12) event.preventDefault();
            });
            input.addEventListener("paste", event => {
                const text = event.clipboardData.getData("text");
                const value = input.value.slice(0, input.selectionStart) + text + input.value.slice(input.selectionEnd);

                if (/[^0-9]/.test(text) || this.measureText(value) >= w - 12) event.preventDefault();
            });
            input.addEventListener("input", formatNumber);
        }

        overlay.className = "ndom-edit-overlay";
        overlay.style.width = `${w}px`;
        overlay.style.height = `${h}px`;
        overlay.append(selection);
        element.append(input, overlay);

        for (const type of ["input", "keyup", "click", "select"]) input.addEventListener(type, draw);

        input.addEventListener("mousedown", event => {
            if (input.disabled || event.button !== 0) return;

            event.preventDefault();
            input.focus();

            const isFirstClick = selectOnClick;

            if (isFirstClick) input.setSelectionRange(0, getCaret(), "backward");
            else {
                const caret = getClickPosition(this.toUI(event.clientX - element.getBoundingClientRect().left));

                input.setSelectionRange(caret, caret);
            }

            draw();
            this.beginDrag(moveEvent => {
                if (isFirstClick || document.activeElement !== input) return;

                const anchor = getCaret();
                const caret = getClickPosition(this.toUI(moveEvent.clientX - element.getBoundingClientRect().left));

                input.setSelectionRange(Math.min(anchor, caret), Math.max(anchor, caret), caret < anchor ? "backward" : "forward");
                draw();
            }, () => { if (document.activeElement === input) selectOnClick = false; });
        });

        const updateTiles = () => { // Retail draws the unfocused box with the _disable slices.
            const isFocused = !input.disabled && document.activeElement === input;

            this.setTile(left, 8, h, 0, 0, 8, 17, isFocused ? SKIN_SLOTS.edit1 : SKIN_SLOTS.edit1Disabled);
            this.setTile(middle, w - 16, h, 0, 0, 8, 17, isFocused ? SKIN_SLOTS.edit2 : SKIN_SLOTS.edit2Disabled);
            this.setTile(right, 8, h, 0, 0, 8, 17, isFocused ? SKIN_SLOTS.edit3 : SKIN_SLOTS.edit3Disabled);
        };

        input.addEventListener("focus", () => { input.setSelectionRange(input.value.length, input.value.length); updateTiles(); draw(); });
        input.addEventListener("blur", () => {
            input.setSelectionRange(input.value.length, input.value.length);
            selectOnClick = true;
            updateTiles();
            draw();
        });

        element.input = input;
        element.setWidthLimit = width => {
            widthLimit = width;
            if (width || !maxLength) input.removeAttribute("maxlength");
            else input.maxLength = maxLength;
        };
        element.getValue = () => isNumeric ? input.value.replace(/,/g, "") : input.value;
        element.setValue = value => { input.value = value; if (isNumeric) { isNumericInputEnabled = true; input.setSelectionRange(value.length, value.length); formatNumber(); } draw(); };
        element.appendValue = value => {
            if (isNumeric && !isNumericInputEnabled) return;

            const start = input.selectionStart, end = input.selectionEnd, caret = getCaret();

            input.setRangeText(value, caret, caret, "end");
            if (isNumeric) formatNumber();
            const anchor = input.selectionStart;

            if (caret === end) input.setSelectionRange(Math.max(0, anchor - (end - start)), anchor, "backward");
            else input.setSelectionRange(anchor, anchor + end - start);
            draw();
        };
        element.focus = () => input.focus();
        element.setEnabled = isEnabled => {
            input.disabled = !isEnabled;
            updateTiles();
        };

        parent.appendChild(element);
        timer = window.setInterval(() => {
            if (!element.isConnected) { window.clearInterval(timer); return; }

            isCaretVisible = !isCaretVisible;

            if (document.activeElement === input) draw();
        }, CARET_BLINK);
        updateTiles();
        draw();

        return element;
    }
}

export const NDOM_SCROLL_TEXTURES = [SKIN_SLOTS.scrollUp, SKIN_SLOTS.scrollUpDown, SKIN_SLOTS.scrollDown, SKIN_SLOTS.scrollDownDown, SKIN_SLOTS.scrollThumbTop, SKIN_SLOTS.scrollThumbCenter, SKIN_SLOTS.scrollThumbBottom];
export const NDOM_EDIT_TEXTURES = [SKIN_SLOTS.edit1, SKIN_SLOTS.edit2, SKIN_SLOTS.edit3, SKIN_SLOTS.edit1Disabled, SKIN_SLOTS.edit2Disabled, SKIN_SLOTS.edit3Disabled, "NWindow.WhiteTexture"];

export default NDomLayer;
