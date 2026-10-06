import { LoopOnce, Raycaster, Vector3 } from "three";
import BaseActor from "../base-actor";
import PawnAttackComponent, { type NAttackActionParam_T } from "../objects/components/pawn-attack-component";
import PawnEquipmentComponent from "../objects/components/pawn-equipment-component";
import LoginClient from "./login-client";
import GameClient from "./game-client";
import NetworkUI from "./network-ui";
import L2Lobby from "./l2-lobby";
import L2Pickup from "../objects/l2-pickup";
import { getRotatorQuaternionElements } from "../assets/unreal/utils/rotator";
import { GameServerPacket_T, GameServerExPacket_T, ShortCutType_T, readShortCut, Paperdoll_T, Race_T, Say2_T, StatusUpdate_T, SystemMessageParam_T, NPC_ID_OFFSET, readCharInfo, readCharSelectInfo, readCharSelected, readCharTemplates, readNpcInfo, readServerObjectInfo, readPetInfo, readUserInfo, readInventoryItem, readShowBoard, WaitType_T, PlaySoundType_T, GaugeColor_T, AttackFlags_T, readPledgeWar, readCrest, readPledgeCrestLarge, readWarehouseList, readPackageSendableList, readPackageToList, readPrivateStoreManageListSell, readPrivateStoreListSell, readPrivateStoreManageListBuy, readPrivateStoreListBuy, readMultiSellList, readShopPreviewList, readShopPreviewInfo, readBuyListSeed, readSellListProcure, readPoint, readVehicleLocation, readVehicleDeparture, readVehicleRider, readVehicleRiderStop, readVehicleRiderMove, readRide, readFlyToLocation, readSpecialCamera, readObservationMode, readRadarControl, readTownMap, readMonRaceInfo, readDice, readSSQStatus, readClanHallDecoration, readSiegeInfo, readSiegeClanList, readRecipeBookItemList, readRecipeItemMakeInfo, readRecipeShopManageList, readRecipeShopSellList, readRecipeShopItemInfo, readRecipeShopMsg, readHennaEquipList, readHennaItemInfo, readPartyMatchList, readPartyMatchDetail, readPartySpelled, readSnoop, readGMViewCharacterInfo, readGMViewPledgeInfo, readGMViewSkillInfo, readGMViewQuestList, readGMViewItemList, readGMViewWarehouseWithdrawList, readGMViewHennaInfo, readEnchantSkillList, readEnchantSkillInfo, readHeroList, readCommandChannelInfo, readOlympiadUserInfo, readOlympiadSpelledInfo, readPartyRoomMember, readPartyRoomMembers, readManorList, readShowSeedInfo, readShowCropInfo, readShowManorDefaultInfo, readShowSeedSetting, readShowCropSetting, readShowSellCropList, readShowProcureCropDetail, MountType_T, BlockType_T, EventMatchMessage_T, PartyRoomMemberChange_T } from "./game-packets";
import PawnCubicComponent from "../objects/components/pawn-cubic-component";
import type PacketReader from "./packet-reader";
import type { SessionKey_T } from "./login-client";
import type { PawnCreateSelection_T } from "../nwindow/nc-pawn-create-wnd";
import type { CharacterCreate_T } from "./game-client";
import type { ShortCut_T, Appearance_T, CharSelectEntry_T, CharTemplate_T, CreatureInfo_T, NpcInfo_T, Location_T, Speeds_T, InventoryItem_T, SkillEntry_T, AbnormalStatus_T, QuestState_T, HennaStatus_T, Macro_T, FriendEntry_T, PartyMember_T, PartyInvite_T, PledgeInvite_T, FriendInvite_T, ClanInfo_T, ClanMember_T, AquireSkillEntry_T, AquireSkillInfo_T, AquireSkillRequirement_T, TradeItem_T, ShopItem_T, StorageMaxCount_T, AllyInvite_T, PledgeWar_T, WarehouseList_T, PackageSendableList_T, PrivateStoreManageSell_T, PrivateStoreSellList_T, PrivateStoreManageBuy_T, PrivateStoreBuyList_T, MultiSellList_T, ShopPreviewList_T, BuyListSeed_T, SellListProcure_T, ItemCount_T, ItemIdCount_T, SellItemRequest_T, PrivateStoreOffer_T, PrivateStoreBuyOffer_T, PrivateStoreSellOffer_T, Ride_T, SpecialCamera_T, TownMap_T, MonRaceInfo_T, Dice_T, SSQStatus_T, ClanHallDecoration_T, SiegeInfo_T, SiegeClanList_T, RecipeShopListEntry_T, RecipeBook_T, RecipeItemMakeInfo_T, RecipeShopManageList_T, RecipeShopSellList_T, RecipeShopItemInfo_T, HennaEquipList_T, HennaItemInfo_T, PartyMatchRoom_T, PartyMatchDetail_T, PartySpelled_T, Snoop_T, GMViewPledgeInfo_T, GMViewSkillInfo_T, GMViewQuestList_T, GMViewItemList_T, GMViewWarehouseWithdrawList_T, GMViewCharacterInfo_T, EnchantSkill_T, EnchantSkillInfo_T, HeroEntry_T, CommandChannelInfo_T, OlympiadUserInfo_T, PartyRoomMember_T, ManorEntry_T, ManorDefaultCrop_T, ManorSeedInfo_T, ManorCropInfo_T, ManorSeedSettings_T, ManorCropSettings_T, ManorSellCropList_T, ManorProcureCropDetail_T, ProcureCropRequest_T, SeedSettingRequest_T, CropSettingRequest_T, FishingState_T } from "./game-packets";
import type { IEngineComponent } from "../game/components";
import type { Nameplate_T } from "./network-ui";
import type GameManager from "../game/game-manager";
import type { ICharacterGroup, ICharacterArmorSelection } from "@l2js/engine/contracts/pawn";
import type MovableObject from "../objects/movable-object";
import Radar from "../rendering/radar";
import type { RadarState_T } from "../rendering/radar";

type NetObjectKind_T = "user" | "player" | "npc";
type NetSkill_T = { id: number, level: number, hitTime: number, associatedActors: BaseActor[], associatedObjectIds: number[] };
type PendingAttack_T = { hits: readonly NAttackActionParam_T[], position: Location_T };
type PendingSkill_T = { targetObjectId: number, id: number, level: number, hitTime: number, position: Location_T, isTransient: boolean, associatedObjectIds: number[] };

type NetObject_T = {
    objectId: number;
    selectedId: number;
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
    isSummon: boolean;
    isDead: boolean;
    appearanceKey: string;
    speeds: Speeds_T;
    isRunning: boolean;
    isInCombat: boolean;
    waitType: WaitType_T;
    chairStaticObjectId: number;
    cubics: number[];
    fishing: FishingState_T;
    skill?: NetSkill_T;
    pendingAttack: PendingAttack_T;
    pendingSkill: PendingSkill_T;
};
type NetVehicle_T = { objectId: number, position: Vector3, heading: number, destination: Vector3, moveSpeed: number, rotationSpeed: number, isStarted: boolean, riders: Map<number, Vector3> };
type PetRemainTime_T = { maxTime: number, remainingTime: number };

const MYSTIC_BODY_CLASS_IDS = new Set([10, 11, 12, 13, 14, 15, 16, 17, 25, 26, 27, 28, 29, 30, 38, 39, 40, 41, 42, 43, 49, 50, 51, 52, 94, 95, 96, 97, 98, 103, 104, 105, 110, 111, 112, 115, 116]); // ClassId.isMage excludes orcMage (49), which uses the Shaman body.
const VALIDATE_POSITION_INTERVAL = 1000;
const STUCK_INTERVAL = 600;
const STUCK_DISTANCE = 2;
const SNAP_DISTANCE = 300;
const NAMEPLATE_DISTANCE = 1000;
const STOP_SNAP_DISTANCE = 32;
const GAME_TIME_SCALE = 1 / 6; // GameTimeController: one in-game day lasts four real hours.
const NETWORK_BOW_RANGE = 2000;
const NPC_SPAWN_CONCURRENCY = 2;
const CUBIC_SKILLS = new Set([4049, 4050, 4051, 4052, 4053, 4054, 4055, 4164, 4165, 4166]);

const tmpLocation: Location_T = { x: 0, y: 0, z: 0 };
const tmpEarthquakePosition = new Vector3();
const tmpEarthquakeRotationAmplitude = new Vector3(0, 0.1, 0);
const tmpEarthquakeRotationVelocity = new Vector3(0, 1000, 0);
const tmpEarthquakePositionAmplitude = new Vector3();

function setVector(target: Vector3, location: Location_T): Vector3 { return target.set(location.x, location.y, location.z); }

function distanceXY(a: Vector3, b: Vector3): number { return Math.hypot(a.x - b.x, a.y - b.y); }

export class NetworkManager implements IEngineComponent<GameManager> {
    protected manGame: GameManager;
    protected ui: NetworkUI;
    protected login: LoginClient = null;
    protected lobby: L2Lobby = null;
    protected loginUrl: string = null;
    protected game: GameClient = null;
    protected account: string = null;
    protected sessionKey: SessionKey_T = null;
    protected characters: CharSelectEntry_T[] = [];
    protected templates: CharTemplate_T[] = [];
    protected charGroups: ICharacterGroup[] = null;
    protected readonly objects = new Map<number, NetObject_T>();
    protected readonly doors = new Map<number, MovableObject>();
    protected readonly staticObjects = new Map<number, number>();
    protected readonly appearances = new Map<number, Appearance_T>();
    protected readonly pickups = new Map<number, L2Pickup>();
    protected readonly npcNames = new Map<number, string>();
    protected readonly shortcuts = new Map<number, ShortCut_T>();
    protected readonly autoSoulShots = new Set<number>();
    protected readonly inventory = new Map<number, InventoryItem_T>();
    protected readonly appearanceLoads = new WeakMap<BaseActor, Promise<void>>();
    protected readonly bodyKeys = new WeakMap<BaseActor, string>();
    protected readonly appearanceRequests = new WeakMap<BaseActor, number>();
    protected storageMaxCount: StorageMaxCount_T = null;
    protected readonly skills = new Map<number, SkillEntry_T>();
    protected readonly questStates = new Map<number, QuestState_T>();
    protected hennaStatus: HennaStatus_T = null;
    protected macroRevision = -1;
    protected readonly macros = new Map<number, Macro_T>();
    protected readonly friends = new Map<number, FriendEntry_T>();
    protected readonly partyMembers = new Map<number, PartyMember_T>();
    protected partyInvite: PartyInvite_T = null;
    protected pledgeInvite: PledgeInvite_T = null;
    protected friendInvite: FriendInvite_T = null;
    protected partyJoinResult = -1;
    protected pledgeJoinId = 0;
    protected clanInfo: ClanInfo_T = null;
    protected readonly clanMembers = new Map<string, ClanMember_T>();
    protected aquireSkillFishing = false;
    protected aquireSkills: AquireSkillEntry_T[] = [];
    protected aquireSkillInfo: AquireSkillInfo_T = null;
    protected tradePartnerId = 0;
    protected tradeRequestId = 0;
    protected readonly tradeOwnItems: TradeItem_T[] = [];
    protected readonly tradeOtherItems: TradeItem_T[] = [];
    protected readonly tradeAvailableItems: TradeItem_T[] = [];
    protected tradeDone = 0;
    protected shopSellMoney = 0;
    protected shopSellNpcId = 0;
    protected readonly shopSellItems: ShopItem_T[] = [];
    protected shopBuyMoney = 0;
    protected shopBuyListId = 0;
    protected readonly shopBuyItems: ShopItem_T[] = [];
    protected partyLeaderId = 0;
    protected partyLootDistribution = 0;
    protected etcStatus: { charges: number, weightPenalty: number, messageRefusal: number, dangerArea: number, expertisePenalty: number } = null;
    protected signsSky = 0;
    protected petStatusType = -1;
    protected petInfo: { objectId: number; isMountable: boolean } = null;
    protected isMounted = false;
    protected npcSpawnCount = 0;
    protected readonly npcSpawnWaiters: (() => void)[] = [];
    protected readonly petInventory = new Map<number, InventoryItem_T>();
    protected petRemainTime: PetRemainTime_T = null;
    protected readonly abnormalStatuses = new Map<string, AbnormalStatus_T>();
    protected shortBuff: AbnormalStatus_T = null;
    protected boardHtml = "";
    protected userId = 0;
    protected selectedSlot = -1;
    protected inWorld = false;
    protected isRunning = true;
    protected lastValidateAt = 0;
    protected wasMoving = false;
    protected readonly stuckPosition = new Vector3();
    protected skillListLoad: Promise<void> = null;
    protected resolveSkillList: () => void = null;
    protected userAppearanceLoad: Promise<void> = null;
    protected nextTick: Promise<void> = null;
    protected resolveNextTick: () => void = null;
    protected allyInvite: AllyInvite_T = null;
    protected pledgePower = 0;
    protected pledgeWarStart: PledgeWar_T = null;
    protected pledgeWarStop: PledgeWar_T = null;
    protected pledgeWarSurrender: PledgeWar_T = null;
    protected readonly pledgeCrests = new Map<number, Uint8Array>();
    protected readonly pledgeLargeCrests = new Map<number, Uint8Array>();
    protected readonly clanLargeCrestIds = new Map<number, number>();
    protected readonly allyCrests = new Map<number, Uint8Array>();
    protected warehouseDeposit: WarehouseList_T = null;
    protected warehouseWithdraw: WarehouseList_T = null;
    protected privateStoreManageSell: PrivateStoreManageSell_T = null;
    protected privateStoreSell: PrivateStoreSellList_T = null;
    protected privateStoreManageBuy: PrivateStoreManageBuy_T = null;
    protected privateStoreBuy: PrivateStoreBuyList_T = null;
    protected readonly privateStoreSellMsgs = new Map<number, string>();
    protected readonly privateStoreBuyMsgs = new Map<number, string>();
    protected readonly packageTargets = new Map<number, string>();
    protected packageSendable: PackageSendableList_T = null;
    protected multiSell: MultiSellList_T = null;
    protected shopPreview: ShopPreviewList_T = null;
    protected shopPreviewItems: number[] = null;
    protected seedShop: BuyListSeed_T = null;
    protected cropProcure: SellListProcure_T = null;
    protected readonly vehicles = new Map<number, NetVehicle_T>();
    protected readonly mounts = new Map<number, Ride_T>();
    protected observation: Location_T = null;
    protected specialCamera: SpecialCamera_T = null;
    protected cameraMode = 0;
    protected readonly radarMarkers: Location_T[] = [];
    protected readonly radarState: RadarState_T = { party: [], target: null, markers: this.radarMarkers };
    protected readonly partyPositions = new Map<number, Location_T>();
    protected townMap: TownMap_T = null;
    protected calculatorId = 0;
    protected xmasSealItemId = 0;
    protected dice: Dice_T = null;
    protected monRace: MonRaceInfo_T = null;
    protected readonly ssqStatus = new Map<number, SSQStatus_T>();
    protected clanHallDecoration: ClanHallDecoration_T = null;
    protected siegeInfo: SiegeInfo_T = null;
    protected siegeAttackers: SiegeClanList_T = null;
    protected siegeDefenders: SiegeClanList_T = null;
    protected recipeBook: RecipeBook_T = null;
    protected recipeItemMakeInfo: RecipeItemMakeInfo_T = null;
    protected recipeShopManageList: RecipeShopManageList_T = null;
    protected recipeShopSellList: RecipeShopSellList_T = null;
    protected recipeShopItemInfo: RecipeShopItemInfo_T = null;
    protected readonly recipeShopMessages = new Map<number, string>();
    protected hennaEquipList: HennaEquipList_T = null;
    protected hennaItemInfo: HennaItemInfo_T = null;
    protected partyMatchRooms: PartyMatchRoom_T[] = [];
    protected partyMatchDetail: PartyMatchDetail_T = null;
    protected readonly partyEffects = new Map<number, PartySpelled_T>();
    protected readonly tutorialQuestionMarks = new Set<number>();
    protected tutorialClientEvents = 0;
    protected gmCharacterInfo: GMViewCharacterInfo_T = null;
    protected gmPledgeInfo: GMViewPledgeInfo_T = null;
    protected gmSkillInfo: GMViewSkillInfo_T = null;
    protected gmQuestList: GMViewQuestList_T = null;
    protected gmItemList: GMViewItemList_T = null;
    protected gmWarehouseList: GMViewWarehouseWithdrawList_T = null;
    protected gmHennaStatus: HennaStatus_T = null;
    protected readonly snoops = new Map<number, Snoop_T[]>();
    protected enchantSkills: EnchantSkill_T[] = [];
    protected enchantSkillInfo: EnchantSkillInfo_T = null;
    protected eventMatchMessageType = -1;
    protected questMarkId = 0;
    protected hasNewMail = false;
    protected heroes: HeroEntry_T[] = [];
    protected partyRoomMode = -1;
    protected readonly partyRoomMembers = new Map<number, PartyRoomMember_T>();
    protected isInCommandChannel = false;
    protected commandChannel: CommandChannelInfo_T = null;
    protected commandChannelInviter: string = null;
    protected olympiadMode = 0;
    protected readonly olympiadUsers = new Map<number, OlympiadUserInfo_T>();
    protected readonly olympiadEffects = new Map<number, AbnormalStatus_T[]>();
    protected manors: ManorEntry_T[] = [];
    protected manorSeedInfo: ManorSeedInfo_T = null;
    protected manorCropInfo: ManorCropInfo_T = null;
    protected manorDefaultCrops: ManorDefaultCrop_T[] = [];
    protected manorSeedSettings: ManorSeedSettings_T = null;
    protected manorCropSettings: ManorCropSettings_T = null;
    protected manorSellCrops: ManorSellCropList_T = null;
    protected manorProcureCropDetail: ManorProcureCropDetail_T = null;
    protected stuckCheckAt = 0;

