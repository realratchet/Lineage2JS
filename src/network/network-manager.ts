import { LoopOnce, Raycaster, Vector3 } from "three";
import BaseActor from "../base-actor";
import PawnAttackComponent, { type NAttackActionParam_T } from "../objects/components/pawn-attack-component";
import PawnEquipmentComponent from "../objects/components/pawn-equipment-component";
import { CHARACTER_FULL_ARMOR_SLOT, CHARACTER_ALLDRESS_SLOT } from "@l2js/engine/datafile/schema/armorgrp.schema";
import LoginClient from "./login-client";
import GameClient from "./game-client";
import NetworkUI from "./network-ui";
import getCommandTokens from "./command-parser";
import L2Lobby from "./l2-lobby";
import GroundPickup from "../objects/ground-pickup";
import { getRotatorQuaternionElements } from "../assets/unreal/utils/rotator";
import * as GamePackets from "./game-packets";
import PawnFishingComponent, { FishingType_T } from "../objects/components/pawn-fishing-component";
import PawnCubicComponent from "../objects/components/pawn-cubic-component";
import PawnAbnormalComponent from "../objects/components/pawn-abnormal-component";
import type PacketReader from "./packet-reader";
import type { SessionKey_T } from "./login-client";
import type { PawnCreateSelection_T } from "../nwindow/nc-pawn-create-wnd";
import type { CharacterCreate_T } from "./game-client";
import type { IEngineComponent } from "../game/components";
import type { Nameplate_T } from "./network-ui";
import type GameManager from "../game/game-manager";
import type { ICharacterGroup, ICharacterArmorSelection } from "@l2js/engine/contracts/pawn";
import type MovableObject from "../objects/movable-object";
import Radar from "../rendering/radar";
import type { RadarState_T } from "../rendering/radar";

type NetObjectKind_T = "user" | "player" | "npc";
type MacroRow_T = { command: GamePackets.Macro_T["commands"][number], duration: number, start: number, elapsed: number };
type MacroExecution_T = { macro: GamePackets.Macro_T, active: boolean, current: number, rows: MacroRow_T[] };
type NetSkill_T = { id: number, level: number, hitTime: number, receivedTime: number, associatedActors: BaseActor[], associatedObjectIds: number[] };
type PendingAttack_T = { hits: readonly NAttackActionParam_T[], position: GamePackets.Location_T };
type PendingSkill_T = { targetObjectId: number, id: number, level: number, hitTime: number, receivedTime: number, position: GamePackets.Location_T, isTransient: boolean, associatedObjectIds: number[] };

type NetObject_T = {
    objectId: number;
    selectedId: number;
    clanId: number;
    clanCrestId: number;
    allyId: number;
    allyCrestId: number;
    kind: NetObjectKind_T;
    actor: BaseActor;
    isRemoved: boolean;
    position: Vector3;
    destination: Vector3;
    heading: number;
    name: string;
    title: string;
    curHp: number;
    maxHp: number;
    curMp: number;
    maxMp: number;
    levelDifference: number;
    karma: number;
    pvpFlag: number;
    recommendations: number;
    nameColor: number;
    titleColor: number;
    isSummon: boolean;
    isAttackable: boolean;
    isDead: boolean;
    appearanceKey: string;
    speeds: GamePackets.Speeds_T;
    isRunning: boolean;
    isInCombat: boolean;
    waitType: GamePackets.WaitType_T;
    privateStoreType: GamePackets.PrivateStoreType_T;
    chatMessage: string;
    chatTime: number;
    chairStaticObjectId: number;
    cubics: number[];
    abnormalState: number;
    fishing: GamePackets.FishingState_T;
    skill?: NetSkill_T;
    pendingAttack: PendingAttack_T;
    pendingSkill: PendingSkill_T;
};
type NetVehicle_T = { objectId: number, position: Vector3, heading: number, destination: Vector3, moveSpeed: number, rotationSpeed: number, isStarted: boolean, riders: Map<number, Vector3> };
type PetRemainTime_T = { maxTime: number, remainingTime: number };
type PledgeInfo_T = { name: string, allyName: string, crestId: number, allyId: number, allyCrestId: number, unknown: number, crest: HTMLCanvasElement, allyCrest: HTMLCanvasElement };

const MYSTIC_BODY_CLASS_IDS = new Set([10, 11, 12, 13, 14, 15, 16, 17, 25, 26, 27, 28, 29, 30, 38, 39, 40, 41, 42, 43, 49, 50, 51, 52, 94, 95, 96, 97, 98, 103, 104, 105, 110, 111, 112, 115, 116]); // ClassId.isMage excludes orcMage (49), which uses the Shaman body.
const VALIDATE_POSITION_INTERVAL = 1000;
const STUCK_INTERVAL = 600;
const STUCK_DISTANCE = 2;
const SNAP_DISTANCE = 300;
const NAMEPLATE_DISTANCE = 1000;
const CHAT_BALLOON_TIME = 6000; // NCConsole 0x1005f070: 1 s timer, the balloon is cleared on the sixth tick.
const STOP_SNAP_DISTANCE = 32;
const GAME_TIME_SCALE = 1 / 6; // GameTimeController: one in-game day lasts four real hours.
const NETWORK_BOW_RANGE = 2000;
const NPC_SPAWN_CONCURRENCY = 2;
const CUBIC_SKILLS = new Set([4049, 4050, 4051, 4052, 4053, 4054, 4055, 4164, 4165, 4166]);

const tmpLocation: GamePackets.Location_T = { x: 0, y: 0, z: 0 };
const tmpEarthquakePosition = new Vector3();
const tmpEarthquakeRotationAmplitude = new Vector3(0, 0.1, 0);
const tmpEarthquakeRotationVelocity = new Vector3(0, 1000, 0);
const tmpEarthquakePositionAmplitude = new Vector3();

function setVector(target: Vector3, location: GamePackets.Location_T): Vector3 { return target.set(location.x, location.y, location.z); }

function distanceXY(a: Vector3, b: Vector3): number { return Math.hypot(a.x - b.x, a.y - b.y); }

function getDistance(a: Vector3, b: Vector3): number {
    const x = Math.fround(Math.fround(a.x) - Math.fround(b.x)), y = Math.fround(Math.fround(a.y) - Math.fround(b.y)), z = Math.fround(Math.fround(a.z) - Math.fround(b.z));

    return Math.fround(Math.sqrt(x * x + y * y + z * z));
}

type GMServerTransfer_T = { phase: number, lastPhase: number, serverId: number, position: GamePackets.Location_T, selectedSlot: number, error: string };

export class NetworkManager implements IEngineComponent<GameManager> {
    protected manGame: GameManager;
    protected ui: NetworkUI;
    protected login: LoginClient = null;
    protected lobby: L2Lobby = null;
    protected loginUrl: string = null;
    protected gameServerUrl: string = null;
    protected game: GameClient = null;
    protected account: string = null;
    protected loginAccount: string = null;
    protected loginPassword: string = null;
    protected gmTransfer: GMServerTransfer_T = null;
    protected sessionKey: SessionKey_T = null;
    protected characters: GamePackets.CharSelectEntry_T[] = [];
    protected templates: GamePackets.CharTemplate_T[] = [];
    protected charGroups: ICharacterGroup[] = null;
    protected readonly objects = new Map<number, NetObject_T>();
    protected readonly doors = new Map<number, MovableObject>();
    protected readonly doorPositions = new Map<number, number>();
    protected readonly staticObjects = new Map<number, number>();
    protected readonly appearances = new Map<number, GamePackets.Appearance_T>();
    protected readonly pickups = new Map<number, GroundPickup>();
    protected gnoCategory = 0;
    protected gnoObjectId = -1;
    protected gnoElapsed = 0;
    protected nextTargetLock = false;
    protected readonly npcNames = new Map<number, string>();
    protected readonly shortcuts = new Map<number, GamePackets.ShortCut_T>();
    protected readonly autoSoulShots = new Set<number>();
    protected readonly inventory = new Map<number, GamePackets.InventoryItem_T>();
    protected inventoryOrderNamespace = 0;
    protected readonly appearanceLoads = new WeakMap<BaseActor, Promise<void>>();
    protected readonly bodyKeys = new WeakMap<BaseActor, string>();
    protected readonly appearanceRequests = new WeakMap<BaseActor, number>();
    protected storageMaxCount: GamePackets.StorageMaxCount_T = null;
    protected readonly skills = new Map<number, GamePackets.SkillEntry_T>();
    protected readonly questStates = new Map<number, GamePackets.QuestState_T>();
    protected hennaStatus: GamePackets.HennaStatus_T = null;
    protected isMacroListComplete = true;
    protected macroListReceived = 0;
    protected readonly macros = new Map<number, GamePackets.Macro_T>();
    protected readonly macroExecutions = new Map<number, MacroExecution_T>();
    protected readonly friends = new Map<number, GamePackets.FriendEntry_T>();
    protected readonly partyMembers = new Map<number, GamePackets.PartyMember_T>();
    protected partyInvite: GamePackets.PartyInvite_T = null;
    protected pledgeInvite: GamePackets.PledgeInvite_T = null;
    protected friendInvite: GamePackets.FriendInvite_T = null;
    protected partyJoinResult = -1;
    protected pledgeJoinId = 0;
    protected clanInfo: GamePackets.ClanInfo_T = null;
    protected readonly pledgeInfos = new Map<number, PledgeInfo_T>();
    protected readonly clanMembers = new Map<string, GamePackets.ClanMember_T>();
    protected aquireSkillFishing = false;
    protected aquireSkills: GamePackets.AquireSkillEntry_T[] = [];
    protected aquireSkillInfo: GamePackets.AquireSkillInfo_T = null;
    protected tradePartnerId = 0;
    protected tradeRequestId = 0;
    protected readonly tradeOwnItems: GamePackets.TradeItem_T[] = [];
    protected readonly tradeOtherItems: GamePackets.TradeItem_T[] = [];
    protected readonly tradeAvailableItems: GamePackets.TradeItem_T[] = [];
    protected tradeDone = 0;
    protected shopSellMoney = 0;
    protected shopSellNpcId = 0;
    protected readonly shopSellItems: GamePackets.ShopItem_T[] = [];
    protected shopBuyMoney = 0;
    protected shopBuyListId = 0;
    protected readonly shopBuyItems: GamePackets.ShopItem_T[] = [];
    protected partyLeaderId = 0;
    protected partyLootDistribution = 0;
    protected etcStatus: { charges: number, weightPenalty: number, messageRefusal: number, dangerArea: number, expertisePenalty: number } = null;
    protected signsSky = 0;
    protected petStatusType = -1;
    protected petInfo: GamePackets.PetStatus_T = { objectId: -1, npcId: -GamePackets.NPC_ID_OFFSET, name: "", x: 0, y: 0, z: 0, statusType: 0, curFood: 0, maxFood: 0, curHp: 0, maxHp: 0, curMp: 0, maxMp: 0, field42: 0, level: 0, exp: 0, minExp: 0, nextExp: 0, weight: 0, maxWeight: 0, pAtk: 0, pDef: 0, mAtk: 0, mDef: 0, accuracy: 0, evasion: 0, critical: 0, speed: 0, attackSpeed: 0, castSpeed: 0, field60: 0, isMountable: false, soulshotsUsed: 0, spiritshotsUsed: 0 };
    protected isMounted = false;
    protected npcSpawnCount = 0;
    protected readonly npcSpawnWaiters: (() => void)[] = [];
    protected readonly petInventory = new Map<number, GamePackets.InventoryItem_T>();
    protected petRemainTime: PetRemainTime_T = null;
    protected readonly abnormalStatuses: GamePackets.AbnormalStatus_T[] = [];
    protected shortBuff: GamePackets.AbnormalStatus_T = null;
    protected userId = 0;
    protected selectedSlot = -1;
    protected inWorld = false;
    protected teleportGeneration = 0;
    protected teleportInfoPending = false;
    protected isRunning = true;
    protected lastValidateAt = 0;
    protected wasMoving = false;
    protected readonly stuckPosition = new Vector3();
    protected skillListLoad: Promise<void> = null;
    protected resolveSkillList: () => void = null;
    protected userAppearanceLoad: Promise<void> = null;
    protected nextTick: Promise<void> = null;
    protected resolveNextTick: () => void = null;
    protected allyInvite: GamePackets.AllyInvite_T = null;
    protected pledgePower = new Uint8Array(32);
    protected pledgeWarStart: GamePackets.PledgeWar_T = null;
    protected pledgeWarStop: GamePackets.PledgeWar_T = null;
    protected pledgeWarSurrender: GamePackets.PledgeWar_T = null;
    protected readonly pledgeCrests = new Map<number, Uint8Array>();
    protected readonly pledgeLargeCrests = new Map<number, Uint8Array>();
    protected readonly clanLargeCrestIds = new Map<number, number>();
    protected readonly allyCrests = new Map<number, Uint8Array>();
    protected warehouseDeposit: GamePackets.WarehouseList_T = null;
    protected warehouseWithdraw: GamePackets.WarehouseList_T = null;
    protected privateStoreManageSell: GamePackets.PrivateStoreManageSell_T = null;
    protected privateStoreSell: GamePackets.PrivateStoreSellList_T = null;
    protected privateStoreManageBuy: GamePackets.PrivateStoreManageBuy_T = null;
    protected privateStoreBuy: GamePackets.PrivateStoreBuyList_T = null;
    protected readonly privateStoreSellMsgs = new Map<number, string>();
    protected readonly privateStoreBuyMsgs = new Map<number, string>();
    protected readonly packageTargets = new Map<number, string>();
    protected packageSendable: GamePackets.PackageSendableList_T = null;
    protected multiSell: GamePackets.MultiSellList_T = null;
    protected shopPreview: GamePackets.ShopPreviewList_T = null;
    protected shopPreviewItems: number[] = null;
    protected seedShop: GamePackets.BuyListSeed_T = null;
    protected cropProcure: GamePackets.SellListProcure_T = null;
    protected readonly vehicles = new Map<number, NetVehicle_T>();
    protected readonly mounts = new Map<number, GamePackets.Ride_T>();
    protected observation: GamePackets.Location_T = null;
    protected specialCamera: GamePackets.SpecialCamera_T = null;
    protected cameraMode = 0;
    protected readonly radarMarkers: GamePackets.Location_T[] = [];
    protected readonly radarState: RadarState_T = { party: [], target: null, markers: this.radarMarkers };
    protected readonly partyPositions = new Map<number, GamePackets.Location_T>();
    protected townMap: GamePackets.TownMap_T = null;
    protected calculatorId = 0;
    protected xmasSealItemId = 0;
    protected dice: GamePackets.Dice_T = null;
    protected monRace: GamePackets.MonRaceInfo_T = null;
    protected readonly ssqStatus = new Map<number, GamePackets.SSQStatus_T>();
    protected clanHallDecoration: GamePackets.ClanHallDecoration_T = null;
    protected siegeInfo: GamePackets.SiegeInfo_T = null;
    protected siegeAttackers: GamePackets.SiegeClanList_T = null;
    protected siegeDefenders: GamePackets.SiegeClanList_T = null;
    protected recipeBook: GamePackets.RecipeBook_T = null;
    protected recipeItemMakeInfo: GamePackets.RecipeItemMakeInfo_T = null;
    protected recipeShopManageList: GamePackets.RecipeShopManageList_T = null;
    protected recipeShopSellList: GamePackets.RecipeShopSellList_T = null;
    protected recipeShopItemInfo: GamePackets.RecipeShopItemInfo_T = null;
    protected readonly recipeShopMessages = new Map<number, string>();
    protected hennaEquipList: GamePackets.HennaEquipList_T = null;
    protected hennaItemInfo: GamePackets.HennaItemInfo_T = null;
    protected partyMatchRooms: GamePackets.PartyMatchRoom_T[] = [];
    protected partyMatchPage = 1;
    protected partyMatchDetail: GamePackets.PartyMatchDetail_T = null;
    protected readonly partyEffects = new Map<number, GamePackets.PartySpelled_T>();
    protected readonly tutorialQuestionMarks = new Set<number>();
    protected tutorialClientEvents = 0;
    protected gmCharacterInfo: GamePackets.GMViewCharacterInfo_T = null;
    protected gmPledgeInfo: GamePackets.GMViewPledgeInfo_T = null;
    protected gmSkillInfo: GamePackets.GMViewSkillInfo_T = null;
    protected gmQuestList: GamePackets.GMViewQuestList_T = null;
    protected gmItemList: GamePackets.GMViewItemList_T = null;
    protected gmWarehouseList: GamePackets.GMViewWarehouseWithdrawList_T = null;
    protected gmHennaStatus: GamePackets.HennaStatus_T = null;
    protected readonly snoops = new Map<number, GamePackets.Snoop_T[]>();
    protected enchantSkills: GamePackets.EnchantSkill_T[] = [];
    protected enchantSkillInfo: GamePackets.EnchantSkillInfo_T = null;
    protected eventMatchMessageType = -1;
    protected questMarkId = 0;
    protected hasNewMail = false;
    protected heroes: GamePackets.HeroEntry_T[] = [];
    protected partyRoomMode = -1;
    protected readonly partyRoomMembers = new Map<number, GamePackets.PartyRoomMember_T>();
    protected isInCommandChannel = false;
    protected commandChannel: GamePackets.CommandChannelInfo_T = null;
    protected commandChannelInviter: string = null;
    protected olympiadMode = 0;
    protected readonly olympiadUsers = new Map<number, GamePackets.OlympiadUserInfo_T>();
    protected readonly olympiadEffects = new Map<number, GamePackets.AbnormalStatus_T[]>();
    protected manors: GamePackets.ManorEntry_T[] = [];
    protected manorSeedInfo: GamePackets.ManorSeedInfo_T = null;
    protected manorCropInfo: GamePackets.ManorCropInfo_T = null;
    protected manorDefaultCrops: GamePackets.ManorDefaultCrop_T[] = [];
    protected manorSeedSettings: GamePackets.ManorSeedSettings_T = null;
    protected manorCropSettings: GamePackets.ManorCropSettings_T = null;
    protected manorSellCrops: GamePackets.ManorSellCropList_T = null;
    protected manorProcureCropDetail: GamePackets.ManorProcureCropDetail_T = null;
    protected stuckCheckAt = 0;

    public setParent(parent: GameManager): this { this.manGame = parent; return this; }
    public getParent(): GameManager { return this.manGame; }

    public isInWorld() { return this.inWorld; }

    protected getTargetId() {
        const user = this.objects.get(this.userId);

        return user ? user.selectedId : 0;
    }

    public async showLogin(url: string) {
        this.loginUrl = url;

        const asset = this.manGame.getComponent("asset"), render = this.manGame.getComponent("render");

        asset.setStreaming(render, false);

        if (!this.ui) {
            this.ui = new NetworkUI(this, asset, render);
            this.lobby = new L2Lobby(this.manGame, (appearance, actor) => this.loadAppearance(appearance, actor));

            this.ui.setStrings(await asset.getGameStrings());

            void this.loadNpcNames();
            void asset.prefetchCharacterScripts();
            void this.loadRadar();

            await Promise.all([this.ui.createScreens(), this.lobby.enter(this.ui.getStrings().logonSpots)]);
        } else await this.lobby.enter(this.ui.getStrings().logonSpots);

        this.lobby.showLogin();
        this.ui.showLogin();
    }

    protected async loadRadar() {
        const render = this.manGame.getComponent("render");

        render.radar.setMeshes(await this.manGame.getComponent("asset").loadSkeletalMeshes("LineageDecos", Radar.getMeshNames()));
        render.radar.getState = () => this.getRadarState();
    }

    protected getRadarState(): RadarState_T { // DrawRadarBack 0x7FE54A: party members by GetUser actor, else the PartyMemberPosition XY; target is Controller.SelectedActor.
        const state = this.radarState, target = this.objects.get(this.getTargetId());

        state.party.length = 0;

        for (const objectId of this.partyMembers.keys()) {
            const object = this.objects.get(objectId);

            if (objectId === this.userId) continue;
            if (object && object.actor) state.party.push(object.actor.position);
            else if (this.partyPositions.has(objectId)) state.party.push(this.partyPositions.get(objectId));
        }

        state.target = target && target.actor ? target.actor.position : null;

        return state;
    }

    protected async loadNpcNames() {
        for (const npc of await this.manGame.getComponent("render").listNpcs()) this.npcNames.set(npc.id, npc.name);
    }

    public async connectLogin(account: string, password: string) {
        this.gmTransfer = null;
        if (this.login) this.login.close();

        this.loginAccount = account;
        this.loginPassword = password;
        this.login = new LoginClient();
        this.account = account.toLowerCase();
        this.ui.setLoginBusy(true);

        try {
            const servers = await this.login.login(this.loginUrl, account, password);

            this.ui.showServers(servers, this.login.lastServerId);
        } catch (e) {
            this.ui.showLogin();
            this.ui.showMessage(this.getLoginErrorMessage(e));
        }
    }

    public cancelLogin() {
        this.gmTransfer = null;
        this.login.close();
        this.ui.showLogin();
    }

    public async connectGame(serverId: number) {
        const login = this.login, transfer = this.gmTransfer;
        const server = login.servers.find(entry => entry.id === serverId);

        try {
            const key = await login.selectServer(server.id);

            if (this.login !== login || this.gmTransfer !== transfer) return;
            this.sessionKey = key;
            this.ui.setCrestServer(server.id);
            const game = this.game = new GameClient();

            game.onPacket = (opcode, packet) => { if (this.game === game) this.onPacket(opcode, packet); };
            game.onClose = (code, reason) => { if (this.game === game) void this.onDisconnected(`Game server closed the connection (${code}${reason ? ` ${reason}` : ""}).`); };

            this.gameServerUrl = login.getGameServerUrl(server);
            await game.connect(this.gameServerUrl);
        } catch (e) {
            if (this.login !== login || this.gmTransfer !== transfer) return;
            if (transfer) transfer.error = (e as Error).message;
            this.ui.showLogin();
            this.ui.showMessage(this.getLoginErrorMessage(e));
        }
    }

    protected getLoginErrorMessage(e: any): string {
        if (!e.systemMessageIds) return e.message;

        return e.systemMessageIds.map((id: number) => this.ui.getSystemMessage(id)).join(" ");
    }

    public relogin() {
        this.game.close();
        this.game = null;
        this.lobby.showLogin();
        this.ui.showLogin();
    }

    public pickLobbyPawn(actor: BaseActor) {
        if (!this.lobby || !this.ui.isLobbyVisible()) return;

        const index = this.lobby.getPawnIndex(actor);

        if (index >= 0) this.ui.pickCharacter(index);
    }

    public previewCharacter(index: number) {
        if (this.gmTransfer) this.gmTransfer.selectedSlot = index;
        this.lobby.select(index);
        this.ui.setSelectedCharacter(index);
    }

    public cancelCreate() {
        this.ui.showCharacters(this.characters);
        void this.lobby.showSelect(this.characters);
    }

    public previewCreate(selection: PawnCreateSelection_T) { void this.lobby.previewCreate(selection); }
    public rotateCreatePreview(direction: number) { this.lobby.rotateCreate(direction); }
    public zoomCreatePreview(isIn: boolean) { this.lobby.zoomCreate(isIn); }

    public selectCharacter(slot: number) {
        const character = this.characters[slot];

        if (slot < 0 || slot >= 7 || !character || character.deleteSeconds > 0 || character.isDeletionMarked) return;
        if (character.name && !this.ui.getScreenCanvas().hasGlyphs(character.name)) { this.ui.showMessage(this.ui.getSystemMessage(205)); return; }

        this.selectedSlot = slot;
        this.ui.showLoading();
        this.game.characterSelected(slot, this.gmTransfer ? this.gmTransfer.position : null);
    }

    public startGMServerTransfer(serverId: number) {
        if (!this.inWorld) return;
        if (this.loginAccount === null || this.loginPassword === null) throw new Error(`GM server transfer has no saved authentication.`);
        const position = this.manGame.getComponent("render").player.position;

        this.gmTransfer = { phase: 1, lastPhase: 0, serverId, position: { x: Math.fround(position.x), y: Math.fround(position.y), z: Math.fround(position.z) }, selectedSlot: -1, error: null };
    }

    protected tickGMServerTransfer() {
        const transfer = this.gmTransfer;

        if (!transfer || transfer.error || transfer.phase === transfer.lastPhase) return;
        transfer.lastPhase = transfer.phase;
        switch (transfer.phase) {
            case 1: transfer.phase = 2; break;
            case 2: this.game.requestRestart(); break;
            case 3: void this.reconnectGMServer(transfer); break;
            case 4: break;
            case 5:
                if (transfer.serverId > 0 && this.login.servers.some(server => server.id === transfer.serverId)) void this.connectGame(transfer.serverId);
                break;
            case 6:
                this.selectCharacter(transfer.selectedSlot);
                transfer.phase = 7;
                this.gmTransfer = null;
                break;
            case 7: this.gmTransfer = null; break;
            default: throw new Error(`Invalid GM transfer phase ${transfer.phase}.`);
        }
    }

    protected async reconnectGMServer(transfer: GMServerTransfer_T) {
        this.game.logout();
        this.game.onClose = null;
        this.game.close();
        this.game = null;
        this.login.close();
        const login = this.login = new LoginClient();

        login.onLoginOk = async () => {
            if (this.gmTransfer !== transfer || transfer.phase !== 3) return;
            transfer.phase = 4;
            await this.waitNextTick();
        };
        try {
            await login.login(this.loginUrl, this.loginAccount, this.loginPassword);
            if (this.gmTransfer === transfer && transfer.phase === 4) transfer.phase = 5;
        } catch (e) {
            if (this.gmTransfer !== transfer) return;
            transfer.error = (e as Error).message;
            this.ui.showLogin();
            this.ui.showMessage(transfer.error);
        }
    }

    public requestNewCharacter() { this.game.newCharacter(); }
    public createCharacter(info: CharacterCreate_T) { this.game.characterCreate(info); }
    public deleteCharacter(slot: number) { this.game.characterDelete(slot); }
    public restoreCharacter(slot: number) { this.game.characterRestore(slot); }

    public say(text: string, type: GamePackets.Say2_T, target: string = null) { this.game.say2(text, type, target); }
    public execCommand(text: string, isShift: boolean = false) {
        if (!this.inWorld) return;
        if (text.startsWith("//")) { this.sendBypassBuildCmd(text.slice(2)); return; }
        if (!text.startsWith("/")) return;

        const tokens = getCommandTokens(text), strings = this.ui.getStrings();
        const entry = Object.entries(strings.commands).find(([, name]) => `/${name.toLowerCase()}` === tokens[0].toLowerCase());

        if (!entry) return; // NWindow 0x100599d9: unknown command goes directly to the return at 0x1005a16a.

        const type = Number(entry[0]);

        switch (type) {
            case 4: case 5: this.game.changeWaitType(type === 5); break;
            case 6: case 7: this.game.changeMoveType(type === 7); break;
            case 8: case 9: case 10: this.useAction(2, type === 9, type === 10); break;
            case 11: this.useAction(3); break;
            case 13: this.useAction(4, false, isShift); break;
            case 14: this.useAction(5, false, isShift); break;
            case 15: this.useAction(6, false, isShift); break;
            case 12: {
                if (tokens.length < 2) { this.ui.addSystemMessage(strings.systemMessages[1256], strings.systemMessageColors[1256]); break; }

                const name = tokens.slice(1).join(" ").toLowerCase();
                let target: NetObject_T = null;

                if (!name) break;

                for (const object of this.objects.values()) {
                    if (object.name.toLowerCase() !== name) continue;

                    target = object;
                    if (!object.isSummon) break; // Engine 0x104204cd: first non-summon match, otherwise the last match.
                }

                if (target && target.actor && this.manGame.getComponent("render").player) this.requestAction(target.actor, isShift);
                break;
            }
            case 20: this.ui.openPartyMatch(); break;
            case 21: case 22: case 23: this.game.requestSocialAction(type - 19); break;
            case 46: case 47: case 48: case 49: case 50: case 51: this.game.requestSocialAction(type - 41); break;
            case 54: case 55: case 56: this.game.requestSocialAction(type - 43); break;
            case 57: this.useAction(0, this.ui.getInputModifiers()[0], isShift); break;
            case 24: case 25: case 26: {
                if (tokens.length < 2) { this.ui.addSystemMessage(strings.systemMessages[1256], strings.systemMessageColors[1256]); break; }

                const id = strings.skillCommands[tokens.slice(1).join(" ").toLowerCase()];

                if (id) this.game.requestMagicSkillUse(id, type === 25, type === 26);
                break;
            }
            case 27: case 28: case 29: {
                const page = parseInt(tokens[1], 10), slot = parseInt(tokens[2], 10);

                if (page >= 1 && page <= 10 && slot >= 1 && slot <= 12) this.useShortCut(page - 1, slot - 1, type === 28, type === 29);
                break;
            }
            case 0: case 52: case 77: case 81: case 88: case 89: case 90: case 93: case 96: case 97: case 100: case 109: this.game.requestUserCommand(type); break;
            default: debugger; break;
        }
    }
    public sendBypassBuildCmd(command: string) { this.game.sendBypassBuildCmd(command); }
    public bypass(command: string) { this.game.requestBypassToServer(command); }
    public link(link: string) { this.game.requestLinkHtml(link); }
    public requestRestartPoint(type: number) { this.game.requestRestartPoint(type); }
    public cancelTarget() { this.game.requestTargetCanceld(); }

    public requestMoveTo(point: Vector3) {
        const player = this.manGame.getComponent("render").player;

        this.game.moveBackwardToLocation(point, player.position);
    }

