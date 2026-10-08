import NCTooltip from "./nc-tooltip";
import type NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";

const TEX_BACK = "L2UI_CH3.ActionWnd.Action_Back";
const TEX_OUTLINE = "L2UI_CH3.InventoryWnd.Inventory_OutLine";
const TEX_PRESSED = "L2UI_CH3.InventoryWnd.Inventory_OutLine_down";

export class NCActionWnd { // C4 NWindow RVA 0x506a0 (groups), 0x4d2a0 (labels).
    public static getTextures() { return [TEX_BACK, TEX_OUTLINE, TEX_PRESSED, ...new NCTooltip().getTextures()]; }
    public readonly element: HTMLDivElement;
    public onUse: (id: number, ctrl: boolean, shift: boolean) => void = null;
    public actionsReady = false;
    protected classId = -1;
    protected canMount = false;
    protected pressedFrame: HTMLDivElement = null;
    protected readonly lists: HTMLDivElement[] = [];

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement) {
        this.element = layer.createWindow(0, 66, 256, 335, parent);
        layer.tile(this.element, 0, 0, 256, 335, 0, 0, 256, 335, TEX_BACK);
        [[129, 11, 25, 104], [130, 141, 155, 34], [204, 201, 215, 104]].forEach(([id, labelY, y, height]) => {
            layer.text(this.element, layer.getManager().getSysString(id), 0xffdcdcdc, FontType_T.SMALL, 22, labelY);
            const list = layer.createWindow(18, y, 219, height, this.element);

            list.style.overflow = "hidden";
            this.lists.push(list);
        });
    }

    public async setActions(strings: GameStrings_T) {
        const actions = Object.entries(strings.actions);

        this.actionsReady = false;
        await this.layer.loadTextures([...new Set(actions.map(([, action]) => action.icon))]);
        this.actionsReady = true;
        this.paintActions();
    }

    public setClass(classId: number) {
        if (this.classId === classId) return;

        this.classId = classId;
        if (this.actionsReady) this.paintActions();
    }

    public setMountable(canMount: boolean) {
        if (this.canMount === canMount) return;

        this.canMount = canMount;
        if (this.actionsReady) this.paintActions();
    }

    public clearSelection() {
        if (this.pressedFrame) this.pressedFrame.hidden = true;
        this.pressedFrame = null;
    }

    protected paintActions() { // NWindow RVA 0x50100: class-gated manufacture and mountable pet/mounted user.
        const actions = Object.entries(this.layer.getManager().strings.actions).filter(([id, action]) => (!action.requiresMount || this.canMount) && (Number(id) !== 37 || [53, 54, 55, 56, 57, 117, 118].includes(this.classId)));

        this.clearSelection();
        this.element.querySelectorAll(".ndom-tooltip").forEach(element => element.remove());
        this.lists.forEach(list => list.replaceChildren());

        this.lists.forEach((list, category) => actions.filter(([, action]) => action.category === category + 1).forEach(([id, action], index) => {
            const layer = this.layer, button = document.createElement("button");

            button.type = "button";
            button.draggable = false;
            button.className = "ndom-inventory-item";
            button.dataset.actionId = id;
            button.dataset.icon = action.icon;
            button.setAttribute("aria-label", action.command);
            layer.tooltip(this.element, button, NCTooltip.action(this.layer.getManager().strings, Number(id)));
            layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, index % 6 === 5 ? 38 : 37, 35);
            layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, action.icon);
            layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE);
            const frame = layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_PRESSED);

            frame.hidden = true;

            button.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                this.clearSelection();
                this.pressedFrame = frame;
                frame.hidden = false;
                layer.getManager().playPickupSound();
            });
            button.addEventListener("click", event => { if (this.onUse) this.onUse(Number(id), event.ctrlKey, event.shiftKey); });
            list.appendChild(button);
        }));
    }
}

export default NCActionWnd;
