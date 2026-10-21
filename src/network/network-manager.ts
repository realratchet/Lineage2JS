import NetworkSession, { GMTransferPhase_T } from "./network-session";
import NetworkActors, { type NetObject_T } from "./network-actors";
import NetworkMovement, { tmpVehicleOrigin } from "./network-movement";
import NetworkCombat from "./network-combat";
import NetworkItems from "./network-items";
import NetworkCommunity from "./network-community";
import { Raycaster, Vector3, type Object3D } from "three";
import BaseActor from "../base-actor";
import type { CharacterCreate_T } from "./game-client";
import type { GameGUI_T, Nameplate_T } from "../nwindow/nconsole-wnd";
import getCommandTokens, { CommandType_T, ActionType_T } from "./command-parser";
import MacroExecutor from "./macro-executor";
import Vehicle from "../objects/vehicle";
import GroundPickup from "../objects/ground-pickup";
import * as GamePackets from "./game-packets";
import PawnFishingComponent from "../objects/components/pawn-fishing-component";
import PawnCubicComponent from "../objects/components/pawn-cubic-component";
import PawnAbnormalComponent from "../objects/components/pawn-abnormal-component";
import { getProperty } from "../ue-script/vm";
import PacketReader from "./packet-reader";
import type { PawnCreateSelection_T } from "../nwindow/nc-pawn-create-wnd";
import type { IEngineComponent } from "../game/components";
import type GameManager from "../game/game-manager";
import type MovableObject from "../objects/movable-object";
import type { ICollidable } from "../objects/objects";
import { getDistance } from "./network-location";

const VALIDATE_POSITION_INTERVAL = 1000;

const STUCK_INTERVAL = 600;

const STUCK_DISTANCE = 2;

const STOP_SNAP_DISTANCE = 32;

export class NetworkManager implements IEngineComponent<GameManager> {
    public readonly session = new NetworkSession(this);
    public readonly actors = new NetworkActors(this);
    public readonly movement = new NetworkMovement(this);
    public readonly combat = new NetworkCombat(this);
    public readonly items = new NetworkItems(this);
    public readonly community = new NetworkCommunity(this);
    protected manGame: GameManager;
    public ui: GameGUI_T = null;
    protected gnoCategory = 0;
    protected gnoObjectId = -1;
    protected gnoElapsed = 0;
    protected nextTargetLock = false;
    public readonly macroExecutor = new MacroExecutor(this, this.items.macros, this.actors.objects, this.items.shortcuts);
    protected nextTick: Promise<void> = null;
    protected resolveNextTick: () => void = null;

    public setParent(parent: GameManager): this { this.manGame = parent; return this; }
    public getParent(): GameManager { return this.manGame; }
    public getGameClient() { return this.session.game; }
    public isInWorld() { return this.actors.inWorld; }
    public isWorldLoading() { return this.actors.inWorld && this.ui.screen === "loading"; }
    public isPlayingReplay() { return !!this.session.game?.isPlayingReplay(); }

    public getReplayDeltaTime(deltaTime: number): number | null {
        if (!this.isPlayingReplay()) return deltaTime;
        if (this.session.game.isReplayPaused()) return null;

        return Math.fround(Math.fround(deltaTime / 1000) * (this.session.replayLoading ? 1 : this.session.game.getReplayPlaySpeed())) * 1000;
    }

    public inputReplay(key: number, action: number): boolean {
        if (!this.isPlayingReplay()) return false;
        if (key !== 27) return this.session.game.inputReplay(key, action);
        if (action !== 1 && action !== 3) return false;
        if (action === 3) void this.session.stopReplayPlayback();

        return true;
    }

    public getTargetId() {
        const user = this.actors.objects.get(this.actors.userId);

        return user ? user.selectedId : 0;
    }

    public showLogin(url: string) { return this.session.showLogin(url); }
    public connectLogin(account: string, password: string) { return this.session.connectLogin(account, password); }
    public cancelLogin() { return this.session.cancelLogin(); }
    public connectGame(serverId: number) { return this.session.connectGame(serverId); }
    public relogin() { return this.session.relogin(); }
    public pickLobbyPawn(actor: BaseActor) { return this.session.pickLobbyPawn(actor); }
    public previewCharacter(index: number) { return this.session.previewCharacter(index); }
    public cancelCreate() { return this.session.cancelCreate(); }
    public previewCreate(selection: PawnCreateSelection_T) { return this.session.previewCreate(selection); }
    public rotateCreatePreview(direction: number) { return this.session.rotateCreatePreview(direction); }
    public zoomCreatePreview(isIn: boolean) { return this.session.zoomCreatePreview(isIn); }
    public selectCharacter(slot: number) { return this.session.selectCharacter(slot); }
    public startGMServerTransfer(serverId: number) { return this.session.startGMServerTransfer(serverId); }
    public requestNewCharacter() { return this.session.requestNewCharacter(); }
    public createCharacter(info: CharacterCreate_T) { return this.session.createCharacter(info); }
    public deleteCharacter(slot: number) { return this.session.deleteCharacter(slot); }
    public restoreCharacter(slot: number) { return this.session.restoreCharacter(slot); }

    public say(text: string, type: GamePackets.Say2_T, target: string = null) { this.session.game.say2(text, type, target); }

    public execCommand(text: string, isShift: boolean = false) {
        if (!this.actors.inWorld) return;
        if (text.startsWith("//")) { this.sendBypassBuildCmd(text.slice(2)); return; }
        if (!text.startsWith("/")) return;

        const tokens = getCommandTokens(text), strings = this.ui.getStrings();
        const entry = Object.entries(strings.commands).find(([, name]) => `/${name.toLowerCase()}` === tokens[0].toLowerCase());

        if (!entry) return; // NWindow 0x100599d9: unknown command goes directly to the return at 0x1005a16a.

        const type = Number(entry[0]);

        switch (type) {
            case CommandType_T.sit: case CommandType_T.stand: this.session.game.changeWaitType(type === CommandType_T.stand); break;
            case CommandType_T.walk: case CommandType_T.run: this.session.game.changeMoveType(type === CommandType_T.run); break;
            case CommandType_T.attack: case CommandType_T.attackforce: case CommandType_T.attackstand: this.useAction(2, type === CommandType_T.attackforce, type === CommandType_T.attackstand); break;
            case CommandType_T.trade: this.useAction(3); break;
            case CommandType_T.targetnext: this.useAction(4, false, isShift); break;
            case CommandType_T.pickup: this.useAction(5, false, isShift); break;
            case CommandType_T.assist: this.useAction(6, false, isShift); break;
            case CommandType_T.target: {
                if (tokens.length < 2) { this.ui.addSystemMessage(strings.systemMessages[1256], strings.systemMessageColors[1256]); break; }

                const name = tokens.slice(1).join(" ").toLowerCase();
                let target: NetObject_T = null;

                if (!name) break;

                for (const object of this.actors.objects.values()) {
                    if (object.name.toLowerCase() !== name) continue;

                    target = object;
                    if (!object.isSummon) break; // Engine 0x104204cd: first non-summon match, otherwise the last match.
                }

                if (target && target.actor && this.manGame.getComponent("render").player) this.requestAction(target.actor, isShift);
                break;
            }
            case CommandType_T.partymatching: this.ui.openPartyMatch(); break;
            case CommandType_T.socialhello: case CommandType_T.socialvictory: case CommandType_T.socialcharge: this.session.game.requestSocialAction(type - 19); break;
            case CommandType_T.socialno: case CommandType_T.socialyes: case CommandType_T.socialbow: case CommandType_T.socialunaware: case CommandType_T.socialwaitinga: case CommandType_T.sociallaugh: this.session.game.requestSocialAction(type - 41); break;
            case CommandType_T.socialapplause: case CommandType_T.socialdance: case CommandType_T.socialsad: this.session.game.requestSocialAction(type - 43); break;
            case CommandType_T.sitstand: this.useAction(0, this.ui.getInputModifiers()[0], isShift); break;
            case CommandType_T.start_videorecording: this.session.startReplayRecording(); break;
            case CommandType_T.end_videorecording: this.session.stopReplayRecording(); break;
            case CommandType_T.startend_videorecording: this.useAction(55); break;
            case CommandType_T.useskill: case CommandType_T.useskillforce: case CommandType_T.useskillstand: {
                if (tokens.length < 2) { this.ui.addSystemMessage(strings.systemMessages[1256], strings.systemMessageColors[1256]); break; }

                const id = strings.skillCommands[tokens.slice(1).join(" ").toLowerCase()];

                if (id) this.session.game.requestMagicSkillUse(id, type === CommandType_T.useskillforce, type === CommandType_T.useskillstand);
                break;
            }
            case CommandType_T.useshortcut: case CommandType_T.useshortcutforce: case CommandType_T.useshortcutstand: {
                const page = parseInt(tokens[1], 10), slot = parseInt(tokens[2], 10);

                if (page >= 1 && page <= 10 && slot >= 1 && slot <= 12) this.items.useShortCut(page - 1, slot - 1, type === CommandType_T.useshortcutforce, type === CommandType_T.useshortcutstand);
                break;
            }
            case CommandType_T.loc: case CommandType_T.unstuck: case CommandType_T.Time: case CommandType_T.partyinfo: case CommandType_T.enemylist: case CommandType_T.attackerlist: case CommandType_T.clanwarlist: case CommandType_T.channeldelete: case CommandType_T.channelleave: case CommandType_T.channelinfo: case CommandType_T.clanpenalty: case CommandType_T["View Current Results"]: this.session.game.requestUserCommand(type); break;
            default: debugger; break;
        }
    }

    public sendBypassBuildCmd(command: string) { this.session.game.sendBypassBuildCmd(command); }
    public bypass(command: string) { this.session.game.requestBypassToServer(command); }
    public link(link: string) { this.session.game.requestLinkHtml(link); }
    public requestRestartPoint(type: number) { this.session.game.requestRestartPoint(type); }
    public cancelTarget() { this.session.game.requestTargetCanceld(); }

    public requestMoveTo(point: Vector3, actor: ICollidable = null) {
        const player = this.manGame.getComponent("render").player;

        if (actor && (actor as Vehicle).isVehicle) {
            this.movement.requestMoveInVehicle(actor as Vehicle, point);
            return;
        }

        this.session.game.moveBackwardToLocation(point, player.position);
    }

