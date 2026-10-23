import CHtmlMultiEdit from "./c-html-multi-edit";
import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { type NDomCheckBox_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import { SKIN_SLOTS } from "./skin-textures";

const TEX_BACK = "L2UI_CH3.PetitionWnd.petition_fb_back";
const arrRadioTextures = ["L2UI_CH3.RadioCtrl.RadioButton1", "L2UI_CH3.RadioCtrl.RadioButton2"];

export class NCPetitionFeedBackWnd {
    public static getTextures() { return [TEX_BACK, ...arrRadioTextures, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, SKIN_SLOTS.checkBox, SKIN_SLOTS.checkBoxChecked, ...NCFrameCtrl.getTextures(), ...CHtmlMultiEdit.getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly message: CHtmlMultiEdit;
    public onSubmit: (rating: number, text: string) => void = null;
    public onClose: () => void = null;
    public onValidation: (messageId: number) => void = null;
    protected readonly arrRatings: NDomCheckBox_T[];

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(848), false, () => this.setVisible(false));
        [[855, 22, 32], [856, 22, 151]].forEach(([id, x, y]) => layer.text(this.element, manager.getSysString(id), 0xffdcdcdc, FontType_T.SMALL, x, y));
        this.message = new CHtmlMultiEdit(layer, this.element, 8, 166, 240, 199);
        this.arrRatings = Array.from({ length: 5 }, (_, index) => {
            const radio = layer.checkbox(this.element, 21, 52 + index * 19, 100, 12, manager.getSysString(850 + index), () => this.setRating(index));
            const setChecked = radio.setChecked, icon = radio.firstElementChild as HTMLDivElement;

            radio.setAttribute("role", "radio");
            radio.tabIndex = 0;
            radio.setChecked = checked => {
                setChecked(checked);
                layer.setTile(icon, 12, 12, 0, 0, 12, 12, arrRadioTextures[checked ? 1 : 0]);
            };
            radio.addEventListener("keydown", event => {
                const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;

                if (!direction && event.key !== " ") return;

                event.preventDefault();
                const selected = (index + direction + 5) % 5;

                this.setRating(selected);
                this.arrRatings[selected].focus();
            });
            return radio;
        });
        this.setRating(2); // NCPetitionFeedBackWnd 0x100e2b2f and Hide -> 0x100e1160 select Fair.
        layer.button(this.element, 90, 372, 76, 23, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, null, manager.getSysString(140), () => this.submit());
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 256, height - 401); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;
        if (isVisible) this.layer.activate(this.element);
        else {
            if (this.element.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
            this.message.setValue("");
            this.setRating(2);
            if (this.onClose) this.onClose();
        }
    }

    protected setRating(selected: number) { this.arrRatings.forEach((radio, index) => radio.setChecked(index === selected)); }

    public submit() {
        const text = this.message.getValue();

        if (text.length > 512) { // Native 0x100e12c2..0x100e1308: English character bound avoids its unchecked ACP buffer read.
            if (this.onValidation) this.onValidation(327);
            return;
        }
        if (this.onSubmit) this.onSubmit(this.arrRatings.findIndex(radio => radio.getChecked()), text);
        this.setVisible(false);
    }

    public tick(deltaSeconds: number) { if (this.isVisible()) this.message.tick(deltaSeconds); }
}

export default NCPetitionFeedBackWnd;
