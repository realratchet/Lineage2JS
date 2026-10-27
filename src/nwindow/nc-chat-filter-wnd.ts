import type NDomLayer from "./ndom";
import type { NDomCheckBox_T } from "./ndom";
import { SKIN_SLOTS } from "./skin-textures";
import SysString_T from "./sys-string";

const TEX_BACK = "L2UI_CH3.ChatWnd.Chatting_Back5";

export type ChatFilter_T = { system: boolean, damage: boolean, chat: boolean, normal: boolean, shout: boolean, pledge: boolean, party: boolean, market: boolean, tell: boolean, ally: boolean, useitems: boolean, hero: boolean };

const CONTROLS: [keyof ChatFilter_T, number, number, number, number][] = [["system", SysString_T.System, 17, 17, 100], ["damage", SysString_T.Damage, 28, 37, 80], ["chat", SysString_T.ChatFilter, 17, 61, 100], ["normal", SysString_T.GeneralChatFilter, 28, 81, 80], ["shout", SysString_T.Shout, 28, 99, 80], ["pledge", SysString_T.ClanChatFilter, 28, 117, 80], ["party", SysString_T.PartyChatFilter, 138, 81, 80], ["market", SysString_T.TradeChatFilter, 138, 99, 80], ["tell", SysString_T.Whisper, 138, 117, 80], ["ally", SysString_T.AllianceChatFilter, 28, 135, 80], ["useitems", SysString_T.Consumables, 138, 37, 92], ["hero", SysString_T.HeroVoice, 138, 135, 92]];
const TAB_CHANNELS: (keyof ChatFilter_T)[] = [null, "market", "party", "pledge", "ally"];

export const DEFAULT_CHAT_FILTERS: ChatFilter_T[] = [ // NCChatFilterWnd config defaults 0x10055870..0x100562ef, in browser tab order.
    { system: true, damage: true, chat: true, normal: true, shout: true, pledge: true, party: true, market: false, tell: true, ally: false, useitems: false, hero: false },
    { system: true, damage: true, chat: true, normal: false, shout: true, pledge: false, party: false, market: true, tell: true, ally: false, useitems: false, hero: false },
    { system: true, damage: true, chat: true, normal: false, shout: true, pledge: false, party: true, market: false, tell: true, ally: false, useitems: false, hero: false },
    { system: true, damage: true, chat: true, normal: false, shout: true, pledge: true, party: false, market: false, tell: true, ally: false, useitems: false, hero: false },
    { system: true, damage: true, chat: true, normal: false, shout: true, pledge: false, party: false, market: false, tell: true, ally: true, useitems: false, hero: false }
];

export class NCChatFilterWnd {
    public static getTextures() { return [TEX_BACK, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, SKIN_SLOTS.checkBox, SKIN_SLOTS.checkBoxChecked]; }
    public readonly element: HTMLDivElement;
    public onApply: (index: number, filter: ChatFilter_T) => void = null;
    protected readonly controls = new Map<keyof ChatFilter_T, NDomCheckBox_T>();
    protected selected = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 191);
        this.element.hidden = true;
        layer.tile(this.element, 0, 0, 256, 191, 0, 0, 256, 191, TEX_BACK);
        for (const [key, label, x, y, width] of CONTROLS) {
            const control = layer.checkbox(this.element, x, y, width, 12, manager.getSysString(label), () => this.updateControls());

            control.tabIndex = 0;
            control.addEventListener("keydown", event => {
                if (event.repeat || event.key !== " " && event.key !== "Enter" || control.getAttribute("aria-disabled") === "true") return;

                event.preventDefault();
                control.setChecked(!control.getChecked());
                this.updateControls();
            });
            this.controls.set(key, control);
        }
        layer.button(this.element, 51, 160, 76, 23, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, null, manager.getSysString(SysString_T.OK), () => {
            const filter = {} as ChatFilter_T;

            for (const [key, control] of this.controls) filter[key] = control.getChecked();
            if (this.onApply) this.onApply(this.selected, filter);
            this.setVisible(false);
        });
        layer.button(this.element, 131, 160, 76, 23, SKIN_SLOTS.button, SKIN_SLOTS.buttonDown, null, manager.getSysString(SysString_T.Cancel), () => this.setVisible(false));
    }

    public placeOnScreen(width: number, height: number) { }
    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;
        if (isVisible) this.layer.activate(this.element.parentElement);
    }

    public show(index: number, filter: ChatFilter_T) {
        this.selected = index;
        for (const [key, control] of this.controls) control.setChecked(filter[key]);
        this.updateControls();
        this.setVisible(true);
    }

    protected updateControls() {
        for (const [key, control] of this.controls) {
            const disabled = key === "damage" || key === "useitems" ? !this.controls.get("system").getChecked() : key !== "system" && key !== "chat" && (!this.controls.get("chat").getChecked() || key === TAB_CHANNELS[this.selected]);

            control.setAttribute("aria-disabled", String(disabled));
            control.style.pointerEvents = disabled ? "none" : "";
            control.style.opacity = disabled ? "0.5" : "";
        }
    }
}

export default NCChatFilterWnd;
