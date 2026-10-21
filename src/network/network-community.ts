import type NetworkManager from "./network-manager";
import BaseActor from "../base-actor";
import { PLEDGE_CREST_MAX_BYTES, PLEDGE_LARGE_CREST_MAX_BYTES, ALLY_CREST_MAX_BYTES } from "./crest-encoder";
import * as GamePackets from "./game-packets";
import PacketReader from "./packet-reader";
import Radar, { type RadarState_T } from "../rendering/radar";
import type { NetObject_T } from "./network-actors";

type PledgeInfo_T = { name: string, allyName: string, crestId: number, allyId: number, allyCrestId: number, unknown: number, crest: HTMLCanvasElement, allyCrest: HTMLCanvasElement };

export class NetworkCommunity {
    public readonly friends = new Map<number, GamePackets.FriendEntry_T>();
    public readonly partyMembers = new Map<number, GamePackets.PartyMember_T>();
    public partyInvite: GamePackets.PartyInvite_T = null;
    public pledgeInvite: GamePackets.PledgeInvite_T = null;
    public friendInvite: GamePackets.FriendInvite_T = null;
    public partyJoinResult = -1;
    public pledgeJoinId = 0;
    public clanInfo: GamePackets.ClanInfo_T = null;
    public readonly pledgeInfos = new Map<number, PledgeInfo_T>();
    public readonly clanMembers = new Map<string, GamePackets.ClanMember_T>();
    public partyLeaderId = 0;
    public partyLootDistribution = 0;
    public signsSky = 0;
    public allyInvite: GamePackets.AllyInvite_T = null;
    public pledgePower = new Uint8Array(32);
    public pledgeWarStart: GamePackets.PledgeWar_T = null;
    public pledgeWarStop: GamePackets.PledgeWar_T = null;
    public pledgeWarSurrender: GamePackets.PledgeWar_T = null;
    public readonly pledgeCrests = new Map<number, Uint8Array>();
    public readonly pledgeLargeCrests = new Map<number, Uint8Array>();
    public readonly clanLargeCrestIds = new Map<number, number>();
    public readonly allyCrests = new Map<number, Uint8Array>();
    public questArrowDestination: GamePackets.Location_T = null;
    public readonly mapMarkers: GamePackets.Location_T[] = [];
    public readonly radarMarkers: GamePackets.Location_T[] = [];
    protected readonly radarState: RadarState_T = { party: [], target: null, markers: this.radarMarkers };
    public readonly partyPositions = new Map<number, GamePackets.Location_T>();
    public townMap: GamePackets.TownMap_T = null;
    public calculatorId = 0;
    public xmasSealItemId = 0;
    public monRace: GamePackets.MonRaceInfo_T = null;
    public readonly ssqStatus = new Map<number, GamePackets.SSQStatus_T>();
    public readonly clanHallDecoration = new Map<number, GamePackets.ClanHallDecoration_T>();
    public siegeInfo: GamePackets.SiegeInfo_T = null;
    public siegeAttackers: GamePackets.SiegeClanList_T = null;
    public siegeDefenders: GamePackets.SiegeClanList_T = null;
    public partyMatchRooms: GamePackets.PartyMatchRoom_T[] = [];
    public partyMatchPage = 1;
    public partyMatchDetail: GamePackets.PartyMatchDetail_T = null;
    public readonly partyEffects = new Map<number, GamePackets.PartySpelled_T>();
    public readonly tutorialQuestionMarks = new Set<number>();
    public tutorialClientEvents = 0;
    public gmCharacterInfo: GamePackets.GMViewCharacterInfo_T = null;
    public gmPledgeInfo: GamePackets.GMViewPledgeInfo_T = null;
    public gmSkillInfo: GamePackets.GMViewSkillInfo_T = null;
    public gmQuestList: GamePackets.GMViewQuestList_T = null;
    public gmItemList: GamePackets.GMViewItemList_T = null;
    public gmWarehouseList: GamePackets.GMViewWarehouseWithdrawList_T = null;
    public gmHennaStatus: GamePackets.HennaStatus_T = null;
    public readonly snoops = new Map<number, GamePackets.Snoop_T[]>();
    public eventMatchMessageType = -1;
    public questMarkId = 0;
    public hasNewMail = false;
    public heroes: GamePackets.HeroEntry_T[] = [];
    public partyRoomMode = -1;
    public readonly partyRoomMembers = new Map<number, GamePackets.PartyRoomMember_T>();
    public isInCommandChannel = false;
    public commandChannel: GamePackets.CommandChannelInfo_T = null;
    public commandChannelInviter: string = null;
    public olympiadMode = 0;
    public readonly olympiadUsers = new Map<number, GamePackets.OlympiadUserInfo_T>();
    public readonly olympiadEffects = new Map<number, GamePackets.AbnormalStatus_T[]>();

    public constructor(protected readonly network: NetworkManager) {}

    public async loadRadar() {
        const render = this.network.getParent().getComponent("render");

        render.radar.setMeshes(await this.network.getParent().getComponent("asset").loadSkeletalMeshes("LineageDecos", Radar.getMeshNames()));
        render.radar.getState = () => this.getRadarState();
        if (!render.overHeadAlarm.isLoaded()) render.overHeadAlarm.setMesh((await this.network.getParent().getComponent("asset").loadSkeletalMeshes("LineageDecos", ["e_mark_m00"], ["LineageDecosTex.e_t00"]))[0]);
        const asset = this.network.getParent().getComponent("asset"), library = await asset.loadQuestEffects();

        render.questArrow.createEffect = path => asset.createScriptObject(render, library, path);
        render.questArrow.canDraw = () => this.network.actors.inWorld && !this.network.movement.isObserving();
        render.questArrow.getDestination = () => this.network.ui.isQuestArrowEnabled() ? this.questArrowDestination : null;
        render.questArrow.onArrival = () => { this.questArrowDestination = null; this.radarMarkers.length = 0; this.mapMarkers.length = 0; this.network.ui.setMapMarkers(this.mapMarkers); };
    }

