import NDomLayer, { NDomButton_T } from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCTooltip from "./nc-tooltip";
import { FontType_T } from "./nwindow-canvas";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";
import type { PetStatus_T } from "../network/game-packets";
import type { InventoryWndView_T } from "./skin";

const TEX_BACK = "L2UI_CH3.SummonWnd.summon_back";
const TEX_TAB = "L2UI_CH3.SummonWnd.summon_tab2";
const TEX_TAB_SELECTED = "L2UI_CH3.SummonWnd.summon_tab1";
const TEX_FOLDED = "L2UI_CH3.SummonWnd.SummonIcon";
const TEX_CAPTION = "NWindow.Icon.chatback";
const TEX_OUTLINE = "L2UI_CH3.InventoryWnd.Inventory_OutLine";
const TEX_PRESSED = "L2UI_CH3.InventoryWnd.Inventory_OutLine_down";
const arrBars = ["ps_HPbar", "ps_MPbar"].map(name => `L2UI_CH3.PlayerStatusWnd.${name}`);
const arrLabels = [94, 95, 96, 113, 111, 404, 98, 99, 97, 432, 112, 496];

export class NCSummonedWnd {
    public static getTextures(): string[] { return [TEX_BACK + "1", TEX_BACK + "2", TEX_BACK + "31", TEX_BACK + "32", TEX_TAB, TEX_TAB_SELECTED, `${TEX_TAB}_over`, TEX_FOLDED, TEX_CAPTION, TEX_OUTLINE, TEX_PRESSED, "L2UI.NWindow.Number", ...arrBars, ...NCFrameCtrl.getTextures(), ...new NCTooltip().getTextures()]; }
    public readonly element: HTMLDivElement;
    public onAction: (id: number, ctrl: boolean, shift: boolean) => void = null;
    protected readonly folded: HTMLDivElement;
    protected readonly caption: HTMLDivElement;
    protected readonly panes: HTMLDivElement[] = [];
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly actionGrid: HTMLDivElement;
    protected readonly values: HTMLDivElement;
    protected readonly stats: HTMLDivElement;
    protected readonly bars: HTMLDivElement[];
    protected info: PetStatus_T = null;
    protected tab = 0;
    protected actionsReady = false;
    protected pressedAction: HTMLDivElement = null;

    public constructor(protected readonly layer: NDomLayer, protected readonly inventory: InventoryWndView_T) {
        const manager = layer.getManager();

        this.element = layer.createWindow(172, 76, 256, 201);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        const title = NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(495), false, () => this.setVisible(false));
        const frame = title.parentElement;
        const minimize = layer.button(frame, 216, 3, 15, 15, "L2UI_CH3.FrameCtrl.FrameMiniBtn", "L2UI_CH3.FrameCtrl.FrameMiniOnBtn", null, null, () => this.minimize());

        minimize.setAttribute("aria-label", "Minimize");
        minimize.addEventListener("mousedown", event => event.stopPropagation());
        this.element.addEventListener("keydown", event => {
            if (event.key !== "Escape") return;

            event.stopImmediatePropagation();
            this.setVisible(false);
        }, true);
        layer.tile(this.element, 0, 20, 256, 67, 0, 0, 256, 67, TEX_BACK + "1");
        layer.tile(this.element, 0, 87, 256, 23, 0, 0, 256, 23, TEX_BACK + "2");
        this.bars = [[35, 51], [35, 65]].map(([x, y], index) => layer.tile(this.element, x, y, 0, 12, 0, 0, 8, 12, arrBars[index]));
        this.values = this.createValues(this.element, 256, 87);

        for (let index = 0; index < 2; index++) {
            const pane = layer.createWindow(0, 110, 256, 91, this.element);

            layer.tile(pane, 0, 0, 256, 91, 0, 0, 256, 91, TEX_BACK + (31 + index));
            this.panes.push(pane);
            this.tabs.push(layer.tab(this.element, 12 + index * 74, 87, 74, 23, TEX_TAB, TEX_TAB_SELECTED, manager.getSysString(491 + index), null, () => this.selectTab(index)));
        }
        this.stats = this.createValues(this.panes[0], 256, 91);
        this.actionGrid = layer.createWindow(18, 9, 219, 69, this.panes[1]);
        this.actionGrid.style.overflow = "hidden";
        this.selectTab(0);

