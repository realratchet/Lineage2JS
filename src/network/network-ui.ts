import { Say2_T, ShortCutType_T, StatusUpdate_T, GaugeColor_T, Paperdoll_T, ItemType2_T } from "./game-packets";
import { Vector3 } from "three";
import NWindowManager from "../nwindow/nwindow-manager";
import type NWindowCanvas from "../nwindow/nwindow-canvas";
import type BaseActor from "../base-actor";
import type RenderManager from "../rendering/render-manager";
import Nameplate from "../rendering/nameplate";
import NDomLayer, { NDOM_EDIT_TEXTURES } from "../nwindow/ndom";
import NCPlayerStatusWnd from "../nwindow/nc-player-status-wnd";
import NCAbnormalStatusWnd from "../nwindow/nc-abnormal-status-wnd";
import NCTargetStatusWnd from "../nwindow/nc-target-status-wnd";
import NCRestartMenuWnd from "../nwindow/nc-restart-menu-wnd";
import NCShortCutWnd from "../nwindow/nc-shortcut-wnd";
import NCCoolTimeIcon from "../nwindow/nc-cool-time-icon";
import type { ShortcutEntry_T } from "../nwindow/nc-shortcut-wnd";
import NCChatWnd from "../nwindow/nc-chat-wnd";
import NCLoginWnd from "../nwindow/nc-login-wnd";
import NCLoginServerWnd from "../nwindow/nc-server-select-wnd";
import NCLobbyWnd from "../nwindow/nc-lobby-wnd";
import NCPawnCreateWnd from "../nwindow/nc-pawn-create-wnd";
import NCLoadingWnd from "../nwindow/nc-loading-wnd";
import NCNPCHtmlViewer from "../nwindow/nc-npc-html-viewer";
import NCInventoryWnd from "../nwindow/nc-inventory-wnd";
import NCMenuWnd, { type MenuButton_T } from "../nwindow/nc-menu-wnd";
import type NCSkillWnd from "../nwindow/nc-skill-wnd";
import NCMainWnd, { type MainTab_T } from "../nwindow/nc-main-wnd";
import NCMapWnd from "../nwindow/nc-map-wnd";
import NCSystemMenuWnd from "../nwindow/nc-system-menu-wnd";
import NCMessageWnd from "../nwindow/nc-message-wnd";
import NCDialogBox, { DialogType_T } from "../nwindow/nc-dialog-box";
import type NetworkManager from "./network-manager";
import type AssetManager from "../assets/asset-manager";
import type { TargetStatus_T } from "../nwindow/nc-target-status-wnd";
import type { LobbyPawnLabel_T } from "../nwindow/nc-lobby-wnd";
import type { PawnCreateSelection_T } from "../nwindow/nc-pawn-create-wnd";
import type { GameServerInfo_T } from "./login-client";
import type { CharSelectEntry_T, CharTemplate_T, ShortCut_T, UserInfo_T, InventoryItem_T, SkillEntry_T, AbnormalStatus_T, ClanInfo_T } from "./game-packets";
import NCTooltip from "../nwindow/nc-tooltip";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";

export type Nameplate_T = { actor: BaseActor, name: string, title: string, isNpc: boolean, isSummon: boolean, isDead: boolean, karma: number, pvpFlag: number, recommendations: number, nameColor: number, isTarget: boolean };

const TEX_TARGET_BRACKET = "L2ui.NWindow.target";
const arrGaugeTextures = ["L2UI_CH3.Etc.Minibar_Magic", "L2UI_CH3.Etc.Minibar_Arrow", "L2UI_CH3.Etc.Minibar_water", "L2UI_CH3.Etc.Minibar_Food"];
const arrGaugeBack = ["L2UI_CH3.Etc.Minibar_Back21", "L2UI_CH3.Etc.Minibar_Back22", "L2UI_CH3.Etc.Minibar_Back23"];
const arrGaugeOrder = [GaugeColor_T.CYAN, GaugeColor_T.RED, GaugeColor_T.BLUE, GaugeColor_T.GREEN];
const arrEquipmentSlots = [Paperdoll_T.PAPERDOLL_UNDER, Paperdoll_T.PAPERDOLL_HEAD, Paperdoll_T.PAPERDOLL_BACK, Paperdoll_T.PAPERDOLL_HAIR, Paperdoll_T.PAPERDOLL_NECK, Paperdoll_T.PAPERDOLL_RHAND, Paperdoll_T.PAPERDOLL_CHEST, Paperdoll_T.PAPERDOLL_LHAND, Paperdoll_T.PAPERDOLL_REAR, Paperdoll_T.PAPERDOLL_LEAR, Paperdoll_T.PAPERDOLL_GLOVES, Paperdoll_T.PAPERDOLL_LEGS, Paperdoll_T.PAPERDOLL_FEET, Paperdoll_T.PAPERDOLL_RFINGER, Paperdoll_T.PAPERDOLL_LFINGER]; // NWindow 0x100744e0 / 0x10094080.
const tmpNameplateAnchor = new Vector3();
const tmpGaugeAnchor = new Vector3();
const tmpGaugeDown = new Vector3();
const tmpGaugePosition = new Vector3();

