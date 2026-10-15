import type { default as NDomLayer, NDomButton_T, NDomCheckBox_T } from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import { NCComboBox } from "./nc-lobby-wnd";
import { FontType_T } from "./nwindow-canvas";
import type { AudioConfig_T, GameConfig_T } from "../assets/unreal/conf-files/un-conf-system";

const TEX_BACK = "L2UI_ch3.OptionWnd.option1_back";
const TEX_AUDIO_BACK = "L2UI_ch3.OptionWnd.option2_back";
const TEX_TAB_BACK = "L2UI_ch3.SSQWnd.ssq_back";
const TEX_TAB = "L2UI_ch3.TabButton.normal_tab_on";
const TEX_TAB_SELECTED = "L2UI_ch3.TabButton.normal_tab";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_normalOn";

export class NCOptionWnd {
    public static getTextures() { return [TEX_BACK, TEX_AUDIO_BACK, TEX_TAB_BACK, TEX_TAB, TEX_TAB_SELECTED, TEX_BUTTON, TEX_BUTTON_DOWN, "L2UI.Control.CheckBox", "L2UI.ActionWnd.CheckBox_checked", ...["textbox1", "textbox2", "textbox3"].map(name => `L2UI_CH3.Etc.${name}`), "L2UI_CH3.ListCtrl.TextSelect", "L2UI_CH3.ListCtrl.TextSelect2", "L2UI_CH3.Button.downbutton", "L2UI_CH3.Button.downbutton_down", ...NCFrameCtrl.getTextures()]; }
    public readonly element: HTMLDivElement;
    public getOptions: () => GameConfig_T = null;
    public onApply: (options: GameConfig_T) => void = null;
    public getAudioOptions: () => AudioConfig_T = null;
    public onApplyAudio: (options: AudioConfig_T) => void = null;
    public canChangePartyLoot: () => boolean = null;
    protected readonly game: HTMLDivElement;
    protected readonly audio: HTMLDivElement;
    protected readonly background: HTMLDivElement;
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly audioCombos: NCComboBox[] = [];
    protected readonly audioKeys: (keyof AudioConfig_T)[] = ["soundVolume", "musicVolume", "wavVoiceVolume", "oggVoiceVolume"];
    protected readonly audioGains = [1, 0.8, 0.6, 0.4, 0.2, 0];
    protected selectedTab = 2;
    protected readonly nameKeys: (keyof GameConfig_T)[] = ["myName", "npcName", "groupName", "pledgeMemberName", "partyMemberName", "otherPCName"];
    protected readonly nameChecks: NDomCheckBox_T[] = [];
    protected readonly arrowMode: NDomCheckBox_T;
    protected readonly showZoneTitle: NDomCheckBox_T;
    protected readonly enterChatting: NDomCheckBox_T;
    protected readonly oldChatting: NDomCheckBox_T;
    protected readonly transparencyMode: NDomCheckBox_T;
    protected readonly systemMsgWnd: NDomCheckBox_T;
    protected readonly systemMsgWndDamage: NDomCheckBox_T;
    protected readonly systemMsgWndExpendableItem: NDomCheckBox_T;
    protected readonly partyLooting: NCComboBox;
    protected lootType = 0;
    protected lootEnabled = true;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 480);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 28, 0, 0, 256, 28, TEX_TAB_BACK);
        this.background = layer.tile(this.element, 0, 48, 256, 432, 0, 0, 256, 432, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(146), false, () => this.setVisible(false));
        // shortcut: Video controls are pending; enable the tab with its native settings.
        [206, 207, 208].forEach((id, index) => {
            const tab = layer.tab(this.element, 12 + index * 74, 25, 74, 23, TEX_TAB, TEX_TAB_SELECTED, manager.getSysString(id), null, () => this.selectTab(index));

            tab.setAttribute("aria-selected", String(index === 2));
            tab.setAttribute("aria-disabled", String(index === 0));
            tab.setEnabled(index !== 0);
            tab.tabIndex = index === 0 ? -1 : 0;
            this.tabs.push(tab);
        });
        const game = this.game = layer.createWindow(0, 48, 256, 400, this.element);
        this.audio = layer.createWindow(0, 48, 256, 400, this.element);
        this.audio.hidden = true;
        layer.text(game, manager.getSysString(478), 0xffdcdcdc, FontType_T.SMALL, 24, 15);
        [[329, 79, 49], [435, 76, 82]].forEach(([id, x, y]) => {
            const label = manager.getSysString(id);

            layer.text(game, label, 0xffdcdcdc, FontType_T.SMALL, x - layer.measureText(label), y);
        });
        [216, 217, 977, 978].forEach((id, index) => {
            const label = manager.getSysString(id);
            const combo = new NCComboBox(layer, this.audio, 107, 11 + index * 19, 125, 17);

            layer.text(this.audio, label, 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText(label), 14 + index * 19);
            combo.setItems([1233, 1234, 1235, 1236, 1237, 228].map(id => manager.getSysString(id)));
            combo.element.tabIndex = 0;
            combo.element.setAttribute("role", "combobox");
            combo.element.setAttribute("aria-label", label);
            combo.element.addEventListener("keydown", event => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

                event.preventDefault();
                combo.setSelected(Math.max(0, Math.min(5, combo.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
                combo.setOpen(false);
            });
            this.audioCombos.push(combo);
        });

        [436, 437, 438, 439, 440, 441].forEach((id, index) => {
            const x = index < 3 ? 84 : 95, y = index < 3 ? [85, 99, 116][index] : 133 + (index - 3) * 17;
            const checkbox = layer.checkbox(game, x, y, 100, 12, manager.getSysString(id), index === 2 ? () => this.updateNameControls() : null);

            this.nameChecks.push(checkbox);
        });
        this.arrowMode = layer.checkbox(game, 25, 257, 100, 12, manager.getSysString(928));
        this.showZoneTitle = layer.checkbox(game, 135, 257, 100, 12, manager.getSysString(1196));
        this.enterChatting = layer.checkbox(game, 25, 200, 100, 12, manager.getSysString(442));
        this.oldChatting = layer.checkbox(game, 135, 200, 100, 12, manager.getSysString(566));
        this.transparencyMode = layer.checkbox(game, 164, 15, 100, 12, manager.getSysString(927));
        this.systemMsgWnd = layer.checkbox(game, 25, 327, 150, 12, manager.getSysString(1197), () => this.updateSystemMessageControls());
        this.systemMsgWndDamage = layer.checkbox(game, 36, 344, 70, 12, manager.getSysString(357));
        this.systemMsgWndExpendableItem = layer.checkbox(game, 120, 344, 130, 12, manager.getSysString(796));
        [...this.nameChecks, this.arrowMode, this.showZoneTitle, this.enterChatting, this.oldChatting, this.transparencyMode, this.systemMsgWnd, this.systemMsgWndDamage, this.systemMsgWndExpendableItem].forEach(checkbox => {
            checkbox.tabIndex = 0;
            checkbox.addEventListener("keydown", event => {
                if (checkbox.getAttribute("aria-disabled") === "true" || event.repeat || event.key !== " " && event.key !== "Enter") return;

                event.preventDefault();
                checkbox.setChecked(!checkbox.getChecked());
                if (checkbox === this.nameChecks[2]) this.updateNameControls();
                if (checkbox === this.systemMsgWnd) this.updateSystemMessageControls();
            });
        });
        const lootLabel = manager.getSysString(486);

        layer.text(game, lootLabel, 0xffdcdcdc, FontType_T.SMALL, 79 - layer.measureText(lootLabel), 377);
        this.partyLooting = new NCComboBox(layer, game, 87, 374, 125, 17);
        this.partyLooting.setItems([487, 488, 798, 799, 800].map(id => manager.getSysString(id)));
        this.partyLooting.onChange = index => { this.lootType = index; };
        this.partyLooting.element.tabIndex = 0;
        this.partyLooting.element.setAttribute("role", "combobox");
        this.partyLooting.element.setAttribute("aria-label", lootLabel);
        this.partyLooting.element.addEventListener("keydown", event => {
            if (!this.lootEnabled || event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            this.lootType = Math.max(0, Math.min(4, this.lootType + (event.key === "ArrowDown" ? 1 : -1)));
            this.partyLooting.setSelected(this.lootType);
            this.partyLooting.setOpen(false);
        });
        [140, 141, 218].forEach((id, index) => {
            const press = () => {
                if (index !== 1) this.apply();
                if (index !== 2) this.setVisible(false);
            };
            const button = layer.button(this.element, 11 + index * 80, 450, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(id), press);

            button.tabIndex = 0;
            button.setAttribute("role", "button");
            button.setAttribute("aria-label", manager.getSysString(id));
            button.addEventListener("keydown", event => {
                if (event.repeat || event.key !== " " && event.key !== "Enter") return;

                event.preventDefault();
                manager.playButtonSound(true);
                press();
            });
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc(width * 0.5 - 128), Math.trunc(height * 0.5 - 240)); }
    public isVisible() { return !this.element.hidden; }

    public setVisible(isVisible: boolean) {
        this.partyLooting.setOpen(false);
        this.audioCombos.forEach(combo => combo.setOpen(false));
        this.element.hidden = !isVisible;

        if (isVisible) {
            const options = this.getOptions();

            this.nameChecks.forEach((checkbox, index) => checkbox.setChecked(options[this.nameKeys[index]] as boolean));
            this.updateNameControls();
            this.arrowMode.setChecked(options.arrowMode);
            this.showZoneTitle.setChecked(options.showZoneTitle);
            this.enterChatting.setChecked(options.enterChatting);
            this.oldChatting.setChecked(options.oldChatting);
            this.transparencyMode.setChecked(options.transparencyMode);
            this.systemMsgWnd.setChecked(options.systemMsgWnd);
            this.systemMsgWndDamage.setChecked(options.systemMsgWndDamage);
            this.systemMsgWndExpendableItem.setChecked(options.systemMsgWndExpendableItem);
            this.updateSystemMessageControls();
            this.lootType = options.partyLooting;
            this.partyLooting.setSelected(this.lootType);
            const audio = this.getAudioOptions();

            this.updatePartyLootControl();
            this.audioCombos.forEach((combo, index) => {
                const value = audio[this.audioKeys[index]];
                const selected = value >= 1 ? 0 : value >= 0.8 ? 1 : value >= 0.6 ? 2 : value >= 0.4 ? 3 : value >= 0.2 ? 4 : 5;

                combo.setSelected(selected);
            });
            this.selectTab(this.selectedTab);
            this.layer.activate(this.element);
        } else if (this.element.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    }

    public toggle() {
        this.setVisible(!this.isVisible());
        const manager = this.layer.getManager();

        if (this.isVisible()) manager.playWindowSound();
        else manager.playWindowCloseSound();
    }

    public updatePartyLootControl() {
        if (!this.isVisible()) return;

        const enabled = this.canChangePartyLoot();

        if (enabled === this.lootEnabled) return;

        this.lootEnabled = enabled;
        this.partyLooting.setOpen(false);
        this.partyLooting.element.inert = !enabled;
        this.partyLooting.element.setAttribute("aria-disabled", String(!enabled));
        this.partyLooting.element.tabIndex = enabled ? 0 : -1;
    }

    protected selectTab(index: number) {
        this.selectedTab = index;
        this.game.hidden = index !== 2;
        this.audio.hidden = index !== 1;
        this.partyLooting.setOpen(false);
        this.audioCombos.forEach(combo => combo.setOpen(false));
        this.tabs.forEach((tab, i) => {
            tab.setTextures(i === index ? TEX_TAB_SELECTED : TEX_TAB, TEX_TAB_SELECTED);
            tab.setAttribute("aria-selected", String(i === index));
        });
        this.layer.setTile(this.background, 256, 432, 0, 0, 256, 432, index === 1 ? TEX_AUDIO_BACK : TEX_BACK);
    }

    protected updateNameControls() {
        const enabled = this.nameChecks[2].getChecked();

        this.nameChecks.slice(3).forEach(checkbox => {
            checkbox.setAttribute("aria-disabled", String(!enabled));
            checkbox.style.pointerEvents = enabled ? "" : "none";
            checkbox.style.opacity = enabled ? "" : "0.5";
            checkbox.tabIndex = enabled ? 0 : -1;
        });
    }

    protected updateSystemMessageControls() {
        const enabled = this.systemMsgWnd.getChecked();

        [this.systemMsgWndDamage, this.systemMsgWndExpendableItem].forEach(checkbox => {
            checkbox.setAttribute("aria-disabled", String(!enabled));
            checkbox.style.pointerEvents = enabled ? "" : "none";
            checkbox.style.opacity = enabled ? "" : "0.5";
            checkbox.tabIndex = enabled ? 0 : -1;
        });
    }

    protected apply() {
        this.updatePartyLootControl();
        if (!this.lootEnabled) {
            this.lootType = this.getOptions().partyLooting;
            this.partyLooting.setSelected(this.lootType);
        }
        this.onApplyAudio(Object.fromEntries(this.audioKeys.map((key, index) => [key, this.audioGains[this.audioCombos[index].getSelected()]])) as AudioConfig_T);
        this.onApply({ ...Object.fromEntries(this.nameKeys.map((key, index) => [key, this.nameChecks[index].getChecked()])), arrowMode: this.arrowMode.getChecked(), showZoneTitle: this.showZoneTitle.getChecked(), enterChatting: this.enterChatting.getChecked(), oldChatting: this.oldChatting.getChecked(), transparencyMode: this.transparencyMode.getChecked(), systemMsgWnd: this.systemMsgWnd.getChecked(), systemMsgWndDamage: this.systemMsgWndDamage.getChecked(), systemMsgWndExpendableItem: this.systemMsgWndExpendableItem.getChecked(), partyLooting: this.lootType } as GameConfig_T);
    }
}

export default NCOptionWnd;