    public getActorObjectId(actor: Object3D | null): number {
        if (!actor) return 0;
        const object = this.actors.findObjectByActor(actor);
        if (object) return object.objectId;

        for (const [objectId, mover] of this.actors.doors) if (mover === actor) return objectId;

        const properties = (actor as any).scriptProperties;
        return properties instanceof Map ? this.actors.staticObjects.get(getProperty(actor as any, "L2ServerObjectRealID") as number) ?? 0 : 0;
    }

    public requestAction(actor: Object3D | null, isShift: boolean = false) {
        const objectId = this.getActorObjectId(actor);
        if (!objectId) return false;

        this.session.game.action(objectId, this.manGame.getComponent("render").player.position, isShift);

        return true;
    }

    public requestPetAction(objectId: number, isShift: boolean) {
        if (objectId <= 0 || !this.actors.objects.get(this.actors.userId)) return;

        this.session.game.action(objectId, this.manGame.getComponent("render").player.position, isShift);
    }

    public getPickup(raycaster: Raycaster, maxDistance: number): GroundPickup {
        let nearest: GroundPickup = null;

        for (const pickup of this.actors.pickups.values()) {
            for (let part = pickup; part; part = part.getNextPickup()) {
                const distance = part.getPickDistance(raycaster);

                if (distance >= maxDistance) continue;

                nearest = part;
                maxDistance = distance;
            }
        }

        return nearest;
    }

    public isMouseOverUI(x: number, y: number) { return this.ui ? this.ui.isMouseOver(x, y) : false; }

    public getMouseCursor(actor: Object3D): number {
        if (!this.actors.inWorld) return 0;

        const object = actor ? this.actors.findObjectByActor(actor) : null;

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

        this.session.game.action(nearest.objectId, this.manGame.getComponent("render").player.position, isShift);
        return true;
    }