    public setParent(parent: GameManager): this { this.manGame = parent; return this; }
    public getParent(): GameManager { return this.manGame; }

    public isInWorld() { return this.inWorld; }

    protected get targetId() {
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
        const state = this.radarState, target = this.objects.get(this.targetId);

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
        if (this.login) this.login.close();

        this.login = new LoginClient();
        this.account = account.toLowerCase();
        this.ui.setLoginBusy(true);

        try {
            const servers = await this.login.login(this.loginUrl, account, password);

            this.ui.showServers(servers, this.login.lastServerId);
        } catch (e) {
            this.ui.showLogin();
            this.ui.showMessage((e as Error).message);
        }
    }

    public cancelLogin() {
        this.login.close();
        this.ui.showLogin();
    }

    public async connectGame(serverId: number) {
        const server = this.login.servers.find(entry => entry.id === serverId);

        try {
            this.sessionKey = await this.login.selectServer(server.id);
            this.game = new GameClient();
            this.game.onPacket = (opcode, packet) => this.onPacket(opcode, packet);
            this.game.onClose = (code, reason) => void this.onDisconnected(`Game server closed the connection (${code}${reason ? ` ${reason}` : ""}).`);

            await this.game.connect(this.login.getGameServerUrl(server));
        } catch (e) {
            this.ui.showLogin();
            this.ui.showMessage((e as Error).message);
        }
    }

    public relogin() {
        this.game.close();
        this.game = null;
        this.lobby.showLogin();
        this.ui.showLogin();
    }

    public previewCharacter(index: number) {
        this.lobby.select(index);
        this.ui.setSelectedCharacter(index);
    }

    public cancelCreate() {
        this.ui.showCharacters(this.characters);
        void this.lobby.showSelect(this.characters);
    }

    public previewCreate(selection: PawnCreateSelection_T) { void this.lobby.previewCreate(selection); }
    public rotateCreatePreview(_direction: number) { } // TODO: DefaultCharacterTurn(idx, +-2.0) rate units are not decoded.
    public zoomCreatePreview(isIn: boolean) { this.lobby.zoomCreate(isIn); }

    public selectCharacter(slot: number) {
        this.selectedSlot = slot;
        this.ui.showLoading();
        this.game.characterSelected(slot);
    }

    public requestNewCharacter() { this.game.newCharacter(); }
    public createCharacter(info: CharacterCreate_T) { this.game.characterCreate(info); }
    public deleteCharacter(slot: number) { this.game.characterDelete(slot); }
    public restoreCharacter(slot: number) { this.game.characterRestore(slot); }

    public say(text: string, type: Say2_T, target: string = null) { this.game.say2(text, type, target); }
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

    public requestPickup(raycaster: Raycaster, maxDistance: number, isShift: boolean = false): boolean {
        let nearest: L2Pickup = null;

        for (const pickup of this.pickups.values()) {
            const distance = pickup.getPickDistance(raycaster);

            if (distance >= maxDistance) continue;

            nearest = pickup;
            maxDistance = distance;
        }

        if (!nearest) return false;

        this.game.action(nearest.objectId, this.manGame.getComponent("render").player.position, isShift);
        return true;
    }

    protected findObjectByActor(actor: BaseActor): NetObject_T {
        for (const object of this.objects.values())
            if (object.actor === actor) return object;

        return null;
    }

    protected async onDisconnected(reason: string) {
        this.leaveWorld();
        this.game = null;
        this.ui.showMessage(reason);
        await this.showLogin(this.loginUrl);
        this.ui.showMessage(reason);
    }

    protected leaveWorld() {
        const render = this.manGame.getComponent("render");

        for (const object of this.objects.values()) {
            object.isRemoved = true;

            if (object.actor && object.kind !== "user") render.removePawn(object.actor);
        }

        this.objects.clear();
        this.doors.clear();
        this.staticObjects.clear();
        this.appearances.clear();
        const cubics = render.player.findComponent<PawnCubicComponent>("pawnCubic");

        if (cubics) render.player.removeComponent(cubics);
        for (const pickup of this.pickups.values()) render.removePickup(pickup);
        this.pickups.clear();
        this.inventory.clear();
        this.shortcuts.clear();
        this.autoSoulShots.clear();
        this.ui.clearShortCuts();
        this.ui.setInventory([]);
        this.skills.clear();
        this.ui.setSkills([]);
        this.questStates.clear();
        this.hennaStatus = null;
        this.macroRevision = -1;
        this.macros.clear();
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
        this.clanMembers.clear();
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
        this.petInfo = null;
        this.isMounted = false;
        this.ui.setMountable(false);
        this.petInventory.clear();
        this.petRemainTime = null;
        this.abnormalStatuses.clear();
        this.shortBuff = null;
        this.boardHtml = "";
        this.allyInvite = null;
        this.pledgePower = 0;
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
        this.userId = 0;
    }