function getNameColor(plate: Nameplate_T): number { // User::GetNameColor 0x10466690. The server nameColor alpha byte is forced opaque: L2J sends 0x00RRGGBB.
    if (plate.karma > 0) {
        const k = Math.min(255, Math.max(plate.karma, Math.trunc(plate.karma / 16) + 100));

        return (0xffff0000 | (255 - k) << 8 | (255 - k)) >>> 0;
    }

    if (plate.pvpFlag === 1) return 0xffff00ff;
    if (!plate.isNpc && plate.nameColor !== 0xffffffff) return (0xff000000 | plate.nameColor) >>> 0;
    if (plate.recommendations >= 1 && plate.recommendations <= 255) return (0xff0000ff | (255 - plate.recommendations) << 16 | (255 - Math.trunc(plate.recommendations / 2)) << 8) >>> 0;

    return 0xffffffff;
}

function getTitleColor(plate: Nameplate_T): number { // DrawTargetName 0x1051e6e5: NPC titles light green (summons light blue), player titles light cyan.
    if (plate.isNpc) return plate.isSummon ? 0xff9cb3ec : 0xffa9ec9c;

    return 0xffa2f9ec;
}

type Screen_T = "login" | "servers" | "lobby" | "create" | "loading" | "world";
type SkillPointerDrag_T = { type: "skill" | "action", id: number, pointerId: number, x: number, y: number, isDragging: boolean };

export class NetworkUI {
    protected readonly manNetwork: NetworkManager;
    protected readonly nwindow: NWindowManager;
    protected readonly layer: NDomLayer;
    protected readonly playerStatusWnd = new NCPlayerStatusWnd();
    protected readonly abnormalStatusWnd = new NCAbnormalStatusWnd();
    protected readonly targetStatusWnd = new NCTargetStatusWnd();
    protected readonly restartMenuWnd = new NCRestartMenuWnd();
    protected readonly skillCoolTimes = new Map<string, NCCoolTimeIcon>();
    protected readonly shortCutWnd = new NCShortCutWnd(this.skillCoolTimes);
    protected readonly chatWnd = new NCChatWnd();
    protected loginWnd: NCLoginWnd = null;
    protected loginServerWnd: NCLoginServerWnd = null;
    protected lobbyWnd: NCLobbyWnd = null;
    protected pawnCreateWnd: NCPawnCreateWnd = null;
    protected loadingWnd: NCLoadingWnd = null;
    protected npcHtmlViewer: NCNPCHtmlViewer = null;
    protected inventoryWnd: NCInventoryWnd = null;
    protected inventory: InventoryItem_T[] = [];
    protected menuWnd: NCMenuWnd = null;
    protected mainWnd: NCMainWnd = null;
    protected skillWnd: NCSkillWnd = null;
    protected mapWnd: NCMapWnd = null;
    protected systemMenuWnd: NCSystemMenuWnd = null;
    protected messageWnd: NCMessageWnd = null;
    protected dialogBox: NCDialogBox = null;
    protected strings: GameStrings_T;
    protected templates: CharTemplate_T[] = [];
    protected characterNames: string[] = [];
    protected statusInfo: UserInfo_T = null;
    protected areHudWindowsAdded = false;
    protected screen: Screen_T = null;
    protected skillPointerDrag: SkillPointerDrag_T = null;
    protected readonly gauges = new Map<GaugeColor_T, { remaining: number, maximum: number, startedAt: number }>();
    protected readonly nameplates = new Map<BaseActor, Nameplate>();

    protected readonly manRender: RenderManager;
    protected readonly isTransparencyMode: boolean;

