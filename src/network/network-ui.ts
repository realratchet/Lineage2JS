import * as GamePackets from "./game-packets";
import { Vector3 } from "three";
import NWindowManager from "../nwindow/nwindow-manager";
import type NWindowCanvas from "../nwindow/nwindow-canvas";
import type BaseActor from "../base-actor";
import type RenderManager from "../rendering/render-manager";
import Nameplate from "../rendering/nameplate";
import ChatBalloon from "../rendering/chat-balloon";
import LandmarkComponent from "../rendering/components/landmark-component";
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
import NCCommunityWnd from "../nwindow/nc-community-wnd";
import NCInventoryWnd from "../nwindow/nc-inventory-wnd";
import NCPetWnd from "../nwindow/nc-pet-wnd";
import NCSummonedWnd from "../nwindow/nc-summoned-wnd";
import NCPetStatusWnd from "../nwindow/nc-pet-status-wnd";
import NCPledgePowerWnd from "../nwindow/nc-pledge-power-wnd";
import type { InventoryEntry_T } from "../nwindow/nc-inventory-wnd";
import NCTradeWnd from "../nwindow/nc-trade-wnd";
import NCShopWnd from "../nwindow/nc-shop-wnd";
import NCManorShopWnd from "../nwindow/nc-manor-shop-wnd";
import NCRecipeBookWnd from "../nwindow/nc-recipe-book-wnd";
import NCRecipeManufactureWnd from "../nwindow/nc-recipe-manufacture-wnd";
import NCRecipeTreeWnd from "../nwindow/nc-recipe-tree-wnd";
import NCRecipeShopWnd from "../nwindow/nc-recipe-shop-wnd";
import NCRecipeBuyListWnd from "../nwindow/nc-recipe-buy-list-wnd";
import NCRecipeBuyManufactureWnd from "../nwindow/nc-recipe-buy-manufacture-wnd";
import NCHennaListWnd from "../nwindow/nc-henna-list-wnd";
import NCHennaInfoWnd from "../nwindow/nc-henna-info-wnd";
import NCMatchWnd from "../nwindow/nc-match-wnd";
import NCPartyRoomMakingWnd from "../nwindow/nc-party-room-making-wnd";
import NCPartyRoomWnd from "../nwindow/nc-party-room-wnd";
import NCFishViewportWnd from "../nwindow/nc-fish-viewport-wnd";
import NCHeroTowerWnd from "../nwindow/nc-hero-tower-wnd";
import NCCommandInfoWnd from "../nwindow/nc-command-info-wnd";
import NCTrainWnd from "../nwindow/nc-train-wnd";
import NCPrivateShopWnd from "../nwindow/nc-private-shop-wnd";
import NCPrivateBuyWnd from "../nwindow/nc-private-buy-wnd";
import NCVIPShopWnd from "../nwindow/nc-vip-shop-wnd";
import NCStoreWnd from "../nwindow/nc-store-wnd";
import NCGMMagicSkillWnd from "../nwindow/nc-gm-magic-skill-wnd";
import NCGMInventoryWnd from "../nwindow/nc-gm-inventory-wnd";
import NCGMStoreWnd from "../nwindow/nc-gm-store-wnd";
import NCGMQuestWnd from "../nwindow/nc-gm-quest-wnd";
import NCGMWnd from "../nwindow/nc-gm-wnd";
import NCGMClanWnd from "../nwindow/nc-gm-clan-wnd";
import NCGMDetailStatusWnd, { type GMClanInfo_T } from "../nwindow/nc-gm-detail-status-wnd";
import { convertDDSTextureInfo } from "../assets/unreal/dds/dxt-decode";
import NCOlympiadControlWnd from "../nwindow/nc-olympiad-control-wnd";
import NCOlympiadPlayerWnd from "../nwindow/nc-olympiad-player-wnd";
import NCOlympiadTargetWnd from "../nwindow/nc-olympiad-target-wnd";
import NWnd from "../nwindow/nwnd";
import NCDeliverWnd from "../nwindow/nc-deliver-wnd";
import NCSelectDeliverWnd from "../nwindow/nc-select-deliver-wnd";
import NCMenuWnd, { type MenuButton_T } from "../nwindow/nc-menu-wnd";
import type NCSkillWnd from "../nwindow/nc-skill-wnd";
import NCMainWnd, { type MainTab_T } from "../nwindow/nc-main-wnd";
import NCMapWnd from "../nwindow/nc-map-wnd";
import NCMacroWnd from "../nwindow/nc-macro-wnd";
import NCSystemMenuWnd from "../nwindow/nc-system-menu-wnd";
import NCMessageWnd from "../nwindow/nc-message-wnd";
import NCDialogBox, { DialogType_T } from "../nwindow/nc-dialog-box";
import type NetworkManager from "./network-manager";
import type AssetManager from "../assets/asset-manager";
import type { TargetStatus_T } from "../nwindow/nc-target-status-wnd";
import type { LobbyPawnLabel_T } from "../nwindow/nc-lobby-wnd";
import type { PawnCreateSelection_T } from "../nwindow/nc-pawn-create-wnd";
import type { GameServerInfo_T } from "./login-client";
import encodeCrest from "./crest-encoder";
import NCTooltip from "../nwindow/nc-tooltip";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";

export type Nameplate_T = { actor: BaseActor, name: string, title: string, isNpc: boolean, isSummon: boolean, isDead: boolean, isSitting: boolean, karma: number, pvpFlag: number, recommendations: number, nameColor: number, isTarget: boolean, isMouseTarget: boolean, isChatRange: boolean, privateStoreType: GamePackets.PrivateStoreType_T, storeMessage: string, chatMessage: string };

const TEX_TARGET_BRACKET = "L2ui.NWindow.target";
const TEX_MOUSE_TARGET_BRACKET = "L2ui.NWindow.normal"; // UCanvas::Init 0x7f0769, TargetRenderType 1
const arrGaugeTextures = ["L2UI_CH3.Etc.Minibar_Magic", "L2UI_CH3.Etc.Minibar_Arrow", "L2UI_CH3.Etc.Minibar_water", "L2UI_CH3.Etc.Minibar_Food"];
const arrGaugeBack = ["L2UI_CH3.Etc.Minibar_Back21", "L2UI_CH3.Etc.Minibar_Back22", "L2UI_CH3.Etc.Minibar_Back23"];
const arrGaugeOrder = [GamePackets.GaugeColor_T.CYAN, GamePackets.GaugeColor_T.RED, GamePackets.GaugeColor_T.BLUE, GamePackets.GaugeColor_T.GREEN];
const arrBalloonTextures = ["L2UI_ch3.ChatBack.balloon1_1", "L2UI_ch3.ChatBack.balloon1_2", "L2UI_ch3.ChatBack.balloon1_3", "L2UI_ch3.ChatBack.balloon1_4", "L2UI_ch3.ChatBack.balloon2_1", "L2UI_ch3.ChatBack.balloon2_2", "L2UI_ch3.ChatBack.balloon2_3", "L2UI_ch3.ChatBack.balloon2_4"];
const arrChatStoreTypes = [GamePackets.PrivateStoreType_T.STORE_PRIVATE_NONE, GamePackets.PrivateStoreType_T.STORE_PRIVATE_SELL_MANAGE, GamePackets.PrivateStoreType_T.STORE_PRIVATE_BUY_MANAGE, GamePackets.PrivateStoreType_T.STORE_PRIVATE_MANUFACTURE_MANAGE];
const storeBalloons: Record<number, [number, number]> = { [GamePackets.PrivateStoreType_T.STORE_PRIVATE_SELL]: [500, 0xffeaa5f5], [GamePackets.PrivateStoreType_T.STORE_PRIVATE_BUY]: [499, 0xfffdfea5], [GamePackets.PrivateStoreType_T.STORE_PRIVATE_MANUFACTURE]: [665, 0xffffbb33], [GamePackets.PrivateStoreType_T.STORE_PRIVATE_PACKAGE_SELL]: [1273, 0xfffc7575] }; // FDynamicActor::DrawChat 0x106185ef..0x1061889d: sysstring label, text colour.
const equipmentSlots: Record<number, number> = { 1: 0, 8: 4, 64: 1, 128: 5, 256: 7, 512: 10, 1024: 6, 2048: 11, 4096: 12, 8192: 2, 16384: 5, 32768: 6, 65536: 3, 131072: 6 }; // NWindow 0x100744e0, primary cells for 16 / 15 / 17.
const tmpNameplateAnchor = new Vector3();
const tmpBalloonAnchor = new Vector3();
const tmpBalloonUp = new Vector3();
const tmpGaugeAnchor = new Vector3();
const tmpGaugeDown = new Vector3();
const tmpGaugePosition = new Vector3();
const tmpDropPoint = new Vector3();

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
type SkillPointerDrag_T = { type: "skill" | "action", id: number, pointerId: number, icon: string, button: HTMLElement, isDragging: boolean };

function getEquipmentSlot(bodyPart: number, objectId: number, paperdoll: number[]): number {
    if (bodyPart & 0x6) {
        if (paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_REAR] === objectId) return 8;
        if (paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LEAR] === objectId) return 9;
    }
    if (bodyPart & 0x30) {
        if (paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_RFINGER] === objectId) return 13;
        if (paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LFINGER] === objectId) return 14;
    }

    return equipmentSlots[bodyPart] ?? -1;
}

export class NetworkUI {
    protected readonly manNetwork: NetworkManager;
    protected readonly nwindow: NWindowManager;
    protected readonly layer: NDomLayer;
    protected readonly playerStatusWnd = new NCPlayerStatusWnd();
    protected readonly petStatusWnd = new NCPetStatusWnd(2);
    protected readonly summonedStatusWnd = new NCPetStatusWnd(1);
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
    protected npcItemHtmlViewer: NCNPCHtmlViewer = null;
    protected npcHtmlViewer: NCNPCHtmlViewer = null;
    protected communityWnd: NCCommunityWnd = null;
    protected helpWnd: NCNPCHtmlViewer = null;
    protected inventoryWnd: NCInventoryWnd = null;
    protected petWnd: NCPetWnd = null;
    protected summonedWnd: NCSummonedWnd = null;
    protected pledgePowerWnd: NCPledgePowerWnd = null;
    protected tradeWnd: NCTradeWnd = null;
    protected shopWnd: NCShopWnd = null;
    protected manorShopWnd: NCManorShopWnd = null;
    protected recipeBookWnd: NCRecipeBookWnd = null;
    protected recipeManufactureWnd: NCRecipeManufactureWnd = null;
    protected recipeTreeWnd: NCRecipeTreeWnd = null;
    protected recipeShopWnd: NCRecipeShopWnd = null;
    protected recipeBuyListWnd: NCRecipeBuyListWnd = null;
    protected recipeBuyManufactureWnd: NCRecipeBuyManufactureWnd = null;
    protected hennaListWnd: NCHennaListWnd = null;
    protected hennaInfoWnd: NCHennaInfoWnd = null;
    protected matchWnd: NCMatchWnd = null;
    protected partyRoomMakingWnd: NCPartyRoomMakingWnd = null;
    protected partyRoomWnd: NCPartyRoomWnd = null;
    protected fishViewportWnd: NCFishViewportWnd = null;
    protected heroTowerWnd: NCHeroTowerWnd = null;
    protected commandInfoWnd: NCCommandInfoWnd = null;
    protected trainWnd: NCTrainWnd = null;
    protected readonly options: AssetManager["userConfig"];
    protected privateShopWnd: NCPrivateShopWnd = null;
    protected privateBuyWnd: NCPrivateBuyWnd = null;
    protected vipShopWnd: NCVIPShopWnd = null;
    protected previewShopWnd: NCShopWnd = null;
    protected storeWnd: NCStoreWnd = null;
    protected gmSkillWnd: NCGMMagicSkillWnd = null;
    protected gmInventoryWnd: NCGMInventoryWnd = null;
    protected gmStoreWnd: NCGMStoreWnd = null;
    protected gmQuestWnd: NCGMQuestWnd = null;
    protected gmDetailWnd: NCGMDetailStatusWnd = null;
    protected gmClanWnd: NCGMClanWnd = null;
    protected gmWnd: NCGMWnd = null;
    protected gmDetailClan: GMClanInfo_T = null;
    protected cacheCrests = new Map<number, HTMLCanvasElement>();
    protected cacheServerCrests = new Map<number, Map<number, HTMLCanvasElement>>([[0, this.cacheCrests]]);
    protected olympiadControlWnd: NCOlympiadControlWnd = null;
    protected isOlympiadObserver = false;
    protected readonly olympiadPlayerWnds = [new NCOlympiadPlayerWnd(1), new NCOlympiadPlayerWnd(2)];
    protected readonly olympiadAbnormalWnds = [new NCAbnormalStatusWnd(), new NCAbnormalStatusWnd()];
    protected readonly olympiadTargetWnd = new NCOlympiadTargetWnd();
    protected windowGroup = 0;
    protected savedLandmarkEnabled: boolean = null;
    protected readonly savedWindowGroups: (NWnd | HTMLElement)[][] = [[], [], []];
    protected deliverWnd: NCDeliverWnd = null;
    protected selectDeliverWnd: NCSelectDeliverWnd = null;
    protected inventory: GamePackets.InventoryItem_T[] = [];
    protected menuWnd: NCMenuWnd = null;
    protected mainWnd: NCMainWnd = null;
    protected skillWnd: NCSkillWnd = null;
    protected mapWnd: NCMapWnd = null;
    protected macroWnd: NCMacroWnd = null;
    protected systemMenuWnd: NCSystemMenuWnd = null;
    protected messageWnd: NCMessageWnd = null;
    protected dialogBox: NCDialogBox = null;
    protected yesNoDialogBox: NCDialogBox = null;
    protected strings: GameStrings_T;
    protected templates: GamePackets.CharTemplate_T[] = [];
    protected characterNames: string[] = [];
    protected statusInfo: GamePackets.UserInfo_T = null;
    protected areHudWindowsAdded = false;
    protected screen: Screen_T = null;
    protected inputCtrl = false;
    protected inputShift = false;
    protected skillPointerDrag: SkillPointerDrag_T = null;
    protected readonly gauges = new Map<GamePackets.GaugeColor_T, { remaining: number, maximum: number, startedAt: number }>();
    protected readonly nameplates = new Map<BaseActor, Nameplate>();
    protected readonly balloons = new Map<BaseActor, ChatBalloon>();

    protected readonly manRender: RenderManager;
    protected readonly isTransparencyMode: boolean;
    protected readonly isEnterChatting: boolean;

