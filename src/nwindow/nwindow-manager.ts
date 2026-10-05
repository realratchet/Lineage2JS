import "../../style/nwindow.scss";
import NWindowCanvas from "./nwindow-canvas";
import type NWnd from "./nwnd";
import type { NMouseEvent_T } from "./nwnd";
import type AssetManager from "../assets/asset-manager";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";

type TextInputHandler_T = { onTextInput(text: string): void, onTextSubmit(text: string): void, onTextBlur(): void };

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
    protected dragOffsetY = 0;
    protected isDirty = true;
    protected isReady = false;

    public overlayPaint: (canvas: NWindowCanvas) => void = null;
    public strings: GameStrings_T = { systemMessages: {}, systemMessageColors: {}, systemMessageSounds: {}, sysStrings: {}, serverNames: {}, skillIcons: {}, skillCastStyles: {}, actions: {}, logonSpots: [], classNames: {}, skillNames: {}, itemNames: {}, itemIcons: {} };

    public constructor(protected readonly asset: AssetManager) {
        this.canvas = new NWindowCanvas(asset);

        document.body.appendChild(this.canvas.element);

        this.textInput.className = "nwindow-text-input";
        this.textInput.autocomplete = "off";
        this.textInput.addEventListener("input", () => { if (this.textHandler) this.textHandler.onTextInput(this.textInput.value); });
        this.textInput.addEventListener("keydown", event => {
            event.stopPropagation();

            if (event.key === "Enter" && this.textHandler) this.textHandler.onTextSubmit(this.textInput.value);
            if (event.key === "Escape") this.textInput.blur();
        });
        this.textInput.addEventListener("keyup", event => event.stopPropagation());
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

        for (const wnd of this.windows) wnd.placeOnScreen(this.canvas.width, this.canvas.height);

        this.invalidate();
    }

    public async addWindow<T extends NWnd>(wnd: T): Promise<T> {
        const textures = new Set<string>();
        const collect = (node: NWnd) => {
            for (const texture of node.getTextures()) textures.add(texture);
            for (const child of node.children) collect(child);
        };

        collect(wnd);
        wnd.attach(this);
        this.windows.push(wnd);
        wnd.placeOnScreen(this.canvas.width, this.canvas.height);

        await this.canvas.loadTextures([...textures]);

        this.invalidate();

        return wnd;
    }

    public removeWindow(wnd: NWnd) {
        const index = this.windows.indexOf(wnd);

        if (index >= 0) this.windows.splice(index, 1);

        this.invalidate();
    }

    public bringToFront(wnd: NWnd) {
        const index = this.windows.indexOf(wnd);

        if (index < 0) return;

        this.windows.splice(index, 1);
        this.windows.push(wnd);
        this.invalidate();
    }

    public invalidate() { this.isDirty = true; }

    public playButtonSound(isEnabled: boolean): void {
        void this.asset.getParent().getComponent("audio").playInterfaceSound(isEnabled ? "InterfaceSound.click_01" : "ItemSound.click_failed"); // NWindow.dll 0x10001230, sound table 0x10242368.
    }

    public beginDrag(wnd: NWnd, x: number, y: number) {
        this.dragged = wnd;
        this.dragOffsetX = x - wnd.x;
        this.dragOffsetY = y - wnd.y;
    }

    public focusText(owner: NWnd & TextInputHandler_T, value: string, isPassword: boolean, maxLength: number) {
        this.textHandler = null;
        this.textOwner = owner;
        this.textInput.type = isPassword ? "password" : "text";
        this.textInput.maxLength = maxLength > 0 ? maxLength : 524288;
        this.textInput.value = value;
        this.textHandler = owner;
        this.textInput.focus();
        this.invalidate();
    }

    public blurText() { this.textInput.blur(); }
    public isTextFocused(owner: NWnd) { return this.textOwner === owner; }
    public getCaretPosition() { return this.textInput.selectionStart || 0; }

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
        return { x: this.canvas.toUI(event.clientX) - wnd.getScreenX(), y: this.canvas.toUI(event.clientY) - wnd.getScreenY(), button: event.button, shift: event.shiftKey, ctrl: event.ctrlKey };
    }

    protected onMouse(event: MouseEvent, type: "down" | "up" | "move") {
        if (type === "move" && !(event.buttons & 1) && (this.dragged || this.pressed)) this.cancelMouse();
        if (!this.dragged && !this.pressed && event.target instanceof Element && event.target.closest(".ndom-layer")) return;

        if (this.dragged) {
            if (type === "move") {
                this.dragged.x = Math.max(0, Math.min(this.canvas.width - this.dragged.width, this.canvas.toUI(event.clientX) - this.dragOffsetX));
                this.dragged.y = Math.max(0, Math.min(this.canvas.height - this.dragged.height, this.canvas.toUI(event.clientY) - this.dragOffsetY));
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
        if (this.pressed) this.pressed.onMouseLeave();

        this.dragged = null;
        this.pressed = null;
        this.invalidate();
    }

    public getSysString(id: number): string { return this.strings.sysStrings[id] ?? ""; } // GL2GameData+0x9871c+id*12 in NWindow is the sysstring-e.dat table.
    public getSystemMessage(id: number): string { return this.strings.systemMessages[id] ?? ""; }

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