    public constructor(network: NetworkManager, asset: AssetManager, render: RenderManager) {
        this.manNetwork = network;
        this.manRender = render;
        this.nwindow = new NWindowManager(asset);
        this.layer = new NDomLayer(this.nwindow);
        this.strings = this.nwindow.strings;
        this.targetStatusWnd.onClose = () => network.cancelTarget();
        this.restartMenuWnd.onRestart = type => network.requestRestartPoint(type);
        this.shortCutWnd.onUse = (page, slot) => network.useShortCut(page, slot);
        this.shortCutWnd.onAutoSoulShot = (page, slot) => network.toggleAutoSoulShot(page, slot);
        this.playerStatusWnd.onClick = event => { if (event.button === 0) network.requestAction(render.player, event.shift); };
        this.chatWnd.onSend = (text, type, target) => network.say(text, type, target);
        this.chatWnd.onBuildCommand = command => network.sendBypassBuildCmd(command);
        this.chatWnd.setSystemMsgWnd(asset.userConfig.game.systemMsgWnd);
        this.isTransparencyMode = asset.userConfig.game.transparencyMode;

        window.addEventListener("keydown", event => {
            if (event.key !== "Enter" || this.screen !== "world" || this.chatWnd.isInputFocused() || (event.target as HTMLElement).tagName === "INPUT") return;

            event.preventDefault();
            this.chatWnd.focusInput();
        });
        window.addEventListener("resize", () => this.placeScreens());
        window.addEventListener("dragover", event => this.onSkillDrop(event));
        window.addEventListener("drop", event => this.onSkillDrop(event));
        window.addEventListener("pointerdown", event => this.onSkillPointerDown(event), true);
        window.addEventListener("pointermove", event => this.onSkillPointerMove(event), true);
        window.addEventListener("pointerup", event => this.onSkillPointerUp(event), true);
        window.addEventListener("pointercancel", event => this.onSkillPointerCancel(event), true);
        window.addEventListener("keydown", event => {
            const target = event.target as HTMLElement;

            if (this.screen !== "world" || !event.altKey || !["KeyI", "KeyT", "KeyK", "KeyC", "KeyU", "KeyN", "KeyV", "KeyM", "KeyX"].includes(event.code) || event.repeat || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

            event.preventDefault();
            switch (event.code) {
                case "KeyI": this.toggleCharacterStatus(); break;
                case "KeyT": this.toggleSkillTab("status"); break;
                case "KeyK": this.toggleSkills(); break;
                case "KeyC": this.toggleSkillTab("actions"); break;
                case "KeyU": this.toggleSkillTab("quest"); break;
                case "KeyN": this.toggleSkillTab("clan"); break;
                case "KeyV": this.toggleInventory(); break;
                case "KeyM": this.toggleMap(); break;
                case "KeyX": this.toggleSystemMenu(); break;
            }
        }, true);
    }

    public setStrings(strings: GameStrings_T) {
        this.strings = strings;
        this.nwindow.strings = strings;
        if (this.mainWnd) void this.mainWnd.actionWnd.setActions(strings);
        this.nwindow.invalidate();
    }

    public getStrings() { return this.strings; }

    protected onSkillDrop(event: DragEvent) {
        const skillType = event.dataTransfer.types.includes("application/x-lineage-skill"), actionType = event.dataTransfer.types.includes("application/x-lineage-action");

        if (this.screen !== "world" || !skillType && !actionType || (event.target as HTMLElement).closest(".ndom-layer")) return;
        if (this.nwindow.findClientWindow(event) !== this.shortCutWnd) return;

        const slot = this.shortCutWnd.getSlotAt(this.nwindow.canvas.toUI(event.clientX) - this.shortCutWnd.getScreenX(), this.nwindow.canvas.toUI(event.clientY) - this.shortCutWnd.getScreenY());

        if (slot < 0) return;

        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";

        if (event.type === "drop") {
            if (skillType) this.manNetwork.registerSkillShortCut(Number(event.dataTransfer.getData("application/x-lineage-skill")), this.shortCutWnd.getPage(), slot);
            else this.manNetwork.registerActionShortCut(Number(event.dataTransfer.getData("application/x-lineage-action")), this.shortCutWnd.getPage(), slot);
        }
    }

    protected onSkillPointerDown(event: PointerEvent) {
        if (event.button !== 0 || this.screen !== "world" || !this.skillWnd) return;

        const target = event.target as Element;
        const button = target && target.closest ? target.closest("[data-skill-id], [data-action-id]") as HTMLElement : null;

        if (!button || !this.mainWnd.element.contains(button) || button.getAttribute("aria-disabled") === "true") return;

        const skillId = button.dataset.skillId, actionId = button.dataset.actionId;

        this.skillPointerDrag = { type: skillId ? "skill" : "action", id: Number(skillId || actionId), pointerId: event.pointerId, x: event.clientX, y: event.clientY, isDragging: false };
    }

    protected onSkillPointerMove(event: PointerEvent) {
        const drag = this.skillPointerDrag;

        if (!drag || drag.pointerId !== event.pointerId) return;
        if (!(event.buttons & 1)) {
            this.skillPointerDrag = null;
            return;
        }
        if (!drag.isDragging && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;

        drag.isDragging = true;
        event.preventDefault();
    }

    protected onSkillPointerUp(event: PointerEvent) {
        const drag = this.skillPointerDrag;

        if (!drag || drag.pointerId !== event.pointerId) return;

        this.skillPointerDrag = null;
        if (!drag.isDragging) return;

        event.preventDefault();
        this.registerSkillDrop(drag.type, drag.id, this.nwindow.canvas.toUI(event.clientX), this.nwindow.canvas.toUI(event.clientY));
    }

    protected onSkillPointerCancel(event: PointerEvent) {
        if (this.skillPointerDrag?.pointerId === event.pointerId) this.skillPointerDrag = null;
    }

    protected registerSkillDrop(type: "skill" | "action" | "item", id: number, x: number, y: number) {
        if (this.screen !== "world") return false;

        let target = this.nwindow.findWindow(x, y);
        while (target && target !== this.shortCutWnd) target = target.parent;
        if (target !== this.shortCutWnd) return false;

        const slot = this.shortCutWnd.getSlotAt(x - this.shortCutWnd.getScreenX(), y - this.shortCutWnd.getScreenY());

        if (slot < 0) return false;

        if (type === "skill") this.manNetwork.registerSkillShortCut(id, this.shortCutWnd.getPage(), slot);
        else if (type === "action") this.manNetwork.registerActionShortCut(id, this.shortCutWnd.getPage(), slot);
        else this.manNetwork.registerItemShortCut(id, this.shortCutWnd.getPage(), slot); // 0x1007a1e0(1, page * 12 + slot, objectId, 1)

        return true;
    }

    public async createScreens() {
        if (this.loginWnd) return;

        await this.layer.loadTextures([...NCLoginWnd.getTextures(), ...NCLoginServerWnd.getTextures(), ...NCLobbyWnd.getTextures(), ...NCPawnCreateWnd.getTextures(), ...NCLoadingWnd.getTextures(), ...NCNPCHtmlViewer.getTextures(), ...NCInventoryWnd.getTextures(), ...NCMenuWnd.getTextures(), ...NCMainWnd.getTextures(), ...NCMapWnd.getTextures(), ...NCSystemMenuWnd.getTextures(), ...NCMessageWnd.getTextures(), ...NCDialogBox.getTextures(), ...NDOM_EDIT_TEXTURES]);

        const network = this.manNetwork;

        this.loginWnd = new NCLoginWnd(this.layer);
        this.loginWnd.onLogin = (account, password) => void network.connectLogin(account, password);
        this.loginWnd.auth.onError = text => this.showMessage(text);

        this.loginServerWnd = new NCLoginServerWnd(this.layer);
        this.loginServerWnd.onSelect = serverId => void network.connectGame(serverId);
        this.loginServerWnd.onCancel = () => network.cancelLogin();
        this.loginServerWnd.serverInfo.viewer.onLink = path => void this.showServerHelp(path.split("\\").pop());
        void this.showServerHelp("server_help.htm");

        this.lobbyWnd = new NCLobbyWnd(this.layer);
        this.lobbyWnd.onSelect = index => network.previewCharacter(index);
        this.lobbyWnd.onStart = index => network.selectCharacter(index);
        this.lobbyWnd.onCreate = () => network.requestNewCharacter();
        this.lobbyWnd.onDelete = index => this.confirm(this.formatSystemMessage(78, this.characterNames[index]), () => network.deleteCharacter(index));
        this.lobbyWnd.onRestore = index => this.confirm(this.nwindow.getSystemMessage(1555), () => network.restoreCharacter(index));
        this.lobbyWnd.onRelogin = () => network.relogin();
        this.lobbyWnd.onSystemMessage = id => this.showMessage(this.nwindow.getSystemMessage(id));

        this.pawnCreateWnd = new NCPawnCreateWnd(this.layer);
        this.pawnCreateWnd.onCreate = (name, selection) => this.createCharacter(name, selection);
        this.pawnCreateWnd.onBack = () => network.cancelCreate();
        this.pawnCreateWnd.onChange = selection => network.previewCreate(selection);
        this.pawnCreateWnd.onRotate = direction => network.rotateCreatePreview(direction);
        this.pawnCreateWnd.onZoom = isIn => network.zoomCreatePreview(isIn);

        this.loadingWnd = new NCLoadingWnd(this.layer);

        this.messageWnd = new NCMessageWnd(this.layer);
        this.dialogBox = new NCDialogBox(this.layer);
        this.npcHtmlViewer = new NCNPCHtmlViewer(this.layer);
        this.npcHtmlViewer.onBypass = command => network.bypass(command);
        this.npcHtmlViewer.onLink = path => network.link(path);
        this.inventoryWnd = new NCInventoryWnd(this.layer);
        this.inventoryWnd.onUse = objectId => network.useItem(objectId);
        this.inventoryWnd.onChoose = objectId => network.chooseInventoryItem(objectId);
        this.inventoryWnd.onDropItem = (objectId, clientX, clientY) => this.registerSkillDrop("item", objectId, this.nwindow.canvas.toUI(clientX), this.nwindow.canvas.toUI(clientY));
        this.menuWnd = new NCMenuWnd(this.layer);
        this.menuWnd.onSelect = (button: MenuButton_T) => {
            switch (button) {
                case "characterStatus": this.toggleCharacterStatus(); break;
                case "inventory": this.toggleInventory(); break;
                case "map": this.toggleMap(); break;
                case "system": this.toggleSystemMenu(); break;
                default: throw new Error(`Unknown menu button '${button}'.`);
            }
        };
        this.mainWnd = new NCMainWnd(this.layer, this.skillCoolTimes);
        this.mainWnd.onSelect = tab => { if (tab === "skills") network.requestSkillList(); };
        this.skillWnd = this.mainWnd.skillWnd;
        this.skillWnd.onUse = id => network.useSkill(id);
        this.mainWnd.actionWnd.onUse = id => network.useAction(id);
        void this.mainWnd.actionWnd.setActions(this.strings);
        this.mapWnd = new NCMapWnd(this.layer);
        this.systemMenuWnd = new NCSystemMenuWnd(this.layer);
        this.systemMenuWnd.onSelect = item => {
            switch (item) {
                case "community": network.showBoard(); break;
                case "restart": this.dialogBox.show(this.nwindow.getSystemMessage(126), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.requestRestart(); }); break;
                case "exit": this.dialogBox.show(this.nwindow.getSystemMessage(125), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.logout(); }); break;
            }
        };

        this.placeScreens();
        this.show(null);
    }

