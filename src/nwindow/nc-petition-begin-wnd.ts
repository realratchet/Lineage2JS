import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";
import CHtmlMultiEdit from "./c-html-multi-edit";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCHtmlViewer from "./nc-html-viewer";
import { NCComboBox } from "./nc-lobby-wnd";
import type NDomLayer from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import { SKIN_SLOTS } from "./skin-textures";
import SystemMessage_T from "./system-message";
import SysString_T from "./sys-string";

const TEX_BACK = "L2UI_ch3.PetitionWnd.petition1_back";

export class NCPetitionBeginWnd {
    public static getTextures() { return [TEX_BACK, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, ...NCFrameCtrl.getTextures(), ...NCHtmlViewer.getTextures(), ...CHtmlMultiEdit.getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly category: NCComboBox;
    public readonly message: CHtmlMultiEdit;
    public onSubmit: (text: string, category: number) => void = null;
    public onCancel: () => void = null;
    public onValidation: (messageId: number) => void = null;
    public getHtml: (path: string) => Promise<string> = null;
    protected readonly help: NCHtmlViewer;
    protected generation = 0;

    public constructor(protected readonly layer: NDomLayer, protected readonly categories: GameStrings_T["petitionCategories"]) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(SysString_T.Petition), false, () => this.setVisible(false));
        [[SysString_T.ViewingOfRelatedInformation, 22, 30], [SysString_T.PetitionType, 22, 53], [SysString_T.EnterAPetition, 22, 226]].forEach(([id, x, y]) => layer.text(this.element, manager.getSysString(id), 0xffdcdcdc, FontType_T.SMALL, x, y));
        this.help = new NCHtmlViewer(layer, this.element, 8, 79, 240, 141);
        this.help.onFile = path => { void this.showFile(path); };
        this.category = new NCComboBox(layer, this.element, 51, 50, 145, 17);
        this.category.setItems([manager.getSysString(SysString_T.SelectAType), ...categories.map(category => manager.getSysString(category.titleId))]);
        this.category.setSelected(0);
        this.category.onChange = index => {
            if (index > 0) void this.showFile(categories[index - 1].link);
            else { this.generation++; void this.help.setHtml(""); }
        };
        this.message = new CHtmlMultiEdit(layer, this.element, 8, 241, 240, 124);
        layer.button(this.element, 51, 372, 76, 23, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, null, manager.getSysString(SysString_T.Submit), () => this.submit());
        layer.button(this.element, 131, 372, 76, 23, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, null, manager.getSysString(SysString_T.CancelPetition), () => {
            if (this.onCancel) this.onCancel();
            this.reset();
            this.setVisible(false);
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 128), Math.trunc(height * 0.5 - 200)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) {
        this.category.setOpen(false);
        this.element.hidden = !isVisible;
        if (!isVisible) {
            this.generation++;
            if (this.element.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
        }
    }

    public focus() { this.layer.activate(this.element); this.message.input.focus(); }
    public setMessage(text: string) { this.message.setValue(text); }

    protected async showFile(path: string) {
        const generation = ++this.generation, html = await this.getHtml(path.replace(/^\.\.[\\/]L2text[\\/]/i, ""));

        if (generation === this.generation && this.isVisible()) await this.help.setHtml(html);
    }

    public reset() {
        this.generation++;
        this.category.setSelected(0);
        this.message.setValue("");
        void this.help.setHtml("");
    }

    public submit() {
        const category = this.category.getSelected(), text = this.message.getValue();
        const messageId = category <= 0 ? SystemMessage_T.SelectPetitionType : text.length < 5 ? SystemMessage_T.PetitionTooShort : text.length >= 255 ? SystemMessage_T.PetitionTooLong : 0; // NCPetitionBeginWnd 0x100e0c40..0x100e0d7f.

        if (messageId) {
            if (this.onValidation) this.onValidation(messageId);
            return;
        }
        if (this.onSubmit) this.onSubmit(text, category);
        this.reset();
        this.setVisible(false);
    }

    public tick(deltaSeconds: number) {
        if (!this.isVisible()) return;
        this.help.tick(deltaSeconds);
        this.message.tick(deltaSeconds);
    }
}

export default NCPetitionBeginWnd;
