import * as GamePackets from "../network/game-packets";
import { EDrawType_T } from "../assets/unreal/un-aactor";
import type { AudioConfig_T, GameConfig_T } from "../assets/unreal/conf-files/un-conf-system";
import { Vector3 } from "three";
import { GAMMA_STEPS } from "../rendering/display-gamma";
import NWindowManager from "./nwindow-manager";
import { FontType_T, type default as NWindowCanvas } from "./nwindow-canvas";
import type BaseActor from "../base-actor";
import type RenderManager from "../rendering/render-manager";
import Nameplate from "../rendering/nameplate";
import GroundItemLabel from "../rendering/ground-item-label";
import ChatBalloon from "../rendering/chat-balloon";
import LandmarkComponent from "../rendering/components/landmark-component";
import NDomLayer from "./ndom";
import { type TargetStatus_T } from "./nc-target-status-wnd";
import { type ShortcutEntry_T } from "./nc-shortcut-wnd";
import NCCoolTimeIcon from "./nc-cool-time-icon";
import { listReplayFiles, readReplayFile, saveReplayFile, deleteReplayFile } from "../network/replay-files";
import L2ReplayFile from "../network/l2-replay-file";
import { type LobbyPawnLabel_T } from "./nc-lobby-wnd";
import { type PawnCreateSelection_T } from "./nc-pawn-create-wnd";
import { type InventoryEntry_T } from "./nc-inventory-wnd";
import { type GMClanInfo_T } from "./nc-gm-detail-status-wnd";
import { convertDDSTextureInfo } from "../assets/unreal/dds/dxt-decode";
import { type MenuButton_T } from "./nc-menu-wnd";
import { type MainTab_T } from "./nc-main-wnd";
import { type MapPartyMember_T } from "./nc-map-wnd";
import { UI_SCALES } from "./nc-option-wnd";
import { DialogType_T } from "./nc-dialog-box";
import type NetworkManager from "../network/network-manager";
import type AssetManager from "../assets/asset-manager";
import type { GameServerInfo_T } from "../network/login-client";
import { encodeCrestImage, PLEDGE_CREST_WIDTH, PLEDGE_CREST_HEIGHT, PLEDGE_LARGE_CREST_WIDTH, PLEDGE_LARGE_CREST_HEIGHT } from "../network/crest-encoder";
import NCTooltip from "./nc-tooltip";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";
import type { IEngineComponent } from "../game/components";
import Skin, { type AbnormalStatusWndView_T, type ChatWndView_T, type ChatFilterWndView_T, type CommandInfoWndView_T, type CommunityWndView_T, type DeliverWndView_T, type DialogBoxView_T, type FishViewportWndView_T, type GMClanWndView_T, type GMDetailStatusWndView_T, type GMInventoryWndView_T, type GMMagicSkillWndView_T, type GMQuestWndView_T, type GMStoreWndView_T, type GMWndView_T, type GMSnoopWndView_T, type GMPetitionWndView_T, type HennaInfoWndView_T, type HennaListWndView_T, type HeroTowerWndView_T, type InventoryWndView_T, type ItemEnchantWndView_T, type LoadingWndView_T, type LobbyWndView_T, type LoginServerWndView_T, type LoginWndView_T, type ReplayWndView_T, type MacroWndView_T, type MainWndView_T, type ManorShopWndView_T, type MapWndView_T, type TownMapWndView_T, type MatchWndView_T, type MenuWndView_T, type MessageWndView_T, type NPCHtmlViewerView_T, type ObserverWndView_T, type OlympiadControlWndView_T, type OlympiadPlayerWndView_T, type OlympiadTargetWndView_T, type OptionWndView_T, type PartyRoomMakingWndView_T, type PartyRoomWndView_T, type PawnCreateWndView_T, type PetStatusWndView_T, type PetWndView_T, type PetitionBeginWndView_T, type PetitionWndView_T, type PetitionFeedBackWndView_T, type PartyWndView_T, type CalcWndView_T, type TutorialViewerWndView_T, type TutorialBtnView_T, type SiegeInfoWndView_T, type ManorInfoWndView_T, type ManorSeedSettingWndView_T, type ManorCropSettingWndView_T, type ManorCropSellWndView_T, type XMasSealWndView_T, type PlayerStatusWndView_T, type PledgePowerWndView_T, type PrivateBuyWndView_T, type PrivateShopWndView_T, type RecipeBookWndView_T, type RecipeBuyListWndView_T, type RecipeBuyManufactureWndView_T, type RecipeManufactureWndView_T, type RecipeShopWndView_T, type RecipeTreeWndView_T, type RecordMarkView_T, type RestartMenuWndView_T, type SSQMainBoardView_T, type SelectDeliverWndView_T, type ShopWndView_T, type ShortCutWndView_T, type SkillWndView_T, type StoreWndView_T, type SummonedWndView_T, type SystemMenuWndView_T, type TargetStatusWndView_T, type TradeWndView_T, type TrainWndView_T, type VIPShopWndView_T, type ZoneTitleWndView_T } from "./skin";
import type GameManager from "../game/game-manager";

export type Nameplate_T = { actor: BaseActor, name: string, title: string, isNpc: boolean, hasQuestMark: boolean, isSummon: boolean, isAttackable: boolean, isSelf: boolean, isPartyMember: boolean, isPledgeMember: boolean, isDead: boolean, isSitting: boolean, isChairSitting: boolean, abnormalState: number, karma: number, pvpFlag: number, recommendations: number, nameColor: number, titleColor: number, clanCrestId: number, allyCrestId: number, isTarget: boolean, isMouseTarget: boolean, isChatRange: boolean, privateStoreType: GamePackets.PrivateStoreType_T, storeMessage: string, chatMessage: string };

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
const tmpAlarmPosition = new Vector3();
const tmpAlarmDelta = new Vector3();
const tmpAlarmExtent = new Vector3();
const tmpGaugeAnchor = new Vector3();
const tmpGaugeDown = new Vector3();
const tmpGaugePosition = new Vector3();
const tmpDropPoint = new Vector3();
const tmpMapDirection = new Vector3();

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

function getTitleColor(plate: Nameplate_T): number { // DrawTargetName 0x1051e746: nonzero NPC colour overrides green; summons blue, players cyan.
    if (plate.isNpc) return plate.isSummon ? 0xff9cb3ec : plate.titleColor || 0xffa9ec9c;

    return 0xffa2f9ec;
}

type Screen_T = "login" | "replay" | "servers" | "lobby" | "create" | "loading" | "world";
type SkillPointerDrag_T = { type: "skill" | "action", id: number, pointerId: number, icon: string, button: HTMLElement, isDragging: boolean };
type WindowGroupEntry_T = { element: HTMLElement, modalIndex: number };

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

export class NConsoleWnd implements IEngineComponent<GameManager> {
    protected manGame: GameManager;
    protected manNetwork: NetworkManager;
    protected nwindow: NWindowManager = null;
    protected layer: NDomLayer;
    protected playerStatusWnd: PlayerStatusWndView_T = null;
    protected petStatusWnd: PetStatusWndView_T = null;
    protected partyWnd: PartyWndView_T = null;
    protected calcWnd: CalcWndView_T = null;
    protected tutorialViewerWnd: TutorialViewerWndView_T = null;
    protected tutorialBtn: TutorialBtnView_T = null;
    protected siegeInfoWnd: SiegeInfoWndView_T = null;
    protected manorInfoWnd: ManorInfoWndView_T = null;
    protected manorSeedSettingWnd: ManorSeedSettingWndView_T = null;
    protected manorCropSettingWnd: ManorCropSettingWndView_T = null;
    protected manorCropSellWnd: ManorCropSellWndView_T = null;
    protected xmasSealWnd: XMasSealWndView_T = null;
    protected summonedStatusWnd: PetStatusWndView_T = null;
    protected abnormalStatusWnd: AbnormalStatusWndView_T = null;
    protected targetStatusWnd: TargetStatusWndView_T = null;
    protected restartMenuWnd: RestartMenuWndView_T = null;
    protected readonly skillCoolTimes = new Map<string, NCCoolTimeIcon>();
    protected shortCutWnd: ShortCutWndView_T = null;
    protected chatWnd: ChatWndView_T = null;
    protected chatFilterWnd: ChatFilterWndView_T = null;
    protected loginWnd: LoginWndView_T = null;
    protected replayWnd: ReplayWndView_T = null;
    protected replayRequest = 0;
    protected loginServerWnd: LoginServerWndView_T = null;
    protected lobbyWnd: LobbyWndView_T = null;
    protected pawnCreateWnd: PawnCreateWndView_T = null;
    protected loadingWnd: LoadingWndView_T = null;
    protected npcItemHtmlViewer: NPCHtmlViewerView_T = null;
    protected npcHtmlViewer: NPCHtmlViewerView_T = null;
    protected communityWnd: CommunityWndView_T = null;
    protected helpWnd: NPCHtmlViewerView_T = null;
    protected inventoryWnd: InventoryWndView_T = null;
    protected petWnd: PetWndView_T = null;
    protected summonedWnd: SummonedWndView_T = null;
    protected pledgePowerWnd: PledgePowerWndView_T = null;
    protected tradeWnd: TradeWndView_T = null;
    protected shopWnd: ShopWndView_T = null;
    protected manorShopWnd: ManorShopWndView_T = null;
    protected recipeBookWnd: RecipeBookWndView_T = null;
    protected recipeManufactureWnd: RecipeManufactureWndView_T = null;
    protected recipeTreeWnd: RecipeTreeWndView_T = null;
    protected recipeShopWnd: RecipeShopWndView_T = null;
    protected recipeBuyListWnd: RecipeBuyListWndView_T = null;
    protected recipeBuyManufactureWnd: RecipeBuyManufactureWndView_T = null;
    protected hennaListWnd: HennaListWndView_T = null;
    protected hennaInfoWnd: HennaInfoWndView_T = null;
    protected ssqMainBoard: SSQMainBoardView_T = null;
    protected itemEnchantWnd: ItemEnchantWndView_T = null;
    protected matchWnd: MatchWndView_T = null;
    protected partyRoomMakingWnd: PartyRoomMakingWndView_T = null;
    protected partyRoomWnd: PartyRoomWndView_T = null;
    protected fishViewportWnd: FishViewportWndView_T = null;
    protected heroTowerWnd: HeroTowerWndView_T = null;
    protected commandInfoWnd: CommandInfoWndView_T = null;
    protected trainWnd: TrainWndView_T = null;
    protected options: AssetManager["userConfig"];
    protected privateShopWnd: PrivateShopWndView_T = null;
    protected privateBuyWnd: PrivateBuyWndView_T = null;
    protected vipShopWnd: VIPShopWndView_T = null;
    protected previewShopWnd: ShopWndView_T = null;
    protected storeWnd: StoreWndView_T = null;
    protected gmSkillWnd: GMMagicSkillWndView_T = null;
    protected gmInventoryWnd: GMInventoryWndView_T = null;
    protected gmStoreWnd: GMStoreWndView_T = null;
    protected gmQuestWnd: GMQuestWndView_T = null;
    protected gmDetailWnd: GMDetailStatusWndView_T = null;
    protected gmClanWnd: GMClanWndView_T = null;
    protected gmWnd: GMWndView_T = null;
    protected gmDetailClan: GMClanInfo_T = null;
    protected cacheCrests = new Map<number, HTMLCanvasElement>();
    protected cacheServerCrests = new Map<number, Map<number, HTMLCanvasElement>>([[0, this.cacheCrests]]);
    protected observerWnd: ObserverWndView_T = null;
    protected olympiadControlWnd: OlympiadControlWndView_T = null;
    protected isOlympiadObserver = false;
    protected olympiadPlayerWnds: OlympiadPlayerWndView_T[] = [];
    protected olympiadAbnormalWnds: AbnormalStatusWndView_T[] = [];
    protected olympiadTargetWnd: OlympiadTargetWndView_T = null;
    protected windowGroup = 0;
    protected savedLandmarkEnabled: boolean = null;
    protected readonly savedWindowGroups: WindowGroupEntry_T[][] = [[], [], []];
    protected deliverWnd: DeliverWndView_T = null;
    protected selectDeliverWnd: SelectDeliverWndView_T = null;
    protected inventory: GamePackets.InventoryItem_T[] = [];
    protected menuWnd: MenuWndView_T = null;
    protected mainWnd: MainWndView_T = null;
    protected skillWnd: SkillWndView_T = null;
    protected mapWnd: MapWndView_T = null;
    protected townMapWnd: TownMapWndView_T = null;
    protected macroWnd: MacroWndView_T = null;
    protected systemMenuWnd: SystemMenuWndView_T = null;
    protected gmPetitionWnd: GMPetitionWndView_T = null;
    protected gmSnoopWnds: GMSnoopWndView_T[] = [];
    protected petitionBeginWnd: PetitionBeginWndView_T = null;
    protected petitionWnd: PetitionWndView_T = null;
    protected petitionFeedBackWnd: PetitionFeedBackWndView_T = null;
    protected optionWnd: OptionWndView_T = null;
    protected zoneTitleWnd: ZoneTitleWndView_T = null;
    protected recordMark: RecordMarkView_T = null;
    protected messageWnd: MessageWndView_T = null;
    protected dialogBox: DialogBoxView_T = null;
    protected yesNoDialogBox: DialogBoxView_T = null;
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
    protected pickupLabel: GroundItemLabel = null;

    protected manRender: RenderManager;

    public constructor(protected readonly skin: Skin = new Skin()) { }

    public setParent(parent: GameManager): this { this.manGame = parent; return this; }
    public getParent(): GameManager { return this.manGame; }
    public isCreated() { return this.nwindow !== null; }

    public onEngineTick(_currentTime: number, deltaTime: number): void { if (this.nwindow) this.tick(deltaTime); }
    public onAfterEngineTick(_currentTime: number, _deltaTime: number): void { if (this.nwindow) this.render(); }

