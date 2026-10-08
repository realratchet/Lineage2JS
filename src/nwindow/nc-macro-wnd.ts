import getCommandTokens from "../network/command-parser";
import NDomLayer, { NDOM_EDIT_TEXTURES, NDOM_SCROLL_TEXTURES } from "./ndom";
import type { NDomEdit_T } from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import { FontType_T } from "./nwindow-canvas";
import type { Macro_T, MacroCommand_T } from "../network/game-packets";

const arrBack = ["macro2_back", "macro1_back", "macro3_back"].map(name => `L2UI_CH3.MacroWnd.${name}`);
const arrIcons = Array.from({ length: 7 }, (_, i) => `L2UI.MacroWnd.Macro_Icon${i + 1}`);
const TEX_EDIT = "L2UI_CH3.MacroWnd.macro_edit";
const TEX_TRASH = "L2UI_CH3.InventoryWnd.Inventory_trash";
const TEX_SELECTED = "L2UI.NWindow.item_click";
const TEX_HIGHLIGHT = "L2UI.MacroWnd.Macro_Line_HighLight";
const TEX_BUTTON = "L2UI_ch3.button.btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_ch3.button.btn1_normalon";

export class NCMacroWnd {
    public static getTextures() { return [...arrBack, ...arrIcons, TEX_EDIT, `${TEX_EDIT}_Drag`, TEX_TRASH, `${TEX_TRASH}_Drag`, TEX_SELECTED, TEX_HIGHLIGHT, "L2UI_CH3.MacroWnd.MacroListIcon", "L2UI_CH3.MacroWnd.MacroEditIcon", TEX_BUTTON, TEX_BUTTON_DOWN, "L2UI_ch3.Button.Prev1", "L2UI_ch3.Button.Prev1_Down", "L2UI_ch3.Button.next1", "L2UI_ch3.Button.next1_down", "L2UI_ch3.button.SmallButton2", "L2UI_ch3.button.SmallButton2_Down", ...NCFrameCtrl.getTextures(), ...NDOM_EDIT_TEXTURES, ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public readonly editor: HTMLDivElement;
    public readonly info: HTMLDivElement;
    public onSave: (macro: Macro_T) => void = null;
    public onUse: (id: number) => void = null;
    public onDelete: (macro: Macro_T) => void = null;
    public onHelp: () => void = null;
    public onError: (id: number) => void = null;
    public onDrop: (id: number, x: number, y: number) => void = null;
    protected readonly layer: NDomLayer;
    protected readonly list: HTMLDivElement;
    protected readonly count: HTMLCanvasElement;
    protected readonly name: NDomEdit_T;
    protected readonly acronym: NDomEdit_T;
    protected readonly commands: NDomEdit_T[] = [];
    protected readonly highlights: HTMLDivElement[] = [];
    protected readonly icon: HTMLDivElement;
    protected readonly description: HTMLTextAreaElement;
    protected macros: Macro_T[] = [];
    protected current: Macro_T = null;
    protected iconIndex = 0;
    protected descriptionText = "";

    public constructor(layer: NDomLayer) {
        const manager = layer.getManager();

        this.layer = layer;
        this.element = layer.createWindow(0, 0, 256, 401);
        this.editor = layer.createWindow(0, 0, 256, 401);
        this.info = layer.createWindow(0, 0, 256, 161);
        [this.element, this.editor, this.info].forEach((element, index) => {
            element.hidden = true;
            layer.tile(element, 0, 20, 256, index === 2 ? 141 : 381, 0, 0, 256, index === 2 ? 141 : 381, arrBack[index]);
            NCFrameCtrl.createDOM(layer, element, 256, manager.getSysString(index === 2 ? 657 : 711), index !== 2);
        });
        layer.text(this.element, manager.getSysString(655), 0xffdcdcdc, FontType_T.SMALL, 11, 32);
        this.count = layer.text(this.element, "(00/24)", 0xffdcdcdc, FontType_T.SMALL, 200, 32);
        this.list = layer.createWindow(6, 45, 244, 285, this.element);
        layer.button(this.element, 11, 347, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(654), () => this.edit(null)).setAttribute("aria-label", manager.getSysString(654));
        layer.button(this.element, 11, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(145), () => { if (this.onHelp) this.onHelp(); }).setAttribute("aria-label", manager.getSysString(145));
        layer.tile(this.element, 169, 347, 34, 34, 0, 0, 34, 34, TEX_EDIT);
        layer.tile(this.element, 208, 347, 34, 34, 0, 0, 34, 34, TEX_TRASH);
        layer.text(this.editor, manager.getSysString(656), 0xffdcdcdc, FontType_T.SMALL, 11, 32);
        layer.text(this.editor, manager.getSysString(50), 0xffa3a3a3, FontType_T.SMALL, 65, 63);
        layer.text(this.editor, manager.getSysString(653), 0xffa3a3a3, FontType_T.SMALL, 65, 86);
        this.name = layer.edit(this.editor, 93, 60, 148, 17, false, 12);
        this.acronym = layer.edit(this.editor, 117, 83, 54, 17, false, 4);
        this.name.input.setAttribute("aria-label", manager.getSysString(50));
        this.acronym.input.setAttribute("aria-label", manager.getSysString(653));
        this.icon = layer.tile(this.editor, 17, 55, 32, 32, 0, 0, 32, 32, arrIcons[0]);
        layer.button(this.editor, 16, 93, 15, 15, "L2UI_ch3.Button.Prev1", "L2UI_ch3.Button.Prev1_Down", null, null, () => this.setIcon((this.iconIndex + 6) % 7)).setAttribute("aria-label", "Previous icon");
        layer.button(this.editor, 36, 93, 15, 15, "L2UI_ch3.Button.next1", "L2UI_ch3.Button.next1_down", null, null, () => this.setIcon((this.iconIndex + 1) % 7)).setAttribute("aria-label", "Next icon");
        layer.button(this.editor, 177, 82, 66, 21, "L2UI_ch3.button.SmallButton2", "L2UI_ch3.button.SmallButton2_Down", null, manager.getSysString(657), () => this.showDescription()).setAttribute("aria-label", manager.getSysString(657));
        const rows = layer.scrollPane(this.editor, 7, 125, 242, 239, 26);

        for (let i = 0; i < 12; i++) {
            layer.text(rows.content, String(i + 1).padStart(2, "0"), 0xffdcdcdc, FontType_T.SMALL, 1, 9 + i * 26);
            const edit = layer.edit(rows.content, 20, 7 + i * 26, 202, 17, false, 32);

            edit.input.setAttribute("aria-label", `Command ${i + 1}`);
            this.commands.push(edit);
            const highlight = layer.tile(edit, 0, 0, 202, 17, 0, 0, 193, 16, TEX_HIGHLIGHT);

            highlight.hidden = true;
            highlight.style.pointerEvents = "none";
            edit.insertBefore(highlight, edit.input);
            this.highlights.push(highlight);
        }
        rows.setContentHeight(312);
        layer.button(this.editor, 11, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(145), () => { if (this.onHelp) this.onHelp(); }).setAttribute("aria-label", manager.getSysString(145));
        layer.button(this.editor, 91, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(658), () => this.save()).setAttribute("aria-label", manager.getSysString(658));
        layer.button(this.editor, 171, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(141), () => { this.editor.hidden = true; this.info.hidden = true; }).setAttribute("aria-label", manager.getSysString(141));
        layer.text(this.info, manager.getSysString(57), 0xffdcdcdc, FontType_T.SMALL, 9, 30);
        this.description = document.createElement("textarea");
        this.description.maxLength = 32;
        this.description.spellcheck = false;
        this.description.setAttribute("aria-label", manager.getSysString(57));
        this.description.style.cssText = "position:absolute;box-sizing:border-box;resize:none;background:transparent;color:transparent;caret-color:#dcdcdc;border:0;outline:none;font:12px Arial;padding:2px;";
        const descriptionText = document.createElement("canvas"), canvas = manager.canvas;

        descriptionText.width = Math.round(238 * canvas.scale);
        descriptionText.height = Math.round(77 * canvas.scale);
        descriptionText.className = "ndom-text ndom-absolute";
        descriptionText.style.pointerEvents = "none";
        layer.place(descriptionText, 9, 48, 238, 77);
        this.info.appendChild(descriptionText);
        const drawDescription = () => {
            const context = descriptionText.getContext("2d");

            context.setTransform(canvas.scale, 0, 0, canvas.scale, 0, 0);
            context.clearRect(0, 0, 238, 77);
            canvas.renderWrappedText(context, 2, 2, 0xffdcdcdc, this.description.value, 234);
        };
        this.description.addEventListener("input", drawDescription);
        this.description.addEventListener("change", drawDescription);
        layer.place(this.description, 9, 48, 238, 77);
        this.info.appendChild(this.description);
        layer.button(this.info, 51, 132, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(140), () => { this.descriptionText = this.description.value; this.info.hidden = true; }).setAttribute("aria-label", manager.getSysString(140));
        layer.button(this.info, 131, 132, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(141), () => { this.info.hidden = true; }).setAttribute("aria-label", manager.getSysString(141));
    }

    public placeOnScreen(width: number, height: number) {
        this.layer.place(this.element, 0, Math.trunc(height * .5 - 252));
        this.layer.place(this.editor, 0, Math.trunc(height * .5 - 252));
        this.layer.place(this.info, 21, Math.trunc(height * .5 - 173));
    }

    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }
    public hide() { this.element.hidden = this.editor.hidden = this.info.hidden = true; }

    public highlightCommand(x: number, y: number) {
        if (this.editor.hidden) return;

        const target = document.elementFromPoint(x, y);
        const index = this.commands.findIndex(edit => edit.input === target);

        if (index >= 0) this.highlights[index].hidden = false;
        else if (!(target instanceof Element && target.closest(".ndom-edit") && this.editor.contains(target)))
            this.highlights.forEach(highlight => highlight.hidden = true);
    }

    public dropCommand(text: string, x: number, y: number) {
        if (this.editor.hidden) return false;

        const target = document.elementFromPoint(x, y);
        const edit = this.commands.find(edit => edit.input === target);

        if (!edit) return false;
        this.highlights[this.commands.indexOf(edit)].hidden = true;
        if (text !== null && text.length <= 32) edit.setValue(text);

        return true;
    }

    public dropAction(id: number, x: number, y: number) {
        if (!this.dropCommand(null, x, y)) return false;
        if ([20, 27, 32, 36, 39].includes(id) || id >= 41 && id <= 49 || id >= 1000) {
            if (this.onError) this.onError(1257);
            return true;
        }

        const strings = this.layer.getManager().strings, name = strings.actions[id].macroCommand.toLowerCase();
        const alias = { partyinvite: 16, partyleave: 17, partydismiss: 18 }[name]; // Engine 0x1045ed40 resolves canonical action names to command types.
        const entry = Object.entries(strings.commands).find(([, command]) => command.toLowerCase() === name);

        if (alias === undefined && !entry) throw new Error(`Missing macro command for action '${id}'.`);

        this.dropCommand(`/${strings.commands[alias === undefined ? Number(entry[0]) : alias]}`, x, y);
        return true;
    }

    protected setIcon(index: number) {
        this.iconIndex = index;
        this.layer.setTile(this.icon, 32, 32, 0, 0, 32, 32, arrIcons[index]);
    }

    protected showDescription() {
        this.description.value = this.descriptionText;
        this.description.dispatchEvent(new Event("input"));
        this.layer.place(this.info, this.editor.offsetLeft + 21, this.editor.offsetTop + 79);
        this.info.hidden = !this.info.hidden;
    }

    public edit(macro: Macro_T) {
        if (!macro && this.macros.length >= 24) { if (this.onError) this.onError(797); return; }

        this.current = macro;
        this.name.setValue(macro ? macro.name : "");
        this.acronym.setValue(macro ? macro.acronym : "");
        this.descriptionText = macro ? macro.description : "";
        this.setIcon(macro ? macro.icon : 0);
        this.commands.forEach((edit, index) => {
            const command = macro && macro.commands.find(command => command.index === index + 1);

            edit.setValue(command ? this.getCommandText(command) : "");
        });
        this.info.hidden = true;
        this.editor.hidden = false;
    }

    protected getCommandText(command: MacroCommand_T) {
        if (command.command) return command.command;
        const strings = this.layer.getManager().strings;

        switch (command.type) {
            case 1: return `/${strings.commands[24]} ${strings.skillNames[command.data1]}`;
            case 2: return `/${strings.actions[command.data1].command}`;
            case 4: return `/${strings.commands[27]} ${command.data1 + 1} ${command.data2 + 1}`;
            case 6: return `/${strings.commands[76]} ${command.data1}`;
            default: return "";
        }
    }

    protected save() {
        const name = this.name.getValue();
        let id = 0;

        if (!name) id = 838;
        else if (this.macros.some(macro => (!this.current || macro.id !== this.current.id) && macro.name === name)) id = 839;
        if (id) { if (this.onError) this.onError(id); return; }

        const commands: MacroCommand_T[] = [];
        for (let i = 0; i < 12; i++) {
            const text = this.commands[i].getValue();

            if (!text) {
                if (this.commands.slice(i + 1).some(edit => edit.getValue())) { if (this.onError) this.onError(810); return; }
                break;
            }
            const command = { index: i + 1, type: 3, data1: 0, data2: 0, command: text };
            const strings = this.layer.getManager().strings, tokens = getCommandTokens(text);
            const entry = text[0] === "/" && Object.entries(strings.commands).find(([, name]) => `/${name.toLowerCase()}` === tokens[0].toLowerCase());
            const type = entry ? Number(entry[0]) : -1;

            if (type >= 24 && type <= 26) {
                const skillId = strings.skillCommands[tokens.slice(1).join(" ").toLowerCase()];

                command.type = 1;
                command.data1 = skillId || 0;
                command.data2 = skillId ? 1 : 0;
                command.command = "";
            } else if (type >= 27 && type <= 29 || type === 76) {
                const data1 = parseInt(tokens[1], 10), data2 = type === 76 ? 0 : parseInt(tokens[2], 10);

                if (!Number.isFinite(data1) || data1 < 1 || data1 > 0x7fffffff || type !== 76 && (!Number.isFinite(data2) || data1 > 10 || data2 < 1 || data2 > 12)) { if (this.onError) this.onError(810); return; }
                if (type === 27 || type === 76) {
                    command.type = type === 76 ? 6 : 4;
                    command.data1 = type === 76 ? data1 : data1 - 1;
                    command.data2 = type === 27 ? data2 - 1 : 0;
                    command.command = "";
                }
            }
            commands.push(command);
        }
        if (!commands.length) { if (this.onError) this.onError(810); return; }
        if (this.onSave) this.onSave({ id: this.current ? this.current.id : 0, name, acronym: this.acronym.getValue(), description: this.descriptionText, icon: this.iconIndex, commands });
        this.editor.hidden = true;
        this.info.hidden = true;
    }

    public setMacros(macros: Macro_T[]) {
        this.macros = macros;
        this.list.replaceChildren();
        this.layer.renderText(this.count, `(${String(macros.length).padStart(2, "0")}/24)`, 0xffdcdcdc);
        macros.slice(0, 24).forEach((macro, index) => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "ndom-inventory-item";
            button.setAttribute("aria-label", macro.name);
            this.layer.place(button, 4 + index % 6 * 37, 4 + Math.trunc(index / 6) * 35, 32, 32);
            this.layer.tile(button, 0, 0, 32, 32, 0, 0, 32, 32, arrIcons[macro.icon]);
            this.layer.tooltip(this.element, button, macro.name);
            for (let i = 0; i < macro.acronym.length; i++)
                this.layer.text(button, macro.acronym[i], 0xffdcdcdc, FontType_T.SMALL, 4 + i % 2 * 13, 4 + Math.trunc(i / 2) * 13);
            const selected = this.layer.tile(button, 0, 0, 32, 32, 0, 0, 32, 32, TEX_SELECTED);

            selected.hidden = true;
            button.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                event.preventDefault();
                selected.hidden = false;
                let isDragging = false;

                this.layer.beginDrag(() => {
                    if (isDragging) return;

                    isDragging = true;
                    document.documentElement.style.cursor = `url(${this.layer.getWrapUrl(arrIcons[macro.icon])}) 16 16, default`;
                    document.documentElement.classList.add("ndom-item-drag");
                }, end => {
                    selected.hidden = true;
                    if (isDragging) {
                        document.documentElement.style.cursor = "";
                        document.documentElement.classList.remove("ndom-item-drag");
                    }
                    if (!(end instanceof MouseEvent) || end.type !== "mouseup" && end.type !== "pointerup" || this.element.hidden) return;

                    const x = this.layer.toUI(end.clientX) - this.element.offsetLeft, y = this.layer.toUI(end.clientY) - this.element.offsetTop;
                    const rect = button.getBoundingClientRect();

                    if (x >= 169 && x <= 203 && y >= 347 && y <= 381) this.edit(macro);
                    else if (x >= 208 && x <= 242 && y >= 347 && y <= 381) { if (this.onDelete) this.onDelete(macro); }
                    else if (end.clientX >= rect.left && end.clientX < rect.right && end.clientY >= rect.top && end.clientY < rect.bottom) { if (this.onUse) this.onUse(macro.id); }
                    else if (this.onDrop) this.onDrop(macro.id, end.clientX, end.clientY);
                });
            });
            this.list.appendChild(button);
        });
    }
}


export default NCMacroWnd;