    protected placeScreens() {
        if (!this.loginWnd) return;

        const width = this.nwindow.canvas.width, height = this.nwindow.canvas.height;

        for (const wnd of [this.loginWnd, this.loginServerWnd, this.lobbyWnd, this.pawnCreateWnd, this.loadingWnd, this.npcHtmlViewer, this.inventoryWnd, this.menuWnd, this.mainWnd, this.mapWnd, this.systemMenuWnd, this.messageWnd, this.dialogBox]) wnd.placeOnScreen(width, height);
        this.manRender.radar.uiScale = this.nwindow.canvas.cssScale;
    }

    protected show(screen: Screen_T) {
        this.screen = screen;
        this.loginWnd.setVisible(screen === "login" || screen === "servers", screen === "login");
        this.loginServerWnd.setVisible(screen === "servers");
        this.lobbyWnd.setVisible(screen === "lobby");
        this.pawnCreateWnd.setVisible(screen === "create");
        this.loadingWnd.setVisible(screen === "loading");
        this.manRender.radar.isVisible = screen === "world";
        this.layer.setTransparencyMode(screen === "world" && this.isTransparencyMode); // 0x10038e93: only children of the game console root take the flag.

        if (screen !== "world") this.hideWorld();
    }

    public showMessage(text: string) { // NCGodWnd::ShowMessage 0x10090bd0 fills the bottom NCMessageWnd bar; in the world, messages go to chat.
        if (this.screen === "world") this.chatWnd.addSystemMessage(text, 0xffb09b79);
        else this.messageWnd.show(text);
    }

    protected confirm(text: string, onYes: () => void) { this.dialogBox.show(text, DialogType_T.YES_NO, isYes => { if (isYes) onYes(); }); }