    public constructor(network: NetworkManager, asset: AssetManager, render: RenderManager) {
        this.manNetwork = network;
        this.options = asset.userConfig;
        this.manRender = render;
        this.nwindow = new NWindowManager(asset);
        this.layer = new NDomLayer(this.nwindow);
        this.strings = this.nwindow.strings;
        this.targetStatusWnd.onClose = () => network.cancelTarget();
        this.restartMenuWnd.onRestart = type => network.requestRestartPoint(type);
        this.shortCutWnd.onUse = (page, slot, ctrl, shift) => network.useShortCut(page, slot, ctrl, shift);
        this.shortCutWnd.onMove = (page, slot, targetPage, targetSlot) => network.moveShortCut(page, slot, targetPage, targetSlot);
        this.shortCutWnd.onDelete = (page, slot) => network.deleteShortCut(page, slot);
        this.shortCutWnd.onDrop = (page, slot, x, y) => this.macroWnd.dropCommand(`/${this.getStrings().commands[27]} ${page + 1} ${slot + 1}`, x * this.nwindow.canvas.cssScale, y * this.nwindow.canvas.cssScale);
        this.shortCutWnd.onDragMove = (x, y) => this.macroWnd.highlightCommand(x * this.nwindow.canvas.cssScale, y * this.nwindow.canvas.cssScale);
        this.shortCutWnd.onDrag = entry => {
            document.documentElement.style.cursor = entry ? `url(${this.layer.getWrapUrl(entry.icon)}) 16 16, default` : "";
            document.documentElement.classList.toggle("ndom-item-drag", !!entry);
        };
        this.shortCutWnd.onAutoSoulShot = (page, slot) => network.toggleAutoSoulShot(page, slot);
        this.playerStatusWnd.onClick = event => { if (event.button === 0) network.requestAction(render.player, event.shift); };
        this.chatWnd.onSend = (text, type, target) => network.say(text, type, target);
        this.chatWnd.onBuildCommand = command => network.sendBypassBuildCmd(command);
        this.chatWnd.onCommand = (command, isShift) => network.execCommand(command, isShift);
        this.chatWnd.setSystemMsgWnd(asset.userConfig.game.systemMsgWnd);
        this.isTransparencyMode = asset.userConfig.game.transparencyMode;
        this.isEnterChatting = localStorage.getItem("option:EnterChatting") === "true";

        for (const type of ["keydown", "keyup", "mousedown"])
            window.addEventListener(type, (event: KeyboardEvent | MouseEvent) => {
                this.inputCtrl = event.ctrlKey;
                this.inputShift = event.shiftKey;
                if (type === "mousedown" && (event as MouseEvent).button === 0) network.resetMacros();
                if (type === "keydown" && !event.altKey && this.chatWnd.isInputFocused()) {
                    const key = (event as KeyboardEvent).key;

                    if (!/^F\d+$/.test(key) && !["PageUp", "PageDown", "Insert", "PrintScreen"].includes(key)) network.resetMacros(); // NWindow 0x10076242..0x1007626c, before edit dispatch 0x1007f80d.
                }
            }, true);

        window.addEventListener("keydown", event => { // NConsole 0x1007610a: Escape requests target cancellation before dispatching to the focused window.
            if (event.key !== "Escape" || this.screen !== "world") return;

            event.preventDefault();
            event.stopPropagation();
            network.cancelTarget();
        }, true);
        window.addEventListener("keydown", event => {
            const target = event.target as HTMLElement;

            if (event.key !== "Enter" || this.screen !== "world" || this.chatWnd.isInputFocused() || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

            event.preventDefault();
            this.chatWnd.focusInput();
        });
        window.addEventListener("keydown", event => {
            const target = event.target as HTMLElement;

            if (this.isEnterChatting || this.screen !== "world" || event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;
            if (this.chatWnd.isInputFocused() || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

            event.stopPropagation();
            this.chatWnd.focusInput();
        }, true);
        window.addEventListener("keydown", event => {
            if (this.screen !== "world" || this.windowGroup !== 0 || !event.altKey || event.code !== "KeyG" || !this.statusInfo || !(this.statusInfo.gmLevel > 0 && this.statusInfo.gmLevel < 7)) return;

            event.preventDefault();
            event.stopPropagation();
            this.gmWnd.toggle();
        }, true);
        window.addEventListener("resize", () => this.placeScreens());
        window.addEventListener("dragover", event => this.onSkillDrop(event));
        window.addEventListener("drop", event => this.onSkillDrop(event));
        window.addEventListener("pointerdown", event => this.onSkillPointerDown(event), true);
        window.addEventListener("pointermove", event => this.onSkillPointerMove(event), true);
        window.addEventListener("pointerup", event => this.onSkillPointerUp(event), true);
        window.addEventListener("pointercancel", event => this.onSkillPointerCancel(event), true);
        window.addEventListener("blur", () => this.endSkillPointerDrag());
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
        if (this.mainWnd) void this.mainWnd.questWnd.setStrings(strings);
        if (this.mainWnd) this.mainWnd.clanWnd.setStrings(strings);
        if (this.gmClanWnd) this.gmClanWnd.setStrings(strings);
        if (this.petWnd) void this.petWnd.setActions(strings);
        if (this.summonedWnd) void this.summonedWnd.setActions(strings);
        this.nwindow.invalidate();
    }

    public getStrings() { return this.strings; }
    public setPetInfo(info: GamePackets.PetStatus_T) { this.petWnd.setInfo(info); this.summonedWnd.setInfo(info); this.petStatusWnd.setInfo(info); this.summonedStatusWnd.setInfo(info); }

    public showPetStatus(statusType: number) {
        if (this.screen !== "world" && this.screen !== "loading") return;

        this.prepareWorld();
        (statusType === 1 ? this.summonedStatusWnd : this.petStatusWnd).showStatus();
    }

    public setPetStatusEffects(spelled: GamePackets.PartySpelled_T) {
        if (spelled.type === GamePackets.PartySpelledType_T.PET) this.petStatusWnd.setEffects(spelled.effects);
        else if (spelled.type === GamePackets.PartySpelledType_T.SUMMON) this.summonedStatusWnd.setEffects(spelled.effects);
    }

    public setSummonRemainTime(maximum: number, remaining: number) { this.summonedStatusWnd.setRemainTime(maximum, remaining); }
    public setPetRenameAvailable(available: boolean) { this.petWnd.setRenameAvailable(available); }
    public showPet(statusType = 2) {
        const wnd = statusType === 1 ? this.summonedWnd : this.petWnd;

        wnd.setVisible(true);
        this.nwindow.playWindowSound();
        wnd.element.focus();
    }
    public hidePet() { this.petWnd.setVisible(false); this.summonedWnd.setVisible(false); this.petStatusWnd.setVisible(false); this.summonedStatusWnd.setVisible(false); this.summonedStatusWnd.resetGauge(); this.nwindow.playWindowCloseSound(); }
    public getInputModifiers() { return [this.inputCtrl, this.inputShift]; }
    public sendMacroText(text: string) { this.chatWnd.sendText(text, this.inputShift); }

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

        if (!button || !this.mainWnd.element.contains(button) && !this.petWnd.element.contains(button) && !this.summonedWnd.element.contains(button) || button.getAttribute("aria-disabled") === "true") return;

        const skillId = button.dataset.skillId, actionId = button.dataset.actionId;
        this.skillPointerDrag = { type: skillId ? "skill" : "action", id: Number(skillId || actionId), pointerId: event.pointerId, icon: button.dataset.icon, button, isDragging: false };
    }

    protected onSkillPointerMove(event: PointerEvent) {
        const drag = this.skillPointerDrag;

        if (!drag || drag.pointerId !== event.pointerId) return;
        if (!(event.buttons & 1) || !drag.button.getClientRects().length) {
            this.endSkillPointerDrag();
            return;
        }
        if (!drag.isDragging) {
            drag.isDragging = true;
            document.documentElement.style.cursor = `url(${this.layer.getWrapUrl(drag.icon)}) 16 16, default`;
            document.documentElement.classList.add("ndom-item-drag");
        }

        this.macroWnd.highlightCommand(event.clientX, event.clientY);

        event.preventDefault();
    }

    protected onSkillPointerUp(event: PointerEvent) {
        const drag = this.skillPointerDrag;

        if (!drag || drag.pointerId !== event.pointerId || event.button !== 0) return;

        this.endSkillPointerDrag();
        if (!drag.button.getClientRects().length) return;
        if (drag.type === "skill" ? this.macroWnd.dropCommand(this.skillWnd.getMacroCommand(drag.id), event.clientX, event.clientY) : this.macroWnd.dropAction(drag.id, event.clientX, event.clientY)) {
            event.preventDefault();
            return;
        }
        if (event.target instanceof Element && event.target.closest(".ndom-layer")) return;

        event.preventDefault();
        this.registerSkillDrop(drag.type, drag.id, this.nwindow.canvas.toUI(event.clientX), this.nwindow.canvas.toUI(event.clientY));
    }

    protected onSkillPointerCancel(event: PointerEvent) {
        if (this.skillPointerDrag?.pointerId === event.pointerId) this.endSkillPointerDrag();
    }

    protected endSkillPointerDrag() {
        if (!this.skillPointerDrag) return;

        if (this.skillPointerDrag.type === "skill") this.skillWnd.clearSelection();
        else if (this.mainWnd.element.contains(this.skillPointerDrag.button)) this.mainWnd.actionWnd.clearSelection();
        this.skillPointerDrag = null;
        document.documentElement.style.cursor = "";
        document.documentElement.classList.remove("ndom-item-drag");
    }

    protected registerSkillDrop(type: "skill" | "action" | "item" | "petItem" | "macro" | "recipe", id: number, x: number, y: number) {
        if (this.screen !== "world") return false;

        let target = this.nwindow.findWindow(x, y);
        while (target && target !== this.shortCutWnd) target = target.parent;
        if (target !== this.shortCutWnd) return false;

        const slot = this.shortCutWnd.getSlotAt(x - this.shortCutWnd.getScreenX(), y - this.shortCutWnd.getScreenY());

        if (slot < 0) return false;

        if (type === "skill") this.manNetwork.registerSkillShortCut(id, this.shortCutWnd.getPage(), slot);
        else if (type === "action") this.manNetwork.registerActionShortCut(id, this.shortCutWnd.getPage(), slot);
        else if (type === "recipe") this.manNetwork.registerRecipeShortCut(id, this.shortCutWnd.getPage(), slot);
        else if (type === "macro") this.manNetwork.registerMacroShortCut(id, this.shortCutWnd.getPage(), slot);
        else if (type === "petItem") this.manNetwork.registerPetItemShortCut(id, this.shortCutWnd.getPage(), slot);
        else this.manNetwork.registerItemShortCut(id, this.shortCutWnd.getPage(), slot); // 0x1007a1e0(1, page * 12 + slot, objectId, 1)

        return true;
    }

    public async createScreens() {
        if (this.loginWnd) return;

        await this.layer.loadTextures([...NCLoginWnd.getTextures(), ...NCLoginServerWnd.getTextures(), ...NCLobbyWnd.getTextures(), ...NCPawnCreateWnd.getTextures(), ...NCLoadingWnd.getTextures(), ...NCNPCHtmlViewer.getTextures(), ...NCCommunityWnd.getTextures(), "L2UI_ch3.NpcWnd.Npc2_back", ...NCInventoryWnd.getTextures(), ...NCPetWnd.getTextures(), ...NCSummonedWnd.getTextures(), ...NCPledgePowerWnd.getTextures(), ...NCTradeWnd.getTextures(), ...NCShopWnd.getTextures(), ...NCRecipeBookWnd.getTextures(), ...NCRecipeManufactureWnd.getTextures(), ...NCRecipeTreeWnd.getTextures(), ...NCRecipeShopWnd.getTextures(), ...NCRecipeBuyListWnd.getTextures(), ...NCHennaListWnd.getTextures(), ...NCHennaInfoWnd.getTextures(), ...NCMatchWnd.getTextures(), ...NCPartyRoomMakingWnd.getTextures(), ...NCPartyRoomWnd.getTextures(), ...NCTrainWnd.getTextures(), ...NCHeroTowerWnd.getTextures(), ...NCFishViewportWnd.getTextures(), ...NCCommandInfoWnd.getTextures(), ...NCGMQuestWnd.getTextures(), ...NCGMDetailStatusWnd.getTextures(), ...NCGMClanWnd.getTextures(), ...NCGMWnd.getTextures(), ...NCOlympiadControlWnd.getTextures(), ...NCPrivateBuyWnd.getTextures(), ...NCVIPShopWnd.getTextures(), ...NCSelectDeliverWnd.getTextures(), ...NCMenuWnd.getTextures(), ...NCMainWnd.getTextures(), ...NCMapWnd.getTextures(), ...NCSystemMenuWnd.getTextures(), ...NCMacroWnd.getTextures(), ...NCMessageWnd.getTextures(), ...NCDialogBox.getTextures(), ...NDOM_EDIT_TEXTURES]);

        const network = this.manNetwork;

        this.loginWnd = new NCLoginWnd(this.layer);
        this.loginWnd.onLogin = (account, password) => void network.connectLogin(account, password);
        this.loginWnd.auth.onError = text => this.showMessage(text);

        this.loginServerWnd = new NCLoginServerWnd(this.layer);
        this.loginServerWnd.onSelect = serverId => void network.connectGame(serverId);
        this.loginServerWnd.onCancel = () => network.cancelLogin();
        this.loginServerWnd.serverInfo.viewer.onLink = path => void this.showServerHelp(path.split("\\").pop());
        this.loginServerWnd.serverInfo.viewer.onFile = path => void this.showServerHelp(path.split("\\").pop());
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
        this.yesNoDialogBox = new NCDialogBox(this.layer);
        this.npcHtmlViewer = new NCNPCHtmlViewer(this.layer);
        this.npcHtmlViewer.onBypass = command => network.bypass(command);
        this.npcHtmlViewer.onLink = path => network.link(path);
        this.npcHtmlViewer.onFile = path => { void this.loadHtmlFile(this.npcHtmlViewer, path); };
        this.npcItemHtmlViewer = new NCNPCHtmlViewer(this.layer);
        this.npcItemHtmlViewer.onBypass = command => network.bypass(command);
        this.npcItemHtmlViewer.onLink = path => network.link(path);
        this.npcItemHtmlViewer.onFile = path => { void this.loadHtmlFile(this.npcItemHtmlViewer, path); };
        this.communityWnd = new NCCommunityWnd(this.layer);
        this.communityWnd.onRequest = () => network.showBoard();
        this.communityWnd.onAction = target => this.communityWnd.viewer.dispatchCommand(target);
        this.communityWnd.viewer.onBypass = command => network.bypass(command);
        this.communityWnd.viewer.onWrite = (kind, arg1, arg2, arg3, arg4, arg5) => network.writeBoard(kind, arg1, arg2, arg3, arg4, arg5);
        this.communityWnd.viewer.onVariableError = id => this.clanError(id);
        this.communityWnd.viewer.isInvalidVariableName = value => !this.nwindow.canvas.hasGlyphs(value);
        this.communityWnd.viewer.onLink = path => network.link(path);
        this.communityWnd.viewer.onFile = async path => {
            const html = await this.manNetwork.getParent().getComponent("asset").getL2Text(path.replace(/^\.\.[\\/]L2text[\\/]/i, ""));

            if (this.screen === "world" && this.communityWnd.isVisible()) await this.communityWnd.viewer.setHtml(html);
        };
        this.helpWnd = new NCNPCHtmlViewer(this.layer, 311, 145, "L2UI_ch3.NpcWnd.Npc2_back");
        this.helpWnd.onLink = path => network.link(path);
        this.helpWnd.onFile = path => { void this.loadHtmlFile(this.helpWnd, path); };
        this.inventoryWnd = new NCInventoryWnd(this.layer);
        this.petWnd = new NCPetWnd(this.layer, this.inventoryWnd);
        this.summonedWnd = new NCSummonedWnd(this.layer, this.inventoryWnd);
        this.summonedWnd.onAction = (id, ctrl, shift) => network.useAction(id, ctrl, shift);
        this.petWnd.onUseItem = objectId => network.usePetItem(objectId);
        this.petWnd.onAction = (id, ctrl, shift) => network.useAction(id, ctrl, shift);
        this.petWnd.onGetItem = item => this.transferPetItem(item, false);
        this.petWnd.onRename = () => this.renamePet();
        this.petWnd.onHideBag = owner => {
            for (const dialog of [this.dialogBox, this.yesNoDialogBox])
                if (dialog.owner === owner || dialog.owner === this.petWnd.element && !this.petWnd.isVisible()) dialog.hide();
        };
        this.petWnd.onDropItem = (objectId, clientX, clientY) => this.registerSkillDrop("petItem", objectId, this.nwindow.canvas.toUI(clientX), this.nwindow.canvas.toUI(clientY));
        this.inventoryWnd.onUse = (item, isRight) => this.useInventoryItem(item, isRight);
        this.inventoryWnd.onDestroy = item => this.destroyInventoryItem(item);
        this.inventoryWnd.onCrystallize = item => this.crystallizeInventoryItem(item);
        this.inventoryWnd.onHideBag = owner => {
            for (const dialog of [this.dialogBox, this.yesNoDialogBox])
                if (dialog.owner === owner) dialog.hide();
        };
        this.inventoryWnd.onUnequip = item => this.unequipInventoryItem(item);
        this.inventoryWnd.onEquip = objectId => network.useItem(objectId);
        this.inventoryWnd.onChoose = objectId => network.chooseInventoryItem(objectId);
        this.inventoryWnd.onDropItem = (objectId, clientX, clientY, item) => {
            const target = document.elementFromPoint(clientX, clientY);

            if (target && this.petWnd.element.contains(target) && item.slot < 0) {
                this.transferPetItem(item, true);
                return false;
            }
            if (target && target.closest(".ndom-window")) return false;

            const x = this.nwindow.canvas.toUI(clientX), y = this.nwindow.canvas.toUI(clientY);

            if (this.registerSkillDrop("item", objectId, x, y)) return true;
            if (this.screen !== "world" || this.nwindow.findWindow(x, y) || !network.getParent().getComponent("input").traceScreenPoint(clientX, clientY, tmpDropPoint)) return false;

            this.dropInventoryItem(item, tmpDropPoint);
            return true;
        };
        this.recipeBookWnd = new NCRecipeBookWnd(this.layer);
        this.recipeBookWnd.onOpen = id => network.requestRecipeItemMakeInfo(id);
        this.recipeBookWnd.onDelete = recipe => {
            this.dialogBox.show(this.formatSystemMessage(74, this.strings.itemNames[recipe.itemId]), DialogType_T.OK_CANCEL, accepted => { if (accepted) network.destroyRecipe(recipe.id); });
            this.dialogBox.owner = this.recipeBookWnd.element;
        };
        this.recipeBookWnd.onDrop = (id, x, y) => {
            const target = document.elementFromPoint(x, y);

            if (target && target.closest(".ndom-window")) return;
            this.registerSkillDrop("recipe", id, this.nwindow.canvas.toUI(x), this.nwindow.canvas.toUI(y));
        };
        this.recipeBookWnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
        this.recipeBookWnd.onTooltip = (recipe, button, isDetailed) => this.inventoryWnd.showTooltip({ objectId: recipe.id, itemId: recipe.itemId, name: this.strings.itemNames[recipe.itemId], icon: this.strings.itemIcons[recipe.productId], count: 0, enchant: 0, customType1: 0, customType2: 0, itemClass: -1, bodyPart: 0, info: this.strings.itemInfos[recipe.itemId], slot: -1, isQuest: false, isMoney: false }, button, isDetailed);
        this.recipeManufactureWnd = new NCRecipeManufactureWnd(this.layer);
        this.recipeManufactureWnd.onCreate = id => network.makeRecipeItem(id);
        this.recipeManufactureWnd.onBack = isDwarven => network.openRecipeBook(isDwarven);
        this.recipeTreeWnd = new NCRecipeTreeWnd(this.layer);
        this.recipeManufactureWnd.onTree = recipe => {
            if (this.recipeTreeWnd.isVisible()) this.recipeTreeWnd.setVisible(false);
            else void this.recipeTreeWnd.show(recipe, this.inventory);
        };
        this.recipeManufactureWnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
        this.recipeManufactureWnd.onTooltip = (material, button) => this.inventoryWnd.showTooltip({ objectId: material.itemId, itemId: material.itemId, name: this.strings.itemNames[material.itemId], icon: this.strings.itemIcons[material.itemId], count: material.count, maxCount: material.required, enchant: 0, customType1: 0, customType2: 0, itemClass: -1, bodyPart: 0, info: this.strings.itemInfos[material.itemId], slot: -1, isQuest: false, isMoney: false }, button, true, 0x40);
        this.recipeShopWnd = new NCRecipeShopWnd(this.layer);
        this.recipeShopWnd.onStart = entries => network.setRecipeShopList(entries);
        this.recipeShopWnd.onQuit = () => network.quitRecipeShopManage();
        this.recipeShopWnd.onCancel = () => network.cancelRecipeShopManage();
        this.recipeShopWnd.onMessage = () => {
            this.dialogBox.showText(this.nwindow.getSystemMessage(334), message => {
                if (message) network.setRecipeShopMessage(message);
                return true;
            }, network.getOwnRecipeShopMessage(), 294);
        };
        this.recipeShopWnd.onPrice = row => {
            this.dialogBox.showQuantity(this.formatSystemMessage(963, this.strings.itemNames[row.recipe.itemId]), 0, this.strings.itemInfos[row.recipe.itemId].consumeType, (price, value) => {
                if (value) this.recipeShopWnd.transfer(row, price);
            }, id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null), true);
            this.dialogBox.owner = this.recipeShopWnd.getGrid(0);
        };
        this.recipeShopWnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
        this.recipeShopWnd.onTooltip = (row, button, context, isDetailed) => {
            const recipe = row.recipe;

            this.inventoryWnd.showTooltip({ objectId: recipe.id, itemId: recipe.itemId, name: this.strings.itemNames[recipe.itemId], icon: this.strings.itemIcons[recipe.productId], count: 0, enchant: 0, customType1: 0, customType2: 0, itemClass: -1, bodyPart: 0, info: this.strings.itemInfos[recipe.itemId], slot: -1, isQuest: false, isMoney: false }, button, isDetailed, context, row.price, 1);
        };
        this.recipeBuyListWnd = new NCRecipeBuyListWnd(this.layer);
        this.recipeBuyListWnd.onOpen = (objectId, recipeId) => network.requestRecipeShopMakeInfo(objectId, recipeId);
        this.recipeBuyManufactureWnd = new NCRecipeBuyManufactureWnd(this.layer);
        this.recipeBuyManufactureWnd.onShopCreate = (objectId, recipeId, price) => network.makeRecipeShopItem(objectId, recipeId, price);
        this.recipeBuyManufactureWnd.onShopBack = objectId => network.recipeShopManagePrev(objectId);
        this.recipeBuyManufactureWnd.onTree = this.recipeManufactureWnd.onTree;
        this.recipeBuyManufactureWnd.onTooltip = this.recipeManufactureWnd.onTooltip;
        this.recipeBuyManufactureWnd.onHideTooltip = this.recipeManufactureWnd.onHideTooltip;
        this.hennaListWnd = new NCHennaListWnd(this.layer);
        this.hennaListWnd.onOpen = (symbolId, isRemove) => {
            if (isRemove) network.requestHennaUnequipInfo(symbolId);
            else network.requestHennaItemInfo(symbolId);
        };
        this.hennaInfoWnd = new NCHennaInfoWnd(this.layer);
        this.hennaInfoWnd.onBack = isRemove => {
            if (isRemove) network.requestHennaUnequipList();
            else network.requestHennaList();
        };
        this.hennaInfoWnd.onConfirm = (symbolId, isRemove) => {
            if (isRemove) network.unequipHenna(symbolId);
            else network.equipHenna(symbolId);
        };
        this.matchWnd = new NCMatchWnd(this.layer);
        this.matchWnd.onConfig = (page, location, level) => network.requestPartyMatchConfig(page, location, level);
        this.matchWnd.onJoin = (roomId, location) => network.requestPartyMatchDetail(roomId, location);
        this.matchWnd.onCreate = () => this.partyRoomMakingWnd.showCreate(this.statusInfo.level, this.options.game.partyLooting);
        this.partyRoomMakingWnd = new NCPartyRoomMakingWnd(this.layer);
        this.partyRoomMakingWnd.getLootType = () => this.options.game.partyLooting;
        this.partyRoomMakingWnd.onSubmit = settings => network.requestPartyMatchList(settings.roomId, settings.maxMembers, settings.minLevel, settings.maxLevel, settings.lootType, settings.title);
        this.partyRoomWnd = new NCPartyRoomWnd(this.layer);
        this.partyRoomWnd.onSettings = detail => this.partyRoomMakingWnd.showEdit(detail, this.options.game.partyLooting);
        this.partyRoomWnd.onKick = objectId => network.oustFromPartyRoom(objectId);
        this.partyRoomWnd.onInvite = (name, lootType) => network.inviteToParty(name, lootType);
        this.partyRoomWnd.onTerminate = mode => {
            const detail = network.getPartyMatchDetail();

            if (mode === 1) network.dismissPartyRoom(detail.roomId);
            else network.withdrawPartyRoom(detail.roomId);
        };
        this.partyRoomWnd.onChat = text => { if (!this.chatWnd.dispatchCommand(text, this.inputShift)) network.say(text, GamePackets.Say2_T.PARTYROOM_ALL); };
        this.trainWnd = new NCTrainWnd(this.layer);
        this.trainWnd.onInfo = (id, level) => network.requestEnchantSkillInfo(id, level);
        this.trainWnd.onEnchant = (id, level) => network.enchantSkill(id, level);
        this.trainWnd.onAquireInfo = (id, level, mode) => network.requestAquireSkillInfo(id, level, mode);
        this.trainWnd.onAquire = (id, level, mode) => network.aquireSkill(id, level, mode);
        this.manorShopWnd = new NCManorShopWnd(this.layer);
        this.manorShopWnd.onQuantity = (side, item, allCount) => {
            this.dialogBox.showQuantity(this.formatSystemMessage(72, this.strings.itemNames[item.itemId]), allCount, this.strings.itemInfos[item.itemId].consumeType, count => {
                const current = this.manorShopWnd.getPressedItem(side);

                if (current && count > 0) this.manorShopWnd.transfer(side, current, Math.min(count, current.count));
            }, id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null));
            this.dialogBox.owner = this.manorShopWnd.getGrid(side);
        };
        this.manorShopWnd.onSubmit = (isSell, listId, items) => {
            if (isSell) network.sellCrops(items.map(item => ({ objectId: item.objectId, itemId: item.itemId, count: item.count })), listId);
            else network.buySeeds(items.map(item => ({ itemId: item.itemId, count: item.count })), listId);
        };
        this.shopWnd = new NCShopWnd(this.layer);
        this.privateShopWnd = new NCPrivateShopWnd(this.layer);
        this.privateShopWnd.onQuit = () => network.quitPrivateStoreSell();
        this.privateShopWnd.onClose = () => {
            if (!this.privateShopWnd.isOwnMode()) return;
            network.quitPrivateStoreSell();
            this.privateShopWnd.setVisible(false);
        };
        this.privateShopWnd.onMessage = () => {
            this.dialogBox.showText(this.nwindow.getSystemMessage(334), message => {
                if (message) network.setPrivateStoreMsgSell(message);
                return true;
            }, network.getPrivateStoreMsgSell(), 294);
            this.dialogBox.owner = this.privateShopWnd.getGrid(0);
        };
        this.privateBuyWnd = new NCPrivateBuyWnd(this.layer);
        this.privateBuyWnd.onQuit = () => {
            network.cancelPrivateStoreManageBuy();
            this.privateBuyWnd.setVisible(false);
            this.nwindow.playWindowCloseSound();
        };
        this.privateBuyWnd.onClose = () => {
            if (!this.privateBuyWnd.isOwnMode()) return;
            network.quitPrivateStoreBuy();
            this.privateBuyWnd.setVisible(false);
        };
        this.privateBuyWnd.onMessage = () => {
            this.dialogBox.showText(this.nwindow.getSystemMessage(334), message => {
                if (message) network.setPrivateStoreMsgBuy(message);
                return true;
            }, network.getPrivateStoreMsgBuy(), 294);
            this.dialogBox.owner = this.privateBuyWnd.getGrid(0);
        };
        this.vipShopWnd = new NCVIPShopWnd(this.layer, this.inventoryWnd);
        this.vipShopWnd.onHide = () => network.clearMultiSell();
        this.vipShopWnd.onSelect = () => { if (this.dialogBox.isOpen() && this.dialogBox.owner === this.vipShopWnd.element) this.dialogBox.hide(); };
        this.vipShopWnd.onConfirm = (listId, entryId, amount) => {
            this.dialogBox.show(this.nwindow.getSystemMessage(1383), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.chooseMultiSell(listId, entryId, amount); });
            this.dialogBox.owner = this.vipShopWnd.element;
        };
        this.previewShopWnd = new NCShopWnd(this.layer, true);
        this.storeWnd = new NCStoreWnd(this.layer);
        this.gmSkillWnd = new NCGMMagicSkillWnd(this.layer);
        this.gmInventoryWnd = new NCGMInventoryWnd(this.layer);
        this.gmStoreWnd = new NCGMStoreWnd(this.layer);
        this.gmQuestWnd = new NCGMQuestWnd(this.layer);
        this.fishViewportWnd = new NCFishViewportWnd(this.layer, (id, ...params) => this.formatSystemMessage(id, ...params));
        this.manRender.setViewportSceneCanvas(this.fishViewportWnd.getViewportCanvas());
        this.heroTowerWnd = new NCHeroTowerWnd(this.layer);
        this.heroTowerWnd.onWriteWords = words => network.writeHeroWords(words);
        this.heroTowerWnd.onDiary = classId => network.bypass(`_diary?class=${classId}&page=1`);
        this.heroTowerWnd.setCrestGetter((crestId, isAlly) => network.getHeroCrest(crestId, isAlly));
        this.commandInfoWnd = new NCCommandInfoWnd(this.layer);
        this.commandInfoWnd.onUpdate = () => network.userCommand(97);
        this.commandInfoWnd.onLeave = () => network.userCommand(96);
        this.commandInfoWnd.onOust = name => network.oustFromCommandChannel(name);
        this.commandInfoWnd.onSay = (text, type) => network.say(text, type);
        this.gmDetailWnd = new NCGMDetailStatusWnd(this.layer);
        this.gmWnd = new NCGMWnd(this.layer);
        this.gmWnd.onView = (target, kind) => [this.gmDetailWnd, this.gmClanWnd, this.gmSkillWnd, this.gmQuestWnd, this.gmInventoryWnd, this.gmStoreWnd][kind - 1].toggle(target);
        this.gmWnd.onCommand = command => network.sendBypassBuildCmd(command);
        this.gmWnd.onMessage = id => this.addSystemMessage(this.nwindow.getSystemMessage(id), this.strings.systemMessageColors[id]);
        this.gmWnd.onInfo = text => this.dialogBox.show(text, DialogType_T.OK, null);
        this.gmWnd.onConfirm = (id, target, onReply) => this.dialogBox.show(this.formatSystemMessage(id, target), DialogType_T.OK_CANCEL, onReply);
        this.gmWnd.onServerTransfer = id => network.startGMServerTransfer(id);
        this.gmClanWnd = new NCGMClanWnd(this.layer);
        this.gmClanWnd.onAction = (action, member) => this.clanAction(action, member);
        this.olympiadControlWnd = new NCOlympiadControlWnd(this.layer);
        this.olympiadControlWnd.onStopObserving = () => network.endOlympiadObserver();
        this.olympiadControlWnd.onOtherGame = () => network.requestOlympiadMatchList();
        this.gmQuestWnd.onShowQuestList = () => network.requestQuestList();
        for (const wnd of [this.gmSkillWnd, this.gmInventoryWnd, this.gmStoreWnd, this.gmQuestWnd, this.gmDetailWnd, this.gmClanWnd]) wnd.onRequest = (target, kind) => network.gmCommand(target, kind);
        this.gmSkillWnd.skillWnd.onDragMove = event => this.macroWnd.highlightCommand(event.clientX, event.clientY);
        this.gmSkillWnd.skillWnd.onDragEnd = () => this.macroWnd.highlightCommand(-1, -1);
        this.gmStoreWnd.onQuantity = (side, item, maxCount) => {
            this.dialogBox.showQuantity(this.formatSystemMessage(72, this.strings.itemNames[item.itemId]), maxCount, this.strings.itemInfos[item.itemId].consumeType, count => this.gmStoreWnd.transferQuantity(side, count), id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null));
            this.dialogBox.owner = this.gmStoreWnd.getGrid(side);
        };
        this.deliverWnd = new NCDeliverWnd(this.layer);
        this.selectDeliverWnd = new NCSelectDeliverWnd(this.layer);
        this.selectDeliverWnd.onConfirm = objectId => network.requestPackageSendableItemList(objectId);
        for (const wnd of [this.shopWnd, this.previewShopWnd, this.storeWnd, this.deliverWnd, this.privateShopWnd, this.privateBuyWnd, this.manorShopWnd, this.gmStoreWnd]) {
            wnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
            wnd.onTooltip = (item, button, isDetailed, context) => this.inventoryWnd.showTooltip({ maxCount: wnd === this.privateBuyWnd ? this.privateBuyWnd.getMaxCount(item) : 0, objectId: item.objectId, itemId: item.itemId, name: this.strings.itemNames[item.itemId], icon: this.strings.itemIcons[item.itemId], count: wnd === this.privateBuyWnd ? this.privateBuyWnd.getTooltipCount(item) : item.count, enchant: item.enchantLevel, customType1: "customType1" in item ? item.customType1 : 0, customType2: item.customType2, itemClass: item.type2, bodyPart: item.bodyPart, info: this.strings.itemInfos[item.itemId], slot: -1, isQuest: item.type2 === GamePackets.ItemType2_T.TYPE2_QUEST, isMoney: item.type2 === GamePackets.ItemType2_T.TYPE2_MONEY }, button, isDetailed, context, item.price);
            wnd.onSelect = () => { if (this.dialogBox.isOpen() && !this.dialogBox.isYesNo()) this.dialogBox.hide(); };
            wnd.onHide = () => { if (this.dialogBox.owner === wnd.element || this.dialogBox.owner === wnd.getGrid(0) || this.dialogBox.owner === wnd.getGrid(1)) this.dialogBox.hide(); };
            if (wnd === this.manorShopWnd || wnd === this.gmStoreWnd) continue;
            wnd.onMove = (side, item, isPointer, isDrag) => {
                if (wnd === this.privateBuyWnd && this.privateBuyWnd.isOwnMode()) {
                    const quantity = () => {
                        const selected = wnd.getPressedItem(side);

                        if (!selected) return;
                        const consumeType = this.strings.itemInfos[selected.itemId].consumeType;
                        const isStackable = consumeType >= 1 && consumeType <= 3;
                        const needsQuantity = side === 0 || isStackable && (isDrag ? this.privateBuyWnd.getOwnedCount(selected) > 1 : isPointer || selected.count > 1);

                        if (!needsQuantity) { wnd.transfer(side, selected, 1); return; }
                        const messageId = side === 0 ? 570 : 571;
                        const allCount = side === 0 ? this.privateBuyWnd.getOwnedCount(selected) : selected.count | 0;

                        this.dialogBox.showQuantity(this.formatSystemMessage(messageId, this.strings.itemNames[selected.itemId]), allCount, consumeType, count => {
                            const current = wnd.getPressedItem(side);

                            if (current && count > 0) wnd.transfer(side, current, Math.min(count, 100000000));
                        }, id => { this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null); network.playSystemMessageSound(id); });
                        this.dialogBox.owner = wnd.getGrid(side);
                    };

                    if (side === 1) { quantity(); return; }
                    this.dialogBox.showQuantity(this.nwindow.getSystemMessage(585), 0, this.strings.itemInfos[item.itemId].consumeType, price => {
                        const selected = wnd.getPressedItem(0);

                        if (!selected || price <= 0) return;
                        selected.price = price;
                        const reference = (selected as GamePackets.ShopItem_T & { referencePrice: number }).referencePrice;

                        if (reference > 0 && (price <= Math.trunc(reference / 5) || price >= (reference * 5 | 0))) {
                            this.dialogBox.show(this.nwindow.getSystemMessage(569), DialogType_T.OK_CANCEL, isOk => { if (isOk) quantity(); });
                            this.dialogBox.owner = wnd.getGrid(0);
                        } else quantity();
                    }, id => { this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null); network.playSystemMessageSound(id); }, true);
                    this.dialogBox.owner = wnd.getGrid(0);
                    return;
                }
                if (wnd === this.privateShopWnd && this.privateShopWnd.isOwnMode()) {
                    const quantity = () => {
                        const selected = wnd.getPressedItem(side);

                        if (!selected) return;
                        const consumeType = this.strings.itemInfos[selected.itemId].consumeType;
                        const needsQuantity = consumeType >= 1 && consumeType <= 3 && (side === 1 && isDrag ? this.privateShopWnd.getOriginalCount(selected) > 1 : selected.count > 1);

                        if (!needsQuantity) { wnd.transfer(side, selected, 1); return; }
                        this.dialogBox.showQuantity(this.formatSystemMessage(72, this.strings.itemNames[selected.itemId]), selected.count, consumeType, count => {
                            const current = wnd.getPressedItem(side);

                            if (!current || count <= 0) return;
                            if (count > current.count) {
                                this.addSystemMessage(this.nwindow.getSystemMessage(1036), this.strings.systemMessageColors[1036]);
                                network.playSystemMessageSound(1036);
                                return;
                            }
                            wnd.transfer(side, current, count);
                        }, id => { this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null); network.playSystemMessageSound(id); }, true);
                        this.dialogBox.owner = wnd.getGrid(side);
                    };

                    if (side === 1) { quantity(); return; }
                    this.dialogBox.showQuantity(this.formatSystemMessage(322, this.strings.itemNames[item.itemId]), 0, this.strings.itemInfos[item.itemId].consumeType, price => {
                        const selected = wnd.getPressedItem(0);

                        if (!selected || price <= 0) return;
                        selected.price = price;
                        const reference = (selected as GamePackets.ShopItem_T & { referencePrice: number }).referencePrice;

                        if (reference > 0 && (price <= Math.trunc(reference / 5) || price >= (reference * 5 | 0))) {
                            this.dialogBox.show(this.nwindow.getSystemMessage(569), DialogType_T.OK_CANCEL, isOk => { if (isOk) quantity(); });
                            this.dialogBox.owner = wnd.getGrid(0);
                        } else quantity();
                    }, id => { this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null); network.playSystemMessageSound(id); }, true);
                    this.dialogBox.owner = wnd.getGrid(0);
                    return;
                }
                if (wnd === this.privateBuyWnd && !this.privateBuyWnd.canMove(item)) return;
                if (wnd === this.privateShopWnd && this.privateShopWnd.isPackageMode()) { wnd.transfer(side, item, 1); return; }
                const consumeType = this.strings.itemInfos[item.itemId].consumeType;
                const isStackable = consumeType >= 1 && consumeType <= 3;
                const needsQuantity = isStackable && (wnd === this.privateShopWnd || wnd === this.privateBuyWnd ? isPointer || side === 0 || item.count > 1 : side === 0 && !wnd.isSellMode() && !wnd.isStoreMode() || item.count > 1);

                if (!needsQuantity) { wnd.transfer(side, item, 1); return; }

                this.dialogBox.showQuantity(this.formatSystemMessage(72, this.strings.itemNames[item.itemId]), item.count, consumeType, count => {
                    const selected = wnd.getPressedItem(side);

                    if (selected && (wnd === this.privateShopWnd && count > selected.count || wnd === this.privateBuyWnd && count > this.privateBuyWnd.getMaxCount(selected))) {
                        this.addSystemMessage(this.nwindow.getSystemMessage(1036), this.strings.systemMessageColors[1036]);
                        network.playSystemMessageSound(1036);
                        return;
                    }
                    if (selected) wnd.transfer(side, selected, count);
                }, id => { this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null); network.playSystemMessageSound(id); });
                this.dialogBox.owner = wnd.isStoreMode() ? wnd.getGrid(side) : wnd.element;
            };
            wnd.onConfirm = (isSell, items) => {
                if (wnd === this.privateBuyWnd) {
                    if (this.privateBuyWnd.isOwnMode()) {
                        network.setPrivateStoreListBuy(items.filter(item => item.count > 0).map(item => ({ itemId: item.itemId, enchantLevel: item.enchantLevel, type2: item.type2, count: item.count, price: item.price })));
                        wnd.setVisible(false);
                        return;
                    }
                    const send = () => {
                        network.sellToPrivateStore(this.privateBuyWnd.getOwnerId(), wnd.getItems(1).filter(item => item.count > 0).map(item => ({ objectId: item.objectId, itemId: item.itemId, enchantLevel: item.enchantLevel, type2: item.type2, count: item.count, price: item.price })));
                        wnd.setVisible(false);
                    };

                    if (!this.privateBuyWnd.needsPriceConfirmation()) { send(); return; }

                    this.dialogBox.show(this.nwindow.getSystemMessage(569), DialogType_T.OK_CANCEL, isOk => { if (isOk) send(); });
                    this.dialogBox.owner = wnd.element;
                    return;
                }
                if (wnd === this.privateShopWnd) {
                    if (this.privateShopWnd.isOwnMode()) {
                        network.setPrivateStoreListSell(this.privateShopWnd.getPackageChecked(), items.filter(item => item.count > 0).map(item => ({ objectId: item.objectId, count: item.count, price: item.price })));
                        wnd.setVisible(false);
                        return;
                    }
                    const send = () => {
                        network.buyFromPrivateStore(this.privateShopWnd.getOwnerId(), wnd.getItems(1).filter(item => item.count > 0).map(item => ({ objectId: item.objectId, count: item.count, price: item.price })));
                        wnd.setVisible(false);
                    };

                    if (!this.privateShopWnd.needsPriceConfirmation()) { send(); return; }

                    this.dialogBox.show(this.nwindow.getSystemMessage(569), DialogType_T.OK_CANCEL, isOk => { if (isOk) send(); else wnd.setVisible(false); });
                    this.dialogBox.owner = wnd.element;
                    return;
                }
                if (wnd === this.deliverWnd) {
                    network.sendPackage(this.deliverWnd.getTargetId(), items.filter(item => item.count > 0).map(item => ({ objectId: item.objectId, count: item.count })));
                    wnd.setVisible(false);
                    return;
                }
                if (wnd.isStoreMode()) {
                    const selected = items.filter(item => item.count > 0).map(item => ({ objectId: item.objectId, count: item.count }));

                    if (isSell) network.withdrawWarehouse(selected);
                    else network.depositWarehouse(selected);
                    wnd.setVisible(false);
                    return;
                }
                if (wnd.isPreviewMode()) {
                    if (!items.length) return;

                    this.dialogBox.show(this.nwindow.getSystemMessage(1157), DialogType_T.OK_CANCEL, isOk => {
                        if (!isOk) return;

                        const selected = wnd.getItems(1).filter(item => item.count > 0);

                        if (!selected.length) return;

                        network.requestPreviewItems(selected.map(item => item.itemId));
                        wnd.setVisible(false);
                    });
                    this.dialogBox.owner = wnd.element;
                    return;
                }
                if (!isSell && wnd.getItems(0).some(stock => stock.count > 0 && items.filter(item => item.itemId === stock.itemId).reduce((sum, item) => sum + item.count, 0) > stock.count)) {
                    this.dialogBox.show(this.nwindow.getSystemMessage(1338), DialogType_T.OK, null);
                    this.dialogBox.owner = wnd.element;
                    return;
                }
                if (isSell) network.sellItems(items.filter(item => item.count > 0).map(item => ({ objectId: item.objectId, itemId: item.itemId, count: item.count })));
                else network.buyItems(items.filter(item => item.count > 0).map(item => ({ itemId: item.itemId, count: item.count })));
                wnd.setVisible(false);
            };
        }
        this.tradeWnd = new NCTradeWnd(this.layer);
        this.tradeWnd.onConfirm = isConfirmed => network.confirmTrade(isConfirmed);
        this.tradeWnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
        this.tradeWnd.onTooltip = (item, button, isDetailed) => {
            this.inventoryWnd.showTooltip({ objectId: item.objectId, itemId: item.itemId, name: this.strings.itemNames[item.itemId], icon: this.strings.itemIcons[item.itemId], count: item.count, enchant: item.enchantLevel, customType1: "customType1" in item ? item.customType1 : 0, customType2: item.customType2, itemClass: item.type2, bodyPart: item.bodyPart, info: this.strings.itemInfos[item.itemId], slot: -1, isQuest: item.type2 === GamePackets.ItemType2_T.TYPE2_QUEST, isMoney: item.type2 === GamePackets.ItemType2_T.TYPE2_MONEY }, button, isDetailed);
        };
        this.tradeWnd.onSelect = () => { if (this.dialogBox.isOpen() && !this.dialogBox.isYesNo()) this.dialogBox.hide(); };
        this.tradeWnd.onOffer = (item, isDrop) => {
            if (!network.canAddTradeItem(item.objectId)) return;

            const consumeType = this.strings.itemInfos[item.itemId].consumeType;

            if (consumeType >= 1 && consumeType <= 3 && item.count > 1) {
                this.dialogBox.showQuantity(this.formatSystemMessage(72, this.strings.itemNames[item.itemId]), item.initialCount, consumeType, count => {
                    const pressed = this.tradeWnd.getPressedItem();

                    if (!pressed || count === 0) return;

                    if (count > pressed.count) {
                        this.addSystemMessage(this.nwindow.getSystemMessage(1036), this.strings.systemMessageColors[1036]);
                        network.playSystemMessageSound(1036);
                        return;
                    }

                    network.addTradeItem(pressed.objectId, count);
                    this.tradeWnd.clearSelection();
                }, id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null));
                return;
            }

            network.addTradeItem(item.objectId, 1);
            if (isDrop) this.tradeWnd.clearSelection();
        };
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
        this.pledgePowerWnd = new NCPledgePowerWnd(this.layer);
        this.pledgePowerWnd.onSave = (objectId, power) => network.setMemberPledgePower(objectId, power);
        this.mainWnd.questWnd.onShow = () => network.requestQuestList();
        this.mainWnd.clanWnd.onAction = (action, member) => this.clanAction(action, member);
        this.mainWnd.questWnd.onAbort = id => this.showQuestAbort(id);
        this.mainWnd.questWnd.onHide = () => {
            if (this.dialogBox.owner === this.mainWnd.questWnd.element) this.dialogBox.hide();
        };
        this.mainWnd.onSelect = tab => { if (tab === "skills") network.requestSkillList(); };
        this.skillWnd = this.mainWnd.skillWnd;
        this.skillWnd.onUse = (id, ctrl, shift) => network.useSkill(id, ctrl, shift);
        this.mainWnd.actionWnd.onUse = (id, ctrl, shift) => network.useAction(id, ctrl, shift);
        void this.mainWnd.actionWnd.setActions(this.strings);
        void this.mainWnd.questWnd.setStrings(this.strings);
        void this.petWnd.setActions(this.strings);
        void this.summonedWnd.setActions(this.strings);
        this.mapWnd = new NCMapWnd(this.layer);
        this.mainWnd.questWnd.onLocationChange = location => this.mapWnd.setQuestLocation(location);
        this.macroWnd = new NCMacroWnd(this.layer);
        this.macroWnd.onSave = macro => network.makeMacro(macro);
        this.macroWnd.onUse = id => network.activateMacro(id);
        this.macroWnd.onDelete = macro => this.dialogBox.show(this.formatSystemMessage(828, macro.name), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.deleteMacro(macro.id); });
        this.macroWnd.onError = id => { this.addSystemMessage(this.nwindow.getSystemMessage(id), this.strings.systemMessageColors[id]); network.playSystemMessageSound(id); };
        this.macroWnd.onHelp = () => { this.helpWnd.setVisible(!this.helpWnd.isVisible()); if (this.helpWnd.isVisible()) void this.loadHtmlFile(this.helpWnd, "help_macro.htm"); };
        this.macroWnd.onDrop = (id, x, y) => this.registerSkillDrop("macro", id, this.nwindow.canvas.toUI(x), this.nwindow.canvas.toUI(y));
        this.systemMenuWnd = new NCSystemMenuWnd(this.layer);
        this.systemMenuWnd.onSelect = item => {
            switch (item) {
                case "community": this.communityWnd.toggle(); break;
                case "macro": this.macroWnd.setVisible(!this.macroWnd.isVisible()); break;
                case "help": void this.toggleHelp(); break;
                case "restart": this.dialogBox.show(this.nwindow.getSystemMessage(126), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.requestRestart(); }); break;
                case "exit": this.dialogBox.show(this.nwindow.getSystemMessage(125), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.logout(); }); break;
            }
        };

        this.placeScreens();
        this.show(null);
    }

    protected getDOMWindows() { return [this.loginWnd, this.loginServerWnd, this.lobbyWnd, this.pawnCreateWnd, this.loadingWnd, this.npcHtmlViewer, this.npcItemHtmlViewer, this.communityWnd, this.helpWnd, this.inventoryWnd, this.tradeWnd, this.shopWnd, this.manorShopWnd, this.recipeBookWnd, this.recipeManufactureWnd, this.recipeTreeWnd, this.recipeShopWnd, this.recipeBuyListWnd, this.recipeBuyManufactureWnd, this.hennaListWnd, this.hennaInfoWnd, this.matchWnd, this.partyRoomMakingWnd, this.partyRoomWnd, this.heroTowerWnd, this.fishViewportWnd, this.commandInfoWnd, this.trainWnd, this.gmSkillWnd, this.gmInventoryWnd, this.gmStoreWnd, this.gmQuestWnd, this.gmDetailWnd, this.gmClanWnd, this.gmWnd, this.olympiadControlWnd, this.previewShopWnd, this.storeWnd, this.deliverWnd, this.privateShopWnd, this.privateBuyWnd, this.vipShopWnd, this.selectDeliverWnd, this.menuWnd, this.mainWnd, this.mapWnd, this.macroWnd, this.systemMenuWnd, this.messageWnd, this.dialogBox, this.yesNoDialogBox]; }

    protected getSavedWindows(): [string, HTMLElement][] { return [["InventoryWnd", this.inventoryWnd.element], ["MainWnd", this.mainWnd.element], ["MenuWnd", this.menuWnd.element], ["SystemMenuWnd", this.systemMenuWnd.element], ["MapWnd", this.mapWnd.element], ["MacroWnd", this.macroWnd.element], ["CommunityWnd", this.communityWnd.element], ["PetWnd", this.petWnd.element], ["SummonedWnd", this.summonedWnd.element], ["PledgePowerWnd", this.pledgePowerWnd.element], ["NPCHtmlViewer", this.npcHtmlViewer.element], ["NPCItemHtmlViewer", this.npcItemHtmlViewer.element], ["HelpHtmlViewer", this.helpWnd.element], ["TradeWnd", this.tradeWnd.element], ["ShopWnd", this.shopWnd.element], ["PreviewShopWnd", this.previewShopWnd.element], ["ManorShopWnd", this.manorShopWnd.element], ["StoreWnd", this.storeWnd.element], ["DeliverWnd", this.deliverWnd.element], ["SelectDeliverWnd", this.selectDeliverWnd.element], ["PrivateShopWnd", this.privateShopWnd.element], ["PrivateBuyWnd", this.privateBuyWnd.element], ["VIPShopWnd", this.vipShopWnd.element], ["RecipeBookWnd", this.recipeBookWnd.element], ["RecipeManufactureWnd", this.recipeManufactureWnd.element], ["RecipeBuyManufactureWnd", this.recipeBuyManufactureWnd.element], ["RecipeTreeWnd", this.recipeTreeWnd.element], ["RecipeShopWnd", this.recipeShopWnd.element], ["RecipeBuyListWnd", this.recipeBuyListWnd.element], ["HennaListWnd", this.hennaListWnd.element], ["HennaInfoWnd", this.hennaInfoWnd.element], ["MatchWnd", this.matchWnd.element], ["PartyRoomWnd", this.partyRoomWnd.element], ["HeroTowerWnd", this.heroTowerWnd.element], ["TrainWnd", this.trainWnd.element], ["FishViewportWnd", this.fishViewportWnd.element], ["CommandInfoWnd", this.commandInfoWnd.element], ["OlympiadControlWnd", this.olympiadControlWnd.element], ["GMWnd", this.gmWnd.element], ["GMMagicSkillWnd", this.gmSkillWnd.element], ["GMInventoryWnd", this.gmInventoryWnd.element], ["GMStoreWnd", this.gmStoreWnd.element], ["GMQuestWnd", this.gmQuestWnd.element], ["GMDetailStatusWnd", this.gmDetailWnd.element], ["GMClanWnd", this.gmClanWnd.element]]; }

    protected placeScreens() {
        if (!this.loginWnd) return;

        const width = this.nwindow.canvas.width, height = this.nwindow.canvas.height;

        for (const wnd of this.getDOMWindows()) wnd.placeOnScreen(width, height);
        for (const [name, element] of this.getSavedWindows()) this.layer.restoreWindow(element, name);
        this.manRender.radar.uiScale = this.nwindow.canvas.cssScale;
    }

    protected show(screen: Screen_T) {
        this.screen = screen;
        this.dialogBox.isInGame = this.yesNoDialogBox.isInGame = screen === "world";
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
    public showNotice(messageId: number) { this.dialogBox.show(this.nwindow.getSystemMessage(messageId), DialogType_T.OK, null); }

    public showConfirm(messageId: number, text: string, onAnswer: (isOk: boolean) => void) {
        if (messageId === 0) this.dialogBox.hide();
        else this.dialogBox.show(text, DialogType_T.OK_CANCEL, onAnswer, messageId !== 1510); // NCGaraDialogBox::SetDialog, NWindow RVA 0x8b90: replacement does not decline resurrection.
    }

    public showPartyInvite(name: string, onAnswer: (isAccepted: boolean) => void, itemDistribution = 0) { this.yesNoDialogBox.show(this.formatSystemMessage([572, 573, 967, 968, 969][itemDistribution], name), DialogType_T.YES_NO, onAnswer, true, 10000); }
    public showTradeInvite(name: string, onAnswer: (isAccepted: boolean) => void) { this.yesNoDialogBox.show(this.formatSystemMessage(100, name), DialogType_T.YES_NO, onAnswer, true, 10000); }
    public showAllyInvite(requestor: string, allyName: string, onAnswer: (isAccepted: boolean) => void) { this.yesNoDialogBox.show(this.formatSystemMessage(527, requestor, allyName), DialogType_T.YES_NO, onAnswer, true, 10000); }
    public showPledgeInvite(requestor: string, pledgeName: string, onAnswer: (isAccepted: boolean) => void) { this.yesNoDialogBox.show(this.formatSystemMessage(67, requestor, pledgeName), DialogType_T.YES_NO, onAnswer, true, 10000); }
    public showFriendInvite(name: string, onAnswer: (isAccepted: boolean) => void) { this.yesNoDialogBox.show(this.formatSystemMessage(516, name), DialogType_T.YES_NO, onAnswer, true, 10000); }

    protected formatSystemMessage(id: number, ...params: string[]): string {
        return this.nwindow.getSystemMessage(id).replace(/\$[sc](\d)/g, (match, index) => params[Number(index) - 1] ?? match);
    }

    protected async showServerHelp(name: string) { await this.loginServerWnd.serverInfo.viewer.setHtml(await this.manNetwork.getParent().getComponent("asset").getL2Text(name)); }
    protected async loadHtmlFile(wnd: NCNPCHtmlViewer, path: string) {
        const html = await this.manNetwork.getParent().getComponent("asset").getL2Text(path.replace(/^\.\.[\\/]L2text[\\/]/i, ""));

        if (this.screen === "world" && wnd.isVisible()) await wnd.show(html);
    }
    public async toggleHelp() {
        this.helpWnd.setVisible(!this.helpWnd.isVisible());
        if (this.helpWnd.isVisible()) await this.loadHtmlFile(this.helpWnd, "help.htm");
    }

    public showLogin() {
        this.loginWnd.setBusy(false);
        this.dialogBox.hide();
        this.yesNoDialogBox.hide();
        this.messageWnd.show(this.nwindow.getSystemMessage(94));
        this.show("login");
    }

    public getSystemMessage(id: number) { return this.nwindow.getSystemMessage(id); }

    public setLoginBusy(isBusy: boolean) { this.loginWnd.setBusy(isBusy); }

    public showServers(servers: GameServerInfo_T[], lastServerId: number) {
        this.loginServerWnd.setServers(servers.map(server => ({ id: server.id, name: this.strings.serverNames[server.id] || String(server.id), isUp: server.isUp, currentPlayers: server.currentPlayers, maxPlayers: server.maxPlayers, pvp: server.pvp, isTestServer: server.isTestServer, ping: 9999 })), lastServerId);
        this.messageWnd.show("");
        this.show("servers");
    }

    public showCharacters(characters: GamePackets.CharSelectEntry_T[]) {
        this.characterNames = characters.map(character => character.name);
        this.messageWnd.hide();
        this.lobbyWnd.setCharacters(characters.map(character => ({ name: character.name, level: character.level, className: this.nwindow.getClassName(character.activeClassId), curHp: character.curHp, maxHp: character.maxHp, curMp: character.curMp, maxMp: character.maxMp, sp: character.sp, exp: character.exp, karma: character.karma, deleteSeconds: character.deleteSeconds })));
        this.show("lobby");
    }

    public setSelectedCharacter(index: number) { this.lobbyWnd.setSelected(index); }
    public pickCharacter(index: number) { this.lobbyWnd.pick(index); }
    public setPawnLabels(labels: LobbyPawnLabel_T[]) { this.lobbyWnd.setPawnLabels(labels); }
    public isLobbyVisible() { return this.screen === "lobby"; }
    public getScreenCanvas() { return this.nwindow.canvas; }

    public showCreateCharacter(templates: GamePackets.CharTemplate_T[]) {
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
        this.petStatusWnd.onTargetAction = this.summonedStatusWnd.onTargetAction = (objectId, shift) => this.manNetwork.requestPetAction(objectId, shift);
        void this.nwindow.canvas.loadTextures([TEX_TARGET_BRACKET, TEX_MOUSE_TARGET_BRACKET, ...arrGaugeTextures, ...arrGaugeBack, ...arrBalloonTextures]);
        void this.nwindow.addWindow(this.playerStatusWnd, "PlayerStatusWnd");
        void this.nwindow.addWindow(this.petStatusWnd, "PetStatusWnd");
        void this.nwindow.addWindow(this.summonedStatusWnd, "SummonedStatusWnd");
        void this.nwindow.addWindow(this.abnormalStatusWnd, "AbnormalStatusWnd");
        void this.nwindow.addWindow(this.targetStatusWnd, "TargetStatusWnd");
        void this.nwindow.addWindow(this.shortCutWnd, "ShortCutWnd");
        void this.nwindow.addWindow(this.chatWnd);
        void this.nwindow.addWindow(this.restartMenuWnd);
        for (let i = 0; i < 2; i++) {
            const player = this.olympiadPlayerWnds[i], abnormal = this.olympiadAbnormalWnds[i];

            abnormal.setVisible(false);
            void this.nwindow.addWindow(player);
            void this.nwindow.addWindow(abnormal);
            abnormal.x = player.x;
            abnormal.y = 47;
            abnormal.width = 252;
            abnormal.height = 50;
            player.onExpand = delta => { abnormal.y += delta; abnormal.invalidate(); };
        }
        void this.nwindow.addWindow(this.olympiadTargetWnd);
    }

    public showWorld() {
        void this.nwindow.canvas.loadTextures(NCCoolTimeIcon.getTextures());
        void this.manNetwork.getParent().getComponent("asset").loadSound("ItemSound.cooltime_end");
        this.show("world");
        this.messageWnd.hide();
        this.dialogBox.hide();
        this.yesNoDialogBox.hide();

        this.prepareWorld();
        this.menuWnd.setVisible(true);
        this.playerStatusWnd.setVisible(true);
        this.abnormalStatusWnd.setVisible(true);
        this.shortCutWnd.setVisible(true);
        this.chatWnd.setVisible(true);
    }

    public showNpcHtml(html: string, type: number) {
        this.nwindow.playWindowSound();
        if (type === 0) void this.npcHtmlViewer.showPacket(html, this.nwindow.getSysString(444));
        else if (type > 0) void this.npcItemHtmlViewer.showPacket(html, this.strings.itemNames[type]);
    }

    public showHtml(html: string) { void this.npcHtmlViewer.show(html); }
    public hideHtml() { this.npcHtmlViewer.hide(); }
    public tick(deltaTime: number) {
        this.abnormalStatusWnd.tick(deltaTime / 1000);
        for (const wnd of this.olympiadAbnormalWnds) wnd.tick(deltaTime / 1000);

        if (!this.communityWnd) return;

        const deltaSeconds = deltaTime / 1000;

        this.summonedStatusWnd.tick(deltaTime);
        this.matchWnd.tick(deltaTime);
        this.partyRoomWnd.tick(deltaTime);
        this.commandInfoWnd.tick(deltaTime);
        this.fishViewportWnd.tick(deltaTime / 1000);

        this.communityWnd.viewer.tick(deltaSeconds);
        this.npcHtmlViewer.tick(deltaSeconds);
        this.npcItemHtmlViewer.tick(deltaSeconds);
        this.helpWnd.tick(deltaSeconds);
        this.loginServerWnd.serverInfo.viewer.tick(deltaSeconds);
    }
    public setBoard(part: GamePackets.ShowBoardPart_T) {
        if (part.show) void this.communityWnd.setBoard(part.actions, part.content);
        else this.communityWnd.hide();
    }

    public updateNameplates() { // FDynamicActor::Render anchor (cylinder top) and DrawTargetName 0x1051d780 layout, LargeFont, no crests or icons.
        for (const [actor, nameplate] of this.nameplates) {
            nameplate.visible = false;
            if (actor.parent && this.screen === "world") continue;

            nameplate.dispose();
            this.nameplates.delete(actor);
        }
        for (const [actor, balloon] of this.balloons) {
            balloon.visible = false;
            if (actor.parent && this.screen === "world") continue;

            balloon.dispose();
            this.balloons.delete(actor);
        }
        if (this.screen !== "world") return;

        const camera = this.manRender.camera, canvas = this.nwindow.canvas;
        const width = canvas.width, height = canvas.height;
        const scale = 2 / (height * camera.projectionMatrix.elements[5]);

        for (const plate of this.manNetwork.getNameplates()) {
            const collisionHeight = plate.actor.getCollisionHeight();

            plate.actor.getWorldPosition(tmpNameplateAnchor);
            tmpNameplateAnchor.z += collisionHeight * 2 - (plate.isDead ? 2 * collisionHeight * 0.65 : plate.isSitting ? 2 * collisionHeight * 0.6 : 0); // FDynamicActor::Render 0x10621047..0x1062109c: posture 0 (sitting).
            tmpBalloonAnchor.copy(tmpNameplateAnchor);
            tmpNameplateAnchor.project(camera);

            if (tmpNameplateAnchor.z < -1 || tmpNameplateAnchor.z >= 1 || Math.abs(tmpNameplateAnchor.x) > 1 || Math.abs(tmpNameplateAnchor.y) > 1) continue;

            const sx = Math.trunc((tmpNameplateAnchor.x + 1) * 0.5 * width), sy = Math.trunc((1 - tmpNameplateAnchor.y) * 0.5 * height);
            let nameplate = this.nameplates.get(plate.actor);

            if (!nameplate) {
                nameplate = new Nameplate();
                this.nameplates.set(plate.actor, nameplate);
                this.manRender.scene.add(nameplate);
            }
            const bracket = plate.isTarget ? TEX_TARGET_BRACKET : plate.isMouseTarget ? TEX_MOUSE_TARGET_BRACKET : null;

            nameplate.update(canvas, plate.name, plate.title, getNameColor(plate), getTitleColor(plate), bracket && canvas.hasTexture(bracket) ? bracket : null);
            tmpNameplateAnchor.x = sx / width * 2 - 1;
            tmpNameplateAnchor.y = 1 - sy / height * 2;
            nameplate.position.copy(tmpNameplateAnchor.unproject(camera));
            nameplate.scale.set(nameplate.width * scale, nameplate.height * scale, 1);
            nameplate.visible = true;

            const store = plate.isSitting ? storeBalloons[plate.privateStoreType] : null, isChat = arrChatStoreTypes.includes(plate.privateStoreType);
            const text = store ? (plate.storeMessage ? `${this.nwindow.getSysString(store[0])}\n${plate.storeMessage}` : this.nwindow.getSysString(store[0])) : isChat ? plate.chatMessage : null;

            if (!text || !plate.isChatRange || !arrBalloonTextures.every(path => canvas.hasTexture(path))) continue;

            tmpBalloonUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
            tmpBalloonAnchor.addScaledVector(tmpBalloonUp, Math.trunc(tmpBalloonAnchor.distanceTo(camera.position)) / 1000 * (plate.title ? 35 : 25)).project(camera); // FDynamicActor::DrawChat 0x106183c6..0x10618516: 35 with a title, else 25.

            if (tmpBalloonAnchor.z < -1 || tmpBalloonAnchor.z >= 1 || Math.abs(tmpBalloonAnchor.x) > 1 || Math.abs(tmpBalloonAnchor.y) > 1) continue;

            let balloon = this.balloons.get(plate.actor);

            if (!balloon) {
                balloon = new ChatBalloon();
                this.balloons.set(plate.actor, balloon);
                this.manRender.scene.add(balloon);
            }

            balloon.setText(canvas, text, isChat ? 0xffffffff : store[1], isChat);
            tmpBalloonAnchor.x = Math.trunc((tmpBalloonAnchor.x + 1) * 0.5 * width) / width * 2 - 1;
            tmpBalloonAnchor.y = 1 - Math.trunc((1 - tmpBalloonAnchor.y) * 0.5 * height) / height * 2;
            balloon.position.copy(tmpBalloonAnchor.unproject(camera));
            balloon.scale.set(balloon.width * scale, balloon.height * scale, 1);
            balloon.visible = true;
        }
    }

    public setupGauge(color: GamePackets.GaugeColor_T, remaining: number, maximum: number) {
        if (!arrGaugeTextures[color]) throw new Error(`Unknown gauge color '${color}'.`);

        if (remaining <= 0 || maximum <= 0) this.gauges.delete(color);
        else this.gauges.set(color, { remaining, maximum, startedAt: performance.now() });

        this.updateGaugeOverlay();
    }

    protected updateGaugeOverlay() { // the overlay repaints every window each frame, so it is only installed while a gauge runs
        this.nwindow.overlayPaint = this.gauges.size > 0 ? canvas => { if (this.screen === "world") this.paintGauges(canvas); } : null;
        this.nwindow.invalidate();
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

            if (color === GamePackets.GaugeColor_T.CYAN || color === GamePackets.GaugeColor_T.RED) {
                tmpGaugeDown.multiplyScalar(distance * 3);
                tmpGaugeAnchor.add(tmpGaugeDown);
            }
        }

        if (this.gauges.size === 0) this.updateGaugeOverlay();
    }

    public hideWorld() {
        this.dialogBox.hide();
        this.yesNoDialogBox.hide();
        this.gauges.clear();
        this.updateGaugeOverlay();
        this.skillCoolTimes.clear();
        this.abnormalStatusWnd.setEffects([]);
        this.abnormalStatusWnd.setSecondaryEffects([]);
        this.abnormalStatusWnd.setShortEffect(null);
        this.abnormalStatusWnd.setVisible(false);
        this.npcHtmlViewer.hide();
        this.npcItemHtmlViewer.hide();
        this.communityWnd.hide();
        this.helpWnd.hide();
        this.inventoryWnd.setVisible(false);
        this.petWnd.setVisible(false);
        this.summonedWnd.setVisible(false);
        this.petStatusWnd.setVisible(false);
        this.summonedStatusWnd.setVisible(false);
        this.summonedStatusWnd.resetGauge();
        this.pledgePowerWnd.setVisible(false);
        this.tradeWnd.reset();
        this.tradeWnd.setVisible(false);
        this.shopWnd.setVisible(false);
        this.manorShopWnd.setVisible(false);
        this.recipeBookWnd.setVisible(false);
        this.recipeManufactureWnd.setVisible(false);
        this.recipeTreeWnd.setVisible(false);
        this.recipeShopWnd.setVisible(false);
        this.recipeBuyListWnd.setVisible(false);
        this.recipeBuyManufactureWnd.setVisible(false);
        this.hennaListWnd.setVisible(false);
        this.hennaInfoWnd.setVisible(false);
        this.matchWnd.setVisible(false);
        this.partyRoomMakingWnd.setVisible(false);
        this.partyRoomWnd.setVisible(false);
        this.trainWnd.setVisible(false);
        this.privateShopWnd.setVisible(false);
        this.privateBuyWnd.setVisible(false);
        this.vipShopWnd.setVisible(false);
        this.previewShopWnd.setVisible(false);
        this.storeWnd.setVisible(false);
        this.gmSkillWnd.setVisible(false);
        this.gmInventoryWnd.setVisible(false);
        this.gmStoreWnd.setVisible(false);
        this.gmQuestWnd.setVisible(false);
        this.gmDetailWnd.setVisible(false);
        this.heroTowerWnd.setVisible(false);
        this.fishViewportWnd.setVisible(false);
        this.commandInfoWnd.setVisible(false);
        this.gmClanWnd.setVisible(false);
        this.gmWnd.setVisible(false);
        this.gmDetailClan = null;
        this.olympiadControlWnd.setVisible(false);
        this.isOlympiadObserver = false;
        this.windowGroup = 0;
        if (this.savedLandmarkEnabled !== null) this.manRender.player.getComponent<LandmarkComponent>("landmark").isEnabled = this.savedLandmarkEnabled;
        this.savedLandmarkEnabled = null;
        for (const saved of this.savedWindowGroups) saved.length = 0;
        this.resetOlympiadMatch();
        for (const wnd of [...this.olympiadPlayerWnds, ...this.olympiadAbnormalWnds, this.olympiadTargetWnd]) wnd.setVisible(false);
        this.deliverWnd.setVisible(false);
        this.selectDeliverWnd.setVisible(false);
        this.menuWnd.setVisible(false);
        this.mainWnd.setVisible(false);
        this.mapWnd.setVisible(false);
        this.systemMenuWnd.setVisible(false);
        this.macroWnd.hide();
        this.playerStatusWnd.setVisible(false);
        this.shortCutWnd.setVisible(false);
        this.chatWnd.setVisible(false);
        this.restartMenuWnd.setVisible(false);
        this.targetStatusWnd.setTarget(null);
    }

    public setAbnormalStatus(effects: GamePackets.AbnormalStatus_T[]) { this.abnormalStatusWnd.setEffects(effects); }
    public setSecondaryAbnormalStatus(effects: GamePackets.AbnormalStatus_T[]) { this.abnormalStatusWnd.setSecondaryEffects(effects); }
    public setShortBuff(effect: GamePackets.AbnormalStatus_T) {
        const skill = this.strings.skillInfos[`${effect.id}:${effect.level}`];

        this.abnormalStatusWnd.setShortEffect(skill && skill.name && skill.name.charCodeAt(0) !== 0 ? effect : null);
    }

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

    public setStatus(info: GamePackets.UserInfo_T) {
        this.statusInfo = info;
        this.trainWnd.setStatus(info);
        this.mainWnd.actionWnd.setClass(info.classId);
        this.playerStatusWnd.setStatus(info);
        this.mainWnd.detailStatusWnd.setStatus(info);
        this.mainWnd.clanWnd.setStatus(info);
        this.gmClanWnd.setStatus(info);
        this.gmWnd.setPlayerName(info.name);
        this.inventoryWnd.setWeight(info.curLoad, info.maxLoad);
        this.inventoryWnd.setDwarvenCraft(info.hasDwarvenCraft);
        this.setInventory(this.inventory);
    }

    public toggleCharacterStatus() {
        this.mainWnd.setVisible(!this.mainWnd.isVisible());
        this.nwindow.playPanelSound("charstat", this.mainWnd.isVisible());
    }
    public toggleSkills() { this.toggleSkillTab("skills"); }
    public setHenna(henna: GamePackets.HennaStatus_T) { this.mainWnd.detailStatusWnd.setHenna(henna); }
    public setClan(clan: GamePackets.ClanInfo_T) { this.mainWnd.detailStatusWnd.setClan(clan); this.mainWnd.clanWnd.setClan(clan); }
    public clearClanMembers() { this.mainWnd.clanWnd.clearMembers(); }
    public addClanMember(member: GamePackets.ClanMember_T) { this.mainWnd.clanWnd.addMember(member); }
    public updateClanMember(member: GamePackets.ClanMember_T) { this.mainWnd.clanWnd.updateMember(member); }
    public deleteClanMember(name: string) { this.mainWnd.clanWnd.deleteMember(name); }
    public setPledgePower(power: Uint8Array) { this.pledgePowerWnd.setPower(power); }
    public setPledgeStatus(objectId: number, clanId: number) { if (this.statusInfo && this.statusInfo.objectId === objectId) this.statusInfo.clanId = clanId; }

    public setRunning(isRunning: boolean) {
        if (!this.statusInfo) return;

        this.statusInfo.isRunning = isRunning;
        this.mainWnd.detailStatusWnd.setStatus(this.statusInfo);
    }

    public toggleSkillTab(tab: MainTab_T) {
        if (this.mainWnd.isVisible() && this.mainWnd.getSelectedTab() === tab) {
            this.mainWnd.setVisible(false);
            this.nwindow.playPanelSound("charstat", false);
            return;
        }

        this.mainWnd.selectTab(tab);
        this.mainWnd.setVisible(true);
        this.nwindow.playPanelSound("charstat", true);
    }

    public setMacros(macros: GamePackets.Macro_T[]) { this.macroWnd.setMacros(macros); }

    protected setGroupWindowVisible(wnd: NWnd | HTMLElement, isVisible: boolean) {
        if (!(wnd instanceof HTMLElement)) { wnd.setVisible(isVisible); return; }
        const owner = [...this.getDOMWindows(), this.petWnd, this.summonedWnd, this.pledgePowerWnd].find(owner => owner.element === wnd);

        if (owner) owner.setVisible(isVisible);
        else wnd.hidden = !isVisible;
    }

    protected setWindowGroup(group: number) {
        if (group === this.windowGroup) return;

        const landmark = this.manRender.player.getComponent<LandmarkComponent>("landmark");

        if (group !== 0 && this.savedLandmarkEnabled === null) { this.savedLandmarkEnabled = landmark.isEnabled; landmark.isEnabled = false; }
        if (group === 0 && this.savedLandmarkEnabled !== null) { landmark.isEnabled = this.savedLandmarkEnabled; this.savedLandmarkEnabled = null; }

        const saved = this.savedWindowGroups[this.windowGroup];

        saved.length = 0;
        for (const wnd of this.nwindow.getWindows())
            if (wnd.isVisible) saved.push(wnd);
        for (const wnd of Array.from(this.layer.root.children) as HTMLElement[])
            if (!wnd.hidden) saved.push(wnd);
        for (const wnd of saved) this.setGroupWindowVisible(wnd, false);
        for (const wnd of this.savedWindowGroups[group]) this.setGroupWindowVisible(wnd, true);
        this.windowGroup = group;
        if (group === 2) {
            this.olympiadControlWnd.setVisible(true);
            for (let i = 0; i < 2; i++) {
                this.olympiadPlayerWnds[i].setVisible(true);
                this.olympiadAbnormalWnds[i].setVisible(this.olympiadAbnormalWnds[i].getEffects().length > 0);
            }
            this.chatWnd.setVisible(true);
        }
    }

    public setOlympiadMode(mode: number) {
        if (mode === 3) {
            this.setWindowGroup(2);
            this.isOlympiadObserver = true;
        } else if (mode === 0) {
            if (this.windowGroup === 2) this.setWindowGroup(0);
            else this.olympiadTargetWnd.setVisible(false);
            this.isOlympiadObserver = false;
        } else {
            this.olympiadTargetWnd.initialize(mode === 1 ? 2 : 1);
            this.olympiadTargetWnd.setVisible(true);
        }
    }

    public setOlympiadUserInfo(info: GamePackets.OlympiadUserInfo_T) {
        const side = info.side << 24 >> 24;

        if (this.windowGroup === 2) {
            if (side === 1 || side === 2) this.olympiadPlayerWnds[side - 1].setInfo(info);
        } else if (side === this.olympiadTargetWnd.getSide()) this.olympiadTargetWnd.setInfo(info);
    }

    public setOlympiadEffects(objectId: number, effects: GamePackets.AbnormalStatus_T[]) {
        const index = this.olympiadPlayerWnds.findIndex(wnd => wnd.getObjectId() === objectId);

        if (index < 0) return;
        this.olympiadAbnormalWnds[index].setEffects(effects.slice(0, 31));
        this.olympiadAbnormalWnds[index].setVisible(effects.length > 0);
    }

    public resetOlympiadMatch() {
        for (const wnd of this.olympiadPlayerWnds) wnd.reset();
        for (const wnd of this.olympiadAbnormalWnds) { wnd.setEffects([]); wnd.setVisible(false); }
        this.olympiadTargetWnd.reset();
    }

    public notifyOlympiadSkill(objectId: number, skillId: number) {
        if (skillId < 0 || skillId > 1999) return;
        const skill = this.strings.skillInfos[`${skillId}:1`];
        const message = this.formatSystemMessage(46, skill ? skill.name : "");

        for (const wnd of this.olympiadPlayerWnds)
            if (wnd.getObjectId() === objectId) wnd.appendMessage(message);
    }

    public notifyOlympiadAttack(attackerId: number, defenderId: number, attackerName: string, isMiss: boolean, isCritical: boolean) {
        for (const wnd of this.olympiadPlayerWnds) {
            if (wnd.getObjectId() === attackerId) {
                if (isCritical) wnd.appendMessage(this.nwindow.getSystemMessage(44));
            } else if (wnd.getObjectId() === defenderId && isMiss) wnd.appendMessage(this.formatSystemMessage(42, attackerName));
        }
    }
    public setGMPledgeInfo(info: GamePackets.GMViewPledgeInfo_T) { this.gmClanWnd.setInfo(info); }

    public setGMCharacterInfo(info: GamePackets.GMViewCharacterInfo_T, clan: GMClanInfo_T, crest: CanvasImageSource) {
        this.gmDetailClan = clan;
        this.gmDetailWnd.setClan(clan, crest);
        this.gmDetailWnd.setCharacterInfo(info);
    }
    public setCrestServer(serverId: number) {
        let cache = this.cacheServerCrests.get(serverId);

        if (!cache) { cache = new Map(); this.cacheServerCrests.set(serverId, cache); }
        this.cacheCrests = cache;
    }
    public getCachedCrest(crestId: number) { return this.cacheCrests.get(crestId) || null; }
    public setPledgeCrest(crestId: number, data: Uint8Array): HTMLCanvasElement {
        if (crestId <= 0 || !data.length || this.cacheCrests.has(crestId)) return null;

        if (data.length < 128) throw new Error(`Invalid crest DDS length ${data.length}`);
        const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const height = header.getUint32(12, true), width = header.getUint32(16, true), fourCC = header.getUint32(84, true);
        const blockSize = fourCC === 0x31545844 ? 8 : fourCC === 0x33545844 || fourCC === 0x35545844 ? 16 : 0;

        if (header.getUint32(0, true) !== 0x20534444 || !(header.getUint32(8, true) & 0x80000) || !width || !height || width & (width - 1) || height & (height - 1) || !blockSize)
            throw new Error(`Invalid crest DDS ${crestId}`);
        const mipCount = header.getUint32(28, true) || 1;
        let mipWidth = width, mipHeight = height, remaining = data.length - 128;

        if (mipCount > remaining / blockSize) throw new Error(`Invalid crest DDS mip count ${crestId}`);
        for (let index = 0; index < mipCount; index++) {
            const size = Math.max(4, mipWidth) * Math.max(4, mipHeight) * blockSize / 16;

            if (size > remaining) throw new Error(`Truncated crest DDS mip ${crestId}`);
            remaining -= size;
            mipWidth = Math.ceil(mipWidth / 2);
            mipHeight = Math.ceil(mipHeight / 2);
        }
        const info = { textureType: "dds", buffer: data.slice().buffer } as any;

        if (!convertDDSTextureInfo(info)) throw new Error(`Unsupported crest DDS ${crestId}`);
        const canvas = document.createElement("canvas");

        canvas.width = info.width;
        canvas.height = info.height;
        canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(info.buffer), info.width, info.height), 0, 0);
        this.cacheCrests.set(crestId, canvas);
        return canvas;
    }
    public setGMQuestList(info: GamePackets.GMViewQuestList_T) { void this.gmQuestWnd.setQuestList(info); }
    public setGMSkillInfo(info: GamePackets.GMViewSkillInfo_T) { void this.gmSkillWnd.setSkillInfo(info); }
    public setGMWarehouseInfo(info: GamePackets.GMViewWarehouseWithdrawList_T) { void this.gmStoreWnd.setWarehouseInfo(info); }
    public setGMInventoryInfo(info: GamePackets.GMViewItemList_T) {
        let hasEar = false, hasRing = false;
        const entries = info.items.map(item => {
            let slot = -1;

            if (item.isEquipped) {
                if (item.bodyPart & 0x6) { slot = hasEar ? 8 : 9; hasEar = true; }
                else if (item.bodyPart & 0x30) { slot = hasRing ? 13 : 14; hasRing = true; }
                else if (item.bodyPart !== 131072) slot = equipmentSlots[item.bodyPart] ?? -1;
            }
            return { objectId: item.objectId, itemId: item.itemId, name: this.strings.itemNames[item.itemId], icon: this.strings.itemIcons[item.itemId], count: item.count, enchant: item.enchantLevel, customType1: item.customType1, customType2: item.customType2, itemClass: item.type2, bodyPart: item.bodyPart, info: this.strings.itemInfos[item.itemId], slot, isQuest: item.type2 === GamePackets.ItemType2_T.TYPE2_QUEST, isMoney: item.type2 === GamePackets.ItemType2_T.TYPE2_MONEY };
        });

        void this.gmInventoryWnd.setInventoryInfo(info, entries);
    }
    public setSkills(skills: GamePackets.SkillEntry_T[]) { void this.skillWnd.setSkills(skills); }
    public setQuestStates(states: GamePackets.QuestState_T[]) { void this.mainWnd.questWnd.setStates(states); }
    public clearQuestLocation() { this.mainWnd.questWnd.clearLocation(); }

    public toggleMap() {
        this.mapWnd.setVisible(!this.mapWnd.isVisible());
        this.nwindow.playPanelSound("map", this.mapWnd.isVisible());
        if (this.mapWnd.isVisible()) {
            const position = this.manRender.player.position;

            this.mapWnd.setPosition(position.x, position.y, true);
        }
    }

    public showMap(_mapId: number) { this.toggleMap(); } // NWindow 0x1005bcf0: ShowMiniMap toggles the minimap window


    public chooseInventoryItem(itemId: number) { this.inventoryWnd.chooseItem(itemId); }
    public clearInventoryChoice() { this.inventoryWnd.clearChoice(); }

    public startTrade(ownName: string, otherName: string) {
        this.inventoryWnd.setVisible(false);
        this.tradeWnd.reset();

        if (ownName === null || otherName === null) return;

        this.tradeWnd.setNames(ownName, otherName);
        this.tradeWnd.setVisible(true);
    }

    public clearMultiSell(listId: number) { this.vipShopWnd.clear(listId); }
    public showMultiSell(list: GamePackets.MultiSellList_T) { void this.vipShopWnd.show(list); }
    public showPrivateStoreBuy(list: GamePackets.PrivateStoreBuyList_T) { void this.privateBuyWnd.showBuyStore(list); }
    public showPrivateStoreSell(list: GamePackets.PrivateStoreSellList_T) { void this.privateShopWnd.showStore(list); }
    public showPrivateStoreManageSell(list: GamePackets.PrivateStoreManageSell_T) { void this.privateShopWnd.showManageStore(list); }
    public setPrivateSellLimit(limit: number) { this.privateShopWnd.setLimit(limit); }
    public showPrivateStoreManageBuy(list: GamePackets.PrivateStoreManageBuy_T) { void this.privateBuyWnd.showManageBuyStore(list); }
    public setPrivateBuyLimit(limit: number) { this.privateBuyWnd.setLimit(limit); }
    public showRecipeBook(book: GamePackets.RecipeBook_T) {
        this.layer.place(this.recipeBookWnd.element, parseFloat(this.recipeManufactureWnd.element.style.left), parseFloat(this.recipeManufactureWnd.element.style.top));
        void this.recipeBookWnd.show(book);
    }
    public showRecipeManufacture(state: GamePackets.RecipeItemMakeInfo_T) {
        const recipe = this.strings.recipes.find(recipe => recipe.id === state.recipeId);

        if (!recipe) return;
        this.recipeBookWnd.setVisible(false);
        this.layer.place(this.recipeManufactureWnd.element, parseFloat(this.recipeBookWnd.element.style.left), parseFloat(this.recipeBookWnd.element.style.top));
        void this.recipeManufactureWnd.show(recipe, state, this.inventory);
    }
    public setRecipeLimits(dwarf: number, common: number) { this.recipeBookWnd.setLimits(dwarf, common); }
    public showRecipeShopManage(list: GamePackets.RecipeShopManageList_T) { void this.recipeShopWnd.show(list); }
    public showRecipeShopSellList(list: GamePackets.RecipeShopSellList_T) {
        this.layer.place(this.recipeBuyListWnd.element, parseFloat(this.recipeBuyManufactureWnd.element.style.left), parseFloat(this.recipeBuyManufactureWnd.element.style.top));
        void this.recipeBuyListWnd.show(list);
    }
    public showRecipeShopItemInfo(state: GamePackets.RecipeShopItemInfo_T) {
        const recipe = this.strings.recipes.find(recipe => recipe.id === state.recipeId);

        if (!recipe) return;
        this.recipeBuyListWnd.setVisible(false);
        this.layer.place(this.recipeBuyManufactureWnd.element, parseFloat(this.recipeBuyListWnd.element.style.left), parseFloat(this.recipeBuyListWnd.element.style.top));
        void this.recipeBuyManufactureWnd.showShop(recipe, state, this.inventory);
    }
    public openPartyMatch() {
        this.manNetwork.requestPartyMatchConfig(1, -1, 1);
        this.matchWnd.resetFilters();
        if (this.partyRoomWnd.minimized.isVisible()) this.partyRoomWnd.minimized.restore();
    }
    public showPartyMatchList(list: GamePackets.PartyMatchList_T) { this.matchWnd.show(list); }
    public showPartyMatchDetail(detail: GamePackets.PartyMatchDetail_T) {
        this.matchWnd.setVisible(false);
        this.partyRoomWnd.show(detail);
    }
    public setPartyRoomMembers(mode: number, members: GamePackets.PartyRoomMember_T[], isReset: boolean) {
        if (!isReset) {
            const remaining = new Map(members.map(member => [member.objectId, member]));
            const ordered: GamePackets.PartyRoomMember_T[] = [];

            this.partyRoomWnd.table.getRows().forEach(row => {
                const member = remaining.get(Number(row.id));

                if (member) { ordered.push(member); remaining.delete(member.objectId); }
            });
            members = ordered.concat(Array.from(remaining.values()));
        }
        this.partyRoomWnd.setMembers(mode, members, isReset);
    }
    public closePartyRoom() { this.partyRoomWnd.setVisible(false); this.partyRoomWnd.clearChat(); }
    public showAquireSkillList(skills: GamePackets.AquireSkillEntry_T[], mode: number) { void this.trainWnd.showAquireList(skills, mode); }
    public showAquireSkillInfo(info: GamePackets.AquireSkillInfo_T) { void this.trainWnd.showAquireInfo(info); }
    public hideTrainWnd() { this.trainWnd.setVisible(false); }
    public showManorShop(list: GamePackets.BuyListSeed_T | GamePackets.SellListProcure_T, isSell: boolean) { void this.manorShopWnd.showManor(isSell, list.adena, "manorId" in list ? list.manorId : list.listId, list.items); }
    public showEnchantSkillList(skills: GamePackets.EnchantSkill_T[]) { void this.trainWnd.showEnchantList(skills); }
    public showEnchantSkillInfo(info: GamePackets.EnchantSkillInfo_T) { void this.trainWnd.showEnchantInfo(info); }
    public showHennaList(list: GamePackets.HennaEquipList_T, isRemove = false) {
        this.hennaInfoWnd.setVisible(false);
        this.layer.place(this.hennaListWnd.element, parseFloat(this.hennaInfoWnd.element.style.left), parseFloat(this.hennaInfoWnd.element.style.top));
        void this.hennaListWnd.show(list, isRemove);
    }
    public showHennaInfo(info: GamePackets.HennaItemInfo_T, isRemove = false) {
        this.hennaListWnd.setVisible(false);
        this.layer.place(this.hennaInfoWnd.element, parseFloat(this.hennaListWnd.element.style.left), parseFloat(this.hennaListWnd.element.style.top));
        this.hennaListWnd.clear();
        void this.hennaInfoWnd.show(info, isRemove);
    }

    public showShop(isSell: boolean, money: number, items: GamePackets.ShopItem_T[]) { void this.shopWnd.show(isSell, money, items); }
    public showWarehouse(isWithdraw: boolean, list: GamePackets.WarehouseList_T) {
        this.npcHtmlViewer.setVisible(false);
        if (!isWithdraw) this.inventoryWnd.setVisible(false);
        void this.storeWnd.showWarehouse(isWithdraw, list);
    }
    public showPackageTargets(targets: GamePackets.PackageTarget_T[]) { if (targets.length) this.selectDeliverWnd.show(targets); }
    public showPackage(list: GamePackets.PackageSendableList_T) { if (list.items.length) void this.deliverWnd.showPackage(list); }
    public showPreviewShop(list: GamePackets.ShopPreviewList_T) {
        void this.previewShopWnd.show(false, list.adena, list.items.map(item => ({ ...item, type1: item.type2, type2: -1, objectId: 0, count: 0, enchantLevel: 0, customType2: 0 })));
    }
    public setTradeItems(mode: number, items: GamePackets.TradeItem_T[], recalculatedItemCount = items.length) { void this.tradeWnd.setItems(mode, [...items], recalculatedItemCount); }
    public recalculateTradeRows(mode: number, itemCount: number) { this.tradeWnd.recalculateRows(mode, itemCount); }
    public finishTrade() {
        this.tradeWnd.reset();
        this.tradeWnd.setVisible(false);
    }

    public toggleSystemMenu() {
        this.systemMenuWnd.setVisible(!this.systemMenuWnd.isVisible());
        this.nwindow.playPanelSound("system", this.systemMenuWnd.isVisible());
    }

    protected getInventoryItemName(item: InventoryEntry_T) { // NWindow 0x1001e470.
        return `${item.enchant > 0 && item.info.canShowEnchant ? `+${item.enchant}` : ""}${item.name}${item.info.addName ? `-${item.info.addName}` : ""}`;
    }

    protected dropInventoryItem(item: InventoryEntry_T, point: Vector3) {
        const consumeType = item.info.consumeType;
        const location = { x: point.x, y: point.y, z: point.z };

        if (!(consumeType >= 1 && consumeType <= 3 && item.count > 1)) {
            this.manNetwork.dropItem(item.objectId, 1, location);
            return;
        }

        this.dialogBox.showQuantity(this.formatSystemMessage(71, this.getInventoryItemName(item)), item.count, consumeType, count => this.manNetwork.dropItem(item.objectId, count, location), id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null));
        this.dialogBox.owner = this.inventoryWnd.getItemOwner(item);
        this.manNetwork.playSystemMessageSound(71);
    }

    protected destroyInventoryItem(item: InventoryEntry_T) { // NWindow 0x10097bb1 / 0x10009741.
        const consumeType = item.info.consumeType;
        const isQuantity = consumeType >= 1 && consumeType <= 3 && item.count > 1;
        const messageId = isQuantity ? 73 : 74;
        const text = this.formatSystemMessage(messageId, this.getInventoryItemName(item));
        const destroy = (count: number) => {
            this.manNetwork.destroyItem(item.objectId, count);
            this.nwindow.playTrashSound();
        };

        if (isQuantity) this.dialogBox.showQuantity(text, item.count, consumeType, destroy, id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null));
        else this.dialogBox.show(text, DialogType_T.OK_CANCEL, isOk => { if (isOk) destroy(1); });

        this.dialogBox.owner = this.inventoryWnd.getItemOwner(item);

        this.manNetwork.playSystemMessageSound(messageId);
    }

    protected crystallizeInventoryItem(item: InventoryEntry_T) { // NWindow 0x10097d5c / 0x10009795.
        if (!this.statusInfo || !this.statusInfo.hasDwarvenCraft || !item.info.crystallizable) return;

        this.dialogBox.show(this.formatSystemMessage(336, this.getInventoryItemName(item)), DialogType_T.OK_CANCEL, isOk => {
            if (!isOk) return;

            this.manNetwork.crystallizeItem(item.objectId, 1);
            this.nwindow.playTrashSound();
        });
        this.dialogBox.owner = this.inventoryWnd.getItemOwner(item);
        this.manNetwork.playSystemMessageSound(336);
    }

    protected unequipInventoryItem(item: InventoryEntry_T) { // NWindow 0x1009652d, equipped body-part request.
        const paperdoll = this.statusInfo ? this.statusInfo.paperdollObjects : [];

        if (getEquipmentSlot(item.bodyPart, item.objectId, paperdoll) !== item.slot) return false;

        let bodyPart = item.bodyPart;
        const pair = bodyPart & 0x6 ? [GamePackets.Paperdoll_T.PAPERDOLL_REAR, GamePackets.Paperdoll_T.PAPERDOLL_LEAR] : bodyPart & 0x30 ? [GamePackets.Paperdoll_T.PAPERDOLL_RFINGER, GamePackets.Paperdoll_T.PAPERDOLL_LFINGER] : null;

        if (pair) {
            const slot = pair.find(slot => paperdoll[slot] === item.objectId);

            bodyPart = 1 << slot;
        }

        this.manNetwork.unequipBodyPart(bodyPart);
        return true;
    }

    protected useInventoryItem(item: InventoryEntry_T, isRight: boolean) { // NWindow 0x10094be0 / 0x10094ed0 / 0x10096da0 / 0x10097240.
        const network = this.manNetwork;

        if (item.slot >= 0) {
            if (!this.unequipInventoryItem(item)) return;
        } else {
            const messageId = item.info.isRecipe ? 798 : item.info.popup;

            if (messageId > 0) {
                this.dialogBox.show(this.formatSystemMessage(messageId, item.name), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.useItem(item.objectId); });
                this.dialogBox.owner = this.inventoryWnd.getItemOwner(item);
                network.playSystemMessageSound(messageId);
            } else network.useItem(item.objectId);
        }

        if (isRight) network.resetMacros();
    }

    public toggleInventory() {
        this.nwindow.playPanelSound("inventory", !this.inventoryWnd.isVisible());

        if (this.inventoryWnd.isVisible()) this.inventoryWnd.setVisible(false);
        else this.manNetwork.requestItemList();
    }

    public updateInventoryOrder(change: number, item: GamePackets.InventoryItem_T) {
        this.inventoryWnd.updateOrder(change, item.objectId, item.isEquipped, item.type2 === GamePackets.ItemType2_T.TYPE2_QUEST, item.type2 === GamePackets.ItemType2_T.TYPE2_MONEY);
    }

    public setInventoryOrderOwner(name: string, namespace: number) { this.inventoryWnd.setOrderOwner(name, namespace); }
    public saveInventoryOrder() { this.inventoryWnd.saveOrder(); }

    public setInventory(items: GamePackets.InventoryItem_T[], showWindow: boolean = false, isFull: boolean = false) {
        this.inventory = items;
        this.mainWnd.questWnd.setInventory(items);
        this.recipeManufactureWnd.setInventory(items);
        this.recipeBuyManufactureWnd.setInventory(items);
        if (showWindow) this.inventoryWnd.setVisible(true);

        const paperdoll = this.statusInfo ? this.statusInfo.paperdollObjects : [];

        void this.inventoryWnd.setItems(items.map(item => ({ objectId: item.objectId, itemId: item.itemId, name: this.strings.itemNames[item.itemId], icon: this.strings.itemIcons[item.itemId], count: item.count, enchant: item.enchantLevel, customType1: "customType1" in item ? item.customType1 : 0, customType2: item.customType2, itemClass: item.type2, bodyPart: item.bodyPart, info: this.strings.itemInfos[item.itemId], slot: item.isEquipped ? getEquipmentSlot(item.bodyPart, item.objectId, paperdoll) : -1, isQuest: item.type2 === GamePackets.ItemType2_T.TYPE2_QUEST, isMoney: item.type2 === GamePackets.ItemType2_T.TYPE2_MONEY })), isFull);
    }

    public setPetInventory(items: GamePackets.InventoryItem_T[], isFull: boolean = false) {
        void this.petWnd.setItems(items.map(item => ({ objectId: item.objectId, itemId: item.itemId, name: this.strings.itemNames[item.itemId], icon: this.strings.itemIcons[item.itemId], count: item.count, enchant: item.enchantLevel, customType1: "customType1" in item ? item.customType1 : 0, customType2: item.customType2, itemClass: item.type2, bodyPart: item.bodyPart, info: this.strings.itemInfos[item.itemId], slot: -1, isEquipped: item.isEquipped, isQuest: item.type2 === GamePackets.ItemType2_T.TYPE2_QUEST, isMoney: item.type2 === GamePackets.ItemType2_T.TYPE2_MONEY })), isFull);
    }

    protected transferPetItem(item: InventoryEntry_T, isGiving: boolean) { // NWindow 0x100979d6 / 0x100de644, kinds 54/55.
        const consumeType = item.info.consumeType;
        const transfer = (count: number) => {
            if (isGiving) this.manNetwork.giveItemToPet(item.objectId, count);
            else this.manNetwork.getItemFromPet(item.objectId, count);
        };

        if (consumeType >= 1 && consumeType <= 3 && item.count > 1) {
            this.dialogBox.showQuantity(this.formatSystemMessage(72, item.name), item.count, consumeType, transfer, id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null));
            this.dialogBox.owner = isGiving ? this.inventoryWnd.getItemOwner(item) : this.petWnd.getItemOwner();
        } else transfer(1);
    }

    protected showQuestAbort(id: number) {
        this.dialogBox.show(this.nwindow.getSystemMessage(id > 0 ? 182 : 1201), DialogType_T.OK_CANCEL, isOk => {
            if (!isOk || id <= 0) return;

            this.manNetwork.abortQuest(id);
            this.mainWnd.questWnd.clearLocation();
        });
        if (id > 0) this.dialogBox.owner = this.mainWnd.questWnd.element;
    }

    protected clanAction(action: string, member: GamePackets.ClanMember_T) {
        const network = this.manNetwork, dialog = this.dialogBox;

        switch (action) {
            case "invite": {
                const target = network.getSelectedPlayer();

                if (target) network.invitePledge(target.objectId);
                else this.clanError(186);
                break;
            }
            case "title":
                if (!network.getSelectedPlayer()) { this.clanError(50); break; }

                dialog.showText(this.nwindow.getSystemMessage(256), title => {
                    const target = network.getSelectedPlayer();

                    if (!target) return true;
                    const error = !this.isValidName(title) ? 204 : title.length > 16 ? 80 : 0;

                    if (error) {
                        this.clanError(error);
                        if (error === 204) dialog.textEditor.setValue("");
                        dialog.textEditor.focus();
                        return false;
                    }
                    network.giveNickName(target.name, title);
                    return true;
                });
                break;
            case "deleteTitle":
                if (!network.getSelectedPlayer()) { this.clanError(50); break; }

                dialog.show(this.nwindow.getSystemMessage(1181), DialogType_T.OK_CANCEL, isOk => {
                    const target = network.getSelectedPlayer();

                    if (isOk && target) network.giveNickName(target.name, "");
                });
                break;
            case "dismiss":
                if (!member) { this.clanError(263); break; }
                if (!member.name) break;

                dialog.show(this.formatSystemMessage(69, member.name), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.oustPledgeMember(member.name); });
                break;
            case "privileges":
                if (!this.statusInfo) break;

                network.requestPledgePower();
                this.pledgePowerWnd.showFor(this.statusInfo.objectId, 1, this.statusInfo.name);
                break;
            case "authorize":
                if (!this.statusInfo || !(this.statusInfo.clanRelation & 0x40) || !member || !member.name) break;
                if (!member.objectId) { dialog.show(this.nwindow.getSystemMessage(145), DialogType_T.OK_CANCEL, null); break; }

                network.requestMemberPledgePower(member.objectId);
                this.pledgePowerWnd.showFor(member.objectId, 2, member.name);
                break;
            case "declareWar":
            case "endWar":
                dialog.showText(this.nwindow.getSystemMessage(action === "declareWar" ? 1531 : 1532), name => {
                    if (action === "declareWar") network.startPledgeWar(name);
                    else network.stopPledgeWar(name);
                    return true;
                });
                break;
            case "leave": {
                if (!this.statusInfo || this.statusInfo.clanRelation & 0x40) { this.clanError(239); break; }
                const clan = network.getClanInfo();

                dialog.show(this.formatSystemMessage(68, clan ? clan.name : ""), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.withdrawPledge(); });
                break;
            }
            case "deleteCrest":
            case "deleteInsignia":
                dialog.show(this.nwindow.getSystemMessage(1182), DialogType_T.OK_CANCEL, isOk => {
                    if (!isOk) return;

                    if (action === "deleteCrest") network.setPledgeCrest(new Uint8Array(0));
                    else network.setPledgeLargeCrest(new Uint8Array(0));
                });
                break;
            case "setCrest":
            case "setInsignia":
                dialog.show(this.nwindow.getSystemMessage(action === "setCrest" ? 211 : 1478), action === "setCrest" ? DialogType_T.OK : DialogType_T.OK_CANCEL, isOk => {
                    if (isOk) this.pickCrest(action === "setCrest");
                });
                break;
            case "penalty": network.userCommand(100); break;
            case "community": this.communityWnd.openClan(); break;
            default: throw new Error(`Unknown clan action '${action}'.`);
        }
    }

    protected pickCrest(isSmall: boolean) { // NWindow 0x10080bf0 crest / 0x100809d0 insignia read the BMP path from sysmsg 208; a file picker replaces it.
        const input = document.createElement("input");

        input.type = "file";
        input.accept = ".bmp";
        input.onchange = async () => {
            const data = encodeCrest(new Uint8Array(await input.files[0].arrayBuffer()), isSmall ? 16 : 64, isSmall ? 12 : 64);

            if (!data) this.clanError(isSmall ? 211 : 1478);
            else if (isSmall) this.manNetwork.setPledgeCrest(data);
            else this.manNetwork.setPledgeLargeCrest(data);
        };
        input.click();
    }

    protected clanError(id: number) { this.addSystemMessage(this.nwindow.getSystemMessage(id), this.strings.systemMessageColors[id]); this.manNetwork.playSystemMessageSound(id); }

    protected isValidName(name: string) {
        const lower = name.replace(/[A-Z]/g, char => String.fromCharCode(char.charCodeAt(0) + 32));

        return this.nwindow.canvas.hasGlyphs(name) && !this.strings.obsceneWords.some(word => lower.includes(word)) && !Object.values(this.strings.npcNames).some(npcName => lower === npcName.toLowerCase());
    }

    protected renamePet() { // NWindow 0x1000a55c, configured ACP1252 and SmallFont BMP glyphs.
        this.dialogBox.showText(this.nwindow.getSystemMessage(535), name => {
            let error = 0;

            if (!this.isValidName(name)) error = 591;
            else if (name.length > 16) error = 80;

            if (error) {
                this.addSystemMessage(this.nwindow.getSystemMessage(error), this.strings.systemMessageColors[error]);
                this.manNetwork.playSystemMessageSound(error);
                if (error === 591) this.dialogBox.textEditor.setValue("");
                this.dialogBox.textEditor.focus();
                return false;
            }

            this.manNetwork.changePetName(name);
            return true;
        });
        this.dialogBox.owner = this.petWnd.element;
    }

    public updateStatus(status: Record<number, number>) {
        const info = this.statusInfo;

        if (!info) return;
        if (GamePackets.StatusUpdate_T.LEVEL in status) info.level = status[GamePackets.StatusUpdate_T.LEVEL];
        if (GamePackets.StatusUpdate_T.EXP in status) info.exp = status[GamePackets.StatusUpdate_T.EXP];
        if (GamePackets.StatusUpdate_T.CUR_HP in status) info.curHp = status[GamePackets.StatusUpdate_T.CUR_HP];
        if (GamePackets.StatusUpdate_T.MAX_HP in status) info.maxHp = status[GamePackets.StatusUpdate_T.MAX_HP];
        if (GamePackets.StatusUpdate_T.CUR_MP in status) info.curMp = status[GamePackets.StatusUpdate_T.CUR_MP];
        if (GamePackets.StatusUpdate_T.MAX_MP in status) info.maxMp = status[GamePackets.StatusUpdate_T.MAX_MP];
        if (GamePackets.StatusUpdate_T.CUR_CP in status) info.curCp = status[GamePackets.StatusUpdate_T.CUR_CP];
        if (GamePackets.StatusUpdate_T.MAX_CP in status) info.maxCp = status[GamePackets.StatusUpdate_T.MAX_CP];
        if (GamePackets.StatusUpdate_T.STR in status) info.str = status[GamePackets.StatusUpdate_T.STR];
        if (GamePackets.StatusUpdate_T.DEX in status) info.dex = status[GamePackets.StatusUpdate_T.DEX];
        if (GamePackets.StatusUpdate_T.CON in status) info.con = status[GamePackets.StatusUpdate_T.CON];
        if (GamePackets.StatusUpdate_T.INT in status) info.int = status[GamePackets.StatusUpdate_T.INT];
        if (GamePackets.StatusUpdate_T.WIT in status) info.wit = status[GamePackets.StatusUpdate_T.WIT];
        if (GamePackets.StatusUpdate_T.MEN in status) info.men = status[GamePackets.StatusUpdate_T.MEN];
        if (GamePackets.StatusUpdate_T.SP in status) info.sp = status[GamePackets.StatusUpdate_T.SP];
        if (GamePackets.StatusUpdate_T.CUR_LOAD in status) info.curLoad = status[GamePackets.StatusUpdate_T.CUR_LOAD];
        if (GamePackets.StatusUpdate_T.MAX_LOAD in status) info.maxLoad = status[GamePackets.StatusUpdate_T.MAX_LOAD];
        if (GamePackets.StatusUpdate_T.P_ATK in status) info.pAtk = status[GamePackets.StatusUpdate_T.P_ATK];
        if (GamePackets.StatusUpdate_T.ATK_SPD in status) info.atkSpd = status[GamePackets.StatusUpdate_T.ATK_SPD];
        if (GamePackets.StatusUpdate_T.P_DEF in status) info.pDef = status[GamePackets.StatusUpdate_T.P_DEF];
        if (GamePackets.StatusUpdate_T.EVASION in status) info.evasion = status[GamePackets.StatusUpdate_T.EVASION];
        if (GamePackets.StatusUpdate_T.ACCURACY in status) info.accuracy = status[GamePackets.StatusUpdate_T.ACCURACY];
        if (GamePackets.StatusUpdate_T.CRITICAL in status) info.critical = status[GamePackets.StatusUpdate_T.CRITICAL];
        if (GamePackets.StatusUpdate_T.M_ATK in status) info.mAtk = status[GamePackets.StatusUpdate_T.M_ATK];
        if (GamePackets.StatusUpdate_T.CAST_SPD in status) info.castSpd = status[GamePackets.StatusUpdate_T.CAST_SPD];
        if (GamePackets.StatusUpdate_T.M_DEF in status) info.mDef = status[GamePackets.StatusUpdate_T.M_DEF];
        if (GamePackets.StatusUpdate_T.PVP_FLAG in status) info.pvpFlag = status[GamePackets.StatusUpdate_T.PVP_FLAG];
        if (GamePackets.StatusUpdate_T.KARMA in status) info.karma = status[GamePackets.StatusUpdate_T.KARMA];

        this.playerStatusWnd.setStatus(info);
        this.mainWnd.detailStatusWnd.setStatus(info);
        this.inventoryWnd.setWeight(info.curLoad, info.maxLoad);
        this.inventoryWnd.setDwarvenCraft(info.hasDwarvenCraft);
        this.trainWnd.setStatus(info);
    }

    public setInventoryLimit(limit: number) { this.inventoryWnd.setLimit(limit); }
    public setWarehouseLimit(limit: number) { this.storeWnd.setLimit(limit); }

    public setMountable(canMount: boolean) { if (this.mainWnd) this.mainWnd.actionWnd.setMountable(canMount); }

    public setTarget(target: TargetStatus_T) { this.targetStatusWnd.setTarget(target); }

    public startFishing() { this.fishViewportWnd.start(); }
    public startFishingCombat(hp: number, time: number, mode: number, lureType: number) {
        this.fishViewportWnd.init(hp, time, lureType);
        this.fishViewportWnd.update(hp, time, false, mode, 3, 0);
    }
    public updateFishing(hp: number, time: number, goodUse: boolean, mode: number, animation: number, penalty: number) { this.fishViewportWnd.update(hp, time, goodUse, mode, animation, penalty); }
    public endFishing(isWin: boolean) { this.fishViewportWnd.end(isWin); }

    public showHeroList(entries: GamePackets.HeroEntry_T[]) { this.heroTowerWnd.show(entries, this.statusInfo ? !!this.statusInfo.isHero : undefined); }
    public openCommandChannel() { this.commandInfoWnd.open(); }
    public closeCommandChannel() { this.commandInfoWnd.closeChannel(); }
    public setCommandChannelInfo(info: GamePackets.CommandChannelInfo_T) { this.commandInfoWnd.setInfo(info); }

    public addChat(name: string, text: string, type: GamePackets.Say2_T) {
        if (type === GamePackets.Say2_T.PARTYROOM_ALL) this.partyRoomWnd.appendChat(`${name}: ${text}`);
        else if (type === GamePackets.Say2_T.PARTYROOM_COMMANDER || type === GamePackets.Say2_T.CHANNEL_ALL) this.commandInfoWnd.addChat(name, text, type);
        else this.chatWnd.addCreatureSay(name, text, type);
    }
    public addSystemMessage(text: string, color: number) { this.chatWnd.addSystemMessage(text, color); }

    public clearShortCuts() { this.shortCutWnd.clearSlots(); }
    public removeShortCut(slot: number) { this.shortCutWnd.setSlot(Math.trunc(slot / 12), slot % 12, null); }

    public setShortCut(shortcut: GamePackets.ShortCut_T, item: GamePackets.InventoryItem_T = null, isAutoSoulShot = false, macro: GamePackets.Macro_T = null) {
        const strings = this.strings;
        let entry: ShortcutEntry_T = null;

        switch (shortcut.type) {
            case GamePackets.ShortCutType_T.TYPE_ITEM:
                if (item) entry = { icon: strings.itemIcons[item.itemId], label: strings.itemNames[item.itemId], tooltip: `${strings.itemNames[item.itemId]} (${item.count.toLocaleString("en-US")})`, isAutoSoulShot };
                break;
            case GamePackets.ShortCutType_T.TYPE_SKILL: {
                const info = NCTooltip.shortcutSkill(strings, shortcut.id, shortcut.level);

                entry = { icon: strings.skillInfos[`${shortcut.id}:${shortcut.level}`]?.icon || strings.skillIcons[shortcut.id], label: info.title, tooltip: info, skillKey: `${shortcut.id}:${shortcut.level}` };
                break;
            }
            case GamePackets.ShortCutType_T.TYPE_ACTION: {
                const action = strings.actions[shortcut.id];

                entry = { icon: action.icon, label: action.command, tooltip: action.command };
                break;
            }
            case GamePackets.ShortCutType_T.TYPE_MACRO:
                if (macro) entry = { icon: `L2UI.MacroWnd.Macro_Icon${macro.icon + 1}`, label: macro.name, tooltip: macro.name, acronym: macro.acronym };
                break;
            case GamePackets.ShortCutType_T.TYPE_RECIPE: {
                const recipe = strings.recipes.find(recipe => recipe.id === shortcut.id);

                if (recipe) entry = { icon: strings.itemIcons[recipe.productId], label: strings.itemNames[recipe.itemId], tooltip: strings.itemNames[recipe.itemId] };
                break;
            }
            default: break;
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