    protected onPacket(opcode: GameServerPacket_T, packet: PacketReader) {
        switch (opcode) {
            case GameServerPacket_T.KeyPacket: this.game.authLogin(this.account, this.sessionKey); break;
            case GameServerPacket_T.AuthLoginFail: this.ui.showMessage(`Game server refused the session (reason ${packet.d()}).`); break;
            case GameServerPacket_T.CharSelectInfo:
                this.login.close();
                this.characters = readCharSelectInfo(packet);
                void this.showLobby();
                break;
            case GameServerPacket_T.CharTemplates:
                this.templates = readCharTemplates(packet);
                this.ui.showCreateCharacter(this.templates);
                this.lobby.showCreate();
                break;
            case GameServerPacket_T.CharCreateOk: this.onCharCreateOk(packet); break;
            case GameServerPacket_T.CharCreateFail: this.ui.showMessage(["Character creation failed.", "Too many characters on this account.", "Name already exists.", "Name is invalid (up to 16 English letters or digits)."][packet.d()] || "Character creation failed."); break;
            case GameServerPacket_T.CharDeleteOk: this.onCharDeleteOk(packet); break;
            case GameServerPacket_T.CharDeleteFail: this.ui.showMessage(["", "Character deletion failed.", "Clan members cannot be deleted.", "Clan leaders cannot be deleted."][packet.d()] || "Character deletion failed."); break;
            case GameServerPacket_T.ActionFailed: this.onActionFailed(); break;
            case GameServerPacket_T.CharSelected: this.onCharSelected(packet); break;
            case GameServerPacket_T.UserInfo: this.onUserInfo(packet); break;
            case GameServerPacket_T.ItemList: this.onItemList(packet); break;
            case GameServerPacket_T.InventoryUpdate: this.onInventoryUpdate(packet); break;
            case GameServerPacket_T.TradeStart: this.onTradeStart(packet); break;
            case GameServerPacket_T.TradeOwnAdd: this.onTradeOwnAdd(packet); break;
            case GameServerPacket_T.TradeOtherAdd: this.onTradeOtherAdd(packet); break;
            case GameServerPacket_T.SendTradeDone: this.onSendTradeDone(packet); break;
            case GameServerPacket_T.SendTradeRequest: this.onSendTradeRequest(packet); break;
            case GameServerPacket_T.TradeUpdate: this.onTradeUpdate(packet); break;
            case GameServerPacket_T.SkillList: this.onSkillList(packet); break;
            case GameServerPacket_T.SkillCoolTime: this.onSkillCoolTime(packet); break;
            case GameServerPacket_T.QuestList: this.onQuestList(packet); break;
            case GameServerPacket_T.HennaInfo: this.onHennaInfo(packet); break;
            case GameServerPacket_T.SendMacroList: this.onSendMacroList(packet); break;
            case GameServerPacket_T.EtcStatusUpdate: this.onEtcStatusUpdate(packet); break;
            case GameServerPacket_T.SignsSky: this.onSignsSky(packet); break;
            case GameServerPacket_T.FriendList: this.onFriendList(packet); break;
            case GameServerPacket_T.FriendRecvMsg: this.onFriendRecvMsg(packet); break;
            case GameServerPacket_T.MagicEffectIcons: this.onMagicEffectIcons(packet); break;
            case GameServerPacket_T.ShortBuffStatusUpdate: this.onShortBuffStatusUpdate(packet); break;
            case GameServerPacket_T.CharInfo: this.onCharInfo(packet); break;
            case GameServerPacket_T.NpcInfo: this.onNpcInfo(packet); break;
            case GameServerPacket_T.PetInfo: this.onPetInfo(packet); break;
            case GameServerPacket_T.PetItemList: this.onPetItemList(packet); break;
            case GameServerPacket_T.PetInventoryUpdate: this.onPetInventoryUpdate(packet); break;
            case GameServerPacket_T.PetStatusUpdate: this.onPetStatusUpdate(packet); break;
            case GameServerPacket_T.PetDelete: packet.d(); this.removeObject(packet.d()); break;
            case GameServerPacket_T.SpawnItem: void this.onSpawnItem(packet, false); break;
            case GameServerPacket_T.DropItem: void this.onSpawnItem(packet, true); break;
            case GameServerPacket_T.GetItem: this.onGetItem(packet); break;
            case GameServerPacket_T.DeleteObject: this.removeObject(packet.d()); break;
            case GameServerPacket_T.CharMoveToLocation: this.onMoveToLocation(packet); break;
            case GameServerPacket_T.MoveToPawn: this.onMoveToPawn(packet); break;
            case GameServerPacket_T.StopMove: this.onStopMove(packet); break;
            case GameServerPacket_T.ValidateLocation: this.onValidateLocation(packet); break;
            case GameServerPacket_T.BeginRotation: this.onBeginRotation(packet); break;
            case GameServerPacket_T.StopRotation: this.onStopRotation(packet); break;
            case GameServerPacket_T.TeleportToLocation: this.onTeleport(packet); break;
            case GameServerPacket_T.Attack: this.onAttack(packet); break;
            case GameServerPacket_T.MagicSkillUse: this.onMagicSkillUse(packet); break;
            case GameServerPacket_T.MagicSkillCanceld: this.stopSkill(packet.d()); break;
            case GameServerPacket_T.MagicSkillLaunched: this.onMagicSkillLaunched(packet); break;
            case GameServerPacket_T.Die: this.onDie(packet); break;
            case GameServerPacket_T.Revive: this.onRevive(packet.d()); break;
            case GameServerPacket_T.Earthquake: void this.onEarthquake(packet); break;
            case GameServerPacket_T.ChangeMoveType: this.onChangeMoveType(packet.d(), packet.d() !== 0); break;
            case GameServerPacket_T.ChangeWaitType: this.onChangeWaitType(packet); break;
            case GameServerPacket_T.ChairSit: this.onChairSit(packet); break;
            case GameServerPacket_T.AutoAttackStart: this.onCombatState(packet.d(), true); break;
            case GameServerPacket_T.AutoAttackStop: this.onCombatState(packet.d(), false); break;
            case GameServerPacket_T.SocialAction: this.onSocialAction(packet.d(), packet.d()); break;
            case GameServerPacket_T.MyTargetSelected: this.setTarget(packet.d(), (packet.h() << 16) >> 16); break;
            case GameServerPacket_T.PartyMemberPosition: this.onPartyMemberPosition(packet); break;
            case GameServerPacket_T.TargetSelected: this.onTargetSelected(packet, true); break;
            case GameServerPacket_T.TargetUnselected: this.onTargetSelected(packet, false); break;
            case GameServerPacket_T.StatusUpdate: this.onStatusUpdate(packet); break;
            case GameServerPacket_T.CreatureSay: this.onCreatureSay(packet); break;
            case GameServerPacket_T.EquipUpdate: this.onEquipUpdate(packet); break;
            case GameServerPacket_T.DoorInfo: this.onDoorInfo(packet); break;
            case GameServerPacket_T.DoorStatusUpdate: this.onDoorStatusUpdate(packet); break;
            case GameServerPacket_T.PartySmallWindowAll: this.onPartySmallWindowAll(packet); break;
            case GameServerPacket_T.PartySmallWindowAdd: this.onPartySmallWindowAdd(packet); break;
            case GameServerPacket_T.PartySmallWindowDeleteAll: this.onPartySmallWindowDeleteAll(packet); break;
            case GameServerPacket_T.PartySmallWindowDelete: this.onPartySmallWindowDelete(packet); break;
            case GameServerPacket_T.PartySmallWindowUpdate: this.onPartySmallWindowUpdate(packet); break;
            case GameServerPacket_T.AskJoinPledge: this.onAskJoinPledge(packet); break;
            case GameServerPacket_T.JoinPledge: this.onJoinPledge(packet); break;
            case GameServerPacket_T.AskJoinParty: this.onAskJoinParty(packet); break;
            case GameServerPacket_T.JoinParty: this.onJoinParty(packet); break;
            case GameServerPacket_T.AskJoinFriend: this.onAskJoinFriend(packet); break;
            case GameServerPacket_T.PledgeShowMemberListAll: this.onPledgeShowMemberListAll(packet); break;
            case GameServerPacket_T.PledgeShowMemberListUpdate: this.onPledgeShowMemberListUpdate(packet); break;
            case GameServerPacket_T.PledgeShowMemberListAdd: this.onPledgeShowMemberListAdd(packet); break;
            case GameServerPacket_T.PledgeShowMemberListDelete: this.onPledgeShowMemberListDelete(packet); break;
            case GameServerPacket_T.PledgeShowMemberListDeleteAll: this.onPledgeShowMemberListDeleteAll(packet); break;
            case GameServerPacket_T.PledgeInfo: this.onPledgeInfo(packet); break;
            case GameServerPacket_T.ServerObjectInfo: this.onServerObjectInfo(packet); break;
            case GameServerPacket_T.PledgeShowInfoUpdate: this.onPledgeShowInfoUpdate(packet); break;
            case GameServerPacket_T.AquireSkillList: this.onAquireSkillList(packet); break;
            case GameServerPacket_T.AquireSkillInfo: this.onAquireSkillInfo(packet); break;
            case GameServerPacket_T.AquireSkillDone: this.onAquireSkillDone(packet); break;
            case GameServerPacket_T.NpcSay: this.onNpcSay(packet); break;
            case GameServerPacket_T.PetStatusShow: this.onPetStatusShow(packet); break;
            case GameServerPacket_T.SetSummonRemainTime: this.onSetSummonRemainTime(packet); break;
            case GameServerPacket_T.SellList: this.onSellList(packet); break;
            case GameServerPacket_T.BuyList: this.onBuyList(packet); break;
            case GameServerPacket_T.PlaySound: void this.onPlaySound(packet); break;
            case GameServerPacket_T.StaticObject: this.onStaticObject(packet); break;
            case GameServerPacket_T.ShowMiniMap: this.ui.showMap(packet.d()); break;
            case GameServerPacket_T.TutorialShowHtml: this.ui.showHtml(packet.S()); break;
            case GameServerPacket_T.TutorialCloseHtml: this.ui.hideHtml(); break;
            case GameServerPacket_T.NicknameChanged: this.onNicknameChanged(packet); break;
            case GameServerPacket_T.PledgeStatusChanged: this.onPledgeStatusChanged(packet); break;
            case GameServerPacket_T.RelationChanged: this.onRelationChanged(packet); break;
            case GameServerPacket_T.SetupGauge: this.ui.setupGauge(packet.d(), packet.d(), packet.d()); break;
            case GameServerPacket_T.ShowBoard: this.onShowBoard(packet); break;
            case GameServerPacket_T.ChooseInventoryItem: this.onChooseInventoryItem(packet); break;
            case GameServerPacket_T.EnchantResult: this.onEnchantResult(packet); break;
            case GameServerPacket_T.SystemMessage: this.onSystemMessage(packet); break;
            case GameServerPacket_T.ConfirmDlg: this.onConfirmDlg(packet); break;
            case GameServerPacket_T.NpcHtmlMessage: packet.d(); this.ui.showHtml(packet.S()); break;
            case GameServerPacket_T.ShortCutInit:
                this.shortcuts.clear();
                this.ui.clearShortCuts();

                for (let i = 0, count = packet.d(); i < count; i++) this.setShortCut(readShortCut(packet));
                break;
            case GameServerPacket_T.ShortCutRegister: this.setShortCut(readShortCut(packet)); break;
            case GameServerPacket_T.ManagePledgePower: this.onManagePledgePower(packet); break;
            case GameServerPacket_T.StartPledgeWar: this.pledgeWarStart = readPledgeWar(packet, true); break;
            case GameServerPacket_T.StopPledgeWar: this.pledgeWarStop = readPledgeWar(packet, false); break;
            case GameServerPacket_T.SurrenderPledgeWar: this.pledgeWarSurrender = readPledgeWar(packet, false); break;
            case GameServerPacket_T.PledgeCrest: this.onPledgeCrest(packet); break;
            case GameServerPacket_T.AskJoinAlly: this.onAskJoinAlly(packet); break;
            case GameServerPacket_T.AllyCrest: this.onAllyCrest(packet); break;
            case GameServerPacket_T.WareHouseDepositList: this.warehouseDeposit = readWarehouseList(packet); break;
            case GameServerPacket_T.WareHouseWithdrawalList: this.warehouseWithdraw = readWarehouseList(packet); break;
            case GameServerPacket_T.PrivateStoreManageListSell: this.onPrivateStoreManageListSell(packet); break;
            case GameServerPacket_T.PrivateStoreListSell: this.privateStoreSell = readPrivateStoreListSell(packet); break;
            case GameServerPacket_T.PrivateStoreMsgSell: this.onPrivateStoreMsg(packet, this.privateStoreSellMsgs); break;
            case GameServerPacket_T.PrivateStoreManageListBuy: this.onPrivateStoreManageListBuy(packet); break;
            case GameServerPacket_T.PrivateStoreListBuy: this.privateStoreBuy = readPrivateStoreListBuy(packet); break;
            case GameServerPacket_T.PrivateStoreMsgBuy: this.onPrivateStoreMsg(packet, this.privateStoreBuyMsgs); break;
            case GameServerPacket_T.PackageToList: this.onPackageToList(packet); break;
            case GameServerPacket_T.PackageSendableList: this.packageSendable = readPackageSendableList(packet); break;
            case GameServerPacket_T.MultiSellList: this.onMultiSellList(packet); break;
            case GameServerPacket_T.ShopPreviewList: this.shopPreview = readShopPreviewList(packet); break;
            case GameServerPacket_T.ShopPreviewInfo: this.shopPreviewItems = readShopPreviewInfo(packet); break;
            case GameServerPacket_T.BuyListSeed: this.seedShop = readBuyListSeed(packet); break;
            case GameServerPacket_T.SellListProcure: this.cropProcure = readSellListProcure(packet); break;
            case GameServerPacket_T.VehicleInfo: this.onVehicleLocation(packet, true); break;
            case GameServerPacket_T.OnVehicleCheckLocation: this.onVehicleLocation(packet, false); break;
            case GameServerPacket_T.VehicleDeparture: this.onVehicleDeparture(packet); break;
            case GameServerPacket_T.VehicleStarted: this.onVehicleStarted(packet); break;
            case GameServerPacket_T.GetOnVehicle: this.onGetOnVehicle(packet); break;
            case GameServerPacket_T.GetOffVehicle: this.onGetOffVehicle(packet); break;
            case GameServerPacket_T.MoveToLocationInVehicle: this.onMoveToLocationInVehicle(packet); break;
            case GameServerPacket_T.StopMoveInVehicle:
            case GameServerPacket_T.ValidateLocationInVehicle: this.onStopMoveInVehicle(packet); break;
            case GameServerPacket_T.Ride: this.onRide(packet); break;
            case GameServerPacket_T.FlyToLocation: this.onFlyToLocation(packet); break;
            case GameServerPacket_T.SpecialCamera: this.specialCamera = readSpecialCamera(packet); break;
            case GameServerPacket_T.NormalCamera: this.specialCamera = null; break; // OnNormalCamera 0x7473c0 -> ReleaseSpecialViewTarget.
            case GameServerPacket_T.CameraMode: this.cameraMode = packet.d(); break;
            case GameServerPacket_T.ObservationMode: this.onObservationMode(packet); break;
            case GameServerPacket_T.ObservationReturn: this.onObservationReturn(packet); break;
            case GameServerPacket_T.RadarControl: this.onRadarControl(packet); break;
            case GameServerPacket_T.ShowTownMap: this.townMap = readTownMap(packet); break;
            case GameServerPacket_T.ShowCalculator: this.calculatorId = packet.d(); break;
            case GameServerPacket_T.ShowXMasSeal: this.xmasSealItemId = packet.d(); break;
            case GameServerPacket_T.Dice: this.dice = readDice(packet); break;
            case GameServerPacket_T.MonRaceInfo: this.monRace = readMonRaceInfo(packet); break;
            case GameServerPacket_T.SSQStatus: this.onSSQStatus(packet); break;
            case GameServerPacket_T.ClanHallDecoration: this.clanHallDecoration = readClanHallDecoration(packet); break;
            case GameServerPacket_T.SiegeInfo: this.siegeInfo = readSiegeInfo(packet); break;
            case GameServerPacket_T.SiegeAttackerList: this.siegeAttackers = readSiegeClanList(packet, false); break;
            case GameServerPacket_T.SiegeDefenderList: this.siegeDefenders = readSiegeClanList(packet, true); break;
            case GameServerPacket_T.GameGuardQuery: this.onGameGuardQuery(packet); break;
            case GameServerPacket_T.RecipeBookItemList: this.recipeBook = readRecipeBookItemList(packet); break;
            case GameServerPacket_T.RecipeItemMakeInfo: this.recipeItemMakeInfo = readRecipeItemMakeInfo(packet); break;
            case GameServerPacket_T.RecipeShopManageList: this.recipeShopManageList = readRecipeShopManageList(packet); break;
            case GameServerPacket_T.RecipeShopSellList: this.recipeShopSellList = readRecipeShopSellList(packet); break;
            case GameServerPacket_T.RecipeShopItemInfo: this.recipeShopItemInfo = readRecipeShopItemInfo(packet); break;
            case GameServerPacket_T.RecipeShopMsg: this.onRecipeShopMsg(packet); break;
            case GameServerPacket_T.HennaEquipList: this.hennaEquipList = readHennaEquipList(packet); break;
            case GameServerPacket_T.HennaItemInfo: this.hennaItemInfo = readHennaItemInfo(packet); break;
            case GameServerPacket_T.PartyMatchList: this.partyMatchRooms = readPartyMatchList(packet); break;
            case GameServerPacket_T.PartyMatchDetail: this.partyMatchDetail = readPartyMatchDetail(packet); break;
            case GameServerPacket_T.PartySpelled: this.onPartySpelled(packet); break;
            case GameServerPacket_T.TutorialShowQuestionMark: this.tutorialQuestionMarks.add(packet.d()); break;
            case GameServerPacket_T.TutorialEnableClientEvent: this.tutorialClientEvents = packet.d(); break;
            case GameServerPacket_T.GMViewCharacterInfo: this.gmCharacterInfo = readGMViewCharacterInfo(packet); break;
            case GameServerPacket_T.GMViewPledgeInfo: this.gmPledgeInfo = readGMViewPledgeInfo(packet); break;
            case GameServerPacket_T.GMViewSkillInfo: this.gmSkillInfo = readGMViewSkillInfo(packet); break;
            case GameServerPacket_T.GMViewQuestList: this.gmQuestList = readGMViewQuestList(packet); break;
            case GameServerPacket_T.GMViewItemList: this.gmItemList = readGMViewItemList(packet); break;
            case GameServerPacket_T.GMViewWarehouseWithdrawList: this.gmWarehouseList = readGMViewWarehouseWithdrawList(packet); break;
            case GameServerPacket_T.GMViewHennaInfo: this.gmHennaStatus = readGMViewHennaInfo(packet); break;
            case GameServerPacket_T.Snoop: this.onSnoop(packet); break;
            case GameServerPacket_T.Extended:
                switch (packet.h()) {
                    case GameServerExPacket_T.ExAutoSoulShot: this.onAutoSoulShot(packet); break;
                    case GameServerExPacket_T.ExStorageMaxCount: this.onStorageMaxCount(packet); break;
                    case GameServerExPacket_T.ExPledgeCrestLarge: this.onPledgeCrestLarge(packet); break;
                    case GameServerExPacket_T.ExEventMatchMessage: this.onEventMatchMessage(packet); break;
                    case GameServerExPacket_T.ExPartyRoomMember: this.onPartyRoomMember(packet); break;
                    case GameServerExPacket_T.ExClosePartyRoom: this.onClosePartyRoom(packet); break;
                    case GameServerExPacket_T.ExManagePartyRoomMember: this.onManagePartyRoomMember(packet); break;
                    case GameServerExPacket_T.ExFishingStart: this.onFishingStart(packet); break;
                    case GameServerExPacket_T.ExFishingEnd: this.onFishingEnd(packet); break;
                    case GameServerExPacket_T.ExFishingStartCombat: this.onFishingStartCombat(packet); break;
                    case GameServerExPacket_T.ExFishingHpRegen: this.onFishingHpRegen(packet); break;
                    case GameServerExPacket_T.ExEnchantSkillList: this.enchantSkills = readEnchantSkillList(packet); break;
                    case GameServerExPacket_T.ExEnchantSkillInfo: this.enchantSkillInfo = readEnchantSkillInfo(packet); break;
                    case GameServerExPacket_T.ExQuestInfo: if (packet.getRemaining()) throw new Error("Invalid ExQuestInfo payload."); break;
                    case GameServerExPacket_T.ExShowQuestMark: this.onShowQuestMark(packet); break;
                    case GameServerExPacket_T.ExSendManorList: this.manors = readManorList(packet); break;
                    case GameServerExPacket_T.ExShowSeedInfo: this.manorSeedInfo = readShowSeedInfo(packet); break;
                    case GameServerExPacket_T.ExShowCropInfo: this.manorCropInfo = readShowCropInfo(packet); break;
                    case GameServerExPacket_T.ExShowManorDefaultInfo: this.manorDefaultCrops = readShowManorDefaultInfo(packet); break;
                    case GameServerExPacket_T.ExShowSeedSetting: this.manorSeedSettings = readShowSeedSetting(packet); break;
                    case GameServerExPacket_T.ExShowCropSetting: this.manorCropSettings = readShowCropSetting(packet); break;
                    case GameServerExPacket_T.ExShowSellCropList: this.manorSellCrops = readShowSellCropList(packet); break;
                    case GameServerExPacket_T.ExShowProcureCropDetail: this.manorProcureCropDetail = readShowProcureCropDetail(packet); break;
                    case GameServerExPacket_T.ExHeroList: this.heroes = readHeroList(packet); break;
                    case GameServerExPacket_T.ExOpenMPCC: this.onOpenMPCC(packet); break;
                    case GameServerExPacket_T.ExCloseMPCC: this.onCloseMPCC(packet); break;
                    case GameServerExPacket_T.ExAskJoinMPCC: this.onAskJoinMPCC(packet); break;
                    case GameServerExPacket_T.ExMultiPartyCommandChannelInfo: this.commandChannel = readCommandChannelInfo(packet); break;
                    case GameServerExPacket_T.ExOlympiadUserInfo: { const info = readOlympiadUserInfo(packet); this.olympiadUsers.set(info.objectId, info); break; }
                    case GameServerExPacket_T.ExOlympiadSpelledInfo: { const info = readOlympiadSpelledInfo(packet); this.olympiadEffects.set(info.objectId, info.effects); break; }
                    case GameServerExPacket_T.ExOlympiadMode: this.onOlympiadMode(packet); break;
                    case GameServerExPacket_T.ExOlympiadMatchEnd: this.onOlympiadMatchEnd(packet); break;
                    case GameServerExPacket_T.ExMailArrived: this.onMailArrived(packet); break;
                }
                break;
            case GameServerPacket_T.SunRise: this.manGame.getComponent("render").getEnvironment().setTimeOfDay(6); break;
            case GameServerPacket_T.SunSet: this.manGame.getComponent("render").getEnvironment().setTimeOfDay(18); break;
            case GameServerPacket_T.RestartResponse: this.leaveWorld(); break;
            case GameServerPacket_T.LeaveWorld:
            case GameServerPacket_T.ServerClose:
                this.game.close();
                void this.onDisconnected(opcode === GameServerPacket_T.LeaveWorld ? "Logged out." : "Server closed the session.");
                break;
        }
    }