        this.folded = layer.createWindow(172, 76, 32, 32);
        this.folded.hidden = true;
        this.folded.tabIndex = -1;
        this.folded.classList.add("ndom-opaque");
        this.folded.setAttribute("aria-label", manager.getSysString(505));
        layer.tile(this.folded, 0, 0, 32, 32, 0, 0, 32, 32, TEX_FOLDED);
        const captionText = manager.getSysString(505), width = layer.measureText(captionText), height = manager.canvas.getLineHeight(), texture = manager.canvas.getTexture(TEX_CAPTION);

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
        }, true);
    }

    protected createValues(parent: HTMLElement, width: number, height: number): HTMLDivElement {
        const values = this.layer.createWindow(0, 0, width, height, parent);

        values.style.pointerEvents = "none";
        return values;
    }

    public isVisible() { return !this.element.hidden; }

    public setVisible(visible: boolean) {
        if (visible && !this.folded.hidden) this.layer.place(this.element, this.folded.offsetLeft, this.folded.offsetTop);
        this.folded.hidden = true;
        this.caption.hidden = true;
        this.element.hidden = !visible;
        if (visible) {
            this.selectTab(this.tab);
            this.paintActions();
        } else {
            this.inventory.hideTooltip();
            this.clearAction();
            this.actionGrid.replaceChildren();
            this.panes[1].querySelectorAll(".ndom-tooltip").forEach(tooltip => tooltip.remove());
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
        this.tab = index;
        this.inventory.hideTooltip();
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

    protected drawText(parent: HTMLElement, x: number, y: number, text: string, color: number, align: CanvasTextAlign = "left", digits = false) {
        const width = this.layer.measureText(text);

        if (align === "right") x -= width;
        else if (align === "center") x -= Math.trunc(width / 2);
        if (digits) this.layer.digits(parent, text, color, undefined, x, y);
        else this.layer.text(parent, text, color, FontType_T.SMALL, Math.trunc(x), Math.trunc(y));
    }

    protected paint() {
        const panel = this.values, stats = this.stats, info = this.info;

        panel.replaceChildren();
        stats.replaceChildren();

        this.bars.forEach(bar => bar.hidden = true);
        if (!info) return;

        const widths = [info.maxHp ? Math.trunc(Math.imul(info.curHp, 85) / info.maxHp) : 0, info.maxMp ? Math.trunc(Math.imul(info.curMp, 85) / info.maxMp) : 0];

        widths.forEach((width, index) => {
            const bar = this.bars[index];

            bar.hidden = width <= 0;
            if (bar.hidden) return;

            const overflow = index === 1 && width > 85, w = Math.min(width, 85), h = overflow ? 10 : 12;

            this.layer.place(bar, 35, index === 0 ? 51 : 65, w, h);
            this.layer.setTile(bar, w, h, 0, 0, overflow ? 84 : 8, h, arrBars[index]);
        });
        this.drawText(panel, 15, 35, this.layer.getManager().getSysString(88), 0xffa3a3a3);
        this.drawText(panel, 33, 35, `${info.level} ${info.name || "(null)"}`, 0xffb09b79);
        for (const [y, current, maximum] of [[53, info.curHp, info.maxHp], [67, info.curMp, info.maxMp]]) {
            this.drawText(panel, 67, y, String(current), 0xffdcdcdc, "right", true);
            this.drawText(panel, 77, y, "/", 0xffdcdcdc, "center", true);
            this.drawText(panel, 83, y, String(maximum), 0xffdcdcdc, "left", true);
        }
        const values = [info.pAtk, info.pDef, info.accuracy, info.critical, info.attackSpeed, info.soulshotsUsed, info.mAtk, info.mDef, info.evasion, info.speed, info.castSpeed, info.spiritshotsUsed];

        values.forEach((value, index) => {
            const y = 3 + index % 6 * 14;

            this.drawText(stats, index < 6 ? 17 : 132, y, this.layer.getManager().getSysString(arrLabels[index]), 0xffa3a3a3);
            this.drawText(stats, index < 6 ? 89 : 214, y, String(value), 0xffb09b79, "center");
        });
    }

    public async setActions(strings: GameStrings_T) {
        this.actionsReady = false;
        await this.layer.loadTextures([...new Set(Object.values(strings.actions).filter(action => action.category === 5).map(action => action.icon))]);
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
        if (!this.actionsReady || !this.info || this.info.objectId === -1 || this.info.statusType !== 1) return;

        let index = 0;
        const strings = this.layer.getManager().strings;

        for (const [id, action] of Object.entries(strings.actions)) {
            if (action.category !== 5 || action.allowedNpcIds[0] !== -2 && !action.allowedNpcIds.includes(this.info.npcId)) continue;

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

}

export default NCSummonedWnd;
