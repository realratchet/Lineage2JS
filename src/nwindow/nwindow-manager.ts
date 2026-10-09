import "../../style/nwindow.scss";
import NWindowCanvas from "./nwindow-canvas";
import type NWnd from "./nwnd";
import type { NMouseEvent_T } from "./nwnd";
import type AssetManager from "../assets/asset-manager";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";

type TextInputHandler_T = { onTextInput(text: string): void, onTextSubmit(text: string, isShift: boolean): void, onTextBlur(): void };

const SNAP_DISTANCE = 10;

function snapToEdge(position: number, size: number, screen: number) { // NWindow 0x10037150 under GIsStickyWindow: windows stick to the screen edges within 10px.
    if (Math.abs(position) < SNAP_DISTANCE) return 0;
    if (Math.abs(position + size - screen) < SNAP_DISTANCE) return screen - size;

    return position;
}

export class NWindowManager {
    public readonly canvas: NWindowCanvas;
    protected readonly windows: NWnd[] = [];
    protected readonly textInput = document.createElement("input");
    protected textHandler: TextInputHandler_T = null;
    protected textOwner: NWnd = null;
    protected hovered: NWnd = null;
    protected pressed: NWnd = null;
    protected dragged: NWnd = null;
    protected dragOffsetX = 0;
    protected dragStartX = 0;
    protected dragStartY = 0;
    protected dragOffsetY = 0;
    protected isDirty = true;
    protected isReady = false;

    public overlayPaint: (canvas: NWindowCanvas) => void = null;
    public strings: GameStrings_T = { systemMessages: {}, systemMessageColors: {}, systemMessageSounds: {}, sysStrings: {}, recipes: [], hennas: {}, serverNames: {}, skillIcons: {}, skillCastStyles: {}, skillInfos: {}, actions: {}, logonSpots: [], classNames: {}, skillNames: {}, itemNames: {}, itemIcons: {}, itemInfos: {}, symbols: {} };

    public constructor(protected readonly asset: AssetManager) {
        this.canvas = new NWindowCanvas(asset);

        document.body.appendChild(this.canvas.element);

        this.textInput.className = "nwindow-text-input";
        this.textInput.autocomplete = "off";
        this.textInput.addEventListener("input", () => { if (this.textHandler) this.textHandler.onTextInput(this.textInput.value); });
        this.textInput.addEventListener("keydown", event => {
            event.stopPropagation();

            if (event.key === "Enter" && this.textHandler) this.textHandler.onTextSubmit(this.textInput.value, event.shiftKey);
            if (event.key === "Escape") this.textInput.blur();
        });
        this.textInput.addEventListener("keyup", event => { event.stopPropagation(); this.invalidate(); });
        this.textInput.addEventListener("blur", () => {
            const handler = this.textHandler;

            this.textHandler = null;
            this.textOwner = null;

            if (handler) handler.onTextBlur();

            this.invalidate();
        });
        document.body.appendChild(this.textInput);

        window.addEventListener("resize", () => this.resize());
        window.addEventListener("pointerdown", event => { const target = event.target instanceof Element ? event.target : null; if (!target?.closest(".ndom-layer") && this.findClientWindow(event)) event.stopPropagation(); }, true);
        window.addEventListener("mousedown", event => this.onMouse(event, "down"), true);
        window.addEventListener("mouseup", event => this.onMouse(event, "up"), true);
        window.addEventListener("mousemove", event => this.onMouse(event, "move"), true);
        window.addEventListener("blur", () => this.cancelMouse());
        window.addEventListener("click", event => { const target = event.target instanceof Element ? event.target : null; if (!target?.closest(".ndom-layer") && this.findClientWindow(event)) event.stopPropagation(); }, true);
        window.addEventListener("contextmenu", event => { if (this.findClientWindow(event)) event.preventDefault(); }, true);
        window.addEventListener("wheel", event => {
            if (event.target instanceof Element && event.target.closest(".ndom-layer")) return;

            const target = this.findClientWindow(event);

            if (!target) return;

            event.stopPropagation();

            for (let wnd = target; wnd; wnd = wnd.parent)
                if (wnd.onWheel(Math.sign(event.deltaY))) break;
        }, { capture: true, passive: true });

        this.resize();
        void this.loadFonts();
    }

