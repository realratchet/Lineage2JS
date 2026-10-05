import type NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";

const TEX_BACK = "L2UI_CH3.ActionWnd.Action_Back";
const TEX_OUTLINE = "L2UI.NWindow.Icon_Back";
const TEX_PRESSED = "L2UI.NWindow.Icon_Click";

export class NCActionWnd { // C4 NWindow RVA 0x506a0 (groups), 0x4d2a0 (labels).
    public static getTextures() { return [TEX_BACK, TEX_OUTLINE, TEX_PRESSED]; }
    public readonly element: HTMLDivElement;
    public onUse: (id: number) => void = null;
    public actionsReady = false;
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
        this.lists.forEach(list => list.replaceChildren());

        this.lists.forEach((list, category) => actions.filter(([, action]) => action.category === category + 1).forEach(([id, action], index) => {
            const layer = this.layer, button = document.createElement("button");

            button.type = "button";
            button.draggable = false;
            button.className = "ndom-inventory-item";
            button.dataset.actionId = id;
            button.title = action.name;
            button.setAttribute("aria-label", action.name);
            layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, 34, 34);
            layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, action.icon);
            const outline = layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE);

            button.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                layer.getManager().playButtonSound(true);
                layer.setTile(outline, 34, 34, 0, 0, 34, 34, TEX_PRESSED);
            });
            for (const type of ["mouseup", "mouseleave"]) button.addEventListener(type, () => layer.setTile(outline, 34, 34, 0, 0, 34, 34, TEX_OUTLINE));
            button.addEventListener("click", () => { if (this.onUse) this.onUse(Number(id)); });
            list.appendChild(button);
        }));
        this.actionsReady = true;
    }
}

export default NCActionWnd;