    protected getRadarState(): RadarState_T { // DrawRadarBack 0x7FE54A: party members by GetUser actor, else the PartyMemberPosition XY; target is Controller.SelectedActor.
        const state = this.radarState, target = this.network.actors.objects.get(this.network.getTargetId());

        state.party.length = 0;

        for (const objectId of this.partyMembers.keys()) {
            const object = this.network.actors.objects.get(objectId);

            if (objectId === this.network.actors.userId) continue;
            if (object && object.actor) state.party.push(object.actor.position);
            else if (this.partyPositions.has(objectId)) state.party.push(this.partyPositions.get(objectId));
        }

        state.target = target && target.actor ? target.actor.position : null;

        return state;
    }

    public applySpeeds(actor: BaseActor, speeds: GamePackets.Speeds_T, isRunning: boolean) {
        actor.setMovementSpeeds(speeds.runSpd * speeds.moveMultiplier, speeds.walkSpd * speeds.moveMultiplier, speeds.swimRunSpd * speeds.moveMultiplier);
        if (speeds.airRunSpd !== undefined) actor.setAirSpeed((isRunning ? speeds.airRunSpd : speeds.airWalkSpd) * speeds.moveMultiplier);
        actor.setUnrealScriptProperty("AttackSpeedRate", speeds.attackSpeedMultiplier);
        actor.setUnrealScriptProperty("NonAttackSpeedRate", Math.fround(speeds.moveMultiplier)); // Engine 0x1047ab88: User+118 double to Pawn+5fc float.
        actor.setUnrealScriptProperty("GroundMaxSpeed", Math.fround(speeds.runSpd));
        actor.setUnrealScriptProperty("GroundMinSpeed", Math.fround(speeds.walkSpd));
        actor.setUnrealScriptProperty("WaterMaxSpeed", Math.fround(speeds.swimRunSpd));
        actor.setUnrealScriptProperty("WaterMinSpeed", Math.fround(speeds.swimWalkSpd));
        if (speeds.airRunSpd !== undefined) {
            actor.setUnrealScriptProperty("AirMaxSpeed", Math.fround(speeds.airRunSpd));
            actor.setUnrealScriptProperty("AirMinSpeed", Math.fround(speeds.airWalkSpd));
        }
        actor.setUnrealScriptProperty("GroundSpeed", Math.fround((isRunning ? speeds.runSpd : speeds.walkSpd) * Math.fround(speeds.moveMultiplier)));
        actor.setUnrealScriptProperty("WaterSpeed", Math.fround((isRunning ? speeds.swimRunSpd : speeds.swimWalkSpd) * Math.fround(speeds.moveMultiplier)));
        actor.setCollisionSize(speeds.collisionRadius, speeds.collisionHeight);
        if (speeds.originalCollisionRadius !== undefined) {
            actor.setUnrealScriptProperty("OriCollisionRadius", Math.fround(speeds.originalCollisionRadius));
            actor.setUnrealScriptProperty("OriCollisionHeight", Math.fround(speeds.originalCollisionHeight));
        }
        actor.setWalking(!isRunning);
    }

    public onSignsSky(packet: PacketReader) {
        const remaining = packet.getRemaining();

        if (remaining !== 0 && remaining !== 2) throw new Error(`Invalid SignsSky payload size ${remaining}.`);

        this.signsSky = remaining === 2 ? packet.h() : 0;
    }

    public onShowBoard(packet: PacketReader) {
        const part = GamePackets.readShowBoard(packet);

        this.network.ui.setBoard(part);
    }

    protected readPartyMember(packet: PacketReader, hasUnknown: boolean): GamePackets.PartyMember_T {
        const member = { objectId: packet.d(), name: packet.S(), curCp: packet.d(), maxCp: packet.d(), curHp: packet.d(), maxHp: packet.d(), curMp: packet.d(), maxMp: packet.d(), level: packet.d(), classId: packet.d() };

        if (hasUnknown) packet.skip(2 * 4);

        return member;
    }

    public applyPartyMember(member: GamePackets.PartyMember_T) {
        const object = this.network.actors.objects.get(member.objectId);

        if (!object) return;

        object.name = member.name;
        object.curHp = member.curHp;
        object.maxHp = member.maxHp;
        object.curMp = member.curMp;
        object.maxMp = member.maxMp;
        if (object.objectId === this.network.getTargetId()) this.network.combat.updateTarget();
    }

    public onPartySmallWindowAll(packet: PacketReader) {
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
        this.network.ui.setMapPartyMembers(this.partyMembers, this.partyPositions, this.network.actors.userId);
    }

    public onPartySmallWindowAdd(packet: PacketReader) {
        const leaderId = packet.d(), lootDistribution = packet.d(), member = this.readPartyMember(packet, true);

        this.partyLeaderId = leaderId;
        this.partyLootDistribution = lootDistribution;
        this.partyMembers.set(member.objectId, member);
        this.applyPartyMember(member);
        this.network.ui.setMapPartyMembers(this.partyMembers, this.partyPositions, this.network.actors.userId);
    }

    public onPartySmallWindowDeleteAll(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid PartySmallWindowDeleteAll payload.");

        this.partyMembers.clear();
        this.partyPositions.clear();
        this.partyEffects.clear();
        this.partyLeaderId = 0;
        this.partyLootDistribution = 0;
        this.network.ui.setMapPartyMembers(this.partyMembers, this.partyPositions, this.network.actors.userId);
    }

    public onPartySmallWindowDelete(packet: PacketReader) {
        const objectId = packet.d();

        packet.S();
        this.partyMembers.delete(objectId);
        this.partyPositions.delete(objectId);
        this.partyEffects.delete(objectId);
        this.network.ui.setMapPartyMembers(this.partyMembers, this.partyPositions, this.network.actors.userId);
    }