    protected async loadFonts() {
        await Promise.all([this.canvas.loadFonts(), this.asset.loadSound("InterfaceSound.click_01"), this.asset.loadSound("ItemSound.click_failed")]);

        this.isReady = true;
        this.invalidate();
    }

    protected resize() {
        this.canvas.resize(window.innerWidth, window.innerHeight);

        for (const wnd of this.windows) this.placeWindow(wnd);

        this.invalidate();
    }

    protected placeWindow(wnd: NWnd) {
        wnd.placeOnScreen(this.canvas.width, this.canvas.height);

        const position = wnd.windowName ? this.loadWindowPosition(wnd.windowName, wnd.width, wnd.height) : null;

        if (position) {
            wnd.x = position[0];
            wnd.y = position[1];
        }
    }

    public async addWindow<T extends NWnd>(wnd: T, windowName: string = null): Promise<T> {
        const textures = new Set<string>();
        const collect = (node: NWnd) => {
            for (const texture of node.getTextures()) textures.add(texture);
            for (const child of node.children) collect(child);
        };

        collect(wnd);
        wnd.windowName = windowName;
        wnd.attach(this);
        this.windows.push(wnd);
        this.placeWindow(wnd);

        await this.canvas.loadTextures([...textures]);

        this.invalidate();

        return wnd;
    }

    public removeWindow(wnd: NWnd) {
        const index = this.windows.indexOf(wnd);

        if (index >= 0) {
            function isRemoved(node: NWnd) {
                while (node && node !== wnd) node = node.parent;

                return node === wnd;
            }

            const pressed = this.pressed;

            if (isRemoved(pressed) || isRemoved(this.dragged)) this.cancelMouse();
            if (isRemoved(this.hovered)) {
                if (this.hovered !== pressed) this.hovered.onMouseLeave();
                this.hovered = null;
            }

            this.windows.splice(index, 1);
            wnd.detach();
        }

        this.invalidate();
    }

    public bringToFront(wnd: NWnd) {
        const index = this.windows.indexOf(wnd);

        if (index < 0) return;

        this.windows.splice(index, 1);
        this.windows.push(wnd);
        this.invalidate();
    }

    public getWindows() { return this.windows; }

    public invalidate() { this.isDirty = true; }

    public playButtonSound(isEnabled: boolean): void {
        void this.asset.getParent().getComponent("audio").playInterfaceSound(isEnabled ? "InterfaceSound.click_01" : "ItemSound.click_failed"); // NWindow.dll 0x10001230, sound table 0x10242368.
    }

    public playPickupSound(): void { void this.asset.getParent().getComponent("audio").playInterfaceSound("ItemSound.pickup"); } // 0x10074e60(3), sound table 0x10242368.

    public playPanelSound(panel: "charstat" | "inventory" | "map" | "system", isOpen: boolean): void { void this.asset.getParent().getComponent("audio").playInterfaceSound(`InterfaceSound.${panel}_${isOpen ? "open" : "close"}_01`); } // 0x10074e60(11..18), sound table 0x10242368.

    public playTrashSound(): void { void this.asset.getParent().getComponent("audio").playInterfaceSound("itemsound.trash_basket"); } // 0x10074e60(4), sound table 0x10242368.

    public playWindowSound(): void { void this.asset.getParent().getComponent("audio").playInterfaceSound("itemsound.window_open"); } // 0x10074e60(5), sound table 0x10242368.

    public playWindowCloseSound(): void { void this.asset.getParent().getComponent("audio").playInterfaceSound("itemsound.window_close"); } // 0x10074e60(6), sound table 0x10242368.

