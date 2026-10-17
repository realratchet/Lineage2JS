import NCListCtrl from "./nc-list-ctrl";
import NDomLayer, { type NDomCheckBox_T } from "./ndom";
import { SKIN_SLOTS } from "./skin-textures";

const TEX_BACK = "L2UI_CH3.ReplayListWnd.replay_back";

export class NCReplayWnd {
    public static getTextures(): string[] { return [TEX_BACK, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, SKIN_SLOTS.checkBox, SKIN_SLOTS.checkBoxChecked, ...NCListCtrl.getTextures()]; }

    public readonly element: HTMLDivElement;
    public onPlay: (name: string, lockCamera: boolean, showChat: boolean) => void = null;
    public onDelete: (name: string) => void = null;
    public onCancel: () => void = null;
    public onImport: (files: File[]) => void = null;

    protected readonly list: NCListCtrl;
    protected readonly lockCamera: NDomCheckBox_T;
    protected readonly showChat: NDomCheckBox_T;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 316, 350);
        this.element.setAttribute("role", "dialog");
        this.element.setAttribute("aria-label", manager.getSysString(1251));
        this.element.title = "Drop .l2r files here, or press Ctrl+O to import replay files into this browser.";
        layer.tile(this.element, 0, 0, 316, 350, 0, 0, 316, 350, TEX_BACK);
        this.list = new NCListCtrl(layer, this.element, 8, 11, 300, 273, [{ width: 32, label: 416, numeric: true }, { width: 268, label: 1250, numeric: false }], 17, 15);
        this.list.onDoubleClick = () => this.play();
        this.lockCamera = layer.checkbox(this.element, 11, 295, 140, 16, manager.getSysString(1249));
        this.showChat = layer.checkbox(this.element, 161, 295, 140, 16, manager.getSysString(1253));
        const commands = [() => this.play(), () => {
            const row = this.list.getSelectedRow();

            if (row && this.onDelete) this.onDelete(String(row.id));
        }, () => { if (this.onCancel) this.onCancel(); }];

        [140, 1272, 141].forEach((label, index) => {
            const button = layer.button(this.element, 41 + index * 80, 317, 76, 23, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, null, manager.getSysString(label), commands[index]);

            button.setAttribute("role", "button");
            button.setAttribute("aria-label", manager.getSysString(label));
            button.tabIndex = 0;
            button.addEventListener("keydown", event => {
                if (event.repeat || event.key !== " ") return;
                event.preventDefault();
                manager.playButtonSound(true);
                commands[index]();
            });
        });
        for (const checkbox of [this.lockCamera, this.showChat]) {
            checkbox.tabIndex = 0;
            checkbox.addEventListener("keydown", event => {
                if (event.repeat || event.key !== " ") return;
                event.preventDefault();
                checkbox.setChecked(!checkbox.getChecked());
            });
        }
        this.element.tabIndex = 0;
        this.element.addEventListener("keydown", event => {
            if (event.repeat) return;
            if (event.key === "Escape") { event.preventDefault(); if (this.onCancel) this.onCancel(); }
            else if (event.key === "Enter") { event.preventDefault(); this.play(); }
            else if (event.ctrlKey && event.code === "KeyO") {
                event.preventDefault();
                const input = document.createElement("input");

                input.type = "file";
                input.accept = ".l2r";
                input.multiple = true;
                input.onchange = () => { if (this.onImport) this.onImport(Array.from(input.files)); };
                input.click();
            }
        });
        this.element.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
        this.element.addEventListener("drop", event => {
            event.preventDefault();
            if (this.onImport) this.onImport(Array.from(event.dataTransfer.files));
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 158), Math.trunc((height - 52) * 0.5 - 175)); }
    public setVisible(visible: boolean) { this.element.hidden = !visible; if (!visible) this.list.hide(); }
    public setFiles(names: string[]) { this.list.setRows(names.map((name, index) => ({ id: name, cells: [String(index), name.replace(/\.l2r$/i, "")] })), true); }
    public focus() { this.element.focus(); }
    public play() {
        const row = this.list.getSelectedRow();

        if (row && this.onPlay) this.onPlay(String(row.id), this.lockCamera.getChecked(), this.showChat.getChecked());
    }
}

export default NCReplayWnd;