    public requestAction(actor: BaseActor, isShift: boolean = false) {
        const object = this.findObjectByActor(actor);

        if (!object) return false;

        this.game.action(object.objectId, this.manGame.getComponent("render").player.position, isShift);

        return true;
    }

    public requestPetAction(objectId: number, isShift: boolean) {
        if (objectId <= 0 || !this.objects.get(this.userId)) return;

        this.game.action(objectId, this.manGame.getComponent("render").player.position, isShift);
    }

    public getPickup(raycaster: Raycaster, maxDistance: number): GroundPickup {
        let nearest: GroundPickup = null;

        for (const pickup of this.pickups.values()) {
            const distance = pickup.getPickDistance(raycaster);

            if (distance >= maxDistance) continue;

            nearest = pickup;
            maxDistance = distance;
        }

        return nearest;
    }

    public isMouseOverUI(x: number, y: number) { return this.ui ? this.ui.isMouseOver(x, y) : false; }

    public getMouseCursor(actor: BaseActor): number {
        if (!this.inWorld) return 0;

        const object = actor ? this.findObjectByActor(actor) : null;

        if (actor && !object) return 0;
        if (this.ui.getInputModifiers()[0]) return 1;
        if (!object || object.objectId !== this.getTargetId()) return 0;

        // shortcut: target relationship cursor overrides are not applied, add after tracing NWindow 0x1007d998..0x1007d9e1.
        if (!object.isDead && object.isAttackable) return 1;
        if (!object.isDead && object.kind === "npc") return 2;

        switch (object.privateStoreType) {
            case GamePackets.PrivateStoreType_T.STORE_PRIVATE_SELL:
            case GamePackets.PrivateStoreType_T.STORE_PRIVATE_BUY:
            case GamePackets.PrivateStoreType_T.STORE_PRIVATE_MANUFACTURE:
            case GamePackets.PrivateStoreType_T.STORE_PRIVATE_PACKAGE_SELL: return 2;
            default: return 0;
        }
    }

    public requestPickup(raycaster: Raycaster, maxDistance: number, isShift: boolean = false): boolean {
        const nearest = this.getPickup(raycaster, maxDistance);

        if (!nearest) return false;

        this.game.action(nearest.objectId, this.manGame.getComponent("render").player.position, isShift);
        return true;
    }

    protected getNextEnemy(radius: number, excluded: number): NetObject_T { // Engine 0x10421350.
        const player = this.objects.get(this.userId);

        if (!player || !player.actor) return null;
        if (this.gnoCategory !== 2) {
            this.gnoCategory = 2;
            this.gnoObjectId = -1;
            this.gnoElapsed = 0;
        }

        const previous = this.objects.get(this.gnoObjectId);
        const distance = previous && previous.actor ? getDistance(previous.actor.position, player.actor.position) : -1;
        const lower = distance > 0 ? distance : 0;
        let nearest: NetObject_T = null, next: NetObject_T = null, nearestDistance = radius, nextDistance = radius;

        for (const object of this.objects.values()) {
            if (!object.isAttackable || object.isDead || !object.actor || object.objectId === excluded) continue;

            const distance = getDistance(object.actor.position, player.actor.position);

            if (!(distance >= 0)) continue;
            if (distance < nearestDistance) { nearest = object; nearestDistance = distance; }
            if (distance > lower && distance < nextDistance) { next = object; nextDistance = distance; }
        }

        const result = next || nearest;

        if (result) this.gnoObjectId = result.objectId;
        return result;
    }

    protected getNearestItem(radius: number, excluded: number, sourceId: number = this.userId): GroundPickup { // Engine 0x104211c0 / pet 0x103f9980.
        const player = this.objects.get(sourceId);

        if (!player || !player.actor) return null;

        let nearest: GroundPickup = null, nearestDistance = radius;

        for (const pickup of this.pickups.values()) {
            if (pickup.objectId === excluded) continue;

            const distance = getDistance(pickup.position, player.actor.position);

            if (distance >= 0 && distance < nearestDistance) { nearest = pickup; nearestDistance = distance; }
        }

        return nearest;
    }

    protected updateGNOManager(deltaTime: number) { // Engine 0x103f9940.
        this.gnoElapsed = Math.fround(this.gnoElapsed + Math.fround(deltaTime / 1000));
        if (this.gnoElapsed > 3) { this.gnoCategory = this.gnoElapsed = 0; this.gnoObjectId = -1; }
    }

    protected findObjectByActor(actor: BaseActor): NetObject_T {
        for (const object of this.objects.values())
            if (object.actor === actor) return object;

        return null;
    }

    protected async onDisconnected(reason: string) {
        if (this.gmTransfer) this.gmTransfer.error = reason;
        this.leaveWorld();
        this.game = null;
        this.ui.showMessage(reason);
        await this.showLogin(this.loginUrl);
        this.ui.showMessage(reason);
    }

    protected leaveWorld() {
        const render = this.manGame.getComponent("render");

        render.clearViewportWindowParam();
        render.setZoneMusicEnabled(false);

        for (const object of this.objects.values()) {
            object.isRemoved = true;

            if (object.actor && object.kind !== "user") render.removePawn(object.actor);
        }

        this.objects.clear();
        this.doors.clear();
        this.doorPositions.clear();
        this.staticObjects.clear();
        this.appearances.clear();
        const cubics = render.player.findComponent<PawnCubicComponent>("pawnCubic");

        if (cubics) render.player.removeComponent(cubics);
        const abnormal = render.player.findComponent<PawnAbnormalComponent>("pawnAbnormal");

        if (abnormal) render.player.removeComponent(abnormal);
        const fishing = render.player.findComponent<PawnFishingComponent>("pawnFishing");

        if (fishing) render.player.removeComponent(fishing);
        for (const pickup of this.pickups.values()) render.removePickup(pickup);
        this.pickups.clear();
        this.gnoCategory = this.gnoElapsed = 0;
        this.gnoObjectId = -1;
        this.inventory.clear();
        this.shortcuts.clear();
        this.autoSoulShots.clear();
        this.ui.clearShortCuts();
        this.ui.setInventory([]);
        this.skills.clear();
        this.ui.setSkills([]);
        this.questStates.clear();
        this.ui.setQuestStates([]);
        this.hennaStatus = null;
        this.ui.setHenna(null);
        this.isMacroListComplete = true;
        this.macroListReceived = 0;
        this.macros.clear();
        this.macroExecutions.clear();
        this.ui.setMacros([]);
        this.friends.clear();
        this.partyMembers.clear();
        this.partyPositions.clear();
        this.partyInvite = null;
        this.pledgeInvite = null;
        this.friendInvite = null;
        this.partyJoinResult = -1;
        this.pledgeJoinId = 0;
        this.partyLeaderId = 0;
        this.partyLootDistribution = 0;
        this.clanInfo = null;
        this.pledgeInfos.clear();
        this.clanMembers.clear();
        this.ui.setClan(null);
        this.ui.clearClanMembers();
        this.aquireSkillFishing = false;
        this.aquireSkills = [];
        this.aquireSkillInfo = null;
        this.tradePartnerId = 0;
        this.tradeRequestId = 0;
        this.tradeOwnItems.length = 0;
        this.tradeOtherItems.length = 0;
        this.tradeAvailableItems.length = 0;
        this.tradeDone = 0;
        this.shopSellMoney = 0;
        this.shopSellNpcId = 0;
        this.shopSellItems.length = 0;
        this.shopBuyMoney = 0;
        this.shopBuyListId = 0;
        this.shopBuyItems.length = 0;
        this.storageMaxCount = null;
        this.etcStatus = null;
        this.signsSky = 0;
        this.petStatusType = -1;
        Object.assign(this.petInfo, { objectId: -1, name: "", field60: 0, isMountable: false });
        this.isMounted = false;
        this.ui.setMountable(false);
        this.petInventory.clear();
        this.petRemainTime = null;
        this.abnormalStatuses.length = 0;
        this.shortBuff = null;
        this.allyInvite = null;
        this.pledgePower = new Uint8Array(32);
        this.pledgeWarStart = null;
        this.pledgeWarStop = null;
        this.pledgeWarSurrender = null;
        this.pledgeCrests.clear();
        this.pledgeLargeCrests.clear();
        this.clanLargeCrestIds.clear();
        this.allyCrests.clear();
        this.warehouseDeposit = null;
        this.warehouseWithdraw = null;
        this.privateStoreManageSell = null;
        this.privateStoreSell = null;
        this.privateStoreManageBuy = null;
        this.privateStoreBuy = null;
        this.privateStoreSellMsgs.clear();
        this.privateStoreBuyMsgs.clear();
        this.packageTargets.clear();
        this.packageSendable = null;
        this.multiSell = null;
        this.shopPreview = null;
        this.shopPreviewItems = null;
        this.seedShop = null;
        this.cropProcure = null;
        this.vehicles.clear();
        this.mounts.clear();
        this.observation = null;
        this.specialCamera = null;
        this.cameraMode = 0;
        this.radarMarkers.length = 0;
        this.townMap = null;
        this.calculatorId = 0;
        this.xmasSealItemId = 0;
        this.dice = null;
        this.monRace = null;
        this.ssqStatus.clear();
        this.clanHallDecoration = null;
        this.siegeInfo = null;
        this.siegeAttackers = null;
        this.siegeDefenders = null;
        this.manGame.getComponent("render").player.visible = true;
        this.recipeBook = null;
        this.recipeItemMakeInfo = null;
        this.recipeShopManageList = null;
        this.recipeShopSellList = null;
        this.recipeShopItemInfo = null;
        this.recipeShopMessages.clear();
        this.hennaEquipList = null;
        this.hennaItemInfo = null;
        this.partyMatchRooms = [];
        this.partyMatchPage = 1;
        this.partyMatchDetail = null;
        this.partyEffects.clear();
        this.tutorialQuestionMarks.clear();
        this.tutorialClientEvents = 0;
        this.gmCharacterInfo = null;
        this.gmPledgeInfo = null;
        this.gmSkillInfo = null;
        this.gmQuestList = null;
        this.gmItemList = null;
        this.gmWarehouseList = null;
        this.gmHennaStatus = null;
        this.snoops.clear();
        this.enchantSkills = [];
        this.enchantSkillInfo = null;
        this.eventMatchMessageType = -1;
        this.questMarkId = 0;
        this.hasNewMail = false;
        this.heroes = [];
        this.partyRoomMode = -1;
        this.partyRoomMembers.clear();
        this.isInCommandChannel = false;
        this.commandChannel = null;
        this.ui.closeCommandChannel();
        this.commandChannelInviter = null;
        this.olympiadMode = 0;
        this.olympiadUsers.clear();
        this.olympiadEffects.clear();
        this.manors = [];
        this.manorSeedInfo = null;
        this.manorCropInfo = null;
        this.manorDefaultCrops = [];
        this.manorSeedSettings = null;
        this.manorCropSettings = null;
        this.manorSellCrops = null;
        this.manorProcureCropDetail = null;
        this.ui.hideWorld();
        this.inWorld = false;
        this.teleportGeneration++;
        this.teleportInfoPending = false;
        this.userId = 0;
    }