    public showConfirm(messageId: number, text: string, onAnswer: (isOk: boolean) => void) {
        if (messageId === 0) this.dialogBox.hide();
        else this.dialogBox.show(text, DialogType_T.OK_CANCEL, onAnswer, messageId !== 1510); // NCGaraDialogBox::SetDialog, NWindow RVA 0x8b90: replacement does not decline resurrection.
    }

    public showPartyInvite(name: string, onAnswer: (isAccepted: boolean) => void) { this.dialogBox.show(this.formatSystemMessage(66, name), DialogType_T.YES_NO, onAnswer); }
    public showAllyInvite(requestor: string, allyName: string, onAnswer: (isAccepted: boolean) => void) { this.dialogBox.show(this.formatSystemMessage(527, requestor, allyName), DialogType_T.YES_NO, onAnswer); }
    public showPledgeInvite(requestor: string, pledgeName: string, onAnswer: (isAccepted: boolean) => void) { this.dialogBox.show(this.formatSystemMessage(67, requestor, pledgeName), DialogType_T.YES_NO, onAnswer); }
    public showFriendInvite(name: string, onAnswer: (isAccepted: boolean) => void) { this.dialogBox.show(this.formatSystemMessage(516, name), DialogType_T.YES_NO, onAnswer); }

    protected formatSystemMessage(id: number, ...params: string[]): string {
        return this.nwindow.getSystemMessage(id).replace(/\$[sc](\d)/g, (match, index) => params[Number(index) - 1] ?? match);
    }

    protected async showServerHelp(name: string) { await this.loginServerWnd.serverInfo.viewer.setHtml(await this.manNetwork.getParent().getComponent("asset").getL2Text(name)); }

    public showLogin() {
        this.loginWnd.setBusy(false);
        this.dialogBox.hide();
        this.messageWnd.show(this.nwindow.getSystemMessage(94));
        this.show("login");
    }

    public setLoginBusy(isBusy: boolean) { this.loginWnd.setBusy(isBusy); }

    public showServers(servers: GameServerInfo_T[], lastServerId: number) {
        this.loginServerWnd.setServers(servers.map(server => ({ id: server.id, name: this.strings.serverNames[server.id] || String(server.id), isUp: server.isUp, currentPlayers: server.currentPlayers, maxPlayers: server.maxPlayers, pvp: server.pvp, isTestServer: server.isTestServer, ping: 9999 })), lastServerId);
        this.messageWnd.show("");
        this.show("servers");
    }

    public showCharacters(characters: CharSelectEntry_T[]) {
        this.characterNames = characters.map(character => character.name);
        this.messageWnd.hide();
        this.lobbyWnd.setCharacters(characters.map(character => ({ name: character.name, level: character.level, className: this.nwindow.getClassName(character.activeClassId), curHp: character.curHp, maxHp: character.maxHp, curMp: character.curMp, maxMp: character.maxMp, sp: character.sp, exp: character.exp, karma: character.karma, deleteSeconds: character.deleteSeconds })));
        this.show("lobby");
    }

    public setSelectedCharacter(index: number) { this.lobbyWnd.setSelected(index); }
    public setPawnLabels(labels: LobbyPawnLabel_T[]) { this.lobbyWnd.setPawnLabels(labels); }
    public isLobbyVisible() { return this.screen === "lobby"; }
    public getScreenCanvas() { return this.nwindow.canvas; }

    public showCreateCharacter(templates: CharTemplate_T[]) {
        this.templates = templates;
        this.pawnCreateWnd.setTemplates(templates);
        this.show("create");
    }

    protected createCharacter(name: string, selection: PawnCreateSelection_T) {
        const classId = this.pawnCreateWnd.getTemplate(selection).classId;
        const template = this.templates.find(entry => entry.classId === classId);

        this.manNetwork.createCharacter({ name, race: template.race, sex: selection.sex, classId, INT: template.INT, STR: template.STR, CON: template.CON, MEN: template.MEN, DEX: template.DEX, WIT: template.WIT, hairStyle: selection.hairStyle, hairColor: selection.hairColor, face: selection.face });
    }

    public showLoading() {
        this.prepareWorld();
        this.show("loading");
    }

    protected prepareWorld() { // World packets reach the HUD windows while the loading screen is still up.
        if (this.areHudWindowsAdded) return;

        this.areHudWindowsAdded = true;
        void this.nwindow.canvas.loadTextures([TEX_TARGET_BRACKET, ...arrGaugeTextures, ...arrGaugeBack]);
        this.nwindow.overlayPaint = canvas => { if (this.screen === "world") this.paintGauges(canvas); };
        void this.nwindow.addWindow(this.playerStatusWnd);
        void this.nwindow.addWindow(this.abnormalStatusWnd);
        void this.nwindow.addWindow(this.targetStatusWnd);
        void this.nwindow.addWindow(this.shortCutWnd);
        void this.nwindow.addWindow(this.chatWnd);
        void this.nwindow.addWindow(this.restartMenuWnd);
    }

    public showWorld() {
        void this.nwindow.canvas.loadTextures(NCCoolTimeIcon.getTextures());
        void this.manNetwork.getParent().getComponent("asset").loadSound("ItemSound.cooltime_end");
        this.show("world");
        this.messageWnd.hide();
        this.dialogBox.hide();

        this.prepareWorld();
        this.menuWnd.setVisible(true);
        this.playerStatusWnd.setVisible(true);
        this.abnormalStatusWnd.setVisible(true);
        this.shortCutWnd.setVisible(true);
        this.chatWnd.setVisible(true);
    }

