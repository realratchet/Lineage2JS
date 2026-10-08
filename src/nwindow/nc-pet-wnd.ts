import NDomLayer, { NDOM_SCROLL_TEXTURES, NDomButton_T, NDomScrollPane_T } from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCTooltip from "./nc-tooltip";
import { FontType_T } from "./nwindow-canvas";
import NCInventoryWnd, { InventoryEntry_T } from "./nc-inventory-wnd";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";
import type { PetStatus_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.PetWnd.Petinterface_back";
const TEX_TAB = "L2UI_CH3.PetWnd.petinterface_tab2";
const TEX_TAB_SELECTED = "L2UI_CH3.PetWnd.petinterface_tab1";
const TEX_FOLDED = "L2UI_CH3.PetWnd.PetIcon";
const TEX_CAPTION = "NWindow.Icon.chatback";
const TEX_OUTLINE = "L2UI_CH3.InventoryWnd.Inventory_OutLine";
const TEX_PRESSED = "L2UI_CH3.InventoryWnd.Inventory_OutLine_down";
const TEX_SELECTED = "L2UI.NWindow.item_click";
const TEX_EQUIPPED = "L2UI_CH3.PetWnd.petitem_click";
const TEX_BUTTON = "L2UI_CH3.BUTTON.btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.BUTTON.btn1_normalon";
const arrBars = ["ps_HPbar", "ps_MPbar", "ps_ExPbar", "ps_foodbar"].map(name => `L2UI_CH3.PlayerStatusWnd.${name}`);
const arrWeight = [1, 2, 3, 4].map(index => `L2UI_CH3.PlayerStatusWnd.ps_weightbar${index}`);
const arrLabels = [94, 95, 96, 113, 111, 404, 98, 99, 97, 432, 112, 496];
const arrGrades = ["", "graded", "gradec", "gradeb", "gradea", "grades"];
export type PetInventoryEntry_T = InventoryEntry_T & { isEquipped: boolean };
type PetDrag_T = { item: InventoryEntry_T, isDragging: boolean };

function formatPercent(value: number) {
    return `${Number.isNaN(value) ? "-1.#J" : Number.isFinite(value) ? value.toFixed(2) : value < 0 ? "-1.#J" : "1.#J"}%`;
}

export class NCPetWnd {
    public static getTextures(): string[] { return [TEX_BACK + "1", TEX_BACK + "2", TEX_BACK + "31", TEX_BACK + "32", TEX_BACK + "33", TEX_TAB, TEX_TAB_SELECTED, `${TEX_TAB}_over`, TEX_FOLDED, TEX_CAPTION, TEX_OUTLINE, TEX_PRESSED, TEX_SELECTED, TEX_EQUIPPED, TEX_BUTTON, TEX_BUTTON_DOWN, "L2UI.NWindow.Number", ...arrBars, ...arrWeight, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES, ...new NCTooltip().getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly inventoryGrid: NDomScrollPane_T;
    public onUseItem: (objectId: number) => void = null;
    public onGetItem: (item: InventoryEntry_T) => void = null;
    public onRename: () => void = null;
    public onAction: (id: number, ctrl: boolean, shift: boolean) => void = null;
    public onDropItem: (objectId: number, clientX: number, clientY: number) => boolean = null;
    public onHideBag: (owner: HTMLElement) => void = null;
    protected readonly folded: HTMLDivElement;
    protected readonly caption: HTMLDivElement;
    protected readonly rename: NDomButton_T;
    protected readonly panes: HTMLDivElement[] = [];
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly actionGrid: HTMLDivElement;
    protected readonly values: HTMLCanvasElement;
    protected readonly stats: HTMLCanvasElement;
    protected readonly bars: HTMLDivElement[];
    protected readonly frames: HTMLDivElement[] = [];
    protected info: PetStatus_T = null;
    protected items: PetInventoryEntry_T[] = [];
    protected order: number[] = [];
    protected tab = 0;
    protected selected = -1;
    protected highlighted = -1;
    protected canRename = true;
    protected actionsReady = false;
    protected pressedAction: HTMLDivElement = null;
    protected drag: PetDrag_T = null;
    protected isDoubleClick = false;

    public constructor(protected readonly layer: NDomLayer, protected readonly inventory: NCInventoryWnd) {
        const manager = layer.getManager();

        this.element = layer.createWindow(172, 76, 256, 229);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        const title = NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(494), false, () => this.setVisible(false));
        const frame = title.parentElement;
        const minimize = layer.button(frame, 216, 3, 15, 15, "L2UI_CH3.FrameCtrl.FrameMiniBtn", "L2UI_CH3.FrameCtrl.FrameMiniOnBtn", null, null, () => this.minimize());

        minimize.setAttribute("aria-label", "Minimize");
        minimize.addEventListener("mousedown", event => event.stopPropagation());
        this.element.addEventListener("keydown", event => {
            if (event.key !== "Escape") return;

            event.stopImmediatePropagation();
            this.setVisible(false);
        }, true);
        layer.tile(this.element, 0, 20, 256, 95, 0, 0, 256, 95, TEX_BACK + "1");
        layer.tile(this.element, 0, 115, 256, 23, 0, 0, 256, 23, TEX_BACK + "2");
        this.bars = [[35, 51], [35, 65], [35, 79], [35, 93], [156, 51]].map(([x, y], index) => layer.tile(this.element, x, y, 0, 12, 0, 0, 8, 12, index === 4 ? arrWeight[0] : arrBars[index]));
        this.values = this.createCanvas(this.element, 256, 115);
        this.rename = layer.button(this.element, 167, 28, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(497), () => { if (this.onRename) this.onRename(); });
        this.rename.setAttribute("aria-label", manager.getSysString(497));

        for (let index = 0; index < 3; index++) {
            const pane = layer.createWindow(0, 138, 256, 91, this.element);

            layer.tile(pane, 0, 0, 256, 91, 0, 0, 256, 91, TEX_BACK + (31 + index));
            this.panes.push(pane);
            this.tabs.push(layer.tab(this.element, 12 + index * 74, 115, 74, 23, TEX_TAB, TEX_TAB_SELECTED, manager.getSysString(491 + index), null, () => this.selectTab(index)));
        }
        this.stats = this.createCanvas(this.panes[0], 256, 91);
        this.actionGrid = layer.createWindow(18, 9, 219, 69, this.panes[1]);
        this.actionGrid.style.overflow = "hidden";
        this.inventoryGrid = layer.scrollPane(this.panes[2], 18, 9, 235, 69, 35);
        this.inventoryGrid.tabIndex = -1;
        this.selectTab(0);

        this.folded = layer.createWindow(172, 76, 32, 32);
        this.folded.hidden = true;
        this.folded.tabIndex = -1;
        this.folded.classList.add("ndom-opaque");
        this.folded.setAttribute("aria-label", manager.getSysString(506));
        layer.tile(this.folded, 0, 0, 32, 32, 0, 0, 32, 32, TEX_FOLDED);
        const captionText = manager.getSysString(506), width = layer.measureText(captionText), height = manager.canvas.getLineHeight(), texture = manager.canvas.getTexture(TEX_CAPTION);

        this.caption = layer.createWindow(0, 32, width, height, this.folded);
        this.caption.hidden = true;
        this.caption.style.pointerEvents = "none";
        layer.tile(this.caption, 0, 0, width, height, 0, 0, texture.width, texture.height, TEX_CAPTION);
        layer.text(this.caption, captionText, 0xffdcdcdc, FontType_T.SMALL, 0, 0);
        this.folded.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            this.folded.focus();
            const x = layer.toUI(event.clientX) - this.folded.offsetLeft, y = layer.toUI(event.clientY) - this.folded.offsetTop;
            let moved = false;

            layer.beginDrag(move => {
                moved = true;
                layer.place(this.folded, layer.toUI(move.clientX) - x, layer.toUI(move.clientY) - y);
                this.placeCaption();
            }, up => {
                if (moved) { this.element.focus(); this.folded.blur(); return; }
                if (up.type !== "mouseup" && up.type !== "pointerup" || (up as MouseEvent).button !== 0) return;

                manager.playWindowSound();
                this.setVisible(true);
                this.element.focus();
            });
        });
        window.addEventListener("mousemove", event => {
            if (!this.folded.hidden && !(event.buttons & 1)) {
                const rect = this.folded.getBoundingClientRect();

                this.caption.hidden = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
                this.placeCaption();
            }
            if (!this.drag) return;
            if (!(event.buttons & 1)) { this.endDrag(); return; }
            if (this.drag.isDragging) return;

            this.drag.isDragging = true;
            this.inventory.hideTooltip();
            document.documentElement.style.cursor = `url(${layer.getWrapUrl(this.drag.item.icon)}) 16 16, default`;
            document.documentElement.classList.add("ndom-item-drag");
        }, true);
        window.addEventListener("mouseup", event => {
            if (!this.drag || event.button !== 0) return;

            const drag = this.drag;

            this.endDrag();
            if (drag.isDragging) this.dropItem(drag.item, event);
        }, true);
    }

    protected createCanvas(parent: HTMLElement, width: number, height: number): HTMLCanvasElement {
        const canvas = document.createElement("canvas");

        canvas.className = "ndom-text ndom-absolute";
        canvas.style.pointerEvents = "none";
        this.layer.place(canvas, 0, 0, width, height);
        parent.appendChild(canvas);
        return canvas;
    }

    protected getContext(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
        const scale = this.layer.getManager().canvas.scale;

        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const context = canvas.getContext("2d");

        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.imageSmoothingEnabled = false;
        return context;
    }

    public isVisible() { return !this.element.hidden; }
    public getItemOwner() { return this.inventoryGrid; }
    public setRenameAvailable(available: boolean) {
        this.canRename = available;
        if (!available) this.rename.hidden = true;
    }

    public setVisible(visible: boolean) {
        if (visible && !this.folded.hidden) this.layer.place(this.element, this.folded.offsetLeft, this.folded.offsetTop);
        this.folded.hidden = true;
        this.caption.hidden = true;
        this.element.hidden = !visible;
        if (visible) {
            this.rename.hidden = !this.canRename;
            this.selectTab(this.tab);
            this.paintActions();
        } else {
            if (this.onHideBag) this.onHideBag(this.inventoryGrid);
            this.inventory.hideTooltip();
            this.endDrag();
            this.clearAction();
        }
    }

    protected minimize() {
        this.layer.place(this.folded, Math.max(0, this.element.offsetLeft), this.element.offsetTop);
        this.setVisible(false);
        this.folded.hidden = false;
        this.folded.focus();
        this.placeCaption();
    }

    protected placeCaption() {
        this.layer.place(this.caption, Math.min(0, this.layer.getManager().canvas.width - parseFloat(this.caption.style.width) - this.folded.offsetLeft), 32);
    }

    protected selectTab(index: number) {
        if (this.tab === 2 && index !== 2 && this.onHideBag) this.onHideBag(this.inventoryGrid);
        this.tab = index;
        this.inventory.hideTooltip();
        this.endDrag();
        this.clearAction();
        this.panes.forEach((pane, i) => pane.hidden = i !== index);
        this.tabs.forEach((tab, i) => {
            tab.setTextures(i === index ? TEX_TAB_SELECTED : TEX_TAB, TEX_TAB_SELECTED);
            tab.setAttribute("aria-pressed", String(i === index));
        });
    }

    public setInfo(info: PetStatus_T) {
        this.info = info;
        this.paint();
    }

    protected drawText(context: CanvasRenderingContext2D, x: number, y: number, text: string, color: number, align: CanvasTextAlign = "left", digits = false) {
        const width = this.layer.measureText(text), canvas = this.layer.getManager().canvas;

        if (align === "right") x -= width;
        else if (align === "center") x -= Math.trunc(width / 2);
        if (digits) canvas.renderDigits(context, x, y, color, text);
        else canvas.renderText(context, x, y, color, text);
    }

    protected paint() {
        const context = this.getContext(this.values, 256, 115), stats = this.getContext(this.stats, 256, 91), info = this.info;

        this.bars.forEach(bar => bar.hidden = true);
        if (!info) return;

        const expDelta = (info.exp - info.minExp) | 0, expSpan = (info.nextExp - info.minExp) | 0;
        const weightWidth = info.maxWeight ? Math.trunc(Math.imul(info.weight, 85) / info.maxWeight) : 0;
        const weight = weightWidth > 0 ? info.weight / info.maxWeight * 100 : 0;
        const weightIndex = weight > 80 ? 3 : weight > 66.66 ? 2 : weight > 50 ? 1 : 0;
        const widths = [info.maxHp ? Math.trunc(Math.imul(info.curHp, 85) / info.maxHp) : 0, info.maxMp ? Math.trunc(Math.imul(info.curMp, 85) / info.maxMp) : 0, info.nextExp ? Math.trunc(expDelta * 206 / expSpan) | 0 : 0, info.maxFood ? Math.trunc(Math.imul(info.curFood, 206) / info.maxFood) : 0, weightWidth];

        widths.forEach((width, index) => {
            const bar = this.bars[index], maximum = index === 2 || index === 3 ? 206 : 85;

            bar.hidden = width <= 0 || !Number.isFinite(width);
            if (bar.hidden) return;

            const overflow = width > maximum, w = index === 4 ? width : Math.min(width, maximum), h = overflow && (index === 1 || index === 3) ? 10 : 12;
            const sourceWidth = index === 2 && !overflow ? width : index === 1 && overflow ? 84 : 8;

            this.layer.place(bar, index === 4 ? 156 : 35, [51, 65, 79, 93, 51][index], w, h);
            this.layer.setTile(bar, w, h, 0, 0, sourceWidth, h, index === 4 ? arrWeight[weightIndex] : arrBars[index]);
        });
        this.drawText(context, 15, 35, this.layer.getManager().getSysString(88), 0xffa3a3a3);
        this.drawText(context, 33, 35, `${info.level} ${info.name || "(null)"}`, 0xffb09b79);
        for (const [y, current, maximum] of [[53, info.curHp, info.maxHp], [67, info.curMp, info.maxMp]]) {
            this.drawText(context, 67, y, String(current), 0xffdcdcdc, "right", true);
            this.drawText(context, 77, y, "/", 0xffdcdcdc, "center", true);
            this.drawText(context, 83, y, String(maximum), 0xffdcdcdc, "left", true);
        }
        this.drawText(context, 138, 81, formatPercent(expDelta * 100 / expSpan), 0xffb4b4b4, "center", true);
        this.drawText(context, 138, 95, formatPercent(info.curFood * 100 / info.maxFood), 0xffb4b4b4, "center", true);
        this.drawText(context, 198, 53, `${weight.toFixed(2)}%`, 0xffdcdcdc, "center", true);
        this.drawText(context, 198, 66, String(info.field42), 0xffb09b79, "center");
        const values = [info.pAtk, info.pDef, info.accuracy, info.critical, info.attackSpeed, info.soulshotsUsed, info.mAtk, info.mDef, info.evasion, info.speed, info.castSpeed, info.spiritshotsUsed];

        values.forEach((value, index) => {
            const y = 3 + index % 6 * 14;

            this.drawText(stats, index < 6 ? 17 : 132, y, this.layer.getManager().getSysString(arrLabels[index]), 0xffa3a3a3);
            this.drawText(stats, index < 6 ? 89 : 218, y, String(value), 0xffb09b79, "center");
        });
    }

    public async setActions(strings: GameStrings_T) {
        this.actionsReady = false;
        await this.layer.loadTextures([...new Set(Object.values(strings.actions).filter(action => action.category === 4).map(action => action.icon))]);
        this.actionsReady = true;
        if (this.isVisible()) this.paintActions();
    }

    protected clearAction() {
        if (this.pressedAction) this.pressedAction.hidden = true;
        this.pressedAction = null;
    }

    protected paintActions() {
        this.clearAction();
        this.actionGrid.replaceChildren();
        this.panes[1].querySelectorAll(".ndom-tooltip").forEach(tooltip => tooltip.remove());
        if (!this.actionsReady || !this.info || this.info.objectId === -1 || this.info.statusType !== 2) return;

        let index = 0;
        const strings = this.layer.getManager().strings;

        for (const [id, action] of Object.entries(strings.actions)) {
            if (action.category !== 4 || action.allowedNpcIds[0] !== -2 && !action.allowedNpcIds.includes(this.info.npcId)) continue;

            const button = document.createElement("button");

            button.type = "button";
            button.draggable = false;
            button.className = "ndom-inventory-item";
            button.dataset.actionId = id;
            button.dataset.icon = action.icon;
            button.setAttribute("aria-label", action.command);
            this.layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, 37, 35);
            this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, action.icon);
            this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE);
            const pressed = this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_PRESSED);

            pressed.hidden = true;
            this.layer.tooltip(this.panes[1], button, NCTooltip.action(strings, Number(id)));
            button.addEventListener("mousedown", event => {
                if (event.button !== 0 || event.detail === 2) return;

                this.clearAction();
                this.pressedAction = pressed;
                pressed.hidden = false;
                this.layer.getManager().playPickupSound();
                const release = (up: MouseEvent) => {
                    if (up.button !== 0) return;

                    window.removeEventListener("mouseup", release, true);
                    const active = this.pressedAction === pressed;

                    this.clearAction();
                    if (active && button.contains(up.target as Node) && this.onAction) this.onAction(Number(id), up.ctrlKey, up.shiftKey);
                };
                window.addEventListener("mouseup", release, true);
            });
            button.addEventListener("contextmenu", event => event.preventDefault());
            this.actionGrid.appendChild(button);
            index++;
        }
    }

    public async setItems(items: PetInventoryEntry_T[], isFull = false) {
        if (isFull) { this.order.length = 0; this.selected = -1; this.highlighted = -1; }
        this.order = this.order.filter(id => items.some(item => item.objectId === id));
        for (const item of items) if (!this.order.includes(item.objectId)) this.order.push(item.objectId);
        this.items = items;
        const symbols = this.layer.getManager().strings.symbols;

        await this.layer.loadTextures([...new Set(items.flatMap(item => item.info.crystalType > 0 ? [item.icon, symbols[arrGrades[item.info.crystalType]]] : [item.icon]))]);
        if (this.items !== items) return;

        this.paintItems(!isFull);
    }

    protected paintItems(preserveScroll = true) {
        this.inventoryGrid.content.replaceChildren();
        this.frames.length = 0;
        this.order.forEach((id, index) => {
            const item = this.items.find(entry => entry.objectId === id), button = document.createElement("button");

            button.type = "button";
            button.draggable = false;
            button.className = "ndom-inventory-item";
            button.dataset.objectId = String(id);
            button.setAttribute("aria-label", item.name);
            this.layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, 34, 34);
            this.frames.push(this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_SELECTED));
            this.frames[index].hidden = id !== this.highlighted;
            this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE);
            this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, item.icon);
            if (item.isEquipped) this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, TEX_EQUIPPED);
            button.addEventListener("mousedown", event => {
                if (event.button === 2) {
                    this.selected = index;
                    if (this.onUseItem) this.onUseItem(item.objectId);
                    this.endDrag();
                    return;
                }
                if (event.button !== 0 || event.detail === 2) return;

                this.selectItem(index);
                if (this.isDoubleClick) this.isDoubleClick = false;
                else {
                    this.drag = { item, isDragging: false };
                    this.layer.getManager().playPickupSound();
                }
                this.inventory.showTooltip(item, button, true);
            });
            button.addEventListener("dblclick", event => {
                if (event.button !== 0) return;

                this.isDoubleClick = true;
                this.endDrag();
                if (this.onUseItem) this.onUseItem(item.objectId);
                this.selectItem(-1);
            });
            button.addEventListener("contextmenu", event => event.preventDefault());
            button.addEventListener("mouseenter", () => { if (!this.drag || !this.drag.isDragging) this.inventory.showTooltip(item, button, true); });
            button.addEventListener("mouseleave", () => this.inventory.hideTooltip());
            this.inventoryGrid.content.appendChild(button);
        });
        this.inventoryGrid.setContentHeight(Math.ceil(this.order.length / 6) * 35, preserveScroll);
    }

    protected selectItem(index: number) {
        this.selected = index;
        this.highlighted = index < 0 ? -1 : this.order[index];
        this.frames.forEach((frame, i) => frame.hidden = i !== index);
    }

    protected endDrag() {
        if (!this.drag) return;

        this.drag = null;
        document.documentElement.style.cursor = "";
        document.documentElement.classList.remove("ndom-item-drag");
    }

    protected dropItem(item: InventoryEntry_T, event: MouseEvent) {
        const rect = this.inventoryGrid.getBoundingClientRect();
        const x = this.layer.toUI(event.clientX - rect.left), y = this.layer.toUI(event.clientY - rect.top);

        if (x >= 0 && y >= 0 && x <= 235 && y <= 69) {
            const source = this.order.indexOf(item.objectId);
            const index = x < 1 || y < 1 || x > 223 || y > 71 ? -1 : (Math.trunc(this.inventoryGrid.getScroll() / 35) + Math.min(1, Math.trunc((y - 1) / 35))) * 6 + Math.min(5, Math.trunc((x - 1) / 37));

            if (source < 0 || source === index) return;
            const append = index < 0 || index >= this.order.length;

            this.order.splice(source, 1);
            if (append) { this.order.push(item.objectId); this.selected = this.order.length - 1; }
            else this.order.splice(index, 0, item.objectId);
            this.paintItems();
            return;
        }
        if (this.inventory.isItemDropTarget(event.target as Node)) {
            if (this.onGetItem) this.onGetItem(item);
            return;
        }
        if (this.onDropItem && this.onDropItem(item.objectId, event.clientX, event.clientY)) this.selectItem(-1);
    }
}

export default NCPetWnd;