    public onPartySmallWindowUpdate(packet: PacketReader) {
        const member = this.readPartyMember(packet, false);

        this.partyMembers.set(member.objectId, member);
        this.applyPartyMember(member);
        this.network.ui.setMapPartyMembers(this.partyMembers, this.partyPositions, this.network.actors.userId);
    }

    public onAskJoinPledge(packet: PacketReader) {
        const requestorId = packet.d(), pledgeName = packet.S();

        if (requestorId <= 0 || !pledgeName || packet.getRemaining()) throw new Error("Invalid AskJoinPledge payload.");

        const invite: GamePackets.PledgeInvite_T = { requestorId, pledgeName };
        this.pledgeInvite = invite;
        this.network.ui.showPledgeInvite(this.network.actors.objects.get(requestorId)?.name || String(requestorId), pledgeName, isAccepted => {
            if (this.pledgeInvite !== invite) return;

            this.pledgeInvite = null;
            this.network.session.game.answerJoinPledge(isAccepted);
        });
    }

    public onJoinPledge(packet: PacketReader) {
        const pledgeId = packet.d();

        if (pledgeId <= 0 || packet.getRemaining()) throw new Error("Invalid JoinPledge payload.");

        this.pledgeJoinId = pledgeId;
    }

    public onAskJoinParty(packet: PacketReader) {
        const name = packet.S(), itemDistribution = packet.d();

        if (!name || itemDistribution < 0 || itemDistribution > 4 || packet.getRemaining()) throw new Error("Invalid AskJoinParty payload.");

        const invite: GamePackets.PartyInvite_T = { name, itemDistribution };
        this.partyInvite = invite;
        this.network.ui.showPartyInvite(name, isAccepted => {
            if (this.partyInvite !== invite) return;

            this.partyInvite = null;
            this.network.session.game.answerJoinParty(isAccepted);
        }, itemDistribution);
    }

    public onJoinParty(packet: PacketReader) {
        const response = packet.d();

        if (response !== 0 && response !== 1 || packet.getRemaining()) throw new Error("Invalid JoinParty payload.");

        this.partyJoinResult = response;
    }

    public onAskJoinFriend(packet: PacketReader) {
        const name = packet.S(), unknown = packet.d();

        if (!name || unknown !== 0 || packet.getRemaining()) throw new Error("Invalid AskJoinFriend payload.");

        const invite: GamePackets.FriendInvite_T = { name };
        this.friendInvite = invite;
        this.network.ui.showFriendInvite(name, isAccepted => {
            if (this.friendInvite !== invite) return;

            this.friendInvite = null;
            this.network.session.game.answerFriendInvite(isAccepted);
        });
    }