    public showHtml(html: string) { void this.npcHtmlViewer.show(html); }
    public hideHtml() { this.npcHtmlViewer.hide(); }

    public updateNameplates() { // FDynamicActor::Render anchor (cylinder top) and DrawTargetName 0x1051d780 layout, LargeFont, no crests or icons.
        for (const [actor, nameplate] of this.nameplates) {
            nameplate.visible = false;
            if (actor.parent && this.screen === "world") continue;

            nameplate.dispose();
            this.nameplates.delete(actor);
        }
        if (this.screen !== "world") return;

        const camera = this.manRender.camera, canvas = this.nwindow.canvas;
        const width = canvas.width, height = canvas.height;
        const scale = 2 / (height * camera.projectionMatrix.elements[5]);

        for (const plate of this.manNetwork.getNameplates()) {
            const collisionHeight = plate.actor.getCollisionHeight();

            plate.actor.getWorldPosition(tmpNameplateAnchor);
            tmpNameplateAnchor.z += collisionHeight * 2 - (plate.isDead ? 2 * collisionHeight * 0.65 : 0);
            tmpNameplateAnchor.project(camera);

            if (tmpNameplateAnchor.z < -1 || tmpNameplateAnchor.z >= 1 || Math.abs(tmpNameplateAnchor.x) > 1 || Math.abs(tmpNameplateAnchor.y) > 1) continue;

            const sx = Math.trunc((tmpNameplateAnchor.x + 1) * 0.5 * width), sy = Math.trunc((1 - tmpNameplateAnchor.y) * 0.5 * height);
            let nameplate = this.nameplates.get(plate.actor);

            if (!nameplate) {
                nameplate = new Nameplate();
                this.nameplates.set(plate.actor, nameplate);
                this.manRender.scene.add(nameplate);
            }
            nameplate.update(canvas, plate.name, plate.title, getNameColor(plate), getTitleColor(plate), plate.isTarget && canvas.hasTexture(TEX_TARGET_BRACKET), TEX_TARGET_BRACKET);
            tmpNameplateAnchor.x = sx / width * 2 - 1;
            tmpNameplateAnchor.y = 1 - sy / height * 2;
            nameplate.position.copy(tmpNameplateAnchor.unproject(camera));
            nameplate.scale.set(nameplate.width * scale, nameplate.height * scale, 1);
            nameplate.visible = true;
        }
    }

    public setupGauge(color: GaugeColor_T, remaining: number, maximum: number) {
        if (!arrGaugeTextures[color]) throw new Error(`Unknown gauge color '${color}'.`);

        if (remaining <= 0 || maximum <= 0) this.gauges.delete(color);
        else this.gauges.set(color, { remaining, maximum, startedAt: performance.now() });
    }

    protected paintGauges(canvas: NWindowCanvas) {
        if (this.gauges.size === 0) return;

        const camera = this.manRender.camera, player = this.manRender.player;
        const now = performance.now();
        const left = canvas.getTexture(arrGaugeBack[0]), middle = canvas.getTexture(arrGaugeBack[1]), right = canvas.getTexture(arrGaugeBack[2]);

        if (!left || !middle || !right) return;

        tmpGaugeAnchor.copy(player.position);
        tmpGaugeAnchor.z += player.getCollisionHeight() * 2;
        const distance = Math.trunc(tmpGaugeAnchor.distanceTo(camera.position)) / 1000;

        tmpGaugeDown.set(0, -1, 0).applyQuaternion(camera.quaternion);
        tmpGaugeAnchor.addScaledVector(tmpGaugeDown, distance * 6); // FDynamicActor::Render 0x8f1329..0x8f138b.

        for (const color of arrGaugeOrder) {
            const gauge = this.gauges.get(color);

            if (!gauge) continue;
            const remaining = gauge.remaining - (now - gauge.startedAt);

            if (remaining <= 0) {
                this.gauges.delete(color);
                continue;
            }

            tmpGaugePosition.copy(tmpGaugeAnchor).project(camera);

            if (tmpGaugePosition.z >= 1 || Math.abs(tmpGaugePosition.x) > 1 || Math.abs(tmpGaugePosition.y) > 1) continue;

            const x = (tmpGaugePosition.x + 1) * 0.5 * canvas.width - 44, y = (1 - tmpGaugePosition.y) * 0.5 * canvas.height;
            const fill = Math.trunc(96 * remaining / gauge.maximum);
            const texture = canvas.getTexture(arrGaugeTextures[color]);

            if (!texture) continue;

            // UCanvas::DrawDepthBar 0x7f9f26..0x7fa23d: 96x2 fill and three background pieces.
            canvas.drawTile(x - 1, y - 1, left.width, 4, 0, 0, left.width, left.height, arrGaugeBack[0], 128);
            canvas.drawTile(x - 1 + left.width, y - 1, 98 - left.width - right.width, 4, 0, 0, middle.width, middle.height, arrGaugeBack[1], 128);
            canvas.drawTile(x + 97 - right.width, y - 1, right.width, 4, 0, 0, right.width, right.height, arrGaugeBack[2], 128);
            canvas.drawTile(x, y, fill, 2, 0, 0, texture.width, texture.height, arrGaugeTextures[color], 128);

            if (color === GaugeColor_T.CYAN || color === GaugeColor_T.RED) {
                tmpGaugeDown.multiplyScalar(distance * 3);
                tmpGaugeAnchor.add(tmpGaugeDown);
            }
        }
    }

