import type { default as NDomLayer, NDomButton_T, NDomCheckBox_T } from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import { NCComboBox } from "./nc-lobby-wnd";
import { FontType_T } from "./nwindow-canvas";
import type { AudioConfig_T, GameConfig_T } from "../assets/unreal/conf-files/un-conf-system";
import { SKIN_SLOTS } from "./skin-textures";
import { GAMMA_STEPS } from "../rendering/display-gamma";

const TEX_BACK = "L2UI_ch3.OptionWnd.option1_back";
const TEX_AUDIO_BACK = "L2UI_ch3.OptionWnd.option2_back";
const TEX_GAME_BACK = "L2UI_ch3.OptionWnd.option3_back";
const TEX_TAB_BACK = "L2UI_ch3.SSQWnd.ssq_back";
const TEX_TAB = "L2UI_ch3.TabButton.normal_tab_on";
const TEX_TAB_SELECTED = "L2UI_ch3.TabButton.normal_tab";
const TEX_BUTTON = SKIN_SLOTS.button;
const TEX_BUTTON_DOWN = SKIN_SLOTS.buttonDown;
const TEX_INITIALIZE = "L2UI_ch3.button.smallbutton2";
const TEX_INITIALIZE_DOWN = "L2UI_ch3.button.smallbutton2_down";

export const UI_SCALES = [0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.25, 1.5, 1.75, 2];
export const PAWN_RANGES = [3, 2.5, 2, 1.5, 1];

export class NCOptionWnd {
    public static getTextures() { return [TEX_BACK, TEX_AUDIO_BACK, TEX_GAME_BACK, TEX_TAB_BACK, TEX_TAB, TEX_TAB_SELECTED, TEX_BUTTON, TEX_BUTTON_DOWN, TEX_INITIALIZE, TEX_INITIALIZE_DOWN, "L2UI.Control.CheckBox", "L2UI.ActionWnd.CheckBox_checked", ...["textbox1", "textbox2", "textbox3"].map(name => `L2UI_CH3.Etc.${name}`), "L2UI_CH3.ListCtrl.TextSelect", "L2UI_CH3.ListCtrl.TextSelect2", "L2UI_CH3.Button.downbutton", "L2UI_CH3.Button.downbutton_down", ...NCFrameCtrl.getTextures()]; }
    public readonly element: HTMLDivElement;
    public getOptions: () => GameConfig_T = null;
    public onApply: (options: GameConfig_T) => void = null;
    public getAudioOptions: () => AudioConfig_T = null;
    public onApplyAudio: (options: AudioConfig_T) => void = null;
    public getGamma: () => number = null;
    public onApplyGamma: (gamma: number) => void = null;
    public getPawnRange: () => number = null;
    public onApplyPawnRange: (range: number) => void = null;
    public onInitialize: () => void = null;
    public canChangePartyLoot: () => boolean = null;
    public getUIScale: () => number = null;
    public getUIScales: () => number[] = null;
    public onApplyUIScale: (scale: number) => void = null;
    protected readonly game: HTMLDivElement;
    protected readonly audio: HTMLDivElement;
    protected readonly video: HTMLDivElement;
    protected readonly uiScale: NCComboBox;
    protected readonly gamma: NCComboBox;
    protected readonly pawnRange: NCComboBox;
    protected readonly pawnShadow: NDomCheckBox_T;
    protected readonly language: NCComboBox;
    protected uiScales = UI_SCALES;
    protected readonly background: HTMLDivElement;
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly audioCombos: NCComboBox[] = [];
    protected readonly audioKeys: (keyof AudioConfig_T)[] = ["soundVolume", "musicVolume", "wavVoiceVolume", "oggVoiceVolume"];
    protected readonly audioGains = [1, 0.8, 0.6, 0.4, 0.2, 0];
    protected selectedTab = 2;
    protected readonly nameKeys: (keyof GameConfig_T)[] = ["myName", "npcName", "groupName", "pledgeMemberName", "partyMemberName", "otherPCName"];
    protected readonly nameChecks: NDomCheckBox_T[] = [];
    protected readonly autoTrackingPawn: NDomCheckBox_T;
    protected readonly useColorCursor: NDomCheckBox_T;
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
        this.background = layer.tile(this.element, 0, 48, 256, 432, 0, 0, 256, 432, TEX_GAME_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(146), false, () => this.setVisible(false));
        [206, 207, 208].forEach((id, index) => {
            const tab = layer.tab(this.element, 12 + index * 74, 25, 74, 23, TEX_TAB, TEX_TAB_SELECTED, manager.getSysString(id), null, () => this.selectTab(index));

            tab.setAttribute("aria-selected", String(index === 2));
            tab.tabIndex = 0;
            this.tabs.push(tab);
        });
        const game = this.game = layer.createWindow(0, 48, 256, 400, this.element);
        this.audio = layer.createWindow(0, 48, 256, 400, this.element);
        this.audio.hidden = true;
        this.video = layer.createWindow(0, 48, 256, 400, this.element);
        this.video.hidden = true;
        const gammaLabel = manager.getSysString(210);

