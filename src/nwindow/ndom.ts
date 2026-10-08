import NCTooltip, { type TooltipInfo_T } from "./nc-tooltip";
import { FontType_T } from "./nwindow-canvas";
import type NWindowManager from "./nwindow-manager";

const CARET_BLINK = 500;
const TEXT_COLOR = 0xffdcdcdc;
const LABEL_ENABLED = 0xffe6dcbe;
const LABEL_DISABLED = 0xffa0a0a0;
const ATLAS_WIDTH = 2048;
const MIN_THUMB = 15;

type AtlasEntry_T = { url: string, x: number, y: number, width: number, height: number, atlasWidth: number, atlasHeight: number };

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

export type NDomCheckBox_T = HTMLDivElement & { setChecked(checked: boolean): void, getChecked(): boolean };
export type NDomButton_T = HTMLDivElement & { setLabel(label: string): void, setEnabled(isEnabled: boolean): void, setTextures(normal: string, down: string, over?: string): void };
export type NDomScrollPane_T = HTMLDivElement & { content: HTMLDivElement, setContentHeight(height: number, preserveScroll?: boolean): void, setScroll(position: number, isClamped?: boolean): void, getScroll(): number };
export type NDomEdit_T = HTMLDivElement & { input: HTMLInputElement, getValue(): string, setValue(value: string): void, appendValue(value: string): void, setEnabled(isEnabled: boolean): void, setWidthLimit(width: number): void, focus(): void };

export class NDomLayer {
    protected readonly tooltips = new NCTooltip();
    public readonly root = document.createElement("div");
    protected readonly manager: NWindowManager;
    protected readonly atlas = new Map<string, AtlasEntry_T>();
    protected readonly cacheWrapUrls = new Map<string, string>();
    protected activeWindow: HTMLElement = null;
    protected zOrder = 0;
    protected isTransparencyMode = false;

    public constructor(manager: NWindowManager) {
        this.manager = manager;
        this.root.className = "ndom-layer";

        for (const type of ["mousedown", "mouseup", "click", "dblclick", "wheel", "keydown", "keyup", "contextmenu"])
            this.root.addEventListener(type, event => { if (event.target !== this.root) event.stopPropagation(); });

        this.root.addEventListener("contextmenu", event => event.preventDefault());

        window.addEventListener("mousedown", event => {
            let wnd = event.target instanceof Element && this.root.contains(event.target) ? event.target : null;

            while (wnd && wnd.parentElement !== this.root) wnd = wnd.parentElement;

            this.activate(wnd as HTMLElement);
        }, true);
        new MutationObserver(records => {
            for (const { target } of records)
                if (target instanceof HTMLElement && target.parentElement === this.root && !target.hidden && !target.classList.contains("ndom-opaque")) this.activate(target);
        }).observe(this.root, { subtree: true, attributeFilter: ["hidden"] });

        window.addEventListener("resize", () => this.resize());
        document.body.appendChild(this.root);
        this.resize();
    }

    protected resize() {
        const canvas = this.manager.canvas;

        this.root.style.width = `${canvas.width}px`;
        this.root.style.height = `${canvas.height}px`;
        this.root.style.transform = `scale(${canvas.cssScale})`;
    }

    public getManager() { return this.manager; }

    public activate(wnd: HTMLElement) {
        if (wnd && wnd !== this.activeWindow) wnd.style.zIndex = String(++this.zOrder);

        this.activeWindow = wnd;
        this.updateTransparency();
    }

    public setTransparencyMode(isEnabled: boolean) {
        this.isTransparencyMode = isEnabled;
        this.updateTransparency();
    }

    protected updateTransparency() { // NWindow 0x10038ecd: with GIsTransparencyMode, every top window but the active one and style 0x80000 ones paints with the canvas flag at +0x70.
        for (const wnd of this.root.children)
            wnd.classList.toggle("ndom-inactive", this.isTransparencyMode && wnd !== this.activeWindow && !wnd.classList.contains("ndom-opaque"));
    }

    public toUI(client: number) { return this.manager.canvas.toUI(client); }

    public beginDrag(onMove: (event: MouseEvent) => void, onStop: (event?: Event) => void = null) {
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

            if (onStop) onStop(event);
        };

