import type NDomLayer from "./ndom";
import { NDOM_SCROLL_TEXTURES, type NDomScrollPane_T } from "./ndom";

type TaskEntry_T = { name: string, isUnread: boolean, created: number };
const TEX_BACK = "L2UI_CH3.msn6_back";
const TEX_BAR = "L2UI_CH3.FrameCtrl.smallbar";
const TEX_BUTTON = "L2UI_CH3.Msn.msnbutton";

export class L2TaskWnd {
    public static getTextures() { return [`${TEX_BACK}1`, `${TEX_BACK}2`, `${TEX_BACK}3`, `${TEX_BAR}1`, `${TEX_BAR}2`, `${TEX_BAR}3`, TEX_BUTTON, `${TEX_BUTTON}_down`, `${TEX_BUTTON}_light`, ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onOpen: (name: string) => void = null;
    protected readonly list: NDomScrollPane_T;
    protected readonly arrEntries: TaskEntry_T[] = [];
    protected readonly cacheEntries = new Map<string, TaskEntry_T>();
    protected selected = -1;
    protected isHeld = false;

    public constructor(protected readonly layer: NDomLayer) {
        const canvas = layer.getManager().canvas;

        this.element = layer.createWindow(canvas.width - 172, canvas.height - 414, 172, 132, layer.consoleRoot);
        this.element.hidden = true;
        this.element.style.overflow = "hidden";
        layer.tile(this.element, 12, 0, 180, 8, 0, 0, 180, 8, `${TEX_BACK}1`);
        layer.tile(this.element, 12, 8, 180, 116, 0, 0, 180, 8, `${TEX_BACK}2`);
        layer.tile(this.element, 12, 124, 180, 8, 0, 0, 180, 8, `${TEX_BACK}3`);
        const grip = layer.createWindow(0, 0, 12, 132, this.element);

        layer.tile(grip, 0, 0, 12, 8, 0, 0, 12, 8, `${TEX_BAR}1`);
        layer.tile(grip, 0, 8, 12, 116, 0, 0, 12, 8, `${TEX_BAR}2`);
        layer.tile(grip, 0, 124, 12, 8, 0, 0, 12, 8, `${TEX_BAR}3`);
        grip.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            const x = layer.toUI(event.clientX) - this.element.offsetLeft, y = layer.toUI(event.clientY) - this.element.offsetTop;

            layer.beginDrag(move => layer.place(this.element, layer.toUI(move.clientX) - x, layer.toUI(move.clientY) - y), () => { this.isHeld = false; });
            this.isHeld = true;
        });
        this.list = layer.scrollPane(this.element, 14, 3, 155, 126, 21, false, 6);
        const setScroll = this.list.setScroll;

        this.list.setScroll = (position, isClamped = true) => {
            setScroll(position, isClamped);
            this.list.content.style.top = "0px";
            this.paint();
        };
        this.list.addEventListener("wheel", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.list.setScroll(this.list.getScroll() + Math.trunc(event.deltaY / 120) * 21);
        }, true);
        this.list.content.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            this.selected = this.getEntryIndexAt(event);
            this.paint();
            layer.beginDrag(() => {}, release => {
                this.isHeld = false;
                const index = release instanceof MouseEvent && (release.type === "mouseup" || release.type === "pointerup") ? this.getEntryIndexAt(release) : -1;
                const entry = index >= 0 && index === this.selected ? this.arrEntries[index] : null;

                this.selected = -1;
                if (entry && this.onOpen) entry.isUnread = false;
                this.paint();
                if (entry && this.onOpen) this.onOpen(entry.name);
            });
            this.isHeld = true;
        });
    }

    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) {
        if (!isVisible && this.isHeld) this.layer.cancelDrag();
        this.element.hidden = !isVisible;
        if (isVisible) this.paint();
    }
    public setEntry(name: string, isUnread: boolean) {
        const entry = this.cacheEntries.get(name);

        if (entry) entry.isUnread = isUnread;
        else {
            const entry = { name, isUnread, created: performance.now() }, count = this.arrEntries.length, scroll = this.list.getScroll();

            this.cacheEntries.set(name, entry);
            this.arrEntries.push(entry);
            if (this.arrEntries.length > 300) this.arrEntries.shift();
            this.list.setContentHeight(this.arrEntries.length * 21);
            this.list.setScroll(scroll + (count >= 6 && count < 300 ? 21 : 0));
        }
        this.paint();
    }
    public removeEntry(name: string) {
        const index = this.arrEntries.findIndex(entry => entry.name === name);

        this.cacheEntries.delete(name);
        if (index !== -1) {
            const scroll = this.list.getScroll();

            this.arrEntries.splice(index, 1);
            this.list.setContentHeight(this.arrEntries.length * 21);
            this.list.setScroll(scroll - 21);
        }
        if (!this.cacheEntries.size) this.setVisible(false);
        this.paint();
    }
    public reset() {
        this.setVisible(false);
        this.arrEntries.length = 0;
        this.cacheEntries.clear();
        this.selected = -1;
        this.list.setContentHeight(0);
        this.list.setScroll(0);
    }

    protected getEntryIndexAt(event: MouseEvent) {
        const rect = this.list.getBoundingClientRect(), x = this.layer.toUI(event.clientX - rect.left), y = this.layer.toUI(event.clientY - rect.top);

        if (x < 0 || x > 155 || y < 0 || y > 126) return -1;

        const index = Math.trunc(this.list.getScroll() / 21) + Math.floor(y / 21);

        // NWindow 0x1013e740 updates selection on hit; empty rows retain the prior index.
        if (x < 155 && y < 126 && index < this.arrEntries.length) this.selected = index;

        return this.selected;
    }

    protected paint() {
        this.list.content.replaceChildren();
        const first = Math.trunc(this.list.getScroll() / 21);

        this.arrEntries.slice(first, first + 6).forEach((entry, index) => {
            const row = this.layer.createWindow(0, index * 21, 140, 21, this.list.content);

            row.tabIndex = 0;
            row.setAttribute("role", "button");
            row.setAttribute("aria-label", entry.name);
            row.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                if (this.onOpen) this.onOpen(entry.name);
            });

            this.layer.tile(row, 0, 0, 140, 21, 0, 0, 140, 21, first + index === this.selected ? `${TEX_BUTTON}_down` : TEX_BUTTON);
            const light = this.layer.tile(row, 0, 0, 140, 21, 0, 0, 140, 21, `${TEX_BUTTON}_light`);

            light.style.visibility = entry.isUnread && first + index !== this.selected ? "visible" : "hidden";
            light.style.animation = "l2-task-notification 2s steps(1, end) infinite";
            light.style.animationDelay = `${-((performance.now() - entry.created) % 2000)}ms`;
            let label = entry.name;

            if (this.layer.measureText(label) > 116) {
                const canvas = this.layer.getManager().canvas;
                let width = 0;

                label = "";
                for (let i = 0; i < entry.name.length; i++) {
                    const character = entry.name[i];

                    if (character === "\n") { label += character; break; }
                    if (!canvas.hasGlyphs(character)) continue;

                    width += this.layer.measureText(character);
                    if (width > 104) break;
                    label += character;
                }
                label += "...";
            }
            this.layer.text(row, label, 0xffdcdcdc, undefined, 7, 4);
        });
    }
}

export default L2TaskWnd;