    protected onPacket(opcode: GamePackets.GameServerPacket_T, packet: PacketReader) {
        switch (opcode) {
            case GamePackets.GameServerPacket_T.KeyPacket:
                this.inventoryOrderNamespace = packet.d(); // Engine 0x103fe0ba, NWindow 0x10065d4d.
                this.game.authLogin(this.account, this.sessionKey);
                break;
            case GamePackets.GameServerPacket_T.AuthLoginFail: {
                const message = `Game server refused the session (reason ${packet.d()}).`;

                if (this.gmTransfer) this.gmTransfer.error = message;
                this.ui.showMessage(message);
                break;
            }
            case GamePackets.GameServerPacket_T.CharSelectInfo:
                this.login.close();
                this.characters = GamePackets.readCharSelectInfo(packet).slice(0, 7);
                void this.showLobby();
                break;
            case GamePackets.GameServerPacket_T.CharTemplates:
                this.templates = GamePackets.readCharTemplates(packet);
                this.ui.showCreateCharacter(this.templates);
                this.lobby.showCreate();
                break;
            case GamePackets.GameServerPacket_T.CharCreateOk: this.onCharCreateOk(packet); break;
            case GamePackets.GameServerPacket_T.CharCreateFail: this.ui.showMessage(this.ui.getSystemMessage([128, 77, 79, 80, 204][packet.d()])); break; // NWindow 0x100658f0
            case GamePackets.GameServerPacket_T.CharDeleteOk: this.onCharDeleteOk(packet); break;
            case GamePackets.GameServerPacket_T.CharDeleteFail: this.ui.showMessage(this.ui.getSystemMessage([undefined, 306, 541, 540][packet.d()])); break; // NWindow 0x10065b40
            case GamePackets.GameServerPacket_T.ActionFailed: this.onActionFailed(); break;
            case GamePackets.GameServerPacket_T.CharSelected: this.onCharSelected(packet); break;
            case GamePackets.GameServerPacket_T.UserInfo: this.onUserInfo(packet); break;
            case GamePackets.GameServerPacket_T.ItemList: this.onItemList(packet); break;
            case GamePackets.GameServerPacket_T.InventoryUpdate: this.onInventoryUpdate(packet); break;
            case GamePackets.GameServerPacket_T.TradeStart: this.onTradeStart(packet); break;
            case GamePackets.GameServerPacket_T.TradeOwnAdd: this.onTradeOwnAdd(packet); break;
            case GamePackets.GameServerPacket_T.TradeOtherAdd: this.onTradeOtherAdd(packet); break;
            case GamePackets.GameServerPacket_T.SendTradeDone: this.onSendTradeDone(packet); break;
            case GamePackets.GameServerPacket_T.SendTradeRequest: this.onSendTradeRequest(packet); break;
            case GamePackets.GameServerPacket_T.TradeUpdate: this.onTradeUpdate(packet); break;
            case GamePackets.GameServerPacket_T.SkillList: this.onSkillList(packet); break;
            case GamePackets.GameServerPacket_T.SkillCoolTime: this.onSkillCoolTime(packet); break;
            case GamePackets.GameServerPacket_T.QuestList: this.onQuestList(packet); break;
            case GamePackets.GameServerPacket_T.HennaInfo: this.onHennaInfo(packet); break;
            case GamePackets.GameServerPacket_T.SendMacroList: this.onSendMacroList(packet); break;
            case GamePackets.GameServerPacket_T.EtcStatusUpdate: this.onEtcStatusUpdate(packet); break;
            case GamePackets.GameServerPacket_T.SignsSky: this.onSignsSky(packet); break;
            case GamePackets.GameServerPacket_T.FriendList: this.onFriendList(packet); break;
            case GamePackets.GameServerPacket_T.FriendRecvMsg: this.onFriendRecvMsg(packet); break;
            case GamePackets.GameServerPacket_T.MagicEffectIcons: this.onMagicEffectIcons(packet); break;
            case GamePackets.GameServerPacket_T.ShortBuffStatusUpdate: this.onShortBuffStatusUpdate(packet); break;
            case GamePackets.GameServerPacket_T.CharInfo: this.onCharInfo(packet); break;
            case GamePackets.GameServerPacket_T.NpcInfo: this.onNpcInfo(packet); break;
            case GamePackets.GameServerPacket_T.PetInfo: this.onPetInfo(packet); break;
            case GamePackets.GameServerPacket_T.PetItemList: this.onPetItemList(packet); break;
            case GamePackets.GameServerPacket_T.PetInventoryUpdate: this.onPetInventoryUpdate(packet); break;
            case GamePackets.GameServerPacket_T.PetStatusUpdate: this.onPetStatusUpdate(packet); break;
            case GamePackets.GameServerPacket_T.PetDelete: this.onPetDelete(packet); break;
            case GamePackets.GameServerPacket_T.SpawnItem: void this.onSpawnItem(packet, false); break;
            case GamePackets.GameServerPacket_T.DropItem: void this.onSpawnItem(packet, true); break;
            case GamePackets.GameServerPacket_T.GetItem: this.onGetItem(packet); break;
            case GamePackets.GameServerPacket_T.DeleteObject: this.removeObject(packet.d()); break;
            case GamePackets.GameServerPacket_T.CharMoveToLocation: this.onMoveToLocation(packet); break;
            case GamePackets.GameServerPacket_T.MoveToPawn: this.onMoveToPawn(packet); break;
            case GamePackets.GameServerPacket_T.StopMove: this.onStopMove(packet); break;
            case GamePackets.GameServerPacket_T.ValidateLocation: this.onValidateLocation(packet); break;
            case GamePackets.GameServerPacket_T.BeginRotation: this.onBeginRotation(packet); break;
            case GamePackets.GameServerPacket_T.StopRotation: this.onStopRotation(packet); break;
            case GamePackets.GameServerPacket_T.TeleportToLocation: this.onTeleport(packet); break;
            case GamePackets.GameServerPacket_T.Attack: this.onAttack(packet); break;
            case GamePackets.GameServerPacket_T.MagicSkillUse: this.onMagicSkillUse(packet); break;
            case GamePackets.GameServerPacket_T.MagicSkillCanceld: {
                const objectId = packet.d(), object = this.objects.get(objectId);

                if (object && object.actor === this.manGame.getComponent("render").player) this.notifyMacroSkill(0, 1);
                this.stopSkill(objectId);
                break;
            }
            case GamePackets.GameServerPacket_T.MagicSkillLaunched: this.onMagicSkillLaunched(packet); break;
            case GamePackets.GameServerPacket_T.Die: this.onDie(packet); break;
            case GamePackets.GameServerPacket_T.Revive: this.onRevive(packet.d()); break;
            case GamePackets.GameServerPacket_T.Earthquake: void this.onEarthquake(packet); break;
            case GamePackets.GameServerPacket_T.ChangeMoveType: this.onChangeMoveType(packet.d(), packet.d() !== 0); break;
            case GamePackets.GameServerPacket_T.ChangeWaitType: this.onChangeWaitType(packet); break;
            case GamePackets.GameServerPacket_T.ChairSit: this.onChairSit(packet); break;
            case GamePackets.GameServerPacket_T.AutoAttackStart: this.onCombatState(packet.d(), true); break;
            case GamePackets.GameServerPacket_T.AutoAttackStop: this.onCombatState(packet.d(), false); break;
            case GamePackets.GameServerPacket_T.SocialAction: this.onSocialAction(packet.d(), packet.d()); break;
            case GamePackets.GameServerPacket_T.MyTargetSelected: {
                const targetId = packet.d(), levelDifference = (packet.h() << 16) >> 16;

                this.nextTargetLock = false;
                this.setTarget(targetId, levelDifference);
                this.notifyMacroCommand([12, 13, 15], Math.fround(0.001));
                break;
            }
            case GamePackets.GameServerPacket_T.PartyMemberPosition: this.onPartyMemberPosition(packet); break;
            case GamePackets.GameServerPacket_T.TargetSelected: this.onTargetSelected(packet, true); break;
            case GamePackets.GameServerPacket_T.TargetUnselected: this.onTargetSelected(packet, false); break;
            case GamePackets.GameServerPacket_T.StatusUpdate: this.onStatusUpdate(packet); break;
            case GamePackets.GameServerPacket_T.CreatureSay: this.onCreatureSay(packet); break;
            case GamePackets.GameServerPacket_T.EquipUpdate: this.onEquipUpdate(packet); break;
            case GamePackets.GameServerPacket_T.DoorInfo: this.onDoorInfo(packet); break;
            case GamePackets.GameServerPacket_T.DoorStatusUpdate: this.onDoorStatusUpdate(packet); break;
            case GamePackets.GameServerPacket_T.PartySmallWindowAll: this.onPartySmallWindowAll(packet); break;
            case GamePackets.GameServerPacket_T.PartySmallWindowAdd: this.onPartySmallWindowAdd(packet); break;
            case GamePackets.GameServerPacket_T.PartySmallWindowDeleteAll: this.onPartySmallWindowDeleteAll(packet); break;
            case GamePackets.GameServerPacket_T.PartySmallWindowDelete: this.onPartySmallWindowDelete(packet); break;
            case GamePackets.GameServerPacket_T.PartySmallWindowUpdate: this.onPartySmallWindowUpdate(packet); break;
            case GamePackets.GameServerPacket_T.AskJoinPledge: this.onAskJoinPledge(packet); break;
            case GamePackets.GameServerPacket_T.JoinPledge: this.onJoinPledge(packet); break;
            case GamePackets.GameServerPacket_T.AskJoinParty: this.onAskJoinParty(packet); break;
            case GamePackets.GameServerPacket_T.JoinParty: this.onJoinParty(packet); break;
            case GamePackets.GameServerPacket_T.AskJoinFriend: this.onAskJoinFriend(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowMemberListAll: this.onPledgeShowMemberListAll(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowMemberListUpdate: this.onPledgeShowMemberListUpdate(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowMemberListAdd: this.onPledgeShowMemberListAdd(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowMemberListDelete: this.onPledgeShowMemberListDelete(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowMemberListDeleteAll: this.onPledgeShowMemberListDeleteAll(packet); break;
            case GamePackets.GameServerPacket_T.PledgeInfo: this.onPledgeInfo(packet); break;
            case GamePackets.GameServerPacket_T.ServerObjectInfo: this.onServerObjectInfo(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowInfoUpdate: this.onPledgeShowInfoUpdate(packet); break;
            case GamePackets.GameServerPacket_T.AquireSkillList: this.onAquireSkillList(packet); break;
            case GamePackets.GameServerPacket_T.AquireSkillInfo: this.onAquireSkillInfo(packet); break;
            case GamePackets.GameServerPacket_T.AquireSkillDone: this.onAquireSkillDone(packet); break;
            case GamePackets.GameServerPacket_T.NpcSay: this.onNpcSay(packet); break;
            case GamePackets.GameServerPacket_T.PetStatusShow: this.onPetStatusShow(packet); break;
            case GamePackets.GameServerPacket_T.SetSummonRemainTime: this.onSetSummonRemainTime(packet); break;
            case GamePackets.GameServerPacket_T.SellList: this.onSellList(packet); break;
            case GamePackets.GameServerPacket_T.BuyList: this.onBuyList(packet); break;
            case GamePackets.GameServerPacket_T.PlaySound: void this.onPlaySound(packet); break;
            case GamePackets.GameServerPacket_T.StaticObject: this.onStaticObject(packet); break;
            case GamePackets.GameServerPacket_T.ShowMiniMap: this.ui.showMap(packet.d()); break;
            case GamePackets.GameServerPacket_T.TutorialShowHtml: this.ui.showHtml(packet.S()); break;
            case GamePackets.GameServerPacket_T.TutorialCloseHtml: this.ui.hideHtml(); break;
            case GamePackets.GameServerPacket_T.NicknameChanged: this.onNicknameChanged(packet); break;
            case GamePackets.GameServerPacket_T.PledgeStatusChanged: this.onPledgeStatusChanged(packet); break;
            case GamePackets.GameServerPacket_T.RelationChanged: this.onRelationChanged(packet); break;
            case GamePackets.GameServerPacket_T.SetupGauge: this.ui.setupGauge(packet.d(), packet.d(), packet.d()); break;
            case GamePackets.GameServerPacket_T.ShowBoard: this.onShowBoard(packet); break;
            case GamePackets.GameServerPacket_T.ChooseInventoryItem: this.onChooseInventoryItem(packet); break;
            case GamePackets.GameServerPacket_T.EnchantResult: this.onEnchantResult(packet); break;
            case GamePackets.GameServerPacket_T.SystemMessage: this.onSystemMessage(packet); break;
            case GamePackets.GameServerPacket_T.ConfirmDlg: this.onConfirmDlg(packet); break;
            case GamePackets.GameServerPacket_T.NpcHtmlMessage: this.onNpcHtmlMessage(packet); break;
            case GamePackets.GameServerPacket_T.ShortCutInit:
                this.shortcuts.clear();
                this.ui.clearShortCuts();

                for (let i = 0, count = packet.d(); i < count; i++) this.setShortCut(GamePackets.readShortCut(packet));
                break;
            case GamePackets.GameServerPacket_T.ShortCutRegister: this.setShortCut(GamePackets.readShortCut(packet)); break;
            case GamePackets.GameServerPacket_T.ManagePledgePower: this.onManagePledgePower(packet); break;
            case GamePackets.GameServerPacket_T.StartPledgeWar: this.pledgeWarStart = GamePackets.readPledgeWar(packet, true); break;
            case GamePackets.GameServerPacket_T.StopPledgeWar: this.pledgeWarStop = GamePackets.readPledgeWar(packet, false); break;
            case GamePackets.GameServerPacket_T.SurrenderPledgeWar: this.pledgeWarSurrender = GamePackets.readPledgeWar(packet, false); break;
            case GamePackets.GameServerPacket_T.PledgeCrest: this.onPledgeCrest(packet); break;
            case GamePackets.GameServerPacket_T.AskJoinAlly: this.onAskJoinAlly(packet); break;
            case GamePackets.GameServerPacket_T.AllyCrest: this.onAllyCrest(packet); break;
            case GamePackets.GameServerPacket_T.WareHouseDepositList: this.warehouseDeposit = GamePackets.readWarehouseList(packet); this.ui.showWarehouse(false, this.warehouseDeposit); break;
            case GamePackets.GameServerPacket_T.WareHouseWithdrawalList: this.warehouseWithdraw = GamePackets.readWarehouseList(packet); this.ui.showWarehouse(true, this.warehouseWithdraw); break;
            case GamePackets.GameServerPacket_T.WareHouseDone: this.onWareHouseDone(packet); break;
            case GamePackets.GameServerPacket_T.PrivateStoreManageListSell: this.onPrivateStoreManageListSell(packet); break;
            case GamePackets.GameServerPacket_T.PrivateStoreListSell: this.privateStoreSell = GamePackets.readPrivateStoreListSell(packet); this.ui.showPrivateStoreSell(this.privateStoreSell); break;
            case GamePackets.GameServerPacket_T.PrivateStoreMsgSell: this.onPrivateStoreMsg(packet, this.privateStoreSellMsgs); break;
            case GamePackets.GameServerPacket_T.PrivateStoreManageListBuy: this.onPrivateStoreManageListBuy(packet); break;
            case GamePackets.GameServerPacket_T.PrivateStoreListBuy: this.privateStoreBuy = GamePackets.readPrivateStoreListBuy(packet); this.ui.showPrivateStoreBuy(this.privateStoreBuy); break;
            case GamePackets.GameServerPacket_T.PrivateStoreMsgBuy: this.onPrivateStoreMsg(packet, this.privateStoreBuyMsgs); break;
            case GamePackets.GameServerPacket_T.PackageToList: this.onPackageToList(packet); break;
            case GamePackets.GameServerPacket_T.PackageSendableList: this.packageSendable = GamePackets.readPackageSendableList(packet); this.ui.showPackage(this.packageSendable); break;
            case GamePackets.GameServerPacket_T.MultiSellList: this.onMultiSellList(packet); break;
            case GamePackets.GameServerPacket_T.ShopPreviewList: this.shopPreview = GamePackets.readShopPreviewList(packet); this.ui.showPreviewShop(this.shopPreview); break;
            case GamePackets.GameServerPacket_T.ShopPreviewInfo: this.onShopPreviewInfo(packet); break;
            case GamePackets.GameServerPacket_T.BuyListSeed:
                this.seedShop = GamePackets.readBuyListSeed(packet);
                this.ui.showManorShop(this.seedShop, false);
                break;
            case GamePackets.GameServerPacket_T.SellListProcure:
                this.cropProcure = GamePackets.readSellListProcure(packet);
                this.ui.showManorShop(this.cropProcure, true);
                break;
            case GamePackets.GameServerPacket_T.VehicleInfo: this.onVehicleLocation(packet, true); break;
            case GamePackets.GameServerPacket_T.OnVehicleCheckLocation: this.onVehicleLocation(packet, false); break;
            case GamePackets.GameServerPacket_T.VehicleDeparture: this.onVehicleDeparture(packet); break;
            case GamePackets.GameServerPacket_T.VehicleStarted: this.onVehicleStarted(packet); break;
            case GamePackets.GameServerPacket_T.GetOnVehicle: this.onGetOnVehicle(packet); break;
            case GamePackets.GameServerPacket_T.GetOffVehicle: this.onGetOffVehicle(packet); break;
            case GamePackets.GameServerPacket_T.MoveToLocationInVehicle: this.onMoveToLocationInVehicle(packet); break;
            case GamePackets.GameServerPacket_T.StopMoveInVehicle:
            case GamePackets.GameServerPacket_T.ValidateLocationInVehicle: this.onStopMoveInVehicle(packet); break;
            case GamePackets.GameServerPacket_T.Ride: this.onRide(packet); break;
            case GamePackets.GameServerPacket_T.FlyToLocation: this.onFlyToLocation(packet); break;
            case GamePackets.GameServerPacket_T.SpecialCamera: this.specialCamera = GamePackets.readSpecialCamera(packet); break;
            case GamePackets.GameServerPacket_T.NormalCamera: this.specialCamera = null; break; // OnNormalCamera 0x7473c0 -> ReleaseSpecialViewTarget.
            case GamePackets.GameServerPacket_T.CameraMode: this.cameraMode = packet.d(); break;
            case GamePackets.GameServerPacket_T.ObservationMode: this.onObservationMode(packet); break;
            case GamePackets.GameServerPacket_T.ObservationReturn: this.onObservationReturn(packet); break;
            case GamePackets.GameServerPacket_T.RadarControl: this.onRadarControl(packet); break;
            case GamePackets.GameServerPacket_T.ShowTownMap: this.townMap = GamePackets.readTownMap(packet); break;
            case GamePackets.GameServerPacket_T.ShowCalculator: this.calculatorId = packet.d(); break;
            case GamePackets.GameServerPacket_T.ShowXMasSeal: this.xmasSealItemId = packet.d(); break;
            case GamePackets.GameServerPacket_T.Dice: this.dice = GamePackets.readDice(packet); break;
            case GamePackets.GameServerPacket_T.MonRaceInfo: this.monRace = GamePackets.readMonRaceInfo(packet); break;
            case GamePackets.GameServerPacket_T.SSQStatus: this.onSSQStatus(packet); break;
            case GamePackets.GameServerPacket_T.ClanHallDecoration: this.clanHallDecoration = GamePackets.readClanHallDecoration(packet); break;
            case GamePackets.GameServerPacket_T.SiegeInfo: this.siegeInfo = GamePackets.readSiegeInfo(packet); break;
            case GamePackets.GameServerPacket_T.SiegeAttackerList: this.siegeAttackers = GamePackets.readSiegeClanList(packet, false); break;
            case GamePackets.GameServerPacket_T.SiegeDefenderList: this.siegeDefenders = GamePackets.readSiegeClanList(packet, true); break;
            case GamePackets.GameServerPacket_T.GameGuardQuery: this.onGameGuardQuery(packet); break;
            case GamePackets.GameServerPacket_T.RecipeBookItemList: this.recipeBook = GamePackets.readRecipeBookItemList(packet); this.ui.showRecipeBook(this.recipeBook); break;
            case GamePackets.GameServerPacket_T.RecipeItemMakeInfo: this.recipeItemMakeInfo = GamePackets.readRecipeItemMakeInfo(packet); this.ui.showRecipeManufacture(this.recipeItemMakeInfo); break;
            case GamePackets.GameServerPacket_T.RecipeShopManageList: this.recipeShopManageList = GamePackets.readRecipeShopManageList(packet); this.ui.showRecipeShopManage(this.recipeShopManageList); break;
            case GamePackets.GameServerPacket_T.RecipeShopSellList: this.recipeShopSellList = GamePackets.readRecipeShopSellList(packet); this.ui.showRecipeShopSellList(this.recipeShopSellList); break;
            case GamePackets.GameServerPacket_T.RecipeShopItemInfo: this.recipeShopItemInfo = GamePackets.readRecipeShopItemInfo(packet); this.ui.showRecipeShopItemInfo(this.recipeShopItemInfo); break;
            case GamePackets.GameServerPacket_T.RecipeShopMsg: this.onRecipeShopMsg(packet); break;
            case GamePackets.GameServerPacket_T.HennaEquipList: this.hennaEquipList = GamePackets.readHennaEquipList(packet); this.ui.showHennaList(this.hennaEquipList); break;
            case GamePackets.GameServerPacket_T.HennaItemInfo: this.hennaItemInfo = GamePackets.readHennaItemInfo(packet); this.ui.showHennaInfo(this.hennaItemInfo); break;
            case GamePackets.GameServerPacket_T.HennaUnequipList: this.ui.showHennaList(GamePackets.readHennaEquipList(packet), true); break;
            case GamePackets.GameServerPacket_T.HennaUnequipInfo: this.ui.showHennaInfo(GamePackets.readHennaItemInfo(packet), true); break;
            case GamePackets.GameServerPacket_T.PartyMatchList: {
                const list = GamePackets.readPartyMatchList(packet);

                this.partyMatchRooms = list.rooms;
                this.partyMatchPage = list.page;
                this.ui.showPartyMatchList(list);
                break;
            }
            case GamePackets.GameServerPacket_T.PartyMatchDetail:
                this.partyMatchDetail = GamePackets.readPartyMatchDetail(packet);
                this.ui.showPartyMatchDetail(this.partyMatchDetail);
                break;
            case GamePackets.GameServerPacket_T.PartySpelled: this.onPartySpelled(packet); break;
            case GamePackets.GameServerPacket_T.TutorialShowQuestionMark: this.tutorialQuestionMarks.add(packet.d()); break;
            case GamePackets.GameServerPacket_T.TutorialEnableClientEvent: this.tutorialClientEvents = packet.d(); break;
            case GamePackets.GameServerPacket_T.GMViewCharacterInfo: this.gmCharacterInfo = GamePackets.readGMViewCharacterInfo(packet); this.updateGMCharacterInfo(); break;
            case GamePackets.GameServerPacket_T.GMViewPledgeInfo: this.gmPledgeInfo = GamePackets.readGMViewPledgeInfo(packet); this.ui.setGMPledgeInfo(this.gmPledgeInfo); break;
            case GamePackets.GameServerPacket_T.GMViewSkillInfo: this.gmSkillInfo = GamePackets.readGMViewSkillInfo(packet); this.ui.setGMSkillInfo(this.gmSkillInfo); break;
            case GamePackets.GameServerPacket_T.GMViewQuestList: this.gmQuestList = GamePackets.readGMViewQuestList(packet); this.ui.setGMQuestList(this.gmQuestList); break;
            case GamePackets.GameServerPacket_T.GMViewItemList: this.gmItemList = GamePackets.readGMViewItemList(packet); this.ui.setGMInventoryInfo(this.gmItemList); break;
            case GamePackets.GameServerPacket_T.GMViewWarehouseWithdrawList: this.gmWarehouseList = GamePackets.readGMViewWarehouseWithdrawList(packet); this.ui.setGMWarehouseInfo(this.gmWarehouseList); break;
            case GamePackets.GameServerPacket_T.GMViewHennaInfo: this.gmHennaStatus = GamePackets.readGMViewHennaInfo(packet); break;
            case GamePackets.GameServerPacket_T.Snoop: this.onSnoop(packet); break;
            case GamePackets.GameServerPacket_T.Extended:
                switch (packet.h()) {
                    case GamePackets.GameServerExPacket_T.ExAutoSoulShot: this.onAutoSoulShot(packet); break;
                    case GamePackets.GameServerExPacket_T.ExStorageMaxCount: this.onStorageMaxCount(packet); break;
                    case GamePackets.GameServerExPacket_T.ExPledgeCrestLarge: this.onPledgeCrestLarge(packet); break;
                    case GamePackets.GameServerExPacket_T.ExEventMatchMessage: this.onEventMatchMessage(packet); break;
                    case GamePackets.GameServerExPacket_T.ExPartyRoomMember: this.onPartyRoomMember(packet); break;
                    case GamePackets.GameServerExPacket_T.ExClosePartyRoom: this.onClosePartyRoom(packet); break;
                    case GamePackets.GameServerExPacket_T.ExManagePartyRoomMember: this.onManagePartyRoomMember(packet); break;
                    case GamePackets.GameServerExPacket_T.ExFishingStart: this.onFishingStart(packet); break;
                    case GamePackets.GameServerExPacket_T.ExFishingEnd: this.onFishingEnd(packet); break;
                    case GamePackets.GameServerExPacket_T.ExFishingStartCombat: this.onFishingStartCombat(packet); break;
                    case GamePackets.GameServerExPacket_T.ExFishingHpRegen: this.onFishingHpRegen(packet); break;
                    case GamePackets.GameServerExPacket_T.ExEnchantSkillList:
                        this.enchantSkills = GamePackets.readEnchantSkillList(packet);
                        this.ui.showEnchantSkillList(this.enchantSkills);
                        break;
                    case GamePackets.GameServerExPacket_T.ExEnchantSkillInfo:
                        this.enchantSkillInfo = GamePackets.readEnchantSkillInfo(packet);
                        this.ui.showEnchantSkillInfo(this.enchantSkillInfo);
                        break;
                    case GamePackets.GameServerExPacket_T.ExQuestInfo: if (packet.getRemaining()) throw new Error("Invalid ExQuestInfo payload."); break;
                    case GamePackets.GameServerExPacket_T.ExShowQuestMark: this.onShowQuestMark(packet); break;
                    case GamePackets.GameServerExPacket_T.ExSendManorList: this.manors = GamePackets.readManorList(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowSeedInfo: this.manorSeedInfo = GamePackets.readShowSeedInfo(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowCropInfo: this.manorCropInfo = GamePackets.readShowCropInfo(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowManorDefaultInfo: this.manorDefaultCrops = GamePackets.readShowManorDefaultInfo(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowSeedSetting: this.manorSeedSettings = GamePackets.readShowSeedSetting(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowCropSetting: this.manorCropSettings = GamePackets.readShowCropSetting(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowSellCropList: this.manorSellCrops = GamePackets.readShowSellCropList(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowProcureCropDetail: this.manorProcureCropDetail = GamePackets.readShowProcureCropDetail(packet); break;
                    case GamePackets.GameServerExPacket_T.ExHeroList: this.heroes = GamePackets.readHeroList(packet); this.ui.showHeroList(this.heroes); break;
                    case GamePackets.GameServerExPacket_T.ExOpenMPCC: this.onOpenMPCC(packet); break;
                    case GamePackets.GameServerExPacket_T.ExCloseMPCC: this.onCloseMPCC(packet); break;
                    case GamePackets.GameServerExPacket_T.ExAskJoinMPCC: this.onAskJoinMPCC(packet); break;
                    case GamePackets.GameServerExPacket_T.ExMultiPartyCommandChannelInfo: this.commandChannel = GamePackets.readCommandChannelInfo(packet); this.ui.setCommandChannelInfo(this.commandChannel); break;
                    case GamePackets.GameServerExPacket_T.ExOlympiadUserInfo: { const info = GamePackets.readOlympiadUserInfo(packet); this.olympiadUsers.set(info.objectId, info); this.ui.setOlympiadUserInfo(info); break; }
                    case GamePackets.GameServerExPacket_T.ExOlympiadSpelledInfo: { const info = GamePackets.readOlympiadSpelledInfo(packet); this.olympiadEffects.set(info.objectId, info.effects); this.ui.setOlympiadEffects(info.objectId, info.effects); break; }
                    case GamePackets.GameServerExPacket_T.ExOlympiadMode: this.onOlympiadMode(packet); break;
                    case GamePackets.GameServerExPacket_T.ExOlympiadMatchEnd: this.onOlympiadMatchEnd(packet); break;
                    case GamePackets.GameServerExPacket_T.ExMailArrived: this.onMailArrived(packet); break;
                }
                break;
            case GamePackets.GameServerPacket_T.SunRise: this.manGame.getComponent("render").getEnvironment().setTimeOfDay(6); break;
            case GamePackets.GameServerPacket_T.SunSet: this.manGame.getComponent("render").getEnvironment().setTimeOfDay(0); break;
            case GamePackets.GameServerPacket_T.RestartResponse:
                if (packet.d() !== 0) { // Engine 0x104283d9 / 0x10480f82.
                    this.ui.saveInventoryOrder();
                    this.ui.clearQuestLocation();
                    this.leaveWorld();
                    if (this.gmTransfer && this.gmTransfer.phase === 2) this.gmTransfer.phase = 3;
                }
                break;
            case GamePackets.GameServerPacket_T.LeaveWorld:
            case GamePackets.GameServerPacket_T.ServerClose:
                this.game.close();
                void this.onDisconnected(opcode === GamePackets.GameServerPacket_T.LeaveWorld ? "Logged out." : "Server closed the session.");
                break;
        }
    }

    protected getMeshType(appearance: GamePackets.Appearance_T): number { // User::GetMeshType 0x736020, stored as Pawn.CharClassID.
        const { race, classId } = appearance, sex = appearance.sex !== 0 ? 1 : 0;

        switch (race) {
            case GamePackets.Race_T.HUMAN:
                if (classId <= 9 || classId >= 88 && classId <= 93) return sex;
                if (classId <= 17 || classId >= 94 && classId <= 98) return 8 + sex;
                return 5;
            case GamePackets.Race_T.ELF: return 6 + sex;
            case GamePackets.Race_T.DARK_ELF: return 2 + sex;
            case GamePackets.Race_T.ORC:
                if (classId >= 44 && classId <= 48 || classId >= 113 && classId <= 114) return 10 + sex;
                if (classId >= 49 && classId <= 52 || classId >= 115 && classId <= 116) return 12 + sex;
                return 5;
            case GamePackets.Race_T.DWARF: return 4 + sex;
            default: return 5;
        }
    }

    protected getCharacterIndex(appearance: GamePackets.Appearance_T): number {
        const isMystic = MYSTIC_BODY_CLASS_IDS.has(appearance.classId);
        let body: string;

        switch (appearance.race) {
            case GamePackets.Race_T.HUMAN: body = isMystic ? "Magic" : "Fighter"; break;
            case GamePackets.Race_T.ELF: body = "Elf"; break;
            case GamePackets.Race_T.DARK_ELF: body = "DarkElf"; break;
            case GamePackets.Race_T.ORC: body = isMystic ? "Shaman" : "Orc"; break;
            case GamePackets.Race_T.DWARF: body = "Dwarf"; break;
            default: throw new Error(`Unknown race '${appearance.race}'.`);
        }

        const name = (appearance.sex === 0 ? "M" : "F") + body;
        const group = this.charGroups.find(group => group.name === name);

        if (!group) throw new Error(`No character group named '${name}'.`);

        return group.index;
    }

    protected onCharCreateOk(packet: PacketReader) {
        if (packet.d() !== 1 || packet.getRemaining()) throw new Error("Invalid CharCreateOk payload.");
    }

    protected onCharDeleteOk(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid CharDeleteOk payload.");
    }

    protected getArmor(paperdoll: number[]): ICharacterArmorSelection {
        return { chest: paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST], legs: paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LEGS], gloves: paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_GLOVES], boots: paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_FEET] };
    }

    protected getAppearanceKey(appearance: GamePackets.Appearance_T) {
        const paperdoll = appearance.paperdoll;

        return [appearance.race, appearance.sex, appearance.classId, appearance.face, appearance.hairStyle, appearance.hairColor, appearance.enchantLevel, paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LEGS], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_GLOVES], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_FEET], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_RHAND], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LHAND], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LRHAND], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HEAD], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HAIR]].join(":");
    }

    protected loadAppearance(appearance: GamePackets.Appearance_T, actor: BaseActor): Promise<void> {
        const load = this.applyAppearance(appearance, actor);

        this.appearanceLoads.set(actor, load);

        return load;
    }

    protected async applyAppearance(appearance: GamePackets.Appearance_T, actor: BaseActor) {
        const asset = this.manGame.getComponent("asset");
        const paperdoll = appearance.paperdoll;
        const bodyKey = [appearance.race, appearance.sex, appearance.classId, appearance.face, appearance.hairStyle, appearance.hairColor, paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LEGS], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_GLOVES], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_FEET], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HEAD], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HAIR]].join(":");
        const isEquipmentOnly = this.bodyKeys.get(actor) === bodyKey;
        const request = (this.appearanceRequests.get(actor) || 0) + 1;

        this.appearanceRequests.set(actor, request);

        if (!isEquipmentOnly) this.bodyKeys.delete(actor);
        if (!this.charGroups) this.charGroups = await asset.getCharGroups();

        const index = this.getCharacterIndex(appearance);
        const group = this.charGroups.find(group => group.index === index);

        actor.charClassId = this.getMeshType(appearance);
        const hairStyle = group.hairStyles.includes(appearance.hairStyle) ? appearance.hairStyle : group.hairStyles[0];
        const colours = group.hairColours[hairStyle];

        const equipment = { enchantLevel: appearance.enchantLevel, rightHand: appearance.paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_RHAND] || appearance.paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LRHAND], leftHand: appearance.paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LHAND], head: appearance.paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HEAD], hair: appearance.paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HAIR] };

        if (isEquipmentOnly) await asset.loadCharacterEquipment(this.manGame.getComponent("render"), actor, index, hairStyle, equipment);
        else {
            await asset.loadCharacter(this.manGame.getComponent("render"), index, Math.min(appearance.face, group.faceVariants - 1), hairStyle, colours.includes(appearance.hairColor) ? appearance.hairColor : colours[0], this.getArmor(appearance.paperdoll), actor, equipment);

            if (this.appearanceRequests.get(actor) === request) this.bodyKeys.set(actor, bodyKey);
        }

        const object = this.findObjectByActor(actor);

        if (object) {
            actor.setUnrealScriptProperty("bNpc", object.kind === "npc");
            this.applySpeeds(actor, object.speeds, object.isRunning);
            this.setIdleAnimation(object);
            this.applyPartyMember(object);
        }

        if (!isEquipmentOnly && this.inWorld && actor === this.manGame.getComponent("render").player) void this.preloadSkills();
    }

    protected onCharSelected(packet: PacketReader) {
        const selected = GamePackets.readCharSelected(packet);
        const entry = this.characters[this.selectedSlot];
        const render = this.manGame.getComponent("render");
        const environment = render.getEnvironment();

        environment.setTimeOfDay(selected.gameTime / 60);
        environment.setTimeScale(GAME_TIME_SCALE);

        this.lobby.leave();
        render.player.teleportTo(setVector(new Vector3(), selected), true);
        this.manGame.getComponent("input").resetFollowCamera();

        void this.enterWorld(entry);
    }

    protected async enterWorld(entry: GamePackets.CharSelectEntry_T) {
        const render = this.manGame.getComponent("render");

        await this.loadAppearance(entry, render.player);

        this.userAppearanceLoad = null;
        this.skillListLoad = new Promise(resolve => this.resolveSkillList = resolve);
        this.game.enterWorld();
        this.game.requestSkillList();
        this.game.requestSkillCoolTime();
    }

    protected createObject(objectId: number, kind: NetObjectKind_T, info: GamePackets.CreatureInfo_T): NetObject_T {
        const object: NetObject_T = { objectId, selectedId: 0, clanId: 0, clanCrestId: 0, allyId: 0, allyCrestId: 0, kind, actor: null, isRemoved: false, position: setVector(new Vector3(), info), destination: null, heading: info.heading, name: info.name, title: info.title, curHp: 0, maxHp: 0, curMp: 0, maxMp: 0, levelDifference: 0, karma: info.karma, pvpFlag: info.pvpFlag, recommendations: info.recommendations, nameColor: info.nameColor, titleColor: 0, isSummon: false, isAttackable: false, isDead: info.isAlikeDead, chairStaticObjectId: 0, cubics: (info as any).cubics || [], abnormalState: info.abnormalState, fishing: null, appearanceKey: null, speeds: info, isRunning: info.isRunning, isInCombat: info.isInCombat, waitType: (info as any).isSitting ? GamePackets.WaitType_T.WT_SITTING : GamePackets.WaitType_T.WT_STANDING, privateStoreType: (info as any).privateStoreType || GamePackets.PrivateStoreType_T.STORE_PRIVATE_NONE, chatMessage: null, chatTime: 0, pendingAttack: null, pendingSkill: null };

        this.objects.set(objectId, object);

        return object;
    }

    protected applySpeeds(actor: BaseActor, speeds: GamePackets.Speeds_T, isRunning: boolean) {
        actor.setMovementSpeeds(speeds.runSpd * speeds.moveMultiplier, speeds.walkSpd * speeds.moveMultiplier, speeds.swimRunSpd * speeds.moveMultiplier);
        actor.setUnrealScriptProperty("AttackSpeedRate", speeds.attackSpeedMultiplier);
        actor.setUnrealScriptProperty("NonAttackSpeedRate", Math.fround(speeds.moveMultiplier)); // Engine 0x1047ab88: User+118 double to Pawn+5fc float.
        actor.setCollisionSize(speeds.collisionRadius, speeds.collisionHeight);
        actor.setWalking(!isRunning);
    }

    protected onItemList(packet: PacketReader) {
        const showWindow = packet.h() !== 0;

        this.inventory.clear();

        for (let i = 0, count = packet.h(); i < count; i++) {
            const item = GamePackets.readInventoryItem(packet);

            this.inventory.set(item.objectId, item);
        }

        this.updateInventory(showWindow, true);
    }

    protected onInventoryUpdate(packet: PacketReader) {
        for (let i = 0, count = packet.h(); i < count; i++) {
            const change = packet.h();
            const item = GamePackets.readInventoryItem(packet);

            const previous = this.inventory.get(item.objectId);
            const sound = item.isEquipped && !(previous && previous.isEquipped) ? this.ui.getStrings().itemInfos[item.itemId].equipSound : "";

            if (sound && sound.toLowerCase() !== "none") void this.manGame.getComponent("audio").playInterfaceSound(sound); // UGameEngine::OnEquipItemPlaySound 0x74ee20: grp equip_sound, no 3D.

            this.ui.updateInventoryOrder(change, item);

            switch (change) {
                case 1:
                case 2: this.inventory.set(item.objectId, item); break;
                case 3: this.inventory.delete(item.objectId); break;
                default: throw new Error(`Unknown inventory change '${change}'.`);
            }
        }

        this.updateInventory();
    }

    protected readShopItem(packet: PacketReader, hasPrice: boolean, allowZeroObject: boolean, allowZeroCount: boolean): GamePackets.ShopItem_T {
        const type1 = packet.h(), objectId = packet.d(), itemId = packet.d(), count = packet.d(), type2 = packet.h();

        packet.h();

        const bodyPart = packet.d(), enchantLevel = packet.h();

        packet.h();

        const customType2 = packet.h(), price = hasPrice ? packet.d() : 0;

        if (objectId < (allowZeroObject ? 0 : 1) || itemId <= 0 || count < (allowZeroCount ? 0 : 1) || price < 0)
            throw new Error(`Invalid shop item '${itemId}'.`);

        return { type1, objectId, itemId, count, type2, bodyPart, enchantLevel, customType2, price };
    }

    protected onSellList(packet: PacketReader) {
        const money = packet.d(), npcId = packet.d(), count = packet.h();

        if (money < 0 || npcId < 0 || count > Math.trunc(packet.getRemaining() / 32)) throw new Error(`Invalid SellList count '${count}'.`);

        const items: GamePackets.ShopItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readShopItem(packet, true, false, false));
        if (packet.getRemaining()) throw new Error("Invalid SellList trailing data.");

        this.shopSellMoney = money;
        this.shopSellNpcId = npcId;
        this.shopSellItems.length = 0;
        this.shopSellItems.push(...items);
        this.ui.showShop(true, money, items);
    }

    protected onBuyList(packet: PacketReader) {
        const money = packet.d(), listId = packet.d(), count = packet.h();

        if (money < 0 || listId < 0 || count > Math.trunc(packet.getRemaining() / 32)) throw new Error(`Invalid BuyList count '${count}'.`);

        const items: GamePackets.ShopItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readShopItem(packet, true, true, true));
        if (packet.getRemaining()) throw new Error("Invalid BuyList trailing data.");

        this.shopBuyMoney = money;
        this.shopBuyListId = listId;
        this.shopBuyItems.length = 0;
        this.shopBuyItems.push(...items);
        this.ui.showShop(false, money, items);
    }

    protected readTradeItem(packet: PacketReader, hasTradeType: boolean): GamePackets.TradeItem_T {
        const tradeType = hasTradeType ? packet.h() : 0;
        const type1 = packet.h(), objectId = packet.d(), itemId = packet.d(), count = packet.d(), type2 = packet.h();

        packet.h();

        const bodyPart = packet.d(), enchantLevel = packet.h();

        packet.h();

        const customType2 = packet.h();

        if (objectId <= 0 || itemId <= 0 || count < 0 || count === 0 && !hasTradeType || hasTradeType && tradeType !== 1 && tradeType !== 2 && tradeType !== 3)
            throw new Error(`Invalid trade item '${itemId}'.`);

        return { tradeType, type1, objectId, itemId, count, initialCount: count, type2, bodyPart, enchantLevel, customType2 };
    }

    protected readTradeItems(packet: PacketReader, count: number, hasTradeType: boolean): GamePackets.TradeItem_T[] {
        const size = hasTradeType ? 30 : 28;

        if (count < 0 || count > Math.trunc(packet.getRemaining() / size)) throw new Error(`Invalid trade item count '${count}'.`);

        const items: GamePackets.TradeItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readTradeItem(packet, hasTradeType));

        return items;
    }

    protected addTradeItems(target: GamePackets.TradeItem_T[], items: GamePackets.TradeItem_T[], mode: number) {
        const infos = this.ui.getStrings().itemInfos;

        for (const item of items) {
            if (target.length >= 160) continue;

            const previous = target.find(entry => entry.objectId === item.objectId);
            const consumeType = previous ? infos[previous.itemId].consumeType : 0;

            if (previous && consumeType >= 1 && consumeType <= 3) previous.count += item.count;
            else target.push(item);
            this.ui.recalculateTradeRows(mode, target.length);
        }
    }

    protected onTradeStart(packet: PacketReader) {
        const partnerId = packet.d(), count = packet.h(), items = this.readTradeItems(packet, count, false);

        if (partnerId <= 0 || packet.getRemaining()) throw new Error("Invalid TradeStart payload.");

        this.tradePartnerId = partnerId;
        this.tradeRequestId = 0;
        this.tradeOwnItems.length = 0;
        this.tradeOtherItems.length = 0;
        this.tradeAvailableItems.length = 0;
        this.tradeDone = 0;

        const own = this.objects.get(this.userId), other = this.objects.get(partnerId);

        this.ui.startTrade(own ? own.name : null, other ? other.name : null);

        if (!own || !other) this.game.tradeDone(false);
        this.addTradeItems(this.tradeAvailableItems, items, 0);
        this.ui.setTradeItems(0, this.tradeAvailableItems, null);
    }

    protected onTradeOwnAdd(packet: PacketReader) {
        const items = this.readTradeItems(packet, packet.h(), false);

        if (packet.getRemaining()) throw new Error("Invalid TradeOwnAdd trailing data.");

        this.addTradeItems(this.tradeOwnItems, items, 1);
        this.ui.setTradeItems(1, this.tradeOwnItems, null);
    }

    protected onTradeOtherAdd(packet: PacketReader) {
        const items = this.readTradeItems(packet, packet.h(), false);

        if (packet.getRemaining()) throw new Error("Invalid TradeOtherAdd trailing data.");

        this.addTradeItems(this.tradeOtherItems, items, 2);
        this.ui.setTradeItems(2, this.tradeOtherItems, null);
    }

    protected onTradeUpdate(packet: PacketReader) {
        const items = this.readTradeItems(packet, packet.h(), true);

        if (packet.getRemaining()) throw new Error("Invalid TradeUpdate trailing data.");

        for (const item of items) {
            if (item.tradeType === 1) {
                this.addTradeItems(this.tradeAvailableItems, [item], 0);
                continue;
            }

            const index = this.tradeAvailableItems.findIndex(entry => entry.objectId === item.objectId);

            if (index < 0) continue;

            if (item.tradeType === 3) this.tradeAvailableItems[index] = item;
            else this.tradeAvailableItems.splice(index, 1);
        }

        this.ui.setTradeItems(0, this.tradeAvailableItems, null);
    }

    protected onSendTradeRequest(packet: PacketReader) {
        const senderId = packet.d();

        if (senderId <= 0 || packet.getRemaining()) throw new Error("Invalid SendTradeRequest payload.");

        const sender = this.objects.get(senderId);

        if (!sender) {
            this.game.answerTradeRequest(false);
            return;
        }

        this.ui.showTradeInvite(sender.name, isAccepted => this.answerTradeRequest(isAccepted));
        this.tradeRequestId = senderId;
    }

    protected onSendTradeDone(packet: PacketReader) {
        const result = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid SendTradeDone payload.");

        this.tradeDone = result;
        this.tradePartnerId = 0;
        this.tradeRequestId = 0;
        this.tradeAvailableItems.length = 0;
        this.tradeOwnItems.length = 0;
        this.tradeOtherItems.length = 0;
        this.ui.finishTrade();
    }

    protected onWareHouseDone(packet: PacketReader) {
        const result = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid WareHouseDone payload.");
        if (result !== 0) return;

        const strings = this.ui.getStrings();

        this.ui.addSystemMessage(strings.systemMessages[307], strings.systemMessageColors[307]);
        this.playSystemMessageSound(307);
    }

    protected onShopPreviewInfo(packet: PacketReader) {
        this.shopPreviewItems = GamePackets.readShopPreviewInfo(packet);
        const object = this.objects.get(this.userId), appearance = this.appearances.get(this.userId);

        if (!object || !object.actor || !appearance) return;

        const paperdoll = appearance.paperdoll;
        const slots = [GamePackets.Paperdoll_T.PAPERDOLL_HEAD, GamePackets.Paperdoll_T.PAPERDOLL_RHAND, GamePackets.Paperdoll_T.PAPERDOLL_LHAND, GamePackets.Paperdoll_T.PAPERDOLL_GLOVES, GamePackets.Paperdoll_T.PAPERDOLL_FEET, GamePackets.Paperdoll_T.PAPERDOLL_LEGS, GamePackets.Paperdoll_T.PAPERDOLL_CHEST, GamePackets.Paperdoll_T.PAPERDOLL_UNDER, GamePackets.Paperdoll_T.PAPERDOLL_LRHAND, GamePackets.Paperdoll_T.PAPERDOLL_HAIR];

        for (const slot of slots) {
            const itemId = this.shopPreviewItems[slot];

            if (!itemId) continue;

            switch (slot) {
                case GamePackets.Paperdoll_T.PAPERDOLL_RHAND:
                case GamePackets.Paperdoll_T.PAPERDOLL_LHAND:
                    if (paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LRHAND]) {
                        paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LRHAND] = 0;
                        paperdoll[slot === GamePackets.Paperdoll_T.PAPERDOLL_RHAND ? GamePackets.Paperdoll_T.PAPERDOLL_LHAND : GamePackets.Paperdoll_T.PAPERDOLL_RHAND] = 0;
                    }
                    break;
                case GamePackets.Paperdoll_T.PAPERDOLL_GLOVES:
                case GamePackets.Paperdoll_T.PAPERDOLL_FEET:
                case GamePackets.Paperdoll_T.PAPERDOLL_LEGS: {
                    const chest = paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST];
                    const bodyPart = chest > 0 ? this.ui.getStrings().itemInfos[chest].bodyPart : 0;

                    if (bodyPart === CHARACTER_ALLDRESS_SLOT) {
                        paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_GLOVES] = paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_FEET] = 0;
                        if (slot !== GamePackets.Paperdoll_T.PAPERDOLL_LEGS) paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST] = 0;
                    } else if (slot === GamePackets.Paperdoll_T.PAPERDOLL_LEGS && bodyPart === CHARACTER_FULL_ARMOR_SLOT) paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST] = 0;
                    break;
                }
                case GamePackets.Paperdoll_T.PAPERDOLL_LRHAND:
                    paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_RHAND] = paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LHAND] = 0;
                    break;
            }
            if (slot === GamePackets.Paperdoll_T.PAPERDOLL_RHAND || slot === GamePackets.Paperdoll_T.PAPERDOLL_LRHAND) appearance.enchantLevel = 0;
            paperdoll[slot] = itemId;
        }
        object.appearanceKey = this.getAppearanceKey(appearance);
        this.userAppearanceLoad = this.loadAppearance(appearance, object.actor);
    }

    protected onEquipUpdate(packet: PacketReader) {
        const change = packet.d(), itemObjectId = packet.d(), bodyPart = packet.d();

        if (bodyPart <= 0 || bodyPart > 0xffff) throw new Error(`Invalid equipment body part '${bodyPart}'.`);

        const appearance = this.appearances.get(this.userId);

        if (!appearance) return;

        const item = this.inventory.get(itemObjectId);

        if (change !== 0 && !item) return;

        const slots: GamePackets.Paperdoll_T[] = [];
        for (let slot = 0; slot < 16; slot++)
            if (bodyPart & (1 << slot)) slots.push(slot as GamePackets.Paperdoll_T);

        const isHand = slots.includes(GamePackets.Paperdoll_T.PAPERDOLL_RHAND) || slots.includes(GamePackets.Paperdoll_T.PAPERDOLL_LRHAND);

        if (isHand) {
            slots.length = 0;
            slots.push(GamePackets.Paperdoll_T.PAPERDOLL_RHAND, GamePackets.Paperdoll_T.PAPERDOLL_LRHAND);
        }

        if (change === 0) {
            if (!item) for (const slot of slots) appearance.paperdoll[slot] = 0;
            else if (isHand) {
                for (const slot of slots)
                    if (appearance.paperdoll[slot] === item.itemId) appearance.paperdoll[slot] = 0;
            } else {
                const slot = slots.find(slot => appearance.paperdoll[slot] === item.itemId) ?? slots[0];
                appearance.paperdoll[slot] = 0;
            }
        } else {
            if (isHand) for (const slot of slots) appearance.paperdoll[slot] = item.itemId;
            else {
                const slot = slots.find(slot => !appearance.paperdoll[slot]) ?? slots[0];
                appearance.paperdoll[slot] = item.itemId;
            }
        }

        if (item) {
            item.isEquipped = change !== 0;
        }
        if (isHand)
            appearance.enchantLevel = change === 0 ? 0 : item.enchantLevel;

        this.updateInventory();

        const object = this.objects.get(this.userId), key = this.getAppearanceKey(appearance);

        if (!object || key === object.appearanceKey) return;

        object.appearanceKey = key;
        if (object.actor) void this.loadAppearance(appearance, object.actor);
    }

    protected onDoorInfo(packet: PacketReader) {
        const objectId = packet.d(), doorId = packet.d();

        if (objectId <= 0 || doorId <= 0 || packet.getRemaining()) throw new Error("Invalid DoorInfo payload.");

        const mover = this.manGame.getComponent("render").findMovableByRealId(doorId);
        if (mover) this.doors.set(objectId, mover);
    }

    protected onDoorStatusUpdate(packet: PacketReader) {
        const objectId = packet.d(), isOpen = packet.d(), damage = packet.d(), showHp = packet.d(), doorId = packet.d(), maxHp = packet.d(), currentHp = packet.d();

        if (objectId <= 0 || (isOpen !== 0 && isOpen !== 1) || damage < 0 || (showHp !== 0 && showHp !== 1) || doorId <= 0 || maxHp < 0 || currentHp < 0 || currentHp > maxHp || packet.getRemaining())
            throw new Error("Invalid DoorStatusUpdate payload.");

        const mover = this.manGame.getComponent("render").findMovableByRealId(doorId);

        this.doorPositions.set(doorId, isOpen === 0 ? 1 : 0);
        if (mover) mover.setPosition(isOpen === 0 ? 1 : 0);
    }

    public getDoorPosition(mover: MovableObject): number { return this.doorPositions.get((mover as any).scriptProperties?.get("L2ServerObjectRealID")); }

    protected updateInventory(showWindow: boolean = false, isFull: boolean = false) {
        this.ui.setInventory([...this.inventory.values()], showWindow, isFull);

        for (const shortcut of this.shortcuts.values())
            if (shortcut.type === GamePackets.ShortCutType_T.TYPE_ITEM) this.setShortCut(shortcut);
    }

    protected onSkillList(packet: PacketReader) {
        const count = packet.d();

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 12)) throw new Error(`Invalid SkillList count ${count}.`);

        this.skills.clear();
        for (let i = 0; i < count; i++) {
            const isPassive = packet.d() !== 0, level = packet.d(), id = packet.d();

            this.skills.set(id, { id, level, isPassive });
        }
        this.ui.setSkills([...this.skills.values()]);
        void this.preloadSkills();

        if (this.resolveSkillList) this.resolveSkillList();
        this.resolveSkillList = null;
    }

    protected async preloadSkills() {
        const asset = this.manGame.getComponent("asset"), player = this.manGame.getComponent("render").player;

        await Promise.all([...this.skills.values()].filter(skill => !skill.isPassive).map(async skill => {
            try {
                await asset.preloadPawnSkill(player, skill.id, skill.level);
            } catch (e) {
                console.error(`[network] skill '${skill.id}:${skill.level}' failed to preload:`, e);
            }
        }));
    }

    protected onAquireSkillList(packet: PacketReader) {
        const fishing = packet.d(), count = packet.d();

        if (fishing !== 0 && fishing !== 1 || count < 0 || count > Math.trunc(packet.getRemaining() / 20)) throw new Error(`Invalid AquireSkillList payload (count ${count}).`);

        const skills: GamePackets.AquireSkillEntry_T[] = [];
        for (let i = 0; i < count; i++) skills.push({ id: packet.d(), nextLevel: packet.d(), maxLevel: packet.d(), spCost: packet.d(), requirements: packet.d() });
        if (packet.getRemaining()) throw new Error("Invalid AquireSkillList trailing data.");

        this.aquireSkillFishing = fishing !== 0;
        this.aquireSkills = skills;
        this.ui.showAquireSkillList(skills, fishing);
    }

    protected onAquireSkillInfo(packet: PacketReader) {
        const id = packet.d(), level = packet.d(), spCost = packet.d(), mode = packet.d(), count = packet.d();

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 16)) throw new Error(`Invalid AquireSkillInfo payload (count ${count}).`);

        const requirements: GamePackets.AquireSkillRequirement_T[] = [];
        for (let i = 0; i < count; i++) requirements.push({ type: packet.d(), itemId: packet.d(), count: packet.d(), unknown: packet.d() });
        if (packet.getRemaining()) throw new Error("Invalid AquireSkillInfo trailing data.");

        this.aquireSkillInfo = { id, level, spCost, mode, requirements };
        this.ui.showAquireSkillInfo(this.aquireSkillInfo);
    }

    protected onAquireSkillDone(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid AquireSkillDone payload.");

        this.aquireSkills = [];
        this.aquireSkillInfo = null;
        this.ui.hideTrainWnd();
    }

    protected onQuestList(packet: PacketReader) {
        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 8)) throw new Error(`Invalid QuestList count ${count}.`);

        this.questStates.clear();
        const states: GamePackets.QuestState_T[] = [];

        for (let i = 0; i < count; i++) {
            const id = packet.d(), condition = packet.d();
            const state = { id, condition };

            this.questStates.set(id, state);
            states.push(state);
        }
        if (packet.getRemaining()) {
            const itemCount = packet.h();

            if (itemCount > Math.trunc(packet.getRemaining() / 16)) throw new Error(`Invalid QuestList item count ${itemCount}.`);
            packet.skip(itemCount * 16);
        }
        if (packet.getRemaining()) throw new Error("Invalid QuestList trailing data.");
        this.ui.setQuestStates(states);
    }

    protected onHennaInfo(packet: PacketReader) {
        const stats: number[] = [];

        for (let i = 0; i < 6; i++) stats.push(packet.c() << 24 >> 24);

        const slots = packet.d(), count = packet.d();

        if (slots < 0 || count < 0 || count > Math.trunc(packet.getRemaining() / 8)) throw new Error(`Invalid HennaInfo count ${count}.`);

        const symbols = [];
        for (let i = 0; i < count; i++) symbols.push({ symbolId: packet.d(), itemId: packet.d() });

        this.hennaStatus = { stats, slots, symbols };
        this.ui.setHenna(this.hennaStatus);
    }

    protected onSendMacroList(packet: PacketReader) {
        const type = packet.c(), id = packet.d(), total = packet.c(), count = packet.c();
        const macros: GamePackets.Macro_T[] = [];

        if (total > 127 || count > 100) throw new Error(`Invalid SendMacroList count ${total}:${count}.`);

        for (let i = 0; i < count; i++) {
            const id = packet.d(), name = packet.S(), description = packet.S(), acronym = packet.S(), icon = packet.c(), commandCount = packet.c();

            if (commandCount > 12) throw new Error(`Invalid macro command count ${commandCount}.`);

            const commands = [];
            for (let j = 0; j < commandCount; j++) commands.push({ index: packet.c(), type: packet.c(), data1: packet.d(), data2: packet.c(), command: packet.S() });

            macros.push({ id, name, description, acronym, icon, commands });
        }

        if (packet.getRemaining() || total > 0 && count === 0) throw new Error(`Invalid SendMacroList payload.`);

        if (this.isMacroListComplete) {
            this.macros.clear();
            this.macroExecutions.clear();
            this.macroListReceived = 0;
            this.isMacroListComplete = false;
        }

        for (const macro of macros) {
            this.macros.set(macro.id, macro);
            this.macroListReceived++;
        }

        if (this.macroListReceived < total) return;

        this.isMacroListComplete = true;
        this.ui.setMacros(Array.from(this.macros.values()));
        for (const shortcut of this.shortcuts.values()) {
            if (shortcut.type !== GamePackets.ShortCutType_T.TYPE_MACRO) continue;

            if (type === 0 && shortcut.id === id) this.deleteShortCut(Math.trunc(shortcut.slot / 12), shortcut.slot % 12);
            else if (type === 2 && shortcut.id === id) this.setShortCut(shortcut);
        }
    }

    protected onEtcStatusUpdate(packet: PacketReader) {
        this.etcStatus = { charges: packet.d(), weightPenalty: packet.d(), messageRefusal: packet.d(), dangerArea: packet.d(), expertisePenalty: packet.d() };

        const effects: GamePackets.AbnormalStatus_T[] = [];
        const levels = [this.etcStatus.charges, this.etcStatus.weightPenalty, this.etcStatus.messageRefusal, this.etcStatus.dangerArea, this.etcStatus.expertisePenalty];

        levels.forEach((value, i) => {
            if (value > 0) effects.push({ id: 4271 - i, level: i < 2 ? value : 1, duration: -1 });
        });
        this.ui.setSecondaryAbnormalStatus(effects);
    }

    protected onSignsSky(packet: PacketReader) {
        const remaining = packet.getRemaining();

        if (remaining !== 0 && remaining !== 2) throw new Error(`Invalid SignsSky payload size ${remaining}.`);

        this.signsSky = remaining === 2 ? packet.h() : 0;
    }

    protected onShowBoard(packet: PacketReader) {
        const part = GamePackets.readShowBoard(packet);

        this.ui.setBoard(part);
    }

    protected readPartyMember(packet: PacketReader, hasUnknown: boolean): GamePackets.PartyMember_T {
        const member = { objectId: packet.d(), name: packet.S(), curCp: packet.d(), maxCp: packet.d(), curHp: packet.d(), maxHp: packet.d(), curMp: packet.d(), maxMp: packet.d(), level: packet.d(), classId: packet.d() };

        if (hasUnknown) packet.skip(2 * 4);

        return member;
    }

    protected applyPartyMember(member: GamePackets.PartyMember_T) {
        const object = this.objects.get(member.objectId);

        if (!object) return;

        object.name = member.name;
        object.curHp = member.curHp;
        object.maxHp = member.maxHp;
        object.curMp = member.curMp;
        object.maxMp = member.maxMp;
        if (object.objectId === this.getTargetId()) this.updateTarget();
    }

    protected onPartySmallWindowAll(packet: PacketReader) {
        const leaderId = packet.d(), lootDistribution = packet.d(), count = packet.d();

        if (count < 0) throw new Error(`Invalid PartySmallWindowAll count '${count}'.`);

        const members = [];
        for (let i = 0; i < count; i++) members.push(this.readPartyMember(packet, true));

        this.partyLeaderId = leaderId;
        this.partyLootDistribution = lootDistribution;
        this.partyMembers.clear();
        this.partyPositions.clear();
        for (const member of members) {
            this.partyMembers.set(member.objectId, member);
            this.applyPartyMember(member);
        }
    }

    protected onPartySmallWindowAdd(packet: PacketReader) {
        const leaderId = packet.d(), lootDistribution = packet.d(), member = this.readPartyMember(packet, true);

        this.partyLeaderId = leaderId;
        this.partyLootDistribution = lootDistribution;
        this.partyMembers.set(member.objectId, member);
        this.applyPartyMember(member);
    }

    protected onPartySmallWindowDeleteAll(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid PartySmallWindowDeleteAll payload.");

        this.partyMembers.clear();
        this.partyPositions.clear();
        this.partyEffects.clear();
        this.partyLeaderId = 0;
        this.partyLootDistribution = 0;
    }

    protected onPartySmallWindowDelete(packet: PacketReader) {
        const objectId = packet.d();

        packet.S();
        this.partyMembers.delete(objectId);
        this.partyPositions.delete(objectId);
        this.partyEffects.delete(objectId);
    }

    protected onPartySmallWindowUpdate(packet: PacketReader) {
        const member = this.readPartyMember(packet, false);

        this.partyMembers.set(member.objectId, member);
        this.applyPartyMember(member);
    }

    protected onAskJoinPledge(packet: PacketReader) {
        const requestorId = packet.d(), pledgeName = packet.S();

        if (requestorId <= 0 || !pledgeName || packet.getRemaining()) throw new Error("Invalid AskJoinPledge payload.");

        const invite: GamePackets.PledgeInvite_T = { requestorId, pledgeName };
        this.pledgeInvite = invite;
        this.ui.showPledgeInvite(this.objects.get(requestorId)?.name || String(requestorId), pledgeName, isAccepted => {
            if (this.pledgeInvite !== invite) return;

            this.pledgeInvite = null;
            this.game.answerJoinPledge(isAccepted);
        });
    }

    protected onJoinPledge(packet: PacketReader) {
        const pledgeId = packet.d();

        if (pledgeId <= 0 || packet.getRemaining()) throw new Error("Invalid JoinPledge payload.");

        this.pledgeJoinId = pledgeId;
    }

    protected onAskJoinParty(packet: PacketReader) {
        const name = packet.S(), itemDistribution = packet.d();

        if (!name || itemDistribution < 0 || itemDistribution > 4 || packet.getRemaining()) throw new Error("Invalid AskJoinParty payload.");

        const invite: GamePackets.PartyInvite_T = { name, itemDistribution };
        this.partyInvite = invite;
        this.ui.showPartyInvite(name, isAccepted => {
            if (this.partyInvite !== invite) return;

            this.partyInvite = null;
            this.game.answerJoinParty(isAccepted);
        }, itemDistribution);
    }

    protected onJoinParty(packet: PacketReader) {
        const response = packet.d();

        if (response !== 0 && response !== 1 || packet.getRemaining()) throw new Error("Invalid JoinParty payload.");

        this.partyJoinResult = response;
    }

    protected onAskJoinFriend(packet: PacketReader) {
        const name = packet.S(), unknown = packet.d();

        if (!name || unknown !== 0 || packet.getRemaining()) throw new Error("Invalid AskJoinFriend payload.");

        const invite: GamePackets.FriendInvite_T = { name };
        this.friendInvite = invite;
        this.ui.showFriendInvite(name, isAccepted => {
            if (this.friendInvite !== invite) return;

            this.friendInvite = null;
            this.game.answerFriendInvite(isAccepted);
        });
    }

    protected onPartyMemberPosition(packet: PacketReader) {
        const count = packet.d();

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 16)) throw new Error(`Invalid PartyMemberPosition count '${count}'.`);

        const positions = [];
        for (let i = 0; i < count; i++) positions.push({ objectId: packet.d(), position: { ...this.readLocation(packet) } }); // readLocation returns the shared tmpLocation.

        for (const entry of positions) {
            const object = this.objects.get(entry.objectId);

            this.partyPositions.set(entry.objectId, entry.position);

            if (!object) continue;

            setVector(object.position, entry.position);
            if (object.actor && distanceXY(object.actor.position, object.position) > SNAP_DISTANCE) object.actor.teleportTo(object.position, true);
        }
    }

    protected readClanMember(packet: PacketReader): GamePackets.ClanMember_T {
        const name = packet.S(), level = packet.d(), classId = packet.d();

        packet.d();
        packet.d();

        const objectId = packet.d();

        return { name, level, classId, objectId, isOnline: objectId > 0 };
    }

    protected readClanMemberUpdate(packet: PacketReader): GamePackets.ClanMember_T {
        const member = { name: packet.S(), level: packet.d(), classId: packet.d(), objectId: 0, isOnline: false };

        packet.d();
        packet.d();
        member.objectId = packet.d();
        member.isOnline = member.objectId > 0;

        return member;
    }

    protected updateGMCharacterInfo() {
        if (!this.gmCharacterInfo) return;

        const clanId = this.gmCharacterInfo.clanId;
        const clan = clanId > 0 ? this.pledgeInfos.get(clanId) : null;

        this.ui.setGMCharacterInfo(this.gmCharacterInfo, clan ? { clanId, name: clan.name, crestId: clan.crestId } : null, clan ? clan.crest : null);
    }

    protected onPledgeInfo(packet: PacketReader) {
        const clanId = packet.d(), name = packet.S(), allyName = packet.S();

        if (packet.getRemaining()) throw new Error("Invalid PledgeInfo trailing data.");
        const info = this.pledgeInfos.get(clanId);

        if (clanId > 0 && info) { info.name = name; info.allyName = allyName; this.updateGMCharacterInfo(); }
    }

    protected updatePledgeInfo(clanId: number, crestId: number, allyId: number, allyCrestId: number, unknown: number) {
        const info = this.pledgeInfos.get(clanId);

        this.pledgeInfos.set(clanId, { name: info ? info.name : "", allyName: info ? info.allyName : "", crestId, allyId, allyCrestId, unknown, crest: info ? info.crest : null, allyCrest: info ? info.allyCrest : null });
        if (!info || info.allyId !== allyId) this.game.requestPledgeInfo(clanId);
        this.seedPledgeCrests(clanId, crestId, allyCrestId);
        this.updateGMCharacterInfo();
    }

    protected onPledgeStatusChanged(packet: PacketReader) {
        const objectId = packet.d(), clanId = packet.d(), crestId = packet.d(), allyId = packet.d(), allyCrestId = packet.d();
        const unknown = packet.getRemaining() === 4 ? packet.d() : 0; // Retail 0x10428ad0 reads six DWORDs; Lisvus sends five.

        if (objectId < 0 || clanId < 0 || crestId < 0 || allyId < 0 || allyCrestId < 0 || packet.getRemaining()) throw new Error("Invalid PledgeStatusChanged payload.");
        const user = this.objects.get(objectId);

        if (!user || clanId <= 0) return;

        user.clanId = clanId;
        user.clanCrestId = crestId;
        user.allyId = allyId;
        user.allyCrestId = allyCrestId;
        this.updatePledgeInfo(clanId, crestId, allyId, allyCrestId, unknown);
        this.ui.setPledgeStatus(objectId, clanId);
    }

    protected onPledgeShowInfoUpdate(packet: PacketReader) {
        const clanId = packet.d(), crestId = packet.d(), level = packet.d(), hasCastle = packet.d(), hasHideout = packet.d();

        packet.d();

        const memberLevel = packet.d(), dissolving = packet.d();

        packet.d();

        const allyId = packet.d(), allyName = packet.S(), allyCrestId = packet.d(), isAtWar = packet.d();

        if (clanId <= 0 || crestId < 0 || level < 0 || hasCastle < 0 || hasHideout < 0 || memberLevel < 0 || dissolving < 0 || allyId < 0 || allyCrestId < 0 || (isAtWar !== 0 && isAtWar !== 1) || packet.getRemaining())
            throw new Error("Invalid PledgeShowInfoUpdate payload.");

        const current = this.clanInfo;

        this.clanInfo = { leaderId: current?.leaderId || 0, clanId, name: current?.name || "", leaderName: current?.leaderName || "", crestId, level, hasCastle, hasHideout, memberLevel, dissolving, allyId, allyName, allyCrestId, isAtWar: isAtWar !== 0 };
        this.ui.setClan(this.clanInfo);
    }

    protected onPledgeShowMemberListAll(packet: PacketReader) {
        const clanId = packet.d(), name = packet.S(), leaderName = packet.S();

        if (clanId === 0 || !name) return;
        const crestId = packet.d(), level = packet.d(), hasCastle = packet.d(), hasHideout = packet.d();

        packet.d();

        const memberLevel = packet.d(), dissolving = packet.d();

        packet.d();

        const allyId = packet.d(), allyName = packet.S(), allyCrestId = packet.d(), isAtWar = packet.d() !== 0, count = packet.d();

        if (count < 0 || count > 1000) throw new Error(`Invalid PledgeShowMemberListAll payload (count ${count}).`);

        const members = [];
        for (let i = 0; i < count; i++) members.push(this.readClanMember(packet));
        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListAll trailing data.");

        this.clanInfo = { leaderId: 0, clanId, name, leaderName, crestId, level, hasCastle, hasHideout, memberLevel, dissolving, allyId, allyName, allyCrestId, isAtWar };
        this.updatePledgeInfo(clanId, crestId, allyId, allyCrestId, 0);
        this.clanMembers.clear();
        this.ui.setClan(this.clanInfo);
        this.ui.clearClanMembers();
        for (const member of members) {
            this.clanMembers.set(member.name, member);
            this.ui.addClanMember(member);
        }
    }

    protected onPledgeShowMemberListUpdate(packet: PacketReader) {
        const member = this.readClanMemberUpdate(packet);

        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListUpdate trailing data.");
        this.setClanMember(member);
        this.ui.updateClanMember(member);
    }

    protected onPledgeShowMemberListAdd(packet: PacketReader) {
        const member = this.readClanMemberUpdate(packet);

        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListAdd trailing data.");
        this.setClanMember(member);
        this.ui.addClanMember(member);
    }

    protected setClanMember(member: GamePackets.ClanMember_T) {
        if (!member.name) throw new Error("Invalid clan member name.");
        this.clanMembers.set(member.name, member);
    }

    protected onPledgeShowMemberListDelete(packet: PacketReader) {
        const name = packet.S();

        if (!name || packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListDelete payload.");
        this.clanMembers.delete(name);
        this.ui.deleteClanMember(name);
    }

    protected onPledgeShowMemberListDeleteAll(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListDeleteAll payload.");

        this.clanMembers.clear();
        this.clanInfo = null;
        this.ui.clearClanMembers();
        this.ui.setClan(null);
    }

    protected onChooseInventoryItem(packet: PacketReader) {
        const itemId = packet.d();

        if (itemId <= 0) throw new Error(`Invalid ChooseInventoryItem item '${itemId}'.`);

        this.ui.chooseInventoryItem(itemId);
    }

    protected onEnchantResult(packet: PacketReader) {
        const result = packet.d();

        if (result < 0 || result > 2 || packet.getRemaining()) throw new Error("Invalid EnchantResult payload.");

        this.ui.clearInventoryChoice();
    }

    protected onFriendList(packet: PacketReader) {
        if (packet.getRemaining() === 0) {
            this.friends.clear();
            return;
        }

        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 14)) throw new Error(`Invalid FriendList count ${count}.`);

        const friends = [];
        for (let i = 0; i < count; i++) {
            packet.h();
            const objectId = packet.d(), name = packet.S(), isOnline = packet.d() !== 0;

            packet.h();
            friends.push({ objectId, name, isOnline });
        }

        this.friends.clear();
        for (const friend of friends) this.friends.set(friend.objectId, friend);
    }

    protected onFriendRecvMsg(packet: PacketReader) {
        packet.d();
        const receiver = packet.S(), sender = packet.S(), message = packet.S();

        if (!receiver || !sender) throw new Error("Invalid FriendRecvMsg names.");
        if (packet.getRemaining()) throw new Error("Invalid FriendRecvMsg trailing data.");

        this.ui.addChat(sender, message, GamePackets.Say2_T.TELL);
    }

    protected onMagicEffectIcons(packet: PacketReader) {
        const count = packet.h() << 16 >> 16;

        if (count > Math.trunc(packet.getRemaining() / 10)) throw new Error(`Invalid MagicEffectIcons count ${count}.`);

        this.abnormalStatuses.length = 0;
        for (let i = 0; i < count; i++) {
            const effect = { id: packet.d(), level: packet.h() << 16 >> 16, duration: packet.d() };

            this.abnormalStatuses.push(effect);
        }

        this.ui.setAbnormalStatus(this.abnormalStatuses.slice(0, 31));
    }

    protected onShortBuffStatusUpdate(packet: PacketReader) {
        const id = packet.d(), level = packet.d(), duration = packet.d();

        this.shortBuff = { id, level, duration };
        this.ui.setShortBuff(this.shortBuff);
    }

    protected onSkillCoolTime(packet: PacketReader) {
        const count = packet.d();

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 16)) throw new Error(`Invalid SkillCoolTime count ${count}.`);

        for (let i = 0; i < count; i++) this.ui.setSkillCoolTime(packet.d(), packet.d(), packet.d(), packet.d());
    }

    public requestSkillList() { if (this.inWorld) this.game.requestSkillList(); }
    public useSkill(id: number, ctrl: boolean = false, shift: boolean = false) {
        const skill = this.skills.get(id);

        if (this.inWorld && skill) this.game.requestMagicSkillUse(id, ctrl, shift);
    }
    public useAction(id: number, ctrl: boolean = false, shift: boolean = false) {
        if (!this.inWorld) return;

        switch (id) {
            case 2: {
                if (this.nextTargetLock) break; // NWindow 0x10071c06, Engine bNextTargetLock.

                const targetId = this.getTargetId();

                if (this.objects.has(targetId) || this.pickups.has(targetId)) {
                    const position = this.manGame.getComponent("render").player.position;

                    if (ctrl) this.game.attackRequest(targetId, position, shift);
                    else this.game.action(targetId, position, shift);
                }
                break;
            }
            case 3: {
                const target = this.objects.get(this.getTargetId());

                if (target && target.actor) this.requestTrade(target.objectId);
                break;
            }
            case 4: {
                const selected = this.objects.get(this.getTargetId());
                const next = this.getNextEnemy(200, selected && selected.actor ? selected.objectId : -1);

                if (next) {
                    this.nextTargetLock = true;
                    this.game.action(next.objectId, this.manGame.getComponent("render").player.position, shift);
                }
                break;
            }
            case 5: {
                const item = this.getNearestItem(200, -1);

                if (item) this.game.action(item.objectId, this.manGame.getComponent("render").player.position, shift);
                break;
            }
            case 6: {
                const target = this.objects.get(this.getTargetId());

                if (target && target.actor && (this.objects.has(target.selectedId) || this.pickups.has(target.selectedId)))
                    this.game.action(target.selectedId, this.manGame.getComponent("render").player.position, shift);
                break;
            }
            case 10: this.requestPrivateStoreManageSell(); break;
            case 18: {
                const item = this.petInfo ? this.getNearestItem(200, -1, this.petInfo.objectId) : null;

                if (item) this.game.requestPetGetItem(item.objectId);
                break;
            }
            case 28: this.requestPrivateStoreManageBuy(); break;
            default: {
                const type = this.ui.getStrings().actions[id].type;

                if (type >= 2) this.game.requestSocialAction(type);
                else this.game.requestActionUse(id, ctrl, shift);
                break;
            }
        }
    }
    public requestRestart() { if (this.inWorld) this.game.requestRestart(); }
    public logout() { if (this.inWorld) this.game.logout(); }

    public requestItemList() { if (this.inWorld) this.game.requestItemList(); }
    public useItem(objectId: number) { if (this.inWorld) this.game.useItem(objectId, this.ui.getInputModifiers()[0]); }
    public chooseInventoryItem(objectId: number) { if (this.inWorld && this.inventory.has(objectId)) this.game.requestEnchantItem(objectId); }

    protected onUserInfo(packet: PacketReader) {
        const info = GamePackets.readUserInfo(packet);
        const render = this.manGame.getComponent("render");
        const player = render.player;
        const isFirst = !this.inWorld;
        let object = this.objects.get(info.objectId);

        info.isRunning = this.isRunning;

        if (!object) {
            object = this.createObject(info.objectId, "user", info);
            object.actor = player;
            object.appearanceKey = this.getAppearanceKey(this.characters[this.selectedSlot]);
        }

        this.objects.delete(info.objectId);
        this.objects.set(info.objectId, object);
        object.isAttackable = false;

        this.userId = info.objectId;
        this.appearances.set(info.objectId, { ...info, paperdoll: info.paperdoll.slice() });
        object.heading = info.heading;
        setVector(object.position, info);
        object.name = info.name;
        object.title = info.title;
        object.clanId = info.clanId;
        object.clanCrestId = info.clanCrestId;
        object.allyId = info.allyId;
        object.allyCrestId = info.allyCrestId;
        if (info.clanId > 0) this.updatePledgeInfo(info.clanId, info.clanCrestId, info.allyId, info.allyCrestId, info.largeCrestId);
        object.curHp = info.curHp;
        object.maxHp = info.maxHp;
        object.curMp = info.curMp;
        object.maxMp = info.maxMp;
        object.karma = info.karma;
        object.pvpFlag = info.pvpFlag;
        object.recommendations = info.recommendations;
        object.nameColor = info.nameColor;
        object.isDead = info.isAlikeDead;
        object.isInCombat = info.isInCombat;
        object.speeds = info;
        object.cubics = info.cubics;
        object.abnormalState = info.abnormalState;
        object.isRunning = this.isRunning;
        object.privateStoreType = info.privateStoreType;

        player.setUnrealScriptProperty("bNpc", false);
        this.applySpeeds(player, info, this.isRunning);
        player.setRotationYaw(info.heading);

        if (isFirst) {
            this.inWorld = true;
            player.teleportTo(setVector(object.position, info), true);
        }

        this.updateCubics(object);
        this.updateAbnormalState(object);
        this.isMounted = info.mountType !== 0;
        this.updateMountable();
        this.ui.setInventoryOrderOwner(info.name, this.inventoryOrderNamespace);
        this.ui.setWindowOwner(JSON.stringify([this.gameServerUrl, info.objectId]));
        this.ui.setStatus(info);
        this.ui.setClan(this.clanInfo);

        const key = this.getAppearanceKey(info);

        if (key !== object.appearanceKey) {
            object.appearanceKey = key;
            this.userAppearanceLoad = this.loadAppearance(info, player);
        }

        if (isFirst) void this.finishLoading();
        this.teleportInfoPending = false;
    }

    protected async finishLoading() {
        const render = this.manGame.getComponent("render");
        const asset = this.manGame.getComponent("asset");

        await this.userAppearanceLoad;
        await this.skillListLoad;

        while (this.inWorld && (!asset.isAreaLoaded(render, render.player.position) || this.npcSpawnCount > 0)) await new Promise(resolve => setTimeout(resolve, 100));

        if (!this.inWorld) return;

        render.setZoneMusicEnabled(true);
        this.ui.showWorld();
    }

    protected onCharInfo(packet: PacketReader) {
        const info = GamePackets.readCharInfo(packet);

        if (info.clanId > 0) this.updatePledgeInfo(info.clanId, info.clanCrestId, info.allyId, info.allyCrestId, info.largeCrestId);
        this.appearances.set(info.objectId, { ...info, paperdoll: info.paperdoll.slice() });
        let object = this.objects.get(info.objectId);

        if (object) {
            Object.assign(object, { clanId: info.clanId, clanCrestId: info.clanCrestId, allyId: info.allyId, allyCrestId: info.allyCrestId });
            this.objects.delete(info.objectId);
            this.objects.set(info.objectId, object);
            object.isAttackable = false;

            const wasDead = object.isDead;
            object.heading = info.heading;
            this.adjustPawnLocation(object, info);
            object.name = info.name;
            object.title = info.title;
            object.speeds = info;
            object.isRunning = info.isRunning;
            object.isInCombat = info.isInCombat;
            object.isDead = info.isAlikeDead;
            object.waitType = info.isSitting ? GamePackets.WaitType_T.WT_SITTING : GamePackets.WaitType_T.WT_STANDING;
            object.privateStoreType = info.privateStoreType;
            object.cubics = info.cubics;
            object.abnormalState = info.abnormalState;
            this.updateCubics(object);
            this.updateAbnormalState(object);

            if (object.actor) {
                this.applySpeeds(object.actor, info, info.isRunning);
                object.actor.setRotationYaw(info.heading);
                if (object.isDead) {
                    if (!wasDead) object.actor.playDeathAnimation(() => { });
                } else {
                    this.setIdleAnimation(object);
                    if (wasDead) object.actor.revive();
                }
            }
            this.applyPartyMember(object);

            const key = this.getAppearanceKey(info);

            if (object.actor && key !== object.appearanceKey) {
                object.appearanceKey = key;
                void this.loadAppearance(info, object.actor);
            }

            return;
        }

        object = this.createObject(info.objectId, "player", info);
        Object.assign(object, { clanId: info.clanId, clanCrestId: info.clanCrestId, allyId: info.allyId, allyCrestId: info.allyCrestId });
        object.appearanceKey = this.getAppearanceKey(info);
        this.applyPartyMember(object);

        void this.spawnPlayer(object, info);
    }

    protected async spawnPlayer(object: NetObject_T, info: GamePackets.CreatureInfo_T & GamePackets.Appearance_T) {
        const render = this.manGame.getComponent("render");
        const actor = new BaseActor(render);

        actor.name = info.name;
        actor.position.copy(object.position);

        try {
            await this.loadAppearance(info, actor);
        } catch (e) {
            console.error(`[network] player '${info.name}' failed to load:`, e);
            return;
        }

        if (object.isRemoved) {
            actor.release();
            return;
        }

        render.addPawn(actor);
        this.attachActor(object, actor, info);
    }

    protected onNpcInfo(packet: PacketReader) {
        const info = GamePackets.readNpcInfo(packet);

        info.abnormalState = packet.d(); // NpcInfo 0x6f66ca: PetInfo's shared prefix stops before this field.
        this.setNpc(info);
    }

    protected onServerObjectInfo(packet: PacketReader) {
        const info = GamePackets.readServerObjectInfo(packet);
        const object = this.setNpc(info);

        object.curHp = info.curHp;
        object.maxHp = info.maxHp;
        if (object.objectId === this.getTargetId()) this.updateTarget();
    }

    protected onPetInfo(packet: PacketReader) {
        const info = GamePackets.readPetInfo(packet);

        Object.assign(this.petInfo, info, { name: info.name || this.ui.getStrings().npcNames[info.npcId] });
        this.ui.setPetRenameAvailable(info.name.length === 0);
        this.ui.setPetInfo(this.petInfo);
        this.updateMountable();
        const object = this.setNpc(info);

        object.curHp = info.curHp;
        object.maxHp = info.maxHp;
        object.curMp = info.curMp;
        object.maxMp = info.maxMp;
        if (object.objectId === this.getTargetId()) this.updateTarget();
        if (info.spawnType === 0 || info.spawnType === 2) this.ui.showPetStatus(info.statusType);
    }

    protected updateMountable() { this.ui.setMountable(this.isMounted || this.petInfo.objectId >= 0 && this.petInfo.isMountable); }

    protected readPetInventoryItem(packet: PacketReader, allowZeroCount: boolean = false): GamePackets.InventoryItem_T {
        const item = { type1: packet.h(), objectId: packet.d(), itemId: packet.d(), count: packet.d(), type2: packet.h(), customType1: packet.h(), isEquipped: packet.h() !== 0, bodyPart: packet.d(), enchantLevel: packet.h(), customType2: packet.h() };

        if (item.objectId <= 0 || item.itemId <= 0 || item.count < (allowZeroCount ? 0 : 1)) throw new Error(`Invalid pet inventory item '${item.itemId}'.`);

        return item;
    }

    protected onPetItemList(packet: PacketReader) {
        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 28)) throw new Error(`Invalid PetItemList count '${count}'.`);

        const items: GamePackets.InventoryItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readPetInventoryItem(packet));
        if (packet.getRemaining()) throw new Error("Invalid PetItemList trailing data.");

        this.petInventory.clear();
        for (const item of items) this.petInventory.set(item.objectId, item);
        this.ui.setPetInventory(Array.from(this.petInventory.values()), true);
    }

    protected onPetInventoryUpdate(packet: PacketReader) {
        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 30)) throw new Error(`Invalid PetInventoryUpdate count '${count}'.`);

        const changes: { change: number, item: GamePackets.InventoryItem_T }[] = [];
        for (let i = 0; i < count; i++) {
            const change = packet.h();
            if (change < 1 || change > 3) throw new Error(`Unknown pet inventory change '${change}'.`);
            changes.push({ change, item: this.readPetInventoryItem(packet, change === 3) });
        }
        if (packet.getRemaining()) throw new Error("Invalid PetInventoryUpdate trailing data.");

        for (const change of changes) {
            if (change.change === 3) this.petInventory.delete(change.item.objectId);
            else if (change.change === 1 || this.petInventory.has(change.item.objectId)) this.petInventory.set(change.item.objectId, change.item);
            if (change.change !== 1) this.updatePetShortCutItem(change.item.objectId);
        }
        this.ui.setPetInventory(Array.from(this.petInventory.values()));
    }

    protected updatePetShortCutItem(objectId: number) {
        for (const shortcut of this.shortcuts.values()) {
            if (shortcut.type !== GamePackets.ShortCutType_T.TYPE_ITEM || shortcut.id !== objectId) continue;
            if (this.petInventory.has(shortcut.id)) this.setShortCut(shortcut);
            else {
                this.shortcuts.delete(shortcut.slot);
                this.ui.removeShortCut(shortcut.slot);
            }
        }
    }

    protected onPetStatusShow(packet: PacketReader) {
        const summonType = packet.d();

        if (summonType < 0 || packet.getRemaining()) throw new Error("Invalid PetStatusShow payload.");
        this.petStatusType = summonType;
        this.ui.setPetInfo(this.petInfo);
        this.ui.showPet(summonType);
    }

    protected onPetDelete(packet: PacketReader) { // Engine 0x103fefd0.
        const statusType = packet.d(), objectId = packet.d();

        this.ui.hidePet();
        Object.assign(this.petInfo, { statusType, objectId: -1, x: 0, y: 0, z: 0 });
        this.updateMountable();
        this.removeObject(objectId);
    }

    protected onSetSummonRemainTime(packet: PacketReader) {
        const maxTime = packet.d(), remainingTime = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid SetSummonRemainTime payload.");

        this.petRemainTime = { maxTime, remainingTime };
        this.ui.setSummonRemainTime(maxTime, remainingTime);
    }

    protected onPetStatusUpdate(packet: PacketReader) {
        const statusType = packet.d(), objectId = packet.d(), x = packet.d(), y = packet.d(), z = packet.d();

        packet.S();

        const curFood = packet.d(), maxFood = packet.d();
        const curHp = packet.d(), maxHp = packet.d(), curMp = packet.d(), maxMp = packet.d();
        const level = packet.d(), exp = packet.d(), minExp = packet.d(), nextExp = packet.d();

        Object.assign(this.petInfo, { statusType, objectId, x, y, z, curFood, maxFood, curHp, maxHp, curMp, maxMp, level, exp, minExp, nextExp }); // Engine 0x103fecfb..0x103feda6.
        this.ui.setPetInfo(this.petInfo);

        const object = this.objects.get(objectId);

        if (!object) return;

        object.curHp = curHp;
        object.maxHp = maxHp;
        object.curMp = curMp;
        object.maxMp = maxMp;
        if (objectId === this.getTargetId()) this.updateTarget();
    }

    protected setNpc(info: GamePackets.NpcInfo_T) {
        const object = this.objects.get(info.objectId);

        if (object) {
            const wasDead = object.isDead;
            this.adjustPawnLocation(object, info);
            if (info.name) object.name = info.name;
            object.title = info.title || this.ui.getStrings().npcTitles[info.npcId] || "";
            if (!info.name && info.npcId in this.ui.getStrings().npcTitleColors) object.titleColor = this.ui.getStrings().npcTitleColors[info.npcId];
            object.heading = info.heading;
            object.isRunning = info.isRunning;
            object.isInCombat = info.isInCombat;
            object.isDead = info.isAlikeDead;
            object.isSummon = info.isSummon;
            object.isAttackable = info.isAttackable;
            object.speeds = info;
            object.abnormalState = info.abnormalState;
            this.updateAbnormalState(object);

            if (object.actor) {
                this.applySpeeds(object.actor, info, info.isRunning);
                object.actor.setRotationYaw(info.heading);
                if (object.isDead) {
                    if (!wasDead) object.actor.playDeathAnimation(() => { });
                } else {
                    this.setIdleAnimation(object);
                    if (wasDead) object.actor.revive();
                }
            }
            if (object.objectId === this.getTargetId()) this.updateTarget();

            return object;
        }

        const created = this.createObject(info.objectId, "npc", info);

        created.title = info.title || this.ui.getStrings().npcTitles[info.npcId] || "";
        if (!info.name) created.titleColor = this.ui.getStrings().npcTitleColors[info.npcId] || 0;
        created.isSummon = info.isSummon;
        created.isAttackable = info.isAttackable;

        void this.spawnNpc(created, info.npcId, info);

        return created;
    }

    protected async spawnNpc(object: NetObject_T, npcId: number, info: GamePackets.NpcInfo_T) {
        const render = this.manGame.getComponent("render");
        let actor: BaseActor;

        while (this.npcSpawnCount >= NPC_SPAWN_CONCURRENCY) await new Promise<void>(resolve => this.npcSpawnWaiters.push(resolve));
        if (object.isRemoved) {
            this.npcSpawnWaiters.shift()?.();
            return;
        }
        this.npcSpawnCount++;

        try {
            actor = await render.spawnNpc(npcId, object.position.clone(), info.rightHand || info.leftHand || info.chest ? { rightHand: info.rightHand, leftHand: info.leftHand, chest: info.chest, attackRange: NETWORK_BOW_RANGE } : null, info.spawnType === 2);
        } catch (e) {
            this.npcSpawnCount--;
            this.npcSpawnWaiters.shift()?.();
            debugger;
            throw new Error(`[network] npc ${npcId} (object ${object.objectId}) failed to spawn: ${(e as Error).message}`);
        }

        this.npcSpawnCount--;
        this.npcSpawnWaiters.shift()?.();

        if (info.runSpd <= 0) {
            const groundSpeed = Number(actor.getUnrealScriptProperty("GroundSpeed"));
            const walkingPct = Number(actor.getUnrealScriptProperty("WalkingPct"));
            const waterSpeed = Number(actor.getUnrealScriptProperty("WaterSpeed"));
            const runSpeed = groundSpeed > 0 ? groundSpeed : 1;
            const walkPct = walkingPct > 0 ? walkingPct : 0.5;

            info.runSpd = runSpeed;
            info.walkSpd = runSpeed * walkPct;
            info.swimRunSpd = waterSpeed > 0 ? waterSpeed : runSpeed;
            info.swimWalkSpd = info.swimRunSpd * walkPct;
        }

        if (!object.name) object.name = actor.name;
        if (object.isRemoved) {
            render.removePawn(actor);
            return;
        }

        this.attachActor(object, actor, info);
    }

    protected attachActor(object: NetObject_T, actor: BaseActor, info: GamePackets.CreatureInfo_T) {
        object.actor = actor;

        actor.setUnrealScriptProperty("bNpc", object.kind === "npc");
        this.applySpeeds(actor, info, info.isRunning);
        this.setIdleAnimation(object);
        actor.setRotationYaw(object.heading);

        actor.teleportTo(object.position, true);
        this.updateCubics(object);
        this.updateAbnormalState(object);
        if (object.destination) actor.goTo(object.destination);
        if (object.isDead) actor.playDeathAnimation(() => { });
        if (object.objectId === this.getTargetId()) this.updateTarget();
        this.flushPendingAttacks();
        this.flushPendingSkills();
        this.flushSkillTargets(object.objectId);
    }

    protected async onSpawnItem(packet: PacketReader, dropped: boolean) {
        const ownerId = dropped ? packet.d() : 0;

        const objectId = packet.d(), itemId = packet.d();
        const position = setVector(new Vector3(), this.readLocation(packet));
        const stackable = packet.d() !== 0, count = packet.d(), heading = packet.d();

        this.removeObject(objectId);

        const render = this.manGame.getComponent("render");
        const asset = this.manGame.getComponent("asset");
        const owner = this.objects.get(ownerId);
        const origin = owner && owner.actor ? owner.actor.getWorldPosition(new Vector3()) : null;
        const pickup = new GroundPickup(render, objectId, itemId, count, stackable, dropped, origin);

        pickup.position.copy(position);
        pickup.quaternion.fromArray(getRotatorQuaternionElements(0, heading, 0));
        this.pickups.set(objectId, pickup);

        const library = await asset.loadItem(itemId);

        if (this.pickups.get(objectId) !== pickup) return;

        const sound = library.pickup.dropSound, animation = library.pickup.dropAnimType;
        const [dropSound, throwSound] = dropped ? await Promise.all([
            sound && sound.toLowerCase() !== "none" ? asset.loadSound(sound) : null,
            animation >= 1 && animation <= 3 ? asset.loadSound("ItemSound.Item_throw") : null
        ]) : [null, null];

        if (this.pickups.get(objectId) !== pickup) return;

        pickup.setMeshes(library);
        pickup.setDropSounds(dropSound, throwSound);
        render.addPickup(pickup);
    }

    protected onGetItem(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const objectId = packet.d();
        const position = this.readLocation(packet);
        const pickup = this.pickups.get(objectId);

        if (object && object.actor) {
            const actor = object.actor;

            object.destination = null;
            actor.stopMoving();
            this.adjustPawnLocation(object, position);

            if (pickup) actor.setRotationYaw(Math.atan2(pickup.position.y - actor.position.y, pickup.position.x - actor.position.x) * 32768 / Math.PI);

            const animation = (actor.getUnrealScriptProperty("PicItemAnimName") as string[])[actor.getUnrealScriptProperty("CurWeaponType") as number];

            if (animation.toLowerCase() !== "none") actor.playAnimation(animation, 0.1, actor.getUnrealScriptProperty("NonAttackSpeedRate") as number, false, true); // OnGetItem 0x7455a9..0x7455f3.
            this.notifyMacroCommand([14], 1);
        }

        this.removeObject(objectId);
    }

    protected removeObject(objectId: number) {
        const wasTarget = objectId === this.getTargetId();

        if (this.petInfo.objectId === objectId) {
            Object.assign(this.petInfo, { objectId: -1, x: 0, y: 0, z: 0 });
            this.updateMountable();
        }

        for (const object of this.objects.values()) {
            if (object.selectedId === objectId) object.selectedId = 0;
            if (object.pendingAttack?.hits.some(hit => hit.targetObjectId === objectId)) object.pendingAttack = null;
            if (object.pendingSkill?.targetObjectId === objectId) object.pendingSkill = null;
            if (object.pendingSkill) object.pendingSkill.associatedObjectIds = object.pendingSkill.associatedObjectIds.filter(id => id !== objectId);
            if (object.skill) object.skill.associatedObjectIds = object.skill.associatedObjectIds.filter(id => id !== objectId);
        }

        if (wasTarget) this.updateTarget();

        this.partyMembers.delete(objectId);
        this.partyPositions.delete(objectId);
        this.vehicles.delete(objectId);
        for (const vehicle of this.vehicles.values()) vehicle.riders.delete(objectId);
        this.mounts.delete(objectId);
        this.privateStoreSellMsgs.delete(objectId);
        this.privateStoreBuyMsgs.delete(objectId);

        const pickup = this.pickups.get(objectId);

        if (pickup) {
            this.pickups.delete(objectId);
            this.manGame.getComponent("render").removePickup(pickup);
        }

        const object = this.objects.get(objectId);

        if (!object || object.kind === "user") return;

        object.isRemoved = true;
        this.objects.delete(objectId);
        this.appearances.delete(objectId);

        if (object.actor) this.manGame.getComponent("render").removePawn(object.actor);
    }

    protected withActor(objectId: number, callback: (actor: BaseActor, object: NetObject_T) => void) {
        const object = this.objects.get(objectId);

        if (object && object.actor) callback(object.actor, object);
    }

    protected readLocation(packet: PacketReader): GamePackets.Location_T {
        tmpLocation.x = packet.d();
        tmpLocation.y = packet.d();
        tmpLocation.z = packet.d();

        return tmpLocation;
    }

    protected adjustPawnLocation(object: NetObject_T, position: GamePackets.Location_T) {
        setVector(object.position, position);

        // AdjustPawnLocation 0x7425a0: remote living pawns, more than 200 units from the server feet position.
        if (object.actor && object.kind !== "user" && !object.isDead && (!object.actor.visible || object.actor.position.distanceTo(object.position) > 200)) object.actor.adjustLocation(object.position);
    }

    protected getStopSnapDistance(object: NetObject_T) { return object.kind === "user" ? SNAP_DISTANCE : STOP_SNAP_DISTANCE; } // Server AI starts casts anywhere within range + 100 and ignores our X/Y, so small user gaps are left alone.

    protected onMoveToLocation(packet: PacketReader) {
        const object = this.objects.get(packet.d());

        if (!object) return;

        const destination = setVector(object.destination || (object.destination = new Vector3()), this.readLocation(packet));

        setVector(object.position, this.readLocation(packet));

        if (!object.actor) return;
        if (object.kind !== "user" && (!object.actor.visible || distanceXY(object.actor.position, object.position) > SNAP_DISTANCE)) object.actor.teleportTo(object.position, true);

        object.actor.goTo(destination);
    }

    protected onMoveToPawn(packet: PacketReader) {
        const objectId = packet.d(), targetId = packet.d();
        const distance = packet.d();
        const current = this.readLocation(packet), position = { x: current.x, y: current.y, z: current.z }, destination = this.readLocation(packet);
        const object = this.objects.get(objectId);
        const target = this.objects.get(targetId);

        if (!object) return;

        setVector(object.position, position);

        if (target && target.actor && object.actor) {
            object.destination = null;
            object.actor.goToActor(target.actor, Math.max(5, distance - Math.abs(destination.z - position.z)) - 5); // L2Character.moveToLocation: offset shrinks by |dz|, stops at offset - 5.
            return;
        }

        setVector(object.destination || (object.destination = new Vector3()), destination);
        if (object.actor) object.actor.goTo(object.destination);
    }

    protected onStopMove(packet: PacketReader) {
        const object = this.objects.get(packet.d());

        if (!object) return;

        setVector(object.position, this.readLocation(packet));
        object.heading = packet.d() & 0xffff;
        object.destination = null;

        if (!object.actor) return;

        object.actor.stopMoving();

        if (!object.actor.visible || distanceXY(object.actor.position, object.position) > this.getStopSnapDistance(object)) object.actor.teleportTo(object.position, true);

        object.actor.setRotationYaw(object.heading);
    }

    protected onValidateLocation(packet: PacketReader) {
        const object = this.objects.get(packet.d());

        if (!object) return;

        setVector(object.position, this.readLocation(packet));
        object.heading = packet.d() & 0xffff;

        if (object.actor && (!object.actor.visible || distanceXY(object.actor.position, object.position) > SNAP_DISTANCE)) object.actor.teleportTo(object.position, true);
    }

    protected onTeleport(packet: PacketReader) {
        const object = this.objects.get(packet.d());

        if (!object) return;

        setVector(object.position, this.readLocation(packet));
        object.destination = null;

        if (object.actor) object.actor.teleportTo(object.position, true);
        if (object.kind === "user") void this.finishTeleport();
    }

    protected async finishTeleport() {
        const render = this.manGame.getComponent("render");
        const asset = this.manGame.getComponent("asset");
        const generation = ++this.teleportGeneration;

        render.setZoneMusicEnabled(false);
        this.ui.showLoading(true);

        while (this.inWorld && generation === this.teleportGeneration && !asset.isAreaLoaded(render, render.player.position)) await new Promise(resolve => setTimeout(resolve, 100));

        if (!this.inWorld || generation !== this.teleportGeneration) return;

        this.teleportInfoPending = true;
        this.game.appearing();

        // Lisvus Appearing sends the destination known list before UserInfo.
        while (this.inWorld && generation === this.teleportGeneration && (this.teleportInfoPending || this.npcSpawnCount > 0 || this.npcSpawnWaiters.length > 0)) await new Promise(resolve => setTimeout(resolve, 100));

        if (!this.inWorld || generation !== this.teleportGeneration) return;

        render.setZoneMusicEnabled(true);
        this.ui.showWorld();
    }

    protected onBeginRotation(packet: PacketReader) {
        const objectId = packet.d();

        packet.d(); // OnStartRotating 0x73c9c0 ignores the initial heading.

        const direction = packet.d(), speed = packet.d();

        this.withActor(objectId, actor => actor.startRotating(direction, speed));
    }

    protected onStopRotation(packet: PacketReader) {
        const objectId = packet.d(), heading = packet.d();
        const speed = packet.getRemaining() === 0 ? 0 : packet.d();

        if (packet.getRemaining() > 0) packet.c();

        this.withActor(objectId, (actor, object) => {
            object.heading = heading & 65535;
            actor.finishRotating(heading, speed);
        });
    }

    protected onAttack(packet: PacketReader) {
        const attacker = this.objects.get(packet.d());
        const hits = [this.readAttackHit(packet)];
        const position = this.readLocation(packet);
        const count = packet.h();

        if (count > packet.getRemaining() / 9) throw new Error(`Invalid attack hit count '${count}'.`);

        for (let i = 0; i < count; i++) hits.push(this.readAttackHit(packet));

        if (!attacker) return;

        if (!attacker.actor || !hits[0].actionTarget) {
            attacker.pendingAttack = { hits, position: { x: position.x, y: position.y, z: position.z } };
            return;
        }

        this.startServerAttack(attacker, hits, position);
    }

    protected onActionFailed() {
        const object = this.objects.get(this.userId);

        if (!object) return;

        object.pendingAttack = null;
        object.pendingSkill = null;
    }

    protected readAttackHit(packet: PacketReader): NAttackActionParam_T {
        const targetObjectId = packet.d(), target = this.objects.get(targetObjectId);
        const damage = packet.d(), flags = packet.c();

        return { targetObjectId, actionTarget: target ? target.actor : null, damage, isMiss: !!(flags & GamePackets.AttackFlags_T.MISS), isCritical: !!(flags & GamePackets.AttackFlags_T.CRITICAL), isShieldDefense: !!(flags & GamePackets.AttackFlags_T.SHIELD), isSpirit: !!(flags & GamePackets.AttackFlags_T.SOULSHOT), soulshotGrade: flags & GamePackets.AttackFlags_T.GRADE };
    }

    protected startServerAttack(attacker: NetObject_T, hits: readonly NAttackActionParam_T[], position: GamePackets.Location_T) {
        if (!attacker.actor || !hits[0].actionTarget || attacker.actor === hits[0].actionTarget) return;

        attacker.pendingAttack = null;
        setVector(attacker.position, position);
        attacker.destination = null;
        if (distanceXY(attacker.actor.position, attacker.position) > this.getStopSnapDistance(attacker)) attacker.actor.teleportTo(attacker.position, true);
        this.stopSkill(attacker.objectId);
        attacker.actor.getComponent<PawnAttackComponent>("pawnAttack").attackFromServer(hits);
        if (!attacker.isDead)
            for (const hit of hits) {
                const defender = this.objects.get(hit.targetObjectId);

                if (defender && defender.actor && defender.actor !== attacker.actor) this.ui.notifyOlympiadAttack(attacker.objectId, defender.objectId, attacker.name, hit.isMiss, hit.isCritical);
            }
    }

    protected flushPendingAttacks(targetObjectId?: number) {
        for (const attacker of this.objects.values()) {
            const pending = attacker.pendingAttack;

            if (!pending || targetObjectId !== undefined && !pending.hits.some(hit => hit.targetObjectId === targetObjectId)) continue;

            const hits = pending.hits.map(hit => {
                const target = this.objects.get(hit.targetObjectId);

                return { ...hit, actionTarget: target ? target.actor : null };
            });

            if (!hits[0].actionTarget) continue;
            this.startServerAttack(attacker, hits, pending.position);
        }
    }

    protected onMagicSkillUse(packet: PacketReader) {
        const receivedTime = performance.now();
        const caster = this.objects.get(packet.d());
        const targetObjectId = packet.d(), target = this.objects.get(targetObjectId);
        const id = packet.d(), level = packet.d(), hitTime = packet.d();

        const reuseDelay = packet.d();
        const position = this.readLocation(packet);

        packet.d();

        if (caster && caster.objectId === this.userId && hitTime >= 0) this.ui.setSkillCoolTime(id, level, Math.trunc(reuseDelay / 1000), Math.trunc(reuseDelay / 1000)); // OnReceiveMagicSkillUse 0x7505a2 / 0x750690.

        const isTransient = CUBIC_SKILLS.has(id) || this.ui.getStrings().skillCastStyles[`${id}:${level}`] === 0;

        if (!caster || hitTime < 0) return;

        if (caster.actor === this.manGame.getComponent("render").player && !caster.isDead && (target ? target.actor : this.doors.has(targetObjectId)) && this.ui.getStrings().skillInfos[`${id}:${level}`])
            this.notifyMacroSkill(id, hitTime);

        if (!caster.actor || !target || !target.actor) {
            if (!isTransient) this.stopSkill(caster.objectId);
            caster.pendingSkill = { targetObjectId, id, level, hitTime: hitTime / 1000, receivedTime, position: { x: position.x, y: position.y, z: position.z }, isTransient, associatedObjectIds: [] };
            return;
        }

        this.startServerSkill(caster, target, id, level, hitTime / 1000, position, isTransient, receivedTime);
    }

    protected startServerSkill(caster: NetObject_T, target: NetObject_T, id: number, level: number, hitTime: number, position: GamePackets.Location_T, isTransient: boolean, receivedTime: number, associatedObjectIds: readonly number[] = []) {
        const skill: NetSkill_T = { id, level, hitTime, receivedTime, associatedActors: [], associatedObjectIds: [...associatedObjectIds] }; // OnReceiveMagicSkillUse 0x7507f7..0x750831.

        for (const objectId of skill.associatedObjectIds) {
            const object = this.objects.get(objectId);

            if (object?.actor) skill.associatedActors.push(object.actor);
        }

        if (!isTransient) {
            setVector(caster.position, position);
            caster.destination = null;
            if (distanceXY(caster.actor.position, caster.position) > this.getStopSnapDistance(caster)) caster.actor.teleportTo(caster.position, true);
            this.manGame.getComponent("asset").stopPawnSkill(caster.actor);
            caster.skill = skill;
        }

        caster.pendingSkill = null;
        void this.castSkill(caster, target, skill, isTransient);
    }

    protected async castSkill(caster: NetObject_T, target: NetObject_T, cast: NetSkill_T, isTransient: boolean) {
        const actor = caster.actor;

        await this.waitNextTick(); // UGameEngine::OnEquipItem 0x7456d0 queues ChangeItemAction ahead of pending pawn actions.
        await this.appearanceLoads.get(actor);

        const skill = await this.manGame.getComponent("asset").loadPawnSkill(actor, cast.id, cast.level, isTransient);

        if (!skill || !isTransient && caster.skill !== cast || caster.isRemoved || target.isRemoved || caster.actor !== actor) return;

        // Asset loading consumes the server's cast time.
        const hitTime = isTransient ? cast.hitTime : Math.max(0, cast.hitTime - (performance.now() - cast.receivedTime) / 1000);

        if (!isTransient && cast.hitTime > 0 && hitTime === 0) return;
        if (isTransient && skill.visual.transientRejected) this.stopSkill(caster.objectId);
        actor.getComponent<PawnAttackComponent>("pawnAttack").castFromServer(target.actor, skill, hitTime, cast.associatedActors, cast.associatedActors.length > 0);
        if (target.actor) this.ui.notifyOlympiadSkill(caster.objectId, cast.id);
    }

    protected onMagicSkillLaunched(packet: PacketReader) {
        const caster = this.objects.get(packet.d());
        const skillId = packet.d();

        packet.d();
        const count = packet.d(), objectIds: number[] = [];

        if (count < 0 || count > packet.getRemaining() / 4) throw new Error(`Invalid skill target count '${count}'.`);

        for (let i = 0; i < count; i++) objectIds.push(packet.d());

        if (!caster) return;

        if (caster.pendingSkill && caster.pendingSkill.id === skillId) caster.pendingSkill.associatedObjectIds.push(...objectIds);
        if (!caster.skill || caster.skill.id !== skillId) return;

        caster.skill.associatedObjectIds.push(...objectIds);
        if (caster.actor) this.applySkillTargets(caster);
    }

    protected flushPendingSkills(targetObjectId?: number) {
        for (const caster of this.objects.values()) {
            const pending = caster.pendingSkill;

            if (!pending || targetObjectId !== undefined && pending.targetObjectId !== targetObjectId) continue;

            const target = this.objects.get(pending.targetObjectId);

            if (!caster.actor || !target?.actor) continue;

            this.startServerSkill(caster, target, pending.id, pending.level, pending.hitTime, pending.position, pending.isTransient, pending.receivedTime, pending.associatedObjectIds);
        }
    }

    protected flushSkillTargets(objectId?: number) {
        for (const caster of this.objects.values()) {
            const skill = caster.skill;

            if (!skill || objectId !== undefined && !skill.associatedObjectIds.includes(objectId) || !caster.actor) continue;

            this.applySkillTargets(caster);
        }
    }

    protected applySkillTargets(caster: NetObject_T) {
        const skill = caster.skill;

        skill.associatedActors.length = 0;
        for (const targetId of skill.associatedObjectIds) {
            const target = this.objects.get(targetId);

            if (target?.actor) skill.associatedActors.push(target.actor);
        }
        caster.actor.getComponent<PawnAttackComponent>("pawnAttack").setSkillTargets(skill.id, skill.associatedActors);
    }

    protected stopSkill(objectId: number) {
        const object = this.objects.get(objectId);

        if (!object) return;

        object.skill = null;
        object.pendingSkill = null;
        if (object.actor) this.manGame.getComponent("asset").stopPawnSkill(object.actor);
        if (objectId === this.userId) this.ui.setupGauge(GamePackets.GaugeColor_T.BLUE, 0, 0); // MagicCancel 0x7b5e6d..0x7b5e7d.
    }

    protected onDie(packet: PacketReader) {
        const objectId = packet.d();
        const options = [packet.d() !== 0, packet.d() !== 0, packet.d() !== 0, packet.d() !== 0];

        packet.d();
        options.push(packet.d() !== 0);

        const object = this.objects.get(objectId);

        if (!object) return;

        object.isDead = true;
        object.isInCombat = false;
        object.selectedId = 0; // OnDie 0x744e51 / 0x744e95 clears bAutoAttacking and SelectedActor.
        object.destination = null;
        this.stopSkill(objectId);

        if (object.actor) object.actor.playDeathAnimation(() => { });
        if (object.kind !== "user") return;

        this.updateTarget();
        this.ui.showDeath(options);
    }

    protected onRevive(objectId: number) {
        const object = this.objects.get(objectId);

        if (!object) return;

        object.isDead = false;
        this.setIdleAnimation(object, false);

        if (object.actor) object.actor.revive();
        if (object.kind === "user") this.ui.hideDeath();
    }

    protected onChangeMoveType(objectId: number, isRunning: boolean) {
        const object = this.objects.get(objectId);

        if (!object) return;
        object.isRunning = isRunning;
        if (object.kind === "user") {
            this.isRunning = isRunning;
            this.ui.setRunning(isRunning);
        }
        if (object.actor) object.actor.setWalking(!isRunning);
    }

    protected onChairSit(packet: PacketReader) {
        const objectId = packet.d(), staticObjectId = packet.d();

        if (objectId <= 0 || staticObjectId <= 0 || packet.getRemaining()) throw new Error("Invalid ChairSit payload.");

        const object = this.objects.get(objectId);

        if (object) object.chairStaticObjectId = staticObjectId;
    }

    protected onStaticObject(packet: PacketReader) {
        const staticObjectId = packet.d(), objectId = packet.d();

        if (staticObjectId <= 0 || objectId <= 0 || packet.getRemaining()) throw new Error("Invalid StaticObject payload.");

        this.staticObjects.set(staticObjectId, objectId);
    }

    protected updateCubics(object: NetObject_T) {
        const actor = object.actor;

        if (!actor) return;

        let component = actor.findComponent<PawnCubicComponent>("pawnCubic");

        if (!object.cubics.length) {
            if (component) actor.removeComponent(component);
            return;
        }

        if (!component) component = actor.addComponent(new PawnCubicComponent(this.manGame.getComponent("render")));
        component.setPosture(object.waitType === GamePackets.WaitType_T.WT_SITTING, object.waitType === GamePackets.WaitType_T.WT_START_FAKEDEATH);
        void component.setCubics(object.cubics);
    }

    protected updateAbnormalState(object: NetObject_T) {
        const actor = object.actor;

        if (!actor) return;

        let component = actor.findComponent<PawnAbnormalComponent>("pawnAbnormal");

        if (!object.abnormalState) {
            if (component) actor.removeComponent(component);
            return;
        }

        if (!component) component = actor.addComponent(new PawnAbnormalComponent(this.manGame.getComponent("render")));
        void component.setAbnormalState(object.abnormalState);
    }

    protected setIdleAnimation(object: NetObject_T, updatePose: boolean = true) {
        const actor = object.actor;

        if (!actor || object.isDead) return;

        actor.findComponent<PawnCubicComponent>("pawnCubic")?.setPosture(object.waitType === GamePackets.WaitType_T.WT_SITTING, object.waitType === GamePackets.WaitType_T.WT_START_FAKEDEATH);
        const field = object.waitType === GamePackets.WaitType_T.WT_SITTING ? object.chairStaticObjectId ? "ChairWaitAnimName" : "SitWaitAnimName" : object.waitType === GamePackets.WaitType_T.WT_START_FAKEDEATH ? "DeathWaitAnimName" : object.isInCombat ? "AtkWaitAnimName" : "WaitAnimName";
        const animation = (actor.getUnrealScriptProperty(field) as string[])[actor.getUnrealScriptProperty("CurWeaponType") as number];

        if (animation.toLowerCase() === "none") return;

        actor.setIdleAnimation(animation);
        if (updatePose && !actor.isLocomoting() && actor.getAnimationAction()?.loop !== LoopOnce) actor.playMovementAnimation("idle");
    }

    protected onCombatState(objectId: number, isInCombat: boolean) {
        const object = this.objects.get(objectId);

        if (!object) return;

        object.isInCombat = isInCombat;
        this.setIdleAnimation(object);
    }

    protected onChangeWaitType(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const waitType = packet.d() as GamePackets.WaitType_T;
        const position = this.readLocation(packet);

        if (!object) return;

        setVector(object.position, position);
        object.destination = null;

        if (object.waitType === waitType) return;

        const actor = object.actor;

        if (actor) {
            actor.stopAttack();
            actor.stopMoving();
            if (distanceXY(actor.position, object.position) > STOP_SNAP_DISTANCE) actor.teleportTo(object.position, true);
        }

        let field: string, rateField = "NonAttackSpeedRate";

        switch (waitType) {
            case GamePackets.WaitType_T.WT_SITTING: field = object.chairStaticObjectId ? "ChairSitAnimName" : "SitAnimName"; rateField = "SitAnimRate"; break;
            case GamePackets.WaitType_T.WT_STANDING: field = "StandAnimName"; rateField = "StandAnimRate"; object.chairStaticObjectId = 0; break;
            case GamePackets.WaitType_T.WT_START_FAKEDEATH: field = "DeathAnimName"; break;
            case GamePackets.WaitType_T.WT_STOP_FAKEDEATH: field = "DeathStandAnimName"; object.chairStaticObjectId = 0; break;
            default: throw new Error(`Unknown wait type '${waitType}'.`);
        }

        object.waitType = waitType === GamePackets.WaitType_T.WT_STOP_FAKEDEATH ? GamePackets.WaitType_T.WT_STANDING : waitType;
        this.setIdleAnimation(object, false);

        if (!actor) return;

        const animation = (actor.getUnrealScriptProperty(field) as string[])[actor.getUnrealScriptProperty("CurWeaponType") as number];
        const rate = actor.getUnrealScriptProperty(rateField) as number;

        if (animation.toLowerCase() !== "none") actor.playAnimation(animation, 0.1, rate || 1, false, true); // OnChangeWaitType 0x74fb96..0x74fe58.
    }

    protected onSocialAction(objectId: number, actionId: number) {
        const object = this.objects.get(objectId);

        if (!object || !object.actor || actionId < 1) return;
        if (actionId === 15 && objectId === this.userId) this.game.requestSkillList();

        const actor = object.actor;
        const isNpc = object.kind === "npc";

        if (actionId === 15 || (actionId === 16 && !isNpc)) { void this.spawnSocialEffect(actor, actionId === 15 ? "LineageEffect.e_u004_a" : "LineageEffect.e_u091_a", actionId === 15 ? 20002 : 20004); return; } // OnSocialAction 0x1046db47 -> SpawnNTransientEffect 0x4E22 / 0x4E24
        const prefix = isNpc ? "NpcSocial" : "PcSocial";
        const index = isNpc ? actionId - 1 : actionId;
        const names = actor.getUnrealScriptProperty(`${prefix}AnimName`) as string[];

        if (index >= names.length || names[index].toLowerCase() === "none") return;

        const animation = names[index];

        actor.playAnimation(animation, isNpc ? 0.1 : 0.3, actor.getUnrealScriptProperty("NonAttackSpeedRate") as number, false, true); // OnSocialAction 0x73dbbc / 0x73dc4a.
        const equipment = actor.findComponent<PawnEquipmentComponent>("pawnEquipment");

        if (equipment) equipment.hideForAnimation(animation, !!(actor.getUnrealScriptProperty(`${prefix}HideRightWeapon`) as number[])[index], !!(actor.getUnrealScriptProperty(`${prefix}HideLeftWeapon`) as number[])[index]);
    }

    protected async spawnSocialEffect(actor: BaseActor, path: string, skillId: number) {
        const asset = this.manGame.getComponent("asset"), render = this.manGame.getComponent("render");
        const library = await asset.loadSocialEffects();

        if (!actor.parent) return;

        const effect = asset.createScriptObject(render, library, path);

        effect.position.copy(actor.position);
        render.addTransientEffect(effect, actor);

        // Engine.dll SpawnNTransientEffect 0x79a7e1..0x79a8ee: level1 spell sounds at Pawn.Location.
        for (const sound of this.ui.getStrings().socialSounds[skillId] || []) {
            const uri = await asset.loadSound(sound.sound);

            void this.manGame.getComponent("audio").playOneShotSound(uri, actor.position, sound.volume / 255, 1, sound.radius, sound.radius * 100);
        }
    }

    protected async onPlaySound(packet: PacketReader) {
        const type = packet.d() as GamePackets.PlaySoundType_T;
        const name = packet.S();

        packet.skip(20); // OnPlaySound 0x751275..0x7512ac ignores the five positional fields.

        const audio = this.manGame.getComponent("audio");

        if (type === GamePackets.PlaySoundType_T.SOUND) {
            const position = this.manGame.getComponent("render").player.position.clone();
            const uri = await this.manGame.getComponent("asset").loadSound(name);

            await audio.playOneShotSound(uri, position, 1, 1, 80, 8000); // Core.dll GAudioDefaultRadius 0x101cdf84 = 80.
            return;
        }

        if (!/^[\w -]+$/.test(name)) throw new Error(`Invalid audio stream name '${name}'.`);

        switch (type) {
            case GamePackets.PlaySoundType_T.MUSIC: await audio.playMusic(`assets/music/${name.toLowerCase()}.ogg`, false, true); break;
            case GamePackets.PlaySoundType_T.VOICE: await audio.playVoice(`assets/voice/${name.toLowerCase()}-e.ogg`); break;
            default: throw new Error(`Unknown sound type '${type}'.`);
        }
    }

    protected async onEarthquake(packet: PacketReader) {
        if (packet.getRemaining() < 24) throw new Error("Invalid Earthquake packet.");

        tmpEarthquakePosition.set(packet.d(), packet.d(), packet.d());
        const intensity = packet.d();
        const duration = packet.d();
        packet.d();

        const render = this.manGame.getComponent("render");
        const positionFrequency = 30 * duration;

        tmpEarthquakePositionAmplitude.set(positionFrequency, positionFrequency, 0);
        render.addViewShakeState(duration + 2, 1, intensity * 60, positionFrequency, tmpEarthquakeRotationAmplitude, tmpEarthquakeRotationVelocity, tmpEarthquakePositionAmplitude, tmpEarthquakePosition, intensity, 0); // UGameEngine::OnEarthQuake 0x10438.

        const name = duration <= 7 ? "MonSound3.antaras_earthquake" : "MonSound3.antaras_earthquake_2";
        const uri = await this.manGame.getComponent("asset").loadSound(name);

        await this.manGame.getComponent("audio").playOneShotSound(uri, render.player.position, 1, 1, 80, 8000);
    }

    protected setTarget(objectId: number, levelDifference: number = 0) {
        const user = this.objects.get(this.userId);

        if (!user) return;

        this.setSelectedActor(user, objectId);

        const object = this.objects.get(objectId);

        if (object) object.levelDifference = levelDifference;

        this.updateTarget();
    }

    protected setSelectedActor(object: NetObject_T, objectId: number) {
        const target = this.objects.get(objectId);

        if (target || this.pickups.has(objectId)) object.selectedId = objectId;
    }

    protected onTargetSelected(packet: PacketReader, isSelected: boolean) {
        const objectId = packet.d(), selectedId = isSelected ? packet.d() : 0;
        const position = this.readLocation(packet);
        const object = this.objects.get(objectId);

        if (!object) return;

        this.adjustPawnLocation(object, position);
        // OnTargetSelected 0x745910 / OnTargetUnselected 0x745b10: SelectedActor, independent of the current action.
        if (isSelected) this.setSelectedActor(object, selectedId);
        else object.selectedId = 0;
        if (objectId === this.userId) this.updateTarget();
    }

    protected updateTarget() {
        const object = this.objects.get(this.getTargetId());

        this.ui.setTarget(object ? { name: object.name, curHp: object.curHp, maxHp: object.maxHp, curMp: object.curMp, maxMp: object.maxMp, showHp: object.isSummon ? object.objectId === this.petInfo.objectId : object.maxHp > 0, showMp: object.kind !== "npc" && object.maxMp > 0, levelDifference: object.levelDifference } : null); // NCTargetStatusWnd paint 0x10113600: summons show HP + level colour only to their owner.
    }

    protected onStatusUpdate(packet: PacketReader) {
        const objectId = packet.d();
        const count = packet.d();
        const object = this.objects.get(objectId);
        const status: Record<number, number> = {};

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 8)) throw new Error(`Invalid StatusUpdate count ${count}.`);

        for (let i = 0; i < count; i++) {
            const id = packet.d();

            status[id] = packet.d();
        }

        if (!object) return;
        if (GamePackets.StatusUpdate_T.CUR_HP in status) object.curHp = status[GamePackets.StatusUpdate_T.CUR_HP];
        if (GamePackets.StatusUpdate_T.MAX_HP in status) object.maxHp = status[GamePackets.StatusUpdate_T.MAX_HP];
        if (GamePackets.StatusUpdate_T.CUR_MP in status) object.curMp = status[GamePackets.StatusUpdate_T.CUR_MP];
        if (GamePackets.StatusUpdate_T.MAX_MP in status) object.maxMp = status[GamePackets.StatusUpdate_T.MAX_MP];
        if (GamePackets.StatusUpdate_T.KARMA in status) object.karma = status[GamePackets.StatusUpdate_T.KARMA];
        if (GamePackets.StatusUpdate_T.PVP_FLAG in status) object.pvpFlag = status[GamePackets.StatusUpdate_T.PVP_FLAG];
        if (objectId === this.userId) this.ui.updateStatus(status);
        if (objectId === this.getTargetId()) this.updateTarget();
    }

    protected onNicknameChanged(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const title = packet.S();

        if (!object) return;

        object.title = title;
        if (object.objectId === this.getTargetId()) this.updateTarget();
    }

    protected onRelationChanged(packet: PacketReader) {
        const object = this.objects.get(packet.d());

        packet.d();
        const isAttackable = packet.d() !== 0;
        const karma = packet.d();
        const pvpFlag = packet.d();

        if (!object) return;

        object.isAttackable = isAttackable;
        object.karma = karma;
        object.pvpFlag = pvpFlag;
        if (object.objectId === this.getTargetId()) this.updateTarget();
    }

    protected onCreatureSay(packet: PacketReader) {
        const object = this.objects.get(packet.d());

        const type = packet.d() as GamePackets.Say2_T;
        const name = packet.S(), text = packet.S();

        this.addChat(object, name, text, type);
    }

    protected addChat(object: NetObject_T, name: string, text: string, type: GamePackets.Say2_T) {
        if (object && object.privateStoreType === GamePackets.PrivateStoreType_T.STORE_PRIVATE_NONE && type !== GamePackets.Say2_T.PETITION_PLAYER && type !== GamePackets.Say2_T.PETITION_GM) { // NCConsole 0x1005d5e9..0x1005d811
            object.chatMessage = text.length < 19 ? text : `${text.slice(0, 18)}...`;
            object.chatTime = performance.now();
        }

        this.ui.addChat(name, text, type);
    }

    protected onNpcSay(packet: PacketReader) {
        const object = this.objects.get(packet.d());

        const type = packet.d() as GamePackets.Say2_T, id = packet.d() - GamePackets.NPC_ID_OFFSET;
        const text = packet.S();

        if (!text) return;

        this.addChat(object, this.npcNames.get(id) || `npc#${id}`, text, type);
    }

    protected onSystemMessage(packet: PacketReader) {
        const message = this.readSystemMessage(packet);

        this.ui.addSystemMessage(message.text, this.ui.getStrings().systemMessageColors[message.id] ?? 0xffb09b79);
        this.playSystemMessageSound(message.id);
    }

    protected onConfirmDlg(packet: PacketReader) {
        const message = this.readSystemMessage(packet);

        if (message.id !== 0 && this.ui.getStrings().systemMessages[message.id] === undefined) throw new Error(`Unknown ConfirmDlg message ${message.id}.`);

        this.playSystemMessageSound(message.id);
        this.ui.showConfirm(message.id, message.text, isOk => this.game.dlgAnswer(message.id, isOk));
    }

    public playSystemMessageSound(id: number) {
        const sound = this.ui.getStrings().systemMessageSounds[id];

        if (sound) void this.manGame.getComponent("audio").playInterfaceSound(sound);
    }

    protected readSystemMessage(packet: PacketReader) {
        const strings = this.ui.getStrings();
        const messageId = packet.d();
        const count = packet.d();
        const params: string[] = [];

        if (count < 0 || count > Math.floor(packet.getRemaining() / 6)) throw new Error(`Invalid SystemMessage parameter count ${count}.`);

        for (let i = 0; i < count; i++) {
            switch (packet.d()) {
                case GamePackets.SystemMessageParam_T.TYPE_TEXT: params.push(packet.S()); break;
                case GamePackets.SystemMessageParam_T.TYPE_NUMBER: params.push(String(packet.d())); break;
                case GamePackets.SystemMessageParam_T.TYPE_NPC_NAME: { const id = packet.d() - GamePackets.NPC_ID_OFFSET; params.push(this.npcNames.get(id) || `npc#${id}`); break; }
                case GamePackets.SystemMessageParam_T.TYPE_ITEM_NAME: { const id = packet.d(); params.push(strings.itemNames[id] || `item#${id}`); break; }
                case GamePackets.SystemMessageParam_T.TYPE_SKILL_NAME: { const id = packet.d(); packet.d(); params.push(strings.skillNames[id] || `skill#${id}`); break; }
                default: throw new Error(`Unknown SystemMessage parameter type in message ${messageId}.`);
            }
        }

        const template = strings.systemMessages[messageId];

        const text = template === undefined ? `SystemMessage ${messageId} ${params.join(" ")}` : template.replace(/\$[sc](\d)/g, (match, index) => params[Number(index) - 1] ?? "");

        return { id: messageId, text };
    }

    protected getShortCutItem(shortcut: GamePackets.ShortCut_T) { return (shortcut.characterType === 2 ? this.petInventory : this.inventory).get(shortcut.id); }

    protected setShortCut(shortcut: GamePackets.ShortCut_T) {
        const item = this.getShortCutItem(shortcut);

        if (shortcut.type === GamePackets.ShortCutType_T.TYPE_ITEM && shortcut.characterType === 2 && !item) return;
        this.shortcuts.set(shortcut.slot, shortcut);
        this.ui.setShortCut(shortcut, item, !!item && this.autoSoulShots.has(item.itemId), this.macros.get(shortcut.id));
    }

    protected onAutoSoulShot(packet: PacketReader) {
        const itemId = packet.d(), isEnabled = packet.d() !== 0;

        if (isEnabled) this.autoSoulShots.add(itemId);
        else this.autoSoulShots.delete(itemId);

        for (const shortcut of this.shortcuts.values()) {
            if (shortcut.type !== GamePackets.ShortCutType_T.TYPE_ITEM) continue;

            const item = this.getShortCutItem(shortcut);

            if (item && item.itemId === itemId) this.setShortCut(shortcut);
        }
    }

    protected onStorageMaxCount(packet: PacketReader) {
        const values = [packet.d(), packet.d(), packet.d(), packet.d(), packet.d(), packet.d(), packet.d()];

        if (values.some(value => value < 0) || packet.getRemaining()) throw new Error("Invalid ExStorageMaxCount packet.");

        this.storageMaxCount = { inventory: values[0], warehouse: values[1], freight: values[2], privateSell: values[3], privateBuy: values[4], recipeDwarf: values[5], recipe: values[6] };
        this.ui.setInventoryLimit(values[0]);
        this.ui.setWarehouseLimit(values[1]);
        this.ui.setPrivateSellLimit(values[3]);
        this.ui.setPrivateBuyLimit(values[4]);
        this.ui.setRecipeLimits(values[5], values[6]);
    }

    public toggleAutoSoulShot(page: number, slot: number) {
        const shortcut = this.shortcuts.get(page * 12 + slot);

        if (!this.inWorld || !shortcut || shortcut.type !== GamePackets.ShortCutType_T.TYPE_ITEM) return;

        const item = this.getShortCutItem(shortcut);

        if (!item) return;

        const id = item.itemId;

        // NCConsole 0x1006e500: retail automatic-shot item ranges.
        if (!(id >= 1463 && id <= 1467 || id === 1835 || id >= 2509 && id <= 2514 || id >= 3947 && id <= 3952 || id >= 5789 && id <= 5790 || id >= 6645 && id <= 6647)) return;

        this.game.requestAutoSoulShot(id, !this.autoSoulShots.has(id));
    }

    protected requestShortCutReg(type: GamePackets.ShortCutType_T, index: number, id: number, level: number = 1) { // NWindow 0x1007a1e0 plays pickup after registration.
        this.game.requestShortCutReg(type, index, id, level);
        void this.manGame.getComponent("audio").playInterfaceSound("ItemSound.pickup");
    }

    public registerSkillShortCut(id: number, page: number, slot: number) {
        const skill = this.skills.get(id);

        if (!this.inWorld || !skill) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_SKILL, page * 12 + slot, id);
    }

    public registerRecipeShortCut(id: number, page: number, slot: number) {
        if (!this.inWorld) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_RECIPE, page * 12 + slot, id);
    }

    public registerMacroShortCut(id: number, page: number, slot: number) {
        if (!this.inWorld || !this.macros.has(id)) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_MACRO, page * 12 + slot, id);
    }

    public registerItemShortCut(objectId: number, page: number, slot: number) {
        if (!this.inWorld || !this.inventory.has(objectId)) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_ITEM, page * 12 + slot, objectId);
    }

    public registerPetItemShortCut(objectId: number, page: number, slot: number) {
        if (!this.inWorld || !this.petInventory.has(objectId)) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_ITEM, page * 12 + slot, objectId, 2);
    }

    public registerActionShortCut(id: number, page: number, slot: number) {
        if (!this.inWorld || !this.ui.getStrings().actions[id]) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_ACTION, page * 12 + slot, id, id >= 0 && id <= 14 ? 1 : id >= 15 && id <= 27 ? 2 : 0);
    }

    public moveShortCut(page: number, slot: number, targetPage: number, targetSlot: number) {
        const index = page * 12 + slot, targetIndex = targetPage * 12 + targetSlot;
        const source = this.shortcuts.get(index), target = this.shortcuts.get(targetIndex);

        if (!this.inWorld || !source || index === targetIndex) return;
        if (![page, targetPage].every(value => Number.isInteger(value) && value >= 0 && value < 10) || ![slot, targetSlot].every(value => Number.isInteger(value) && value >= 0 && value < 12)) throw new Error(`Invalid shortcut move ${page}:${slot} -> ${targetPage}:${targetSlot}.`);

        this.requestShortCutReg(source.type, targetIndex, source.id);
        this.game.requestShortCutDel(index);
        this.shortcuts.delete(index);
        this.ui.removeShortCut(index);

        if (target) this.requestShortCutReg(target.type, index, target.id);
    }

    public useShortCut(page: number, slot: number, ctrl: boolean = false, shift: boolean = false) {
        const shortcut = this.shortcuts.get(page * 12 + slot);

        if (!shortcut) return;

        switch (shortcut.type) {
            case GamePackets.ShortCutType_T.TYPE_SKILL: this.game.requestMagicSkillUse(shortcut.id, ctrl, shift); break;
            case GamePackets.ShortCutType_T.TYPE_ACTION: this.useAction(shortcut.id, ctrl, shift); break;
            case GamePackets.ShortCutType_T.TYPE_ITEM:
                if (shortcut.characterType === 2) this.usePetItem(shortcut.id);
                else if ((shortcut.characterType ?? 1) === 1) this.useItem(shortcut.id);
                break;
            case GamePackets.ShortCutType_T.TYPE_MACRO: this.activateMacro(shortcut.id); break;
            case GamePackets.ShortCutType_T.TYPE_RECIPE: this.game.requestRecipeItemMakeInfo(shortcut.id); break;
            default: throw new Error(`Unknown shortcut type ${shortcut.type}.`);
        }
    }

    protected async showLobby() {
        const game = this.game, characters = this.characters, transfer = this.gmTransfer;
        const isTransferList = transfer && transfer.phase === 5;

        await this.lobby.enter(this.ui.getStrings().logonSpots);
        if (this.game !== game || this.characters !== characters) return;

        this.ui.showCharacters(characters);
        let lastUsed = characters.findIndex(character => character.isLastUsed);

        if (isTransferList) {
            lastUsed = -1;
            characters.slice(0, 7).forEach((character, index) => { if (character.isLastUsed && (character.deleteSeconds <= 0 || character.isDeletionMarked)) lastUsed = index; });
            transfer.selectedSlot = lastUsed;
        }
        const asset = this.manGame.getComponent("asset");

        await this.lobby.showSelect(characters);
        if (this.game !== game || this.characters !== characters) return;

        void asset.precacheNpcBundle("LineageMonsters"); // after the lobby pawns, opening the bundles held two workers for seconds
        void asset.precacheNpcBundle("LineageNPCs");

        if (lastUsed >= 0) this.previewCharacter(lastUsed);
        if (isTransferList && this.gmTransfer === transfer && transfer.phase === 5) transfer.phase = 6;
    }

    protected onManagePledgePower(packet: PacketReader) {
        packet.skip(8);

        if (packet.getRemaining() !== 4 && packet.getRemaining() !== 32) throw new Error(`Invalid ManagePledgePower size ${packet.getRemaining()}.`);

        const privs = new Uint8Array(32);

        privs.set(packet.b(packet.getRemaining()));

        this.pledgePower = privs;
        this.ui.setPledgePower(privs);
    }

    public getHeroCrest(crestId: number, isAlly: boolean): HTMLCanvasElement {
        if (crestId <= 0) return null;

        for (const info of this.pledgeInfos.values())
            if ((isAlly ? info.allyCrestId : info.crestId) === crestId) return isAlly ? info.allyCrest : info.crest;
        return null;
    }

    protected bindImportedCrest(crestId: number, canvas: HTMLCanvasElement, isAlly: boolean) {
        if (!canvas) return;

        for (const info of this.pledgeInfos.values()) {
            if ((isAlly ? info.allyCrestId : info.crestId) !== crestId) continue;

            if (isAlly) info.allyCrest = canvas;
            else info.crest = canvas;
        }
        if (!isAlly) this.updateGMCharacterInfo();
    }

    protected seedPledgeCrests(clanId: number, crestId: number, allyCrestId: number) {
        const info = this.pledgeInfos.get(clanId);

        if (crestId === 0) info.crest = null;
        else if (crestId > 0) {
            const canvas = this.ui.getCachedCrest(crestId);

            if (canvas) this.bindImportedCrest(crestId, canvas, false);
            else this.game.requestPledgeCrest(crestId);
        }
        if (allyCrestId === 0) info.allyCrest = null;
        else if (info.allyId > 0 && allyCrestId > 0) {
            const canvas = this.ui.getCachedCrest(allyCrestId);

            if (canvas) this.bindImportedCrest(allyCrestId, canvas, true);
            else this.game.requestAllyCrest(allyCrestId);
        }
    }

    protected onNpcHtmlMessage(packet: PacketReader) {
        packet.d();
        const html = packet.S(), type = packet.d();

        if (packet.getRemaining()) throw new Error(`Invalid NpcHtmlMessage trailing data.`);
        this.ui.showNpcHtml(html, type);
    }

    protected onPledgeCrest(packet: PacketReader) {
        const crest = GamePackets.readCrest(packet);

        this.pledgeCrests.set(crest.crestId, crest.data);
        this.bindImportedCrest(crest.crestId, this.ui.setPledgeCrest(crest.crestId, crest.data), false);
    }

    protected onAllyCrest(packet: PacketReader) {
        const crest = GamePackets.readCrest(packet);

        this.allyCrests.set(crest.crestId, crest.data);
        this.bindImportedCrest(crest.crestId, this.ui.setPledgeCrest(crest.crestId, crest.data), true);
    }

    protected onPledgeCrestLarge(packet: PacketReader) {
        const crest = GamePackets.readPledgeCrestLarge(packet);

        this.clanLargeCrestIds.set(crest.clanId, crest.crestId);

        if (crest.data.length) this.pledgeLargeCrests.set(crest.crestId, crest.data);
        else this.pledgeLargeCrests.delete(crest.crestId);
    }

    protected onAskJoinAlly(packet: PacketReader) {
        const requestorId = packet.d(), requestorName = packet.S(), unknown = packet.S(), allyName = packet.S();

        if (requestorId <= 0 || !requestorName || unknown || !allyName || packet.getRemaining()) throw new Error("Invalid AskJoinAlly payload.");

        const invite: GamePackets.AllyInvite_T = { requestorId, requestorName, allyName };
        this.allyInvite = invite;
        this.ui.showAllyInvite(requestorName, allyName, isAccepted => {
            if (this.allyInvite !== invite) return;

            this.allyInvite = null;
            this.game.answerJoinAlly(isAccepted);
        });
    }

    public getPledgePower() { return this.pledgePower; }
    public getClanInfo() { return this.clanInfo; }
    public getPledgeCrest(crestId: number) { return this.pledgeCrests.get(crestId); }
    public getPledgeLargeCrest(crestId: number) { return this.pledgeLargeCrests.get(crestId); }
    public getClanLargeCrestId(clanId: number) { return this.clanLargeCrestIds.get(clanId); }
    public getAllyCrest(crestId: number) { return this.allyCrests.get(crestId); }

    public requestPledgeInfo(clanId: number) { if (this.inWorld) this.game.requestPledgeInfo(clanId); }
    public requestPledgeMemberList() { if (this.inWorld) this.game.requestPledgeMemberList(); }
    public getSelectedPlayer() { const target = this.objects.get(this.getTargetId()); return target && (target.kind === "user" || target.kind === "player") ? target : null; }
    public invitePledge(objectId: number) { if (this.inWorld) this.game.requestJoinPledge(objectId); }
    public withdrawPledge() { if (this.inWorld) this.game.requestWithdrawalPledge(); }
    public oustPledgeMember(name: string) { if (this.inWorld) this.game.requestOustPledgeMember(name); }
    public giveNickName(name: string, title: string) { if (this.inWorld) this.game.requestGiveNickName(name, title); }
    public requestPledgePower() { if (this.inWorld) this.game.requestPledgePower(this.userId); }
    public requestMemberPledgePower(objectId: number) { if (this.inWorld) this.game.requestMemberPledgePower(objectId); }
    public setMemberPledgePower(objectId: number, privs: Uint8Array) { if (this.inWorld) this.game.setMemberPledgePower(objectId, privs); }

    public startPledgeWar(pledgeName: string) { if (this.inWorld) this.game.requestStartPledgeWar(pledgeName); }
    public stopPledgeWar(pledgeName: string) { if (this.inWorld) this.game.requestStopPledgeWar(pledgeName); }
    public surrenderPledgeWar(pledgeName: string) { if (this.inWorld) this.game.requestSurrenderPledgeWar(pledgeName); }
    public surrenderPersonally(pledgeName: string) { if (this.inWorld) this.game.requestSurrenderPersonally(pledgeName); }

    public replyStartPledgeWar(isAccepted: boolean) {
        if (!this.pledgeWarStart) throw new Error("No pending StartPledgeWar to reply to.");

        this.game.requestReplyStartPledgeWar(this.pledgeWarStart.charName, isAccepted);
        this.pledgeWarStart = null;
    }

    public replyStopPledgeWar(isAccepted: boolean) {
        if (!this.pledgeWarStop) throw new Error("No pending StopPledgeWar to reply to.");

        this.game.requestReplyStopPledgeWar(this.pledgeWarStop.charName, isAccepted);
        this.pledgeWarStop = null;
    }

    public replySurrenderPledgeWar(isAccepted: boolean) {
        if (!this.pledgeWarSurrender) throw new Error("No pending SurrenderPledgeWar to reply to.");

        this.game.requestReplySurrenderPledgeWar(this.pledgeWarSurrender.charName, isAccepted);
        this.pledgeWarSurrender = null;
    }

    public requestPledgeCrest(crestId: number) { if (this.inWorld && !this.pledgeCrests.has(crestId)) this.game.requestPledgeCrest(crestId); }
    public requestPledgeLargeCrest(crestId: number) { if (this.inWorld && !this.pledgeLargeCrests.has(crestId)) this.game.requestExPledgeCrestLarge(crestId); }
    public requestAllyCrest(crestId: number) { if (this.inWorld && !this.allyCrests.has(crestId)) this.game.requestAllyCrest(crestId); }

    public setPledgeCrest(data: Uint8Array) {
        if (data.length > 256) throw new Error(`Pledge crest is ${data.length} bytes, server limit is 256.`);
        if (this.inWorld) this.game.requestSetPledgeCrest(data);
    }

    public setPledgeLargeCrest(data: Uint8Array) {
        if (data.length > 2176) throw new Error(`Large pledge crest is ${data.length} bytes, server limit is 2176.`);
        if (this.inWorld) this.game.requestExSetPledgeCrestLarge(data);
    }

    public setAllyCrest(data: Uint8Array) {
        if (data.length > 192) throw new Error(`Ally crest is ${data.length} bytes, server limit is 192.`);
        if (this.inWorld) this.game.requestSetAllyCrest(data);
    }

    public requestJoinAlly(objectId: number) { if (this.inWorld) this.game.requestJoinAlly(objectId); }
    public leaveAlly() { if (this.inWorld) this.game.allyLeave(); }
    public dismissAllyClan(clanName: string) { if (this.inWorld) this.game.allyDismiss(clanName); }
    public dissolveAlly() { if (this.inWorld) this.game.requestDismissAlly(); }
    public requestAllyInfo() { if (this.inWorld) this.game.requestAllyInfo(); }

    protected onPrivateStoreManageListSell(packet: PacketReader) {
        const list = GamePackets.readPrivateStoreManageListSell(packet);

        if (list.playerId !== this.userId) throw new Error(`PrivateStoreManageListSell for foreign player '${list.playerId}'.`);

        this.privateStoreManageSell = list;
        this.ui.showPrivateStoreManageSell(list);
    }

    protected onPrivateStoreManageListBuy(packet: PacketReader) {
        const list = GamePackets.readPrivateStoreManageListBuy(packet);

        if (list.playerId !== this.userId) throw new Error(`PrivateStoreManageListBuy for foreign player '${list.playerId}'.`);

        this.privateStoreManageBuy = list;
        this.ui.showPrivateStoreManageBuy(list);
    }

    protected onPrivateStoreMsg(packet: PacketReader, messages: Map<number, string>) {
        const objectId = packet.d(), message = packet.S();

        if (objectId <= 0 || packet.getRemaining()) throw new Error("Invalid private store message payload.");

        messages.set(objectId, message);
    }

    protected onPackageToList(packet: PacketReader) {
        const targets = GamePackets.readPackageToList(packet);

        this.packageTargets.clear();
        for (const target of targets) this.packageTargets.set(target.objectId, target.name);
        this.ui.showPackageTargets(targets);
    }

    protected onMultiSellList(packet: PacketReader) {
        const list = GamePackets.readMultiSellList(packet);

        if (list.page === 1 || !this.multiSell) this.multiSell = { ...list, listId: list.page === 1 ? list.listId : 0, entries: [] };
        if (list.page === 1) this.ui.clearMultiSell(list.listId);

        for (const entry of list.entries) {
            let group = this.multiSell.entries.find(group => group.entryId === entry.entryId);

            entry.products.forEach((product, index) => {
                if (!group) {
                    group = { entryId: entry.entryId, mode: entry.mode, products: [], ingredients: [] };
                    this.multiSell.entries.push(group);
                }
                group.products.length++;
                group.products[index] = product;
                group.mode = entry.mode;
            });
            if (group) group.ingredients.push(...entry.ingredients);
        }
        this.multiSell.page = list.page;
        this.multiSell.isFinished = list.isFinished;
        if (list.isFinished) this.ui.showMultiSell(this.multiSell);

    }

    public requestTrade(objectId: number) { if (this.inWorld) this.game.tradeRequest(objectId); }
    public canAddTradeItem(objectId: number) { return this.inWorld && this.tradePartnerId > 0 && this.tradeAvailableItems.some(item => item.objectId === objectId) && !this.tradeOwnItems.some(item => item.objectId === objectId); }
    public addTradeItem(objectId: number, count: number) {
        if (!this.canAddTradeItem(objectId)) return;
        if (!Number.isInteger(count) || count <= 0 || count > 0x7fffffff) throw new Error(`Invalid trade item count '${count}'.`);

        this.game.addTradeItem(objectId, count);
    }
    public confirmTrade(isConfirmed: boolean) { if (this.inWorld && this.tradePartnerId) this.game.tradeDone(isConfirmed); }

    public answerTradeRequest(isAccepted: boolean) {
        if (!this.inWorld || !this.tradeRequestId) return;

        this.tradeRequestId = 0;
        this.game.answerTradeRequest(isAccepted);
    }

    public sellItems(items: GamePackets.SellItemRequest_T[]) { if (this.inWorld) this.game.requestSellItem(this.shopSellNpcId, items); }
    public buyItems(items: GamePackets.ItemIdCount_T[]) { if (this.inWorld) this.game.requestBuyItem(this.shopBuyListId, items); }
    public depositWarehouse(items: GamePackets.ItemCount_T[]) { if (this.inWorld && this.warehouseDeposit) this.game.sendWareHouseDepositList(items); }
    public withdrawWarehouse(items: GamePackets.ItemCount_T[]) { if (this.inWorld && this.warehouseWithdraw) this.game.sendWareHouseWithDrawList(items); }
    public requestPrivateStoreManageSell() { if (this.inWorld) this.game.requestPrivateStoreManageSell(); }
    public setPrivateStoreListSell(isPackage: boolean, items: GamePackets.PrivateStoreOffer_T[]) { if (this.inWorld) this.game.setPrivateStoreListSell(isPackage, items); }
    public quitPrivateStoreSell() { if (this.inWorld) this.game.requestPrivateStoreQuitSell(); }
    public setPrivateStoreMsgSell(message: string) { if (this.inWorld) this.game.setPrivateStoreMsgSell(message); }
    public getPrivateStoreMsgSell() { return this.privateStoreSellMsgs.get(this.userId) ?? ""; }
    public buyFromPrivateStore(ownerId: number, items: GamePackets.PrivateStoreOffer_T[]) { if (this.inWorld) this.game.requestPrivateStoreBuy(ownerId, items); }
    public requestPrivateStoreManageBuy() { if (this.inWorld) this.game.requestPrivateStoreManageBuy(); }
    public setPrivateStoreListBuy(items: GamePackets.PrivateStoreBuyOffer_T[]) { if (this.inWorld) this.game.setPrivateStoreListBuy(items); }
    public quitPrivateStoreBuy() { if (this.inWorld) this.game.requestPrivateStoreQuitBuy(); }
    public cancelPrivateStoreManageBuy() { if (this.inWorld) this.game.requestPrivateStoreManageCancelBuy(); }
    public setPrivateStoreMsgBuy(message: string) { if (this.inWorld) this.game.setPrivateStoreMsgBuy(message); }
    public getPrivateStoreMsgBuy() { return this.privateStoreBuyMsgs.get(this.userId) ?? ""; }
    public sellToPrivateStore(ownerId: number, items: GamePackets.PrivateStoreSellOffer_T[]) { if (this.inWorld) this.game.requestPrivateStoreSell(ownerId, items); }
    public requestPackageSendableItemList(objectId: number) { if (this.inWorld) this.game.requestPackageSendableItemList(objectId); }
    public sendPackage(objectId: number, items: GamePackets.ItemCount_T[]) { if (this.inWorld) this.game.requestPackageSend(objectId, items); }
    public clearMultiSell() { if (this.multiSell) { this.multiSell.entries = []; this.multiSell.listId = 0; } }
    public chooseMultiSell(listId: number, entryId: number, amount: number) { if (this.inWorld) this.game.multiSellChoose(listId, entryId, amount); }
    public requestPreviewItems(itemIds: number[]) { if (this.inWorld && this.shopPreview) this.game.requestPreviewItem(this.shopPreview.unknown, this.shopPreview.listId, itemIds); }
    public buySeeds(items: GamePackets.ItemIdCount_T[], manorId?: number) { if (this.inWorld && this.seedShop) this.game.requestBuySeed(manorId ?? this.seedShop.manorId, items); }
    public sellCrops(items: GamePackets.SellItemRequest_T[], listId?: number) { if (this.inWorld && this.cropProcure) this.game.requestBuyProcure(listId ?? this.cropProcure.listId, items); }
    public dropItem(objectId: number, count: number, point: GamePackets.Location_T) { // NCGaraDialogBox kind4 reply 0x100097bd.
        if (!this.inWorld) return;

        const player = this.manGame.getComponent("render").player;

        if (player.getUnrealScriptProperty("bGetOnVehicle")) {
            this.ui.addSystemMessage(this.ui.getSystemMessage(179), this.ui.getStrings().systemMessageColors[179]);
            return;
        }

        this.game.requestDropItem(objectId, count, point);
    }
    public destroyItem(objectId: number, count: number) { if (this.inWorld) this.game.requestDestroyItem(objectId, count); }
    public crystallizeItem(objectId: number, count: number) { if (this.inWorld) this.game.requestCrystallizeItem(objectId, count); }
    public unequipBodyPart(bodyPart: number) { if (this.inWorld) this.game.requestUnEquipItem(bodyPart); }
    public giveItemToPet(objectId: number, count: number) { if (this.inWorld) this.game.requestGiveItemToPet(objectId, count); }
    public getItemFromPet(objectId: number, count: number) { if (this.inWorld) this.game.requestGetItemFromPet(objectId, count); }
    public usePetItem(objectId: number) { if (this.inWorld) this.game.requestPetUseItem(objectId); }
    public petPickup(objectId: number) { if (this.inWorld && this.pickups.has(objectId)) this.game.requestPetGetItem(objectId); }
    public changePetName(name: string) { if (this.inWorld) this.game.requestChangePetName(name); }

    protected onVehicleLocation(packet: PacketReader, isStopped: boolean) {
        const info = GamePackets.readVehicleLocation(packet);
        let vehicle = this.vehicles.get(info.objectId);

        if (!vehicle) {
            vehicle = { objectId: info.objectId, position: new Vector3(), heading: 0, destination: null, moveSpeed: 0, rotationSpeed: 0, isStarted: false, riders: new Map() };
            this.vehicles.set(info.objectId, vehicle);
        }

        setVector(vehicle.position, info);
        vehicle.heading = info.heading;

        if (isStopped) vehicle.destination = null; // L2BoatInstance.sendInfo follows VehicleInfo with VehicleDeparture while moving.

        for (const riderId of vehicle.riders.keys()) this.placeVehicleRider(vehicle, riderId);
    }

    protected onVehicleDeparture(packet: PacketReader) {
        const departure = GamePackets.readVehicleDeparture(packet);
        const vehicle = this.vehicles.get(departure.objectId);

        if (!vehicle) return;

        vehicle.moveSpeed = departure.moveSpeed;
        vehicle.rotationSpeed = departure.rotationSpeed;
        vehicle.destination = setVector(vehicle.destination || new Vector3(), departure);
    }

    protected onVehicleStarted(packet: PacketReader) {
        const objectId = packet.d(), state = packet.d();

        if (state !== 0 && state !== 1) throw new Error(`Invalid VehicleStarted state '${state}'.`);

        const vehicle = this.vehicles.get(objectId);

        if (vehicle) vehicle.isStarted = state === 1;
    }

    protected updateVehicles(deltaTime: number) {
        for (const vehicle of this.vehicles.values()) {
            if (!vehicle.destination) continue;

            const distance = vehicle.position.distanceTo(vehicle.destination), step = vehicle.moveSpeed * deltaTime / 1000;

            if (step >= distance) {
                vehicle.position.copy(vehicle.destination);
                vehicle.destination = null;
            } else vehicle.position.lerp(vehicle.destination, step / distance);

            for (const riderId of vehicle.riders.keys()) this.placeVehicleRider(vehicle, riderId);
        }
    }

    protected setVehicleRider(vehicle: NetVehicle_T, objectId: number, local: GamePackets.Location_T) {
        for (const other of this.vehicles.values()) if (other !== vehicle) other.riders.delete(objectId);

        setVector(vehicle.riders.get(objectId) || vehicle.riders.set(objectId, new Vector3()).get(objectId), local);
    }

    protected placeVehicleRider(vehicle: NetVehicle_T, objectId: number) {
        const object = this.objects.get(objectId);

        if (!object) return;

        object.position.copy(vehicle.position); // L2BoatInstance.updatePosition puts every passenger on the boat's own XYZ.
        object.destination = null;

        if (object.actor) object.actor.teleportTo(object.position);
    }

    protected getVehicleIdOf(objectId: number): number {
        for (const vehicle of this.vehicles.values())
            if (vehicle.riders.has(objectId)) return vehicle.objectId;

        return 0;
    }

    protected onGetOnVehicle(packet: PacketReader) {
        const rider = GamePackets.readVehicleRider(packet);
        const vehicle = this.vehicles.get(rider.vehicleId);

        if (!vehicle) return;

        this.withActor(rider.objectId, actor => actor.setUnrealScriptProperty("bGetOnVehicle", true)); // FL2NetNotify 0x104760e2.
        this.setVehicleRider(vehicle, rider.objectId, rider);
        this.placeVehicleRider(vehicle, rider.objectId);
    }

    protected onGetOffVehicle(packet: PacketReader) {
        const rider = GamePackets.readVehicleRider(packet);
        const vehicle = this.vehicles.get(rider.vehicleId);
        const object = this.objects.get(rider.objectId);

        if (vehicle) vehicle.riders.delete(rider.objectId);
        if (!object) return;

        if (object.actor) object.actor.setUnrealScriptProperty("bGetOnVehicle", false); // FL2NetNotify 0x10476264.
        setVector(object.position, rider);
        object.destination = null;

        if (object.actor) object.actor.teleportTo(object.position, true);
    }

    protected onMoveToLocationInVehicle(packet: PacketReader) {
        const move = GamePackets.readVehicleRiderMove(packet);
        const vehicle = this.vehicles.get(move.vehicleId);

        if (vehicle) this.setVehicleRider(vehicle, move.objectId, move.destination);
    }

    protected onStopMoveInVehicle(packet: PacketReader) {
        const stop = GamePackets.readVehicleRiderStop(packet);
        const vehicle = this.vehicles.get(stop.vehicleId);

        if (!vehicle) return;

        this.setVehicleRider(vehicle, stop.objectId, stop);
        this.withActor(stop.objectId, (actor, object) => {
            object.heading = stop.heading;
            actor.setRotationYaw(stop.heading);
        });
    }

    protected onRide(packet: PacketReader) {
        const ride = GamePackets.readRide(packet);

        if (ride.objectId === this.userId) {
            this.isMounted = ride.isMounted;
            this.updateMountable();
        }

        if (ride.isMounted) this.mounts.set(ride.objectId, ride);
        else this.mounts.delete(ride.objectId);

        this.withActor(ride.objectId, (actor, object) => {
            if (ride.mountType === GamePackets.MountType_T.WYVERN) actor.setFlying(true);
            else if (!ride.isMounted) {
                actor.setFlying(false);
                this.applySpeeds(actor, object.speeds, object.isRunning);
            }
        });
    }

    protected onFlyToLocation(packet: PacketReader) {
        const fly = GamePackets.readFlyToLocation(packet);
        const object = this.objects.get(fly.objectId);

        if (!object) return;

        setVector(object.position, fly.destination);
        object.destination = null;

        if (object.actor) object.actor.teleportTo(object.position, true);
    }

    protected clearKnownObjects() {
        for (const objectId of this.objects.keys()) if (objectId !== this.userId) this.removeObject(objectId);
        for (const objectId of this.pickups.keys()) this.removeObject(objectId);

        this.vehicles.clear();
    }

    protected placeObserver(position: GamePackets.Location_T, isObserving: boolean) {
        const player = this.manGame.getComponent("render").player;
        const user = this.objects.get(this.userId);

        this.clearKnownObjects(); // L2PcInstance.enterObserverMode/leaveObserverMode drop the known list without DeleteObject.
        setVector(user.position, position);
        user.destination = null;
        player.visible = !isObserving;
        player.teleportTo(user.position, true);
        this.manGame.getComponent("input").resetFollowCamera();
    }

    protected onObservationMode(packet: PacketReader) {
        const info = GamePackets.readObservationMode(packet);

        this.observation = { x: info.x, y: info.y, z: info.z };
        this.placeObserver(info, true);
    }

    protected onObservationReturn(packet: PacketReader) {
        const position = GamePackets.readPoint(packet);

        this.observation = null;
        this.placeObserver(position, false);
    }

    protected onRadarControl(packet: PacketReader) {
        const radar = GamePackets.readRadarControl(packet);

        switch (radar.action) {
            case 0: this.radarMarkers.push({ x: radar.x, y: radar.y, z: radar.z }); break;
            case 1: {
                const index = this.radarMarkers.findIndex(marker => marker.x === radar.x && marker.y === radar.y && marker.z === radar.z);

                if (index >= 0) this.radarMarkers.splice(index, 1);
            } break;
            case 2: this.radarMarkers.length = 0; break;
            default: throw new Error(`Unknown RadarControl action '${radar.action}'.`);
        }
    }

    protected onSSQStatus(packet: PacketReader) {
        const status = GamePackets.readSSQStatus(packet);

        this.ssqStatus.set(status.page, status);
    }

    protected onGameGuardQuery(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid GameGuardQuery payload.");

        this.game.gameGuardReply();
    }

    public getVehicleId() { return this.getVehicleIdOf(this.userId); }
    public getMount(objectId: number) { return this.mounts.get(objectId) || null; }
    public isObserving() { return this.observation !== null; }
    public getSpecialCamera() { return this.specialCamera; }
    public getCameraMode() { return this.cameraMode; }
    public getRadarMarkers(): readonly GamePackets.Location_T[] { return this.radarMarkers; }
    public getTownMap() { return this.townMap; }
    public getCalculatorId() { return this.calculatorId; }
    public getXMasSealItemId() { return this.xmasSealItemId; }
    public getDice() { return this.dice; }
    public getMonRace() { return this.monRace; }
    public getSSQStatus(page: number) { return this.ssqStatus.get(page) || null; }
    public getClanHallDecoration() { return this.clanHallDecoration; }
    public getSiegeInfo() { return this.siegeInfo; }
    public getSiegeAttackers() { return this.siegeAttackers; }
    public getSiegeDefenders() { return this.siegeDefenders; }

    public requestGetOnVehicle(vehicleId: number, position: GamePackets.Location_T) { if (this.inWorld && this.vehicles.has(vehicleId)) this.game.requestGetOnVehicle(vehicleId, position); }
    public requestGetOffVehicle(position: GamePackets.Location_T) { if (this.inWorld && this.getVehicleId()) this.game.requestGetOffVehicle(this.getVehicleId(), position); }
    public observerReturn() { if (this.inWorld && this.observation) this.game.observerReturn(); }
    public requestSSQStatus(page: number) { if (this.inWorld) this.game.requestSSQStatus(page); }
    public requestSiegeAttackerList(castleId: number) { if (this.inWorld) this.game.requestSiegeAttackerList(castleId); }
    public requestSiegeDefenderList(castleId: number) { if (this.inWorld) this.game.requestSiegeDefenderList(castleId); }
    public requestJoinSiege(castleId: number, isAttacker: boolean, isJoining: boolean) { if (this.inWorld) this.game.requestJoinSiege(castleId, isAttacker, isJoining); }
    public confirmSiegeWaitingList(castleId: number, clanId: number, isApproved: boolean) { if (this.inWorld) this.game.requestConfirmSiegeWaitingList(castleId, clanId, isApproved); }
    public startRotating(heading: number, side: number) { if (this.inWorld) this.game.startRotating(heading, side); }
    public finishRotating(heading: number, unknown: number) { if (this.inWorld) this.game.finishRotating(heading, unknown); }
    public requestRecordInfo() { if (this.inWorld) this.game.requestRecordInfo(); }
    public requestShowMiniMap() { if (this.inWorld) this.game.requestShowMiniMap(); }

    public requestMoveInVehicle(destination: GamePackets.Location_T) {
        const vehicleId = this.getVehicleId();

        if (!this.inWorld || !vehicleId) return;

        this.game.requestMoveToLocationInVehicle(vehicleId, destination, this.vehicles.get(vehicleId).riders.get(this.userId));
    }

    public cannotMoveInVehicle(position: GamePackets.Location_T) {
        const vehicleId = this.getVehicleId();

        if (this.inWorld && vehicleId) this.game.cannotMoveAnymoreInVehicle(vehicleId, position, this.manGame.getComponent("render").player.getRotationYaw());
    }

    protected onRecipeShopMsg(packet: PacketReader) {
        const message = GamePackets.readRecipeShopMsg(packet);

        this.recipeShopMessages.set(message.objectId, message.storeName);
    }

    protected onPartySpelled(packet: PacketReader) {
        const spelled = GamePackets.readPartySpelled(packet);

        this.partyEffects.set(spelled.objectId, spelled);
        this.ui.setPetStatusEffects(spelled);
    }

    protected onSnoop(packet: PacketReader) {
        const snoop = GamePackets.readSnoop(packet);
        const messages = this.snoops.get(snoop.conversationId);

        if (messages) messages.push(snoop);
        else this.snoops.set(snoop.conversationId, [snoop]);
    }

    public getRecipeBook() { return this.recipeBook; }
    public getRecipeItemMakeInfo() { return this.recipeItemMakeInfo; }
    public getRecipeShopManageList() { return this.recipeShopManageList; }
    public getRecipeShopSellList() { return this.recipeShopSellList; }
    public getRecipeShopItemInfo() { return this.recipeShopItemInfo; }
    public getRecipeShopMessage(objectId: number) { return this.recipeShopMessages.get(objectId); }
    public getHennaEquipList() { return this.hennaEquipList; }
    public getHennaItemInfo() { return this.hennaItemInfo; }
    public getPartyMatchRooms() { return this.partyMatchRooms; }
    public getPartyMatchPage() { return this.partyMatchPage; }
    public getPartyMatchDetail() { return this.partyMatchDetail; }
    public getPartyEffects(objectId: number) { return this.partyEffects.get(objectId); }
    public getTutorialQuestionMarks() { return this.tutorialQuestionMarks; }
    public getTutorialClientEvents() { return this.tutorialClientEvents; }
    public getSnoops() { return this.snoops; }

    public openRecipeBook(isDwarven: boolean) { if (this.inWorld) this.game.requestRecipeBookOpen(isDwarven); }
    public destroyRecipe(recipeId: number) { if (this.inWorld) this.game.requestRecipeBookDestroy(recipeId); }
    public requestRecipeItemMakeInfo(recipeId: number) { if (this.inWorld) this.game.requestRecipeItemMakeInfo(recipeId); }
    public makeRecipeItem(recipeId: number) { if (this.inWorld) this.game.requestRecipeItemMakeSelf(recipeId); }
    public requestRecipeShopManage() { if (this.inWorld) this.game.requestRecipeShopManageList(); }
    public getOwnRecipeShopMessage() { return this.recipeShopMessages.get(this.userId) ?? ""; }
    public setRecipeShopMessage(name: string) { if (this.inWorld) this.game.requestRecipeShopMessageSet(name); }
    public setRecipeShopList(items: GamePackets.RecipeShopListEntry_T[]) { if (this.inWorld) this.game.requestRecipeShopListSet(items); }
    public quitRecipeShopManage() { if (this.inWorld) this.game.requestRecipeShopManageQuit(); }
    public cancelRecipeShopManage() { if (this.inWorld) this.game.requestRecipeShopManageCancel(); }
    public requestRecipeShopMakeInfo(objectId: number, recipeId: number) { if (this.inWorld) this.game.requestRecipeShopMakeInfo(objectId, recipeId); }
    public makeRecipeShopItem(objectId: number, recipeId: number, price: number) { if (this.inWorld) this.game.requestRecipeShopMakeItem(objectId, recipeId, price); }
    public recipeShopManagePrev(objectId: number) { if (this.inWorld) this.game.requestRecipeShopManagePrev(objectId); }

    public requestHennaList() { if (this.inWorld) this.game.requestHennaList(0); }
    public requestHennaItemInfo(symbolId: number) { if (this.inWorld) this.game.requestHennaItemInfo(symbolId); }
    public equipHenna(symbolId: number) { if (this.inWorld) this.game.requestHennaEquip(symbolId); }
    public requestHennaUnequipList() { if (this.inWorld) this.game.requestHennaUnequipList(0); } // TODO: Capture the retail BD trailing DWORD; 103fa8b0 supplies no vararg.
    public requestHennaUnequipInfo(symbolId: number) { if (this.inWorld) this.game.requestHennaUnequipInfo(symbolId); }
    public unequipHenna(symbolId: number) { if (this.inWorld) this.game.requestHennaUnequip(symbolId); }

    public requestPartyMatchConfig(page: number, location: number, limit: number) { if (this.inWorld) this.game.requestPartyMatchConfig(page, location, limit); }
    public requestPartyMatchList(roomId: number, maxMembers: number, minLevel: number, maxLevel: number, lootType: number, title: string) { if (this.inWorld) this.game.requestPartyMatchList(roomId, maxMembers, minLevel, maxLevel, lootType, title); } // Creates (roomId 0) or edits a party room.
    public requestPartyMatchDetail(roomId: number, location = 0) { if (this.inWorld) this.game.requestPartyMatchDetail(roomId, location); }
    public inviteToParty(name: string, lootType: number) { if (this.inWorld) this.game.requestJoinParty(name, lootType); }
    public withdrawParty() { if (this.inWorld) this.game.requestWithDrawalParty(); }
    public oustPartyMember(name: string) { if (this.inWorld) this.game.requestOustPartyMember(name); }

    public tutorialLink(link: string) { if (this.inWorld) this.game.requestTutorialLinkHtml(link); }
    public tutorialPassCmd(command: string) { if (this.inWorld) this.game.requestTutorialPassCmdToServer(command); }
    public tutorialClientEvent(eventId: number) { if (this.inWorld) this.game.requestTutorialClientEvent(eventId); }

    public tutorialQuestionMark(id: number) {
        if (!this.inWorld) return;

        this.game.requestTutorialQuestionMark(id);
        this.tutorialQuestionMarks.delete(id);
    }

    public gmCommand(targetName: string, command: number) { if (this.inWorld) this.game.requestGMCommand(targetName, command); }
    public requestGmList() { if (this.inWorld) this.game.requestGmList(); }

    public snoopQuit(objectId: number) {
        if (!this.inWorld) return;

        this.game.snoopQuit(objectId);
        this.snoops.delete(objectId);
    }

    public petition(content: string, type: number) { if (this.inWorld) this.game.requestPetition(content, type); }
    public cancelPetition() { if (this.inWorld) this.game.requestPetitionCancel(); }

    public requestFriendList() { if (this.inWorld) this.game.requestFriendList(); }
    public deleteFriend(name: string) { if (this.inWorld) this.game.requestFriendDel(name); }
    public sendFriendMessage(receiver: string, message: string) { if (this.inWorld) this.game.requestSendFriendMsg(message, receiver); }

    public requestQuestList() { if (this.inWorld) this.game.requestQuestList(); }
    public abortQuest(questId: number) { if (this.inWorld) this.game.requestQuestAbort(questId); }

    public makeMacro(macro: GamePackets.Macro_T) {
        if (!this.inWorld) return;
        if (macro.commands.length > 12) throw new Error(`Invalid macro command count ${macro.commands.length}.`);

        this.game.requestMakeMacro(macro);
    }

    public deleteMacro(id: number) { if (this.inWorld && this.macros.has(id)) this.game.requestDeleteMacro(id); }

    public activateMacro(id: number) { // NWindow 0x10074e00 / 0x100a994c.
        const macro = this.macros.get(id);

        if (!this.inWorld || !macro) return;

        let execution = this.macroExecutions.get(id);

        if (!execution) {
            const rows: MacroRow_T[] = new Array(macro.commands.length);

            for (const command of macro.commands) {
                const index = command.index > 0 ? command.index - 1 : command.index;

                if (index < 0 || index >= rows.length) throw new Error(`Invalid macro row index ${command.index}.`);
                rows[index] = { command, duration: 0, start: 0, elapsed: 0 };
            }

            for (let i = 0; i < rows.length; i++)
                if (!rows[i]) throw new Error(`Macro ${id} has an uninitialized row ${i}.`);

            execution = { macro, rows, active: false, current: 0 };
            this.macroExecutions.set(id, execution);
        }

        execution.active = true;
    }

    public resetMacros() { // NWindow 0x100a76c0.
        for (const execution of this.macroExecutions.values()) {
            if (!execution.active) continue;

            execution.active = false;
            execution.current = 0;
            for (const row of execution.rows) row.duration = row.start = row.elapsed = 0;
        }
    }

    protected getMacroCommandType(text: string): number {
        if (text[0] !== "/" && text[0] !== "／") return 0x20000000;

        const tokens = getCommandTokens(text);
        const entry = Object.entries(this.ui.getStrings().commands).find(([, name]) => `/${name.toLowerCase()}` === tokens[0].toLowerCase());

        return entry ? Number(entry[0]) : -1;
    }

    protected executeMacroRow(execution: MacroExecution_T) { // NWindow 0x100a7f80.
        const row = execution.rows[execution.current], command = row.command;
        const [ctrl, shift] = this.ui.getInputModifiers();
        const player = this.manGame.getComponent("render").player;
        let animation = -1;

        switch (command.type) {
            case 1: this.game.requestMagicSkillUse(command.data1, ctrl, shift); return;
            case 2: {
                const actions: Record<number, number> = { 12: 2, 13: 3, 14: 4, 24: 6, 25: 5, 26: 7, 29: 8, 30: 9, 31: 10, 33: 11, 34: 12, 35: 13 };

                animation = command.data1 === 0 ? this.objects.get(this.userId).waitType === GamePackets.WaitType_T.WT_SITTING ? 0 : 1 : actions[command.data1] ?? -1;
                break;
            }
            case 3: {
                this.ui.sendMacroText(command.command);

                const type = this.getMacroCommandType(command.command);
                const actions: Record<number, number> = { 4: 0, 5: 1, 21: 2, 22: 3, 23: 4, 46: 5, 47: 6, 48: 7, 49: 8, 50: 9, 51: 10, 54: 11, 55: 12, 56: 13 };
                const next = execution.rows[execution.current + 1];

                if (type === 0x20000000 && next && next.command.type === 3 && this.getMacroCommandType(next.command.command) === 0x20000000)
                    row.duration = Math.fround(command.command.length * Math.fround(0.2));

                if (type === 28 || type === 29) {
                    const tokens = getCommandTokens(command.command), page = parseInt(tokens[1], 10), slot = parseInt(tokens[2], 10);

                    if (page >= 1 && page <= 10 && slot >= 1 && slot <= 12 && this.shortcuts.get((page - 1) * 12 + slot - 1)?.type === GamePackets.ShortCutType_T.TYPE_MACRO) this.cancelRecursiveMacro();
                }

                animation = type === 57 ? this.objects.get(this.userId).waitType === GamePackets.WaitType_T.WT_SITTING ? 0 : 1 : actions[type] ?? -1;
                break;
            }
            case 4: {
                if (command.data1 < 0 || command.data1 > 9 || command.data2 < 0 || command.data2 > 11) return;

                this.useShortCut(command.data1, command.data2, ctrl, shift);
                if (this.shortcuts.get(command.data1 * 12 + command.data2)?.type === GamePackets.ShortCutType_T.TYPE_MACRO) this.cancelRecursiveMacro();
                return;
            }
            case 5: debugger; throw new Error(`Macro item row has no initialized retail object ID.`);
            case 6: row.duration = Math.fround(command.data1); return;
            default: throw new Error(`Unknown macro row type ${command.type}.`);
        }

        const duration = player.getSocialAnimDuration(animation);

        if (duration > 0) row.duration = Math.fround(duration);
    }

    protected cancelRecursiveMacro() {
        for (const execution of this.macroExecutions.values()) execution.active = false;
        this.ui.showNotice(1339); // NWindow 0x10075990, dialog kind 31.
        this.playSystemMessageSound(1339);
    }

    protected getActiveMacroRow(): MacroRow_T {
        for (const id of this.macros.keys()) {
            const execution = this.macroExecutions.get(id);

            if (execution && execution.active) return execution.rows[execution.current];
        }

        return null;
    }

    protected notifyMacroCommand(types: number[], duration: number) {
        const row = this.getActiveMacroRow();

        if (row && row.command.type === 3 && types.includes(this.getMacroCommandType(row.command.command))) row.duration = duration;
    }

    protected notifyMacroSkill(id: number, hitTime: number) { // NWindow 0x100a8850.
        const row = this.getActiveMacroRow();

        if (!row) return;

        const command = row.command;
        let skillId: number;

        if (command.type === 1) skillId = command.data1;
        else if (command.type === 4) {
            if (command.data1 < 0 || command.data1 > 9 || command.data2 < 0 || command.data2 > 11) return;
            skillId = this.shortcuts.get(command.data1 * 12 + command.data2)?.id;
        } else if (command.type === 3) {
            const type = this.getMacroCommandType(command.command), tokens = getCommandTokens(command.command);

            if (type === 25 || type === 26) skillId = this.ui.getStrings().skillCommands[tokens.slice(1).join(" ").toLowerCase()];
            else if (type === 28 || type === 29) {
                const page = parseInt(tokens[1], 10), slot = parseInt(tokens[2], 10);

                if (!(page >= 1 && page <= 10 && slot >= 1 && slot <= 12)) return;
                skillId = this.shortcuts.get((page - 1) * 12 + slot - 1)?.id;
            } else if (id !== 0) return;
        } else return;

        if (id && skillId !== id) return;
        row.duration = Math.fround(Math.trunc(hitTime / 1000) + 1);
    }

    protected updateMacros(deltaTime: number) { // NWindow 0x100aaf60.
        const delta = Math.fround(deltaTime / 1000);

        for (const id of this.macros.keys()) {
            const execution = this.macroExecutions.get(id);

            if (!execution || !execution.active) continue;
            if (execution.current >= execution.rows.length) { execution.active = false; execution.current = 0; continue; }

            const row = execution.rows[execution.current], command = row.command;

            if (execution.current === 0 && row.start === 0) {
                row.start = row.elapsed = delta;
                this.executeMacroRow(execution);
                continue;
            }

            row.elapsed = Math.fround(row.elapsed + delta);
            let canAdvance = command.type !== 1;

            if (command.type === 4) {
                const shortcut = this.shortcuts.get(command.data1 * 12 + command.data2);

                if (shortcut && shortcut.type === GamePackets.ShortCutType_T.TYPE_MACRO) { execution.active = false; execution.current = 0; this.cancelRecursiveMacro(); continue; }
                if (shortcut && shortcut.type === GamePackets.ShortCutType_T.TYPE_SKILL) canAdvance = false;
            }
            if (command.type === 3) {
                const type = this.getMacroCommandType(command.command);

                if ([24, 25, 26, 14, 12, 13, 15].includes(type)) canAdvance = false;
                if (type === 12 || type === 13 || type === 15) {
                    const selected = this.objects.get(this.getTargetId());
                    let target: NetObject_T = null;

                    if (type === 12) {
                        const name = getCommandTokens(command.command).slice(1).join(" ").toLowerCase();

                        for (const object of this.objects.values()) {
                            if (object.name.toLowerCase() !== name) continue;
                            target = object;
                            if (!object.isSummon) break;
                        }
                    } else if (selected && selected.actor) target = type === 13 ? this.getNextEnemy(200, selected.objectId) : this.objects.get(selected.selectedId);

                    if (selected && selected.actor && target && target.actor && selected.objectId === target.objectId)
                        this.notifyMacroCommand([12, 13, 15], Math.fround(0.001));
                }
                if (type === 28 || type === 29) {
                    const tokens = getCommandTokens(command.command), page = parseInt(tokens[1], 10), slot = parseInt(tokens[2], 10);
                    const shortcut = page >= 1 && page <= 10 && slot >= 1 && slot <= 12 ? this.shortcuts.get((page - 1) * 12 + slot - 1) : null;

                    if (shortcut && shortcut.type === GamePackets.ShortCutType_T.TYPE_MACRO) { execution.active = false; execution.current = 0; this.cancelRecursiveMacro(); continue; }
                    if (shortcut && shortcut.type === GamePackets.ShortCutType_T.TYPE_SKILL) canAdvance = false;
                }
            }

            if (!(row.duration > 0 && row.elapsed - row.start > row.duration) && !(canAdvance && row.duration === 0)) continue;

            row.duration = row.start = row.elapsed = 0;
            execution.current++;
            if (execution.current >= execution.rows.length) continue;

            const next = execution.rows[execution.current];

            next.start = next.elapsed = delta;
            this.executeMacroRow(execution);
        }
    }

    public block(type: GamePackets.BlockType_T, name: string = null) { if (this.inWorld) this.game.requestBlock(type, name); }
    public userCommand(id: number) { if (this.inWorld) this.game.requestUserCommand(id); }
    public evaluate(objectId: number) { if (this.inWorld) this.game.requestEvaluate(objectId); }
    public showBoard() { if (this.inWorld) this.game.requestShowBoard(1); }
    public writeBoard(url: string, arg1: string, arg2: string, arg3: string, arg4: string, arg5: string) { if (this.inWorld) this.game.requestBBSwrite(url, arg1, arg2, arg3, arg4, arg5); }

    public requestAquireSkillInfo(id: number, level: number, mode = Number(this.aquireSkillFishing)) { if (this.inWorld) this.game.requestAquireSkillInfo(id, level, mode); }
    public aquireSkill(id: number, level: number, mode = Number(this.aquireSkillFishing)) { if (this.inWorld) this.game.requestAquireSkill(id, level, mode); }

    public deleteShortCut(page: number, slot: number) {
        const index = page * 12 + slot;

        if (!this.inWorld || !this.shortcuts.has(index)) return;

        const source = this.shortcuts.get(index);
        const item = source.type === GamePackets.ShortCutType_T.TYPE_ITEM ? this.getShortCutItem(source) : null;

        if (item && this.autoSoulShots.has(item.itemId)) {
            const isKept = [...this.shortcuts.values()].some(shortcut => shortcut.slot !== index && shortcut.type === GamePackets.ShortCutType_T.TYPE_ITEM && this.getShortCutItem(shortcut)?.itemId === item.itemId);

            if (!isKept) this.game.requestAutoSoulShot(item.itemId, false);
        }

        this.game.requestShortCutDel(index);
        this.shortcuts.delete(index);
        this.ui.removeShortCut(index);
    }

    protected onEventMatchMessage(packet: PacketReader) {
        const type = packet.c() as GamePackets.EventMatchMessage_T;
        const message = type === GamePackets.EventMatchMessage_T.STRING ? packet.S() : "";

        if (type > GamePackets.EventMatchMessage_T.STATIC_5 || packet.getRemaining()) throw new Error(`Invalid ExEventMatchMessage type ${type}.`);

        this.eventMatchMessageType = type;

        if (type === GamePackets.EventMatchMessage_T.STRING) this.ui.showMessage(message);
    }

    protected onPartyRoomMember(packet: PacketReader) {
        const room = GamePackets.readPartyRoomMembers(packet);

        this.partyRoomMode = room.mode;
        this.partyRoomMembers.clear();
        for (const member of room.members.slice(0, 20)) this.partyRoomMembers.set(member.objectId, member);
        this.ui.setPartyRoomMembers(this.partyRoomMode, Array.from(this.partyRoomMembers.values()), true);
    }

    protected onManagePartyRoomMember(packet: PacketReader) {
        const mode = packet.d() as GamePackets.PartyRoomMemberChange_T, member = GamePackets.readPartyRoomMember(packet);

        if (packet.getRemaining()) throw new Error("Invalid ExManagePartyRoomMember trailing data.");

        switch (mode) {
            case GamePackets.PartyRoomMemberChange_T.ADD:
                if (this.partyRoomMembers.size < 20) this.partyRoomMembers.set(member.objectId, member);
                break;
            case GamePackets.PartyRoomMemberChange_T.MODIFY:
                if (this.partyRoomMembers.has(member.objectId)) this.partyRoomMembers.set(member.objectId, member);
                break;
            case GamePackets.PartyRoomMemberChange_T.REMOVE: this.partyRoomMembers.delete(member.objectId); break;
            default: throw new Error(`Invalid ExManagePartyRoomMember mode ${mode}.`);
        }
        if (member.objectId === this.userId) this.partyRoomMode = mode === GamePackets.PartyRoomMemberChange_T.REMOVE || mode === GamePackets.PartyRoomMemberChange_T.MODIFY && !this.partyRoomMembers.has(member.objectId) ? 0 : member.role;
        this.ui.setPartyRoomMembers(this.partyRoomMode, Array.from(this.partyRoomMembers.values()), false);
    }

    protected onClosePartyRoom(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExClosePartyRoom payload.");

        this.partyRoomMode = -1;
        this.partyRoomMembers.clear();
        this.ui.closePartyRoom();
    }

    protected onFishingStart(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const fishType = packet.d(), x = packet.d(), y = packet.d(), z = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid ExFishingStart payload.");

        if (!object || !object.actor || object.actor.getUnrealScriptProperty("bFish")) return;

        const render = this.manGame.getComponent("render");
        let component = object.actor.findComponent<PawnFishingComponent>("pawnFishing");

        if (!component) component = object.actor.addComponent(new PawnFishingComponent(render));
        void component.start(new Vector3(x, y, z), fishType, object.actor === render.player, this.ui.getScreenCanvas().width);
        if (object.actor === render.player) this.ui.startFishing();
        object.fishing = { fishType, x, y, z, isFighting: false, time: 0, fishHp: 0, maxFishHp: 0, mode: 0, lureType: 0, isGoodUse: false, animation: 0, penalty: 0 };
    }

    protected onFishingEnd(packet: PacketReader) {
        const object = this.objects.get(packet.d()), isWin = packet.c();

        if (isWin > 1 || packet.getRemaining()) throw new Error("Invalid ExFishingEnd payload.");

        if (!object || !object.actor || !object.actor.getUnrealScriptProperty("bFish")) return;

        const component = object.actor.findComponent<PawnFishingComponent>("pawnFishing");

        if (component) component.end(isWin !== 0);
        if (object.actor === this.manGame.getComponent("render").player) this.ui.endFishing(isWin !== 0);
        object.fishing = null;
    }

    protected onFishingStartCombat(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const time = packet.d(), maxFishHp = packet.d(), mode = packet.c(), lureType = packet.c();

        if (packet.getRemaining()) throw new Error("Invalid ExFishingStartCombat payload.");
        if (!object || !object.fishing) return;

        Object.assign(object.fishing, { isFighting: true, time, fishHp: maxFishHp, maxFishHp, mode, lureType });
        if (!object.actor || !object.actor.getUnrealScriptProperty("bFish")) return;
        const component = object.actor.findComponent<PawnFishingComponent>("pawnFishing");
        const hasFloat = component && component.getFloat();
        const wasBattle = object.actor.getUnrealScriptProperty("CurFishingType") === FishingType_T.FST_BATTLE;

        if (component) component.startCombat(mode);
        if (hasFloat && !wasBattle && object.actor === this.manGame.getComponent("render").player) this.ui.startFishingCombat(maxFishHp, time, mode, lureType);
    }

    protected onFishingHpRegen(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const time = packet.d(), fishHp = packet.d(), mode = packet.c(), isGoodUse = packet.c() !== 0, animation = packet.c(), penalty = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid ExFishingHpRegen payload.");
        if (!object || !object.fishing) return; // Broadcast: a fisher seen mid-fight never sent us ExFishingStart.

        Object.assign(object.fishing, { isFighting: true, time, fishHp, mode, isGoodUse, animation, penalty });
        if (!object.actor || !object.actor.getUnrealScriptProperty("bFish") || object.actor.getUnrealScriptProperty("CurFishingType") !== FishingType_T.FST_BATTLE) return;
        const component = object.actor.findComponent<PawnFishingComponent>("pawnFishing");

        if (component) component.updateCombat(mode, animation);
        if (component && component.getFloat() && object.actor === this.manGame.getComponent("render").player) this.ui.updateFishing(fishHp, time, isGoodUse, mode, animation, penalty);
    }

    protected onShowQuestMark(packet: PacketReader) {
        const questId = packet.d();

        if (questId <= 0 || packet.getRemaining()) throw new Error("Invalid ExShowQuestMark payload.");

        this.questMarkId = questId;
    }

    protected onOpenMPCC(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExOpenMPCC payload.");

        this.isInCommandChannel = true;
        this.ui.openCommandChannel();
    }

    protected onCloseMPCC(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExCloseMPCC payload.");

        this.isInCommandChannel = false;
        this.commandChannel = null;
        this.ui.closeCommandChannel();
    }

    protected onAskJoinMPCC(packet: PacketReader) {
        const name = packet.S();

        if (!name || packet.getRemaining()) throw new Error("Invalid ExAskJoinMPCC payload.");

        this.commandChannelInviter = name;
    }

    protected onOlympiadMode(packet: PacketReader) {
        const mode = packet.c();

        if (mode > 3 || packet.getRemaining()) throw new Error(`Invalid ExOlympiadMode ${mode}.`);

        this.olympiadMode = mode;
        this.ui.setOlympiadMode(mode);
    }

    protected onOlympiadMatchEnd(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExOlympiadMatchEnd payload.");

        this.olympiadUsers.clear();
        this.olympiadEffects.clear();
        this.ui.resetOlympiadMatch();
    }

    protected onMailArrived(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExMailArrived payload.");

        this.hasNewMail = true;
    }

    public oustFromPartyRoom(objectId: number) { if (this.inWorld && this.partyRoomMembers.has(objectId)) this.game.requestOustFromPartyRoom(objectId); }
    public dismissPartyRoom(roomId: number) { if (this.inWorld) this.game.requestDismissPartyRoom(roomId); }
    public withdrawPartyRoom(roomId: number) { if (this.inWorld) this.game.requestWithdrawPartyRoom(roomId); }
    public changePartyLeader(name: string) { if (this.inWorld) this.game.requestChangePartyLeader(name); }
    public requestEnchantSkillInfo(id: number, level: number) { if (this.inWorld) this.game.requestExEnchantSkillInfo(id, level); }
    public enchantSkill(id: number, level: number) { if (this.inWorld) this.game.requestExEnchantSkill(id, level); }
    public requestManorList() { if (this.inWorld) this.game.requestManorList(); }
    public procureCrops(items: GamePackets.ProcureCropRequest_T[]) { if (this.inWorld) this.game.requestProcureCropList(items); }
    public setManorSeeds(manorId: number, items: GamePackets.SeedSettingRequest_T[]) { if (this.inWorld) this.game.requestSetSeed(manorId, items); }
    public setManorCrops(manorId: number, items: GamePackets.CropSettingRequest_T[]) { if (this.inWorld) this.game.requestSetCrop(manorId, items); }
    public writeHeroWords(words: string) { if (this.inWorld) this.game.requestWriteHeroWords(words); }
    public inviteToCommandChannel(name: string) { if (this.inWorld) this.game.requestExAskJoinMPCC(name); }
    public oustFromCommandChannel(name: string) { if (this.inWorld) this.game.requestExOustFromMPCC(name); }
    public endOlympiadObserver() { if (this.inWorld) this.game.requestOlympiadObserverEnd(); }
    public requestOlympiadMatchList() { if (this.inWorld) this.game.requestOlympiadMatchList(); }

    public answerCommandChannelInvite(isAccepted: boolean) {
        if (!this.inWorld || !this.commandChannelInviter) return;

        this.commandChannelInviter = null;
        this.game.requestExAcceptJoinMPCC(isAccepted);
    }

    protected waitNextTick(): Promise<void> {
        if (!this.nextTick) this.nextTick = new Promise(resolve => this.resolveNextTick = resolve);

        return this.nextTick;
    }

    public onEngineTick(currentTime: number, deltaTime: number): void {
        this.tickGMServerTransfer();
        if (this.ui) this.ui.tick(deltaTime);

        if (this.resolveNextTick) {
            const resolve = this.resolveNextTick;

            this.nextTick = this.resolveNextTick = null;
            resolve();
        }

        if (this.lobby) this.lobby.tick(deltaTime);
        if (this.lobby && this.ui.isLobbyVisible()) this.ui.setPawnLabels(this.lobby.getPawnLabels(this.characters, this.ui.getScreenCanvas().width, this.ui.getScreenCanvas().height));
        if (!this.inWorld) return;

        this.updateGNOManager(deltaTime);
        this.updateMacros(deltaTime);
        this.updateVehicles(deltaTime);

        const player = this.manGame.getComponent("render").player;
        const isMoving = player.isLocomoting();

        if ((isMoving || this.wasMoving) && currentTime - this.lastValidateAt >= VALIDATE_POSITION_INTERVAL) {
            this.lastValidateAt = currentTime;
            this.wasMoving = isMoving;
            this.game.validatePosition(player.position, player.getRotationYaw());
        }

        if (!isMoving || !player.isInteractive()) this.stuckCheckAt = 0;
        else if (this.stuckCheckAt === 0) {
            this.stuckCheckAt = currentTime;
            this.stuckPosition.copy(player.position);
        } else if (currentTime - this.stuckCheckAt >= STUCK_INTERVAL) { // Server walks straight through whatever blocked us; CannotMoveAnymore makes it adopt our stop point.
            if (player.position.distanceTo(this.stuckPosition) < STUCK_DISTANCE) {
                player.stopMoving();
                this.game.cannotMoveAnymore(player.position, player.getRotationYaw());
                this.stuckCheckAt = 0;
            } else {
                this.stuckCheckAt = currentTime;
                this.stuckPosition.copy(player.position);
            }
        }
    }

    public getNameplates(): Nameplate_T[] {
        const player = this.manGame.getComponent("render").player;
        const mouseTarget = this.manGame.getComponent("input").getMouseTarget();
        const plates: Nameplate_T[] = [];
        const now = performance.now();

        for (const object of this.objects.values()) {
            const actor = object.actor;

            if (!actor || !actor.parent || !object.name) continue;

            let parent = actor;

            while (parent && parent.visible) parent = parent.parent as BaseActor;
            if (parent) continue;

            const isTarget = object.objectId === this.getTargetId(), isMouseTarget = actor === mouseTarget;
            const distance = Math.trunc(actor.position.distanceTo(player.position));

            if (!isTarget && !isMouseTarget && distance >= NAMEPLATE_DISTANCE) continue; // FDynamicActor::Render branch C: retail l2.ini [CharacterDisplay] Name=true, Dist=1000.

            const storeMessages = object.privateStoreType === GamePackets.PrivateStoreType_T.STORE_PRIVATE_BUY ? this.privateStoreBuyMsgs : object.privateStoreType === GamePackets.PrivateStoreType_T.STORE_PRIVATE_MANUFACTURE ? this.recipeShopMessages : this.privateStoreSellMsgs;

            plates.push({ actor, name: object.name, title: object.title, isNpc: object.kind === "npc", isSummon: object.isSummon, isDead: object.isDead, isSitting: object.waitType === GamePackets.WaitType_T.WT_SITTING, karma: object.karma, pvpFlag: object.pvpFlag, recommendations: object.recommendations, nameColor: object.nameColor, titleColor: object.titleColor, isTarget, isMouseTarget, isChatRange: distance <= NAMEPLATE_DISTANCE, privateStoreType: object.privateStoreType, storeMessage: storeMessages.get(object.objectId) || "", chatMessage: now - object.chatTime < CHAT_BALLOON_TIME ? object.chatMessage : null });
        }

        return plates;
    }

    public onBeforeEngineTick(_currentTime: number, _deltaTime: number): void {
        if (this.ui) this.ui.updateNameplates();
    }

    public onAfterEngineTick(_currentTime: number, _deltaTime: number): void {
        if (this.ui) this.ui.render();
    }
}

export default NetworkManager;
