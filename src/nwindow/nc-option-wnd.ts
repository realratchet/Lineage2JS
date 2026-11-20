import { type default as NDomLayer, NDOM_SCROLL_TEXTURES, type NDomButton_T, type NDomCheckBox_T, type NDomScrollPane_T } from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import NCComboBox from "./nc-combo-box";
import { FontType_T } from "./nwindow-canvas";
import type { AudioConfig_T, BackgroundAudio_T, ForceAttackKey_T, GameConfig_T, GameOptions_T, SkillEffectLighting_T } from "../assets/unreal/conf-files/un-conf-system";
import { SKIN_SLOTS } from "./skin-textures";
import { GAMMA_STEPS } from "../rendering/display-gamma";
import SysString_T from "./sys-string";
import { WINDOW_ACTIONS, getDefaultWindowKeyBindings, getWindowKeyChord, isWindowKeyChord, formatWindowKeyChord } from "../game/window-key-bindings";
import type { WindowAction_T, WindowKeyBindings_T } from "../game/window-key-bindings";

const TEX_BACK = "L2UI_ch3.OptionWnd.option3_back";
const TEX_TAB_BACK = "L2UI_ch3.SSQWnd.ssq_back";
const TEX_TAB = "L2UI_ch3.TabButton.normal_tab_on";
const TEX_TAB_SELECTED = "L2UI_ch3.TabButton.normal_tab";
const TEX_BUTTON = SKIN_SLOTS.button;
const TEX_BUTTON_DOWN = SKIN_SLOTS.buttonDown;
const TEX_INITIALIZE = "L2UI_ch3.button.smallbutton2";
const TEX_INITIALIZE_DOWN = "L2UI_ch3.button.smallbutton2_down";
const WIDTH = 340;

export const UI_SCALES = [0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.25, 1.5, 1.75, 2];
export const PAWN_RANGES = [3, 2.5, 2, 1.5, 1];
export const PAWN_LIMITS = [50, 100, 200, 300, 400, 10000];