    public create() {
        const network = this.manGame.getComponent("network"), asset = this.manGame.getComponent("asset"), render = this.manGame.getComponent("render");

        this.manNetwork = network;
        this.options = { ...asset.userConfig, game: { ...asset.userConfig.game }, audio: { ...asset.userConfig.audio }, display: { ...asset.userConfig.display } };
        this.manRender = render;
        this.nwindow = new NWindowManager(asset, this.skin.textures);
        this.layer = new NDomLayer(this.nwindow);
        this.applyUIScale(Number(localStorage.getItem("option:UIScale") ?? 1));
        this.strings = this.nwindow.strings;
        for (const type of ["keydown", "keyup", "mousedown", "mouseup", "mousemove"])
            window.addEventListener(type, (event: KeyboardEvent | MouseEvent) => {
                this.inputCtrl = event.ctrlKey;
                this.inputShift = event.shiftKey;
                if (type === "mousedown" && (event as MouseEvent).button === 0) network.resetMacros();
                if (type === "keydown" && !event.altKey && this.screen === "world" && this.chatWnd.isInputFocused()) {
                    const key = (event as KeyboardEvent).key;

                    if (!/^F\d+$/.test(key) && !["PageUp", "PageDown", "Insert", "PrintScreen"].includes(key)) network.resetMacros(); // NWindow 0x10076242..0x1007626c, before edit dispatch 0x1007f80d.
                }
            }, true);

        const replayInput = (event: KeyboardEvent) => {
            let key: number;

            switch (event.code) {
                case "Escape": key = 27; break;
                case "Space": key = 32; break;
                case "NumpadAdd": key = 107; break;
                case "NumpadSubtract": key = 109; break;
                default: return;
            }
            if (key !== 27 && this.screen !== "world" || !network.inputReplay(key, event.type === "keydown" ? 1 : 3)) return;

            event.preventDefault();
            event.stopImmediatePropagation();
        };

        window.addEventListener("keydown", replayInput, true);
        window.addEventListener("keyup", replayInput, true);
        window.addEventListener("keydown", event => { // UL2Console 0x100760c4..0x100760e1.
            if (this.screen === "world") this.shortCutWnd.onKeyDown(event);
        }, true);
        window.addEventListener("keydown", event => { // UL2Console 0x100760e7..0x10076126.
            if (event.key !== "Escape" || this.screen !== "world") return;
            if (asset.playerController.scriptProperties.get("bCameraWalking")) return;

            event.preventDefault();
            network.cancelTarget();
        }, true);
        window.addEventListener("keydown", event => {
            const target = event.target as HTMLElement;

            if (event.key !== "Enter" || this.screen !== "lobby" || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || !this.dialogBox.element.hidden || !this.yesNoDialogBox.element.hidden) return;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

            event.preventDefault();
            event.stopPropagation();
            this.lobbyWnd.gameStart();
        }, true);
        window.addEventListener("keydown", event => {
            const target = event.target as HTMLElement;

            if (event.key !== "Enter" || this.screen !== "world" || this.chatWnd.isInputFocused() || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

            event.preventDefault();
            this.chatWnd.focusInput();
        });
        window.addEventListener("keydown", event => {
            const target = event.target as HTMLElement;

            if (asset.playerController.isEnterChatting || this.screen !== "world" || event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;
            if (this.chatWnd.isInputFocused() || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
            if (event.key === " " && target.closest('[role="checkbox"], [role="tab"], [role="button"], [role="combobox"]')) return;

            event.stopPropagation();
            this.chatWnd.focusInput();
        }, true);
        window.addEventListener("keydown", event => {
            if (this.screen !== "world" || this.windowGroup !== 0 || !event.altKey || !["KeyG", "KeyO"].includes(event.code) || !this.statusInfo || !(this.statusInfo.gmLevel > 0 && this.statusInfo.gmLevel < 7)) return;

            event.preventDefault();
            event.stopPropagation();
            if (event.code === "KeyG") this.gmWnd.toggle();
            else this.gmPetitionWnd.setVisible(true);
        }, true);
        window.addEventListener("resize", () => this.placeScreens());
        window.addEventListener("dragover", event => this.onSkillDrop(event));
        window.addEventListener("drop", event => this.onSkillDrop(event));
        window.addEventListener("pointerdown", event => this.onSkillPointerDown(event), true);
        window.addEventListener("pointermove", event => this.onSkillPointerMove(event), true);
        window.addEventListener("pointerup", event => this.onSkillPointerUp(event), true);
        window.addEventListener("pointercancel", event => this.onSkillPointerCancel(event), true);
        window.addEventListener("blur", () => {
            this.inputCtrl = this.inputShift = false;
            this.endSkillPointerDrag();
        });
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
        this.loadOptions();
    }

    public async setStrings(strings: GameStrings_T) {
        this.strings = strings;
        this.nwindow.strings = strings;
        await this.nwindow.loadTrueFonts();
        if (this.mainWnd) void this.mainWnd.actionWnd.setActions(strings);
        if (this.mainWnd) void this.mainWnd.questWnd.setStrings(strings);
        if (this.mainWnd) this.mainWnd.clanWnd.setStrings(strings);
        if (this.gmClanWnd) this.gmClanWnd.setStrings(strings);
        if (this.petWnd) void this.petWnd.setActions(strings);
        if (this.summonedWnd) void this.summonedWnd.setActions(strings);
        this.nwindow.invalidate();
    }

    public getStrings() { return this.strings; }
    public addPartyMember(member: GamePackets.PartyMember_T, leaderId: number, lootType: number) { this.partyWnd.addMember(member, leaderId, lootType); }
    public updatePartyMember(member: GamePackets.PartyMember_T) { this.partyWnd.updateMember(member); }
    public deletePartyMember(name: string) { this.partyWnd.deleteMember(name); }
    public deleteAllPartyMembers() { this.partyWnd.deleteAll(); }
    public showCalculator(itemId: number) { if (itemId === 4393) this.calcWnd.show(); } // NWindow 0x10069840 only opens for the Calculator item
    public async showXMasSeal(itemId: number) { await this.xmasSealWnd.toggle(itemId); }
    public showSiegeInfo(info: GamePackets.SiegeInfo_T) { this.siegeInfoWnd.show(info, this.manNetwork.actors.userInfo.clanId); }
    public showManorSeedInfo(info: GamePackets.ManorSeedInfo_T, manors: GamePackets.ManorEntry_T[]) { this.manorInfoWnd.showSeedInfo(info, manors); }
    public showManorCropInfo(info: GamePackets.ManorCropInfo_T, manors: GamePackets.ManorEntry_T[]) { this.manorInfoWnd.showCropInfo(info, manors); }
    public showManorSeedSetting(settings: GamePackets.ManorSeedSettings_T) { this.manorSeedSettingWnd.show(settings); }
    public showManorCropSetting(settings: GamePackets.ManorCropSettings_T) { this.manorCropSettingWnd.show(settings); }
    public showManorDefaultInfo(info: GamePackets.ManorDefaultInfo_T) { this.manorInfoWnd.showDefaultInfo(info); }
    public showManorSellCropList(info: GamePackets.ManorSellCropList_T) { this.manorCropSellWnd.showSellCropList(info); }
    public showManorProcureCropDetail(detail: GamePackets.ManorProcureCropDetail_T) { this.manorCropSellWnd.changeWnd.showDetail(detail); }
    public addSiegeClans(isDefender: boolean, list: GamePackets.SiegeClanList_T) { this.siegeInfoWnd.addClans(isDefender, list.clans); }

    public setPetInfo(info: GamePackets.PetStatus_T) { this.petWnd.setInfo(info); this.summonedWnd.setInfo(info); this.petStatusWnd.setInfo(info); this.summonedStatusWnd.setInfo(info); }

    public showPetStatus(statusType: number) {
        if (this.screen !== "world" && this.screen !== "loading") return;

        this.prepareWorld();
        (statusType === 1 ? this.summonedStatusWnd : this.petStatusWnd).showStatus();
    }

    public setPetStatusEffects(spelled: GamePackets.PartySpelled_T) {
        if (spelled.type === GamePackets.PartySpelledType_T.PLAYER) this.partyWnd.setEffects(spelled.objectId, spelled.effects);
        else if (spelled.type === GamePackets.PartySpelledType_T.PET) this.petStatusWnd.setEffects(spelled.effects);
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

        if (this.screen !== "world" || !skillType && !actionType) return;

        const slot = this.getShortCutSlot(event.clientX, event.clientY);

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
            this.nwindow.setCursor(`url(${this.layer.getWrapUrl(drag.icon)}) 16 16, default`);
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
        if (event.target instanceof Element && event.target.closest(".ndom-layer") && !this.shortCutWnd.element.contains(event.target)) return;

        event.preventDefault();
        this.registerSkillDrop(drag.type, drag.id, event.clientX, event.clientY);
    }

    protected onSkillPointerCancel(event: PointerEvent) {
        if (this.skillPointerDrag?.pointerId === event.pointerId) this.endSkillPointerDrag();
    }

    protected endSkillPointerDrag() {
        if (!this.skillPointerDrag) return;

        if (this.skillPointerDrag.type === "skill") this.skillWnd.clearSelection();
        else if (this.mainWnd.element.contains(this.skillPointerDrag.button)) this.mainWnd.actionWnd.clearSelection();
        this.skillPointerDrag = null;
        this.nwindow.setCursor("");
        document.documentElement.classList.remove("ndom-item-drag");
    }

    protected getShortCutSlot(clientX: number, clientY: number) {
        const target = document.elementFromPoint(clientX, clientY), rect = this.shortCutWnd.element.getBoundingClientRect();

        if (!target || !this.shortCutWnd.element.contains(target)) return -1;

        return this.shortCutWnd.getSlotAt(this.layer.toUI(clientX - rect.left), this.layer.toUI(clientY - rect.top));
    }

    protected registerSkillDrop(type: "skill" | "action" | "item" | "petItem" | "macro" | "recipe", id: number, clientX: number, clientY: number) {
        if (this.screen !== "world") return false;

        const slot = this.getShortCutSlot(clientX, clientY);

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

        await this.nwindow.ready;

        await this.layer.loadTextures(this.skin.getTextures(this.strings));

        const network = this.manNetwork, render = this.manRender;

        this.playerStatusWnd = this.skin.createPlayerStatusWnd(this.layer);
        this.petStatusWnd = this.skin.createPetStatusWnd(this.layer, 2);
        this.partyWnd = this.skin.createPartyWnd(this.layer);
        this.calcWnd = this.skin.createCalcWnd(this.layer);
        this.xmasSealWnd = this.skin.createXMasSealWnd(this.layer);
        this.siegeInfoWnd = this.skin.createSiegeInfoWnd(this.layer);
        this.manorInfoWnd = this.skin.createManorInfoWnd(this.layer);
        this.manorInfoWnd.onBypass = command => network.bypass(command);
        this.manorSeedSettingWnd = this.skin.createManorSeedSettingWnd(this.layer);
        this.manorCropSettingWnd = this.skin.createManorCropSettingWnd(this.layer);
        for (const wnd of [this.manorSeedSettingWnd, this.manorCropSettingWnd]) {
            wnd.setAlertHandler(text => this.dialogBox.show(text, DialogType_T.OK, null, true, 0, 0, true));
            wnd.onConfirm = (text, onOk) => this.dialogBox.show(text, DialogType_T.OK_CANCEL, isOk => { if (isOk) onOk(); }, true);
        }
        this.manorSeedSettingWnd.onSubmit = (manorId, items) => network.setManorSeeds(manorId, items);
        this.manorCropSettingWnd.onSubmit = (manorId, items) => network.setManorCrops(manorId, items);
        this.manorCropSellWnd = this.skin.createManorCropSellWnd(this.layer);
        this.manorCropSellWnd.onBypass = command => network.bypass(command);
        this.manorCropSellWnd.onProcure = items => network.procureCrops(items);
        this.siegeInfoWnd.setCrestGetter((clanId, isAlly) => { const info = network.community.pledgeInfos.get(clanId); return info ? isAlly ? info.allyCrest : info.crest : null; });
        this.siegeInfoWnd.onRequestList = (castleId, isDefender) => isDefender ? network.requestSiegeDefenderList(castleId) : network.requestSiegeAttackerList(castleId);
        this.siegeInfoWnd.onParticipate = (castleId, isDefender) => this.siegeConfirm(isDefender ? 668 : 667, this.strings.residences[castleId], () => network.requestJoinSiege(castleId, !isDefender, true)); // 0x1010ac40
        this.siegeInfoWnd.onCancelApplication = (castleId, isDefender) => this.siegeConfirm(669, this.strings.residences[castleId], () => network.requestJoinSiege(castleId, !isDefender, false)); // 0x1010ad20
        this.siegeInfoWnd.onApprove = (castleId, clan) => this.siegeConfirm(671, clan.name, () => network.confirmSiegeWaitingList(castleId, clan.clanId, true)); // 0x1010ae00
        this.siegeInfoWnd.onRefuse = (castleId, clan) => this.siegeConfirm(670, clan.name, () => network.confirmSiegeWaitingList(castleId, clan.clanId, false)); // 0x1010af20
        this.summonedStatusWnd = this.skin.createPetStatusWnd(this.layer, 1);
        this.abnormalStatusWnd = this.skin.createAbnormalStatusWnd(this.layer);
        this.targetStatusWnd = this.skin.createTargetStatusWnd(this.layer);
        this.restartMenuWnd = this.skin.createRestartMenuWnd(this.layer);
        this.shortCutWnd = this.skin.createShortCutWnd(this.layer, this.skillCoolTimes);
        this.chatWnd = this.skin.createChatWnd(this.layer);
        this.observerWnd = this.skin.createObserverWnd(this.layer);
        this.observerWnd.onReturn = () => network.observerReturn();
        this.chatFilterWnd = this.skin.createChatFilterWnd(this.layer);
        this.chatWnd.onOptions = index => this.chatFilterWnd.show(index, this.chatWnd.getFilter(index));
        this.chatFilterWnd.onApply = (index, filter) => this.chatWnd.setFilter(index, filter);
        this.olympiadPlayerWnds = [this.skin.createOlympiadPlayerWnd(this.layer, 1), this.skin.createOlympiadPlayerWnd(this.layer, 2)];
        this.olympiadAbnormalWnds = [this.skin.createAbnormalStatusWnd(this.layer), this.skin.createAbnormalStatusWnd(this.layer)];
        this.olympiadTargetWnd = this.skin.createOlympiadTargetWnd(this.layer);
        for (let i = 0; i < 2; i++) {
            const player = this.olympiadPlayerWnds[i], abnormal = this.olympiadAbnormalWnds[i].element;

            this.layer.place(abnormal, i === 0 ? 0 : Math.trunc(this.nwindow.canvas.width - parseFloat(player.element.style.width)), 47);
            player.onExpand = delta => this.layer.place(abnormal, parseFloat(abnormal.style.left), parseFloat(abnormal.style.top) + delta);
        }
        this.targetStatusWnd.onClose = () => network.cancelTarget();
        this.restartMenuWnd.onRestart = type => network.requestRestartPoint(type);
        this.shortCutWnd.onUse = (page, slot, ctrl, shift) => network.useShortCut(page, slot, ctrl, shift);
        this.shortCutWnd.onMove = (page, slot, targetPage, targetSlot) => network.moveShortCut(page, slot, targetPage, targetSlot);
        this.shortCutWnd.onDelete = (page, slot) => network.deleteShortCut(page, slot);
        this.shortCutWnd.onDrop = (page, slot, x, y) => this.macroWnd.dropCommand(`/${this.getStrings().commands[27]} ${page + 1} ${slot + 1}`, x * this.nwindow.canvas.cssScale, y * this.nwindow.canvas.cssScale);
        this.shortCutWnd.onDragMove = (x, y) => this.macroWnd.highlightCommand(x * this.nwindow.canvas.cssScale, y * this.nwindow.canvas.cssScale);
        this.shortCutWnd.onDrag = entry => {
            this.nwindow.setCursor(entry ? `url(${this.layer.getWrapUrl(entry.icon)}) 16 16, default` : "");
            document.documentElement.classList.toggle("ndom-item-drag", !!entry);
        };
        this.shortCutWnd.onAutoSoulShot = (page, slot) => network.toggleAutoSoulShot(page, slot);
        this.playerStatusWnd.onClick = shift => network.requestAction(render.player, shift);
        this.chatWnd.onSend = (text, type, target) => network.say(text, type, target);
        this.chatWnd.onBuildCommand = command => network.sendBypassBuildCmd(command);
        this.chatWnd.onCommand = (command, isShift) => network.execCommand(command, isShift);
        this.chatWnd.setSystemMsgWnd(this.options.game.systemMsgWnd);
        this.chatWnd.setOldChatting(this.options.game.oldChatting);
        this.chatWnd.setSystemMessageFilters(this.options.game.systemMsgWndDamage, this.options.game.systemMsgWndExpendableItem);

        await network.getParent().getComponent("ui").createStatsWindow(this.layer);

        const consoleWindows = new Set(this.layer.root.children);

        this.loginWnd = this.skin.createLoginWnd(this.layer);
        this.loginWnd.onLogin = (account, password) => void network.connectLogin(account, password);
        this.loginWnd.auth.onError = text => this.showMessage(text);
        this.loginWnd.loginFunction.onOption = index => { if (index === 2) this.optionWnd.toggle(); else if (index === 4) void this.showReplayList(); };

        this.replayWnd = this.skin.createReplayWnd(this.layer);
        this.replayWnd.onCancel = () => { this.replayRequest++; this.showLogin(); };
        this.replayWnd.onPlay = (name, lockCamera, showChat) => void this.playReplayFile(name, lockCamera, showChat);
        this.replayWnd.onDelete = name => void this.removeReplayFile(name);
        this.replayWnd.onImport = files => void this.importReplayFiles(files);

        this.loginServerWnd = this.skin.createLoginServerWnd(this.layer);
        this.loginServerWnd.onSelect = serverId => void network.connectGame(serverId);
        this.loginServerWnd.onCancel = () => network.cancelLogin();
        this.loginServerWnd.serverInfo.viewer.onLink = path => void this.showServerHelp(path.split("\\").pop());
        this.loginServerWnd.serverInfo.viewer.onFile = path => void this.showServerHelp(path.split("\\").pop());
        void this.showServerHelp("server_help.htm");

        this.lobbyWnd = this.skin.createLobbyWnd(this.layer);
        this.lobbyWnd.onSelect = index => network.previewCharacter(index);
        this.lobbyWnd.onStart = index => network.selectCharacter(index);
        this.lobbyWnd.onCreate = () => network.requestNewCharacter();
        this.lobbyWnd.onDelete = index => this.confirm(this.formatSystemMessage(78, this.characterNames[index]), () => network.deleteCharacter(index), 78);
        this.lobbyWnd.onRestore = index => this.confirm(this.nwindow.getSystemMessage(1555), () => network.restoreCharacter(index), 1555);
        this.lobbyWnd.onRelogin = () => network.relogin();
        this.lobbyWnd.onSystemMessage = id => this.showMessage(this.nwindow.getSystemMessage(id));

        this.pawnCreateWnd = this.skin.createPawnCreateWnd(this.layer);
        this.pawnCreateWnd.onCreate = (name, selection) => this.createCharacter(name, selection);
        this.pawnCreateWnd.onBack = () => network.cancelCreate();
        this.pawnCreateWnd.onChange = selection => network.previewCreate(selection);
        this.pawnCreateWnd.onRotate = direction => network.rotateCreatePreview(direction);
        this.pawnCreateWnd.onZoom = isIn => network.zoomCreatePreview(isIn);

        this.loadingWnd = this.skin.createLoadingWnd(this.layer);
        for (const wnd of [this.loginWnd, this.loginServerWnd, this.lobbyWnd, this.pawnCreateWnd, this.loadingWnd]) this.layer.setBackground(wnd.element);

        this.messageWnd = this.skin.createMessageWnd(this.layer);
        this.dialogBox = this.skin.createDialogBox(this.layer);
        this.yesNoDialogBox = this.skin.createDialogBox(this.layer);
        const godWindows = new Set(Array.from(this.layer.root.children).filter(wnd => !consoleWindows.has(wnd)));

        this.npcHtmlViewer = this.skin.createNPCHtmlViewer(this.layer);
        this.npcHtmlViewer.onBypass = command => network.bypass(command);
        this.npcHtmlViewer.onLink = path => network.link(path);
        this.npcHtmlViewer.onFile = path => { void this.loadHtmlFile(this.npcHtmlViewer, path); };
        this.npcHtmlViewer.onConfirm = (text, onOk) => this.confirmLink(text, onOk);
        this.tutorialViewerWnd = this.skin.createTutorialViewerWnd(this.layer);
        this.tutorialViewerWnd.onLink = link => network.tutorialLink(link);
        this.tutorialViewerWnd.onPassCmd = command => network.tutorialPassCmd(command);
        this.tutorialViewerWnd.onFile = path => { void this.loadHtmlFile(this.tutorialViewerWnd, path); };
        this.tutorialBtn = this.skin.createTutorialBtn(this.layer);
        this.tutorialBtn.onPress = id => network.tutorialQuestionMark(id);
        this.npcItemHtmlViewer = this.skin.createNPCHtmlViewer(this.layer);
        this.npcItemHtmlViewer.onBypass = command => network.bypass(command);
        this.npcItemHtmlViewer.onLink = path => network.link(path);
        this.npcItemHtmlViewer.onFile = path => { void this.loadHtmlFile(this.npcItemHtmlViewer, path); };
        this.npcItemHtmlViewer.onConfirm = (text, onOk) => this.confirmLink(text, onOk);
        this.communityWnd = this.skin.createCommunityWnd(this.layer);
        this.communityWnd.onRequest = () => network.showBoard();
        this.communityWnd.onAction = target => this.communityWnd.viewer.dispatchCommand(target);
        this.communityWnd.viewer.onBypass = command => network.bypass(command);
        this.communityWnd.viewer.onWrite = (kind, arg1, arg2, arg3, arg4, arg5) => network.writeBoard(kind, arg1, arg2, arg3, arg4, arg5);
        this.communityWnd.viewer.onVariableError = id => this.clanError(id);
        this.communityWnd.viewer.isInvalidVariableName = value => !this.nwindow.canvas.hasGlyphs(value);
        this.communityWnd.viewer.onLink = path => network.link(path);
        this.communityWnd.viewer.onConfirm = (text, onOk) => this.confirmLink(text, onOk);
        this.communityWnd.viewer.onFile = async path => {
            const html = await this.manNetwork.getParent().getComponent("asset").getL2Text(path.replace(/^\.\.[\\/]L2text[\\/]/i, ""));

            if (this.screen === "world" && this.communityWnd.isVisible()) await this.communityWnd.viewer.setHtml(html);
        };
        this.helpWnd = this.skin.createNPCHtmlViewer(this.layer, 311, 145, "L2UI_ch3.NpcWnd.Npc2_back");
        this.helpWnd.onLink = path => network.link(path);
        this.helpWnd.onFile = path => { void this.loadHtmlFile(this.helpWnd, path); };
        this.inventoryWnd = this.skin.createInventoryWnd(this.layer);
        this.petWnd = this.skin.createPetWnd(this.layer, this.inventoryWnd);
        this.summonedWnd = this.skin.createSummonedWnd(this.layer, this.inventoryWnd);
        this.summonedWnd.onAction = (id, ctrl, shift) => network.useAction(id, ctrl, shift);
        this.petWnd.onUseItem = objectId => network.usePetItem(objectId);
        this.petWnd.onAction = (id, ctrl, shift) => network.useAction(id, ctrl, shift);
        this.petWnd.onGetItem = item => this.transferPetItem(item, false);
        this.petWnd.onRename = () => this.renamePet();
        this.petWnd.onHideBag = owner => {
            for (const dialog of [this.dialogBox, this.yesNoDialogBox])
                if (dialog.owner === owner || dialog.owner === this.petWnd.element && !this.petWnd.isVisible()) dialog.hide();
        };
        this.petWnd.onDropItem = (objectId, clientX, clientY) => this.registerSkillDrop("petItem", objectId, clientX, clientY);
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
            if (this.registerSkillDrop("item", objectId, clientX, clientY)) return true;
            if (target && target.closest(".ndom-window")) return false;
            if (this.screen !== "world" || !network.getParent().getComponent("input").traceScreenPoint(clientX, clientY, tmpDropPoint)) return false;

            this.dropInventoryItem(item, tmpDropPoint);
            return true;
        };
        this.recipeBookWnd = this.skin.createRecipeBookWnd(this.layer);
        this.recipeBookWnd.onOpen = id => network.requestRecipeItemMakeInfo(id);
        this.recipeBookWnd.onDelete = recipe => {
            this.dialogBox.show(this.formatSystemMessage(74, this.strings.itemNames[recipe.itemId]), DialogType_T.OK_CANCEL, accepted => { if (accepted) network.destroyRecipe(recipe.id); }, true, 0, 74);
            this.dialogBox.owner = this.recipeBookWnd.getGrid();
        };
        this.recipeBookWnd.onDrop = (id, x, y) => {
            this.registerSkillDrop("recipe", id, x, y);
        };
        this.recipeBookWnd.onHide = () => { if (this.dialogBox.owner === this.recipeBookWnd.getGrid()) this.dialogBox.hide(); };
        this.recipeBookWnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
        this.recipeBookWnd.onTooltip = (recipe, button, isDetailed) => this.inventoryWnd.showTooltip({ objectId: recipe.id, itemId: recipe.itemId, name: this.strings.itemNames[recipe.itemId], icon: this.strings.itemIcons[recipe.productId], count: 0, enchant: 0, customType1: 0, customType2: 0, itemClass: -1, bodyPart: 0, info: this.strings.itemInfos[recipe.itemId], slot: -1, isQuest: false, isMoney: false }, button, isDetailed);
        this.recipeManufactureWnd = this.skin.createRecipeManufactureWnd(this.layer);
        this.recipeManufactureWnd.onCreate = id => network.makeRecipeItem(id);
        this.recipeManufactureWnd.onBack = isDwarven => network.openRecipeBook(isDwarven);
        this.recipeTreeWnd = this.skin.createRecipeTreeWnd(this.layer);
        this.recipeManufactureWnd.onTree = recipe => {
            if (this.recipeTreeWnd.isVisible()) this.recipeTreeWnd.setVisible(false);
            else void this.recipeTreeWnd.show(recipe, this.inventory);
        };
        this.recipeManufactureWnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
        this.recipeManufactureWnd.onTooltip = (material, button) => this.inventoryWnd.showTooltip({ objectId: material.itemId, itemId: material.itemId, name: this.strings.itemNames[material.itemId], icon: this.strings.itemIcons[material.itemId], count: material.count, maxCount: material.required, enchant: 0, customType1: 0, customType2: 0, itemClass: -1, bodyPart: 0, info: this.strings.itemInfos[material.itemId], slot: -1, isQuest: false, isMoney: false }, button, true, 0x40);
        this.recipeShopWnd = this.skin.createRecipeShopWnd(this.layer);
        this.recipeShopWnd.onStart = entries => network.setRecipeShopList(entries);
        this.recipeShopWnd.onQuit = () => network.quitRecipeShopManage();
        this.recipeShopWnd.onCancel = () => network.cancelRecipeShopManage();
        this.recipeShopWnd.onMessage = () => {
            this.dialogBox.showText(this.nwindow.getSystemMessage(334), message => {
                if (message) network.setRecipeShopMessage(message);
                return true;
            }, network.getOwnRecipeShopMessage(), 294, 334);
        };
        this.recipeShopWnd.onPrice = row => {
            this.dialogBox.showQuantity(this.formatSystemMessage(963, this.strings.itemNames[row.recipe.itemId]), 0, this.strings.itemInfos[row.recipe.itemId].consumeType, (price, value) => {
                if (value) this.recipeShopWnd.transfer(row, price);
            }, id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id), true, 963);
            this.dialogBox.owner = this.recipeShopWnd.getGrid(0);
        };
        this.recipeShopWnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
        this.recipeShopWnd.onTooltip = (row, button, context, isDetailed) => {
            const recipe = row.recipe;

            this.inventoryWnd.showTooltip({ objectId: recipe.id, itemId: recipe.itemId, name: this.strings.itemNames[recipe.itemId], icon: this.strings.itemIcons[recipe.productId], count: 0, enchant: 0, customType1: 0, customType2: 0, itemClass: -1, bodyPart: 0, info: this.strings.itemInfos[recipe.itemId], slot: -1, isQuest: false, isMoney: false }, button, isDetailed, context, row.price, 1);
        };
        this.recipeBuyListWnd = this.skin.createRecipeBuyListWnd(this.layer);
        this.recipeBuyListWnd.onOpen = (objectId, recipeId) => network.requestRecipeShopMakeInfo(objectId, recipeId);
        this.recipeBuyManufactureWnd = this.skin.createRecipeBuyManufactureWnd(this.layer);
        this.recipeBuyManufactureWnd.onShopCreate = (objectId, recipeId, price) => network.makeRecipeShopItem(objectId, recipeId, price);
        this.recipeBuyManufactureWnd.onShopBack = objectId => network.recipeShopManagePrev(objectId);
        this.recipeBuyManufactureWnd.onTree = this.recipeManufactureWnd.onTree;
        this.recipeBuyManufactureWnd.onTooltip = this.recipeManufactureWnd.onTooltip;
        this.recipeBuyManufactureWnd.onHideTooltip = this.recipeManufactureWnd.onHideTooltip;
        for (const wnd of [this.recipeManufactureWnd, this.recipeBuyManufactureWnd]) {
            wnd.onSelect = () => { if (this.dialogBox.isOpen() && !this.dialogBox.isYesNo()) this.dialogBox.hide(); };
            wnd.onFocusDialog = () => { if (this.dialogBox.isOpen()) this.dialogBox.focus(); };
            wnd.onHide = () => { if (this.dialogBox.owner === wnd.getGrid()) this.dialogBox.hide(); };
        }
        this.hennaListWnd = this.skin.createHennaListWnd(this.layer);
        this.hennaListWnd.onOpen = (symbolId, isRemove) => {
            if (isRemove) network.requestHennaUnequipInfo(symbolId);
            else network.requestHennaItemInfo(symbolId);
        };
        this.itemEnchantWnd = this.skin.createItemEnchantWnd(this.layer);
        this.itemEnchantWnd.onConfirm = objectId => network.chooseInventoryItem(objectId);
        this.itemEnchantWnd.onTooltip = (item, button, isDetailed) => this.inventoryWnd.showTooltip(item, button, isDetailed);
        this.itemEnchantWnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
        this.ssqMainBoard = this.skin.createSSQMainBoard(this.layer);
        this.ssqMainBoard.onRequest = page => network.requestSSQStatus(page);
        this.hennaInfoWnd = this.skin.createHennaInfoWnd(this.layer);
        this.hennaInfoWnd.onBack = isRemove => {
            if (isRemove) network.requestHennaUnequipList();
            else network.requestHennaList();
        };
        this.hennaInfoWnd.onConfirm = (symbolId, isRemove) => {
            if (isRemove) network.unequipHenna(symbolId);
            else network.equipHenna(symbolId);
        };
        this.matchWnd = this.skin.createMatchWnd(this.layer);
        this.matchWnd.onConfig = (page, location, level) => network.requestPartyMatchConfig(page, location, level);
        this.matchWnd.onJoin = (roomId, location) => network.requestPartyMatchDetail(roomId, location);
        this.matchWnd.onCreate = () => this.partyRoomMakingWnd.showCreate(this.statusInfo.level, this.options.game.partyLooting);
        this.partyRoomMakingWnd = this.skin.createPartyRoomMakingWnd(this.layer);
        this.partyRoomMakingWnd.getLootType = () => this.options.game.partyLooting;
        this.partyRoomMakingWnd.onSubmit = settings => network.requestPartyMatchList(settings.roomId, settings.maxMembers, settings.minLevel, settings.maxLevel, settings.lootType, settings.title);
        this.partyRoomWnd = this.skin.createPartyRoomWnd(this.layer);
        this.partyRoomWnd.onSettings = detail => this.partyRoomMakingWnd.showEdit(detail, this.options.game.partyLooting);
        this.partyRoomWnd.onKick = objectId => network.oustFromPartyRoom(objectId);
        this.partyRoomWnd.onInvite = (name, lootType) => network.inviteToParty(name, lootType);
        this.partyRoomWnd.onTerminate = mode => {
            const detail = network.getPartyMatchDetail();

            if (mode === 1) network.dismissPartyRoom(detail.roomId);
            else network.withdrawPartyRoom(detail.roomId);
        };
        this.partyRoomWnd.onChat = text => { if (!this.chatWnd.dispatchCommand(text, this.inputShift)) network.say(text, GamePackets.Say2_T.PARTYROOM_ALL); };
        this.trainWnd = this.skin.createTrainWnd(this.layer);
        this.trainWnd.onInfo = (id, level) => network.requestEnchantSkillInfo(id, level);
        this.trainWnd.onEnchant = (id, level) => network.enchantSkill(id, level);
        this.trainWnd.onAquireInfo = (id, level, mode) => network.requestAquireSkillInfo(id, level, mode);
        this.trainWnd.onAquire = (id, level, mode) => network.aquireSkill(id, level, mode);
        this.manorShopWnd = this.skin.createManorShopWnd(this.layer);
        this.manorShopWnd.onQuantity = (side, item, allCount) => {
            this.dialogBox.showQuantity(this.formatSystemMessage(72, this.strings.itemNames[item.itemId]), allCount, this.strings.itemInfos[item.itemId].consumeType, count => {
                const current = this.manorShopWnd.getPressedItem(side);

                if (current && count > 0) this.manorShopWnd.transfer(side, current, Math.min(count, current.count));
            }, id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id), false, 72);
            this.dialogBox.owner = this.manorShopWnd.getGrid(side);
        };
        this.manorShopWnd.onSubmit = (isSell, listId, items) => {
            if (isSell) network.sellCrops(items.map(item => ({ objectId: item.objectId, itemId: item.itemId, count: item.count })), listId);
            else network.buySeeds(items.map(item => ({ itemId: item.itemId, count: item.count })), listId);
        };
        this.shopWnd = this.skin.createShopWnd(this.layer);
        this.privateShopWnd = this.skin.createPrivateShopWnd(this.layer);
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
            }, network.getPrivateStoreMsgSell(), 294, 334);
            this.dialogBox.owner = this.privateShopWnd.getGrid(0);
        };
        this.privateBuyWnd = this.skin.createPrivateBuyWnd(this.layer);
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
            }, network.getPrivateStoreMsgBuy(), 294, 334);
            this.dialogBox.owner = this.privateBuyWnd.getGrid(0);
        };
        this.vipShopWnd = this.skin.createVIPShopWnd(this.layer, this.inventoryWnd);
        this.vipShopWnd.onHide = () => network.clearMultiSell();
        this.vipShopWnd.onSelect = () => { if (this.dialogBox.isOpen() && this.dialogBox.owner === this.vipShopWnd.element) this.dialogBox.hide(); };
        this.vipShopWnd.onConfirm = (listId, entryId, amount) => {
            this.dialogBox.show(this.nwindow.getSystemMessage(1383), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.chooseMultiSell(listId, entryId, amount); }, true, 0, 1383);
            this.dialogBox.owner = this.vipShopWnd.element;
        };
        this.previewShopWnd = this.skin.createShopWnd(this.layer, true);
        this.storeWnd = this.skin.createStoreWnd(this.layer);
        this.gmSkillWnd = this.skin.createGMMagicSkillWnd(this.layer);
        this.gmInventoryWnd = this.skin.createGMInventoryWnd(this.layer);
        this.gmStoreWnd = this.skin.createGMStoreWnd(this.layer);
        this.gmQuestWnd = this.skin.createGMQuestWnd(this.layer);
        this.fishViewportWnd = this.skin.createFishViewportWnd(this.layer, (id, ...params) => this.formatSystemMessage(id, ...params));
        this.manRender.setViewportSceneCanvas(this.fishViewportWnd.getViewportCanvas());
        this.heroTowerWnd = this.skin.createHeroTowerWnd(this.layer);
        this.heroTowerWnd.onWriteWords = words => network.writeHeroWords(words);
        this.heroTowerWnd.onDiary = classId => network.bypass(`_diary?class=${classId}&page=1`);
        this.heroTowerWnd.setCrestGetter((crestId, isAlly) => network.getHeroCrest(crestId, isAlly));
        this.commandInfoWnd = this.skin.createCommandInfoWnd(this.layer);
        this.commandInfoWnd.onUpdate = () => network.userCommand(97);
        this.commandInfoWnd.onLeave = () => network.userCommand(96);
        this.commandInfoWnd.onOust = name => network.oustFromCommandChannel(name);
        this.commandInfoWnd.onSay = (text, type) => network.say(text, type);
        this.gmDetailWnd = this.skin.createGMDetailStatusWnd(this.layer);
        this.gmWnd = this.skin.createGMWnd(this.layer);
        this.gmWnd.onView = (target, kind) => [this.gmDetailWnd, this.gmClanWnd, this.gmSkillWnd, this.gmQuestWnd, this.gmInventoryWnd, this.gmStoreWnd][kind - 1].toggle(target);
        this.gmWnd.onCommand = command => network.sendBypassBuildCmd(command);
        this.gmWnd.onMessage = id => this.addSystemMessage(this.nwindow.getSystemMessage(id), this.strings.systemMessageColors[id]);
        this.gmWnd.onInfo = text => this.dialogBox.show(text, DialogType_T.OK, null);
        this.gmWnd.onConfirm = (id, target, onReply) => this.dialogBox.show(this.formatSystemMessage(id, target), DialogType_T.OK_CANCEL, onReply, true, 0, id);
        this.gmWnd.onServerTransfer = id => network.startGMServerTransfer(id);
        this.gmClanWnd = this.skin.createGMClanWnd(this.layer);
        this.gmClanWnd.onAction = (action, member) => this.clanAction(action, member);
        this.olympiadControlWnd = this.skin.createOlympiadControlWnd(this.layer);
        this.olympiadControlWnd.onStopObserving = () => network.endOlympiadObserver();
        this.olympiadControlWnd.onOtherGame = () => network.requestOlympiadMatchList();
        this.gmQuestWnd.onShowQuestList = () => network.requestQuestList();
        for (const wnd of [this.gmSkillWnd, this.gmInventoryWnd, this.gmStoreWnd, this.gmQuestWnd, this.gmDetailWnd, this.gmClanWnd]) wnd.onRequest = (target, kind) => network.gmCommand(target, kind);
        this.gmSkillWnd.skillWnd.onDragMove = event => this.macroWnd.highlightCommand(event.clientX, event.clientY);
        this.gmSkillWnd.skillWnd.onDragEnd = () => this.macroWnd.highlightCommand(-1, -1);
        this.gmStoreWnd.onQuantity = (side, item, maxCount) => {
            this.dialogBox.showQuantity(this.formatSystemMessage(72, this.strings.itemNames[item.itemId]), maxCount, this.strings.itemInfos[item.itemId].consumeType, count => this.gmStoreWnd.transferQuantity(side, count), id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id), false, 72);
            this.dialogBox.owner = this.gmStoreWnd.getGrid(side);
        };
        for (const wnd of [this.storeWnd, this.gmStoreWnd]) {
            wnd.onDrop = (side, target) => {
                for (const destination of [this.storeWnd, this.gmStoreWnd]) {
                    for (let targetSide = 0; targetSide < 2; targetSide++) {
                        const list = destination.getGrid(targetSide);

                        if (!(list.content.contains(target) || target === list)) continue;

                        wnd.setDestination(side, destination, targetSide);
                        return true;
                    }
                }
                return false;
            };
            wnd.onTransfer = () => this.storeWnd.updateFee();
        }
        this.deliverWnd = this.skin.createDeliverWnd(this.layer);
        this.selectDeliverWnd = this.skin.createSelectDeliverWnd(this.layer);
        this.selectDeliverWnd.onConfirm = objectId => network.requestPackageSendableItemList(objectId);
        for (const wnd of [this.shopWnd, this.previewShopWnd, this.storeWnd, this.deliverWnd, this.privateShopWnd, this.privateBuyWnd, this.manorShopWnd, this.gmStoreWnd]) {
            wnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
            wnd.onTooltip = (item, button, isDetailed, context) => this.inventoryWnd.showTooltip({ maxCount: wnd === this.privateBuyWnd ? this.privateBuyWnd.getMaxCount(item) : 0, objectId: item.objectId, itemId: item.itemId, name: this.strings.itemNames[item.itemId], icon: this.strings.itemIcons[item.itemId], count: wnd === this.privateBuyWnd ? this.privateBuyWnd.getTooltipCount(item) : item.count, enchant: item.enchantLevel, customType1: "customType1" in item ? item.customType1 : 0, customType2: item.customType2, itemClass: item.type2, bodyPart: item.bodyPart, info: this.strings.itemInfos[item.itemId], slot: -1, isQuest: item.type2 === GamePackets.ItemType2_T.TYPE2_QUEST, isMoney: item.type2 === GamePackets.ItemType2_T.TYPE2_MONEY }, button, isDetailed, context, item.price);
            wnd.onSelect = () => { if (this.dialogBox.isOpen() && !this.dialogBox.isYesNo()) this.dialogBox.hide(); };
            wnd.onFocusDialog = () => { if (this.dialogBox.isOpen()) this.dialogBox.focus(); };
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
                        }, id => { this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id); }, false, messageId);
                        this.dialogBox.owner = wnd.getGrid(side);
                    };

                    if (side === 1) { quantity(); return; }
                    this.dialogBox.showQuantity(this.nwindow.getSystemMessage(585), 0, this.strings.itemInfos[item.itemId].consumeType, price => {
                        const selected = wnd.getPressedItem(0);

                        if (!selected || price <= 0) return;
                        selected.price = price;
                        const reference = (selected as GamePackets.ShopItem_T & { referencePrice: number }).referencePrice;

                        if (reference > 0 && (price <= Math.trunc(reference / 5) || price >= (reference * 5 | 0))) {
                            this.dialogBox.show(this.nwindow.getSystemMessage(569), DialogType_T.OK_CANCEL, isOk => { if (isOk) quantity(); }, true, 0, 569);
                            this.dialogBox.owner = wnd.getGrid(0);
                        } else quantity();
                    }, id => { this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id); }, true, 585);
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
                        }, id => { this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id); }, true, 72);
                        this.dialogBox.owner = wnd.getGrid(side);
                    };

                    if (side === 1) { quantity(); return; }
                    this.dialogBox.showQuantity(this.formatSystemMessage(322, this.strings.itemNames[item.itemId]), 0, this.strings.itemInfos[item.itemId].consumeType, price => {
                        const selected = wnd.getPressedItem(0);

                        if (!selected || price <= 0) return;
                        selected.price = price;
                        const reference = (selected as GamePackets.ShopItem_T & { referencePrice: number }).referencePrice;

                        if (reference > 0 && (price <= Math.trunc(reference / 5) || price >= (reference * 5 | 0))) {
                            this.dialogBox.show(this.nwindow.getSystemMessage(569), DialogType_T.OK_CANCEL, isOk => { if (isOk) quantity(); }, true, 0, 569);
                            this.dialogBox.owner = wnd.getGrid(0);
                        } else quantity();
                    }, id => { this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id); }, true, 322);
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
                }, id => { this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id); }, false, 72);
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

                    this.dialogBox.show(this.nwindow.getSystemMessage(569), DialogType_T.OK_CANCEL, isOk => { if (isOk) send(); }, true, 0, 569);
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

                    this.dialogBox.show(this.nwindow.getSystemMessage(569), DialogType_T.OK_CANCEL, isOk => { if (isOk) send(); else wnd.setVisible(false); }, true, 0, 569);
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
                    }, true, 0, 1157);
                    this.dialogBox.owner = wnd.element;
                    return;
                }
                if (!isSell && wnd.getItems(0).some(stock => stock.count > 0 && items.filter(item => item.itemId === stock.itemId).reduce((sum, item) => sum + item.count, 0) > stock.count)) {
                    this.dialogBox.show(this.nwindow.getSystemMessage(1338), DialogType_T.OK, null, true, 0, 1338);
                    this.dialogBox.owner = wnd.element;
                    return;
                }
                if (isSell) network.sellItems(items.filter(item => item.count > 0).map(item => ({ objectId: item.objectId, itemId: item.itemId, count: item.count })));
                else network.buyItems(items.filter(item => item.count > 0).map(item => ({ itemId: item.itemId, count: item.count })));
                wnd.setVisible(false);
            };
        }
        this.tradeWnd = this.skin.createTradeWnd(this.layer);
        this.tradeWnd.onConfirm = isConfirmed => network.confirmTrade(isConfirmed);
        this.tradeWnd.onHideTooltip = () => this.inventoryWnd.hideTooltip();
        this.tradeWnd.onTooltip = (item, button, isDetailed) => {
            this.inventoryWnd.showTooltip({ objectId: item.objectId, itemId: item.itemId, name: this.strings.itemNames[item.itemId], icon: this.strings.itemIcons[item.itemId], count: item.count, enchant: item.enchantLevel, customType1: "customType1" in item ? item.customType1 : 0, customType2: item.customType2, itemClass: item.type2, bodyPart: item.bodyPart, info: this.strings.itemInfos[item.itemId], slot: -1, isQuest: item.type2 === GamePackets.ItemType2_T.TYPE2_QUEST, isMoney: item.type2 === GamePackets.ItemType2_T.TYPE2_MONEY }, button, isDetailed);
        };
        this.tradeWnd.onSelect = () => { if (this.dialogBox.isOpen() && !this.dialogBox.isYesNo()) this.dialogBox.hide(); };
        this.tradeWnd.onFocusDialog = () => { if (this.dialogBox.isOpen()) this.dialogBox.focus(); };
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
                }, id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id), false, 72);
                return;
            }

            network.addTradeItem(item.objectId, 1);
            if (isDrop) this.tradeWnd.clearSelection();
        };
        this.menuWnd = this.skin.createMenuWnd(this.layer);
        this.menuWnd.onSelect = (button: MenuButton_T) => {
            switch (button) {
                case "characterStatus": this.toggleCharacterStatus(); break;
                case "inventory": this.toggleInventory(); break;
                case "map": this.toggleMap(); break;
                case "system": this.toggleSystemMenu(); break;
                default: throw new Error(`Unknown menu button '${button}'.`);
            }
        };
        this.mainWnd = this.skin.createMainWnd(this.layer, this.skillCoolTimes, this.skin);
        this.pledgePowerWnd = this.skin.createPledgePowerWnd(this.layer);
        this.pledgePowerWnd.onSave = (objectId, power) => network.setMemberPledgePower(objectId, power);
        this.mainWnd.questWnd.onShow = () => network.requestQuestList();
        this.mainWnd.clanWnd.onAction = (action, member) => this.clanAction(action, member);
        this.mainWnd.questWnd.onAbort = id => this.showQuestAbort(id);
        this.mainWnd.questWnd.onHide = () => {
            if (this.dialogBox.owner === this.mainWnd.questWnd.element) this.dialogBox.hide();
        };
        this.skillWnd = this.mainWnd.skillWnd;
        this.skillWnd.onShow = () => network.requestSkillList();
        this.skillWnd.onUse = (id, ctrl, shift) => network.useSkill(id, ctrl, shift);
        this.mainWnd.actionWnd.onUse = (id, ctrl, shift) => network.useAction(id, ctrl, shift);
        void this.mainWnd.actionWnd.setActions(this.strings);
        void this.mainWnd.questWnd.setStrings(this.strings);
        void this.petWnd.setActions(this.strings);
        void this.summonedWnd.setActions(this.strings);
        this.mapWnd = this.skin.createMapWnd(this.layer);
        this.townMapWnd = this.skin.createTownMapWnd(this.layer);
        this.mainWnd.questWnd.onLocationChange = location => {
            const previous = this.mapWnd.getQuestLocation();

            this.mapWnd.setQuestLocation(location);
            if (location && (location.unk0 === 0 || previous && network.community.questArrowDestination === previous)) network.community.questArrowDestination = location;
            else if (!location && network.community.questArrowDestination === previous) network.community.questArrowDestination = null;
        };
        this.macroWnd = this.skin.createMacroWnd(this.layer);
        this.macroWnd.onSave = macro => network.makeMacro(macro);
        this.macroWnd.onUse = id => network.activateMacro(id);
        this.macroWnd.onDelete = macro => this.dialogBox.show(this.formatSystemMessage(828, macro.name), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.deleteMacro(macro.id); }, true, 0, 828);
        this.macroWnd.onError = id => { this.addSystemMessage(this.nwindow.getSystemMessage(id), this.strings.systemMessageColors[id]); network.playSystemMessageSound(id); };
        this.macroWnd.onHelp = () => { this.helpWnd.setVisible(!this.helpWnd.isVisible()); if (this.helpWnd.isVisible()) void this.loadHtmlFile(this.helpWnd, "help_macro.htm"); };
        this.macroWnd.onDrop = (id, x, y) => this.registerSkillDrop("macro", id, x, y);
        this.zoneTitleWnd = this.skin.createZoneTitleWnd(this.layer);
        this.recordMark = this.skin.createRecordMark(this.layer);
        const beforeOptions = new Set(this.layer.root.children);

        this.optionWnd = this.skin.createOptionWnd(this.layer);
        for (const wnd of this.layer.root.children)
            if (!beforeOptions.has(wnd)) godWindows.add(wnd);
        this.optionWnd.getOptions = () => this.getGameOptions();
        this.optionWnd.onApply = options => this.setGameOptions(options);
        this.optionWnd.getAudioOptions = () => this.getAudioOptions();
        this.optionWnd.onApplyAudio = options => this.setAudioOptions(options);
        this.optionWnd.getGamma = () => this.manRender.getDisplayGamma();
        this.optionWnd.onApplyGamma = gamma => this.setGamma(gamma);
        this.optionWnd.getPawnRange = () => this.manRender.getPawnRange();
        this.optionWnd.onApplyPawnRange = range => this.setPawnRange(range);
        this.optionWnd.canChangePartyLoot = () => !network.isInParty() && !this.partyRoomWnd.isVisible();
        this.optionWnd.getAntiAliasingLevels = () => this.manRender.getAntiAliasingLevels();
        this.optionWnd.getUIScale = () => this.nwindow.canvas.uiScale;
        this.optionWnd.getUIScales = () => UI_SCALES.filter(scale => { const [width, height] = this.nwindow.canvas.getScreenSize(scale); return scale <= 1 || scale === this.nwindow.canvas.uiScale || width >= 800 && height >= 600; });
        this.optionWnd.onApplyUIScale = scale => this.setUIScale(scale);
        this.optionWnd.onInitialize = () => {
            this.layer.cancelDrag();
            this.shortCutWnd.resetLayout();
            this.chatWnd.resetLayout();
            this.nwindow.resetWindowPositions();
            this.layer.resetWindowPositions();
            this.placeScreens();
        };
        this.gmPetitionWnd = this.skin.createGMPetitionWnd(this.layer);
        this.gmPetitionWnd.onSay = text => {
            // GetCommandType 0x1044c490: /// has a separate dispatch class only when followed by text.
            if (text.length > 2 && text.startsWith("//") && (text.length === 3 || !text.startsWith("///"))) network.execCommand(text);
            else if (!text.startsWith("/") && !text.startsWith("／")) network.say(text, GamePackets.Say2_T.PETITION_GM);
        };
        this.gmPetitionWnd.onBegin = () => network.sendBypassBuildCmd("startpet");
        this.gmPetitionWnd.onEnd = () => network.sendBypassBuildCmd("endpet");
        this.gmSnoopWnds = Array.from({ length: 4 }, () => {
            const window = this.skin.createGMSnoopWnd(this.layer);

            window.onQuit = objectId => network.snoopQuit(objectId);
            return window;
        });
        this.petitionFeedBackWnd = this.skin.createPetitionFeedBackWnd(this.layer);
        this.petitionFeedBackWnd.onSubmit = (rating, text) => network.votePetition(rating, text);
        this.petitionFeedBackWnd.onClose = () => this.petitionWnd.setEvaluationEnabled(false);
        this.petitionFeedBackWnd.onValidation = id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id);
        this.petitionWnd = this.skin.createPetitionWnd(this.layer);
        this.petitionWnd.onEvaluate = () => this.petitionFeedBackWnd.setVisible(true);
        this.petitionWnd.onSay = text => network.say(text, GamePackets.Say2_T.PETITION_PLAYER);
        this.petitionWnd.onCancel = () => network.cancelPetition();
        this.petitionBeginWnd = this.skin.createPetitionBeginWnd(this.layer, this.strings.petitionCategories);
        this.petitionBeginWnd.getHtml = path => network.getParent().getComponent("asset").getL2Text(path);
        this.petitionBeginWnd.onSubmit = (text, category) => {
            network.petition(text, category);
            this.petitionWnd.reset();
            this.petitionWnd.addString(`${this.nwindow.getSysString(708)} : ${text}`, 0xffdcdcdc);
        };
        this.petitionBeginWnd.onCancel = () => network.cancelPetition();
        this.petitionBeginWnd.onValidation = id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id);
        this.systemMenuWnd = this.skin.createSystemMenuWnd(this.layer);
        this.systemMenuWnd.onSelect = item => {
            switch (item) {
                case "community": this.communityWnd.toggle(); break;
                case "macro": this.macroWnd.setVisible(!this.macroWnd.isVisible()); break;
                case "help": void this.toggleHelp(); break;
                case "petition": this.petitionBeginWnd.setVisible(!this.petitionBeginWnd.isVisible()); break;
                case "options": this.optionWnd.toggle(); break;
                case "restart": this.dialogBox.show(this.nwindow.getSystemMessage(126), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.requestRestart(); }, true, 0, 126); break;
                case "exit": this.dialogBox.show(this.nwindow.getSystemMessage(125), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.logout(); }, true, 0, 125); break;
            }
        };

        godWindows.add(network.getParent().getComponent("ui").getStatsWindow());
        this.layer.setConsoleWindows(Array.from(this.layer.root.children).filter(wnd => !godWindows.has(wnd)) as HTMLElement[]);
        this.placeScreens();
        this.show(null);
    }

    protected getDOMWindows() { return [this.loginWnd, this.replayWnd, this.loginServerWnd, this.lobbyWnd, this.pawnCreateWnd, this.loadingWnd, this.npcHtmlViewer, this.tutorialViewerWnd, this.tutorialBtn, this.npcItemHtmlViewer, this.communityWnd, this.helpWnd, this.inventoryWnd, this.tradeWnd, this.shopWnd, this.manorShopWnd, this.recipeBookWnd, this.recipeManufactureWnd, this.recipeTreeWnd, this.recipeShopWnd, this.recipeBuyListWnd, this.recipeBuyManufactureWnd, this.hennaListWnd, this.hennaInfoWnd, this.ssqMainBoard, this.itemEnchantWnd, this.matchWnd, this.partyRoomMakingWnd, this.partyRoomWnd, this.heroTowerWnd, this.fishViewportWnd, this.commandInfoWnd, this.trainWnd, this.gmSkillWnd, this.gmInventoryWnd, this.gmStoreWnd, this.gmQuestWnd, this.gmDetailWnd, this.gmClanWnd, this.gmWnd, this.olympiadControlWnd, this.observerWnd, this.previewShopWnd, this.storeWnd, this.deliverWnd, this.privateShopWnd, this.privateBuyWnd, this.vipShopWnd, this.selectDeliverWnd, this.menuWnd, this.mainWnd, this.mapWnd, this.townMapWnd, this.macroWnd, this.systemMenuWnd, this.optionWnd, this.zoneTitleWnd, this.recordMark, this.messageWnd, this.dialogBox, this.yesNoDialogBox, this.playerStatusWnd, this.petStatusWnd, this.partyWnd, this.calcWnd, this.siegeInfoWnd, this.manorInfoWnd, this.manorSeedSettingWnd, this.manorCropSettingWnd, this.manorCropSellWnd, this.manorCropSellWnd.changeWnd, this.xmasSealWnd, this.summonedStatusWnd, this.abnormalStatusWnd, this.targetStatusWnd, this.restartMenuWnd, this.shortCutWnd, this.chatWnd, this.chatFilterWnd, this.petitionBeginWnd, this.petitionWnd, this.petitionFeedBackWnd, this.gmPetitionWnd, ...this.gmSnoopWnds, ...this.olympiadPlayerWnds, ...this.olympiadAbnormalWnds, this.olympiadTargetWnd]; }

    protected getSavedWindows(): [string, HTMLElement][] { return [["DebugStatsWnd", this.manNetwork.getParent().getComponent("ui").getStatsWindow()], ["InventoryWnd", this.inventoryWnd.element], ["MainWnd", this.mainWnd.element], ["MenuWnd", this.menuWnd.element], ["SystemMenuWnd", this.systemMenuWnd.element], ["OptionWnd", this.optionWnd.element], ["MapWnd", this.mapWnd.element], ["TownMapWnd", this.townMapWnd.element], ["MacroWnd", this.macroWnd.element], ["CommunityWnd", this.communityWnd.element], ["PetWnd", this.petWnd.element], ["SummonedWnd", this.summonedWnd.element], ["PledgePowerWnd", this.pledgePowerWnd.element], ["NPCHtmlViewer", this.npcHtmlViewer.element], ["NPCItemHtmlViewer", this.npcItemHtmlViewer.element], ["HelpHtmlViewer", this.helpWnd.element], ["TradeWnd", this.tradeWnd.element], ["ShopWnd", this.shopWnd.element], ["PreviewShopWnd", this.previewShopWnd.element], ["ManorShopWnd", this.manorShopWnd.element], ["StoreWnd", this.storeWnd.element], ["DeliverWnd", this.deliverWnd.element], ["SelectDeliverWnd", this.selectDeliverWnd.element], ["PrivateShopWnd", this.privateShopWnd.element], ["PrivateBuyWnd", this.privateBuyWnd.element], ["VIPShopWnd", this.vipShopWnd.element], ["RecipeBookWnd", this.recipeBookWnd.element], ["RecipeManufactureWnd", this.recipeManufactureWnd.element], ["RecipeBuyManufactureWnd", this.recipeBuyManufactureWnd.element], ["RecipeTreeWnd", this.recipeTreeWnd.element], ["RecipeShopWnd", this.recipeShopWnd.element], ["RecipeBuyListWnd", this.recipeBuyListWnd.element], ["HennaListWnd", this.hennaListWnd.element], ["HennaInfoWnd", this.hennaInfoWnd.element], ["SSQMainBoard", this.ssqMainBoard.element], ["ItemEnchantWnd", this.itemEnchantWnd.element], ["MatchWnd", this.matchWnd.element], ["PartyRoomWnd", this.partyRoomWnd.element], ["HeroTowerWnd", this.heroTowerWnd.element], ["TrainWnd", this.trainWnd.element], ["FishViewportWnd", this.fishViewportWnd.element], ["CommandInfoWnd", this.commandInfoWnd.element], ["OlympiadControlWnd", this.olympiadControlWnd.element], ["GMWnd", this.gmWnd.element], ["GMMagicSkillWnd", this.gmSkillWnd.element], ["GMInventoryWnd", this.gmInventoryWnd.element], ["GMStoreWnd", this.gmStoreWnd.element], ["GMQuestWnd", this.gmQuestWnd.element], ["GMDetailStatusWnd", this.gmDetailWnd.element], ["GMClanWnd", this.gmClanWnd.element], ["PlayerStatusWnd", this.playerStatusWnd.element], ["PetStatusWnd", this.petStatusWnd.element], ["PartyWnd", this.partyWnd.element], ["CalcWnd", this.calcWnd.element], ["SiegeInfoMainWnd", this.siegeInfoWnd.element], ["ManorInfoWnd", this.manorInfoWnd.element], ["ManorSeedInfoSettingWnd", this.manorSeedSettingWnd.element], ["ManorCropInfoSettingWnd", this.manorCropSettingWnd.element], ["ManorCropSellWnd", this.manorCropSellWnd.element], ["ManorCropSellChangeWnd", this.manorCropSellWnd.changeWnd.element], ["XMasSealWnd", this.xmasSealWnd.element], ["SummonedStatusWnd", this.summonedStatusWnd.element], ["AbnormalStatusWnd", this.abnormalStatusWnd.element], ["TargetStatusWnd", this.targetStatusWnd.element], ["ShortCutWnd", this.shortCutWnd.element], ["ChatWnd", this.chatWnd.element], ["OlympiadPlayerWnd1", this.olympiadPlayerWnds[0].element], ["OlympiadPlayerWnd2", this.olympiadPlayerWnds[1].element], ["OlympiadAbnormalWnd1", this.olympiadAbnormalWnds[0].element], ["OlympiadAbnormalWnd2", this.olympiadAbnormalWnds[1].element], ["OlympiadTargetWnd", this.olympiadTargetWnd.element]]; }

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
        this.replayWnd.setVisible(screen === "replay");
        this.lobbyWnd.setVisible(screen === "lobby");
        this.pawnCreateWnd.setVisible(screen === "create");
        this.loadingWnd.setVisible(screen === "loading");
        this.manRender.radar.isVisible = screen === "world";
        this.layer.setTransparencyMode(screen === "world" && this.options.game.transparencyMode); // 0x10038e93: only children of the game console root take the flag.

        if (screen !== "world") this.hideWorld();
    }

    public showMessage(text: string) { // NCGodWnd::ShowMessage 0x10090bd0 fills the bottom NCMessageWnd bar; in the world, messages go to chat.
        if (this.screen === "world") this.chatWnd.addSystemMessage(text, 0xffb09b79);
        else this.messageWnd.show(text);
    }

    protected siegeConfirm(id: number, name: string, onOk: () => void) { this.dialogBox.show(this.formatSystemMessage(id, name), DialogType_T.OK_CANCEL, isOk => { if (isOk) onOk(); }, true, 0, id); }
    protected confirmLink(text: string, onOk: () => void) { this.dialogBox.show(text, DialogType_T.OK_CANCEL, isOk => { if (isOk) onOk(); }); }
    protected confirm(text: string, onYes: () => void, messageId = 0) {this.dialogBox.show(text, DialogType_T.YES_NO, isYes => { if (isYes) onYes(); }, true, 0, messageId); }
    public showNotice(messageId: number) { this.dialogBox.show(this.nwindow.getSystemMessage(messageId), DialogType_T.OK, null, true, 0, messageId); }

    public playSystemMessageSound(id: number) { this.nwindow.playSystemMessageSound(id); }

    public showConfirm(messageId: number, text: string, onAnswer: (isOk: boolean) => void) {
        if (messageId === 0) this.dialogBox.hide();
        else this.dialogBox.show(text, DialogType_T.OK_CANCEL, onAnswer, messageId !== 1510, 0, messageId); // NCGaraDialogBox::SetDialog, NWindow RVA 0x8b90: replacement does not decline resurrection.
    }

    public showPartyInvite(name: string, onAnswer: (isAccepted: boolean) => void, itemDistribution = 0) { this.yesNoDialogBox.show(this.formatSystemMessage([572, 573, 967, 968, 969][itemDistribution], name), DialogType_T.YES_NO, onAnswer, true, 10000, [572, 573, 967, 968, 969][itemDistribution]); }
    public showTradeInvite(name: string, onAnswer: (isAccepted: boolean) => void) { this.yesNoDialogBox.show(this.formatSystemMessage(100, name), DialogType_T.YES_NO, onAnswer, true, 10000, 100); }
    public showAllyInvite(requestor: string, allyName: string, onAnswer: (isAccepted: boolean) => void) { this.yesNoDialogBox.show(this.formatSystemMessage(527, requestor, allyName), DialogType_T.YES_NO, onAnswer, true, 10000, 527); }
    public showPledgeInvite(requestor: string, pledgeName: string, onAnswer: (isAccepted: boolean) => void) { this.yesNoDialogBox.show(this.formatSystemMessage(67, requestor, pledgeName), DialogType_T.YES_NO, onAnswer, true, 10000, 67); }
    public showFriendInvite(name: string, onAnswer: (isAccepted: boolean) => void) { this.yesNoDialogBox.show(this.formatSystemMessage(516, name), DialogType_T.YES_NO, onAnswer, true, 10000, 516); }
    public showCommandChannelInvite(name: string, onAnswer: (isAccepted: boolean) => void) { this.yesNoDialogBox.show(this.formatSystemMessage(1529, name), DialogType_T.YES_NO, onAnswer, true, 0, 1529); }

    protected formatSystemMessage(id: number, ...params: string[]): string {
        return this.nwindow.getSystemMessage(id).replace(/\$[sc](\d)/g, (match, index) => params[Number(index) - 1] ?? "");
    }

    protected async showServerHelp(name: string) { await this.loginServerWnd.serverInfo.viewer.setHtml(await this.manNetwork.getParent().getComponent("asset").getL2Text(name)); }
    protected async loadHtmlFile(wnd: Pick<NPCHtmlViewerView_T, "isVisible" | "show">, path: string) {
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
        this.messageWnd.show(`${this.nwindow.getSystemMessage(94)} | Lineage2JS by Ratchet`, "https://github.com/realratchet/Lineage2JS");
        this.show("login");
    }

    protected async refreshReplayList() {
        const files = await listReplayFiles();

        if (this.screen === "replay") this.replayWnd.setFiles(files);
    }

    protected async showReplayList() {
        if (this.screen !== "login" && this.screen !== "servers") return;
        this.replayRequest++;
        this.manNetwork.cancelLogin();
        this.messageWnd.hide();
        this.show("replay");
        this.replayWnd.focus();
        try { await this.refreshReplayList(); }
        catch (error) { this.showMessage((error as Error).message); }
    }

    protected async playReplayFile(name: string, lockCamera: boolean, showChat: boolean) {
        if (this.screen !== "replay") return;
        const request = ++this.replayRequest;
        try {
            const bytes = new Uint8Array(await (await readReplayFile(name)).arrayBuffer());

            if (this.screen === "replay" && request === this.replayRequest) await this.manNetwork.playReplay(bytes, lockCamera, showChat);
        } catch (error) { if (request === this.replayRequest) this.showMessage((error as Error).message); }
    }

    protected async removeReplayFile(name: string) {
        try { await deleteReplayFile(name); await this.refreshReplayList(); }
        catch (error) { this.showMessage((error as Error).message); }
    }

    protected async importReplayFiles(files: File[]) {
        try {
            for (const file of files) {
                const bytes = new Uint8Array(await file.arrayBuffer());

                new L2ReplayFile(bytes);
                await saveReplayFile(bytes, file.name);
            }
        } catch (error) { this.showMessage((error as Error).message); }
        await this.refreshReplayList();
    }

    public getSystemMessage(id: number) { return this.nwindow.getSystemMessage(id); }

    public setLoginBusy(isBusy: boolean) { this.loginWnd.setBusy(isBusy); }

    public showServers(servers: GameServerInfo_T[], lastServerId: number) {
        this.loginWnd.auth.clearPassword();
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
    public getScreen() { return this.screen; }
    public getScreenCanvas() { return this.nwindow.canvas; }
    public isMouseOver(x: number, y: number) { return !!document.elementFromPoint(x, y)?.closest(".ndom-layer") || document.documentElement.classList.contains("nwindow-cursor"); }

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

    public showLoading(isTeleport = false) {
        this.prepareWorld();
        this.loadingWnd.setBlack(isTeleport);
        this.show("loading");
    }

    protected prepareWorld() { // World packets reach the HUD windows while the loading screen is still up.
        if (this.areHudWindowsAdded) return;

        this.areHudWindowsAdded = true;
        this.petStatusWnd.onTargetAction = this.summonedStatusWnd.onTargetAction = (objectId, shift) => this.manNetwork.requestPetAction(objectId, shift);
        this.partyWnd.onAction = (objectId, shift, ctrl) => this.manNetwork.requestPartyMemberAction(objectId, shift, ctrl);
        this.partyWnd.onAssist = objectId => this.manNetwork.requestPartyMemberTarget(objectId);
        void this.nwindow.canvas.loadTextures([TEX_TARGET_BRACKET, TEX_MOUSE_TARGET_BRACKET, ...arrGaugeTextures, ...arrGaugeBack, ...arrBalloonTextures]);
    }

    public showWorld() {
        void this.layer.loadTextures(NCCoolTimeIcon.getTextures(), NCCoolTimeIcon.getFinishTextures().map(path => [path, NCCoolTimeIcon.FINISH_COLOR]));
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
        if (type === 0) {
            for (const wnd of [this.shopWnd, this.vipShopWnd, this.manorShopWnd, this.previewShopWnd, this.storeWnd, this.deliverWnd, this.selectDeliverWnd]) wnd.setVisible(false);
        }
        this.nwindow.playWindowSound();
        if (type === 0) void this.npcHtmlViewer.showPacket(html, this.nwindow.getSysString(444));
        else if (type > 0) void this.npcItemHtmlViewer.showPacket(html, this.strings.itemNames[type]);
    }

    public showTutorialHtml(html: string) { void this.tutorialViewerWnd.show(html); }
    public hideTutorialHtml() { this.tutorialViewerWnd.hide(); }
    public showTutorialQuestionMark(id: number) { this.tutorialBtn.show(id, parseInt(this.chatWnd.element.style.top) - (this.options.game.systemMsgWnd ? 130 : 0)); }
    public setReplayRecording(visible: boolean) { this.recordMark.setVisible(visible && this.screen === "world"); }

    public tick(deltaTime: number) {
        if (!this.communityWnd) return;

        this.abnormalStatusWnd.tick(deltaTime / 1000);
        for (const wnd of this.olympiadAbnormalWnds) wnd.tick(deltaTime / 1000);

        const deltaSeconds = deltaTime / 1000;

        if (this.screen === "world") {
            this.zoneTitleWnd.updateZone(deltaSeconds, this.manRender.player.position, this.options.game.showZoneTitle);
            this.zoneTitleWnd.tick(deltaSeconds);
        }

        this.summonedStatusWnd.tick(deltaTime);
        this.matchWnd.tick(deltaTime);
        this.partyRoomWnd.tick(deltaTime);
        this.optionWnd.updatePartyLootControl();
        this.commandInfoWnd.tick(deltaTime);
        this.fishViewportWnd.tick(deltaTime / 1000);

        this.recordMark.update(performance.now() / 1000, this.manNetwork.getReplayRecordingTime());
        this.communityWnd.viewer.tick(deltaSeconds);
        this.npcHtmlViewer.tick(deltaSeconds);
        this.tutorialViewerWnd.tick(deltaSeconds);
        this.tutorialBtn.tick(deltaTime);
        this.npcItemHtmlViewer.tick(deltaSeconds);
        this.helpWnd.tick(deltaSeconds);
        this.petitionBeginWnd.tick(deltaSeconds);
        this.petitionFeedBackWnd.tick(deltaSeconds);
        this.loginServerWnd.serverInfo.viewer.tick(deltaSeconds);
    }
    public setBoard(part: GamePackets.ShowBoardPart_T) {
        if (part.show) void this.communityWnd.setBoard(part.actions, part.content);
        else this.communityWnd.hide();
    }

    public hasNameplate(actor: BaseActor): boolean { return this.nameplates.get(actor)?.visible === true; }

    public updateNameplates() { // FDynamicActor::Render anchor (cylinder top) and DrawTargetName 0x1051d780 layout, LargeFont.
        if (this.pickupLabel) {
            this.pickupLabel.visible = false;
            if (this.screen !== "world") {
                this.pickupLabel.dispose();
                this.pickupLabel = null;
            }
        }
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

        const camera = this.manRender.camera, canvas = this.nwindow.canvas, renderer = this.manRender.renderer;
        const pixels = Math.max(1, Math.floor(renderer.getPixelRatio()));
        const width = renderer.domElement.width / pixels, height = renderer.domElement.height / pixels;
        const scale = 2 / (height * camera.projectionMatrix.elements[5]);

        this.manRender.overHeadAlarm.setSize(width, height);

        const pickup = this.manRender.getParent().getComponent("input").getMousePickup();
        const itemName = pickup && this.strings.itemNames[pickup.itemId];

        if (pickup && pickup.parent && pickup.visible && itemName) {
            pickup.getNamePosition(tmpNameplateAnchor).project(camera);
            if (tmpNameplateAnchor.z >= -1 && tmpNameplateAnchor.z < 1 && Math.abs(tmpNameplateAnchor.x) <= 1 && Math.abs(tmpNameplateAnchor.y) <= 1) {
                if (!this.pickupLabel) {
                    this.pickupLabel = new GroundItemLabel();
                    this.manRender.scene.add(this.pickupLabel);
                }
                const label = this.pickupLabel;

                label.setLabel(canvas, pickup.stackable ? `${itemName}(${pickup.count.toLocaleString("en-US")})` : itemName);
                tmpNameplateAnchor.x = Math.trunc((tmpNameplateAnchor.x + 1) * 0.5 * width) / width * 2 - 1;
                tmpNameplateAnchor.y = 1 - Math.trunc((1 - tmpNameplateAnchor.y) * 0.5 * height) / height * 2;
                label.position.copy(tmpNameplateAnchor.unproject(camera));
                label.scale.set(label.width * scale, label.height * scale, 1);
                label.visible = true;
            }
        }

        const plates = this.manNetwork.getNameplates(), player = this.manRender.player;
        if (plates.length > 24) plates.sort((a, b) => a.actor.position.distanceToSquared(player.position) - b.actor.position.distanceToSquared(player.position));
        let nameCount = 0;

        for (const plate of plates) {
            const collisionHeight = plate.actor.getCollisionHeight();
            const mesh = plate.actor.getComponent<any>("animation").getMeshes()[0];
            const meshScale = mesh ? mesh.meshScale.x : 1;

            plate.actor.getWorldPosition(tmpNameplateAnchor);
            const prePivot = plate.actor.getUnrealScriptProperty("PrePivot") as number[];

            if (prePivot) {
                tmpNameplateAnchor.x += prePivot[0];
                tmpNameplateAnchor.y += prePivot[1];
                tmpNameplateAnchor.z += prePivot[2];
            }
            tmpNameplateAnchor.z += collisionHeight * 2 * meshScale - (plate.isDead ? 2 * collisionHeight * 0.65 : plate.isSitting ? 2 * collisionHeight * (plate.isChairSitting ? 0.2 : 0.6) : 0); // FDynamicActor::Render 0x10620f34..0x1062109c.
            if (plate.abnormalState & 0x2000 && plate.actor.getUnrealScriptProperty("DrawType") !== EDrawType_T.DT_Custom && mesh && mesh.skeleton && mesh.skeleton.matchRefBone(plate.actor.getUnrealScriptProperty("HeadBone")) >= 0) {
                const bigHeadMesh = plate.actor.ridePawn ? plate.actor.ridePawn.getComponent<any>("animation").getMeshes()[0] : mesh;
                const box = bigHeadMesh.geometry.boundingBox;

                tmpNameplateAnchor.z += (box.max.z - box.min.z) * 0.5; // FDynamicActor::Render 0x10620f61..0x10621025; USkeletalMesh::GetRenderBoundingBox 0x1066f950.
            }
            if (plate.actor.ridePawn) tmpNameplateAnchor.z += plate.actor.rideType === GamePackets.MountType_T.STRIDER ? 8 : plate.actor.rideType === GamePackets.MountType_T.WYVERN ? 28 : 0; // 0x1062109f..0x106210cb.
            tmpNameplateAnchor.z += Number(plate.actor.getUnrealScriptProperty("NameOffset")) + (plate.isDead ? Number(plate.actor.getUnrealScriptProperty("DeadNameOffset")) : 0); // FDynamicActor::Render 0x10621096 / 0x106210ce.
            tmpBalloonAnchor.copy(tmpNameplateAnchor);
            tmpNameplateAnchor.project(camera);

            if (tmpNameplateAnchor.z < -1 || tmpNameplateAnchor.z >= 1 || Math.abs(tmpNameplateAnchor.x) > 1 || Math.abs(tmpNameplateAnchor.y) > 1) continue;

            const sx = Math.trunc((tmpNameplateAnchor.x + 1) * 0.5 * width), sy = Math.trunc((1 - tmpNameplateAnchor.y) * 0.5 * height);
            const game = this.options.game;
            const priority = plate.isTarget || plate.isMouseTarget || plate.isSelf;
            const showName = plate.isTarget || plate.isMouseTarget || (plate.isNpc ? !plate.isAttackable || game.npcName : plate.isSelf ? game.myName : game.groupName && (plate.isPartyMember && game.partyMemberName || plate.isPledgeMember && game.pledgeMemberName || !plate.isPartyMember && !plate.isPledgeMember && game.otherPCName)); // UCanvas::DrawTargetName 0x7eda0f..0x7edac6, 0x7ee49b..0x7ee4b2.

            if (showName && (priority || nameCount < 24)) {
                if (!priority) nameCount++;
                let nameplate = this.nameplates.get(plate.actor);

                if (!nameplate) {
                    nameplate = new Nameplate();
                    nameplate.material.depthWrite = true; // L2.elf_hair.trace 6001532/7000816: alpha > 0, ZWrite on.
                    nameplate.material.alphaTest = 1 / 255;
                    this.nameplates.set(plate.actor, nameplate);
                    this.manRender.scene.add(nameplate);
                }
                const bracket = plate.isTarget ? TEX_TARGET_BRACKET : plate.isMouseTarget ? TEX_MOUSE_TARGET_BRACKET : null;

                nameplate.update(canvas, plate.name, plate.title, getNameColor(plate), getTitleColor(plate), bracket && canvas.hasTexture(bracket) ? bracket : null, this.getCachedCrest(plate.clanCrestId), this.getCachedCrest(plate.allyCrestId));
                tmpNameplateAnchor.x = sx / width * 2 - 1;
                tmpNameplateAnchor.y = 1 - sy / height * 2;
                nameplate.position.copy(tmpNameplateAnchor.unproject(camera));
                nameplate.scale.set(nameplate.width * scale, nameplate.height * scale, 1);
                nameplate.visible = true;
                if (plate.hasQuestMark) {
                    tmpAlarmPosition.copy(plate.actor.position);
                    tmpAlarmPosition.z += 50;
                    tmpAlarmDelta.subVectors(tmpAlarmPosition, camera.position);
                    const hit = this.manRender.getPhysicsManager().singleLineCheck({ location: camera.position, delta: tmpAlarmDelta, extent: tmpAlarmExtent, sourceActor: player, sourceIsPlayer: true, sourceProfile: player.getCollisionProfile(), ignorePawns: true, traceWorld: true });

                    if (!hit) this.manRender.overHeadAlarm.add(sx, sy - canvas.getLineHeight(FontType_T.LARGE) * (plate.title ? 2 : 1) - 34, tmpAlarmDelta.length());
                }
            }

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

    public setRegenStatus(count: number, period: number, tick: number) { this.playerStatusWnd.setRegenStatus(count, period, tick); }

    public setupGauge(color: GamePackets.GaugeColor_T, remaining: number, maximum: number) {
        if (!arrGaugeTextures[color]) throw new Error(`Unknown gauge color '${color}'.`);

        if (remaining <= 0 || maximum <= 0) this.gauges.delete(color);
        else this.gauges.set(color, { remaining, maximum, startedAt: this.manNetwork.getParent().getCurrentTime() });

        this.updateGaugeOverlay();
    }

    protected updateGaugeOverlay() { // the overlay repaints every window each frame, so it is only installed while a gauge runs
        this.nwindow.overlayPaint = this.gauges.size > 0 ? canvas => { if (this.screen === "world") this.paintGauges(canvas); } : null;
        this.nwindow.invalidate();
    }

    protected paintGauges(canvas: NWindowCanvas) {
        if (this.gauges.size === 0) return;

        const camera = this.manRender.camera, player = this.manRender.player;
        const now = this.manNetwork.getParent().getCurrentTime();
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
        this.recordMark.setVisible(false);
        this.zoneTitleWnd.clear();
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
        this.tutorialViewerWnd.hide();
        this.tutorialBtn.hide();
        this.npcItemHtmlViewer.hide();
        this.communityWnd.hide();
        this.helpWnd.hide();
        this.petitionBeginWnd.reset();
        this.petitionBeginWnd.setVisible(false);
        this.petitionWnd.reset();
        this.petitionWnd.setVisible(false);
        this.petitionFeedBackWnd.setVisible(false);
        this.gmSnoopWnds.forEach(window => { window.setVisible(false); window.reset(); });
        this.gmPetitionWnd.setVisible(false);
        this.gmPetitionWnd.reset();
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
        this.ssqMainBoard.setVisible(false);
        this.itemEnchantWnd.setVisible(false);
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
        this.observerWnd.setVisible(false);
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
        this.townMapWnd.setVisible(false);
        this.systemMenuWnd.setVisible(false);
        this.optionWnd.setVisible(false);
        this.macroWnd.hide();
        this.playerStatusWnd.setVisible(false);
        this.partyWnd.deleteAll();
        this.calcWnd.setVisible(false);
        this.siegeInfoWnd.setVisible(false);
        this.manorInfoWnd.setVisible(false);
        this.manorSeedSettingWnd.setVisible(false);
        this.manorCropSettingWnd.setVisible(false);
        this.manorCropSellWnd.setVisible(false);
        this.manorCropSellWnd.changeWnd.setVisible(false);
        this.xmasSealWnd.setVisible(false);
        this.shortCutWnd.setVisible(false);
        this.chatWnd.setVisible(false);
        this.chatFilterWnd.setVisible(false);
        this.restartMenuWnd.setVisible(false);
        this.targetStatusWnd.setTarget(null);
    }


    public showSSQStatus(status: GamePackets.SSQStatus_T) { this.ssqMainBoard.show(status); }

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
        else this.skillCoolTimes.set(key, new NCCoolTimeIcon(duration, remaining, this.manNetwork.getParent().getCurrentTime()));
    }

    public render() {
        const now = this.manNetwork.getParent().getCurrentTime();

        for (const [key, coolTime] of this.skillCoolTimes) {
            const wasFinishing = coolTime.isFinishing;

            coolTime.update(now);
            if (coolTime.isFinishing && !wasFinishing && coolTime.texture && this.shortCutWnd.hasCoolTime(key)) void this.manNetwork.getParent().getComponent("audio").playInterfaceSound("ItemSound.cooltime_end"); // NCShortCutWnd::OnPaint, NWindow RVA 0x106d2d.
            if (!coolTime.texture) this.skillCoolTimes.delete(key);
        }
        if (this.skillWnd) this.skillWnd.renderCoolTimes();
        if (this.shortCutWnd) this.shortCutWnd.renderCoolTimes();

        if (this.mapWnd && this.mapWnd.isVisible()) {
            const position = this.manRender.player.position;

            this.mapWnd.setPosition(position.x, position.y, false, position.z);
            this.manRender.camera.getWorldDirection(tmpMapDirection);
            this.mapWnd.setFacing(Math.atan2(tmpMapDirection.y, tmpMapDirection.x));
            this.mapWnd.setTime(this.manRender.getEnvironment().getTimeOfDay());
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
        this.inventoryWnd.setClass(info.classId);
        this.inventoryWnd.setDwarvenCraft(info.hasDwarvenCraft);
        this.setInventory(this.inventory);
    }

    public toggleCharacterStatus() {
        this.mainWnd.setVisible(!this.mainWnd.isVisible());
        this.nwindow.playPanelSound("charstat", this.mainWnd.isVisible());
    }
    public toggleSkills() { this.toggleSkillTab("skills"); }
    public setHenna(henna: GamePackets.HennaStatus_T) { this.mainWnd.detailStatusWnd.setHenna(henna); void this.inventoryWnd.setHenna(henna); }
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

    protected setGroupWindowVisible(wnd: HTMLElement, isVisible: boolean) {
        if (wnd === this.macroWnd.editor) {
            this.macroWnd.setEditorVisible(isVisible);
            return;
        }
        const owner = [...this.getDOMWindows(), this.petWnd, this.summonedWnd, this.pledgePowerWnd].find(owner => owner.element === wnd);

        if (owner && "setVisible" in owner) owner.setVisible(isVisible);
        else wnd.hidden = !isVisible;
    }

    protected setWindowGroup(group: number) {
        if (group === this.windowGroup) return;

        const landmark = this.manRender.player.getComponent<LandmarkComponent>("landmark");

        if (group !== 0 && this.savedLandmarkEnabled === null) { this.savedLandmarkEnabled = landmark.isEnabled; landmark.isEnabled = false; }
        if (group === 0 && this.savedLandmarkEnabled !== null) { landmark.isEnabled = this.savedLandmarkEnabled; this.savedLandmarkEnabled = null; }

        const saved = this.savedWindowGroups[this.windowGroup], modals = this.layer.getModalWindows();

        saved.length = 0;
        for (const wnd of this.layer.getWindows())
            if (!wnd.hidden && !wnd.classList.contains("ndom-modal-blocker")) saved.push({ element: wnd, modalIndex: modals.indexOf(wnd) });
        saved.sort((a, b) => a.modalIndex - b.modalIndex);
        for (const entry of saved) {
            this.setGroupWindowVisible(entry.element, false);
            if (entry.modalIndex !== -1) this.layer.setModal(entry.element, false);
        }
        for (const entry of this.savedWindowGroups[group]) {
            this.setGroupWindowVisible(entry.element, true);
            if (entry.modalIndex !== -1) this.layer.setModal(entry.element, true);
        }
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

    public setObservationMode(isObserving: boolean) { this.observerWnd.setVisible(isObserving); }

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

    public toggleMap(isServer: boolean = false) {
        this.mapWnd.setVisible(!this.mapWnd.isVisible());
        this.nwindow.playPanelSound("map", !isServer && this.mapWnd.isVisible());
        if (this.mapWnd.isVisible()) {
            const position = this.manRender.player.position;

            this.mapWnd.openPosition(position.x, position.y, position.z);
        }
    }

    public setMapPartyMembers(members: ReadonlyMap<number, GamePackets.PartyMember_T>, positions: ReadonlyMap<number, GamePackets.Location_T>, selfId: number) {
        const arrMembers: MapPartyMember_T[] = [];

        for (const member of members.values()) {
            if (member.objectId === selfId) continue;

            const position = positions.get(member.objectId);

            arrMembers.push({ objectId: member.objectId, name: member.name, x: position ? position.x : -1, y: position ? position.y : -1, z: position ? position.z : -1 });
        }
        this.mapWnd.setPartyMembers(arrMembers);
    }

    public setMapMarkers(markers: readonly GamePackets.Location_T[]) { this.mapWnd.setTargetLocations(markers); }

    public showTownMap(info: GamePackets.TownMap_T) { void this.townMapWnd.show(info); }

    public showMap(_mapId: number) { this.toggleMap(true); } // NWindow 0x1005bcf0..0x1005bd66: both packet branches play sound16.


    public chooseInventoryItem(itemId: number) { void this.itemEnchantWnd.show(itemId, this.inventoryWnd.getEnchantItems()); }
    public clearInventoryChoice() { this.inventoryWnd.clearChoice(); this.itemEnchantWnd.setVisible(false); }

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

        const castleGuardType = 8;
        const isCastleGuard = item.info.templateClass === "etc" && item.info.etcType === castleGuardType;
        const isQuantity = !isCastleGuard && consumeType >= 1 && consumeType <= 3 && item.count > 1;
        const messageId = isCastleGuard ? 651 : isQuantity ? 71 : 400;
        const text = this.formatSystemMessage(messageId, item.name);

        if (isQuantity) this.dialogBox.showQuantity(text, item.count, consumeType, count => this.manNetwork.dropItem(item.objectId, count, location), id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id), false, messageId);
        else this.dialogBox.show(text, DialogType_T.OK_CANCEL, isOk => { if (isOk) this.manNetwork.dropItem(item.objectId, 1, location); }, true, 0, messageId);

        this.dialogBox.owner = this.inventoryWnd.getItemOwner(item);
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

        if (isQuantity) this.dialogBox.showQuantity(text, item.count, consumeType, destroy, id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id), false, messageId);
        else this.dialogBox.show(text, DialogType_T.OK_CANCEL, isOk => { if (isOk) destroy(1); }, true, 0, messageId);

        this.dialogBox.owner = this.inventoryWnd.getItemOwner(item);

    }

    protected crystallizeInventoryItem(item: InventoryEntry_T) { // NWindow 0x10097d5c / 0x10009795.
        if (!this.statusInfo || !this.statusInfo.hasDwarvenCraft || !item.info.crystallizable) return;

        this.dialogBox.show(this.formatSystemMessage(336, this.getInventoryItemName(item)), DialogType_T.OK_CANCEL, isOk => {
            if (!isOk) return;

            this.manNetwork.crystallizeItem(item.objectId, 1);
            this.nwindow.playTrashSound();
        }, true, 0, 336);
        this.dialogBox.owner = this.inventoryWnd.getItemOwner(item);
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
                this.dialogBox.show(this.formatSystemMessage(messageId, item.name), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.useItem(item.objectId); }, true, 0, messageId);
                this.dialogBox.owner = this.inventoryWnd.getItemOwner(item);
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
        this.inventoryWnd.updateOrder(change, item.objectId, item.isEquipped, item.type2 === GamePackets.ItemType2_T.TYPE2_QUEST);
    }

    public setInventoryOrderOwner(name: string, namespace: number) { this.inventoryWnd.setOrderOwner(name, namespace); }
    public setWindowOwner(owner: string) {
        if (owner === this.nwindow.getWindowOwner()) return;

        this.layer.cancelDrag();
        this.nwindow.setWindowOwner(owner);
        this.zoneTitleWnd.reset();
        this.layer.resetWindowPositions();
        this.placeScreens();
        for (const prefix of ["option", "audio", "gamma", "pawnRange"]) {
            if (localStorage.getItem(`${prefix}:*`) !== null) continue;
            const value = localStorage.getItem(`${prefix}:${owner}`);
            if (value !== null) localStorage.setItem(`${prefix}:*`, value);
        }
        this.loadOptions();
    }

    protected loadOptions() {
        const game = localStorage.getItem("option:*"), audio = localStorage.getItem("audio:*"), gamma = localStorage.getItem("gamma:*");

        this.applyGameOptions(game === null ? {} : JSON.parse(game));
        this.applyAudioOptions(audio === null ? {} : JSON.parse(audio));
        this.applyGamma(gamma === null ? 0 : JSON.parse(gamma));
        const range = localStorage.getItem("pawnRange:*");

        this.manRender.setPawnRange(range === null ? this.manNetwork.getParent().getComponent("asset").userConfig.clippingRange.pawn : JSON.parse(range));
    }

    public setPawnRange(range: number) {
        this.manRender.setPawnRange(range);
        localStorage.setItem("pawnRange:*", String(range));
    }

    protected applyGamma(gamma: number) {
        if (gamma !== 0 && !GAMMA_STEPS.includes(gamma)) throw new Error(`Invalid gamma '${gamma}'.`);

        this.manRender.setDisplayGamma(this.options.display, gamma);
    }

    public setGamma(gamma: number) {
        this.applyGamma(gamma);
        localStorage.setItem("gamma:*", String(gamma));
    }

    protected applyGameOptions(options: Partial<GameConfig_T>) {
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error(`Invalid game options.`);

        for (const [key, value] of Object.entries(options)) {
            switch (key) {
                case "useTrilinear":
                case "renderDeco":
                case "pawnShadow":
                case "useColorCursor":
                case "autoTrackingPawn":
                case "arrowMode":
                case "showZoneTitle":
                case "systemMsgWndDamage":
                case "systemMsgWndExpendableItem":
                case "systemMsgWnd":
                case "transparencyMode":
                case "oldChatting":
                case "enterChatting":
                case "myName":
                case "npcName":
                case "groupName":
                case "pledgeMemberName":
                case "partyMemberName":
                case "otherPCName":
                    if (typeof value !== "boolean") throw new Error(`Invalid game option '${key}'.`);
                    break;
                case "antiAliasing":
                case "textureDetail":
                    if (!Number.isInteger(value) || value < 0 || value > 2) throw new Error(`Invalid game option '${key}'.`);
                    break;
                case "partyLooting":
                    if (!Number.isInteger(value) || value < 0 || value > 4) throw new Error(`Invalid game option '${key}'.`);
                    break;
                default: throw new Error(`Unknown game option '${key}'.`);
            }
        }

        const asset = this.manNetwork.getParent().getComponent("asset");

        this.options.game = { ...asset.userConfig.game, ...options };
        asset.playerController.isEnterChatting = this.options.game.enterChatting;
        this.manRender.setPawnShadow(this.options.game.pawnShadow);
        this.manRender.setRenderDeco(this.options.game.renderDeco);
        this.manRender.setUseTrilinear(this.options.game.useTrilinear);
        this.manRender.setTextureDetail(this.options.game.textureDetail);
        this.manRender.setAntiAliasing(this.options.game.antiAliasing);
        document.documentElement.classList.toggle("nwindow-default-cursor", !this.options.game.useColorCursor);
        if (this.chatWnd) {
            this.chatWnd.setSystemMsgWnd(this.options.game.systemMsgWnd);
            this.chatWnd.setOldChatting(this.options.game.oldChatting);
            this.chatWnd.setSystemMessageFilters(this.options.game.systemMsgWndDamage, this.options.game.systemMsgWndExpendableItem);
        }
        this.layer.setTransparencyMode(this.screen === "world" && this.options.game.transparencyMode);
        this.nwindow.invalidate();
    }

    protected applyUIScale(scale: number) {
        if (!UI_SCALES.includes(scale)) throw new Error(`Invalid UI scale '${scale}'.`);

        this.nwindow.setUIScale(scale);
        this.layer.resize();
    }

    public setUIScale(scale: number) {
        if (scale === this.nwindow.canvas.uiScale) return;

        this.applyUIScale(scale);
        this.placeScreens();
        localStorage.setItem("option:UIScale", String(scale));
    }

    public setGameOptions(options: Partial<GameConfig_T>) {
        this.applyGameOptions(options);
        localStorage.setItem("option:*", JSON.stringify(options));
    }

    public isAutoTrackingPawnEnabled() { return this.options.game.autoTrackingPawn; }

    public isQuestArrowEnabled() { return this.options.game.arrowMode; }

    public getGameOptions() { return { ...this.options.game }; }

    protected applyAudioOptions(options: Partial<AudioConfig_T>) {
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error(`Invalid audio options.`);

        for (const [key, value] of Object.entries(options)) {
            if (!["soundVolume", "musicVolume", "wavVoiceVolume", "oggVoiceVolume"].includes(key)) throw new Error(`Unknown audio option '${key}'.`);
            if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Invalid audio option '${key}'.`);
        }
        this.options.audio = { ...this.manNetwork.getParent().getComponent("asset").userConfig.audio, ...options };
        const audio = this.manNetwork.getParent().getComponent("audio");

        const wasMusicOff = audio.getMusicVolume() === 0;

        audio.setSoundVolume(this.options.audio.soundVolume);
        audio.setMusicVolume(this.options.audio.musicVolume);
        audio.setWavVoiceVolume(this.options.audio.wavVoiceVolume);
        audio.setOggVoiceVolume(this.options.audio.oggVoiceVolume);
        if (this.options.audio.musicVolume === 0) audio.cancelMusic();
        else if (wasMusicOff) this.manRender.cancelMusic();
        if (this.options.audio.wavVoiceVolume === 0) audio.stopAllVoice(false);
        if (this.options.audio.oggVoiceVolume === 0) audio.stopAllVoice(true);
    }

    public setAudioOptions(options: Partial<AudioConfig_T>) {
        this.applyAudioOptions(options);
        localStorage.setItem("audio:*", JSON.stringify(options));
    }

    public getAudioOptions() {
        const audio = this.manNetwork.getParent().getComponent("audio");

        return { soundVolume: audio.getSoundVolume(), musicVolume: audio.getMusicVolume(), wavVoiceVolume: audio.getWavVoiceVolume(), oggVoiceVolume: audio.getOggVoiceVolume() };
    }

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
            this.dialogBox.showQuantity(this.formatSystemMessage(72, item.name), item.count, consumeType, transfer, id => this.dialogBox.show(this.nwindow.getSystemMessage(id), DialogType_T.OK, null, true, 0, id), false, 72);
            this.dialogBox.owner = isGiving ? this.inventoryWnd.getItemOwner(item) : this.petWnd.getItemOwner();
        } else transfer(1);
    }

    protected showQuestAbort(id: number) {
        this.dialogBox.show(this.nwindow.getSystemMessage(id > 0 ? 182 : 1201), DialogType_T.OK_CANCEL, isOk => {
            if (!isOk || id <= 0) return;

            this.manNetwork.abortQuest(id);
            this.mainWnd.questWnd.clearLocation();
        }, true, 0, id > 0 ? 182 : 1201);
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
                }, "", 0, 256);
                break;
            case "deleteTitle":
                if (!network.getSelectedPlayer()) { this.clanError(50); break; }

                dialog.show(this.nwindow.getSystemMessage(1181), DialogType_T.OK_CANCEL, isOk => {
                    const target = network.getSelectedPlayer();

                    if (isOk && target) network.giveNickName(target.name, "");
                }, true, 0, 1181);
                break;
            case "dismiss":
                if (!member) { this.clanError(263); break; }
                if (!member.name) break;

                dialog.show(this.formatSystemMessage(69, member.name), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.oustPledgeMember(member.name); }, true, 0, 69);
                break;
            case "privileges":
                if (!this.statusInfo) break;

                network.requestPledgePower();
                this.pledgePowerWnd.showFor(this.statusInfo.objectId, 1, this.statusInfo.name);
                break;
            case "authorize":
                if (!this.statusInfo || !(this.statusInfo.clanRelation & 0x40) || !member || !member.name) break;
                if (!member.objectId) { dialog.show(this.nwindow.getSystemMessage(145), DialogType_T.OK_CANCEL, null, true, 0, 145); break; }

                network.requestMemberPledgePower(member.objectId);
                this.pledgePowerWnd.showFor(member.objectId, 2, member.name);
                break;
            case "declareWar":
            case "endWar":
                dialog.showText(this.nwindow.getSystemMessage(action === "declareWar" ? 1531 : 1532), name => {
                    if (action === "declareWar") network.startPledgeWar(name);
                    else network.stopPledgeWar(name);
                    return true;
                }, "", 0, action === "declareWar" ? 1531 : 1532);
                break;
            case "leave": {
                if (!this.statusInfo || this.statusInfo.clanRelation & 0x40) { this.clanError(239); break; }
                const clan = network.getClanInfo();

                dialog.show(this.formatSystemMessage(68, clan ? clan.name : ""), DialogType_T.OK_CANCEL, isOk => { if (isOk) network.withdrawPledge(); }, true, 0, 68);
                break;
            }
            case "deleteCrest":
            case "deleteInsignia":
                dialog.show(this.nwindow.getSystemMessage(1182), DialogType_T.OK_CANCEL, isOk => {
                    if (!isOk) return;

                    if (action === "deleteCrest") network.setPledgeCrest(new Uint8Array(0));
                    else network.setPledgeLargeCrest(new Uint8Array(0));
                }, true, 0, 1182);
                break;
            case "setCrest":
            case "setInsignia":
                dialog.show(this.getCrestMessage(action === "setCrest"), action === "setCrest" ? DialogType_T.OK : DialogType_T.OK_CANCEL, isOk => {
                    if (isOk) this.pickCrest(action === "setCrest");
                }, true, 0, action === "setCrest" ? 211 : 1478);
                break;
            case "penalty": network.userCommand(100); break;
            case "community": this.communityWnd.openClan(); break;
            default: throw new Error(`Unknown clan action '${action}'.`);
        }
    }

    protected pickCrest(isSmall: boolean) { // NWindow 0x10080bf0 crest / 0x100809d0 insignia read the BMP path from sysmsg 208; a file picker replaces it.
        const input = document.createElement("input");

        input.type = "file";
        input.accept = "image/*";
        input.onchange = async () => {
            if (!input.files.length) return;

            let bytes: Uint8Array;

            try {
                bytes = new Uint8Array(await input.files[0].arrayBuffer());
            } catch {
                this.clanError(528);
                return;
            }

            let data: Uint8Array;

            try {
                data = await encodeCrestImage(new Blob([bytes.buffer as ArrayBuffer], { type: input.files[0].type }), isSmall ? PLEDGE_CREST_WIDTH : PLEDGE_LARGE_CREST_WIDTH, isSmall ? PLEDGE_CREST_HEIGHT : PLEDGE_LARGE_CREST_HEIGHT);
            } catch {
                this.clanError(isSmall ? 211 : 1478);
                return;
            }

            if (!data) this.clanError(isSmall ? 211 : 1478);
            else if (isSmall) this.manNetwork.setPledgeCrest(data);
            else this.manNetwork.setPledgeLargeCrest(data);
        };
        input.click();
    }

    protected getCrestMessage(isSmall: boolean) { return `Select a supported image measuring ${isSmall ? PLEDGE_CREST_WIDTH : PLEDGE_LARGE_CREST_WIDTH}x${isSmall ? PLEDGE_CREST_HEIGHT : PLEDGE_LARGE_CREST_HEIGHT} pixels.`; }
    protected clanError(id: number) { this.addSystemMessage(id === 211 || id === 1478 ? this.getCrestMessage(id === 211) : this.nwindow.getSystemMessage(id), this.strings.systemMessageColors[id]); this.manNetwork.playSystemMessageSound(id); }

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
        }, "", 0, 535);
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
        this.inventoryWnd.setClass(info.classId);
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

    public addSnoop(snoop: GamePackets.Snoop_T) {
        if (!snoop.message) return;

        const window = this.gmSnoopWnds.find(window => window.getConversationId() === snoop.conversationId) || this.gmSnoopWnds.find(window => window.getConversationId() === -1);

        if (!window) { this.dialogBox.show(this.nwindow.getSystemMessage(802), DialogType_T.OK, null, true, 0, 802); return; }

        if (window.getConversationId() === -1) window.setConversation(snoop.conversationId, snoop.name);
        window.addChat(snoop);
    }

    public enablePetitionEvaluation() { this.petitionWnd.setEvaluationEnabled(true); }

    public addChat(name: string, text: string, type: GamePackets.Say2_T) {
        if (type === GamePackets.Say2_T.PETITION_PLAYER || type === GamePackets.Say2_T.PETITION_GM) {
            this.gmPetitionWnd.addString(`${name}: ${text}`, type === GamePackets.Say2_T.PETITION_PLAYER ? 0xffdcdcdc : 0xff80ffff);
            if (!this.gmPetitionWnd.isVisible()) this.petitionWnd.addChat(name, text, type);
        }
        else if (type === GamePackets.Say2_T.PARTYROOM_ALL) this.partyRoomWnd.appendChat(`${name}: ${text}`);
        else if (type === GamePackets.Say2_T.PARTYROOM_COMMANDER || type === GamePackets.Say2_T.CHANNEL_ALL) this.commandInfoWnd.addChat(name, text, type);
        else this.chatWnd.addCreatureSay(name, text, type);
    }
    public addSystemMessage(text: string, color: number, group: number = 0) {
        if (group === 6) { // NCChatWnd 0x1005357d..0x100535f7 routes petition notices separately in cyan.
            this.gmPetitionWnd.addString(text, 0xff80ffff);
            if (!this.gmPetitionWnd.isVisible()) {
                this.petitionWnd.addString(text, 0xff80ffff);
                this.petitionWnd.setVisible(true);
            }
        } else this.chatWnd.addSystemMessage(text, color, group);
    }

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

export type GameGUI_T = Pick<NConsoleWnd, keyof NConsoleWnd>;

export default NConsoleWnd;