        window.addEventListener("mousemove", move, true);
        window.addEventListener("mouseup", stop, true);
        window.addEventListener("pointerup", stop, true);
        window.addEventListener("pointercancel", stop, true);
        window.addEventListener("blur", stop);
    }

    public async loadTextures(paths: string[]) {
        await this.manager.canvas.loadTextures(paths);

        const keys = [...new Set(paths.map(request => request.replace(/^\?/, "").toLowerCase()))].filter(key => !this.atlas.has(key) && this.manager.canvas.hasTexture(key));

        if (keys.length === 0) return;

        const images = keys.map(key => this.manager.canvas.getTexture(key));
        const atlasWidth = Math.max(ATLAS_WIDTH, ...images.map(image => image.width));
        const places: [number, number][] = [];
        let x = 0, y = 0, shelf = 0;

        for (const i of keys.map((_, i) => i).sort((a, b) => images[b].height - images[a].height)) {
            if (x + images[i].width > atlasWidth) {
                x = 0;
                y += shelf + 1;
                shelf = 0;
            }

            places[i] = [x, y];
            x += images[i].width + 1;
            shelf = Math.max(shelf, images[i].height);
        }

        const canvas = document.createElement("canvas");

        canvas.width = atlasWidth;
        canvas.height = y + shelf;

        const context = canvas.getContext("2d");

        images.forEach((image, i) => context.drawImage(image, places[i][0], places[i][1]));

        const url = URL.createObjectURL(encodeBitmap(canvas));

        keys.forEach((key, i) => {
            if (!this.atlas.has(key)) this.atlas.set(key, { url, x: places[i][0], y: places[i][1], width: images[i].width, height: images[i].height, atlasWidth, atlasHeight: canvas.height });
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

    public setTile(element: HTMLElement, w: number, h: number, u: number, v: number, uw: number, vh: number, path: string) {
        const entry = this.atlas.get(path.toLowerCase());

        if (!entry) throw new Error(`UI texture '${path}' was not loaded for the DOM layer.`);

        const scaleX = w / uw, scaleY = h / vh;

        if (u < 0 || v < 0 || u + uw > entry.width || v + vh > entry.height) { // Wrapping tiles need the texture on its own for background-repeat.
            element.style.backgroundImage = `url(${this.getWrapUrl(path)})`;
            element.style.backgroundSize = `${entry.width * scaleX}px ${entry.height * scaleY}px`;
            element.style.backgroundPosition = `${-u * scaleX}px ${-v * scaleY}px`;
            return;
        }

        element.style.backgroundImage = `url(${entry.url})`;
        element.style.backgroundSize = `${entry.atlasWidth * scaleX}px ${entry.atlasHeight * scaleY}px`;
        element.style.backgroundPosition = `${-(entry.x + u) * scaleX}px ${-(entry.y + v) * scaleY}px`;
    }

    public tile(parent: HTMLElement, x: number, y: number, w: number, h: number, u: number, v: number, uw: number, vh: number, path: string): HTMLDivElement {
        const element = document.createElement("div");

        element.className = "ndom-tile";
        this.place(element, x, y, w, h);
        this.setTile(element, w, h, u, v, uw, vh, path);
        parent.appendChild(element);

        return element;
    }

    public renderText(canvas: HTMLCanvasElement, text: string, color: number, font: FontType_T = FontType_T.SMALL) {
        const nwindow = this.manager.canvas;
        const scale = nwindow.scale;
        const width = Math.max(1, nwindow.measureText(text, font)), height = nwindow.getLineHeight(font);

        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const context = canvas.getContext("2d");

        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.imageSmoothingEnabled = false;
        nwindow.renderText(context, 0, 0, color, text, font);
    }

    public text(parent: HTMLElement, text: string, color: number = TEXT_COLOR, font: FontType_T = FontType_T.SMALL, x: number = null, y: number = null): HTMLCanvasElement {
        const canvas = document.createElement("canvas");

        canvas.className = x === null ? "ndom-text" : "ndom-text ndom-absolute";
        this.renderText(canvas, text, color, font);

        if (x !== null) this.place(canvas, x, y);
        if (parent) parent.appendChild(canvas);

        return canvas;
    }

    public measureText(text: string, font: FontType_T = FontType_T.SMALL) { return this.manager.canvas.measureText(text, font); }

    public button(parent: HTMLElement, x: number, y: number, w: number, h: number, normal: string, down: string, over: string = null, label: string = null, onPress: () => void = null, onHold: (isDown: boolean) => void = null): NDomButton_T { // NCButton states (0x100010ec); NCExButton 0x100017d0 / 0x10001810 notifies both edges without click audio.
        const element = document.createElement("div") as NDomButton_T;
        const face = document.createElement("div");
        const caption = document.createElement("canvas");
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

    public tooltip(parent: HTMLElement, button: HTMLElement, info: string | TooltipInfo_T) { this.tooltips.bind(this, parent, button, info); }

    public tab(parent: HTMLElement, x: number, y: number, w: number, h: number, normal: string, selected: string, label: string, tooltip: string, onSelect: () => void): NDomButton_T { // NCTabButton 0x10001b90, 0x10001a50: selected stays state 1; unselected hover uses state 2.
        let isEnabled = true, isSelected = normal === selected;
        const select = () => { // 0x10002a50 / 0x1002e550.
            if (!isEnabled) return;

            if (!isSelected) this.manager.playWindowSound();
            onSelect();
            this.manager.playWindowSound();
        };
        const tab = this.button(parent, x, y, w, h, normal, label ? normal : selected, label ? normal === selected ? normal : `${normal}_over` : selected, label, null, isDown => { if (isDown) select(); });
        const setTextures = tab.setTextures, setEnabled = tab.setEnabled;

        tab.setTextures = (normal, down) => {
            isSelected = normal === selected;
            setTextures(normal, label ? normal : down, label ? normal === selected ? normal : `${normal}_over` : down);
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
        const icon = this.tile(element, 0, 0, 12, 12, 0, 0, 12, 12, "L2UI.Control.CheckBox");

        element.setAttribute("role", "checkbox");
        element.setAttribute("aria-label", label);
        this.text(element, label, 0xffdcdcdc, FontType_T.SMALL, 16, 0);
        element.getChecked = () => checked;
        element.setChecked = value => {
            checked = value;
            element.setAttribute("aria-checked", String(value));
            this.setTile(icon, 12, 12, 0, 0, 12, 12, value ? "L2UI.ActionWnd.CheckBox_checked" : "L2UI.Control.CheckBox");
        };
        element.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2) return;

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
        const thumbCenter = this.tile(thumb, 0, 8, 15, 8, 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarCenter");
        const thumbBottom = this.tile(thumb, 0, 8, 15, 8, 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarBottom");
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
            this.setTile(thumbCenter, 15, Math.max(0, thumbLen - 16), 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarCenter");
            this.place(thumbBottom, 0, thumbLen - 8);
        };
        const pushButton = (button: HTMLElement, direction: number) => button.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            element.setScroll(scroll + direction * step);
        });

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
        };
        element.setScroll = setScroll;
        element.setContentHeight = (height, preserveScroll = false) => {
            contentHeight = height;
            content.style.height = `${height}px`;
            if (preserveScroll) update();
            else setScroll(scroll);
        };

        pushButton(this.button(element, w - 15, 0, 15, 15, "L2UI_CH3.ScrollBar.ScrollBarUpBtn", "L2UI_CH3.ScrollBar.ScrollBarUpOnBtn", "L2UI_CH3.ScrollBar.ScrollBarUpBtn"), -1);
        pushButton(this.button(element, w - 15, h - 15, 15, 15, "L2UI_CH3.ScrollBar.ScrollBarDownBtn", "L2UI_CH3.ScrollBar.ScrollBarDownOnBtn", "L2UI_CH3.ScrollBar.ScrollBarDownBtn"), 1);
        this.tile(thumb, 0, 0, 15, 8, 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarTop");
        thumb.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();

            const startY = this.toUI(event.clientY), startPos = thumb.offsetTop - 15;

            this.beginDrag(moveEvent => {
                const travel = h - 30 - thumbLen;

                if (travel <= 0) return;

                const position = Math.max(0, Math.min(travel, Math.trunc(startPos + this.toUI(moveEvent.clientY) - startY)));

                if (position === thumb.offsetTop - 15) return;

                element.setScroll(isPixel ? Math.ceil(position * Math.max(0, contentHeight - h) / travel / step) * step : Math.trunc(position * (Math.ceil(contentHeight / step) - viewRows) / travel) * step, !isPixel);
                this.place(thumb, w - 15, 15 + position);
            });
        });
        element.addEventListener("wheel", event => element.setScroll(scroll + Math.sign(event.deltaY) * step));
        element.setContentHeight(0);

        return element;
    }

    public edit(parent: HTMLElement, x: number, y: number, w: number, h: number, isPassword: boolean = false, maxLength: number = 0, isNumeric: boolean = false): NDomEdit_T { // NCEditBox paint 0x1000ef50: inputbox1/2/3 three-slice (source 8x17), text at (2,2), '*' for passwords, '|' caret.
        const element = document.createElement("div") as NDomEdit_T;
        const left = this.tile(element, 0, 0, 8, h, 0, 0, 8, 17, "L2UI_CH3.Etc.inputbox1");
        const middle = this.tile(element, 8, 0, w - 16, h, 0, 0, 8, 17, "L2UI_CH3.Etc.inputbox2");
        const right = this.tile(element, w - 8, 0, 8, h, 0, 0, 8, 17, "L2UI_CH3.Etc.inputbox3");
        const input = document.createElement("input");
        const overlay = document.createElement("canvas");
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
            const scale = nwindow.scale;
            const shown = isPassword ? "*".repeat(input.value.length) : input.value;
            let start = 0;

            while (start < shown.length && nwindow.measureText(shown.slice(start)) > w - 6) start++;

            const visible = shown.slice(start);

            overlay.width = Math.round(w * scale);
            overlay.height = Math.round(h * scale);

            const context = overlay.getContext("2d");

            context.setTransform(scale, 0, 0, scale, 0, 0);
            context.imageSmoothingEnabled = false;
            nwindow.renderText(context, 2, 2, TEXT_COLOR, visible);

            if (document.activeElement === input && isCaretVisible) {
                const caret = Math.max(0, getCaret() - start);

                nwindow.renderText(context, 2 + nwindow.measureText(visible.slice(0, caret)) - (isPassword ? 0 : 1), 2, TEXT_COLOR, "|");
            }

            const selectionStart = input.selectionStart || 0, selectionEnd = input.selectionEnd || 0;

            if (document.activeElement === input && selectionEnd > selectionStart) {
                const texture = nwindow.getTexture("NWindow.WhiteTexture");
                const anchor = getCaret();
                let x = nwindow.measureText(shown.slice(start, anchor));

                context.globalAlpha = 0x80 / 255;

                if (anchor === selectionEnd) {
                    const width = nwindow.measureText(input.value.slice(selectionStart, selectionEnd));

                    context.drawImage(texture, 0, 0, 1, 1, 2 + x - width, 2, width, 12);
                } else {
                    for (let i = Math.max(start, selectionStart); i < selectionEnd; i++) {
                        const width = nwindow.measureText(input.value[i]);

                        context.drawImage(texture, 0, 0, 1, 1, 1 + x, 2, width, 12);
                        x += width;
                    }
                }

                context.globalAlpha = 1;
            }
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
            const suffix = !input.disabled && document.activeElement === input ? "" : "_disable";

            this.setTile(left, 8, h, 0, 0, 8, 17, `L2UI_CH3.Etc.inputbox1${suffix}`);
            this.setTile(middle, w - 16, h, 0, 0, 8, 17, `L2UI_CH3.Etc.inputbox2${suffix}`);
            this.setTile(right, 8, h, 0, 0, 8, 17, `L2UI_CH3.Etc.inputbox3${suffix}`);
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

export const NDOM_SCROLL_TEXTURES = ["ScrollBarUpBtn", "ScrollBarUpOnBtn", "ScrollBarDownBtn", "ScrollBarDownOnBtn", "SliderBarTop", "SliderBarCenter", "SliderBarBottom"].map(name => `L2UI_CH3.ScrollBar.${name}`);
export const NDOM_EDIT_TEXTURES = ["L2UI_CH3.Etc.inputbox1", "L2UI_CH3.Etc.inputbox2", "L2UI_CH3.Etc.inputbox3", "L2UI_CH3.Etc.inputbox1_disable", "L2UI_CH3.Etc.inputbox2_disable", "L2UI_CH3.Etc.inputbox3_disable", "NWindow.WhiteTexture"];

export default NDomLayer;