export class NCOptionWnd {
    public static getTextures() { return [TEX_BACK, TEX_TAB_BACK, TEX_TAB, TEX_TAB_SELECTED, TEX_BUTTON, TEX_BUTTON_DOWN, TEX_INITIALIZE, TEX_INITIALIZE_DOWN, "L2UI.Control.CheckBox", "L2UI.ActionWnd.CheckBox_checked", ...NDOM_SCROLL_TEXTURES, ...NCComboBox.getTextures(), ...NCFrameCtrl.getTextures()]; }
    public readonly element: HTMLDivElement;
    public getOptions: () => GameOptions_T = null;
    public onApply: (options: GameOptions_T) => void = null;
    public getAudioOptions: () => AudioConfig_T = null;
    public onApplyAudio: (options: AudioConfig_T) => void = null;
    public getGamma: () => number = null;
    public onApplyGamma: (gamma: number) => void = null;
    public getFogPreset: () => number = null;
    public onApplyFogPreset: (preset: number) => void = null;
    public getPawnRange: () => number = null;
    public onApplyPawnRange: (range: number) => void = null;
    public onInitialize: () => void = null;
    public canChangePartyLoot: () => boolean = null;
    public canUseGMControls: () => boolean = null;
    public getAntiAliasingLevels: () => number[] = null;
    public getUIScale: () => number = null;
    public getUIScales: () => number[] = null;
    public onApplyUIScale: (scale: number) => void = null;
    protected readonly game: HTMLDivElement;
    protected readonly audio: HTMLDivElement;
    protected readonly video: HTMLDivElement;
    protected readonly controls: HTMLDivElement;
    protected readonly bindingButtons = new Map<WindowAction_T, NDomButton_T>();
    protected readonly bindingRows = new Map<WindowAction_T, HTMLDivElement>();
    protected gmControlsVisible: boolean = null;
    protected readonly bindingStatus: HTMLDivElement;
    protected readonly bindingList: NDomScrollPane_T;
    protected windowKeyBindings: WindowKeyBindings_T = getDefaultWindowKeyBindings();
    protected captureAction: WindowAction_T = null;
    protected readonly capturedKeys = new Set<string>();
    protected readonly uiScale: NCComboBox;
    protected readonly gamma: NCComboBox;
    protected readonly antiAliasing: NCComboBox;
    protected antiAliasingLevels: number[] = [];
    protected readonly textureDetail: NCComboBox;
    protected readonly terrainRange: NCComboBox;
    protected readonly pawnLimit: NCComboBox;
    protected readonly pawnRange: NCComboBox;
    protected readonly skillEffectLighting: NCComboBox;
    protected readonly skillEffectLightingModes: SkillEffectLighting_T[] = ["all", "pawnOnly", "none"];
    protected readonly staticMeshLod: NDomCheckBox_T;
    protected readonly sortTransparent: NDomCheckBox_T;
    protected readonly pawnShadow: NDomCheckBox_T;
    protected readonly renderDeco: NDomCheckBox_T;
    protected readonly useTrilinear: NDomCheckBox_T;
    protected uiScales = UI_SCALES;
    protected readonly background: HTMLCanvasElement;
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly audioCombos: NCComboBox[] = [];
    protected readonly backgroundAudio: NCComboBox;
    protected readonly backgroundAudioModes: BackgroundAudio_T[] = ["all", "notices", "combat", "none"];
    protected readonly audioKeys: (keyof Omit<AudioConfig_T, "backgroundAudio">)[] = ["soundVolume", "musicVolume", "wavVoiceVolume", "oggVoiceVolume"];
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
    protected readonly invertMouseWheel: NDomCheckBox_T;
    protected readonly forceAttackKey: NCComboBox;
    protected readonly forceAttackKeys: ForceAttackKey_T[] = ["ctrl", "alt", "shift"];
    protected lootType = 0;
    protected lootEnabled = true;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, WIDTH, 480);
        this.element.classList.add("ndom-options");
        this.element.hidden = true;
        this.background = document.createElement("canvas");
        this.background.className = "ndom-tile ndom-options-background";
        this.element.appendChild(this.background);
        layer.tile(this.element, 0, 20, WIDTH, 28, 0, 0, 256, 28, TEX_TAB_BACK);
        NCFrameCtrl.createDOM(layer, this.element, WIDTH, manager.getSysString(SysString_T.Options), false, () => this.setVisible(false));
        [manager.getSysString(SysString_T.Video), manager.getSysString(SysString_T.Audio), manager.getSysString(SysString_T.Game), "Controls"].forEach((label, index) => {
            const tab = layer.tab(this.element, 12 + index * 79, 25, 78, 23, TEX_TAB, TEX_TAB_SELECTED, label, null, () => this.selectTab(index), 74);

            tab.setAttribute("aria-selected", String(index === 2));
            tab.tabIndex = 0;
            this.tabs.push(tab);
        });
        const content = document.createElement("div");

        content.className = "ndom-options-pages";
        this.element.appendChild(content);
        const game = this.game = layer.createWindow(0, 48, WIDTH, 400, content);
        this.audio = layer.createWindow(0, 48, WIDTH, 400, content);
        this.audio.hidden = true;
        this.video = layer.createWindow(0, 48, WIDTH, 400, content);
        this.video.hidden = true;
        this.controls = layer.createWindow(0, 48, WIDTH, 400, content);
        this.controls.hidden = true;
        const gammaLabel = manager.getSysString(SysString_T.Gamma);

        const gammaText = layer.text(this.video, gammaLabel, 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText(gammaLabel), 52);
        this.gamma = new NCComboBox(layer, this.video, 107, 49, 125, 17);
        this.gamma.setItems([SysString_T.VeryHigh, SysString_T.High, SysString_T.Average, SysString_T.Low, SysString_T.VeryLow, SysString_T.Off].map(id => manager.getSysString(id)));
        this.gamma.element.tabIndex = 0;
        this.gamma.element.setAttribute("role", "combobox");
        this.gamma.element.setAttribute("aria-label", gammaLabel);
        this.gamma.element.addEventListener("keydown", event => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            this.gamma.setSelected(Math.max(0, Math.min(GAMMA_STEPS.length, this.gamma.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
            this.gamma.setOpen(false);
        });
        const textureLabel = manager.getSysString(SysString_T.Texture);

        const textureText = layer.text(this.video, textureLabel, 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText(textureLabel), 71);
        this.textureDetail = new NCComboBox(layer, this.video, 107, 68, 125, 17);
        this.textureDetail.setItems([SysString_T.TextureHigh, SysString_T.TextureAverage, SysString_T.TextureLow].map(id => manager.getSysString(id)));
        this.textureDetail.element.tabIndex = 0;
        this.textureDetail.element.setAttribute("role", "combobox");
        this.textureDetail.element.setAttribute("aria-label", textureLabel);
        this.textureDetail.element.addEventListener("keydown", event => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            this.textureDetail.setSelected(Math.max(0, Math.min(2, this.textureDetail.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
            this.textureDetail.setOpen(false);
        });
        const antiAliasingLabel = manager.getSysString(SysString_T.AntiAliasing);

        const antiAliasingText = layer.text(this.video, antiAliasingLabel, 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText(antiAliasingLabel), 251);
        this.antiAliasing = new NCComboBox(layer, this.video, 107, 248, 125, 17);
        this.antiAliasing.element.tabIndex = 0;
        this.antiAliasing.element.setAttribute("role", "combobox");
        this.antiAliasing.element.setAttribute("aria-label", antiAliasingLabel);
        this.antiAliasing.element.addEventListener("keydown", event => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            this.antiAliasing.setSelected(Math.max(0, Math.min(this.antiAliasingLevels.length - 1, this.antiAliasing.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
            this.antiAliasing.setOpen(false);
        });
        this.pawnShadow = layer.checkbox(this.video, 25, 270, 109, 17, manager.getSysString(SysString_T.Shadows));
        this.renderDeco = layer.checkbox(this.video, 135, 270, 109, 17, manager.getSysString(SysString_T.GroundDetail));
        this.useTrilinear = layer.checkbox(this.video, 135, 287, 100, 17, manager.getSysString(SysString_T.TextureFilter));
        this.sortTransparent = layer.checkbox(this.video, 25, 287, 109, 17, "Sort transparent");
        this.staticMeshLod = layer.checkbox(this.video, 25, 304, 130, 17, "Static mesh LOD");
        const skillEffectLightingText = layer.text(this.video, "Skill effect lighting", 0xffdcdcdc, FontType_T.SMALL, 25, 307);

        this.skillEffectLighting = new NCComboBox(layer, this.video, 107, 304, 125, 17);
        this.skillEffectLighting.setItems(["All", "Pawn only", "None"]);
        this.skillEffectLighting.element.tabIndex = 0;
        this.skillEffectLighting.element.setAttribute("role", "combobox");
        this.skillEffectLighting.element.setAttribute("aria-label", "Skill effect lighting");
        this.skillEffectLighting.element.addEventListener("keydown", event => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            this.skillEffectLighting.setSelected(Math.max(0, Math.min(this.skillEffectLightingModes.length - 1, this.skillEffectLighting.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
            this.skillEffectLighting.setOpen(false);
        });
        [this.pawnShadow, this.renderDeco, this.useTrilinear, this.sortTransparent, this.staticMeshLod].forEach(checkbox => {
            checkbox.tabIndex = 0;
            checkbox.addEventListener("keydown", event => {
                if (event.repeat || event.key !== " " && event.key !== "Enter") return;

                event.preventDefault();
                checkbox.setChecked(!checkbox.getChecked());
            });
        });
        const rangeLabel = manager.getSysString(SysString_T.PCNPCRange);

        const rangeText = layer.text(this.video, rangeLabel, 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText(rangeLabel), 161);
        this.pawnRange = new NCComboBox(layer, this.video, 107, 158, 125, 17);
        this.pawnRange.setItems([SysString_T.VeryWide, SysString_T.Wide, SysString_T.RangeAverage, SysString_T.Narrow, SysString_T.VeryNarrow].map(id => manager.getSysString(id)));
        this.pawnRange.element.tabIndex = 0;
        this.pawnRange.element.setAttribute("role", "combobox");
        this.pawnRange.element.setAttribute("aria-label", rangeLabel);
        const terrainLabel = manager.getSysString(SysString_T.TerrainRange), limitLabel = manager.getSysString(SysString_T.PCNPCLimit);

        const terrainText = layer.text(this.video, terrainLabel, 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText(terrainLabel), 142);
        this.terrainRange = new NCComboBox(layer, this.video, 107, 139, 125, 17);
        this.terrainRange.setItems([SysString_T.VeryWide, SysString_T.Wide, SysString_T.RangeAverage, SysString_T.Narrow, SysString_T.VeryNarrow].map(id => manager.getSysString(id)));
        this.terrainRange.element.setAttribute("aria-label", terrainLabel);
        const limitText = layer.text(this.video, limitLabel, 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText(limitLabel), 180);
        this.pawnLimit = new NCComboBox(layer, this.video, 107, 177, 125, 17);
        this.pawnLimit.setItems([SysString_T.None, SysString_T.VeryHigh, SysString_T.High, SysString_T.Average, SysString_T.Low, SysString_T.VeryLow].map(id => manager.getSysString(id)));
        this.pawnLimit.element.setAttribute("aria-label", limitLabel);
        [this.pawnRange, this.terrainRange, this.pawnLimit].forEach((combo, index) => {
            combo.element.tabIndex = 0;
            combo.element.setAttribute("role", "combobox");
            combo.element.addEventListener("keydown", event => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

                event.preventDefault();
                combo.setSelected(Math.max(0, Math.min([4, 4, 5][index], combo.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
                combo.setOpen(false);
            });
        });
        const scaleText = layer.text(this.video, "UI Scale", 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText("UI Scale"), 377);
        this.uiScale = new NCComboBox(layer, this.video, 107, 374, 125, 17);
        this.uiScale.element.tabIndex = 0;
        this.uiScale.element.setAttribute("role", "combobox");
        this.uiScale.element.setAttribute("aria-label", "UI Scale");
        this.uiScale.element.addEventListener("keydown", event => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            this.uiScale.setSelected(Math.max(0, Math.min(this.uiScales.length - 1, this.uiScale.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
            this.uiScale.setOpen(false);
        });
        const interfaceText = layer.text(game, manager.getSysString(SysString_T.Interface), 0xffdcdcdc, FontType_T.SMALL, 24, 15);
        const initialize = layer.button(game, 88, 11, 66, 21, TEX_INITIALIZE, TEX_INITIALIZE_DOWN, null, manager.getSysString(SysString_T.Initialize), () => this.onInitialize());

        initialize.tabIndex = 0;
        initialize.setAttribute("role", "button");
        initialize.setAttribute("aria-label", manager.getSysString(SysString_T.Initialize));
        initialize.addEventListener("keydown", event => {
            if (event.repeat || event.key !== " " && event.key !== "Enter") return;

            event.preventDefault();
            manager.playButtonSound(true);
            this.onInitialize();
        });
        const displayText = layer.text(game, manager.getSysString(SysString_T.Display), 0xffdcdcdc, FontType_T.SMALL, 76 - layer.measureText(manager.getSysString(SysString_T.Display)), 82);
        const audioRows: HTMLElement[][] = [];

        [SysString_T.SFXVol, SysString_T.MusicVol, SysString_T.SystemVoice, SysString_T.TutorialVoice].forEach((id, index) => {
            const label = manager.getSysString(id);
            const combo = new NCComboBox(layer, this.audio, 107, 11 + index * 19, 125, 17);

            const text = layer.text(this.audio, label, 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText(label), 14 + index * 19);
            combo.setItems([SysString_T.VeryHigh, SysString_T.High, SysString_T.Average, SysString_T.Low, SysString_T.VeryLow, SysString_T.Off].map(id => manager.getSysString(id)));
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
            audioRows.push([text, combo.element]);
        });

        this.backgroundAudio = new NCComboBox(layer, this.audio, 107, 87, 125, 17);
        this.backgroundAudio.setItems(["All", "No Music", "Combat", "None"]);
        this.backgroundAudio.element.tabIndex = 0;
        this.backgroundAudio.element.setAttribute("role", "combobox");
        this.backgroundAudio.element.setAttribute("aria-label", "Background Audio");
        this.backgroundAudio.element.addEventListener("keydown", event => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            this.backgroundAudio.setSelected(Math.max(0, Math.min(3, this.backgroundAudio.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
            this.backgroundAudio.setOpen(false);
        });
        audioRows.push([layer.text(this.audio, "Background Audio", 0xffdcdcdc, FontType_T.SMALL, 98 - layer.measureText("Background Audio"), 90), this.backgroundAudio.element]);

        [SysString_T.Player, SysString_T.Monsters, SysString_T.OtherPCs, SysString_T.Clan, SysString_T.PartyNames, SysString_T.GeneralNames].forEach((id, index) => {
            const x = index < 3 ? 84 : 95, y = index < 3 ? [85, 99, 116][index] : 133 + (index - 3) * 17;
            const checkbox = layer.checkbox(game, x, y, 100, 12, manager.getSysString(id), index === 2 ? () => this.updateNameControls() : null);

            this.nameChecks.push(checkbox);
        });
        this.autoTrackingPawn = layer.checkbox(game, 25, 240, 100, 12, manager.getSysString(SysString_T.Tracking));
        this.useColorCursor = layer.checkbox(game, 135, 240, 100, 12, manager.getSysString(SysString_T.GraphicCursor));
        this.arrowMode = layer.checkbox(game, 25, 257, 100, 12, manager.getSysString(SysString_T.Arrow3D));
        this.showZoneTitle = layer.checkbox(game, 135, 257, 100, 12, manager.getSysString(SysString_T.ShowRegion));
        this.enterChatting = layer.checkbox(game, 25, 200, 100, 12, manager.getSysString(SysString_T.EnterChat));
        this.oldChatting = layer.checkbox(game, 135, 200, 100, 12, manager.getSysString(SysString_T.AutoCode));
        this.transparencyMode = layer.checkbox(game, 164, 15, 100, 12, manager.getSysString(SysString_T.Transparent));
        this.systemMsgWnd = layer.checkbox(game, 25, 327, 150, 12, manager.getSysString(SysString_T.SystemMessageWindow), () => this.updateSystemMessageControls());
        this.systemMsgWndDamage = layer.checkbox(game, 36, 344, 70, 12, manager.getSysString(SysString_T.Damage));
        this.systemMsgWndExpendableItem = layer.checkbox(game, 120, 344, 130, 12, manager.getSysString(SysString_T.Consumables));
        this.invertMouseWheel = layer.checkbox(this.controls, 25, 0, 150, 12, "Invert mouse scroll");
        [...this.nameChecks, this.autoTrackingPawn, this.useColorCursor, this.arrowMode, this.showZoneTitle, this.enterChatting, this.oldChatting, this.transparencyMode, this.systemMsgWnd, this.systemMsgWndDamage, this.systemMsgWndExpendableItem, this.invertMouseWheel].forEach(checkbox => {
            checkbox.tabIndex = 0;
            checkbox.addEventListener("keydown", event => {
                if (checkbox.getAttribute("aria-disabled") === "true" || event.repeat || event.key !== " " && event.key !== "Enter") return;

                event.preventDefault();
                checkbox.setChecked(!checkbox.getChecked());
                if (checkbox === this.nameChecks[2]) this.updateNameControls();
                if (checkbox === this.systemMsgWnd) this.updateSystemMessageControls();
            });
        });
        const lootLabel = manager.getSysString(SysString_T.PartyLoot);

        const lootText = layer.text(game, lootLabel, 0xffdcdcdc, FontType_T.SMALL, 79 - layer.measureText(lootLabel), 377);
        this.partyLooting = new NCComboBox(layer, game, 87, 374, 125, 17);
        this.partyLooting.setItems([SysString_T.FindersKeepers, SysString_T.Random, SysString_T.RandomIncludingSpoil, SysString_T.ByTurn, SysString_T.ByTurnIncludingSpoil].map(id => manager.getSysString(id)));
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
        const forceText = layer.text(this.controls, "Forced attack", 0xffdcdcdc, FontType_T.SMALL, 0, 0);

        this.forceAttackKey = new NCComboBox(layer, this.controls, 0, 0, 125, 17);
        this.forceAttackKey.setItems(["Ctrl", "Alt", "Shift"]);
        this.forceAttackKey.element.tabIndex = 0;
        this.forceAttackKey.element.setAttribute("role", "combobox");
        this.forceAttackKey.element.setAttribute("aria-label", "Forced attack");
        this.forceAttackKey.element.addEventListener("keydown", event => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

            event.preventDefault();
            this.forceAttackKey.setSelected(Math.max(0, Math.min(2, this.forceAttackKey.getSelected() + (event.key === "ArrowDown" ? 1 : -1))));
            this.forceAttackKey.setOpen(false);
        });
        layoutSections(this.video, [
            [[gammaText, this.gamma.element], [textureText, this.textureDetail.element]],
            [[terrainText, this.terrainRange.element], [rangeText, this.pawnRange.element], [limitText, this.pawnLimit.element]],
            [[antiAliasingText, this.antiAliasing.element], [skillEffectLightingText, this.skillEffectLighting.element], [this.pawnShadow, this.renderDeco], [this.sortTransparent, this.useTrilinear], [this.staticMeshLod]],
            [[scaleText, this.uiScale.element]]
        ]);
        layoutSections(this.audio, [audioRows]);
        const names = document.createElement("div");

        names.className = "ndom-options-names";
        this.nameChecks.forEach((checkbox, index) => {
            if (index >= 3) checkbox.style.marginLeft = "12px";
            names.appendChild(checkbox);
        });
        this.systemMsgWndDamage.style.marginLeft = "12px";
        layoutSections(game, [
            [[interfaceText, initialize, this.transparencyMode]],
            [[displayText, names]],
            [[this.enterChatting, this.oldChatting], [this.autoTrackingPawn, this.useColorCursor], [this.arrowMode, this.showZoneTitle]],
            [[this.systemMsgWnd], [this.systemMsgWndDamage, this.systemMsgWndExpendableItem]],
            [[lootText, this.partyLooting.element]]
        ]);
        names.parentElement.classList.add("ndom-options-tree");
        const bindings = document.createElement("div");
        const headings = document.createElement("div");

        bindings.className = "ndom-control-bindings";
        headings.className = "ndom-control-heading";
        ["Window", "Key", "Clear"].forEach(label => layer.text(headings, label, 0xffb09b79));
        this.bindingList = layer.scrollPane(bindings, 0, 0, WIDTH - 38, 208, 26);
        this.bindingList.setContentHeight(WINDOW_ACTIONS.length * 26);
        WINDOW_ACTIONS.forEach(({ id, label }, index) => {
            const row = document.createElement("div");

            row.className = "ndom-control-binding";
            layer.text(row, label);
            const button = layer.button(row, 0, 0, 110, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, "", () => this.startKeyCapture(id), null, 76);
            const clearBinding = () => {
                this.cancelKeyCapture();
                this.windowKeyBindings[id] = "";
                this.updateKeyBindings();
            };
            const clear = layer.button(row, 0, 0, 15, 15, SKIN_SLOTS.frameClose, SKIN_SLOTS.frameCloseDown, null, null, clearBinding);

            button.setAttribute("aria-label", `Rebind ${label}`);
            clear.setAttribute("aria-label", `Clear ${label} binding`);
            clear.title = `Clear ${label} binding`;
            [button, clear].forEach(element => element.addEventListener("focus", () => {
                const top = index * 26, scroll = this.bindingList.getScroll();

                if (top < scroll) this.bindingList.setScroll(top);
                else if (top + 26 > scroll + 208) this.bindingList.setScroll(top + 26 - 208);
            }));
            this.bindKeyButton(button, () => this.startKeyCapture(id));
            this.bindKeyButton(clear, clearBinding);
            this.bindingButtons.set(id, button);
            this.bindingRows.set(id, row);
            this.bindingList.content.appendChild(row);
        });
        const bindingHelp = layer.text(null, "Click a key to rebind; Esc cancels.");
        const resetBindings = layer.button(this.controls, 0, 0, 150, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, "Reset key bindings", () => this.resetKeyBindings(), null, 76);

        resetBindings.setAttribute("aria-label", "Reset key bindings");
        this.bindKeyButton(resetBindings, () => this.resetKeyBindings());
        this.bindingStatus = layer.text(null, "F1–F12 are reserved for shortcuts.");
        this.bindingStatus.classList.add("ndom-binding-status");
        this.bindingStatus.setAttribute("role", "status");
        layoutSections(this.controls, [[[this.invertMouseWheel], [forceText, this.forceAttackKey.element]], [[bindingHelp], [headings], [bindings], [resetBindings], [this.bindingStatus]]]);
        resetBindings.parentElement.style.justifyContent = "center";
        this.updateKeyBindings();
        this.updateGMControls();
        const footer = document.createElement("div");

        footer.className = "ndom-options-footer";
        this.element.appendChild(footer);
        [SysString_T.OK, SysString_T.Cancel, SysString_T.Apply].forEach((id, index) => {
            const press = () => {
                if (index !== 1) this.apply();
                if (index !== 2) this.setVisible(false);
            };
            const button = layer.button(footer, 11 + index * 80, 450, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(id), press);

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
        new ResizeObserver(() => this.updateBackground()).observe(this.element);
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, Math.trunc((width - WIDTH) * 0.5), Math.max(0, Math.trunc((height - (this.element.offsetHeight || 480)) * 0.5))); }
    public isVisible() { return !this.element.hidden; }

    public setVisible(isVisible: boolean) {
        this.cancelKeyCapture();
        this.gamma.setOpen(false);
        this.pawnRange.setOpen(false);
        this.terrainRange.setOpen(false);
        this.pawnLimit.setOpen(false);
        this.textureDetail.setOpen(false);
        this.antiAliasing.setOpen(false);
        this.skillEffectLighting.setOpen(false);
        this.partyLooting.setOpen(false);
        this.forceAttackKey.setOpen(false);
        this.uiScale.setOpen(false);
        this.audioCombos.forEach(combo => combo.setOpen(false));
        this.backgroundAudio.setOpen(false);
        this.element.hidden = !isVisible;

        if (isVisible) {
            this.updateGMControls();
            const gamma = this.getGamma();

            this.gamma.setSelected(gamma === 0 ? GAMMA_STEPS.length : GAMMA_STEPS.indexOf(gamma));
            const range = this.getPawnRange();

            this.terrainRange.setSelected(5 - this.getFogPreset());
            this.pawnLimit.setSelected(6 - this.getOptions().renderActorLimitOpt);
            this.pawnRange.setSelected(range < 1.5 ? 4 : range < 2 ? 3 : range < 2.5 ? 2 : range < 3 ? 1 : 0);
            this.uiScales = this.getUIScales();
            this.uiScale.setItems(this.uiScales.map(scale => `${scale * 100}%`));
            this.uiScale.setSelected(this.uiScales.indexOf(this.getUIScale()));

            const options = this.getOptions();

            this.pawnShadow.setChecked(options.pawnShadow);
            this.staticMeshLod.setChecked(options.staticMeshLod);
            this.sortTransparent.setChecked(options.sortTransparent);
            this.skillEffectLighting.setSelected(this.skillEffectLightingModes.indexOf(options.skillEffectLighting));
            this.renderDeco.setChecked(options.renderDeco);
            this.useTrilinear.setChecked(options.useTrilinear);
            this.textureDetail.setSelected(options.textureDetail);
            this.antiAliasingLevels = this.getAntiAliasingLevels();
            this.antiAliasing.setItems(this.antiAliasingLevels.map(level => this.layer.getManager().getSysString(SysString_T.NoAntiAliasing + level)));
            this.antiAliasing.setSelected(Math.max(0, this.antiAliasingLevels.indexOf(options.antiAliasing)));

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
            this.invertMouseWheel.setChecked(options.invertMouseWheel);
            this.forceAttackKey.setSelected(this.forceAttackKeys.indexOf(options.forceAttackKey));
            this.windowKeyBindings = { ...options.windowKeyBindings };
            this.updateKeyBindings();
            const audio = this.getAudioOptions();

            this.backgroundAudio.setSelected(this.backgroundAudioModes.indexOf(audio.backgroundAudio));
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

    public captureKeyEvent(event: KeyboardEvent) {
        if (event.type === "keyup") return this.capturedKeys.delete(event.code) || this.captureAction !== null;
        if (event.repeat && this.capturedKeys.has(event.code)) return true;

        this.capturedKeys.delete(event.code);
        if (this.captureAction === null) return false;

        this.capturedKeys.add(event.code);
        if (event.isComposing || event.repeat) return true;
        if (event.key === "Escape") {
            this.cancelKeyCapture();
            return true;
        }
        if (/^(Control|Alt|Shift|Meta)(Left|Right)$/.test(event.code)) return true;

        const chord = getWindowKeyChord(event);

        if (event.metaKey || !isWindowKeyChord(chord)) {
            this.layer.renderText(this.bindingStatus, /^F\d+$/.test(event.code) ? "Function keys are reserved for shortcuts." : "That key combination is reserved.", 0xffb09b79);
            return true;
        }
        const conflict = WINDOW_ACTIONS.find(action => action.id !== this.captureAction && this.windowKeyBindings[action.id] === chord);

        if (conflict) {
            this.layer.renderText(this.bindingStatus, `${formatWindowKeyChord(chord)} is assigned to ${conflict.label}.`, 0xffb09b79);
            return true;
        }

        this.windowKeyBindings[this.captureAction] = chord;
        this.cancelKeyCapture();
        return true;
    }

    public cancelKeyCapture() {
        this.captureAction = null;
        this.updateKeyBindings();
        this.layer.renderText(this.bindingStatus, "F1–F12 are reserved for shortcuts.", 0xffb09b79);
    }

    protected startKeyCapture(id: WindowAction_T) {
        if (this.bindingRows.get(id)!.hidden) return;

        this.cancelKeyCapture();
        this.captureAction = id;
        this.bindingButtons.get(id)!.setLabel("Press a key…");
        this.bindingButtons.get(id)!.focus();
        this.layer.renderText(this.bindingStatus, "Press a key combination. Esc cancels.", 0xffdcdcdc);
    }

    protected bindKeyButton(button: NDomButton_T, press: () => void) {
        button.tabIndex = 0;
        button.setAttribute("role", "button");
        button.addEventListener("keydown", event => {
            if (event.repeat || event.key !== " " && event.key !== "Enter") return;

            event.preventDefault();
            press();
        });
    }

    protected resetKeyBindings() {
        this.cancelKeyCapture();
        this.windowKeyBindings = getDefaultWindowKeyBindings();
        this.updateKeyBindings();
    }

    protected updateKeyBindings() {
        for (const { id } of WINDOW_ACTIONS) {
            const button = this.bindingButtons.get(id)!;

            button.setLabel(formatWindowKeyChord(this.windowKeyBindings[id]));
            button.title = formatWindowKeyChord(this.windowKeyBindings[id]);
        }
    }

    public updateGMControls() {
        const visible = this.canUseGMControls ? this.canUseGMControls() : false;

        if (visible === this.gmControlsVisible) return;

        this.gmControlsVisible = visible;
        this.bindingRows.get("gm")!.hidden = this.bindingRows.get("gmPetitions")!.hidden = !visible;
        if (!visible && (this.captureAction === "gm" || this.captureAction === "gmPetitions")) this.cancelKeyCapture();
        this.bindingList.setContentHeight((WINDOW_ACTIONS.length - (visible ? 0 : 2)) * 26);
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
        this.cancelKeyCapture();
        this.gamma.setOpen(false);
        this.pawnRange.setOpen(false);
        this.terrainRange.setOpen(false);
        this.pawnLimit.setOpen(false);
        this.textureDetail.setOpen(false);
        this.antiAliasing.setOpen(false);
        this.selectedTab = index;
        this.game.hidden = index !== 2;
        this.audio.hidden = index !== 1;
        this.video.hidden = index !== 0;
        this.controls.hidden = index !== 3;
        this.partyLooting.setOpen(false);
        this.forceAttackKey.setOpen(false);
        this.uiScale.setOpen(false);
        this.audioCombos.forEach(combo => combo.setOpen(false));
        this.backgroundAudio.setOpen(false);
        this.tabs.forEach((tab, i) => {
            tab.setTextures(i === index ? TEX_TAB_SELECTED : TEX_TAB, TEX_TAB_SELECTED);
            tab.setAttribute("aria-selected", String(i === index));
        });
        this.updateBackground();
    }

    protected updateBackground() {
        if (!this.element.offsetWidth) return;

        const width = this.element.offsetWidth, height = this.element.offsetHeight - 48;
        const image = this.layer.getManager().canvas.getTexture(TEX_BACK);
        const canvas = this.background, context = canvas.getContext("2d");

        canvas.width = width;
        canvas.height = height;
        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 400, 256, 1, 0, 0, width, height - 4);
        context.drawImage(image, 0, 428, 256, 4, 0, height - 4, width, 4);

        const panel = [this.video, this.audio, this.game, this.controls][this.selectedTab];

        for (const section of Array.from(panel.children) as HTMLElement[]) {
            const x = panel.offsetLeft + section.offsetLeft, y = panel.offsetTop + section.offsetTop - 48;
            const w = section.offsetWidth, h = section.offsetHeight;

            context.clearRect(x, y, w, h);
            for (let row = 0; row < 3; row++)
                for (let col = 0; col < 3; col++)
                    context.drawImage(image, [11, 12, 244][col], [6, 7, 34][row], [1, 232, 1][col], [1, 27, 1][row], x + [0, 1, w - 1][col], y + [0, 1, h - 1][row], [1, w - 2, 1][col], [1, h - 2, 1][row]);
        }
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
        this.onApplyFogPreset(5 - this.terrainRange.getSelected());
        this.onApplyPawnRange(PAWN_RANGES[this.pawnRange.getSelected()]);
        this.onApplyUIScale(this.uiScales[this.uiScale.getSelected()]);
        this.updatePartyLootControl();
        if (!this.lootEnabled) {
            this.lootType = this.getOptions().partyLooting;
            this.partyLooting.setSelected(this.lootType);
        }
        this.onApplyAudio({ ...Object.fromEntries(this.audioKeys.map((key, index) => [key, this.audioGains[this.audioCombos[index].getSelected()]])), backgroundAudio: this.backgroundAudioModes[this.backgroundAudio.getSelected()] } as AudioConfig_T);
        this.onApply({ renderActorLimitOpt: 6 - this.pawnLimit.getSelected(), antiAliasing: this.antiAliasingLevels[this.antiAliasing.getSelected()], textureDetail: this.textureDetail.getSelected(), useTrilinear: this.useTrilinear.getChecked(), renderDeco: this.renderDeco.getChecked(), pawnShadow: this.pawnShadow.getChecked(), sortTransparent: this.sortTransparent.getChecked(), staticMeshLod: this.staticMeshLod.getChecked(), skillEffectLighting: this.skillEffectLightingModes[this.skillEffectLighting.getSelected()], ...Object.fromEntries(this.nameKeys.map((key, index) => [key, this.nameChecks[index].getChecked()])), autoTrackingPawn: this.autoTrackingPawn.getChecked(), useColorCursor: this.useColorCursor.getChecked(), arrowMode: this.arrowMode.getChecked(), showZoneTitle: this.showZoneTitle.getChecked(), enterChatting: this.enterChatting.getChecked(), oldChatting: this.oldChatting.getChecked(), transparencyMode: this.transparencyMode.getChecked(), systemMsgWnd: this.systemMsgWnd.getChecked(), systemMsgWndDamage: this.systemMsgWndDamage.getChecked(), systemMsgWndExpendableItem: this.systemMsgWndExpendableItem.getChecked(), partyLooting: this.lootType, invertMouseWheel: this.invertMouseWheel.getChecked(), forceAttackKey: this.forceAttackKeys[this.forceAttackKey.getSelected()], windowKeyBindings: { ...this.windowKeyBindings } } as GameOptions_T);
    }
}

function layoutSections(parent: HTMLElement, sections: HTMLElement[][][]) {
    parent.classList.add("ndom-options-content");
    sections.forEach(rows => {
        const section = document.createElement("div");

        section.className = "ndom-options-section";
        const columnWidth = Math.max(0, ...rows.filter(elements => elements.length === 2 && elements.every(element => element.getAttribute("role") === "checkbox")).map(elements => 16 + parseFloat(elements[0].querySelector<HTMLElement>(".ndom-text").style.width)));

        rows.forEach(elements => {
            const row = document.createElement("div");

            row.className = "ndom-options-row";
            elements.forEach(element => {
                if (element.getAttribute("role") === "checkbox") {
                    const label = element.querySelector<HTMLElement>(".ndom-text");

                    element.style.width = `${16 + parseFloat(label.style.width)}px`;
                }
                if (elements.length === 2 && elements.every(element => element.getAttribute("role") === "checkbox") && element === elements[0])
                    element.style.minWidth = `${columnWidth}px`;

                row.appendChild(element);
            });
            section.appendChild(row);
        });
        parent.appendChild(section);
    });
}

export default NCOptionWnd;