    public snapX(x: number, width: number) { return snapToEdge(x, width, this.canvas.width); }
    public snapY(y: number, height: number) { return snapToEdge(y, height, this.canvas.height); }

    public loadWindowPosition(name: string, width: number, height: number): [number, number] { // NWindow 0x10073480 reads posX/posY per window from WindowsInfo.ini.
        const value = localStorage.getItem(`wnd:${name}`);

        if (value === null) return null;

        const [x, y] = JSON.parse(value);

        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Invalid window position '${name}'.`);

        return [Math.max(0, Math.min(this.canvas.width - width, x)), Math.max(0, Math.min(this.canvas.height - height, y))];
    }

    public saveWindowPosition(name: string, x: number, y: number) { localStorage.setItem(`wnd:${name}`, JSON.stringify([x, y])); } // NWindow 0x100732c0 writes posX/posY to WindowsInfo.ini.

    public beginDrag(wnd: NWnd, x: number, y: number) {
        this.dragged = wnd;
        this.dragStartX = wnd.x;
        this.dragStartY = wnd.y;
        this.dragOffsetX = x - wnd.x;
        this.dragOffsetY = y - wnd.y;
    }

    public focusText(owner: NWnd & TextInputHandler_T, value: string, isPassword: boolean, maxLength: number) {
        const isOwnerChanged = this.textOwner !== owner;

        if (isOwnerChanged && this.textHandler) this.blurText();

        this.textHandler = null;
        this.textOwner = owner;
        this.textInput.type = isPassword ? "password" : "text";
        this.textInput.maxLength = maxLength > 0 ? maxLength : 524288;
        this.textInput.value = value;
        this.textHandler = owner;
        this.textInput.focus();

        if (isOwnerChanged) this.textInput.setSelectionRange(value.length, value.length);

        this.invalidate();
    }

    public blurText(wnd: NWnd = null) {
        if (wnd) {
            let owner = this.textOwner;

            while (owner && owner !== wnd) owner = owner.parent;
            if (!owner) return;
        }
        this.textInput.blur();
    }
    public isTextFocused(owner: NWnd) { return this.textOwner === owner; }
    public getCaretPosition() { return (this.textInput.selectionDirection === "backward" ? this.textInput.selectionEnd : this.textInput.selectionStart) || 0; }
    public getSelectionStart() { return this.textInput.selectionStart || 0; }
    public getSelectionEnd() { return this.textInput.selectionEnd || 0; }
    public setTextSelection(start: number, end: number, direction: "forward" | "backward" = "forward") {
        this.textInput.setSelectionRange(start, end, direction);
        this.invalidate();
    }

    public findWindow(x: number, y: number): NWnd {
        for (let i = this.windows.length - 1; i >= 0; i--) {
            const wnd = this.windows[i];
            const hit = wnd.hitTest(x - wnd.x, y - wnd.y);

            if (hit) return hit;
        }

        return null;
    }

    public findClientWindow(event: MouseEvent): NWnd { return this.findWindow(this.canvas.toUI(event.clientX), this.canvas.toUI(event.clientY)); }

    protected toLocal(wnd: NWnd, event: MouseEvent): NMouseEvent_T {
        return { x: this.canvas.toUI(event.clientX) - wnd.getScreenX(), y: this.canvas.toUI(event.clientY) - wnd.getScreenY(), button: event.button, shift: event.shiftKey, ctrl: event.ctrlKey, clickCount: event.detail, target: event.target };
    }

    protected onMouse(event: MouseEvent, type: "down" | "up" | "move") {
        if (type === "move" && !(event.buttons & 1) && (this.dragged || this.pressed)) this.cancelMouse();
        if (!this.dragged && !this.pressed && event.target instanceof Element && event.target.closest(".ndom-layer")) return;

        if (this.dragged) {
            if (type === "move") {
                this.dragged.x = Math.max(0, Math.min(this.canvas.width - this.dragged.width, this.snapX(this.canvas.toUI(event.clientX) - this.dragOffsetX, this.dragged.width)));
                this.dragged.y = Math.max(0, Math.min(this.canvas.height - this.dragged.height, this.snapY(this.canvas.toUI(event.clientY) - this.dragOffsetY, this.dragged.height)));
                this.invalidate();
            } else if (type === "up") this.cancelMouse();

            event.stopPropagation();
            return;
        }

        const target = this.findClientWindow(event);

        if (type === "move" && target !== this.hovered) {
            if (this.hovered) this.hovered.onMouseLeave();
            if (target) target.onMouseEnter();

            this.hovered = target;
            this.invalidate();
        }

        if (type === "down" && this.textHandler && target !== this.textOwner) this.blurText();

        if (this.pressed && type !== "down") {
            const pressed = this.pressed;

            event.stopPropagation();

            if (type === "move") pressed.onMouseMove(this.toLocal(pressed, event));
            else {
                pressed.onMouseUp(this.toLocal(pressed, event));

                if (target === pressed && pressed.isEnabled) pressed.onClick(this.toLocal(pressed, event));

                this.pressed = null;
                this.invalidate();
            }

            return;
        }

        if (!target) return;

        event.stopPropagation();

        if (type === "down") {
            event.preventDefault();

            let root = target;

            while (root.parent) root = root.parent;

            this.bringToFront(root);
            this.pressed = target;
            target.onMouseDown(this.toLocal(target, event));
        } else if (type === "up") target.onMouseUp(this.toLocal(target, event));
        else target.onMouseMove(this.toLocal(target, event));
    }

    protected cancelMouse() {
        if (this.pressed) this.pressed.onMouseCancel();
        if (this.dragged && this.dragged.windowName && (this.dragged.x !== this.dragStartX || this.dragged.y !== this.dragStartY)) this.saveWindowPosition(this.dragged.windowName, this.dragged.x, this.dragged.y);

        this.dragged = null;
        this.pressed = null;
        this.invalidate();
    }

    public getSysString(id: number): string { return this.strings.sysStrings[id] ?? ""; } // GL2GameData+0x9871c+id*12 in NWindow is the sysstring-e.dat table.
    public getSystemMessage(id: number): string { return this.strings.systemMessages[id] ?? ""; }

    public filterText(value: string) {
        const replacement = this.getSysString(740);
        let text = "";

        for (let i = 0; i < value.length; i++) {
            const character = value[i];

            if (character === "\r" || character === "\n" || this.canvas.hasGlyphs(character)) text += character;
        }

        let search = text.replace(/[A-Z]/g, character => character.toLowerCase());

        this.strings.obsceneWords.forEach(word => {
            if (!word) return;

            let index = search.indexOf(word);

            while (index >= 0) {
                text = text.slice(0, index) + replacement + text.slice(index + word.length);
                search = search.slice(0, index) + replacement + search.slice(index + word.length);
                index = search.indexOf(word);
            }
        });

        return text;
    }

    public getClassName(classId: number): string { return this.getSysString(classId >= 0 && classId < 88 ? 247 + classId : 1071 + classId); } // 0x1006b250: class names are sysstrings 247+id below class 88, 1071+id above.

    public isHovered(wnd: NWnd) { return this.hovered === wnd; }
    public isPressed(wnd: NWnd) { return this.pressed === wnd; }

    public render() {
        if (!this.isReady) return;

        const hasOverlay = this.overlayPaint !== null;

        if (!this.isDirty && !hasOverlay && !this.canvas.isAnimating) return;

        const canvas = this.canvas;

        canvas.beginFrame();

        if (hasOverlay) this.overlayPaint(canvas);

        for (const wnd of this.windows) wnd.paint(canvas);

        this.isDirty = false;
    }
}

export default NWindowManager;