    public hideWorld() {
        this.dialogBox.hide();
        this.gauges.clear();
        this.skillCoolTimes.clear();
        this.abnormalStatusWnd.setEffects([]);
        this.abnormalStatusWnd.setVisible(false);
        this.npcHtmlViewer.hide();
        this.inventoryWnd.setVisible(false);
        this.menuWnd.setVisible(false);
        this.mainWnd.setVisible(false);
        this.mapWnd.setVisible(false);
        this.systemMenuWnd.setVisible(false);
        this.playerStatusWnd.setVisible(false);
        this.shortCutWnd.setVisible(false);
        this.chatWnd.setVisible(false);
        this.restartMenuWnd.setVisible(false);
        this.targetStatusWnd.setTarget(null);
    }

    public setAbnormalStatus(effects: AbnormalStatus_T[]) { this.abnormalStatusWnd.setEffects(effects); }

    public setSkillCoolTime(id: number, level: number, duration: number, remaining: number) {
        if (duration < 0 || remaining < 0 || remaining > duration) throw new Error(`Invalid skill reuse time ${duration}/${remaining}.`);

        const key = `${id}:${level}`;

        if (remaining === 0) this.skillCoolTimes.delete(key);
        else this.skillCoolTimes.set(key, new NCCoolTimeIcon(duration, remaining));

        this.nwindow.invalidate();
    }

    public render() {
        const now = performance.now();

        for (const [key, coolTime] of this.skillCoolTimes) {
            const wasFinishing = coolTime.isFinishing;
            const texture = coolTime.texture;

            coolTime.update(now);
            if (coolTime.isFinishing && !wasFinishing && coolTime.texture && this.shortCutWnd.hasCoolTime(key)) void this.manNetwork.getParent().getComponent("audio").playInterfaceSound("ItemSound.cooltime_end"); // NCShortCutWnd::OnPaint, NWindow RVA 0x106d2d.
            if (!coolTime.texture) this.skillCoolTimes.delete(key);
            if (texture !== coolTime.texture) this.nwindow.invalidate();
        }
        if (this.skillWnd) this.skillWnd.renderCoolTimes();

        if (this.mapWnd && this.mapWnd.isVisible()) {
            const position = this.manRender.player.position;

            this.mapWnd.setPosition(position.x, position.y);
        }
        this.nwindow.render();
    }

    public setStatus(info: UserInfo_T) {
        this.statusInfo = info;
        this.mainWnd.actionWnd.setClass(info.classId);
        this.playerStatusWnd.setStatus(info);
        this.mainWnd.detailStatusWnd.setStatus(info);
        this.inventoryWnd.setWeight(info.curLoad, info.maxLoad);
        this.setInventory(this.inventory);
    }

    public toggleCharacterStatus() { this.mainWnd.setVisible(!this.mainWnd.isVisible()); }
    public toggleSkills() { this.toggleSkillTab("skills"); }
    public setClan(clan: ClanInfo_T) { this.mainWnd.detailStatusWnd.setClan(clan); }

    public setRunning(isRunning: boolean) {
        if (!this.statusInfo) return;

        this.statusInfo.isRunning = isRunning;
        this.mainWnd.detailStatusWnd.setStatus(this.statusInfo);
    }

    public toggleSkillTab(tab: MainTab_T) {
        if (this.mainWnd.isVisible() && this.mainWnd.getSelectedTab() === tab) {
            this.mainWnd.setVisible(false);
            return;
        }

        this.mainWnd.selectTab(tab);
        this.mainWnd.setVisible(true);
    }

    public setSkills(skills: SkillEntry_T[]) { void this.skillWnd.setSkills(skills); }

    public toggleMap() {
        this.mapWnd.setVisible(!this.mapWnd.isVisible());
        if (this.mapWnd.isVisible()) {
            const position = this.manRender.player.position;

            this.mapWnd.setPosition(position.x, position.y, true);
        }
    }

    public showMap(_mapId: number) {
        if (!this.mapWnd.isVisible()) this.toggleMap();
    }


    public chooseInventoryItem(itemId: number) { this.inventoryWnd.chooseItem(itemId); }
    public clearInventoryChoice() { this.inventoryWnd.clearChoice(); }

    public toggleSystemMenu() {
        this.systemMenuWnd.setVisible(!this.systemMenuWnd.isVisible());
    }

    public toggleInventory() {
        if (this.inventoryWnd.isVisible()) this.inventoryWnd.setVisible(false);
        else this.manNetwork.requestItemList();
    }

    public setInventory(items: InventoryItem_T[], showWindow: boolean = false) {
        this.inventory = items;

        const paperdoll = this.statusInfo ? this.statusInfo.paperdollObjects : [];

        void this.inventoryWnd.setItems(items.map(item => ({ objectId: item.objectId, itemId: item.itemId, name: this.strings.itemNames[item.itemId], icon: this.strings.itemIcons[item.itemId], count: item.count, enchant: item.enchantLevel, itemClass: item.type2, bodyPart: item.bodyPart, info: this.strings.itemInfos[item.itemId], slot: item.isEquipped ? arrEquipmentSlots.findIndex(slot => paperdoll[slot] === item.objectId) : -1, isQuest: item.type2 === ItemType2_T.TYPE2_QUEST, isMoney: item.type2 === ItemType2_T.TYPE2_MONEY })));

        if (showWindow) this.inventoryWnd.setVisible(true);
    }