        layer.text(this.video, gammaLabel, 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText(gammaLabel), 52);
        this.gamma = new NCComboBox(layer, this.video, 107, 49, 125, 17);
        this.gamma.setItems([1233, 1234, 1235, 1236, 1237, 228].map(id => manager.getSysString(id)));
        this.gamma.element.tabIndex = 0;
        this.gamma.element.setAttribute("role", "combobox");
        this.gamma.element.setAttribute("aria-label", gammaLabel);
        this.gamma.element.addEventListener("keydown", event => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            this.gamma.setSelected(Math.max(0, Math.min(GAMMA_STEPS.length, this.gamma.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
            this.gamma.setOpen(false);
        });
        this.pawnShadow = layer.checkbox(this.video, 25, 270, 109, 17, manager.getSysString(212));
        this.pawnShadow.tabIndex = 0;
        this.pawnShadow.addEventListener("keydown", event => {
            if (event.repeat || event.key !== " " && event.key !== "Enter") return;

            event.preventDefault();
            this.pawnShadow.setChecked(!this.pawnShadow.getChecked());
        });
        const rangeLabel = manager.getSysString(215);

        layer.text(this.video, rangeLabel, 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText(rangeLabel), 161);
        this.pawnRange = new NCComboBox(layer, this.video, 107, 158, 125, 17);
        this.pawnRange.setItems([1238, 1239, 1240, 1241, 1242].map(id => manager.getSysString(id)));
        this.pawnRange.element.tabIndex = 0;
        this.pawnRange.element.setAttribute("role", "combobox");
        this.pawnRange.element.setAttribute("aria-label", rangeLabel);
        this.pawnRange.element.addEventListener("keydown", event => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            this.pawnRange.setSelected(Math.max(0, Math.min(PAWN_RANGES.length - 1, this.pawnRange.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
            this.pawnRange.setOpen(false);
        });
        layer.text(this.video, "UI Scale", 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText("UI Scale"), 377);
        this.uiScale = new NCComboBox(layer, this.video, 107, 374, 125, 17);
        this.uiScale.element.tabIndex = 0;
        this.uiScale.element.setAttribute("role", "combobox");
        this.uiScale.element.setAttribute("aria-label", "UI Scale");
        layer.text(game, manager.getSysString(478), 0xffdcdcdc, FontType_T.SMALL, 24, 15);
        const initialize = layer.button(game, 88, 11, 66, 21, TEX_INITIALIZE, TEX_INITIALIZE_DOWN, null, manager.getSysString(479), () => this.onInitialize());

        initialize.tabIndex = 0;
        initialize.setAttribute("role", "button");
        initialize.setAttribute("aria-label", manager.getSysString(479));
        initialize.addEventListener("keydown", event => {
            if (event.repeat || event.key !== " " && event.key !== "Enter") return;

            event.preventDefault();
            manager.playButtonSound(true);
            this.onInitialize();
        });
        layer.text(game, manager.getSysString(329), 0xffdcdcdc, FontType_T.SMALL, 79 - layer.measureText(manager.getSysString(329)), 49); // NCGameOptionWnd::OnPaint 0x100c7940..0x100c794c.
        this.language = new NCComboBox(layer, game, 87, 46, 125, 17);
        this.language.setItems(["English"]);
        this.language.setSelected(0);
        this.language.element.tabIndex = 0;
        this.language.element.setAttribute("role", "combobox");
        this.language.element.setAttribute("aria-label", manager.getSysString(329));
        this.language.element.addEventListener("keydown", event => {
            if (!["Enter", " ", "ArrowUp", "ArrowDown", "Escape"].includes(event.key)) return;

            event.preventDefault();
            this.language.setOpen(event.key === "Escape" ? false : event.key === "Enter" || event.key === " " ? !this.language.isOpen() : true);
        });
        layer.text(game, manager.getSysString(435), 0xffdcdcdc, FontType_T.SMALL, 76 - layer.measureText(manager.getSysString(435)), 82);
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
        this.autoTrackingPawn = layer.checkbox(game, 25, 240, 100, 12, manager.getSysString(463));
        this.useColorCursor = layer.checkbox(game, 135, 240, 100, 12, manager.getSysString(305));
        this.arrowMode = layer.checkbox(game, 25, 257, 100, 12, manager.getSysString(928));
        this.showZoneTitle = layer.checkbox(game, 135, 257, 100, 12, manager.getSysString(1196));
        this.enterChatting = layer.checkbox(game, 25, 200, 100, 12, manager.getSysString(442));
        this.oldChatting = layer.checkbox(game, 135, 200, 100, 12, manager.getSysString(566));
        const keySecurity = layer.checkbox(game, 25, 217, 100, 12, manager.getSysString(926));

        keySecurity.inert = true;
        keySecurity.setAttribute("aria-disabled", "true");
        keySecurity.tabIndex = -1;
        keySecurity.style.opacity = "0.5";
        this.transparencyMode = layer.checkbox(game, 164, 15, 100, 12, manager.getSysString(927));
        this.systemMsgWnd = layer.checkbox(game, 25, 327, 150, 12, manager.getSysString(1197), () => this.updateSystemMessageControls());
        this.systemMsgWndDamage = layer.checkbox(game, 36, 344, 70, 12, manager.getSysString(357));
        this.systemMsgWndExpendableItem = layer.checkbox(game, 120, 344, 130, 12, manager.getSysString(796));
        [...this.nameChecks, this.autoTrackingPawn, this.useColorCursor, this.arrowMode, this.showZoneTitle, this.enterChatting, this.oldChatting, this.transparencyMode, this.systemMsgWnd, this.systemMsgWndDamage, this.systemMsgWndExpendableItem].forEach(checkbox => {
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
        this.gamma.setOpen(false);
        this.pawnRange.setOpen(false);
        this.language.setOpen(false);
        this.partyLooting.setOpen(false);
        this.uiScale.setOpen(false);
        this.audioCombos.forEach(combo => combo.setOpen(false));
        this.element.hidden = !isVisible;

        if (isVisible) {
            const gamma = this.getGamma();

            this.gamma.setSelected(gamma === 0 ? GAMMA_STEPS.length : GAMMA_STEPS.indexOf(gamma));
            const range = this.getPawnRange();

            this.pawnRange.setSelected(range < 1.5 ? 4 : range < 2 ? 3 : range < 2.5 ? 2 : range < 3 ? 1 : 0);
            this.uiScales = this.getUIScales();
            this.uiScale.setItems(this.uiScales.map(scale => `${scale * 100}%`));
            this.uiScale.setSelected(this.uiScales.indexOf(this.getUIScale()));

            const options = this.getOptions();

            this.pawnShadow.setChecked(options.pawnShadow);

            this.nameChecks.forEach((checkbox, index) => checkbox.setChecked(options[this.nameKeys[index]] as boolean));
            this.updateNameControls();
            this.autoTrackingPawn.setChecked(options.autoTrackingPawn);
            this.useColorCursor.setChecked(options.useColorCursor);
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
        this.gamma.setOpen(false);
        this.pawnRange.setOpen(false);
        this.selectedTab = index;
        this.game.hidden = index !== 2;
        this.audio.hidden = index !== 1;
        this.video.hidden = index !== 0;
        this.language.setOpen(false);
        this.partyLooting.setOpen(false);
        this.uiScale.setOpen(false);
        this.audioCombos.forEach(combo => combo.setOpen(false));
        this.tabs.forEach((tab, i) => {
            tab.setTextures(i === index ? TEX_TAB_SELECTED : TEX_TAB, TEX_TAB_SELECTED);
            tab.setAttribute("aria-selected", String(i === index));
        });
        this.layer.setTile(this.background, 256, 432, 0, 0, 256, 432, index === 0 ? TEX_BACK : index === 1 ? TEX_AUDIO_BACK : TEX_GAME_BACK);
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
        const gamma = this.gamma.getSelected();

        this.onApplyGamma(gamma === GAMMA_STEPS.length ? 0 : GAMMA_STEPS[gamma]);
        this.onApplyPawnRange(PAWN_RANGES[this.pawnRange.getSelected()]);
        this.onApplyUIScale(this.uiScales[this.uiScale.getSelected()]);
        this.updatePartyLootControl();
        if (!this.lootEnabled) {
            this.lootType = this.getOptions().partyLooting;
            this.partyLooting.setSelected(this.lootType);
        }
        this.onApplyAudio(Object.fromEntries(this.audioKeys.map((key, index) => [key, this.audioGains[this.audioCombos[index].getSelected()]])) as AudioConfig_T);
        this.onApply({ pawnShadow: this.pawnShadow.getChecked(), ...Object.fromEntries(this.nameKeys.map((key, index) => [key, this.nameChecks[index].getChecked()])), autoTrackingPawn: this.autoTrackingPawn.getChecked(), useColorCursor: this.useColorCursor.getChecked(), arrowMode: this.arrowMode.getChecked(), showZoneTitle: this.showZoneTitle.getChecked(), enterChatting: this.enterChatting.getChecked(), oldChatting: this.oldChatting.getChecked(), transparencyMode: this.transparencyMode.getChecked(), systemMsgWnd: this.systemMsgWnd.getChecked(), systemMsgWndDamage: this.systemMsgWndDamage.getChecked(), systemMsgWndExpendableItem: this.systemMsgWndExpendableItem.getChecked(), partyLooting: this.lootType } as GameConfig_T);
    }
}

export default NCOptionWnd;