    public onPartyMemberPosition(packet: PacketReader) {
        const count = packet.d();

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 16)) throw new Error(`Invalid PartyMemberPosition count '${count}'.`);

        const positions = [];
        for (let i = 0; i < count; i++) positions.push({ objectId: packet.d(), position: { ...this.network.movement.readLocation(packet) } }); // readLocation returns the shared tmpLocation.

        for (const entry of positions) this.partyPositions.set(entry.objectId, entry.position);
        this.network.ui.setMapPartyMembers(this.partyMembers, this.partyPositions, this.network.actors.userId);
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

    public updateGMCharacterInfo() {
        if (!this.gmCharacterInfo) return;

        const clanId = this.gmCharacterInfo.clanId;
        const clan = clanId > 0 ? this.pledgeInfos.get(clanId) : null;

        this.network.ui.setGMCharacterInfo(this.gmCharacterInfo, clan ? { clanId, name: clan.name, crestId: clan.crestId } : null, clan ? clan.crest : null);
    }

    public onPledgeInfo(packet: PacketReader) {
        const clanId = packet.d(), name = packet.S(), allyName = packet.S();

        if (packet.getRemaining()) throw new Error("Invalid PledgeInfo trailing data.");
        const info = this.pledgeInfos.get(clanId);

        if (clanId > 0 && info) { info.name = name; info.allyName = allyName; this.updateGMCharacterInfo(); }
    }

    public updatePledgeInfo(clanId: number, crestId: number, allyId: number, allyCrestId: number, unknown: number) {
        const info = this.pledgeInfos.get(clanId);

        this.pledgeInfos.set(clanId, { name: info ? info.name : "", allyName: info ? info.allyName : "", crestId, allyId, allyCrestId, unknown, crest: info ? info.crest : null, allyCrest: info ? info.allyCrest : null });
        if (!info || info.allyId !== allyId) this.network.session.game.requestPledgeInfo(clanId);
        this.seedPledgeCrests(clanId, crestId, allyCrestId);
        this.updateGMCharacterInfo();
    }

    public onPledgeStatusChanged(packet: PacketReader) {
        const objectId = packet.d(), clanId = packet.d(), crestId = packet.d(), allyId = packet.d(), allyCrestId = packet.d();
        const unknown = packet.getRemaining() === 4 ? packet.d() : 0; // Retail 0x10428ad0 reads six DWORDs; Lisvus sends five.

        if (objectId < 0 || clanId < 0 || crestId < 0 || allyId < 0 || allyCrestId < 0 || packet.getRemaining()) throw new Error("Invalid PledgeStatusChanged payload.");
        const user = this.network.actors.objects.get(objectId);

        if (!user || clanId <= 0) return;

        user.clanId = clanId;
        user.clanCrestId = crestId;
        user.allyId = allyId;
        user.allyCrestId = allyCrestId;
        this.updatePledgeInfo(clanId, crestId, allyId, allyCrestId, unknown);
        this.network.ui.setPledgeStatus(objectId, clanId);
    }

    public onPledgeShowInfoUpdate(packet: PacketReader) {
        const clanId = packet.d(), crestId = packet.d(), level = packet.d(), hasCastle = packet.d(), hasHideout = packet.d();

        packet.d();

        const memberLevel = packet.d(), dissolving = packet.d();

        packet.d();

        const allyId = packet.d(), allyName = packet.S(), allyCrestId = packet.d(), isAtWar = packet.d();

        if (clanId <= 0 || crestId < 0 || level < 0 || hasCastle < 0 || hasHideout < 0 || memberLevel < 0 || dissolving < 0 || allyId < 0 || allyCrestId < 0 || (isAtWar !== 0 && isAtWar !== 1) || packet.getRemaining())
            throw new Error("Invalid PledgeShowInfoUpdate payload.");

        const current = this.clanInfo;

        this.clanInfo = { leaderId: current?.leaderId || 0, clanId, name: current?.name || "", leaderName: current?.leaderName || "", crestId, level, hasCastle, hasHideout, memberLevel, dissolving, allyId, allyName, allyCrestId, isAtWar: isAtWar !== 0 };
        this.network.ui.setClan(this.clanInfo);
    }

    public onPledgeShowMemberListAll(packet: PacketReader) {
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
        this.network.ui.setClan(this.clanInfo);
        this.network.ui.clearClanMembers();
        for (const member of members) {
            this.clanMembers.set(member.name, member);
            this.network.ui.addClanMember(member);
        }
    }

    public onPledgeShowMemberListUpdate(packet: PacketReader) {
        const member = this.readClanMemberUpdate(packet);

        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListUpdate trailing data.");
        this.setClanMember(member);
        this.network.ui.updateClanMember(member);
    }

    public onPledgeShowMemberListAdd(packet: PacketReader) {
        const member = this.readClanMemberUpdate(packet);

        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListAdd trailing data.");
        this.setClanMember(member);
        this.network.ui.addClanMember(member);
    }

    protected setClanMember(member: GamePackets.ClanMember_T) {
        if (!member.name) throw new Error("Invalid clan member name.");
        this.clanMembers.set(member.name, member);
    }

    public onPledgeShowMemberListDelete(packet: PacketReader) {
        const name = packet.S();

        if (!name || packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListDelete payload.");
        this.clanMembers.delete(name);
        this.network.ui.deleteClanMember(name);
    }

    public onPledgeShowMemberListDeleteAll(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid PledgeShowMemberListDeleteAll payload.");

        this.clanMembers.clear();
        this.clanInfo = null;
        this.network.ui.clearClanMembers();
        this.network.ui.setClan(null);
    }

    public onFriendList(packet: PacketReader) {
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

    public onFriendRecvMsg(packet: PacketReader) {
        packet.d();
        const receiver = packet.S(), sender = packet.S(), message = packet.S();

        if (!receiver || !sender) throw new Error("Invalid FriendRecvMsg names.");
        if (packet.getRemaining()) throw new Error("Invalid FriendRecvMsg trailing data.");

        this.network.ui.addChat(sender, message, GamePackets.Say2_T.TELL);
    }

    public onStatusUpdate(packet: PacketReader) {
        const objectId = packet.d();
        const count = packet.d();
        const object = this.network.actors.objects.get(objectId);
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
        if (objectId === this.network.actors.userId) this.network.ui.updateStatus(status);
        if (objectId === this.network.getTargetId()) this.network.combat.updateTarget();
    }

    public onNicknameChanged(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());
        const title = packet.S();

        if (!object) return;

        object.title = title;
        if (object.objectId === this.network.getTargetId()) this.network.combat.updateTarget();
    }

    public onRelationChanged(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());

        packet.d();
        const isAttackable = packet.d() !== 0;
        const karma = packet.d();
        const pvpFlag = packet.d();

        if (!object) return;

        object.isAttackable = isAttackable;
        object.karma = karma;
        object.pvpFlag = pvpFlag;
        if (object.objectId === this.network.getTargetId()) this.network.combat.updateTarget();
    }

    public onCreatureSay(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());

        const type = packet.d() as GamePackets.Say2_T;
        const name = packet.S(), text = packet.S();

        this.addChat(object, name, text, type);
    }

    protected addChat(object: NetObject_T, name: string, text: string, type: GamePackets.Say2_T) {
        if (object && object.privateStoreType === GamePackets.PrivateStoreType_T.STORE_PRIVATE_NONE && type !== GamePackets.Say2_T.PETITION_PLAYER && type !== GamePackets.Say2_T.PETITION_GM) { // NCConsole 0x1005d5e9..0x1005d811
            object.chatMessage = text.length < 19 ? text : `${text.slice(0, 18)}...`;
            object.chatTime = this.network.getParent().getCurrentTime();
        }

        this.network.ui.addChat(name, text, type);
    }

    public onNpcSay(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());

        const type = packet.d() as GamePackets.Say2_T, id = packet.d() - GamePackets.NPC_ID_OFFSET;
        const text = packet.S();

        if (!text) return;

        this.addChat(object, this.network.actors.npcNames.get(id) || `npc#${id}`, text, type);
    }

    public onSystemMessage(packet: PacketReader) {
        const message = this.readSystemMessage(packet);

        this.network.ui.addSystemMessage(message.text, this.network.ui.getStrings().systemMessageColors[message.id] ?? 0xffb09b79, this.network.ui.getStrings().systemMessageGroups[message.id] ?? 0);
        this.playSystemMessageSound(message.id);
    }

    public onConfirmDlg(packet: PacketReader) {
        const message = this.readSystemMessage(packet);

        if (message.id !== 0 && this.network.ui.getStrings().systemMessages[message.id] === undefined) throw new Error(`Unknown ConfirmDlg message ${message.id}.`);

        this.network.ui.showConfirm(message.id, message.text, isOk => this.network.session.game.dlgAnswer(message.id, isOk));
    }

    public playSystemMessageSound(id: number) {
        this.network.ui.playSystemMessageSound(id);
    }

    protected readSystemMessage(packet: PacketReader) {
        const strings = this.network.ui.getStrings();
        const messageId = packet.d();
        const count = packet.d();
        const params: string[] = [];

        if (count < 0 || count > Math.floor(packet.getRemaining() / 6)) throw new Error(`Invalid SystemMessage parameter count ${count}.`);

        for (let i = 0; i < count; i++) {
            switch (packet.d()) {
                case GamePackets.SystemMessageParam_T.TYPE_TEXT: params.push(packet.S()); break;
                case GamePackets.SystemMessageParam_T.TYPE_NUMBER: params.push(String(packet.d())); break;
                case GamePackets.SystemMessageParam_T.TYPE_NPC_NAME: { const id = packet.d() - GamePackets.NPC_ID_OFFSET; params.push(this.network.actors.npcNames.get(id) || `npc#${id}`); break; }
                case GamePackets.SystemMessageParam_T.TYPE_ITEM_NAME: { const id = packet.d(); params.push(strings.itemNames[id] || `item#${id}`); break; }
                case GamePackets.SystemMessageParam_T.TYPE_SKILL_NAME: { const id = packet.d(); packet.d(); params.push(strings.skillNames[id] || `skill#${id}`); break; }
                default: throw new Error(`Unknown SystemMessage parameter type in message ${messageId}.`);
            }
        }

        const template = strings.systemMessages[messageId];

        const text = template === undefined ? `SystemMessage ${messageId} ${params.join(" ")}` : template.replace(/\$[sc](\d)/g, (match, index) => params[Number(index) - 1] ?? "");

        return { id: messageId, text };
    }

    public onManagePledgePower(packet: PacketReader) {
        packet.skip(8);

        if (packet.getRemaining() !== 4 && packet.getRemaining() !== 32) throw new Error(`Invalid ManagePledgePower size ${packet.getRemaining()}.`);

        const privs = new Uint8Array(32);

        privs.set(packet.b(packet.getRemaining()));

        this.pledgePower = privs;
        this.network.ui.setPledgePower(privs);
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
            const canvas = this.network.ui.getCachedCrest(crestId);

            if (canvas) this.bindImportedCrest(crestId, canvas, false);
            else this.network.session.game.requestPledgeCrest(crestId);
        }
        if (allyCrestId === 0) info.allyCrest = null;
        else if (info.allyId > 0 && allyCrestId > 0) {
            const canvas = this.network.ui.getCachedCrest(allyCrestId);

            if (canvas) this.bindImportedCrest(allyCrestId, canvas, true);
            else this.network.session.game.requestAllyCrest(allyCrestId);
        }
    }

    public onNpcHtmlMessage(packet: PacketReader) {
        packet.d();
        const html = packet.S(), type = packet.d();

        if (packet.getRemaining()) throw new Error(`Invalid NpcHtmlMessage trailing data.`);
        this.network.ui.showNpcHtml(html, type);
    }

    public onPledgeCrest(packet: PacketReader) {
        const crest = GamePackets.readCrest(packet);

        this.pledgeCrests.set(crest.crestId, crest.data);
        this.bindImportedCrest(crest.crestId, this.network.ui.setPledgeCrest(crest.crestId, crest.data), false);
    }

    public onAllyCrest(packet: PacketReader) {
        const crest = GamePackets.readCrest(packet);

        this.allyCrests.set(crest.crestId, crest.data);
        this.bindImportedCrest(crest.crestId, this.network.ui.setPledgeCrest(crest.crestId, crest.data), true);
    }

    public onPledgeCrestLarge(packet: PacketReader) {
        const crest = GamePackets.readPledgeCrestLarge(packet);

        this.clanLargeCrestIds.set(crest.clanId, crest.crestId);

        if (crest.data.length) this.pledgeLargeCrests.set(crest.crestId, crest.data);
        else this.pledgeLargeCrests.delete(crest.crestId);
    }

    public onAskJoinAlly(packet: PacketReader) {
        const requestorId = packet.d(), requestorName = packet.S(), unknown = packet.S(), allyName = packet.S();

        if (requestorId <= 0 || !requestorName || unknown || !allyName || packet.getRemaining()) throw new Error("Invalid AskJoinAlly payload.");

        const invite: GamePackets.AllyInvite_T = { requestorId, requestorName, allyName };
        this.allyInvite = invite;
        this.network.ui.showAllyInvite(requestorName, allyName, isAccepted => {
            if (this.allyInvite !== invite) return;

            this.allyInvite = null;
            this.network.session.game.answerJoinAlly(isAccepted);
        });
    }

    public getPledgePower() { return this.pledgePower; }

    public getClanInfo() { return this.clanInfo; }

    public getPledgeCrest(crestId: number) { return this.pledgeCrests.get(crestId); }

    public getPledgeLargeCrest(crestId: number) { return this.pledgeLargeCrests.get(crestId); }

    public getClanLargeCrestId(clanId: number) { return this.clanLargeCrestIds.get(clanId); }

    public getAllyCrest(crestId: number) { return this.allyCrests.get(crestId); }

    public requestPledgeInfo(clanId: number) { if (this.network.actors.inWorld) this.network.session.game.requestPledgeInfo(clanId); }

    public requestPledgeMemberList() { if (this.network.actors.inWorld) this.network.session.game.requestPledgeMemberList(); }

    public getSelectedPlayer() { const target = this.network.actors.objects.get(this.network.getTargetId()); return target && (target.kind === "user" || target.kind === "player") ? target : null; }

    public invitePledge(objectId: number) { if (this.network.actors.inWorld) this.network.session.game.requestJoinPledge(objectId); }

    public withdrawPledge() { if (this.network.actors.inWorld) this.network.session.game.requestWithdrawalPledge(); }

    public oustPledgeMember(name: string) { if (this.network.actors.inWorld) this.network.session.game.requestOustPledgeMember(name); }

    public giveNickName(name: string, title: string) { if (this.network.actors.inWorld) this.network.session.game.requestGiveNickName(name, title); }

    public requestPledgePower() { if (this.network.actors.inWorld) this.network.session.game.requestPledgePower(this.network.actors.userId); }

    public requestMemberPledgePower(objectId: number) { if (this.network.actors.inWorld) this.network.session.game.requestMemberPledgePower(objectId); }

    public setMemberPledgePower(objectId: number, privs: Uint8Array) { if (this.network.actors.inWorld) this.network.session.game.setMemberPledgePower(objectId, privs); }

    public startPledgeWar(pledgeName: string) { if (this.network.actors.inWorld) this.network.session.game.requestStartPledgeWar(pledgeName); }

    public stopPledgeWar(pledgeName: string) { if (this.network.actors.inWorld) this.network.session.game.requestStopPledgeWar(pledgeName); }

    public surrenderPledgeWar(pledgeName: string) { if (this.network.actors.inWorld) this.network.session.game.requestSurrenderPledgeWar(pledgeName); }

    public surrenderPersonally(pledgeName: string) { if (this.network.actors.inWorld) this.network.session.game.requestSurrenderPersonally(pledgeName); }

    public replyStartPledgeWar(isAccepted: boolean) {
        if (!this.pledgeWarStart) throw new Error("No pending StartPledgeWar to reply to.");

        this.network.session.game.requestReplyStartPledgeWar(this.pledgeWarStart.charName, isAccepted);
        this.pledgeWarStart = null;
    }

    public replyStopPledgeWar(isAccepted: boolean) {
        if (!this.pledgeWarStop) throw new Error("No pending StopPledgeWar to reply to.");

        this.network.session.game.requestReplyStopPledgeWar(this.pledgeWarStop.charName, isAccepted);
        this.pledgeWarStop = null;
    }

    public replySurrenderPledgeWar(isAccepted: boolean) {
        if (!this.pledgeWarSurrender) throw new Error("No pending SurrenderPledgeWar to reply to.");

        this.network.session.game.requestReplySurrenderPledgeWar(this.pledgeWarSurrender.charName, isAccepted);
        this.pledgeWarSurrender = null;
    }

    public requestPledgeCrest(crestId: number) { if (this.network.actors.inWorld && !this.pledgeCrests.has(crestId)) this.network.session.game.requestPledgeCrest(crestId); }

    public requestPledgeLargeCrest(crestId: number) { if (this.network.actors.inWorld && !this.pledgeLargeCrests.has(crestId)) this.network.session.game.requestExPledgeCrestLarge(crestId); }

    public requestAllyCrest(crestId: number) { if (this.network.actors.inWorld && !this.allyCrests.has(crestId)) this.network.session.game.requestAllyCrest(crestId); }

    public setPledgeCrest(data: Uint8Array) {
        if (data.length > PLEDGE_CREST_MAX_BYTES) throw new Error(`Pledge crest is ${data.length} bytes, server limit is ${PLEDGE_CREST_MAX_BYTES}.`);
        if (this.network.actors.inWorld) this.network.session.game.requestSetPledgeCrest(data);
    }

    public setPledgeLargeCrest(data: Uint8Array) {
        if (data.length > PLEDGE_LARGE_CREST_MAX_BYTES) throw new Error(`Large pledge crest is ${data.length} bytes, server limit is ${PLEDGE_LARGE_CREST_MAX_BYTES}.`);
        if (this.network.actors.inWorld) this.network.session.game.requestExSetPledgeCrestLarge(data);
    }

    public setAllyCrest(data: Uint8Array) {
        if (data.length > ALLY_CREST_MAX_BYTES) throw new Error(`Ally crest is ${data.length} bytes, server limit is ${ALLY_CREST_MAX_BYTES}.`);
        if (this.network.actors.inWorld) this.network.session.game.requestSetAllyCrest(data);
    }

    public requestJoinAlly(objectId: number) { if (this.network.actors.inWorld) this.network.session.game.requestJoinAlly(objectId); }

    public leaveAlly() { if (this.network.actors.inWorld) this.network.session.game.allyLeave(); }

    public dismissAllyClan(clanName: string) { if (this.network.actors.inWorld) this.network.session.game.allyDismiss(clanName); }

    public dissolveAlly() { if (this.network.actors.inWorld) this.network.session.game.requestDismissAlly(); }

    public requestAllyInfo() { if (this.network.actors.inWorld) this.network.session.game.requestAllyInfo(); }

    public onRadarControl(packet: PacketReader) {
        const radar = GamePackets.readRadarControl(packet);

        switch (radar.action) {
            case GamePackets.RadarAction_T.ADD:
                this.questArrowDestination = { x: radar.x, y: radar.y, z: radar.z };
                if (radar.type === GamePackets.RadarType_T.RADAR || radar.type === GamePackets.RadarType_T.BOTH) this.radarMarkers.push({ x: radar.x, y: radar.y, z: radar.z });
                if (radar.type === GamePackets.RadarType_T.MAP || radar.type === GamePackets.RadarType_T.BOTH) this.mapMarkers.push({ x: radar.x, y: radar.y, z: radar.z });
                break;
            case GamePackets.RadarAction_T.REMOVE: {
                if (radar.type === GamePackets.RadarType_T.RADAR || radar.type === GamePackets.RadarType_T.BOTH) {
                    const index = this.radarMarkers.findIndex(marker => marker.x === radar.x && marker.y === radar.y && marker.z === radar.z);

                    if (index >= 0) this.radarMarkers.splice(index, 1);
                }
                if (radar.type === GamePackets.RadarType_T.MAP || radar.type === GamePackets.RadarType_T.BOTH)
                    for (let i = 0; i < this.mapMarkers.length; i++) {
                        const marker = this.mapMarkers[i];

                        if (marker.x === radar.x && marker.y === radar.y && marker.z === radar.z) this.mapMarkers.splice(i, 1);
                    }
            } break;
            case GamePackets.RadarAction_T.CLEAR: this.questArrowDestination = null; this.radarMarkers.length = this.mapMarkers.length = 0; break;
            default: throw new Error(`Unknown RadarControl action '${radar.action}'.`);
        }

        this.network.ui.setMapMarkers(this.mapMarkers);
    }

    public onSSQStatus(packet: PacketReader) {
        const status = GamePackets.readSSQStatus(packet);

        this.ssqStatus.set(status.page, status);
        this.network.ui.showSSQStatus(status);
    }

    public onGameGuardQuery(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid GameGuardQuery payload.");

        this.network.session.game.gameGuardReply();
    }

    public getRadarMarkers(): readonly GamePackets.Location_T[] { return this.radarMarkers; }

    public getTownMap() { return this.townMap; }

    public getCalculatorId() { return this.calculatorId; }

    public getXMasSealItemId() { return this.xmasSealItemId; }

    public getMonRace() { return this.monRace; }

    public getSSQStatus(page: number) { return this.ssqStatus.get(page) || null; }

    public getClanHallDecoration(clanHallId: number) { return this.clanHallDecoration.get(clanHallId) || null; }

    public getSiegeInfo() { return this.siegeInfo; }

    public getSiegeAttackers() { return this.siegeAttackers; }

    public getSiegeDefenders() { return this.siegeDefenders; }

    public requestSSQStatus(page: GamePackets.SSQPage_T) { if (this.network.actors.inWorld) this.network.session.game.requestSSQStatus(page); }

    public requestSiegeAttackerList(castleId: number) { if (this.network.actors.inWorld) this.network.session.game.requestSiegeAttackerList(castleId); }

    public requestSiegeDefenderList(castleId: number) { if (this.network.actors.inWorld) this.network.session.game.requestSiegeDefenderList(castleId); }

    public requestJoinSiege(castleId: number, isAttacker: boolean, isJoining: boolean) { if (this.network.actors.inWorld) this.network.session.game.requestJoinSiege(castleId, isAttacker, isJoining); }

    public confirmSiegeWaitingList(castleId: number, clanId: number, isApproved: boolean) { if (this.network.actors.inWorld) this.network.session.game.requestConfirmSiegeWaitingList(castleId, clanId, isApproved); }

    public onPartySpelled(packet: PacketReader) {
        const spelled = GamePackets.readPartySpelled(packet);

        this.partyEffects.set(spelled.objectId, spelled);
        this.network.ui.setPetStatusEffects(spelled);
    }

    public onSnoop(packet: PacketReader) {
        const snoop = GamePackets.readSnoop(packet);
        const messages = this.snoops.get(snoop.conversationId);

        if (messages) messages.push(snoop);
        else this.snoops.set(snoop.conversationId, [snoop]);
    }

    public getPartyMatchRooms() { return this.partyMatchRooms; }

    public isInParty() { return this.partyMembers.size > 0; }

    public getPartyMatchPage() { return this.partyMatchPage; }

    public getPartyMatchDetail() { return this.partyMatchDetail; }

    public getPartyEffects(objectId: number) { return this.partyEffects.get(objectId); }

    public getTutorialQuestionMarks() { return this.tutorialQuestionMarks; }

    public getTutorialClientEvents() { return this.tutorialClientEvents; }

    public getSnoops() { return this.snoops; }

    public requestPartyMatchConfig(page: number, location: number, limit: number) { if (this.network.actors.inWorld) this.network.session.game.requestPartyMatchConfig(page, location, limit); }

    public requestPartyMatchList(roomId: number, maxMembers: number, minLevel: number, maxLevel: number, lootType: number, title: string) { if (this.network.actors.inWorld) this.network.session.game.requestPartyMatchList(roomId, maxMembers, minLevel, maxLevel, lootType, title); } // Creates (roomId 0) or edits a party room.

    public requestPartyMatchDetail(roomId: number, location = 0) { if (this.network.actors.inWorld) this.network.session.game.requestPartyMatchDetail(roomId, location); }

    public inviteToParty(name: string, lootType: number) { if (this.network.actors.inWorld) this.network.session.game.requestJoinParty(name, lootType); }

    public withdrawParty() { if (this.network.actors.inWorld) this.network.session.game.requestWithDrawalParty(); }

    public oustPartyMember(name: string) { if (this.network.actors.inWorld) this.network.session.game.requestOustPartyMember(name); }

    public tutorialLink(link: string) { if (this.network.actors.inWorld) this.network.session.game.requestTutorialLinkHtml(link); }

    public tutorialPassCmd(command: string) { if (this.network.actors.inWorld) this.network.session.game.requestTutorialPassCmdToServer(command); }

    public tutorialClientEvent(eventId: number) { if (this.network.actors.inWorld) this.network.session.game.requestTutorialClientEvent(eventId); }

    public tutorialQuestionMark(id: number) {
        if (!this.network.actors.inWorld) return;

        this.network.session.game.requestTutorialQuestionMark(id);
        this.tutorialQuestionMarks.delete(id);
    }

    public gmCommand(targetName: string, command: number) { if (this.network.actors.inWorld) this.network.session.game.requestGMCommand(targetName, command); }

    public requestGmList() { if (this.network.actors.inWorld) this.network.session.game.requestGmList(); }

    public snoopQuit(objectId: number) {
        if (!this.network.actors.inWorld) return;

        this.network.session.game.snoopQuit(objectId);
        this.snoops.delete(objectId);
    }

    public petition(content: string, type: number) { if (this.network.actors.inWorld) this.network.session.game.requestPetition(content, type); }

    public cancelPetition() { if (this.network.actors.inWorld) this.network.session.game.requestPetitionCancel(); }

    public requestFriendList() { if (this.network.actors.inWorld) this.network.session.game.requestFriendList(); }

    public deleteFriend(name: string) { if (this.network.actors.inWorld) this.network.session.game.requestFriendDel(name); }

    public sendFriendMessage(receiver: string, message: string) { if (this.network.actors.inWorld) this.network.session.game.requestSendFriendMsg(message, receiver); }

    public block(type: GamePackets.BlockType_T, name: string = null) { if (this.network.actors.inWorld) this.network.session.game.requestBlock(type, name); }

    public userCommand(id: number) { if (this.network.actors.inWorld) this.network.session.game.requestUserCommand(id); }

    public evaluate(objectId: number) { if (this.network.actors.inWorld) this.network.session.game.requestEvaluate(objectId); }

    public showBoard() { if (this.network.actors.inWorld) this.network.session.game.requestShowBoard(1); }

    public writeBoard(url: string, arg1: string, arg2: string, arg3: string, arg4: string, arg5: string) { if (this.network.actors.inWorld) this.network.session.game.requestBBSwrite(url, arg1, arg2, arg3, arg4, arg5); }

    public onEventMatchMessage(packet: PacketReader) {
        const type = packet.c() as GamePackets.EventMatchMessage_T;
        const message = type === GamePackets.EventMatchMessage_T.STRING ? packet.S() : "";

        if (type > GamePackets.EventMatchMessage_T.STATIC_5 || packet.getRemaining()) throw new Error(`Invalid ExEventMatchMessage type ${type}.`);

        this.eventMatchMessageType = type;

        if (type === GamePackets.EventMatchMessage_T.STRING) this.network.ui.showMessage(message);
    }

    public onPartyRoomMember(packet: PacketReader) {
        const room = GamePackets.readPartyRoomMembers(packet);

        this.partyRoomMode = room.mode;
        this.partyRoomMembers.clear();
        for (const member of room.members.slice(0, 20)) this.partyRoomMembers.set(member.objectId, member);
        this.network.ui.setPartyRoomMembers(this.partyRoomMode, Array.from(this.partyRoomMembers.values()), true);
    }

    public onManagePartyRoomMember(packet: PacketReader) {
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
        if (member.objectId === this.network.actors.userId) this.partyRoomMode = mode === GamePackets.PartyRoomMemberChange_T.REMOVE || mode === GamePackets.PartyRoomMemberChange_T.MODIFY && !this.partyRoomMembers.has(member.objectId) ? 0 : member.role;
        this.network.ui.setPartyRoomMembers(this.partyRoomMode, Array.from(this.partyRoomMembers.values()), false);
    }

    public onClosePartyRoom(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExClosePartyRoom payload.");

        this.partyRoomMode = -1;
        this.partyRoomMembers.clear();
        this.network.ui.closePartyRoom();
    }

    public onShowQuestMark(packet: PacketReader) {
        const questId = packet.d();

        if (questId <= 0 || packet.getRemaining()) throw new Error("Invalid ExShowQuestMark payload.");

        this.questMarkId = questId;
    }

    public onOpenMPCC(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExOpenMPCC payload.");

        this.isInCommandChannel = true;
        this.network.ui.openCommandChannel();
    }

    public onCloseMPCC(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExCloseMPCC payload.");

        this.isInCommandChannel = false;
        this.commandChannel = null;
        this.network.ui.closeCommandChannel();
    }

    public onAskJoinMPCC(packet: PacketReader) {
        const name = packet.S();

        if (!name || packet.getRemaining()) throw new Error("Invalid ExAskJoinMPCC payload.");

        this.commandChannelInviter = name;
        this.network.ui.showCommandChannelInvite(name, isAccepted => {
            if (this.commandChannelInviter !== name) return;

            this.answerCommandChannelInvite(isAccepted);
        });
    }

    public onOlympiadMode(packet: PacketReader) {
        const mode = packet.c();

        if (mode > 3 || packet.getRemaining()) throw new Error(`Invalid ExOlympiadMode ${mode}.`);

        this.olympiadMode = mode;
        this.network.ui.setOlympiadMode(mode);
    }

    public onOlympiadMatchEnd(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExOlympiadMatchEnd payload.");

        this.olympiadUsers.clear();
        this.olympiadEffects.clear();
        this.network.ui.resetOlympiadMatch();
    }

    public onMailArrived(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid ExMailArrived payload.");

        this.hasNewMail = true;
    }

    public oustFromPartyRoom(objectId: number) { if (this.network.actors.inWorld && this.partyRoomMembers.has(objectId)) this.network.session.game.requestOustFromPartyRoom(objectId); }

    public dismissPartyRoom(roomId: number) { if (this.network.actors.inWorld) this.network.session.game.requestDismissPartyRoom(roomId); }

    public withdrawPartyRoom(roomId: number) { if (this.network.actors.inWorld) this.network.session.game.requestWithdrawPartyRoom(roomId); }

    public changePartyLeader(name: string) { if (this.network.actors.inWorld) this.network.session.game.requestChangePartyLeader(name); }

    public writeHeroWords(words: string) { if (this.network.actors.inWorld) this.network.session.game.requestWriteHeroWords(words); }

    public inviteToCommandChannel(name: string) { if (this.network.actors.inWorld) this.network.session.game.requestExAskJoinMPCC(name); }

    public oustFromCommandChannel(name: string) { if (this.network.actors.inWorld) this.network.session.game.requestExOustFromMPCC(name); }

    public endOlympiadObserver() { if (this.network.actors.inWorld) this.network.session.game.requestOlympiadObserverEnd(); }

    public requestOlympiadMatchList() { if (this.network.actors.inWorld) this.network.session.game.requestOlympiadMatchList(); }

    public answerCommandChannelInvite(isAccepted: boolean) {
        if (!this.network.actors.inWorld || !this.commandChannelInviter) return;

        this.commandChannelInviter = null;
        this.network.session.game.requestExAcceptJoinMPCC(isAccepted);
    }
}

export default NetworkCommunity;