    public getNextEnemy(radius: number, excluded: number): NetObject_T { // Engine 0x10421350.
        const player = this.actors.objects.get(this.actors.userId);

        if (!player || !player.actor) return null;
        if (this.gnoCategory !== 2) {
            this.gnoCategory = 2;
            this.gnoObjectId = -1;
            this.gnoElapsed = 0;
        }

        const previous = this.actors.objects.get(this.gnoObjectId);
        const distance = previous && previous.actor ? getDistance(previous.actor.position, player.actor.position) : -1;
        const lower = distance > 0 ? distance : 0;
        let nearest: NetObject_T = null, next: NetObject_T = null, nearestDistance = radius, nextDistance = radius;

        for (const object of this.actors.objects.values()) {
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

    protected getNearestItem(radius: number, excluded: number, sourceId: number = this.actors.userId): GroundPickup { // Engine 0x104211c0 / pet 0x103f9980.
        const player = this.actors.objects.get(sourceId);

        if (!player || !player.actor) return null;

        let nearest: GroundPickup = null, nearestDistance = radius;

        for (const pickup of this.actors.pickups.values()) {
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

    public leaveWorld() {
        const render = this.manGame.getComponent("render");

        this.session.stopReplayRecording();
        this.actors.worldLoad = null;
        for (const objectId of this.movement.riders.keys()) this.movement.endRide(objectId);

        render.clearViewportWindowParam();
        render.setZoneMusicEnabled(false);

        for (const object of this.actors.objects.values()) {
            object.isRemoved = true;
            object.resolveActor(null);

            if (object.actor && object.kind !== "user") render.removePawn(object.actor);
        }

        this.actors.objects.clear();
        render.clearRetainedSkillVisuals();
        if (this.actors.worldLevel) {
            const level = this.actors.worldLevel;

            if (render.player.scriptProperties) render.player.setUnrealScriptProperty("Level", null);
            render.setLevel(null);
            this.actors.worldLevel = null;
            this.manGame.getComponent("asset").unloadAlwaysLoaded(render, `${level.index.x}_${level.index.y}`, level);
        }
        this.actors.doors.clear();
        this.actors.doorPositions.clear();
        this.actors.staticObjects.clear();
        this.actors.appearances.clear();
        this.actors.userInfo = null;
        const cubics = render.player.findComponent<PawnCubicComponent>("pawnCubic");

        if (cubics) render.player.removeComponent(cubics);
        const abnormal = render.player.findComponent<PawnAbnormalComponent>("pawnAbnormal");

        if (abnormal) render.player.removeComponent(abnormal);
        const fishing = render.player.findComponent<PawnFishingComponent>("pawnFishing");

        if (fishing) render.player.removeComponent(fishing);
        for (const pickup of this.actors.pickups.values()) render.removePickup(pickup);
        this.actors.pickups.clear();
        render.clearDice();
        this.gnoCategory = this.gnoElapsed = 0;
        this.gnoObjectId = -1;
        this.items.inventory.clear();
        this.items.shortcuts.clear();
        this.items.autoSoulShots.clear();
        this.ui.clearShortCuts();
        this.ui.setInventory([]);
        this.items.skills.clear();
        this.ui.setSkills([]);
        this.items.questStates.clear();
        this.ui.setQuestStates([]);
        this.items.hennaStatus = null;
        this.ui.setHenna(null);
        this.items.isMacroListComplete = true;
        this.items.macroListReceived = 0;
        this.items.macros.clear();
        this.macroExecutor.clear();
        this.ui.setMacros([]);
        this.community.friends.clear();
        this.community.partyMembers.clear();
        this.community.partyPositions.clear();
        this.ui.setMapPartyMembers(this.community.partyMembers, this.community.partyPositions, this.actors.userId);
        this.community.partyInvite = null;
        this.community.pledgeInvite = null;
        this.community.friendInvite = null;
        this.community.partyJoinResult = -1;
        this.community.pledgeJoinId = 0;
        this.community.partyLeaderId = 0;
        this.community.partyLootDistribution = 0;
        this.community.clanInfo = null;
        this.community.pledgeInfos.clear();
        this.community.clanMembers.clear();
        this.ui.setClan(null);
        this.ui.clearClanMembers();
        this.items.aquireSkillFishing = false;
        this.items.aquireSkills = [];
        this.items.aquireSkillInfo = null;
        this.items.tradePartnerId = 0;
        this.items.tradeRequestId = 0;
        this.items.tradeOwnItems.length = 0;
        this.items.tradeOtherItems.length = 0;
        this.items.tradeAvailableItems.length = 0;
        this.items.tradeDone = 0;
        this.items.shopSellMoney = 0;
        this.items.shopSellNpcId = 0;
        this.items.shopSellItems.length = 0;
        this.items.shopBuyMoney = 0;
        this.items.shopBuyListId = 0;
        this.items.shopBuyItems.length = 0;
        this.items.storageMaxCount = null;
        this.items.etcStatus = null;
        this.community.signsSky = 0;
        this.actors.petStatusType = -1;
        this.actors.deletedPetId = 0;
        Object.assign(this.actors.petInfo, { objectId: -1, name: "", field60: 0, isMountable: false });
        this.movement.isMounted = false;
        this.ui.setMountable(false);
        this.items.petInventory.clear();
        this.actors.petRemainTime = null;
        this.items.abnormalStatuses.length = 0;
        this.items.shortBuff = null;
        this.community.allyInvite = null;
        this.community.pledgePower = new Uint8Array(32);
        this.community.pledgeWarStart = null;
        this.community.pledgeWarStop = null;
        this.community.pledgeWarSurrender = null;
        this.community.pledgeCrests.clear();
        this.community.pledgeLargeCrests.clear();
        this.community.clanLargeCrestIds.clear();
        this.community.allyCrests.clear();
        this.items.warehouseDeposit = null;
        this.items.warehouseWithdraw = null;
        this.items.privateStoreManageSell = null;
        this.items.privateStoreSell = null;
        this.items.privateStoreManageBuy = null;
        this.items.privateStoreBuy = null;
        this.items.privateStoreSellMsgs.clear();
        this.items.privateStoreBuyMsgs.clear();
        this.items.packageTargets.clear();
        this.items.packageSendable = null;
        this.items.multiSell = null;
        this.items.shopPreview = null;
        this.items.shopPreviewItems = null;
        this.items.seedShop = null;
        this.items.cropProcure = null;
        for (const objectId of this.movement.vehicles.keys()) this.movement.removeVehicle(objectId);
        this.movement.mounts.clear();
        this.movement.observation = null;
        this.movement.specialCamera = null;
        this.movement.cameraMode = 0;
        this.community.questArrowDestination = null;
        this.manGame.getComponent("render").questArrow.reset();
        this.community.mapMarkers.length = 0;
        this.ui.setMapMarkers(this.community.mapMarkers);
        this.community.radarMarkers.length = 0;
        this.community.townMap = null;
        this.community.calculatorId = 0;
        this.community.xmasSealItemId = 0;
        this.actors.dice = null;
        this.community.monRace = null;
        this.community.ssqStatus.clear();
        this.community.clanHallDecoration.clear();
        this.community.siegeInfo = null;
        this.community.siegeAttackers = null;
        this.community.siegeDefenders = null;
        this.manGame.getComponent("render").player.visible = true;
        this.items.recipeBook = null;
        this.items.recipeItemMakeInfo = null;
        this.items.recipeShopManageList = null;
        this.items.recipeShopSellList = null;
        this.items.recipeShopItemInfo = null;
        this.items.recipeShopMessages.clear();
        this.items.hennaEquipList = null;
        this.items.hennaItemInfo = null;
        this.community.partyMatchRooms = [];
        this.community.partyMatchPage = 1;
        this.community.partyMatchDetail = null;
        this.community.partyEffects.clear();
        this.community.tutorialQuestionMarks.clear();
        this.community.tutorialClientEvents = 0;
        this.community.gmCharacterInfo = null;
        this.community.gmPledgeInfo = null;
        this.community.gmSkillInfo = null;
        this.community.gmQuestList = null;
        this.community.gmItemList = null;
        this.community.gmWarehouseList = null;
        this.community.gmHennaStatus = null;
        this.community.snoops.clear();
        this.items.enchantSkills = [];
        this.items.enchantSkillInfo = null;
        this.community.eventMatchMessageType = -1;
        this.community.questMarkId = 0;
        this.community.hasNewMail = false;
        this.community.heroes = [];
        this.community.partyRoomMode = -1;
        this.community.partyRoomMembers.clear();
        this.community.isInCommandChannel = false;
        this.community.commandChannel = null;
        this.ui.closeCommandChannel();
        this.community.commandChannelInviter = null;
        this.community.olympiadMode = 0;
        this.community.olympiadUsers.clear();
        this.community.olympiadEffects.clear();
        this.items.manors = [];
        this.items.manorSeedInfo = null;
        this.items.manorCropInfo = null;
        this.items.manorDefaultCrops = [];
        this.items.manorSeedSettings = null;
        this.items.manorCropSettings = null;
        this.items.manorSellCrops = null;
        this.items.manorProcureCropDetail = null;
        this.ui.hideWorld();
        this.actors.inWorld = false;
        this.actors.teleportGeneration++;
        this.actors.teleportInfoPending = false;
        this.actors.userId = 0;
    }

    public onPacket(opcode: GamePackets.GameServerPacket_T, packet: PacketReader) {
        switch (opcode) {
            case GamePackets.GameServerPacket_T.KeyPacket:
                this.items.inventoryOrderNamespace = packet.d(); // Engine 0x103fe0ba, NWindow 0x10065d4d.
                this.session.game.authLogin(this.session.account, this.session.sessionKey);
                break;
            case GamePackets.GameServerPacket_T.AuthLoginFail: {
                const message = `Game server refused the session (reason ${packet.d()}).`;

                if (this.session.gmTransfer) this.session.gmTransfer.error = message;
                this.ui.showMessage(message);
                break;
            }
            case GamePackets.GameServerPacket_T.CharSelectInfo:
                this.session.login.close();
                this.session.characters = GamePackets.readCharSelectInfo(packet).slice(0, 7);
                void this.session.showLobby();
                break;
            case GamePackets.GameServerPacket_T.CharTemplates:
                this.session.templates = GamePackets.readCharTemplates(packet);
                this.ui.showCreateCharacter(this.session.templates);
                this.session.lobby.showCreate();
                break;
            case GamePackets.GameServerPacket_T.CharCreateOk: this.session.onCharCreateOk(packet); break;
            case GamePackets.GameServerPacket_T.CharCreateFail: this.ui.showMessage(this.ui.getSystemMessage([128, 77, 79, 80, 204][packet.d()])); break; // NWindow 0x100658f0
            case GamePackets.GameServerPacket_T.CharDeleteOk: this.session.onCharDeleteOk(packet); break;
            case GamePackets.GameServerPacket_T.CharDeleteFail: this.ui.showMessage(this.ui.getSystemMessage([undefined, 306, 541, 540][packet.d()])); break; // NWindow 0x10065b40
            case GamePackets.GameServerPacket_T.ActionFailed: this.combat.onActionFailed(); break;
            case GamePackets.GameServerPacket_T.CharSelected: this.session.onCharSelected(packet); break;
            case GamePackets.GameServerPacket_T.UserInfo: this.actors.onUserInfo(packet); break;
            case GamePackets.GameServerPacket_T.ItemList: this.items.onItemList(packet); break;
            case GamePackets.GameServerPacket_T.InventoryUpdate: this.items.onInventoryUpdate(packet); break;
            case GamePackets.GameServerPacket_T.TradeStart: this.items.onTradeStart(packet); break;
            case GamePackets.GameServerPacket_T.TradeOwnAdd: this.items.onTradeOwnAdd(packet); break;
            case GamePackets.GameServerPacket_T.TradeOtherAdd: this.items.onTradeOtherAdd(packet); break;
            case GamePackets.GameServerPacket_T.SendTradeDone: this.items.onSendTradeDone(packet); break;
            case GamePackets.GameServerPacket_T.SendTradeRequest: this.items.onSendTradeRequest(packet); break;
            case GamePackets.GameServerPacket_T.TradeUpdate: this.items.onTradeUpdate(packet); break;
            case GamePackets.GameServerPacket_T.SkillList: this.items.onSkillList(packet); break;
            case GamePackets.GameServerPacket_T.SkillCoolTime: this.items.onSkillCoolTime(packet); break;
            case GamePackets.GameServerPacket_T.QuestList: this.items.onQuestList(packet); break;
            case GamePackets.GameServerPacket_T.HennaInfo: this.items.onHennaInfo(packet); break;
            case GamePackets.GameServerPacket_T.SendMacroList: this.items.onSendMacroList(packet); break;
            case GamePackets.GameServerPacket_T.EtcStatusUpdate: this.items.onEtcStatusUpdate(packet); break;
            case GamePackets.GameServerPacket_T.SignsSky: this.community.onSignsSky(packet); break;
            case GamePackets.GameServerPacket_T.FriendList: this.community.onFriendList(packet); break;
            case GamePackets.GameServerPacket_T.FriendRecvMsg: this.community.onFriendRecvMsg(packet); break;
            case GamePackets.GameServerPacket_T.MagicEffectIcons: this.items.onMagicEffectIcons(packet); break;
            case GamePackets.GameServerPacket_T.ShortBuffStatusUpdate: this.items.onShortBuffStatusUpdate(packet); break;
            case GamePackets.GameServerPacket_T.CharInfo: this.actors.onCharInfo(packet); break;
            case GamePackets.GameServerPacket_T.NpcInfo: this.actors.onNpcInfo(packet); break;
            case GamePackets.GameServerPacket_T.PetInfo: this.actors.onPetInfo(packet); break;
            case GamePackets.GameServerPacket_T.PetItemList: this.items.onPetItemList(packet); break;
            case GamePackets.GameServerPacket_T.PetInventoryUpdate: this.items.onPetInventoryUpdate(packet); break;
            case GamePackets.GameServerPacket_T.PetStatusUpdate: this.actors.onPetStatusUpdate(packet); break;
            case GamePackets.GameServerPacket_T.PetDelete: this.actors.onPetDelete(packet); break;
            case GamePackets.GameServerPacket_T.SpawnItem: void this.actors.onSpawnItem(packet, false); break;
            case GamePackets.GameServerPacket_T.DropItem: void this.actors.onSpawnItem(packet, true); break;
            case GamePackets.GameServerPacket_T.GetItem: this.actors.onGetItem(packet); break;
            case GamePackets.GameServerPacket_T.DeleteObject: this.actors.removeObject(packet.d()); break;
            case GamePackets.GameServerPacket_T.CharMoveToLocation: this.movement.onMoveToLocation(packet); break;
            case GamePackets.GameServerPacket_T.MoveToPawn: this.movement.onMoveToPawn(packet); break;
            case GamePackets.GameServerPacket_T.StopMove: this.movement.onStopMove(packet); break;
            case GamePackets.GameServerPacket_T.ValidateLocation: this.movement.onValidateLocation(packet); break;
            case GamePackets.GameServerPacket_T.BeginRotation: this.movement.onBeginRotation(packet); break;
            case GamePackets.GameServerPacket_T.StopRotation: this.movement.onStopRotation(packet); break;
            case GamePackets.GameServerPacket_T.TeleportToLocation: this.movement.onTeleport(packet); break;
            case GamePackets.GameServerPacket_T.Attack: this.combat.onAttack(packet); break;
            case GamePackets.GameServerPacket_T.MagicSkillUse: this.combat.onMagicSkillUse(packet); break;
            case GamePackets.GameServerPacket_T.MagicSkillCanceld: {
                const objectId = packet.d(), object = this.actors.objects.get(objectId);

                if (object && object.actor === this.manGame.getComponent("render").player) this.macroExecutor.notifySkill(0, 1);
                this.combat.stopSkill(objectId);
                break;
            }
            case GamePackets.GameServerPacket_T.MagicSkillLaunched: this.combat.onMagicSkillLaunched(packet); break;
            case GamePackets.GameServerPacket_T.Die: this.combat.onDie(packet); break;
            case GamePackets.GameServerPacket_T.Revive: this.combat.onRevive(packet.d()); break;
            case GamePackets.GameServerPacket_T.Earthquake: void this.combat.onEarthquake(packet); break;
            case GamePackets.GameServerPacket_T.ChangeMoveType: this.movement.onChangeMoveType(packet.d(), packet.d() !== 0, packet.d()); break;
            case GamePackets.GameServerPacket_T.ChangeWaitType: this.combat.onChangeWaitType(packet); break;
            case GamePackets.GameServerPacket_T.ChairSit: this.movement.onChairSit(packet); break;
            case GamePackets.GameServerPacket_T.AutoAttackStart: this.combat.onCombatState(packet.d(), true); break;
            case GamePackets.GameServerPacket_T.AutoAttackStop: this.combat.onCombatState(packet.d(), false); break;
            case GamePackets.GameServerPacket_T.SocialAction: this.combat.onSocialAction(packet.d(), packet.d()); break;
            case GamePackets.GameServerPacket_T.MyTargetSelected: {
                const targetId = packet.d(), levelDifference = (packet.h() << 16) >> 16;

                this.nextTargetLock = false;
                this.combat.setTarget(targetId, levelDifference);
                this.macroExecutor.notifyCommand([CommandType_T.target, CommandType_T.targetnext, CommandType_T.assist], Math.fround(0.001));
                break;
            }
            case GamePackets.GameServerPacket_T.PartyMemberPosition: this.community.onPartyMemberPosition(packet); break;
            case GamePackets.GameServerPacket_T.TargetSelected: this.combat.onTargetSelected(packet, true); break;
            case GamePackets.GameServerPacket_T.TargetUnselected: this.combat.onTargetSelected(packet, false); break;
            case GamePackets.GameServerPacket_T.StatusUpdate: this.community.onStatusUpdate(packet); break;
            case GamePackets.GameServerPacket_T.CreatureSay: this.community.onCreatureSay(packet); break;
            case GamePackets.GameServerPacket_T.EquipUpdate: this.items.onEquipUpdate(packet); break;
            case GamePackets.GameServerPacket_T.DoorInfo: this.actors.onDoorInfo(packet); break;
            case GamePackets.GameServerPacket_T.DoorStatusUpdate: this.actors.onDoorStatusUpdate(packet); break;
            case GamePackets.GameServerPacket_T.PartySmallWindowAll: this.community.onPartySmallWindowAll(packet); break;
            case GamePackets.GameServerPacket_T.PartySmallWindowAdd: this.community.onPartySmallWindowAdd(packet); break;
            case GamePackets.GameServerPacket_T.PartySmallWindowDeleteAll: this.community.onPartySmallWindowDeleteAll(packet); break;
            case GamePackets.GameServerPacket_T.PartySmallWindowDelete: this.community.onPartySmallWindowDelete(packet); break;
            case GamePackets.GameServerPacket_T.PartySmallWindowUpdate: this.community.onPartySmallWindowUpdate(packet); break;
            case GamePackets.GameServerPacket_T.AskJoinPledge: this.community.onAskJoinPledge(packet); break;
            case GamePackets.GameServerPacket_T.JoinPledge: this.community.onJoinPledge(packet); break;
            case GamePackets.GameServerPacket_T.AskJoinParty: this.community.onAskJoinParty(packet); break;
            case GamePackets.GameServerPacket_T.JoinParty: this.community.onJoinParty(packet); break;
            case GamePackets.GameServerPacket_T.AskJoinFriend: this.community.onAskJoinFriend(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowMemberListAll: this.community.onPledgeShowMemberListAll(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowMemberListUpdate: this.community.onPledgeShowMemberListUpdate(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowMemberListAdd: this.community.onPledgeShowMemberListAdd(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowMemberListDelete: this.community.onPledgeShowMemberListDelete(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowMemberListDeleteAll: this.community.onPledgeShowMemberListDeleteAll(packet); break;
            case GamePackets.GameServerPacket_T.PledgeInfo: this.community.onPledgeInfo(packet); break;
            case GamePackets.GameServerPacket_T.ServerObjectInfo: this.actors.onServerObjectInfo(packet); break;
            case GamePackets.GameServerPacket_T.PledgeShowInfoUpdate: this.community.onPledgeShowInfoUpdate(packet); break;
            case GamePackets.GameServerPacket_T.AquireSkillList: this.items.onAquireSkillList(packet); break;
            case GamePackets.GameServerPacket_T.AquireSkillInfo: this.items.onAquireSkillInfo(packet); break;
            case GamePackets.GameServerPacket_T.AquireSkillDone: this.items.onAquireSkillDone(packet); break;
            case GamePackets.GameServerPacket_T.NpcSay: this.community.onNpcSay(packet); break;
            case GamePackets.GameServerPacket_T.PetStatusShow: this.actors.onPetStatusShow(packet); break;
            case GamePackets.GameServerPacket_T.SetSummonRemainTime: this.actors.onSetSummonRemainTime(packet); break;
            case GamePackets.GameServerPacket_T.SellList: this.items.onSellList(packet); break;
            case GamePackets.GameServerPacket_T.BuyList: this.items.onBuyList(packet); break;
            case GamePackets.GameServerPacket_T.PlaySound: void this.combat.onPlaySound(packet); break;
            case GamePackets.GameServerPacket_T.StaticObject: this.movement.onStaticObject(packet); break;
            case GamePackets.GameServerPacket_T.ShowMiniMap: this.ui.showMap(packet.d()); break;
            case GamePackets.GameServerPacket_T.TutorialShowHtml: this.ui.showHtml(packet.S()); break;
            case GamePackets.GameServerPacket_T.TutorialCloseHtml: this.ui.hideHtml(); break;
            case GamePackets.GameServerPacket_T.NicknameChanged: this.community.onNicknameChanged(packet); break;
            case GamePackets.GameServerPacket_T.PledgeStatusChanged: this.community.onPledgeStatusChanged(packet); break;
            case GamePackets.GameServerPacket_T.RelationChanged: this.community.onRelationChanged(packet); break;
            case GamePackets.GameServerPacket_T.SetupGauge: this.ui.setupGauge(packet.d(), packet.d(), packet.d()); break;
            case GamePackets.GameServerPacket_T.ShowBoard: this.community.onShowBoard(packet); break;
            case GamePackets.GameServerPacket_T.ChooseInventoryItem: this.items.onChooseInventoryItem(packet); break;
            case GamePackets.GameServerPacket_T.EnchantResult: this.items.onEnchantResult(packet); break;
            case GamePackets.GameServerPacket_T.SystemMessage: this.community.onSystemMessage(packet); break;
            case GamePackets.GameServerPacket_T.ConfirmDlg: this.community.onConfirmDlg(packet); break;
            case GamePackets.GameServerPacket_T.NpcHtmlMessage: this.community.onNpcHtmlMessage(packet); break;
            case GamePackets.GameServerPacket_T.ShortCutInit:
                this.items.shortcuts.clear();
                this.ui.clearShortCuts();

                for (let i = 0, count = packet.d(); i < count; i++) this.items.setShortCut(GamePackets.readShortCut(packet));
                break;
            case GamePackets.GameServerPacket_T.ShortCutRegister: this.items.setShortCut(GamePackets.readShortCut(packet)); break;
            case GamePackets.GameServerPacket_T.ManagePledgePower: this.community.onManagePledgePower(packet); break;
            case GamePackets.GameServerPacket_T.StartPledgeWar: this.community.pledgeWarStart = GamePackets.readPledgeWar(packet, true); break;
            case GamePackets.GameServerPacket_T.StopPledgeWar: this.community.pledgeWarStop = GamePackets.readPledgeWar(packet, false); break;
            case GamePackets.GameServerPacket_T.SurrenderPledgeWar: this.community.pledgeWarSurrender = GamePackets.readPledgeWar(packet, false); break;
            case GamePackets.GameServerPacket_T.PledgeCrest: this.community.onPledgeCrest(packet); break;
            case GamePackets.GameServerPacket_T.AskJoinAlly: this.community.onAskJoinAlly(packet); break;
            case GamePackets.GameServerPacket_T.AllyCrest: this.community.onAllyCrest(packet); break;
            case GamePackets.GameServerPacket_T.WareHouseDepositList: this.items.warehouseDeposit = GamePackets.readWarehouseList(packet); this.ui.showWarehouse(false, this.items.warehouseDeposit); break;
            case GamePackets.GameServerPacket_T.WareHouseWithdrawalList: this.items.warehouseWithdraw = GamePackets.readWarehouseList(packet); this.ui.showWarehouse(true, this.items.warehouseWithdraw); break;
            case GamePackets.GameServerPacket_T.WareHouseDone: this.items.onWareHouseDone(packet); break;
            case GamePackets.GameServerPacket_T.PrivateStoreManageListSell: this.items.onPrivateStoreManageListSell(packet); break;
            case GamePackets.GameServerPacket_T.PrivateStoreListSell: this.items.privateStoreSell = GamePackets.readPrivateStoreListSell(packet); this.ui.showPrivateStoreSell(this.items.privateStoreSell); break;
            case GamePackets.GameServerPacket_T.PrivateStoreMsgSell: this.items.onPrivateStoreMsg(packet, this.items.privateStoreSellMsgs); break;
            case GamePackets.GameServerPacket_T.PrivateStoreManageListBuy: this.items.onPrivateStoreManageListBuy(packet); break;
            case GamePackets.GameServerPacket_T.PrivateStoreListBuy: this.items.privateStoreBuy = GamePackets.readPrivateStoreListBuy(packet); this.ui.showPrivateStoreBuy(this.items.privateStoreBuy); break;
            case GamePackets.GameServerPacket_T.PrivateStoreMsgBuy: this.items.onPrivateStoreMsg(packet, this.items.privateStoreBuyMsgs); break;
            case GamePackets.GameServerPacket_T.PackageToList: this.items.onPackageToList(packet); break;
            case GamePackets.GameServerPacket_T.PackageSendableList: this.items.packageSendable = GamePackets.readPackageSendableList(packet); this.ui.showPackage(this.items.packageSendable); break;
            case GamePackets.GameServerPacket_T.MultiSellList: this.items.onMultiSellList(packet); break;
            case GamePackets.GameServerPacket_T.ShopPreviewList: this.items.shopPreview = GamePackets.readShopPreviewList(packet); this.ui.showPreviewShop(this.items.shopPreview); break;
            case GamePackets.GameServerPacket_T.ShopPreviewInfo: this.items.onShopPreviewInfo(packet); break;
            case GamePackets.GameServerPacket_T.BuyListSeed:
                this.items.seedShop = GamePackets.readBuyListSeed(packet);
                this.ui.showManorShop(this.items.seedShop, false);
                break;
            case GamePackets.GameServerPacket_T.SellListProcure:
                this.items.cropProcure = GamePackets.readSellListProcure(packet);
                this.ui.showManorShop(this.items.cropProcure, true);
                break;
            case GamePackets.GameServerPacket_T.VehicleInfo: this.movement.onVehicleLocation(packet, true); break;
            case GamePackets.GameServerPacket_T.OnVehicleCheckLocation: this.movement.onVehicleLocation(packet, false); break;
            case GamePackets.GameServerPacket_T.VehicleDeparture: this.movement.onVehicleDeparture(packet); break;
            case GamePackets.GameServerPacket_T.VehicleStarted: this.movement.onVehicleStarted(packet); break;
            case GamePackets.GameServerPacket_T.GetOnVehicle: this.movement.onGetOnVehicle(packet); break;
            case GamePackets.GameServerPacket_T.GetOffVehicle: this.movement.onGetOffVehicle(packet); break;
            case GamePackets.GameServerPacket_T.MoveToLocationInVehicle: this.movement.onMoveToLocationInVehicle(packet); break;
            case GamePackets.GameServerPacket_T.StopMoveInVehicle: this.movement.onStopMoveInVehicle(packet); break;
            case GamePackets.GameServerPacket_T.ValidateLocationInVehicle: this.movement.onValidateLocationInVehicle(packet); break;
            case GamePackets.GameServerPacket_T.Ride: this.movement.onRide(packet); break;
            case GamePackets.GameServerPacket_T.FlyToLocation: this.movement.onFlyToLocation(packet); break;
            case GamePackets.GameServerPacket_T.SpecialCamera: this.movement.specialCamera = GamePackets.readSpecialCamera(packet); break;
            case GamePackets.GameServerPacket_T.NormalCamera: this.movement.specialCamera = null; break; // OnNormalCamera 0x7473c0 -> ReleaseSpecialViewTarget.
            case GamePackets.GameServerPacket_T.CameraMode: this.movement.cameraMode = packet.d(); break;
            case GamePackets.GameServerPacket_T.ObservationMode: this.movement.onObservationMode(packet); break;
            case GamePackets.GameServerPacket_T.ObservationReturn: this.movement.onObservationReturn(packet); break;
            case GamePackets.GameServerPacket_T.RadarControl: this.community.onRadarControl(packet); break;
            case GamePackets.GameServerPacket_T.ShowTownMap: this.community.townMap = GamePackets.readTownMap(packet); this.ui.showTownMap(this.community.townMap); break;
            case GamePackets.GameServerPacket_T.ShowCalculator: this.community.calculatorId = packet.d(); break;
            case GamePackets.GameServerPacket_T.ShowXMasSeal: this.community.xmasSealItemId = packet.d(); break;
            case GamePackets.GameServerPacket_T.Dice:
                this.actors.dice = GamePackets.readDice(packet);
                void this.actors.onDice(this.actors.dice);
                break;
            case GamePackets.GameServerPacket_T.MonRaceInfo: this.community.monRace = GamePackets.readMonRaceInfo(packet); break;
            case GamePackets.GameServerPacket_T.SSQStatus: this.community.onSSQStatus(packet); break;
            case GamePackets.GameServerPacket_T.ClanHallDecoration: {
                const info = GamePackets.readClanHallDecoration(packet);
                this.community.clanHallDecoration.set(info.clanHallId, info);
                this.manGame.getComponent("render").updateClanHallDecorations();
                break;
            }
            case GamePackets.GameServerPacket_T.SiegeInfo: this.community.siegeInfo = GamePackets.readSiegeInfo(packet); break;
            case GamePackets.GameServerPacket_T.SiegeAttackerList: this.community.siegeAttackers = GamePackets.readSiegeClanList(packet, false); break;
            case GamePackets.GameServerPacket_T.SiegeDefenderList: this.community.siegeDefenders = GamePackets.readSiegeClanList(packet, true); break;
            case GamePackets.GameServerPacket_T.GameGuardQuery: this.community.onGameGuardQuery(packet); break;
            case GamePackets.GameServerPacket_T.RecipeBookItemList: this.items.recipeBook = GamePackets.readRecipeBookItemList(packet); this.ui.showRecipeBook(this.items.recipeBook); break;
            case GamePackets.GameServerPacket_T.RecipeItemMakeInfo: this.items.recipeItemMakeInfo = GamePackets.readRecipeItemMakeInfo(packet); this.ui.showRecipeManufacture(this.items.recipeItemMakeInfo); break;
            case GamePackets.GameServerPacket_T.RecipeShopManageList: this.items.recipeShopManageList = GamePackets.readRecipeShopManageList(packet); this.ui.showRecipeShopManage(this.items.recipeShopManageList); break;
            case GamePackets.GameServerPacket_T.RecipeShopSellList: this.items.recipeShopSellList = GamePackets.readRecipeShopSellList(packet); this.ui.showRecipeShopSellList(this.items.recipeShopSellList); break;
            case GamePackets.GameServerPacket_T.RecipeShopItemInfo: this.items.recipeShopItemInfo = GamePackets.readRecipeShopItemInfo(packet); this.ui.showRecipeShopItemInfo(this.items.recipeShopItemInfo); break;
            case GamePackets.GameServerPacket_T.RecipeShopMsg: this.items.onRecipeShopMsg(packet); break;
            case GamePackets.GameServerPacket_T.HennaEquipList: this.items.hennaEquipList = GamePackets.readHennaEquipList(packet); this.ui.showHennaList(this.items.hennaEquipList); break;
            case GamePackets.GameServerPacket_T.HennaItemInfo: this.items.hennaItemInfo = GamePackets.readHennaItemInfo(packet); this.ui.showHennaInfo(this.items.hennaItemInfo); break;
            case GamePackets.GameServerPacket_T.HennaUnequipList: this.ui.showHennaList(GamePackets.readHennaEquipList(packet), true); break;
            case GamePackets.GameServerPacket_T.HennaUnequipInfo: this.ui.showHennaInfo(GamePackets.readHennaItemInfo(packet), true); break;
            case GamePackets.GameServerPacket_T.PartyMatchList: {
                const list = GamePackets.readPartyMatchList(packet);

                this.community.partyMatchRooms = list.rooms;
                this.community.partyMatchPage = list.page;
                this.ui.showPartyMatchList(list);
                break;
            }
            case GamePackets.GameServerPacket_T.PartyMatchDetail:
                this.community.partyMatchDetail = GamePackets.readPartyMatchDetail(packet);
                this.ui.showPartyMatchDetail(this.community.partyMatchDetail);
                break;
            case GamePackets.GameServerPacket_T.PartySpelled: this.community.onPartySpelled(packet); break;
            case GamePackets.GameServerPacket_T.TutorialShowQuestionMark: this.community.tutorialQuestionMarks.add(packet.d()); break;
            case GamePackets.GameServerPacket_T.TutorialEnableClientEvent: this.community.tutorialClientEvents = packet.d(); break;
            case GamePackets.GameServerPacket_T.GMViewCharacterInfo: this.community.gmCharacterInfo = GamePackets.readGMViewCharacterInfo(packet); this.community.updateGMCharacterInfo(); break;
            case GamePackets.GameServerPacket_T.GMViewPledgeInfo: this.community.gmPledgeInfo = GamePackets.readGMViewPledgeInfo(packet); this.ui.setGMPledgeInfo(this.community.gmPledgeInfo); break;
            case GamePackets.GameServerPacket_T.GMViewSkillInfo: this.community.gmSkillInfo = GamePackets.readGMViewSkillInfo(packet); this.ui.setGMSkillInfo(this.community.gmSkillInfo); break;
            case GamePackets.GameServerPacket_T.GMViewQuestList: this.community.gmQuestList = GamePackets.readGMViewQuestList(packet); this.ui.setGMQuestList(this.community.gmQuestList); break;
            case GamePackets.GameServerPacket_T.GMViewItemList: this.community.gmItemList = GamePackets.readGMViewItemList(packet); this.ui.setGMInventoryInfo(this.community.gmItemList); break;
            case GamePackets.GameServerPacket_T.GMViewWarehouseWithdrawList: this.community.gmWarehouseList = GamePackets.readGMViewWarehouseWithdrawList(packet); this.ui.setGMWarehouseInfo(this.community.gmWarehouseList); break;
            case GamePackets.GameServerPacket_T.GMViewHennaInfo: this.community.gmHennaStatus = GamePackets.readGMViewHennaInfo(packet); break;
            case GamePackets.GameServerPacket_T.Snoop: this.community.onSnoop(packet); break;
            case GamePackets.GameServerPacket_T.Extended:
                switch (packet.h()) {
                    case GamePackets.GameServerExPacket_T.ExAutoSoulShot: this.items.onAutoSoulShot(packet); break;
                    case GamePackets.GameServerExPacket_T.ExStorageMaxCount: this.items.onStorageMaxCount(packet); break;
                    case GamePackets.GameServerExPacket_T.ExPledgeCrestLarge: this.community.onPledgeCrestLarge(packet); break;
                    case GamePackets.GameServerExPacket_T.ExEventMatchMessage: this.community.onEventMatchMessage(packet); break;
                    case GamePackets.GameServerExPacket_T.ExPartyRoomMember: this.community.onPartyRoomMember(packet); break;
                    case GamePackets.GameServerExPacket_T.ExClosePartyRoom: this.community.onClosePartyRoom(packet); break;
                    case GamePackets.GameServerExPacket_T.ExManagePartyRoomMember: this.community.onManagePartyRoomMember(packet); break;
                    case GamePackets.GameServerExPacket_T.ExFishingStart: this.combat.onFishingStart(packet); break;
                    case GamePackets.GameServerExPacket_T.ExFishingEnd: this.combat.onFishingEnd(packet); break;
                    case GamePackets.GameServerExPacket_T.ExFishingStartCombat: this.combat.onFishingStartCombat(packet); break;
                    case GamePackets.GameServerExPacket_T.ExFishingHpRegen: this.combat.onFishingHpRegen(packet); break;
                    case GamePackets.GameServerExPacket_T.ExEnchantSkillList:
                        this.items.enchantSkills = GamePackets.readEnchantSkillList(packet);
                        this.ui.showEnchantSkillList(this.items.enchantSkills);
                        break;
                    case GamePackets.GameServerExPacket_T.ExEnchantSkillInfo:
                        this.items.enchantSkillInfo = GamePackets.readEnchantSkillInfo(packet);
                        this.ui.showEnchantSkillInfo(this.items.enchantSkillInfo);
                        break;
                    case GamePackets.GameServerExPacket_T.ExQuestInfo: if (packet.getRemaining()) throw new Error("Invalid ExQuestInfo payload."); break;
                    case GamePackets.GameServerExPacket_T.ExShowQuestMark: this.community.onShowQuestMark(packet); break;
                    case GamePackets.GameServerExPacket_T.ExSendManorList: this.items.manors = GamePackets.readManorList(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowSeedInfo: this.items.manorSeedInfo = GamePackets.readShowSeedInfo(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowCropInfo: this.items.manorCropInfo = GamePackets.readShowCropInfo(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowManorDefaultInfo: this.items.manorDefaultCrops = GamePackets.readShowManorDefaultInfo(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowSeedSetting: this.items.manorSeedSettings = GamePackets.readShowSeedSetting(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowCropSetting: this.items.manorCropSettings = GamePackets.readShowCropSetting(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowSellCropList: this.items.manorSellCrops = GamePackets.readShowSellCropList(packet); break;
                    case GamePackets.GameServerExPacket_T.ExShowProcureCropDetail: this.items.manorProcureCropDetail = GamePackets.readShowProcureCropDetail(packet); break;
                    case GamePackets.GameServerExPacket_T.ExHeroList: this.community.heroes = GamePackets.readHeroList(packet); this.ui.showHeroList(this.community.heroes); break;
                    case GamePackets.GameServerExPacket_T.ExOpenMPCC: this.community.onOpenMPCC(packet); break;
                    case GamePackets.GameServerExPacket_T.ExCloseMPCC: this.community.onCloseMPCC(packet); break;
                    case GamePackets.GameServerExPacket_T.ExAskJoinMPCC: this.community.onAskJoinMPCC(packet); break;
                    case GamePackets.GameServerExPacket_T.ExMultiPartyCommandChannelInfo: this.community.commandChannel = GamePackets.readCommandChannelInfo(packet); this.ui.setCommandChannelInfo(this.community.commandChannel); break;
                    case GamePackets.GameServerExPacket_T.ExOlympiadUserInfo: { const info = GamePackets.readOlympiadUserInfo(packet); this.community.olympiadUsers.set(info.objectId, info); this.ui.setOlympiadUserInfo(info); break; }
                    case GamePackets.GameServerExPacket_T.ExOlympiadSpelledInfo: { const info = GamePackets.readOlympiadSpelledInfo(packet); this.community.olympiadEffects.set(info.objectId, info.effects); this.ui.setOlympiadEffects(info.objectId, info.effects); break; }
                    case GamePackets.GameServerExPacket_T.ExOlympiadMode: this.community.onOlympiadMode(packet); break;
                    case GamePackets.GameServerExPacket_T.ExOlympiadMatchEnd: this.community.onOlympiadMatchEnd(packet); break;
                    case GamePackets.GameServerExPacket_T.ExMailArrived: this.community.onMailArrived(packet); break;
                }
                break;
            case GamePackets.GameServerPacket_T.SunRise: this.manGame.getComponent("render").getEnvironment().setTimeOfDay(7); break; // Engine 0x103f1660: OnReceiveServerTime(420).
            case GamePackets.GameServerPacket_T.SunSet: this.manGame.getComponent("render").getEnvironment().setTimeOfDay(1); break; // Engine 0x103f1690: OnReceiveServerTime(60).
            case GamePackets.GameServerPacket_T.RestartResponse:
                if (packet.d() !== 0) { // Engine 0x104283d9 / 0x10480f82.
                    this.ui.saveInventoryOrder();
                    this.ui.clearQuestLocation();
                    this.leaveWorld();
                    if (this.session.gmTransfer && this.session.gmTransfer.phase === GMTransferPhase_T.Restart) this.session.gmTransfer.phase = GMTransferPhase_T.Reconnect;
                }
                break;
            case GamePackets.GameServerPacket_T.LeaveWorld:
            case GamePackets.GameServerPacket_T.ServerClose:
                this.session.game.close();
                void this.session.onDisconnected(opcode === GamePackets.GameServerPacket_T.LeaveWorld ? "Logged out." : "Server closed the session.");
                break;
        }
    }

    public getDoorPosition(mover: MovableObject): number { return this.actors.getDoorPosition(mover); }

    public requestSkillList() { return this.items.requestSkillList(); }

    public useSkill(id: number, ctrl: boolean = false, shift: boolean = false) { return this.combat.useSkill(id, ctrl, shift); }

    public useAction(id: number, ctrl: boolean = false, shift: boolean = false) {
        if (!this.actors.inWorld) return;

        switch (id) {
            case ActionType_T.attack: {
                if (this.nextTargetLock) break; // NWindow 0x10071c06, Engine bNextTargetLock.

                const targetId = this.getTargetId();

                if (this.actors.hasServerObject(targetId)) {
                    const position = this.manGame.getComponent("render").player.position;

                    if (ctrl) this.session.game.attackRequest(targetId, position, shift);
                    else this.session.game.action(targetId, position, shift);
                }
                break;
            }
            case ActionType_T.trade: {
                const target = this.actors.objects.get(this.getTargetId());

                if (target && target.actor) this.items.requestTrade(target.objectId);
                break;
            }
            case ActionType_T.targetnext: {
                const selected = this.actors.objects.get(this.getTargetId());
                const next = this.getNextEnemy(200, selected && selected.actor ? selected.objectId : -1);

                if (next) {
                    this.nextTargetLock = true;
                    this.session.game.action(next.objectId, this.manGame.getComponent("render").player.position, shift);
                }
                break;
            }
            case ActionType_T.Pickup: {
                const item = this.getNearestItem(200, -1);

                if (item) this.session.game.action(item.objectId, this.manGame.getComponent("render").player.position, shift);
                break;
            }
            case ActionType_T.assist: {
                const target = this.actors.objects.get(this.getTargetId());

                if (target && target.actor && this.actors.hasServerObject(target.selectedId))
                    this.session.game.action(target.selectedId, this.manGame.getComponent("render").player.position, shift);
                break;
            }
            case ActionType_T.partyinvite: case ActionType_T.partydismiss: {
                const target = this.actors.objects.get(this.getTargetId());

                if (target && target.kind !== "npc") {
                    if (id === ActionType_T.partyinvite) this.community.inviteToParty(target.name, this.ui.getGameOptions().partyLooting);
                    else this.community.oustPartyMember(target.name);
                } else {
                    const messageId = id === ActionType_T.partyinvite ? 185 : 187;

                    this.ui.addSystemMessage(this.ui.getStrings().systemMessages[messageId], 0xffb09b79);
                }
                break;
            }
            case ActionType_T.partyleave: this.community.withdrawParty(); break;
            case ActionType_T.vendor: this.items.requestPrivateStoreManageSell(); break;
            case ActionType_T.partymatching: this.ui.openPartyMatch(); break;
            case ActionType_T.petpickup: {
                const item = this.actors.petInfo ? this.getNearestItem(200, -1, this.actors.petInfo.objectId) : null;

                if (item) this.session.game.requestPetGetItem(item.objectId);
                break;
            }
            case ActionType_T.buy: this.items.requestPrivateStoreManageBuy(); break;
            case ActionType_T.commend: {
                const target = this.actors.objects.get(this.getTargetId());

                if (target && target.kind !== "npc") this.community.evaluate(target.objectId);
                else {
                    const messageId = target ? 144 : 242;

                    this.ui.addSystemMessage(this.ui.getStrings().systemMessages[messageId], 0xffb09b79);
                    this.community.playSystemMessageSound(messageId);
                }
                break;
            }
            case ActionType_T.leaderchange: {
                const target = this.actors.objects.get(this.getTargetId());

                if (target && target.kind !== "npc") this.community.changePartyLeader(target.name);
                else this.ui.addSystemMessage(this.ui.getStrings().systemMessages[1400], 0xffb09b79);
                break;
            }
            case ActionType_T.recstartstop:
                if (this.session.game.isRecording()) this.session.stopReplayRecording();
                else this.session.startReplayRecording();
                break;
            case ActionType_T.invitechannel: {
                const target = this.actors.objects.get(this.getTargetId());

                if (target && target.kind !== "npc") this.community.inviteToCommandChannel(target.name);
                else {
                    this.ui.addSystemMessage(this.ui.getStrings().systemMessages[50], 0xffb09b79);
                    this.community.playSystemMessageSound(50);
                }
                break;
            }
            default: {
                const type = this.ui.getStrings().actions[id].type;

                if (type >= 2) this.session.game.requestSocialAction(type);
                else this.session.game.requestActionUse(id, ctrl, shift);
                break;
            }
        }
    }

    public requestRestart() { return this.session.requestRestart(); }
    public logout() { return this.session.logout(); }
    public playReplay(bytes: Uint8Array, lockCamera = true, useChatData = false): Promise<void> { return this.session.playReplay(bytes, lockCamera, useChatData); }
    public stopReplayPlayback(): Promise<void> { return this.session.stopReplayPlayback(); }
    public startReplayRecording(): void { return this.session.startReplayRecording(); }
    public stopReplayRecording(): Promise<void> { return this.session.stopReplayRecording(); }
    public getReplayRecordingTime() { return this.session.getReplayRecordingTime(); }

    public requestItemList() { return this.items.requestItemList(); }
    public useItem(objectId: number) { return this.items.useItem(objectId); }
    public chooseInventoryItem(objectId: number) { return this.items.chooseInventoryItem(objectId); }
    public toggleAutoSoulShot(page: number, slot: number) { return this.items.toggleAutoSoulShot(page, slot); }
    public registerSkillShortCut(id: number, page: number, slot: number) { return this.items.registerSkillShortCut(id, page, slot); }
    public registerRecipeShortCut(id: number, page: number, slot: number) { return this.items.registerRecipeShortCut(id, page, slot); }
    public registerMacroShortCut(id: number, page: number, slot: number) { return this.items.registerMacroShortCut(id, page, slot); }
    public registerItemShortCut(objectId: number, page: number, slot: number) { return this.items.registerItemShortCut(objectId, page, slot); }
    public registerPetItemShortCut(objectId: number, page: number, slot: number) { return this.items.registerPetItemShortCut(objectId, page, slot); }
    public registerActionShortCut(id: number, page: number, slot: number) { return this.items.registerActionShortCut(id, page, slot); }
    public moveShortCut(page: number, slot: number, targetPage: number, targetSlot: number) { return this.items.moveShortCut(page, slot, targetPage, targetSlot); }
    public useShortCut(page: number, slot: number, ctrl: boolean = false, shift: boolean = false) { return this.items.useShortCut(page, slot, ctrl, shift); }
    public requestTrade(objectId: number) { return this.items.requestTrade(objectId); }
    public canAddTradeItem(objectId: number) { return this.items.canAddTradeItem(objectId); }
    public addTradeItem(objectId: number, count: number) { return this.items.addTradeItem(objectId, count); }
    public confirmTrade(isConfirmed: boolean) { return this.items.confirmTrade(isConfirmed); }
    public answerTradeRequest(isAccepted: boolean) { return this.items.answerTradeRequest(isAccepted); }
    public sellItems(items: GamePackets.SellItemRequest_T[]) { return this.items.sellItems(items); }
    public buyItems(items: GamePackets.ItemIdCount_T[]) { return this.items.buyItems(items); }
    public depositWarehouse(items: GamePackets.ItemCount_T[]) { return this.items.depositWarehouse(items); }
    public withdrawWarehouse(items: GamePackets.ItemCount_T[]) { return this.items.withdrawWarehouse(items); }
    public requestPrivateStoreManageSell() { return this.items.requestPrivateStoreManageSell(); }
    public setPrivateStoreListSell(isPackage: boolean, items: GamePackets.PrivateStoreOffer_T[]) { return this.items.setPrivateStoreListSell(isPackage, items); }
    public quitPrivateStoreSell() { return this.items.quitPrivateStoreSell(); }
    public setPrivateStoreMsgSell(message: string) { return this.items.setPrivateStoreMsgSell(message); }
    public getPrivateStoreMsgSell() { return this.items.getPrivateStoreMsgSell(); }
    public buyFromPrivateStore(ownerId: number, items: GamePackets.PrivateStoreOffer_T[]) { return this.items.buyFromPrivateStore(ownerId, items); }
    public requestPrivateStoreManageBuy() { return this.items.requestPrivateStoreManageBuy(); }
    public setPrivateStoreListBuy(items: GamePackets.PrivateStoreBuyOffer_T[]) { return this.items.setPrivateStoreListBuy(items); }
    public quitPrivateStoreBuy() { return this.items.quitPrivateStoreBuy(); }
    public cancelPrivateStoreManageBuy() { return this.items.cancelPrivateStoreManageBuy(); }
    public setPrivateStoreMsgBuy(message: string) { return this.items.setPrivateStoreMsgBuy(message); }
    public getPrivateStoreMsgBuy() { return this.items.getPrivateStoreMsgBuy(); }
    public sellToPrivateStore(ownerId: number, items: GamePackets.PrivateStoreSellOffer_T[]) { return this.items.sellToPrivateStore(ownerId, items); }
    public requestPackageSendableItemList(objectId: number) { return this.items.requestPackageSendableItemList(objectId); }
    public sendPackage(objectId: number, items: GamePackets.ItemCount_T[]) { return this.items.sendPackage(objectId, items); }
    public clearMultiSell() { return this.items.clearMultiSell(); }
    public chooseMultiSell(listId: number, entryId: number, amount: number) { return this.items.chooseMultiSell(listId, entryId, amount); }
    public requestPreviewItems(itemIds: number[]) { return this.items.requestPreviewItems(itemIds); }
    public buySeeds(items: GamePackets.ItemIdCount_T[], manorId?: number) { return this.items.buySeeds(items, manorId); }
    public sellCrops(items: GamePackets.SellItemRequest_T[], listId?: number) { return this.items.sellCrops(items, listId); }
    public dropItem(objectId: number, count: number, point: GamePackets.Location_T) { return this.items.dropItem(objectId, count, point); }
    public destroyItem(objectId: number, count: number) { return this.items.destroyItem(objectId, count); }
    public crystallizeItem(objectId: number, count: number) { return this.items.crystallizeItem(objectId, count); }
    public unequipBodyPart(bodyPart: number) { return this.items.unequipBodyPart(bodyPart); }
    public giveItemToPet(objectId: number, count: number) { return this.items.giveItemToPet(objectId, count); }
    public getItemFromPet(objectId: number, count: number) { return this.items.getItemFromPet(objectId, count); }
    public usePetItem(objectId: number) { return this.items.usePetItem(objectId); }
    public petPickup(objectId: number) { return this.items.petPickup(objectId); }
    public changePetName(name: string) { return this.items.changePetName(name); }
    public getRecipeBook() { return this.items.getRecipeBook(); }
    public getRecipeItemMakeInfo() { return this.items.getRecipeItemMakeInfo(); }
    public getRecipeShopManageList() { return this.items.getRecipeShopManageList(); }
    public getRecipeShopSellList() { return this.items.getRecipeShopSellList(); }
    public getRecipeShopItemInfo() { return this.items.getRecipeShopItemInfo(); }
    public getRecipeShopMessage(objectId: number) { return this.items.getRecipeShopMessage(objectId); }
    public getHennaEquipList() { return this.items.getHennaEquipList(); }
    public getHennaItemInfo() { return this.items.getHennaItemInfo(); }
    public openRecipeBook(isDwarven: boolean) { return this.items.openRecipeBook(isDwarven); }
    public destroyRecipe(recipeId: number) { return this.items.destroyRecipe(recipeId); }
    public requestRecipeItemMakeInfo(recipeId: number) { return this.items.requestRecipeItemMakeInfo(recipeId); }
    public makeRecipeItem(recipeId: number) { return this.items.makeRecipeItem(recipeId); }
    public requestRecipeShopManage() { return this.items.requestRecipeShopManage(); }
    public getOwnRecipeShopMessage() { return this.items.getOwnRecipeShopMessage(); }
    public setRecipeShopMessage(name: string) { return this.items.setRecipeShopMessage(name); }
    public setRecipeShopList(items: GamePackets.RecipeShopListEntry_T[]) { return this.items.setRecipeShopList(items); }
    public quitRecipeShopManage() { return this.items.quitRecipeShopManage(); }
    public cancelRecipeShopManage() { return this.items.cancelRecipeShopManage(); }
    public requestRecipeShopMakeInfo(objectId: number, recipeId: number) { return this.items.requestRecipeShopMakeInfo(objectId, recipeId); }
    public makeRecipeShopItem(objectId: number, recipeId: number, price: number) { return this.items.makeRecipeShopItem(objectId, recipeId, price); }
    public recipeShopManagePrev(objectId: number) { return this.items.recipeShopManagePrev(objectId); }
    public requestHennaList() { return this.items.requestHennaList(); }
    public requestHennaItemInfo(symbolId: number) { return this.items.requestHennaItemInfo(symbolId); }
    public equipHenna(symbolId: number) { return this.items.equipHenna(symbolId); }
    public requestHennaUnequipList() { return this.items.requestHennaUnequipList(); }
    public requestHennaUnequipInfo(symbolId: number) { return this.items.requestHennaUnequipInfo(symbolId); }
    public unequipHenna(symbolId: number) { return this.items.unequipHenna(symbolId); }
    public requestQuestList() { return this.items.requestQuestList(); }
    public abortQuest(questId: number) { return this.items.abortQuest(questId); }
    public makeMacro(macro: GamePackets.Macro_T) { return this.items.makeMacro(macro); }
    public deleteMacro(id: number) { return this.items.deleteMacro(id); }
    public requestAquireSkillInfo(id: number, level: number, mode = Number(this.items.aquireSkillFishing)) { return this.items.requestAquireSkillInfo(id, level, mode); }
    public aquireSkill(id: number, level: number, mode = Number(this.items.aquireSkillFishing)) { return this.items.aquireSkill(id, level, mode); }
    public deleteShortCut(page: number, slot: number) { return this.items.deleteShortCut(page, slot); }
    public requestEnchantSkillInfo(id: number, level: number) { return this.items.requestEnchantSkillInfo(id, level); }
    public enchantSkill(id: number, level: number) { return this.items.enchantSkill(id, level); }
    public requestManorList() { return this.items.requestManorList(); }
    public procureCrops(items: GamePackets.ProcureCropRequest_T[]) { return this.items.procureCrops(items); }
    public setManorSeeds(manorId: number, items: GamePackets.SeedSettingRequest_T[]) { return this.items.setManorSeeds(manorId, items); }
    public setManorCrops(manorId: number, items: GamePackets.CropSettingRequest_T[]) { return this.items.setManorCrops(manorId, items); }

    public playSystemMessageSound(id: number) { return this.community.playSystemMessageSound(id); }
    public getHeroCrest(crestId: number, isAlly: boolean): HTMLCanvasElement { return this.community.getHeroCrest(crestId, isAlly); }
    public getPledgePower() { return this.community.getPledgePower(); }
    public getClanInfo() { return this.community.getClanInfo(); }
    public getPledgeCrest(crestId: number) { return this.community.getPledgeCrest(crestId); }
    public getPledgeLargeCrest(crestId: number) { return this.community.getPledgeLargeCrest(crestId); }
    public getClanLargeCrestId(clanId: number) { return this.community.getClanLargeCrestId(clanId); }
    public getAllyCrest(crestId: number) { return this.community.getAllyCrest(crestId); }
    public requestPledgeInfo(clanId: number) { return this.community.requestPledgeInfo(clanId); }
    public requestPledgeMemberList() { return this.community.requestPledgeMemberList(); }
    public getSelectedPlayer() { return this.community.getSelectedPlayer(); }
    public invitePledge(objectId: number) { return this.community.invitePledge(objectId); }
    public withdrawPledge() { return this.community.withdrawPledge(); }
    public oustPledgeMember(name: string) { return this.community.oustPledgeMember(name); }
    public giveNickName(name: string, title: string) { return this.community.giveNickName(name, title); }
    public requestPledgePower() { return this.community.requestPledgePower(); }
    public requestMemberPledgePower(objectId: number) { return this.community.requestMemberPledgePower(objectId); }
    public setMemberPledgePower(objectId: number, privs: Uint8Array) { return this.community.setMemberPledgePower(objectId, privs); }
    public startPledgeWar(pledgeName: string) { return this.community.startPledgeWar(pledgeName); }
    public stopPledgeWar(pledgeName: string) { return this.community.stopPledgeWar(pledgeName); }
    public surrenderPledgeWar(pledgeName: string) { return this.community.surrenderPledgeWar(pledgeName); }
    public surrenderPersonally(pledgeName: string) { return this.community.surrenderPersonally(pledgeName); }
    public replyStartPledgeWar(isAccepted: boolean) { return this.community.replyStartPledgeWar(isAccepted); }
    public replyStopPledgeWar(isAccepted: boolean) { return this.community.replyStopPledgeWar(isAccepted); }
    public replySurrenderPledgeWar(isAccepted: boolean) { return this.community.replySurrenderPledgeWar(isAccepted); }
    public requestPledgeCrest(crestId: number) { return this.community.requestPledgeCrest(crestId); }
    public requestPledgeLargeCrest(crestId: number) { return this.community.requestPledgeLargeCrest(crestId); }
    public requestAllyCrest(crestId: number) { return this.community.requestAllyCrest(crestId); }
    public setPledgeCrest(data: Uint8Array) { return this.community.setPledgeCrest(data); }
    public setPledgeLargeCrest(data: Uint8Array) { return this.community.setPledgeLargeCrest(data); }
    public setAllyCrest(data: Uint8Array) { return this.community.setAllyCrest(data); }
    public requestJoinAlly(objectId: number) { return this.community.requestJoinAlly(objectId); }
    public leaveAlly() { return this.community.leaveAlly(); }
    public dismissAllyClan(clanName: string) { return this.community.dismissAllyClan(clanName); }
    public dissolveAlly() { return this.community.dissolveAlly(); }
    public requestAllyInfo() { return this.community.requestAllyInfo(); }
    public getRadarMarkers(): readonly GamePackets.Location_T[] { return this.community.getRadarMarkers(); }
    public getTownMap() { return this.community.getTownMap(); }
    public getCalculatorId() { return this.community.getCalculatorId(); }
    public getXMasSealItemId() { return this.community.getXMasSealItemId(); }
    public getMonRace() { return this.community.getMonRace(); }
    public getSSQStatus(page: number) { return this.community.getSSQStatus(page); }
    public getClanHallDecoration(clanHallId: number) { return this.community.getClanHallDecoration(clanHallId); }
    public getSiegeInfo() { return this.community.getSiegeInfo(); }
    public getSiegeAttackers() { return this.community.getSiegeAttackers(); }
    public getSiegeDefenders() { return this.community.getSiegeDefenders(); }
    public requestSSQStatus(page: GamePackets.SSQPage_T) { return this.community.requestSSQStatus(page); }
    public requestSiegeAttackerList(castleId: number) { return this.community.requestSiegeAttackerList(castleId); }
    public requestSiegeDefenderList(castleId: number) { return this.community.requestSiegeDefenderList(castleId); }
    public requestJoinSiege(castleId: number, isAttacker: boolean, isJoining: boolean) { return this.community.requestJoinSiege(castleId, isAttacker, isJoining); }
    public confirmSiegeWaitingList(castleId: number, clanId: number, isApproved: boolean) { return this.community.confirmSiegeWaitingList(castleId, clanId, isApproved); }
    public getPartyMatchRooms() { return this.community.getPartyMatchRooms(); }
    public isInParty() { return this.community.isInParty(); }
    public getPartyMatchPage() { return this.community.getPartyMatchPage(); }
    public getPartyMatchDetail() { return this.community.getPartyMatchDetail(); }
    public getPartyEffects(objectId: number) { return this.community.getPartyEffects(objectId); }
    public getTutorialQuestionMarks() { return this.community.getTutorialQuestionMarks(); }
    public getTutorialClientEvents() { return this.community.getTutorialClientEvents(); }
    public getSnoops() { return this.community.getSnoops(); }
    public requestPartyMatchConfig(page: number, location: number, limit: number) { return this.community.requestPartyMatchConfig(page, location, limit); }
    public requestPartyMatchList(roomId: number, maxMembers: number, minLevel: number, maxLevel: number, lootType: number, title: string) { return this.community.requestPartyMatchList(roomId, maxMembers, minLevel, maxLevel, lootType, title); }
    public requestPartyMatchDetail(roomId: number, location = 0) { return this.community.requestPartyMatchDetail(roomId, location); }
    public inviteToParty(name: string, lootType: number) { return this.community.inviteToParty(name, lootType); }
    public withdrawParty() { return this.community.withdrawParty(); }
    public oustPartyMember(name: string) { return this.community.oustPartyMember(name); }
    public tutorialLink(link: string) { return this.community.tutorialLink(link); }
    public tutorialPassCmd(command: string) { return this.community.tutorialPassCmd(command); }
    public tutorialClientEvent(eventId: number) { return this.community.tutorialClientEvent(eventId); }
    public tutorialQuestionMark(id: number) { return this.community.tutorialQuestionMark(id); }
    public gmCommand(targetName: string, command: number) { return this.community.gmCommand(targetName, command); }
    public requestGmList() { return this.community.requestGmList(); }
    public snoopQuit(objectId: number) { return this.community.snoopQuit(objectId); }
    public petition(content: string, type: number) { return this.community.petition(content, type); }
    public cancelPetition() { return this.community.cancelPetition(); }
    public requestFriendList() { return this.community.requestFriendList(); }
    public deleteFriend(name: string) { return this.community.deleteFriend(name); }
    public sendFriendMessage(receiver: string, message: string) { return this.community.sendFriendMessage(receiver, message); }
    public block(type: GamePackets.BlockType_T, name: string = null) { return this.community.block(type, name); }
    public userCommand(id: number) { return this.community.userCommand(id); }
    public evaluate(objectId: number) { return this.community.evaluate(objectId); }
    public showBoard() { return this.community.showBoard(); }
    public writeBoard(url: string, arg1: string, arg2: string, arg3: string, arg4: string, arg5: string) { return this.community.writeBoard(url, arg1, arg2, arg3, arg4, arg5); }
    public oustFromPartyRoom(objectId: number) { return this.community.oustFromPartyRoom(objectId); }
    public dismissPartyRoom(roomId: number) { return this.community.dismissPartyRoom(roomId); }
    public withdrawPartyRoom(roomId: number) { return this.community.withdrawPartyRoom(roomId); }
    public changePartyLeader(name: string) { return this.community.changePartyLeader(name); }
    public writeHeroWords(words: string) { return this.community.writeHeroWords(words); }
    public inviteToCommandChannel(name: string) { return this.community.inviteToCommandChannel(name); }
    public oustFromCommandChannel(name: string) { return this.community.oustFromCommandChannel(name); }
    public endOlympiadObserver() { return this.community.endOlympiadObserver(); }
    public requestOlympiadMatchList() { return this.community.requestOlympiadMatchList(); }
    public answerCommandChannelInvite(isAccepted: boolean) { return this.community.answerCommandChannelInvite(isAccepted); }

    public getVehicleActor(objectId: number): Vehicle | null { return this.movement.getVehicleActor(objectId); }
    public getVehicleId() { return this.movement.getVehicleId(); }
    public getMount(objectId: number) { return this.movement.getMount(objectId); }
    public isObserving() { return this.movement.isObserving(); }
    public getSpecialCamera() { return this.movement.getSpecialCamera(); }
    public getCameraMode() { return this.movement.getCameraMode(); }
    public requestGetOnVehicle(vehicleId: number, position: GamePackets.Location_T) { return this.movement.requestGetOnVehicle(vehicleId, position); }
    public requestGetOffVehicle(vehicleId: number, position: GamePackets.Location_T) { return this.movement.requestGetOffVehicle(vehicleId, position); }
    public observerReturn() { return this.movement.observerReturn(); }
    public startRotating(heading: number, side: number) { return this.movement.startRotating(heading, side); }
    public finishRotating(heading: number, unknown: number) { return this.movement.finishRotating(heading, unknown); }
    public requestRecordInfo() { return this.movement.requestRecordInfo(); }
    public requestShowMiniMap() { return this.movement.requestShowMiniMap(); }
    public requestMoveInVehicle(vehicle: Vehicle, destination: Vector3) { return this.movement.requestMoveInVehicle(vehicle, destination); }
    public cannotMoveInVehicle(vehicle: Vehicle, position: Vector3) { return this.movement.cannotMoveInVehicle(vehicle, position); }

    public getUserId() { return this.actors.getUserId(); }
    public getActor(objectId: number) { return this.actors.getActor(objectId); }
    public getDice() { return this.actors.getDice(); }

    public activateMacro(id: number) { this.macroExecutor.activate(id); }
    public resetMacros() { this.macroExecutor.reset(); }

    public waitNextTick(): Promise<void> {
        if (!this.nextTick) this.nextTick = new Promise(resolve => this.resolveNextTick = resolve);

        return this.nextTick;
    }

    public onEngineTick(currentTime: number, deltaTime: number): void {
        this.session.tickGMServerTransfer();
        if (this.session.getReplayRecordingTime() > 1800) this.session.stopReplayRecording(); // FL2ReplayManager::Tick 0x75f8a6.
        if (this.session.game?.isPlayingReplay() && !this.session.replayLoading && !this.session.game.tickReplayPlayback(deltaTime / 1000)) {
            void this.session.stopReplayPlayback();
            return;
        }

        if (this.resolveNextTick) {
            const resolve = this.resolveNextTick;

            this.nextTick = this.resolveNextTick = null;
            resolve();
        }

        if (this.session.lobby) this.session.lobby.tick(deltaTime);
        if (this.session.lobby && this.ui.isLobbyVisible()) this.ui.setPawnLabels(this.session.lobby.getPawnLabels(this.session.characters, this.ui.getScreenCanvas().width, this.ui.getScreenCanvas().height));
        if (!this.actors.inWorld) return;

        this.updateGNOManager(deltaTime);
        this.macroExecutor.tick(deltaTime);
        this.movement.updateVehicles(deltaTime);

        const player = this.manGame.getComponent("render").player;
        const isMoving = player.isLocomoting();

        if ((isMoving || this.movement.wasMoving) && currentTime - this.movement.lastValidateAt >= VALIDATE_POSITION_INTERVAL) {
            this.movement.lastValidateAt = currentTime;
            this.movement.wasMoving = isMoving;
            const base = player.getBaseActor() as Vehicle;

            if (base && base.isVehicle) {
                tmpVehicleOrigin.fromArray(player.getUnrealScriptProperty("Location") as number[]);
                base.getLocalLocation(tmpVehicleOrigin, tmpVehicleOrigin);
                this.session.game.validatePosition(tmpVehicleOrigin, player.getRotationYaw(), base.getUnrealScriptProperty("L2ServerObjectID") as number);
            } else this.session.game.validatePosition(player.position, player.getRotationYaw());
        }

        if (!isMoving || !player.isInteractive()) this.movement.stuckCheckAt = 0;
        else if (this.movement.stuckCheckAt === 0) {
            this.movement.stuckCheckAt = currentTime;
            this.movement.stuckPosition.copy(player.position);
        } else if (currentTime - this.movement.stuckCheckAt >= STUCK_INTERVAL) { // Server walks straight through whatever blocked us; CannotMoveAnymore makes it adopt our stop point.
            if (player.position.distanceTo(this.movement.stuckPosition) < STUCK_DISTANCE) {
                player.stopMoving();
                const base = player.getBaseActor() as Vehicle;

                if (base && base.isVehicle) this.movement.cannotMoveInVehicle(base, tmpVehicleOrigin.fromArray(player.getUnrealScriptProperty("Location") as number[]));
                else this.session.game.cannotMoveAnymore(player.position, player.getRotationYaw());
                this.movement.stuckCheckAt = 0;
            } else {
                this.movement.stuckCheckAt = currentTime;
                this.movement.stuckPosition.copy(player.position);
            }
        }
    }

    public getNameplates(): Nameplate_T[] { return this.actors.getNameplates(); }
}

export default NetworkManager;