    protected getMeshType(appearance: Appearance_T): number { // User::GetMeshType 0x736020, stored as Pawn.CharClassID.
        const { race, classId } = appearance, sex = appearance.sex !== 0 ? 1 : 0;

        switch (race) {
            case Race_T.HUMAN:
                if (classId <= 9 || classId >= 88 && classId <= 93) return sex;
                if (classId <= 17 || classId >= 94 && classId <= 98) return 8 + sex;
                return 5;
            case Race_T.ELF: return 6 + sex;
            case Race_T.DARK_ELF: return 2 + sex;
            case Race_T.ORC:
                if (classId >= 44 && classId <= 48 || classId >= 113 && classId <= 114) return 10 + sex;
                if (classId >= 49 && classId <= 52 || classId >= 115 && classId <= 116) return 12 + sex;
                return 5;
            case Race_T.DWARF: return 4 + sex;
            default: return 5;
        }
    }

    protected getCharacterIndex(appearance: Appearance_T): number {
        const isMystic = MYSTIC_BODY_CLASS_IDS.has(appearance.classId);
        let body: string;

        switch (appearance.race) {
            case Race_T.HUMAN: body = isMystic ? "Magic" : "Fighter"; break;
            case Race_T.ELF: body = "Elf"; break;
            case Race_T.DARK_ELF: body = "DarkElf"; break;
            case Race_T.ORC: body = isMystic ? "Shaman" : "Orc"; break;
            case Race_T.DWARF: body = "Dwarf"; break;
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
        return { chest: paperdoll[Paperdoll_T.PAPERDOLL_CHEST], legs: paperdoll[Paperdoll_T.PAPERDOLL_LEGS], gloves: paperdoll[Paperdoll_T.PAPERDOLL_GLOVES], boots: paperdoll[Paperdoll_T.PAPERDOLL_FEET] };
    }

    protected getAppearanceKey(appearance: Appearance_T) {
        const paperdoll = appearance.paperdoll;

        return [appearance.race, appearance.sex, appearance.classId, appearance.face, appearance.hairStyle, appearance.hairColor, appearance.enchantLevel, paperdoll[Paperdoll_T.PAPERDOLL_CHEST], paperdoll[Paperdoll_T.PAPERDOLL_LEGS], paperdoll[Paperdoll_T.PAPERDOLL_GLOVES], paperdoll[Paperdoll_T.PAPERDOLL_FEET], paperdoll[Paperdoll_T.PAPERDOLL_RHAND], paperdoll[Paperdoll_T.PAPERDOLL_LHAND], paperdoll[Paperdoll_T.PAPERDOLL_LRHAND], paperdoll[Paperdoll_T.PAPERDOLL_HEAD], paperdoll[Paperdoll_T.PAPERDOLL_HAIR]].join(":");
    }

    protected loadAppearance(appearance: Appearance_T, actor: BaseActor): Promise<void> {
        const load = this.applyAppearance(appearance, actor);

        this.appearanceLoads.set(actor, load);

        return load;
    }

    protected async applyAppearance(appearance: Appearance_T, actor: BaseActor) {
        const asset = this.manGame.getComponent("asset");
        const paperdoll = appearance.paperdoll;
        const bodyKey = [appearance.race, appearance.sex, appearance.classId, appearance.face, appearance.hairStyle, appearance.hairColor, paperdoll[Paperdoll_T.PAPERDOLL_CHEST], paperdoll[Paperdoll_T.PAPERDOLL_LEGS], paperdoll[Paperdoll_T.PAPERDOLL_GLOVES], paperdoll[Paperdoll_T.PAPERDOLL_FEET], paperdoll[Paperdoll_T.PAPERDOLL_HEAD], paperdoll[Paperdoll_T.PAPERDOLL_HAIR]].join(":");
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

        const equipment = { enchantLevel: appearance.enchantLevel, rightHand: appearance.paperdoll[Paperdoll_T.PAPERDOLL_RHAND] || appearance.paperdoll[Paperdoll_T.PAPERDOLL_LRHAND], leftHand: appearance.paperdoll[Paperdoll_T.PAPERDOLL_LHAND], head: appearance.paperdoll[Paperdoll_T.PAPERDOLL_HEAD], hair: appearance.paperdoll[Paperdoll_T.PAPERDOLL_HAIR] };

        if (isEquipmentOnly) await asset.loadCharacterEquipment(this.manGame.getComponent("render"), actor, index, hairStyle, equipment);
        else {
            await asset.loadCharacter(this.manGame.getComponent("render"), index, Math.min(appearance.face, group.faceVariants - 1), hairStyle, colours.includes(appearance.hairColor) ? appearance.hairColor : colours[0], this.getArmor(appearance.paperdoll), actor, equipment);

            if (this.appearanceRequests.get(actor) === request) this.bodyKeys.set(actor, bodyKey);
        }

        const object = this.findObjectByActor(actor);

        if (object) {
            this.applySpeeds(actor, object.speeds, object.isRunning);
            this.setIdleAnimation(object);
            this.applyPartyMember(object);
        }

        if (!isEquipmentOnly && this.inWorld && actor === this.manGame.getComponent("render").player) void this.preloadSkills();
    }

    protected onCharSelected(packet: PacketReader) {
        const selected = readCharSelected(packet);
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

    protected async enterWorld(entry: CharSelectEntry_T) {
        const render = this.manGame.getComponent("render");

        await this.loadAppearance(entry, render.player);

        this.userAppearanceLoad = null;
        this.skillListLoad = new Promise(resolve => this.resolveSkillList = resolve);
        this.game.enterWorld();
        this.game.requestSkillList();
        this.game.requestSkillCoolTime();
    }

    protected createObject(objectId: number, kind: NetObjectKind_T, info: CreatureInfo_T): NetObject_T {
        const object: NetObject_T = { objectId, selectedId: 0, kind, actor: null, isRemoved: false, position: setVector(new Vector3(), info), destination: null, heading: info.heading, name: info.name, title: info.title, curHp: 0, maxHp: 0, curMp: 0, maxMp: 0, levelDifference: 0, karma: info.karma, pvpFlag: info.pvpFlag, recommendations: info.recommendations, nameColor: info.nameColor, isSummon: false, isDead: info.isAlikeDead, chairStaticObjectId: 0, cubics: (info as any).cubics || [], fishing: null, appearanceKey: null, speeds: info, isRunning: info.isRunning, isInCombat: info.isInCombat, waitType: (info as any).isSitting ? WaitType_T.WT_SITTING : WaitType_T.WT_STANDING, pendingAttack: null, pendingSkill: null };

        this.objects.set(objectId, object);

        return object;
    }

    protected applySpeeds(actor: BaseActor, speeds: Speeds_T, isRunning: boolean) {
        actor.setMovementSpeeds(speeds.runSpd * speeds.moveMultiplier, speeds.walkSpd * speeds.moveMultiplier, speeds.swimRunSpd * speeds.moveMultiplier);
        actor.setUnrealScriptProperty("AttackSpeedRate", speeds.attackSpeedMultiplier);
        actor.setCollisionSize(speeds.collisionRadius, speeds.collisionHeight);
        actor.setWalking(!isRunning);
    }

    protected onItemList(packet: PacketReader) {
        const showWindow = packet.h() !== 0;

        this.inventory.clear();

        for (let i = 0, count = packet.h(); i < count; i++) {
            const item = readInventoryItem(packet);

            this.inventory.set(item.objectId, item);
        }

        this.updateInventory(showWindow);
    }

    protected onInventoryUpdate(packet: PacketReader) {
        for (let i = 0, count = packet.h(); i < count; i++) {
            const change = packet.h();
            const item = readInventoryItem(packet);

            const previous = this.inventory.get(item.objectId);
            const sound = item.isEquipped && !(previous && previous.isEquipped) ? this.ui.getStrings().itemInfos[item.itemId].equipSound : "";

            if (sound && sound.toLowerCase() !== "none") void this.manGame.getComponent("audio").playInterfaceSound(sound); // UGameEngine::OnEquipItemPlaySound 0x74ee20: grp equip_sound, no 3D.

            switch (change) {
                case 1:
                case 2: this.inventory.set(item.objectId, item); break;
                case 3: this.inventory.delete(item.objectId); break;
                default: throw new Error(`Unknown inventory change '${change}'.`);
            }
        }

        this.updateInventory();
    }

    protected readShopItem(packet: PacketReader, hasPrice: boolean, allowZeroObject: boolean, allowZeroCount: boolean): ShopItem_T {
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
        const hasPrice = npcId === 0;

        if (money < 0 || npcId < 0 || count > Math.trunc(packet.getRemaining() / (hasPrice ? 32 : 28))) throw new Error(`Invalid SellList count '${count}'.`);

        const items: ShopItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readShopItem(packet, hasPrice, false, false));
        if (packet.getRemaining()) throw new Error("Invalid SellList trailing data.");

        this.shopSellMoney = money;
        this.shopSellNpcId = npcId;
        this.shopSellItems.length = 0;
        this.shopSellItems.push(...items);
    }

    protected onBuyList(packet: PacketReader) {
        const money = packet.d(), listId = packet.d(), count = packet.h();

        if (money < 0 || listId < 0 || count > Math.trunc(packet.getRemaining() / 32)) throw new Error(`Invalid BuyList count '${count}'.`);

        const items: ShopItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readShopItem(packet, true, true, true));
        if (packet.getRemaining()) throw new Error("Invalid BuyList trailing data.");

        this.shopBuyMoney = money;
        this.shopBuyListId = listId;
        this.shopBuyItems.length = 0;
        this.shopBuyItems.push(...items);
    }

    protected readTradeItem(packet: PacketReader, hasTradeType: boolean): TradeItem_T {
        const tradeType = hasTradeType ? packet.h() : 0;
        const type1 = packet.h(), objectId = packet.d(), itemId = packet.d(), count = packet.d(), type2 = packet.h();

        packet.h();

        const bodyPart = packet.d(), enchantLevel = packet.h();

        packet.h();

        const customType2 = packet.h();

        if (objectId <= 0 || itemId <= 0 || count <= 0 || hasTradeType && tradeType !== 2 && tradeType !== 3)
            throw new Error(`Invalid trade item '${itemId}'.`);

        return { tradeType, type1, objectId, itemId, count, type2, bodyPart, enchantLevel, customType2 };
    }

    protected readTradeItems(packet: PacketReader, count: number, hasTradeType: boolean): TradeItem_T[] {
        const size = hasTradeType ? 30 : 28;

        if (count < 0 || count > Math.trunc(packet.getRemaining() / size)) throw new Error(`Invalid trade item count '${count}'.`);

        const items: TradeItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readTradeItem(packet, hasTradeType));