    public updateStatus(status: Record<number, number>) {
        const info = this.statusInfo;

        if (!info) return;
        if (StatusUpdate_T.LEVEL in status) info.level = status[StatusUpdate_T.LEVEL];
        if (StatusUpdate_T.EXP in status) info.exp = status[StatusUpdate_T.EXP];
        if (StatusUpdate_T.CUR_HP in status) info.curHp = status[StatusUpdate_T.CUR_HP];
        if (StatusUpdate_T.MAX_HP in status) info.maxHp = status[StatusUpdate_T.MAX_HP];
        if (StatusUpdate_T.CUR_MP in status) info.curMp = status[StatusUpdate_T.CUR_MP];
        if (StatusUpdate_T.MAX_MP in status) info.maxMp = status[StatusUpdate_T.MAX_MP];
        if (StatusUpdate_T.CUR_CP in status) info.curCp = status[StatusUpdate_T.CUR_CP];
        if (StatusUpdate_T.MAX_CP in status) info.maxCp = status[StatusUpdate_T.MAX_CP];
        if (StatusUpdate_T.STR in status) info.str = status[StatusUpdate_T.STR];
        if (StatusUpdate_T.DEX in status) info.dex = status[StatusUpdate_T.DEX];
        if (StatusUpdate_T.CON in status) info.con = status[StatusUpdate_T.CON];
        if (StatusUpdate_T.INT in status) info.int = status[StatusUpdate_T.INT];
        if (StatusUpdate_T.WIT in status) info.wit = status[StatusUpdate_T.WIT];
        if (StatusUpdate_T.MEN in status) info.men = status[StatusUpdate_T.MEN];
        if (StatusUpdate_T.SP in status) info.sp = status[StatusUpdate_T.SP];
        if (StatusUpdate_T.CUR_LOAD in status) info.curLoad = status[StatusUpdate_T.CUR_LOAD];
        if (StatusUpdate_T.MAX_LOAD in status) info.maxLoad = status[StatusUpdate_T.MAX_LOAD];
        if (StatusUpdate_T.P_ATK in status) info.pAtk = status[StatusUpdate_T.P_ATK];
        if (StatusUpdate_T.ATK_SPD in status) info.atkSpd = status[StatusUpdate_T.ATK_SPD];
        if (StatusUpdate_T.P_DEF in status) info.pDef = status[StatusUpdate_T.P_DEF];
        if (StatusUpdate_T.EVASION in status) info.evasion = status[StatusUpdate_T.EVASION];
        if (StatusUpdate_T.ACCURACY in status) info.accuracy = status[StatusUpdate_T.ACCURACY];
        if (StatusUpdate_T.CRITICAL in status) info.critical = status[StatusUpdate_T.CRITICAL];
        if (StatusUpdate_T.M_ATK in status) info.mAtk = status[StatusUpdate_T.M_ATK];
        if (StatusUpdate_T.CAST_SPD in status) info.castSpd = status[StatusUpdate_T.CAST_SPD];
        if (StatusUpdate_T.M_DEF in status) info.mDef = status[StatusUpdate_T.M_DEF];
        if (StatusUpdate_T.PVP_FLAG in status) info.pvpFlag = status[StatusUpdate_T.PVP_FLAG];
        if (StatusUpdate_T.KARMA in status) info.karma = status[StatusUpdate_T.KARMA];

        this.playerStatusWnd.setStatus(info);
        this.mainWnd.detailStatusWnd.setStatus(info);
        this.inventoryWnd.setWeight(info.curLoad, info.maxLoad);
    }

    public setInventoryLimit(limit: number) { this.inventoryWnd.setLimit(limit); }

    public setMountable(canMount: boolean) { if (this.mainWnd) this.mainWnd.actionWnd.setMountable(canMount); }

    public setTarget(target: TargetStatus_T) { this.targetStatusWnd.setTarget(target); }

    public addChat(name: string, text: string, type: Say2_T) { this.chatWnd.addCreatureSay(name, text, type); }
    public addSystemMessage(text: string, color: number) { this.chatWnd.addSystemMessage(text, color); }

    public clearShortCuts() { this.shortCutWnd.clearSlots(); }
    public removeShortCut(slot: number) { this.shortCutWnd.setSlot(Math.trunc(slot / 12), slot % 12, null); }

    public setShortCut(shortcut: ShortCut_T, item: InventoryItem_T = null, isAutoSoulShot = false) {
        const strings = this.strings;
        let entry: ShortcutEntry_T = null;

        switch (shortcut.type) {
            case ShortCutType_T.TYPE_ITEM:
                if (item) entry = { icon: strings.itemIcons[item.itemId], label: strings.itemNames[item.itemId], tooltip: `${strings.itemNames[item.itemId]} (${item.count.toLocaleString("en-US")})`, isAutoSoulShot };
                break;
            case ShortCutType_T.TYPE_SKILL: {
                const info = NCTooltip.shortcutSkill(strings, shortcut.id, shortcut.level);

                entry = { icon: strings.skillInfos[`${shortcut.id}:${shortcut.level}`]?.icon || strings.skillIcons[shortcut.id], label: info.title, tooltip: info, skillKey: `${shortcut.id}:${shortcut.level}` };
                break;
            }
            case ShortCutType_T.TYPE_ACTION: {
                const action = strings.actions[shortcut.id];

                entry = { icon: action.icon, label: action.command, tooltip: action.command };
                break;
            }
            default: break; // TODO: macro and recipe icons need their list packets.
        }

        this.shortCutWnd.setSlot(Math.trunc(shortcut.slot / 12), shortcut.slot % 12, entry && entry.icon ? entry : null);
    }

    public showDeath(options: boolean[]) {
        this.restartMenuWnd.setOptions(options);
        this.restartMenuWnd.setVisible(true);
    }

    public hideDeath() { this.restartMenuWnd.setVisible(false); }
}

export default NetworkUI;
