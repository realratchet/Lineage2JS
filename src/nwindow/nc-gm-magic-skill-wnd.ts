import NCFrameCtrl from "./nc-frame-ctrl";
import NCSkillWnd from "./nc-skill-wnd";
import type NDomLayer from "./ndom";
import type { GMViewSkillInfo_T } from "../network/game-packets";

class NCGMSkillWnd extends NCSkillWnd {
    public onDragMove: (event: MouseEvent) => void = null;
    public onDragEnd: () => void = null;
    protected scrollPositions = [0, 0];
    protected selectedIndices = [-1, -1];
    protected dragButton: HTMLElement = null;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        super(layer, new Map(), parent);
        layer.place(this.element, 0, 20, 256, 335);
        this.element.hidden = false;
        this.skillTabs.forEach(tab => {
            tab.addEventListener("mousedown", event => { if (event.button === 0) this.saveTabState(); }, true);
            tab.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") this.saveTabState(); }, true);
        });
        this.list.content.addEventListener("mousedown", event => {
            if (event.button === 0 && event.detail === 2) event.stopImmediatePropagation();
        }, true);
        this.list.content.addEventListener("click", event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
        this.list.content.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
        this.list.content.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            const button = (event.target as Element).closest("[data-skill-id]") as HTMLElement;

            if (!button) return;

            this.selectedIndices[this.isPassive ? 1 : 0] = Array.from(this.list.content.children).indexOf(button);
            this.dragButton = button;
            layer.beginDrag(moveEvent => {
                if (this.dragButton !== button) return;
                if (!this.isVisible() || !button.getClientRects().length) { this.cancelDrag(); return; }

                document.documentElement.style.cursor = `url(${layer.getWrapUrl(button.dataset.icon)}) 16 16, default`;
                document.documentElement.classList.add("ndom-item-drag");
                if (this.onDragMove) this.onDragMove(moveEvent);
                moveEvent.preventDefault();
            }, () => this.cancelDrag());
        });
    }

    public getSkills() { return this.skills; }
    public getGrid() { return this.list; }
    public clear() {
        this.cancelDrag();
        this.pendingSkills = this.skills = [];
        this.scrollPositions = [0, 0];
        this.selectedIndices = [-1, -1];
        this.paintSkills();
    }
    public cancelDrag() {
        if (!this.dragButton) return;

        this.dragButton = null;
        document.documentElement.style.cursor = "";
        document.documentElement.classList.remove("ndom-item-drag");
        if (this.onDragEnd) this.onDragEnd();
    }
    protected saveTabState() { this.scrollPositions[this.isPassive ? 1 : 0] = this.list.getScroll(); }
    protected paintSkills() {
        super.paintSkills();
        if (!this.scrollPositions) return;

        const side = this.isPassive ? 1 : 0;

        this.list.setScroll(this.scrollPositions[side]);
        const button = this.list.content.children[this.selectedIndices[side]] as HTMLElement;

        if (!button) return;

        this.pressedSelection = button.children[0] as HTMLDivElement;
        this.pressedSelection.hidden = false;
        this.pressedFrame = this.isPassive ? null : button.children[3] as HTMLDivElement;
        if (this.pressedFrame) this.pressedFrame.hidden = false;
    }
}

export class NCGMMagicSkillWnd {
    public static getTextures() { return [...NCFrameCtrl.getTextures(), ...NCSkillWnd.getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly skillWnd: NCGMSkillWnd;
    public onRequest: (targetName: string, kind: number) => void = null;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement = layer.root) {
        this.element = layer.createWindow(0, 100, 256, 355, parent);
        this.element.hidden = true;
        NCFrameCtrl.createDOM(layer, this.element, 256, "", false, () => this.setVisible(false));
        this.skillWnd = new NCGMSkillWnd(layer, this.element);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 209, 100); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (!visible) this.skillWnd.clear();
    }
    public toggle(targetName: string) {
        if (this.isVisible()) { this.setVisible(false); return; }

        if (this.onRequest) this.onRequest(targetName, 3);
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
    }
    public async setSkillInfo(info: GMViewSkillInfo_T) {
        this.skillWnd.clear();
        await this.skillWnd.setSkills(info.skills);
    }
}

export default NCGMMagicSkillWnd;