        return items;
    }

    protected onTradeStart(packet: PacketReader) {
        const partnerId = packet.d(), count = packet.h(), items = this.readTradeItems(packet, count, false);

        if (partnerId <= 0 || packet.getRemaining()) throw new Error("Invalid TradeStart payload.");

        this.tradePartnerId = partnerId;
        this.tradeRequestId = 0;
        this.tradeOwnItems.length = 0;
        this.tradeOtherItems.length = 0;
        this.tradeAvailableItems.length = 0;
        this.tradeAvailableItems.push(...items);
        this.tradeDone = 0;
    }

    protected onTradeOwnAdd(packet: PacketReader) {
        const items = this.readTradeItems(packet, packet.h(), false);

        if (packet.getRemaining()) throw new Error("Invalid TradeOwnAdd trailing data.");

        this.tradeOwnItems.push(...items);
    }

    protected onTradeOtherAdd(packet: PacketReader) {
        const items = this.readTradeItems(packet, packet.h(), false);

        if (packet.getRemaining()) throw new Error("Invalid TradeOtherAdd trailing data.");

        this.tradeOtherItems.push(...items);
    }

    protected onTradeUpdate(packet: PacketReader) {
        const items = this.readTradeItems(packet, packet.h(), true);

        if (packet.getRemaining()) throw new Error("Invalid TradeUpdate trailing data.");

        this.tradeAvailableItems.length = 0;
        this.tradeAvailableItems.push(...items);
    }

    protected onSendTradeRequest(packet: PacketReader) {
        const senderId = packet.d();

        if (senderId <= 0 || packet.getRemaining()) throw new Error("Invalid SendTradeRequest payload.");

        this.tradeRequestId = senderId;
    }

    protected onSendTradeDone(packet: PacketReader) {
        const result = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid SendTradeDone payload.");

        this.tradeDone = result;
    }

    protected onEquipUpdate(packet: PacketReader) {
        const change = packet.d(), itemObjectId = packet.d(), bodyPart = packet.d();

        if (bodyPart <= 0 || bodyPart > 0xffff) throw new Error(`Invalid equipment body part '${bodyPart}'.`);

        const appearance = this.appearances.get(this.userId);

        if (!appearance) return;

        const item = this.inventory.get(itemObjectId);

        if (change !== 0 && !item) return;

        const slots: Paperdoll_T[] = [];
        for (let slot = 0; slot < 16; slot++)
            if (bodyPart & (1 << slot)) slots.push(slot as Paperdoll_T);

        const isHand = slots.includes(Paperdoll_T.PAPERDOLL_RHAND) || slots.includes(Paperdoll_T.PAPERDOLL_LRHAND);

        if (isHand) {
            slots.length = 0;
            slots.push(Paperdoll_T.PAPERDOLL_RHAND, Paperdoll_T.PAPERDOLL_LRHAND);
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

        const mover = this.doors.get(objectId) || this.manGame.getComponent("render").findMovableByRealId(doorId);
        if (!mover) return;

        this.doors.set(objectId, mover);
        mover.setPosition(isOpen === 0 ? 1 : 0);
    }

    protected updateInventory(showWindow: boolean = false) {
        this.ui.setInventory([...this.inventory.values()], showWindow);

        for (const shortcut of this.shortcuts.values())
            if (shortcut.type === ShortCutType_T.TYPE_ITEM) this.setShortCut(shortcut);
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

        const skills: AquireSkillEntry_T[] = [];
        for (let i = 0; i < count; i++) skills.push({ id: packet.d(), nextLevel: packet.d(), maxLevel: packet.d(), spCost: packet.d(), requirements: packet.d() });
        if (packet.getRemaining()) throw new Error("Invalid AquireSkillList trailing data.");

        this.aquireSkillFishing = fishing !== 0;
        this.aquireSkills = skills;
    }

    protected onAquireSkillInfo(packet: PacketReader) {
        const id = packet.d(), level = packet.d(), spCost = packet.d(), mode = packet.d(), count = packet.d();

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 16)) throw new Error(`Invalid AquireSkillInfo payload (count ${count}).`);

        const requirements: AquireSkillRequirement_T[] = [];
        for (let i = 0; i < count; i++) requirements.push({ type: packet.d(), itemId: packet.d(), count: packet.d(), unknown: packet.d() });
        if (packet.getRemaining()) throw new Error("Invalid AquireSkillInfo trailing data.");

        this.aquireSkillInfo = { id, level, spCost, mode, requirements };
    }

    protected onAquireSkillDone(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid AquireSkillDone payload.");

        this.aquireSkills = [];
        this.aquireSkillInfo = null;
    }

    protected onQuestList(packet: PacketReader) {
        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 8)) throw new Error(`Invalid QuestList count ${count}.`);

        this.questStates.clear();
        for (let i = 0; i < count; i++) {
            const id = packet.d(), condition = packet.d();

            this.questStates.set(id, { id, condition });
        }
    }

    protected onHennaInfo(packet: PacketReader) {
        const stats: number[] = [];

        for (let i = 0; i < 6; i++) stats.push(packet.c());

        const slots = packet.d(), count = packet.d();

        if (slots < 0 || count < 0 || count > Math.trunc(packet.getRemaining() / 8)) throw new Error(`Invalid HennaInfo count ${count}.`);

        const symbols = [];
        for (let i = 0; i < count; i++) symbols.push({ symbolId: packet.d(), itemId: packet.d() });

        this.hennaStatus = { stats, slots, symbols };
    }

    protected onSendMacroList(packet: PacketReader) {
        const revision = packet.d();

        packet.c();

        packet.c();

        const hasMacro = packet.c();

        if (hasMacro > 1) throw new Error(`Invalid SendMacroList macro flag ${hasMacro}.`);
        const isNewRevision = revision !== this.macroRevision;

        if (!hasMacro) {
            if (isNewRevision) this.macros.clear();
            this.macroRevision = revision;
            return;
        }

        const id = packet.d(), name = packet.S(), description = packet.S(), acronym = packet.S(), icon = packet.c(), commandCount = packet.c();

        if (commandCount > Math.trunc(packet.getRemaining() / 9)) throw new Error(`Invalid SendMacroList command count ${commandCount}.`);

        const commands = [];
        for (let i = 0; i < commandCount; i++) commands.push({ index: packet.c(), type: packet.c(), data1: packet.d(), data2: packet.c(), command: packet.S() });

        if (isNewRevision) this.macros.clear();
        this.macroRevision = revision;
        this.macros.set(id, { id, name, description, acronym, icon, commands });
    }

    protected onEtcStatusUpdate(packet: PacketReader) {
        // FL2NetNotify::OnReceiveEtcStatus is a retail nullsub.
        this.etcStatus = { charges: packet.d(), weightPenalty: packet.d(), messageRefusal: packet.d(), dangerArea: packet.d(), expertisePenalty: packet.d() };
    }

    protected onSignsSky(packet: PacketReader) {
        const remaining = packet.getRemaining();

        if (remaining !== 0 && remaining !== 2) throw new Error(`Invalid SignsSky payload size ${remaining}.`);

        this.signsSky = remaining === 2 ? packet.h() : 0;
    }

    protected onShowBoard(packet: PacketReader) {
        const part = readShowBoard(packet);

        if (!part.show) {
            this.boardHtml = "";
            this.ui.hideHtml();
            return;
        }

        if (part.id === "101") this.boardHtml = part.html;
        else if (part.id === "102" || part.id === "103") this.boardHtml += part.html;
        else if (part.id === "1001") this.boardHtml = part.html;
        else return;

        this.ui.showHtml(this.boardHtml);
    }

    protected readPartyMember(packet: PacketReader, hasUnknown: boolean): PartyMember_T {
        const member = { objectId: packet.d(), name: packet.S(), curCp: packet.d(), maxCp: packet.d(), curHp: packet.d(), maxHp: packet.d(), curMp: packet.d(), maxMp: packet.d(), level: packet.d(), classId: packet.d() };

        if (hasUnknown) packet.skip(2 * 4);

        return member;
    }

    protected applyPartyMember(member: PartyMember_T) {
        const object = this.objects.get(member.objectId);

        if (!object) return;

        object.name = member.name;
        object.curHp = member.curHp;
        object.maxHp = member.maxHp;
        object.curMp = member.curMp;
        object.maxMp = member.maxMp;
        if (object.objectId === this.targetId) this.updateTarget();
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

        const invite: PledgeInvite_T = { requestorId, pledgeName };
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

        if (!name || itemDistribution < 0 || packet.getRemaining()) throw new Error("Invalid AskJoinParty payload.");

        const invite: PartyInvite_T = { name, itemDistribution };
        this.partyInvite = invite;
        this.ui.showPartyInvite(name, isAccepted => {
            if (this.partyInvite !== invite) return;

            this.partyInvite = null;
            this.game.answerJoinParty(isAccepted);
        });
    }

    protected onJoinParty(packet: PacketReader) {
        const response = packet.d();

        if (response !== 0 && response !== 1 || packet.getRemaining()) throw new Error("Invalid JoinParty payload.");

        this.partyJoinResult = response;
    }

    protected onAskJoinFriend(packet: PacketReader) {
        const name = packet.S(), unknown = packet.d();

        if (!name || unknown !== 0 || packet.getRemaining()) throw new Error("Invalid AskJoinFriend payload.");

        const invite: FriendInvite_T = { name };
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

    protected readClanMember(packet: PacketReader): ClanMember_T {
        const name = packet.S(), level = packet.d(), classId = packet.d();

        packet.d();
        packet.d();

        const objectId = packet.d();

        return { name, level, classId, objectId, isOnline: objectId !== 0 };
    }

    protected readClanMemberUpdate(packet: PacketReader): ClanMember_T {
        const member = { name: packet.S(), level: packet.d(), classId: packet.d(), objectId: 0, isOnline: false };

        packet.d();
        packet.d();
        member.objectId = packet.d();
        member.isOnline = member.objectId !== 0;

        return member;
    }

    protected onPledgeInfo(packet: PacketReader) {
        const clanId = packet.d(), name = packet.S(), allyName = packet.S();

        if (!name) throw new Error("Invalid PledgeInfo clan name.");
        if (packet.getRemaining()) throw new Error("Invalid PledgeInfo trailing data.");

        if (this.clanInfo) {
            this.clanInfo.clanId = clanId;
            this.clanInfo.name = name;
            this.clanInfo.allyName = allyName;
        } else this.clanInfo = { leaderId: 0, clanId, name, leaderName: "", crestId: 0, level: 0, hasCastle: 0, hasHideout: 0, memberLevel: 0, dissolving: 0, allyId: 0, allyName, allyCrestId: 0, isAtWar: false };
    }

    protected onPledgeStatusChanged(packet: PacketReader) {
        const leaderId = packet.d(), clanId = packet.d(), crestId = packet.d(), allyId = packet.d(), allyCrestId = packet.d();

        if (leaderId < 0 || clanId < 0 || crestId < 0 || allyId < 0 || allyCrestId < 0 || packet.getRemaining()) throw new Error("Invalid PledgeStatusChanged payload.");

        if (!this.clanInfo) this.clanInfo = { leaderId, clanId, name: "", leaderName: "", crestId, level: 0, hasCastle: 0, hasHideout: 0, memberLevel: 0, dissolving: 0, allyId, allyName: "", allyCrestId, isAtWar: false };
        else {
            this.clanInfo.leaderId = leaderId;
            this.clanInfo.clanId = clanId;
            this.clanInfo.crestId = crestId;
            this.clanInfo.allyId = allyId;
            this.clanInfo.allyCrestId = allyCrestId;
        }
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
    }

    protected onPledgeShowMemberListAll(packet: PacketReader) {
        const clanId = packet.d(), name = packet.S(), leaderName = packet.S(), crestId = packet.d(), level = packet.d(), hasCastle = packet.d(), hasHideout = packet.d();

        packet.d();

        const memberLevel = packet.d(), dissolving = packet.d();

        packet.d();

        const allyId = packet.d(), allyName = packet.S(), allyCrestId = packet.d(), isAtWar = packet.d() !== 0, count = packet.d();

        if (!name || count < 0 || count > 1000) throw new Error(`Invalid PledgeShowMemberListAll payload (count ${count}).`);

        const members = [];
        for (let i = 0; i < count; i++) members.push(this.readClanMember(packet));
        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListAll trailing data.");

        this.clanInfo = { leaderId: 0, clanId, name, leaderName, crestId, level, hasCastle, hasHideout, memberLevel, dissolving, allyId, allyName, allyCrestId, isAtWar };
        this.clanMembers.clear();
        for (const member of members) this.clanMembers.set(member.name, member);
    }

    protected onPledgeShowMemberListUpdate(packet: PacketReader) {
        const member = this.readClanMemberUpdate(packet);

        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListUpdate trailing data.");
        this.setClanMember(member);
    }

    protected onPledgeShowMemberListAdd(packet: PacketReader) {
        const member = this.readClanMemberUpdate(packet);

        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListAdd trailing data.");
        this.setClanMember(member);
    }

    protected setClanMember(member: ClanMember_T) {
        if (!member.name) throw new Error("Invalid clan member name.");
        this.clanMembers.set(member.name, member);
    }

    protected onPledgeShowMemberListDelete(packet: PacketReader) {
        const name = packet.S();

        if (!name || packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListDelete payload.");
        this.clanMembers.delete(name);
    }

    protected onPledgeShowMemberListDeleteAll(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListDeleteAll payload.");

        this.clanMembers.clear();
        this.clanInfo = null;
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

        this.ui.addChat(sender, message, Say2_T.TELL);
    }

    protected onMagicEffectIcons(packet: PacketReader) {
        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 10)) throw new Error(`Invalid MagicEffectIcons count ${count}.`);

        this.abnormalStatuses.clear();
        for (let i = 0; i < count; i++) {
            const effect = { id: packet.d(), level: packet.h(), duration: packet.d() };

            this.abnormalStatuses.set(`${effect.id}:${effect.level}`, effect);
        }

        this.updateAbnormalStatus();
    }

    protected onShortBuffStatusUpdate(packet: PacketReader) {
        const id = packet.d(), level = packet.d(), duration = packet.d();

        this.shortBuff = id || level || duration ? { id, level, duration } : null;

        this.updateAbnormalStatus();
    }

    protected updateAbnormalStatus() {
        const effects = [...this.abnormalStatuses.values()];

        if (this.shortBuff) effects.push(this.shortBuff);
        this.ui.setAbnormalStatus(effects);
    }

    protected onSkillCoolTime(packet: PacketReader) {
        const count = packet.d();

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 16)) throw new Error(`Invalid SkillCoolTime count ${count}.`);

        for (let i = 0; i < count; i++) this.ui.setSkillCoolTime(packet.d(), packet.d(), packet.d(), packet.d());
    }

    public requestSkillList() { if (this.inWorld) this.game.requestSkillList(); }
    public useSkill(id: number) {
        const skill = this.skills.get(id);

        if (this.inWorld && skill && !skill.isPassive) this.game.requestMagicSkillUse(id, false, false);
    }
    public useAction(id: number) { if (this.inWorld) this.game.requestActionUse(id, false, false); }
    public requestRestart() { if (this.inWorld) this.game.requestRestart(); }
    public logout() { if (this.inWorld) this.game.logout(); }

    public requestItemList() { if (this.inWorld) this.game.requestItemList(); }
    public useItem(objectId: number) { if (this.inWorld && this.inventory.has(objectId)) this.game.useItem(objectId); }
    public chooseInventoryItem(objectId: number) { if (this.inWorld && this.inventory.has(objectId)) this.game.requestEnchantItem(objectId); }

    protected onUserInfo(packet: PacketReader) {
        const info = readUserInfo(packet);
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

        this.userId = info.objectId;
        this.appearances.set(info.objectId, { ...info, paperdoll: info.paperdoll.slice() });
        object.heading = info.heading;
        setVector(object.position, info);
        object.name = info.name;
        object.title = info.title;
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
        object.isRunning = this.isRunning;

        this.applySpeeds(player, info, this.isRunning);
        player.setRotationYaw(info.heading);

        if (isFirst) {
            this.inWorld = true;
            player.teleportTo(setVector(object.position, info), true);
        }

        this.updateCubics(object);
        this.isMounted = info.mountType !== 0;
        this.updateMountable();
        this.ui.setStatus(info);
        this.ui.setClan(this.clanInfo);

        const key = this.getAppearanceKey(info);

        if (key !== object.appearanceKey) {
            object.appearanceKey = key;
            this.userAppearanceLoad = this.loadAppearance(info, player);
        }

        if (isFirst) void this.finishLoading();
    }

    protected async finishLoading() {
        const render = this.manGame.getComponent("render");
        const asset = this.manGame.getComponent("asset");

        await this.userAppearanceLoad;
        await this.skillListLoad;

        while (this.inWorld && (!asset.isAreaLoaded(render, render.player.position) || this.npcSpawnCount > 0)) await new Promise(resolve => setTimeout(resolve, 100));

        if (this.inWorld) this.ui.showWorld();
    }

    protected onCharInfo(packet: PacketReader) {
        const info = readCharInfo(packet);
        this.appearances.set(info.objectId, { ...info, paperdoll: info.paperdoll.slice() });
        let object = this.objects.get(info.objectId);

        if (object) {
            const wasDead = object.isDead;
            object.heading = info.heading;
            this.adjustPawnLocation(object, info);
            object.name = info.name;
            object.title = info.title;
            object.speeds = info;
            object.isRunning = info.isRunning;
            object.isInCombat = info.isInCombat;
            object.isDead = info.isAlikeDead;
            object.waitType = info.isSitting ? WaitType_T.WT_SITTING : WaitType_T.WT_STANDING;
            object.cubics = info.cubics;
            this.updateCubics(object);

            if (object.actor) {
                this.applySpeeds(object.actor, info, info.isRunning);
                object.actor.setRotationYaw(info.heading);
                if (object.isDead) {
                    if (!wasDead) object.actor.playDeathAnimation(() => { });
                } else this.setIdleAnimation(object);
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
        object.appearanceKey = this.getAppearanceKey(info);
        this.applyPartyMember(object);

        void this.spawnPlayer(object, info);
    }

    protected async spawnPlayer(object: NetObject_T, info: CreatureInfo_T & Appearance_T) {
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

    protected onNpcInfo(packet: PacketReader) { this.setNpc(readNpcInfo(packet)); }

    protected onServerObjectInfo(packet: PacketReader) {
        const info = readServerObjectInfo(packet);
        const object = this.setNpc(info);

        object.curHp = info.curHp;
        object.maxHp = info.maxHp;
        if (object.objectId === this.targetId) this.updateTarget();
    }

    protected onPetInfo(packet: PacketReader) {
        const info = readPetInfo(packet);

        this.petInfo = info;
        this.updateMountable();
        const object = this.setNpc(info);

        object.curHp = info.curHp;
        object.maxHp = info.maxHp;
        object.curMp = info.curMp;
        object.maxMp = info.maxMp;
        if (object.objectId === this.targetId) this.updateTarget();
    }

    protected updateMountable() { this.ui.setMountable(this.isMounted || !!this.petInfo && this.petInfo.isMountable); }

    protected readPetInventoryItem(packet: PacketReader, allowZeroCount: boolean = false): InventoryItem_T {
        const item = { type1: packet.h(), objectId: packet.d(), itemId: packet.d(), count: packet.d(), type2: packet.h(), customType1: packet.h(), isEquipped: packet.h() !== 0, bodyPart: packet.d(), enchantLevel: packet.h(), customType2: packet.h() };

        if (item.objectId <= 0 || item.itemId <= 0 || item.count < (allowZeroCount ? 0 : 1)) throw new Error(`Invalid pet inventory item '${item.itemId}'.`);

        return item;
    }

    protected onPetItemList(packet: PacketReader) {
        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 28)) throw new Error(`Invalid PetItemList count '${count}'.`);

        const items: InventoryItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readPetInventoryItem(packet));
        if (packet.getRemaining()) throw new Error("Invalid PetItemList trailing data.");

        this.petInventory.clear();
        for (const item of items) this.petInventory.set(item.objectId, item);
    }

    protected onPetInventoryUpdate(packet: PacketReader) {
        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 30)) throw new Error(`Invalid PetInventoryUpdate count '${count}'.`);

        const changes: { change: number, item: InventoryItem_T }[] = [];
        for (let i = 0; i < count; i++) {
            const change = packet.h();
            if (change < 1 || change > 3) throw new Error(`Unknown pet inventory change '${change}'.`);
            changes.push({ change, item: this.readPetInventoryItem(packet, change === 3) });
        }
        if (packet.getRemaining()) throw new Error("Invalid PetInventoryUpdate trailing data.");

        for (const change of changes) {
            if (change.change === 3) this.petInventory.delete(change.item.objectId);
            else this.petInventory.set(change.item.objectId, change.item);
        }
    }

    protected onPetStatusShow(packet: PacketReader) {
        const summonType = packet.d();

        if (summonType < 0 || packet.getRemaining()) throw new Error("Invalid PetStatusShow payload.");
        this.petStatusType = summonType;
    }

    protected onSetSummonRemainTime(packet: PacketReader) {
        const maxTime = packet.d(), remainingTime = packet.d();

        if (maxTime < 0 || remainingTime < 0 || remainingTime > maxTime || packet.getRemaining()) throw new Error("Invalid SetSummonRemainTime payload.");

        this.petRemainTime = { maxTime, remainingTime };
    }

    protected onPetStatusUpdate(packet: PacketReader) {
        packet.d();

        const objectId = packet.d();

        packet.skip(3 * 4);
        packet.S();
        packet.skip(2 * 4);

        const curHp = packet.d(), maxHp = packet.d(), curMp = packet.d(), maxMp = packet.d();

        packet.skip(4 * 4);

        const object = this.objects.get(objectId);

        if (!object) return;

        object.curHp = curHp;
        object.maxHp = maxHp;
        object.curMp = curMp;
        object.maxMp = maxMp;
        if (objectId === this.targetId) this.updateTarget();
    }

    protected setNpc(info: NpcInfo_T) {
        const object = this.objects.get(info.objectId);

        if (object) {
            const wasDead = object.isDead;
            this.adjustPawnLocation(object, info);
            if (info.name) object.name = info.name;
            object.title = info.title;
            object.heading = info.heading;
            object.isRunning = info.isRunning;
            object.isInCombat = info.isInCombat;
            object.isDead = info.isAlikeDead;
            object.isSummon = info.isSummon;
            object.speeds = info;

            if (object.actor) {
                this.applySpeeds(object.actor, info, info.isRunning);
                object.actor.setRotationYaw(info.heading);
                if (object.isDead) {
                    if (!wasDead) object.actor.playDeathAnimation(() => { });
                } else this.setIdleAnimation(object);
            }
            if (object.objectId === this.targetId) this.updateTarget();

            return object;
        }

        const created = this.createObject(info.objectId, "npc", info);

        created.isSummon = info.isSummon;

        void this.spawnNpc(created, info.npcId, info);

        return created;
    }

    protected async spawnNpc(object: NetObject_T, npcId: number, info: CreatureInfo_T & { rightHand: number, chest: number, leftHand: number }) {
        const render = this.manGame.getComponent("render");
        let actor: BaseActor;

        while (this.npcSpawnCount >= NPC_SPAWN_CONCURRENCY) await new Promise<void>(resolve => this.npcSpawnWaiters.push(resolve));
        this.npcSpawnCount++;

        try {
            actor = await render.spawnNpc(npcId, object.position.clone(), info.rightHand || info.leftHand || info.chest ? { rightHand: info.rightHand, leftHand: info.leftHand, chest: info.chest, attackRange: NETWORK_BOW_RANGE } : null);
        } catch (e) {
            console.error(`[network] npc ${npcId} (object ${object.objectId}) failed to spawn:`, e);
            this.npcSpawnCount--;
            this.npcSpawnWaiters.shift()?.();
            return;
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

    protected attachActor(object: NetObject_T, actor: BaseActor, info: CreatureInfo_T) {
        object.actor = actor;

        this.applySpeeds(actor, info, info.isRunning);
        this.setIdleAnimation(object);
        actor.setRotationYaw(object.heading);

        actor.teleportTo(object.position, true);
        this.updateCubics(object);
        if (object.destination) actor.goTo(object.destination);
        if (object.isDead) actor.playDeathAnimation(() => { });
        if (object.objectId === this.targetId) this.updateTarget();
        this.flushPendingAttacks();
        this.flushPendingSkills();
        this.flushSkillTargets(object.objectId);
    }

    protected async onSpawnItem(packet: PacketReader, dropped: boolean) {
        if (dropped) packet.d();

        const objectId = packet.d(), itemId = packet.d();
        const position = setVector(new Vector3(), this.readLocation(packet));
        const stackable = packet.d() !== 0, count = packet.d(), heading = packet.d();

        this.removeObject(objectId);

        const render = this.manGame.getComponent("render");
        const asset = this.manGame.getComponent("asset");
        const pickup = new L2Pickup(render, objectId, itemId, count, stackable);

        pickup.position.copy(position);
        pickup.quaternion.fromArray(getRotatorQuaternionElements(0, heading, 0));
        this.pickups.set(objectId, pickup);

        const library = await asset.loadItem(itemId);

        if (this.pickups.get(objectId) !== pickup) return;

        pickup.setMeshes(library);
        render.addPickup(pickup);

        const sound = library.pickup.dropSound;

        if (dropped && sound && sound.toLowerCase() !== "none") {
            const uri = await asset.loadSound(sound);

            if (this.pickups.get(objectId) === pickup) await this.manGame.getComponent("audio").playOneShotSound(uri, pickup.position, 1, 1, 50, 5000);
        }
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
        }

        this.removeObject(objectId);
    }

    protected removeObject(objectId: number) {
        const wasTarget = objectId === this.targetId;

        if (this.petInfo && this.petInfo.objectId === objectId) {
            this.petInfo = null;
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

    protected readLocation(packet: PacketReader): Location_T {
        tmpLocation.x = packet.d();
        tmpLocation.y = packet.d();
        tmpLocation.z = packet.d();

        return tmpLocation;
    }

    protected adjustPawnLocation(object: NetObject_T, position: Location_T) {
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
        if (object.kind === "user") this.game.appearing();
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

        return { targetObjectId, actionTarget: target ? target.actor : null, damage, isMiss: !!(flags & AttackFlags_T.MISS), isCritical: !!(flags & AttackFlags_T.CRITICAL), isShieldDefense: !!(flags & AttackFlags_T.SHIELD), isSpirit: !!(flags & AttackFlags_T.SOULSHOT), soulshotGrade: flags & AttackFlags_T.GRADE };
    }

    protected startServerAttack(attacker: NetObject_T, hits: readonly NAttackActionParam_T[], position: Location_T) {
        if (!attacker.actor || !hits[0].actionTarget || attacker.actor === hits[0].actionTarget) return;

        attacker.pendingAttack = null;
        setVector(attacker.position, position);
        attacker.destination = null;
        if (distanceXY(attacker.actor.position, attacker.position) > this.getStopSnapDistance(attacker)) attacker.actor.teleportTo(attacker.position, true);
        this.stopSkill(attacker.objectId);
        attacker.actor.getComponent<PawnAttackComponent>("pawnAttack").attackFromServer(hits);
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
        const caster = this.objects.get(packet.d());
        const targetObjectId = packet.d(), target = this.objects.get(targetObjectId);
        const id = packet.d(), level = packet.d(), hitTime = packet.d();

        const reuseDelay = packet.d();
        const position = this.readLocation(packet);

        packet.d();

        if (caster && caster.objectId === this.userId && hitTime >= 0) this.ui.setSkillCoolTime(id, level, Math.trunc(reuseDelay / 1000), Math.trunc(reuseDelay / 1000)); // OnReceiveMagicSkillUse 0x7505a2 / 0x750690.

        const isTransient = CUBIC_SKILLS.has(id) || this.ui.getStrings().skillCastStyles[`${id}:${level}`] === 0;

        if (!caster || hitTime < 0) return;

        if (!caster.actor || !target || !target.actor) {
            if (!isTransient) this.stopSkill(caster.objectId);
            caster.pendingSkill = { targetObjectId, id, level, hitTime: hitTime / 1000, position: { x: position.x, y: position.y, z: position.z }, isTransient, associatedObjectIds: [] };
            return;
        }

        this.startServerSkill(caster, target, id, level, hitTime / 1000, position, isTransient);
    }

    protected startServerSkill(caster: NetObject_T, target: NetObject_T, id: number, level: number, hitTime: number, position: Location_T, isTransient: boolean, associatedObjectIds: readonly number[] = []) {
        const skill: NetSkill_T = { id, level, hitTime, associatedActors: [], associatedObjectIds: [...associatedObjectIds] }; // OnReceiveMagicSkillUse 0x7507f7..0x750831.

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

        if (isTransient && skill.visual.transientRejected) this.stopSkill(caster.objectId);
        actor.getComponent<PawnAttackComponent>("pawnAttack").castFromServer(target.actor, skill, cast.hitTime, cast.associatedActors, cast.associatedActors.length > 0);
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

            this.startServerSkill(caster, target, pending.id, pending.level, pending.hitTime, pending.position, pending.isTransient, pending.associatedObjectIds);
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
        if (objectId === this.userId) this.ui.setupGauge(GaugeColor_T.BLUE, 0, 0); // MagicCancel 0x7b5e6d..0x7b5e7d.
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
        component.setPosture(object.waitType === WaitType_T.WT_SITTING, object.waitType === WaitType_T.WT_START_FAKEDEATH);
        void component.setCubics(object.cubics);
    }

    protected setIdleAnimation(object: NetObject_T, updatePose: boolean = true) {
        const actor = object.actor;

        if (!actor || object.isDead) return;

        actor.findComponent<PawnCubicComponent>("pawnCubic")?.setPosture(object.waitType === WaitType_T.WT_SITTING, object.waitType === WaitType_T.WT_START_FAKEDEATH);
        const field = object.waitType === WaitType_T.WT_SITTING ? object.chairStaticObjectId ? "ChairWaitAnimName" : "SitWaitAnimName" : object.waitType === WaitType_T.WT_START_FAKEDEATH ? "DeathWaitAnimName" : object.isInCombat ? "AtkWaitAnimName" : "WaitAnimName";
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
        const waitType = packet.d() as WaitType_T;
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
            case WaitType_T.WT_SITTING: field = object.chairStaticObjectId ? "ChairSitAnimName" : "SitAnimName"; rateField = "SitAnimRate"; break;
            case WaitType_T.WT_STANDING: field = "StandAnimName"; rateField = "StandAnimRate"; object.chairStaticObjectId = 0; break;
            case WaitType_T.WT_START_FAKEDEATH: field = "DeathAnimName"; break;
            case WaitType_T.WT_STOP_FAKEDEATH: field = "DeathStandAnimName"; object.chairStaticObjectId = 0; break;
            default: throw new Error(`Unknown wait type '${waitType}'.`);
        }

        object.waitType = waitType === WaitType_T.WT_STOP_FAKEDEATH ? WaitType_T.WT_STANDING : waitType;
        this.setIdleAnimation(object, false);

        if (!actor) return;

        const animation = (actor.getUnrealScriptProperty(field) as string[])[actor.getUnrealScriptProperty("CurWeaponType") as number];
        const rate = actor.getUnrealScriptProperty(rateField) as number;

        if (animation.toLowerCase() !== "none") actor.playAnimation(animation, 0.1, rate || 1, false, true); // OnChangeWaitType 0x74fb96..0x74fe58.
    }

    protected onSocialAction(objectId: number, actionId: number) {
        const object = this.objects.get(objectId);

        if (!object || !object.actor || actionId < 1) return;

        const actor = object.actor;
        const isNpc = object.kind === "npc";
        const prefix = isNpc ? "NpcSocial" : "PcSocial";
        const index = isNpc ? actionId - 1 : actionId;
        const names = actor.getUnrealScriptProperty(`${prefix}AnimName`) as string[];

        if (index >= names.length || names[index].toLowerCase() === "none") return;

        const animation = names[index];

        actor.playAnimation(animation, isNpc ? 0.1 : 0.3, actor.getUnrealScriptProperty("NonAttackSpeedRate") as number, false, true); // OnSocialAction 0x73dbbc / 0x73dc4a.
        const equipment = actor.findComponent<PawnEquipmentComponent>("pawnEquipment");

        if (equipment) equipment.hideForAnimation(animation, !!(actor.getUnrealScriptProperty(`${prefix}HideRightWeapon`) as number[])[index], !!(actor.getUnrealScriptProperty(`${prefix}HideLeftWeapon`) as number[])[index]);
    }

    protected async onPlaySound(packet: PacketReader) {
        const type = packet.d() as PlaySoundType_T;
        const name = packet.S();

        packet.skip(20); // OnPlaySound 0x751275..0x7512ac ignores the five positional fields.

        const audio = this.manGame.getComponent("audio");

        if (type === PlaySoundType_T.SOUND) {
            const position = this.manGame.getComponent("render").player.position.clone();
            const uri = await this.manGame.getComponent("asset").loadSound(name);

            await audio.playOneShotSound(uri, position, 1, 1, 80, 8000); // Core.dll GAudioDefaultRadius 0x101cdf84 = 80.
            return;
        }

        if (!/^[\w -]+$/.test(name)) throw new Error(`Invalid audio stream name '${name}'.`);

        switch (type) {
            case PlaySoundType_T.MUSIC: await audio.playMusic(`assets/music/${name.toLowerCase()}.ogg`, false, true); break;
            case PlaySoundType_T.VOICE: await audio.playVoice(`assets/voice/${name.toLowerCase()}-e.ogg`); break;
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
        const object = this.objects.get(this.targetId);

        this.ui.setTarget(object ? { name: object.name, curHp: object.curHp, maxHp: object.maxHp, curMp: object.curMp, maxMp: object.maxMp, showHp: object.maxHp > 0, showMp: object.kind !== "npc" && object.maxMp > 0, levelDifference: object.levelDifference } : null);
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
        if (StatusUpdate_T.CUR_HP in status) object.curHp = status[StatusUpdate_T.CUR_HP];
        if (StatusUpdate_T.MAX_HP in status) object.maxHp = status[StatusUpdate_T.MAX_HP];
        if (StatusUpdate_T.CUR_MP in status) object.curMp = status[StatusUpdate_T.CUR_MP];
        if (StatusUpdate_T.MAX_MP in status) object.maxMp = status[StatusUpdate_T.MAX_MP];
        if (StatusUpdate_T.KARMA in status) object.karma = status[StatusUpdate_T.KARMA];
        if (StatusUpdate_T.PVP_FLAG in status) object.pvpFlag = status[StatusUpdate_T.PVP_FLAG];
        if (objectId === this.userId) this.ui.updateStatus(status);
        if (objectId === this.targetId) this.updateTarget();
    }

    protected onNicknameChanged(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const title = packet.S();

        if (!object) return;

        object.title = title;
        if (object.objectId === this.targetId) this.updateTarget();
    }

    protected onRelationChanged(packet: PacketReader) {
        const object = this.objects.get(packet.d());

        packet.d();
        packet.d();
        const karma = packet.d();
        const pvpFlag = packet.d();

        if (!object) return;

        object.karma = karma;
        object.pvpFlag = pvpFlag;
        if (object.objectId === this.targetId) this.updateTarget();
    }

    protected onCreatureSay(packet: PacketReader) {
        packet.d();

        const type = packet.d() as Say2_T;
        const name = packet.S();

        this.ui.addChat(name, packet.S(), type);
    }

    protected onNpcSay(packet: PacketReader) {
        packet.d();

        const type = packet.d() as Say2_T, id = packet.d() - NPC_ID_OFFSET;

        this.ui.addChat(this.npcNames.get(id) || `npc#${id}`, packet.S(), type);
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

    protected playSystemMessageSound(id: number) {
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
                case SystemMessageParam_T.TYPE_TEXT: params.push(packet.S()); break;
                case SystemMessageParam_T.TYPE_NUMBER: params.push(String(packet.d())); break;
                case SystemMessageParam_T.TYPE_NPC_NAME: { const id = packet.d() - NPC_ID_OFFSET; params.push(this.npcNames.get(id) || `npc#${id}`); break; }
                case SystemMessageParam_T.TYPE_ITEM_NAME: { const id = packet.d(); params.push(strings.itemNames[id] || `item#${id}`); break; }
                case SystemMessageParam_T.TYPE_SKILL_NAME: { const id = packet.d(); packet.d(); params.push(strings.skillNames[id] || `skill#${id}`); break; }
                default: throw new Error(`Unknown SystemMessage parameter type in message ${messageId}.`);
            }
        }

        const template = strings.systemMessages[messageId];

        const text = template === undefined ? `SystemMessage ${messageId} ${params.join(" ")}` : template.replace(/\$[sc](\d)/g, (match, index) => params[Number(index) - 1] ?? match);

        return { id: messageId, text };
    }

    protected setShortCut(shortcut: ShortCut_T) {
        this.shortcuts.set(shortcut.slot, shortcut);
        const item = this.inventory.get(shortcut.id);

        this.ui.setShortCut(shortcut, item, !!item && this.autoSoulShots.has(item.itemId));
    }

    protected onAutoSoulShot(packet: PacketReader) {
        const itemId = packet.d(), isEnabled = packet.d() !== 0;

        if (isEnabled) this.autoSoulShots.add(itemId);
        else this.autoSoulShots.delete(itemId);

        for (const shortcut of this.shortcuts.values()) {
            if (shortcut.type !== ShortCutType_T.TYPE_ITEM) continue;

            const item = this.inventory.get(shortcut.id);

            if (item && item.itemId === itemId) this.setShortCut(shortcut);
        }
    }

    protected onStorageMaxCount(packet: PacketReader) {
        const values = [packet.d(), packet.d(), packet.d(), packet.d(), packet.d(), packet.d(), packet.d()];

        if (values.some(value => value < 0) || packet.getRemaining()) throw new Error("Invalid ExStorageMaxCount packet.");

        this.storageMaxCount = { inventory: values[0], warehouse: values[1], freight: values[2], privateSell: values[3], privateBuy: values[4], recipeDwarf: values[5], recipe: values[6] };
        this.ui.setInventoryLimit(values[0]);
    }

    public toggleAutoSoulShot(page: number, slot: number) {
        const shortcut = this.shortcuts.get(page * 12 + slot);

        if (!this.inWorld || !shortcut || shortcut.type !== ShortCutType_T.TYPE_ITEM) return;

        const item = this.inventory.get(shortcut.id);

        if (!item) return;

        const id = item.itemId;

        // NCConsole 0x1006e500: retail automatic-shot item ranges.
        if (!(id >= 1463 && id <= 1467 || id === 1835 || id >= 2509 && id <= 2514 || id >= 3947 && id <= 3952 || id >= 5789 && id <= 5790 || id >= 6645 && id <= 6647)) return;

        this.game.requestAutoSoulShot(id, !this.autoSoulShots.has(id));
    }

    public registerSkillShortCut(id: number, page: number, slot: number) {
        const skill = this.skills.get(id);

        if (!this.inWorld || !skill || skill.isPassive) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.game.requestShortCutReg(ShortCutType_T.TYPE_SKILL, page * 12 + slot, id);
    }

    public registerItemShortCut(objectId: number, page: number, slot: number) {
        if (!this.inWorld || !this.inventory.has(objectId)) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.game.requestShortCutReg(ShortCutType_T.TYPE_ITEM, page * 12 + slot, objectId);
    }

    public registerActionShortCut(id: number, page: number, slot: number) {
        if (!this.inWorld || !this.ui.getStrings().actions[id]) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.game.requestShortCutReg(ShortCutType_T.TYPE_ACTION, page * 12 + slot, id);
    }

    public useShortCut(page: number, slot: number) {
        const shortcut = this.shortcuts.get(page * 12 + slot);

        if (!shortcut) return;

        switch (shortcut.type) {
            case ShortCutType_T.TYPE_SKILL: this.game.requestMagicSkillUse(shortcut.id, false, false); break;
            case ShortCutType_T.TYPE_ACTION: this.game.requestActionUse(shortcut.id, false, false); break;
            case ShortCutType_T.TYPE_ITEM: this.useItem(shortcut.id); break;
            case ShortCutType_T.TYPE_MACRO: case ShortCutType_T.TYPE_RECIPE: break; // TODO: macros and recipes need the macro list / recipe book windows.
            default: throw new Error(`Unknown shortcut type ${shortcut.type}.`);
        }
    }

    protected async showLobby() {
        await this.lobby.enter(this.ui.getStrings().logonSpots);

        this.ui.showCharacters(this.characters);

        const lastUsed = this.characters.findIndex(character => character.isLastUsed);
        const asset = this.manGame.getComponent("asset");

        await this.lobby.showSelect(this.characters);

        void asset.precacheNpcBundle("LineageMonsters"); // after the lobby pawns, opening the bundles held two workers for seconds
        void asset.precacheNpcBundle("LineageNPCs");

        if (lastUsed >= 0) this.previewCharacter(lastUsed);
    }

    protected onManagePledgePower(packet: PacketReader) {
        const unknown1 = packet.d(), unknown2 = packet.d(), privs = packet.d();

        if (unknown1 !== 0 || unknown2 !== 0 || privs < 0 || packet.getRemaining()) throw new Error(`Invalid ManagePledgePower payload (privs ${privs}).`);

        this.pledgePower = privs;
    }

    protected onPledgeCrest(packet: PacketReader) {
        const crest = readCrest(packet);

        this.pledgeCrests.set(crest.crestId, crest.data);
    }

    protected onAllyCrest(packet: PacketReader) {
        const crest = readCrest(packet);

        this.allyCrests.set(crest.crestId, crest.data);
    }

    protected onPledgeCrestLarge(packet: PacketReader) {
        const crest = readPledgeCrestLarge(packet);

        this.clanLargeCrestIds.set(crest.clanId, crest.crestId);

        if (crest.data.length) this.pledgeLargeCrests.set(crest.crestId, crest.data);
        else this.pledgeLargeCrests.delete(crest.crestId);
    }

    protected onAskJoinAlly(packet: PacketReader) {
        const requestorId = packet.d(), requestorName = packet.S(), unknown = packet.S(), allyName = packet.S();

        if (requestorId <= 0 || !requestorName || unknown || !allyName || packet.getRemaining()) throw new Error("Invalid AskJoinAlly payload.");

        const invite: AllyInvite_T = { requestorId, requestorName, allyName };
        this.allyInvite = invite;
        this.ui.showAllyInvite(requestorName, allyName, isAccepted => {
            if (this.allyInvite !== invite) return;

            this.allyInvite = null;
            this.game.answerJoinAlly(isAccepted);
        });
    }

    public getPledgePower() { return this.pledgePower; }
    public getPledgeCrest(crestId: number) { return this.pledgeCrests.get(crestId); }
    public getPledgeLargeCrest(crestId: number) { return this.pledgeLargeCrests.get(crestId); }
    public getClanLargeCrestId(clanId: number) { return this.clanLargeCrestIds.get(clanId); }
    public getAllyCrest(crestId: number) { return this.allyCrests.get(crestId); }

    public requestPledgeInfo(clanId: number) { if (this.inWorld) this.game.requestPledgeInfo(clanId); }
    public requestPledgeMemberList() { if (this.inWorld) this.game.requestPledgeMemberList(); }
    public withdrawPledge() { if (this.inWorld) this.game.requestWithdrawalPledge(); }
    public oustPledgeMember(name: string) { if (this.inWorld) this.game.requestOustPledgeMember(name); }
    public giveNickName(name: string, title: string) { if (this.inWorld) this.game.requestGiveNickName(name, title); }
    public requestPledgePower() { if (this.inWorld) this.game.requestPledgePower(this.userId); }
    public requestMemberPledgePower(objectId: number) { if (this.inWorld) this.game.requestMemberPledgePower(objectId); }
    public setMemberPledgePower(objectId: number, privs: number) { if (this.inWorld) this.game.setMemberPledgePower(objectId, privs); }

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
        const list = readPrivateStoreManageListSell(packet);

        if (list.playerId !== this.userId) throw new Error(`PrivateStoreManageListSell for foreign player '${list.playerId}'.`);

        this.privateStoreManageSell = list;
    }

    protected onPrivateStoreManageListBuy(packet: PacketReader) {
        const list = readPrivateStoreManageListBuy(packet);

        if (list.playerId !== this.userId) throw new Error(`PrivateStoreManageListBuy for foreign player '${list.playerId}'.`);

        this.privateStoreManageBuy = list;
    }

    protected onPrivateStoreMsg(packet: PacketReader, messages: Map<number, string>) {
        const objectId = packet.d(), message = packet.S();

        if (objectId <= 0 || packet.getRemaining()) throw new Error("Invalid private store message payload.");

        messages.set(objectId, message);
    }

    protected onPackageToList(packet: PacketReader) {
        const targets = readPackageToList(packet);

        this.packageTargets.clear();
        for (const target of targets) this.packageTargets.set(target.objectId, target.name);
    }

    protected onMultiSellList(packet: PacketReader) {
        const list = readMultiSellList(packet);

        if (list.page === 1) {
            this.multiSell = list;
            return;
        }

        if (!this.multiSell || this.multiSell.listId !== list.listId || list.page !== this.multiSell.page + 1) throw new Error(`Unexpected MultiSellList page ${list.page} for list ${list.listId}.`);

        this.multiSell.page = list.page;
        this.multiSell.isFinished = list.isFinished;
        this.multiSell.entries.push(...list.entries);
    }

    public requestTrade(objectId: number) { if (this.inWorld) this.game.tradeRequest(objectId); }
    public addTradeItem(objectId: number, count: number) { if (this.inWorld && this.tradePartnerId && this.inventory.has(objectId)) this.game.addTradeItem(this.tradePartnerId, objectId, count); }
    public confirmTrade(isConfirmed: boolean) { if (this.inWorld && this.tradePartnerId) this.game.tradeDone(isConfirmed); }

    public answerTradeRequest(isAccepted: boolean) {
        if (!this.inWorld || !this.tradeRequestId) return;

        this.tradeRequestId = 0;
        this.game.answerTradeRequest(isAccepted);
    }

    public sellItems(items: SellItemRequest_T[]) { if (this.inWorld) this.game.requestSellItem(this.shopSellNpcId, items); }
    public buyItems(items: ItemIdCount_T[]) { if (this.inWorld && this.shopBuyListId) this.game.requestBuyItem(this.shopBuyListId, items); }
    public depositWarehouse(items: ItemCount_T[]) { if (this.inWorld && this.warehouseDeposit) this.game.sendWareHouseDepositList(items); }
    public withdrawWarehouse(items: ItemCount_T[]) { if (this.inWorld && this.warehouseWithdraw) this.game.sendWareHouseWithDrawList(items); }
    public requestPrivateStoreManageSell() { if (this.inWorld) this.game.requestPrivateStoreManageSell(); }
    public setPrivateStoreListSell(isPackage: boolean, items: PrivateStoreOffer_T[]) { if (this.inWorld) this.game.setPrivateStoreListSell(isPackage, items); }
    public quitPrivateStoreSell() { if (this.inWorld) this.game.requestPrivateStoreQuitSell(); }
    public setPrivateStoreMsgSell(message: string) { if (this.inWorld) this.game.setPrivateStoreMsgSell(message); }
    public buyFromPrivateStore(items: PrivateStoreOffer_T[]) { if (this.inWorld && this.privateStoreSell) this.game.requestPrivateStoreBuy(this.privateStoreSell.storePlayerId, items); }
    public requestPrivateStoreManageBuy() { if (this.inWorld) this.game.requestPrivateStoreManageBuy(); }
    public setPrivateStoreListBuy(items: PrivateStoreBuyOffer_T[]) { if (this.inWorld) this.game.setPrivateStoreListBuy(items); }
    public quitPrivateStoreBuy() { if (this.inWorld) this.game.requestPrivateStoreQuitBuy(); }
    public setPrivateStoreMsgBuy(message: string) { if (this.inWorld) this.game.setPrivateStoreMsgBuy(message); }
    public sellToPrivateStore(items: PrivateStoreSellOffer_T[]) { if (this.inWorld && this.privateStoreBuy) this.game.requestPrivateStoreSell(this.privateStoreBuy.storePlayerId, items); }
    public requestPackageSendableItemList(objectId: number) { if (this.inWorld && this.packageTargets.has(objectId)) this.game.requestPackageSendableItemList(objectId); }
    public sendPackage(items: ItemCount_T[]) { if (this.inWorld && this.packageSendable) this.game.requestPackageSend(this.packageSendable.targetId, items); }
    public chooseMultiSell(entryId: number, amount: number) { if (this.inWorld && this.multiSell) this.game.multiSellChoose(this.multiSell.listId, entryId, amount); }
    public requestPreviewItems(itemIds: number[]) { if (this.inWorld && this.shopPreview) this.game.requestPreviewItem(this.shopPreview.listId, itemIds); }
    public buySeeds(items: ItemIdCount_T[]) { if (this.inWorld && this.seedShop) this.game.requestBuySeed(this.seedShop.manorId, items); }
    public sellCrops(items: SellItemRequest_T[]) { if (this.inWorld && this.cropProcure) this.game.requestBuyProcure(this.cropProcure.listId, items); }
    public dropItem(objectId: number, count: number, point: Location_T) { if (this.inWorld && this.inventory.has(objectId)) this.game.requestDropItem(objectId, count, point); }
    public destroyItem(objectId: number, count: number) { if (this.inWorld && this.inventory.has(objectId)) this.game.requestDestroyItem(objectId, count); }
    public crystallizeItem(objectId: number, count: number) { if (this.inWorld && this.inventory.has(objectId)) this.game.requestCrystallizeItem(objectId, count); }
    public unequipBodyPart(bodyPart: number) { if (this.inWorld) this.game.requestUnEquipItem(bodyPart); }
    public giveItemToPet(objectId: number, count: number) { if (this.inWorld && this.inventory.has(objectId)) this.game.requestGiveItemToPet(objectId, count); }
    public getItemFromPet(objectId: number, count: number) { if (this.inWorld && this.petInventory.has(objectId)) this.game.requestGetItemFromPet(objectId, count); }
    public usePetItem(objectId: number) { if (this.inWorld && this.petInventory.has(objectId)) this.game.requestPetUseItem(objectId); }
    public petPickup(objectId: number) { if (this.inWorld && this.pickups.has(objectId)) this.game.requestPetGetItem(objectId); }
    public changePetName(name: string) { if (this.inWorld) this.game.requestChangePetName(name); }

    protected onVehicleLocation(packet: PacketReader, isStopped: boolean) {
        const info = readVehicleLocation(packet);
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
        const departure = readVehicleDeparture(packet);
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

    protected setVehicleRider(vehicle: NetVehicle_T, objectId: number, local: Location_T) {
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
        const rider = readVehicleRider(packet);
        const vehicle = this.vehicles.get(rider.vehicleId);

        if (!vehicle) return;

        this.setVehicleRider(vehicle, rider.objectId, rider);
        this.placeVehicleRider(vehicle, rider.objectId);
    }

    protected onGetOffVehicle(packet: PacketReader) {
        const rider = readVehicleRider(packet);
        const vehicle = this.vehicles.get(rider.vehicleId);
        const object = this.objects.get(rider.objectId);

        if (vehicle) vehicle.riders.delete(rider.objectId);
        if (!object) return;

        setVector(object.position, rider);
        object.destination = null;

        if (object.actor) object.actor.teleportTo(object.position, true);
    }

    protected onMoveToLocationInVehicle(packet: PacketReader) {
        const move = readVehicleRiderMove(packet);
        const vehicle = this.vehicles.get(move.vehicleId);

        if (vehicle) this.setVehicleRider(vehicle, move.objectId, move.destination);
    }

    protected onStopMoveInVehicle(packet: PacketReader) {
        const stop = readVehicleRiderStop(packet);
        const vehicle = this.vehicles.get(stop.vehicleId);

        if (!vehicle) return;

        this.setVehicleRider(vehicle, stop.objectId, stop);
        this.withActor(stop.objectId, (actor, object) => {
            object.heading = stop.heading;
            actor.setRotationYaw(stop.heading);
        });
    }

    protected onRide(packet: PacketReader) {
        const ride = readRide(packet);

        if (ride.objectId === this.userId) {
            this.isMounted = ride.isMounted;
            this.updateMountable();
        }

        if (ride.isMounted) this.mounts.set(ride.objectId, ride);
        else this.mounts.delete(ride.objectId);

        this.withActor(ride.objectId, (actor, object) => {
            if (ride.mountType === MountType_T.WYVERN) actor.setFlying(true);
            else if (!ride.isMounted) {
                actor.setFlying(false);
                this.applySpeeds(actor, object.speeds, object.isRunning);
            }
        });
    }

    protected onFlyToLocation(packet: PacketReader) {
        const fly = readFlyToLocation(packet);
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

    protected placeObserver(position: Location_T, isObserving: boolean) {
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
        const info = readObservationMode(packet);

        this.observation = { x: info.x, y: info.y, z: info.z };
        this.placeObserver(info, true);
    }

    protected onObservationReturn(packet: PacketReader) {
        const position = readPoint(packet);

        this.observation = null;
        this.placeObserver(position, false);
    }

    protected onRadarControl(packet: PacketReader) {
        const radar = readRadarControl(packet);

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
        const status = readSSQStatus(packet);

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
    public getRadarMarkers(): readonly Location_T[] { return this.radarMarkers; }
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

    public requestGetOnVehicle(vehicleId: number, position: Location_T) { if (this.inWorld && this.vehicles.has(vehicleId)) this.game.requestGetOnVehicle(vehicleId, position); }
    public requestGetOffVehicle(position: Location_T) { if (this.inWorld && this.getVehicleId()) this.game.requestGetOffVehicle(this.getVehicleId(), position); }
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

    public requestMoveInVehicle(destination: Location_T) {
        const vehicleId = this.getVehicleId();

        if (!this.inWorld || !vehicleId) return;

        this.game.requestMoveToLocationInVehicle(vehicleId, destination, this.vehicles.get(vehicleId).riders.get(this.userId));
    }

    public cannotMoveInVehicle(position: Location_T) {
        const vehicleId = this.getVehicleId();

        if (this.inWorld && vehicleId) this.game.cannotMoveAnymoreInVehicle(vehicleId, position, this.manGame.getComponent("render").player.getRotationYaw());
    }

    protected onRecipeShopMsg(packet: PacketReader) {
        const message = readRecipeShopMsg(packet);

        this.recipeShopMessages.set(message.objectId, message.storeName);
    }

    protected onPartySpelled(packet: PacketReader) {
        const spelled = readPartySpelled(packet);

        this.partyEffects.set(spelled.objectId, spelled);
    }

    protected onSnoop(packet: PacketReader) {
        const snoop = readSnoop(packet);
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
    public getPartyMatchDetail() { return this.partyMatchDetail; }
    public getPartyEffects(objectId: number) { return this.partyEffects.get(objectId); }
    public getTutorialQuestionMarks() { return this.tutorialQuestionMarks; }
    public getTutorialClientEvents() { return this.tutorialClientEvents; }
    public getSnoops() { return this.snoops; }

    public openRecipeBook(isDwarven: boolean) { if (this.inWorld) this.game.requestRecipeBookOpen(isDwarven); }
    public destroyRecipe(recipeId: number) { if (this.inWorld) this.game.requestRecipeBookDestroy(recipeId); }
    public requestRecipeItemMakeInfo(recipeId: number) { if (this.inWorld) this.game.requestRecipeItemMakeInfo(recipeId); }
    public makeRecipeItem(recipeId: number) { if (this.inWorld) this.game.requestRecipeItemMakeSelf(recipeId); }
    public setRecipeShopMessage(name: string) { if (this.inWorld) this.game.requestRecipeShopMessageSet(name); }
    public setRecipeShopList(items: RecipeShopListEntry_T[]) { if (this.inWorld) this.game.requestRecipeShopListSet(items); }
    public quitRecipeShopManage() { if (this.inWorld) this.game.requestRecipeShopManageQuit(); }
    public requestRecipeShopMakeInfo(objectId: number, recipeId: number) { if (this.inWorld) this.game.requestRecipeShopMakeInfo(objectId, recipeId); }
    public makeRecipeShopItem(objectId: number, recipeId: number) { if (this.inWorld) this.game.requestRecipeShopMakeItem(objectId, recipeId, 0); }
    public recipeShopManagePrev() { if (this.inWorld) this.game.requestRecipeShopManagePrev(); }

    public requestHennaList() { if (this.inWorld) this.game.requestHennaList(0); }
    public requestHennaItemInfo(symbolId: number) { if (this.inWorld) this.game.requestHennaItemInfo(symbolId); }
    public equipHenna(symbolId: number) { if (this.inWorld) this.game.requestHennaEquip(symbolId); }

    public requestPartyMatchConfig(auto: number, location: number, limit: number) { if (this.inWorld) this.game.requestPartyMatchConfig(auto, location, limit); }
    public requestPartyMatchList(roomId: number, maxMembers: number, minLevel: number, maxLevel: number, lootType: number, title: string) { if (this.inWorld) this.game.requestPartyMatchList(roomId, maxMembers, minLevel, maxLevel, lootType, title); } // Creates (roomId 0) or edits a party room.
    public requestPartyMatchDetail(roomId: number) { if (this.inWorld) this.game.requestPartyMatchDetail(roomId, 0); }
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
    public abortQuest(questId: number) { if (this.inWorld && this.questStates.has(questId)) this.game.requestQuestAbort(questId); }

    public makeMacro(macro: Macro_T) {
        if (!this.inWorld) return;
        if (macro.commands.length > 12) throw new Error(`Invalid macro command count ${macro.commands.length}.`);

        this.game.requestMakeMacro(macro);
    }

    public deleteMacro(id: number) { if (this.inWorld && this.macros.has(id)) this.game.requestDeleteMacro(id); }

    public block(type: BlockType_T, name: string = null) { if (this.inWorld) this.game.requestBlock(type, name); }
    public userCommand(id: number) { if (this.inWorld) this.game.requestUserCommand(id); }
    public evaluate(objectId: number) { if (this.inWorld) this.game.requestEvaluate(objectId); }
    public showBoard() { if (this.inWorld) this.game.requestShowBoard(0); }
    public writeBoard(url: string, arg1: string, arg2: string, arg3: string, arg4: string, arg5: string) { if (this.inWorld) this.game.requestBBSwrite(url, arg1, arg2, arg3, arg4, arg5); }

    public requestAquireSkillInfo(id: number, level: number) { if (this.inWorld) this.game.requestAquireSkillInfo(id, level, this.aquireSkillFishing); }
    public aquireSkill(id: number, level: number) { if (this.inWorld) this.game.requestAquireSkill(id, level, this.aquireSkillFishing); }

    public deleteShortCut(page: number, slot: number) {
        const index = page * 12 + slot;

        if (!this.inWorld || !this.shortcuts.has(index)) return;

        this.game.requestShortCutDel(index);
        this.shortcuts.delete(index);
        this.ui.removeShortCut(index);
    }

    protected onEventMatchMessage(packet: PacketReader) {
        const type = packet.c() as EventMatchMessage_T;
        const message = type === EventMatchMessage_T.STRING ? packet.S() : "";

        if (type > EventMatchMessage_T.STATIC_5 || packet.getRemaining()) throw new Error(`Invalid ExEventMatchMessage type ${type}.`);

        this.eventMatchMessageType = type;

        if (type === EventMatchMessage_T.STRING) this.ui.showMessage(message);
    }

    protected onPartyRoomMember(packet: PacketReader) {
        const room = readPartyRoomMembers(packet);

        this.partyRoomMode = room.mode;
        this.partyRoomMembers.clear();
        for (const member of room.members) this.partyRoomMembers.set(member.objectId, member);
    }

    protected onManagePartyRoomMember(packet: PacketReader) {
        const mode = packet.d() as PartyRoomMemberChange_T, member = readPartyRoomMember(packet);

        if (packet.getRemaining()) throw new Error("Invalid ExManagePartyRoomMember trailing data.");

        switch (mode) {
            case PartyRoomMemberChange_T.ADD:
            case PartyRoomMemberChange_T.MODIFY: this.partyRoomMembers.set(member.objectId, member); break;
            case PartyRoomMemberChange_T.REMOVE: this.partyRoomMembers.delete(member.objectId); break;
            default: throw new Error(`Invalid ExManagePartyRoomMember mode ${mode}.`);
        }
    }

    protected onClosePartyRoom(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExClosePartyRoom payload.");

        this.partyRoomMode = -1;
        this.partyRoomMembers.clear();
    }

    protected onFishingStart(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const fishType = packet.d(), x = packet.d(), y = packet.d(), z = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid ExFishingStart payload.");

        if (object) object.fishing = { fishType, x, y, z, isFighting: false, time: 0, fishHp: 0, maxFishHp: 0, mode: 0, lureType: 0, isGoodUse: false, animation: 0, penalty: 0 };
    }

    protected onFishingEnd(packet: PacketReader) {
        const object = this.objects.get(packet.d()), isWin = packet.c();

        if (isWin > 1 || packet.getRemaining()) throw new Error("Invalid ExFishingEnd payload.");

        if (object) object.fishing = null;
    }

    protected onFishingStartCombat(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const time = packet.d(), maxFishHp = packet.d(), mode = packet.c(), lureType = packet.c();

        if (packet.getRemaining()) throw new Error("Invalid ExFishingStartCombat payload.");
        if (!object || !object.fishing) return;

        Object.assign(object.fishing, { isFighting: true, time, fishHp: maxFishHp, maxFishHp, mode, lureType });
    }

    protected onFishingHpRegen(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const time = packet.d(), fishHp = packet.d(), mode = packet.c(), isGoodUse = packet.c() !== 0, animation = packet.c(), penalty = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid ExFishingHpRegen payload.");
        if (!object || !object.fishing) return; // Broadcast: a fisher seen mid-fight never sent us ExFishingStart.

        Object.assign(object.fishing, { isFighting: true, time, fishHp, mode, isGoodUse, animation, penalty });
    }

    protected onShowQuestMark(packet: PacketReader) {
        const questId = packet.d();

        if (questId <= 0 || packet.getRemaining()) throw new Error("Invalid ExShowQuestMark payload.");

        this.questMarkId = questId;
    }

    protected onOpenMPCC(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExOpenMPCC payload.");

        this.isInCommandChannel = true;
    }

    protected onCloseMPCC(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExCloseMPCC payload.");

        this.isInCommandChannel = false;
        this.commandChannel = null;
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
    }

    protected onOlympiadMatchEnd(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExOlympiadMatchEnd payload.");

        this.olympiadUsers.clear();
        this.olympiadEffects.clear();
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
    public procureCrops(items: ProcureCropRequest_T[]) { if (this.inWorld) this.game.requestProcureCropList(items); }
    public setManorSeeds(manorId: number, items: SeedSettingRequest_T[]) { if (this.inWorld) this.game.requestSetSeed(manorId, items); }
    public setManorCrops(manorId: number, items: CropSettingRequest_T[]) { if (this.inWorld) this.game.requestSetCrop(manorId, items); }
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
        if (this.resolveNextTick) {
            const resolve = this.resolveNextTick;

            this.nextTick = this.resolveNextTick = null;
            resolve();
        }

        if (this.lobby) this.lobby.tick(deltaTime);
        if (this.lobby && this.ui.isLobbyVisible()) this.ui.setPawnLabels(this.lobby.getPawnLabels(this.characters, this.ui.getScreenCanvas().width, this.ui.getScreenCanvas().height));
        if (!this.inWorld) return;
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

        for (const object of this.objects.values()) {
            const actor = object.actor;

            if (!actor || !actor.parent || !object.name) continue;

            let parent = actor;

            while (parent && parent.visible) parent = parent.parent as BaseActor;
            if (parent) continue;

            const isTarget = object.objectId === this.targetId, isMouseTarget = actor === mouseTarget;

            if (!isTarget && !isMouseTarget && Math.trunc(actor.position.distanceTo(player.position)) >= NAMEPLATE_DISTANCE) continue; // FDynamicActor::Render branch C: retail l2.ini [CharacterDisplay] Name=true, Dist=1000.

            plates.push({ actor, name: object.name, title: object.title, isNpc: object.kind === "npc", isSummon: object.isSummon, isDead: object.isDead, karma: object.karma, pvpFlag: object.pvpFlag, recommendations: object.recommendations, nameColor: object.nameColor, isTarget, isMouseTarget });
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
