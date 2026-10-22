import type NetworkManager from "./network-manager";
import { Vector3, type Object3D } from "three";
import BaseActor from "../base-actor";
import type { NAttackActionParam_T } from "../objects/components/pawn-attack-component";
import type { Nameplate_T } from "../nwindow/nconsole-wnd";
import { CommandType_T } from "./command-parser";
import GroundPickup from "../objects/ground-pickup";
import L2Dice from "../objects/l2-dice";
import type { SectorObject } from "../objects/zone-object";
import { getRotatorQuaternionElements } from "../assets/unreal/utils/rotator";
import * as GamePackets from "./game-packets";
import PacketReader from "./packet-reader";
import type { ICharacterArmorSelection, INpcDefinition } from "@l2js/engine/contracts/pawn";
import type MovableObject from "../objects/movable-object";
import { setVector } from "./network-location";
import { ENetMode_T } from "../assets/unreal/un-level-info";

type NetObjectKind_T = "user" | "player" | "npc";

export type NetSkill_T = { id: number, level: number, hitTime: number, receivedTime: number, associatedActors: BaseActor[], associatedObjectIds: number[] };

type PendingAttack_T = { hits: readonly NAttackActionParam_T[], position: GamePackets.Location_T };

type PendingSkill_T = { targetObjectId: number, id: number, level: number, hitTime: number, receivedTime: number, position: GamePackets.Location_T, isTransient: boolean, associatedObjectIds: number[] };

export type NetObject_T = {
    objectId: number;
    npcId: number;
    selectedId: number;
    clanId: number;
    clanCrestId: number;
    allyId: number;
    allyCrestId: number;
    kind: NetObjectKind_T;
    actor: BaseActor;
    actorReady: Promise<BaseActor>;
    resolveActor: (actor: BaseActor) => void;
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
    hasQuestMark: boolean;
    isAttackable: boolean;
    isDead: boolean;
    appearanceKey: string;
    speeds: GamePackets.Speeds_T;
    isRunning: boolean;
    environment: number;
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
    pendingFly: { origin: Vector3, destination: Vector3 };
    pendingVehicleMove: { vehicleId: number, position: Vector3 };
    pendingRotation: { direction: number, speed: number };
    pendingAttack: PendingAttack_T;
    pendingSkill: PendingSkill_T;
    pendingTransientSkills: PendingSkill_T[];
};

type PetRemainTime_T = { maxTime: number, remainingTime: number };

const MYSTIC_BODY_CLASS_IDS = new Set([10, 11, 12, 13, 14, 15, 16, 17, 25, 26, 27, 28, 29, 30, 38, 39, 40, 41, 42, 43, 49, 50, 51, 52, 94, 95, 96, 97, 98, 103, 104, 105, 110, 111, 112, 115, 116]); // ClassId.isMage excludes orcMage (49), which uses the Shaman body.

const NAMEPLATE_DISTANCE = 1000;

const CHAT_BALLOON_TIME = 6000; // NCConsole 0x1005f070: 1 s timer, the balloon is cleared on the sixth tick.

const NETWORK_BOW_RANGE = 2000;

const NPC_SPAWN_CONCURRENCY = 8;

export class NetworkActors {
    public readonly objects = new Map<number, NetObject_T>();
    public readonly doors = new Map<number, MovableObject>();
    public readonly doorPositions = new Map<number, number>();
    public readonly staticObjects = new Map<number, number>();
    public readonly appearances = new Map<number, GamePackets.Appearance_T>();
    public readonly pickups = new Map<number, GroundPickup>();
    public readonly npcNames = new Map<number, string>();
    public readonly appearanceLoads = new WeakMap<BaseActor, Promise<void>>();
    protected readonly bodyKeys = new WeakMap<BaseActor, string>();
    protected readonly appearanceRequests = new WeakMap<BaseActor, number>();
    public petStatusType = -1;
    public deletedPetId = 0;
    public petInfo: GamePackets.PetStatus_T = { objectId: -1, npcId: -GamePackets.NPC_ID_OFFSET, name: "", x: 0, y: 0, z: 0, statusType: 0, curFood: 0, maxFood: 0, curHp: 0, maxHp: 0, curMp: 0, maxMp: 0, field42: 0, level: 0, exp: 0, minExp: 0, nextExp: 0, weight: 0, maxWeight: 0, pAtk: 0, pDef: 0, mAtk: 0, mDef: 0, accuracy: 0, evasion: 0, critical: 0, speed: 0, attackSpeed: 0, castSpeed: 0, field60: 0, isMountable: false, soulshotsUsed: 0, spiritshotsUsed: 0 };
    public npcSpawnCount = 0;
    public readonly npcSpawnWaiters: (() => void)[] = [];
    public petRemainTime: PetRemainTime_T = null;
    public userId = 0;
    public userInfo: GamePackets.UserInfo_T = null;
    public inWorld = false;
    public worldLevel: SectorObject = null;
    public teleportGeneration = 0;
    public teleportInfoPending = false;
    public userAppearanceLoad: Promise<void> = null;
    public worldLoad: Promise<void> = null;
    public dice: GamePackets.Dice_T = null;

    public constructor(protected readonly network: NetworkManager) {}

    public hasServerObject(objectId: number): boolean {
        if (this.objects.has(objectId) || this.pickups.has(objectId) || this.doors.has(objectId)) return true;
        for (const id of this.staticObjects.values()) if (id === objectId) return true;

        return false;
    }

    public async loadNpcNames() {
        for (const npc of await this.network.getParent().getComponent("render").listNpcs()) this.npcNames.set(npc.id, npc.name);
    }

    public findObjectByActor(actor: Object3D): NetObject_T {
        for (const object of this.objects.values())
            if (object.actor === actor) return object;

        return null;
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
        const group = this.network.session.charGroups.find(group => group.name === name);

        if (!group) throw new Error(`No character group named '${name}'.`);

        return group.index;
    }

    protected getArmor(paperdoll: number[]): ICharacterArmorSelection {
        return { chest: paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST], legs: paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LEGS], gloves: paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_GLOVES], boots: paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_FEET] };
    }

    public getAppearanceKey(appearance: GamePackets.Appearance_T) {
        const paperdoll = appearance.paperdoll;

        return [appearance.race, appearance.sex, appearance.classId, appearance.face, appearance.hairStyle, appearance.hairColor, appearance.enchantLevel, paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LEGS], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_GLOVES], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_FEET], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_RHAND], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LHAND], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LRHAND], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HEAD], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HAIR]].join(":");
    }

    public loadAppearance(appearance: GamePackets.Appearance_T, actor: BaseActor): Promise<void> {
        const load = this.applyAppearance(appearance, actor);

        this.appearanceLoads.set(actor, load);

        return load;
    }

    protected async applyAppearance(appearance: GamePackets.Appearance_T, actor: BaseActor) {
        const asset = this.network.getParent().getComponent("asset");
        const paperdoll = appearance.paperdoll;
        const bodyKey = [appearance.race, appearance.sex, appearance.classId, appearance.face, appearance.hairStyle, appearance.hairColor, paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LEGS], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_GLOVES], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_FEET], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HEAD], paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HAIR]].join(":");
        const isEquipmentOnly = this.bodyKeys.get(actor) === bodyKey;
        const request = (this.appearanceRequests.get(actor) || 0) + 1;

        this.appearanceRequests.set(actor, request);

        if (!isEquipmentOnly) this.bodyKeys.delete(actor);
        if (!this.network.session.charGroups) this.network.session.charGroups = await asset.getCharGroups();

        const index = this.getCharacterIndex(appearance);
        const group = this.network.session.charGroups.find(group => group.index === index);

        actor.charClassId = this.getMeshType(appearance);
        const hairStyle = group.hairStyles.includes(appearance.hairStyle) ? appearance.hairStyle : group.hairStyles[0];
        const colours = group.hairColours[hairStyle];

        const equipment = { enchantLevel: appearance.enchantLevel, rightHand: appearance.paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_RHAND] || appearance.paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LRHAND], leftHand: appearance.paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LHAND], head: appearance.paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HEAD], hair: appearance.paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_HAIR] };

        if (isEquipmentOnly) await asset.loadCharacterEquipment(this.network.getParent().getComponent("render"), actor, index, hairStyle, equipment);
        else {
            await asset.loadCharacter(this.network.getParent().getComponent("render"), index, Math.min(appearance.face, group.faceVariants - 1), hairStyle, colours.includes(appearance.hairColor) ? appearance.hairColor : colours[0], this.getArmor(appearance.paperdoll), actor, equipment);

            if (this.appearanceRequests.get(actor) === request) this.bodyKeys.set(actor, bodyKey);
        }

        const object = this.findObjectByActor(actor);

        if (object && object.kind === "user" || this.network.movement.riders.get(this.userId) === actor)
            actor.setUnrealScriptProperty("CanIngnoreCollision", false);

        if (object) {
            actor.setUnrealScriptProperty("bNpc", object.kind === "npc");
            this.network.community.applySpeeds(actor, object.speeds, object.isRunning);
            this.network.combat.setIdleAnimation(object);
            this.network.community.applyPartyMember(object);
        }

        for (const [objectId, rider] of this.network.movement.riders) {
            if (rider !== actor) continue;

            const mount = this.objects.get(objectId).actor;

            mount.playMovementAnimation(mount.isLocomoting() ? "running" : "idle");
        }

    }

    public async enterWorld(entry: GamePackets.Appearance_T) {
        const render = this.network.getParent().getComponent("render");
        const asset = this.network.getParent().getComponent("asset");
        const physics = this.network.getParent().getComponent("physics");
        const generation = this.teleportGeneration;
        const [x, y] = render.getSectorId(render.player.position);

        asset.setStreaming(render, false);
        const level = await asset.setAlwaysLoaded(render, `${x}_${y}`);

        if (generation !== this.teleportGeneration) {
            asset.unloadAlwaysLoaded(render, `${x}_${y}`, level);
            return;
        }

        this.worldLevel = level;
        render.setLevel(level, ENetMode_T.NM_Client);
        asset.setStreaming(render, true);

        await this.loadAppearance(entry, render.player);

        if (generation !== this.teleportGeneration) return;

        render.player.setUnrealScriptProperty("Level", level.levelInfoActor as any);
        physics.setPawnZone(render.player, false, true);
        physics.setPawnVolumes(render.player);
        this.userAppearanceLoad = null;
        if (this.network.session.game.isPlayingReplay()) this.network.items.skillListLoad = this.network.items.resolveSkillList = null;
        else this.network.items.skillListLoad = new Promise(resolve => this.network.items.resolveSkillList = resolve);
        this.network.session.game.enterWorld();
        this.network.session.game.requestSkillList();
        this.network.session.game.requestSkillCoolTime();
    }

    protected createObject(objectId: number, kind: NetObjectKind_T, info: GamePackets.CreatureInfo_T): NetObject_T {
        const object: NetObject_T = { objectId, npcId: kind === "npc" ? (info as GamePackets.NpcInfo_T).npcId : 0, selectedId: 0, clanId: 0, clanCrestId: 0, allyId: 0, allyCrestId: 0, kind, actor: null, actorReady: null, resolveActor: null, isRemoved: false, position: setVector(new Vector3(), info), destination: null, heading: info.heading, name: info.name, title: info.title, curHp: 0, maxHp: 0, curMp: 0, maxMp: 0, levelDifference: 0, karma: info.karma, pvpFlag: info.pvpFlag, recommendations: info.recommendations, nameColor: info.nameColor, titleColor: 0, isSummon: false, hasQuestMark: false, isAttackable: false, isDead: info.isAlikeDead, chairStaticObjectId: 0, cubics: (info as any).cubics || [], abnormalState: info.abnormalState, fishing: null, appearanceKey: null, speeds: info, isRunning: info.isRunning, environment: null, isInCombat: info.isInCombat, waitType: (info as any).isSitting ? GamePackets.WaitType_T.WT_SITTING : GamePackets.WaitType_T.WT_STANDING, privateStoreType: (info as any).privateStoreType || GamePackets.PrivateStoreType_T.STORE_PRIVATE_NONE, chatMessage: null, chatTime: 0, pendingFly: null, pendingVehicleMove: null, pendingRotation: null, pendingAttack: null, pendingSkill: null, pendingTransientSkills: [] };

        object.actorReady = new Promise(resolve => object.resolveActor = resolve);
        this.objects.set(objectId, object);
        this.network.combat.flushPendingSkills(objectId);

        return object;
    }

    public onDoorInfo(packet: PacketReader) {
        const objectId = packet.d(), doorId = packet.d();

        if (objectId <= 0 || doorId <= 0 || packet.getRemaining()) throw new Error("Invalid DoorInfo payload.");

        const mover = this.network.getParent().getComponent("render").findMovableByRealId(doorId);
        if (mover) this.doors.set(objectId, mover);
    }

    public onDoorStatusUpdate(packet: PacketReader) {
        const objectId = packet.d(), isOpen = packet.d(), damage = packet.d(), showHp = packet.d(), doorId = packet.d(), maxHp = packet.d(), currentHp = packet.d();

        if (objectId <= 0 || (isOpen !== 0 && isOpen !== 1) || damage < 0 || (showHp !== 0 && showHp !== 1) || doorId <= 0 || maxHp < 0 || currentHp < 0 || currentHp > maxHp || packet.getRemaining())
            throw new Error("Invalid DoorStatusUpdate payload.");

        const mover = this.network.getParent().getComponent("render").findMovableByRealId(doorId);

        this.doorPositions.set(doorId, isOpen === 0 ? 1 : 0);
        if (mover) mover.setPosition(isOpen === 0 ? 1 : 0);
    }

    public getDoorPosition(mover: MovableObject): number { return this.doorPositions.get((mover as any).scriptProperties?.get("L2ServerObjectRealID")); }

    public onUserInfo(packet: PacketReader) {
        const info = GamePackets.readUserInfo(packet);
        const render = this.network.getParent().getComponent("render");
        const player = this.network.movement.riders.get(info.objectId) || render.player;
        const isFirst = !this.inWorld;
        let object = this.objects.get(info.objectId);

        info.isRunning = this.network.movement.isRunning;

        if (this.userInfo) {
            const played = new Set<number>();

            for (let slot = 0; slot < info.paperdollObjects.length; slot++) {
                const previous = this.userInfo.paperdollObjects[slot], current = info.paperdollObjects[slot];
                const objectId = current || previous;

                if (previous === current || played.has(objectId)) continue;

                played.add(objectId);
                const itemId = current ? info.paperdoll[slot] : this.userInfo.paperdoll[slot];
                const sound = this.network.ui.getStrings().itemInfos[itemId].equipSound;

                if (sound && sound.toLowerCase() !== "none") void this.network.getParent().getComponent("audio").playInterfaceSound(sound); // Engine 0x10424468/0x10424549: UserInfo equipment transitions, outgoing sound on removal.
            }
        }

        this.userInfo = info;

        if (!object) {
            object = this.createObject(info.objectId, "user", info);
            object.actor = player;
            object.resolveActor(player);
            object.appearanceKey = this.getAppearanceKey(this.network.session.game.isPlayingReplay() ? info : this.network.session.characters[this.network.session.selectedSlot]);
        }

        this.objects.delete(info.objectId);
        this.objects.set(info.objectId, object);
        object.isAttackable = false;

        this.userId = info.objectId;
        this.appearances.set(info.objectId, { ...info, paperdoll: info.paperdoll.slice() });
        object.heading = info.heading;
        object.pendingRotation = null;
        setVector(object.position, info);
        object.name = info.name;
        object.title = info.title;
        object.clanId = info.clanId;
        object.clanCrestId = info.clanCrestId;
        object.allyId = info.allyId;
        object.allyCrestId = info.allyCrestId;
        if (info.clanId > 0) this.network.community.updatePledgeInfo(info.clanId, info.clanCrestId, info.allyId, info.allyCrestId, info.largeCrestId);
        object.curHp = info.curHp;
        object.maxHp = info.maxHp;
        object.curMp = info.curMp;
        object.maxMp = info.maxMp;
        object.karma = info.karma;
        object.pvpFlag = info.pvpFlag;
        object.recommendations = info.recommendations;
        object.nameColor = info.nameColor;
        object.isInCombat = info.isInCombat;
        object.speeds = info;
        object.cubics = info.cubics;
        object.isRunning = this.network.movement.isRunning;
        object.privateStoreType = info.privateStoreType;

        player.setUnrealScriptProperty("bNpc", false);
        player.setUnrealScriptProperty("CanIngnoreCollision", false);
        if (!info.mountType || this.network.movement.riders.has(info.objectId)) this.network.community.applySpeeds(object.actor, info, this.network.movement.isRunning);
        if (isFirst || this.teleportInfoPending || this.network.session.game.isPlayingReplay()) object.actor.setRotationYaw(info.heading);
        this.network.combat.setIdleAnimation(object, false);

        if (isFirst) {
            this.inWorld = true;
            player.teleportTo(setVector(object.position, info), true);
        }

        this.network.combat.updateCubics(object);
        this.network.combat.updateAbnormalState(object, info.abnormalState);
        this.network.movement.isMounted = info.mountType !== GamePackets.MountType_T.NONE;
        this.updateMountable();
        this.network.ui.setInventoryOrderOwner(info.name, this.network.items.inventoryOrderNamespace);
        this.network.ui.setWindowOwner(JSON.stringify([this.network.session.gameServerUrl, info.objectId]));
        this.network.ui.setStatus(info);
        this.network.ui.setClan(this.network.community.clanInfo);

        const key = this.getAppearanceKey(info);

        if (key !== object.appearanceKey) {
            object.appearanceKey = key;
            this.userAppearanceLoad = this.loadAppearance(info, player);
        }

        this.network.movement.setRide({ objectId: info.objectId, isMounted: info.mountType !== GamePackets.MountType_T.NONE, mountType: info.mountType, npcId: info.mountNpcId });

        if (isFirst) this.worldLoad = this.finishLoading();
        this.teleportInfoPending = false;
    }

    protected async finishLoading() {
        const render = this.network.getParent().getComponent("render");
        const asset = this.network.getParent().getComponent("asset");

        await this.userAppearanceLoad;
        await this.network.items.skillListLoad;

        while (this.inWorld && (!asset.isAreaLoaded(render, render.player.position) || this.npcSpawnCount > 0)) await new Promise(resolve => setTimeout(resolve, 100));

        if (!this.inWorld) return;

        render.setZoneMusicEnabled(true);
        this.network.ui.showWorld();
    }

    public onCharInfo(packet: PacketReader) {
        const info = GamePackets.readCharInfo(packet);

        if (info.clanId > 0) this.network.community.updatePledgeInfo(info.clanId, info.clanCrestId, info.allyId, info.allyCrestId, info.largeCrestId);
        this.appearances.set(info.objectId, { ...info, paperdoll: info.paperdoll.slice() });
        let object = this.objects.get(info.objectId);

        if (object) {
            Object.assign(object, { clanId: info.clanId, clanCrestId: info.clanCrestId, allyId: info.allyId, allyCrestId: info.allyCrestId });
            this.objects.delete(info.objectId);
            this.objects.set(info.objectId, object);
            object.isAttackable = false;

            const wasDead = object.isDead;
            object.heading = info.heading;
            object.pendingRotation = null;
            this.network.movement.adjustPawnLocation(object, info);
            object.name = info.name;
            object.title = info.title;
            object.recommendations = info.recommendations;
            object.speeds = info;
            object.isRunning = info.isRunning;
            object.isInCombat = info.isInCombat;
            object.isDead = info.isAlikeDead;
            object.privateStoreType = info.privateStoreType;
            object.cubics = info.cubics;
            this.network.combat.updateCubics(object);
            this.network.combat.updateAbnormalState(object, info.abnormalState);

            if (object.isDead) {
                object.destination = null;
                object.pendingFly = null;
                object.pendingVehicleMove = null;
                object.pendingAttack = null;
                object.pendingTransientSkills.length = 0;
                this.network.combat.stopSkill(object.objectId);
            }

            if (object.actor) {
                if (!info.mountType || this.network.movement.riders.has(info.objectId)) this.network.community.applySpeeds(object.actor, info, info.isRunning);
                object.actor.setRotationYaw(info.heading);
                if (object.isDead) {
                    if (!wasDead) object.actor.playDeathAnimation(() => { });
                } else {
                    this.network.combat.setIdleAnimation(object);
                    if (wasDead) object.actor.revive();
                }
            }
            this.network.community.applyPartyMember(object);

            const key = this.getAppearanceKey(info);

            if (object.actor && key !== object.appearanceKey) {
                object.appearanceKey = key;
                void this.loadAppearance(info, this.network.movement.riders.get(info.objectId) || object.actor);
            }

            this.network.movement.setRide({ objectId: info.objectId, isMounted: info.mountType !== GamePackets.MountType_T.NONE, mountType: info.mountType, npcId: info.mountNpcId });
            return;
        }

        object = this.createObject(info.objectId, "player", info);
        Object.assign(object, { clanId: info.clanId, clanCrestId: info.clanCrestId, allyId: info.allyId, allyCrestId: info.allyCrestId });
        object.appearanceKey = this.getAppearanceKey(info);
        this.network.community.applyPartyMember(object);
        this.network.movement.setRide({ objectId: info.objectId, isMounted: info.mountType !== GamePackets.MountType_T.NONE, mountType: info.mountType, npcId: info.mountNpcId });

        void this.spawnPlayer(object, info);
    }

    protected async spawnPlayer(object: NetObject_T, info: GamePackets.CreatureInfo_T & GamePackets.Appearance_T) {
        const render = this.network.getParent().getComponent("render");
        const actor = new BaseActor(render);

        actor.name = info.name;
        actor.position.copy(object.position);

        try {
            let appearance: GamePackets.Appearance_T = info;

            do {
                object.appearanceKey = this.getAppearanceKey(appearance);
                await this.loadAppearance(appearance, actor);
                appearance = this.appearances.get(object.objectId);
            } while (!object.isRemoved && this.getAppearanceKey(appearance) !== object.appearanceKey);
        } catch (e) {
            actor.release();
            object.resolveActor(null);
            console.error(`[network] player '${info.name}' failed to load:`, e);
            return;
        }

        if (object.isRemoved) {
            actor.release();
            return;
        }

        render.addPawn(actor);
        this.attachActor(object, actor);
        const ride = this.network.movement.mounts.get(object.objectId);

        if (ride) await this.network.movement.enterRide(ride);
    }

    public onNpcInfo(packet: PacketReader) {
        const info = GamePackets.readNpcInfo(packet);

        info.abnormalState = packet.d(); // NpcInfo 0x6f66ca: PetInfo's shared prefix stops before this field.
        packet.skip(18);
        info.originalCollisionRadius = packet.f();
        info.originalCollisionHeight = packet.f();
        packet.d();
        this.setNpc(info);
    }

    public onServerObjectInfo(packet: PacketReader) {
        const info = GamePackets.readServerObjectInfo(packet);
        const object = this.setNpc(info);

        object.curHp = info.curHp;
        object.maxHp = info.maxHp;
        if (object.objectId === this.network.getTargetId()) this.network.combat.updateTarget();
    }

    public onPetInfo(packet: PacketReader) {
        const info = GamePackets.readPetInfo(packet);

        if (info.objectId === this.deletedPetId) return;

        Object.assign(this.petInfo, info, { name: info.name || this.network.ui.getStrings().npcNames[info.npcId] });
        this.network.ui.setPetRenameAvailable(info.name.length === 0);
        this.network.ui.setPetInfo(this.petInfo);
        this.updateMountable();
        const object = this.setNpc(info, false);

        object.curHp = info.curHp;
        object.maxHp = info.maxHp;
        object.curMp = info.curMp;
        object.maxMp = info.maxMp;
        if (object.objectId === this.network.getTargetId()) this.network.combat.updateTarget();
        if (info.spawnType === 0 || info.spawnType === 2) this.network.ui.showPetStatus(info.statusType);
    }

    public updateMountable() { this.network.ui.setMountable(this.network.movement.isMounted || this.petInfo.objectId >= 0 && this.petInfo.isMountable); }

    public onPetStatusShow(packet: PacketReader) {
        const summonType = packet.d();

        if (summonType < 0 || packet.getRemaining()) throw new Error("Invalid PetStatusShow payload.");
        this.petStatusType = summonType;
        this.network.ui.setPetInfo(this.petInfo);
        this.network.ui.showPet(summonType);
    }

    public onPetDelete(packet: PacketReader) { // Engine 0x103fefd0.
        const statusType = packet.d(), objectId = packet.d();

        this.network.ui.hidePet();
        Object.assign(this.petInfo, { statusType, objectId: -1, x: 0, y: 0, z: 0 });
        this.updateMountable();
        this.removeObject(objectId);
        this.deletedPetId = objectId;
    }

    public onSetSummonRemainTime(packet: PacketReader) {
        const maxTime = packet.d(), remainingTime = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid SetSummonRemainTime payload.");

        this.petRemainTime = { maxTime, remainingTime };
        this.network.ui.setSummonRemainTime(maxTime, remainingTime);
    }

    public onPetStatusUpdate(packet: PacketReader) {
        const statusType = packet.d(), objectId = packet.d(), x = packet.d(), y = packet.d(), z = packet.d();

        packet.S();

        const curFood = packet.d(), maxFood = packet.d();
        const curHp = packet.d(), maxHp = packet.d(), curMp = packet.d(), maxMp = packet.d();
        const level = packet.d(), exp = packet.d(), minExp = packet.d(), nextExp = packet.d();

        Object.assign(this.petInfo, { statusType, objectId, x, y, z, curFood, maxFood, curHp, maxHp, curMp, maxMp, level, exp, minExp, nextExp }); // Engine 0x103fecfb..0x103feda6.
        this.network.ui.setPetInfo(this.petInfo);

        const object = this.objects.get(objectId);

        if (!object) return;

        object.curHp = curHp;
        object.maxHp = maxHp;
        object.curMp = curMp;
        object.maxMp = maxMp;
        if (objectId === this.network.getTargetId()) this.network.combat.updateTarget();
    }

    protected setNpc(info: GamePackets.NpcInfo_T, updateLocation: boolean = true) {
        const object = this.objects.get(info.objectId);

        if (object) {
            const wasDead = object.isDead;
            object.npcId = info.npcId;
            if (updateLocation) this.network.movement.adjustPawnLocation(object, info);
            if (info.name) object.name = info.name;
            object.title = info.title || this.network.ui.getStrings().npcTitles[info.npcId] || "";
            if (!info.name && info.npcId in this.network.ui.getStrings().npcTitleColors) object.titleColor = this.network.ui.getStrings().npcTitleColors[info.npcId];
            object.heading = info.heading;
            object.pendingRotation = null;
            object.isRunning = info.isRunning;
            object.isInCombat = info.isInCombat;
            object.isDead = info.isAlikeDead;
            object.isSummon = info.isSummon;
            object.isAttackable = info.isAttackable;
            object.speeds = info;
            this.network.combat.updateAbnormalState(object, info.abnormalState);

            if (object.isDead) {
                object.destination = null;
                object.pendingFly = null;
                object.pendingVehicleMove = null;
                object.pendingAttack = null;
                object.pendingTransientSkills.length = 0;
                this.network.combat.stopSkill(object.objectId);
            }

            if (object.actor) {
                this.network.community.applySpeeds(object.actor, info, info.isRunning);
                object.actor.setRotationYaw(info.heading);
                if (object.isDead) {
                    if (!wasDead) object.actor.playDeathAnimation(() => { });
                } else {
                    this.network.combat.setIdleAnimation(object);
                    if (wasDead) object.actor.revive();
                }
            }
            if (object.objectId === this.network.getTargetId()) this.network.combat.updateTarget();

            return object;
        }

        const created = this.createObject(info.objectId, "npc", info);

        created.title = info.title || this.network.ui.getStrings().npcTitles[info.npcId] || "";
        if (!info.name) created.titleColor = this.network.ui.getStrings().npcTitleColors[info.npcId] || 0;
        created.isSummon = info.isSummon;
        created.isAttackable = info.isAttackable;

        void this.spawnNpc(created, info.npcId, info);

        return created;
    }

    protected async spawnNpc(object: NetObject_T, npcId: number, info: GamePackets.NpcInfo_T) {
        const render = this.network.getParent().getComponent("render");
        let actor: BaseActor;
        let npc: INpcDefinition;

        while (this.npcSpawnCount >= NPC_SPAWN_CONCURRENCY) await new Promise<void>(resolve => this.npcSpawnWaiters.push(resolve));
        if (object.isRemoved) {
            this.npcSpawnWaiters.shift()?.();
            return;
        }
        this.npcSpawnCount++;

        try {
            npc = await this.network.getParent().getComponent("asset").resolveNpc(npcId);
            actor = await render.spawnNpc(npcId, object.position.clone(), info.rightHand || info.leftHand || info.chest ? { rightHand: info.rightHand, leftHand: info.leftHand, chest: info.chest, attackRange: NETWORK_BOW_RANGE } : null, false, false, [info.collisionRadius, info.collisionHeight]);
        } catch (e) {
            object.resolveActor(null);
            this.npcSpawnCount--;
            this.npcSpawnWaiters.shift()?.();
            debugger;
            throw new Error(`[network] npc ${npcId} (object ${object.objectId}) failed to spawn: ${(e as Error).message}`);
        }

        this.npcSpawnCount--;
        this.npcSpawnWaiters.shift()?.();

        const speeds = object.speeds;

        if (speeds.runSpd <= 0) {
            const groundSpeed = Number(actor.getUnrealScriptProperty("GroundSpeed"));
            const walkingPct = Number(actor.getUnrealScriptProperty("WalkingPct"));
            const waterSpeed = Number(actor.getUnrealScriptProperty("WaterSpeed"));
            const runSpeed = groundSpeed > 0 ? groundSpeed : 1;
            const walkPct = walkingPct > 0 ? walkingPct : 0.5;

            speeds.runSpd = runSpeed;
            speeds.walkSpd = runSpeed * walkPct;
            speeds.swimRunSpd = waterSpeed > 0 ? waterSpeed : runSpeed;
            speeds.swimWalkSpd = speeds.swimRunSpd * walkPct;
        }

        if (!object.name) object.name = actor.name;
        if (object.isRemoved) {
            render.removePawn(actor);
            return;
        }

        const questMark = npc.questMark, user = this.userInfo;

        object.hasQuestMark = !!questMark && !!user && user.level >= questMark.minLevel && user.level <= questMark.maxLevel && (!questMark.classIds.length || questMark.classIds.includes(user.classId));
        this.attachActor(object, actor);
        if (info.spawnType === 2 && npc.enterEvent) actor.spawnEnterEvent(npc.enterEvent);
    }

    protected attachActor(object: NetObject_T, actor: BaseActor) {
        object.actor = actor;

        actor.setUnrealScriptProperty("bNpc", object.kind === "npc");
        if (object.environment !== null) actor.setUnrealScriptProperty("Environment", object.environment);
        if (!(object.speeds as GamePackets.CharInfo_T).mountType) this.network.community.applySpeeds(actor, object.speeds, object.isRunning);
        this.network.combat.setIdleAnimation(object);
        if (object.waitType === GamePackets.WaitType_T.WT_SITTING) actor.playMovementAnimation("idle");
        actor.setRotationYaw(object.heading);

        actor.teleportTo(object.pendingFly ? object.pendingFly.origin : object.position, true);
        const vehicle = this.network.movement.vehicles.get(this.network.movement.getVehicleIdOf(object.objectId));

        if (vehicle) {
            actor.setUnrealScriptProperty("bGetOnVehicle", true);
            this.network.movement.placeVehicleRider(vehicle, object.objectId);
        }
        this.network.combat.updateCubics(object);
        this.network.combat.updateAbnormalState(object);
        if (object.pendingVehicleMove) {
            const move = object.pendingVehicleMove;
            this.network.movement.moveInVehicle(object, move.vehicleId, move.position);
        } else if (object.pendingFly) {
            if (object.kind === "user") actor.flyTo(object.pendingFly.destination);
            else actor.addFlyTo(object.pendingFly.origin, object.pendingFly.destination);
            object.pendingFly = null;
        } else if (object.destination) actor.goTo(object.destination);
        if (object.pendingRotation) {
            actor.startRotating(object.pendingRotation.direction, object.pendingRotation.speed);
            object.pendingRotation = null;
        }
        if (object.isDead) actor.playDeathAnimation(() => { });
        if (object.objectId === this.network.getTargetId()) this.network.combat.updateTarget();
        object.resolveActor(actor);
        this.network.combat.flushPendingAttacks();
        this.network.combat.flushPendingSkills();
        this.network.combat.flushSkillTargets(object.objectId);
        this.network.combat.startFishing(object);
    }

    public async onDice(info: GamePackets.Dice_T): Promise<void> {
        const render = this.network.getParent().getComponent("render"), asset = this.network.getParent().getComponent("asset");
        const generation = this.teleportGeneration, owner = this.objects.get(info.objectId);
        const origin = owner && owner.actor ? owner.actor.getWorldPosition(new Vector3()) : null;

        if (origin) origin.z += owner.actor.getCollisionHeight();
        const library = await asset.loadItem(info.itemId);

        if (!this.inWorld || generation !== this.teleportGeneration) return;
        const dice = new L2Dice(render, info.itemId, info.number, origin);

        setVector(dice.position, info);
        dice.setMeshes(library);
        render.addPickup(dice);
    }

    public async onSpawnItem(packet: PacketReader, dropped: boolean) {
        const ownerId = dropped ? packet.d() : 0;

        const objectId = packet.d(), itemId = packet.d();
        const position = setVector(new Vector3(), this.network.movement.readLocation(packet));
        const stackable = packet.d() !== 0, count = packet.d(), heading = packet.d();

        this.removeObject(objectId);

        const render = this.network.getParent().getComponent("render");
        const asset = this.network.getParent().getComponent("asset");
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

    public onGetItem(packet: PacketReader) {
        const object = this.objects.get(packet.d());
        const objectId = packet.d();
        const position = this.network.movement.readLocation(packet);
        const pickup = this.pickups.get(objectId);

        if (object) {
            object.destination = null;
            object.pendingFly = null;
            object.pendingVehicleMove = null;
            setVector(object.position, position);
        }

        if (object && object.actor) {
            const actor = object.actor;

            actor.stopMoving();
            this.network.movement.adjustPawnLocation(object, position);

            if (pickup) actor.setRotationYaw(Math.atan2(pickup.position.y - actor.position.y, pickup.position.x - actor.position.x) * 32768 / Math.PI);

            const animation = (actor.getUnrealScriptProperty("PicItemAnimName") as string[])[actor.getUnrealScriptProperty("CurWeaponType") as number];

            if (animation.toLowerCase() !== "none") actor.playAnimation(animation, 0.1, actor.getUnrealScriptProperty("NonAttackSpeedRate") as number, false, true); // OnGetItem 0x7455a9..0x7455f3.
            this.network.macroExecutor.notifyCommand([CommandType_T.pickup], 1);
        }

        this.removeObject(objectId);
    }

    public removeObject(objectId: number) {
        const wasTarget = objectId === this.network.getTargetId();

        if (objectId === this.deletedPetId) this.deletedPetId = 0;

        if (this.petInfo.objectId === objectId) {
            Object.assign(this.petInfo, { objectId: -1, x: 0, y: 0, z: 0 });
            this.updateMountable();
        }

        for (const object of this.objects.values()) {
            if (object.selectedId === objectId) object.selectedId = 0;
            if (object.pendingAttack?.hits.some(hit => hit.targetObjectId === objectId)) object.pendingAttack = null;
            if (object.pendingSkill?.targetObjectId === objectId) object.pendingSkill = null;
            if (object.pendingSkill) object.pendingSkill.associatedObjectIds = object.pendingSkill.associatedObjectIds.filter(id => id !== objectId);
            for (let i = object.pendingTransientSkills.length - 1; i >= 0; i--) {
                const pending = object.pendingTransientSkills[i];

                if (pending.targetObjectId === objectId) object.pendingTransientSkills.splice(i, 1);
                else pending.associatedObjectIds = pending.associatedObjectIds.filter(id => id !== objectId);
            }
            if (object.skill) object.skill.associatedObjectIds = object.skill.associatedObjectIds.filter(id => id !== objectId);
        }

        if (wasTarget) this.network.combat.updateTarget();

        this.network.movement.removeVehicle(objectId);
        this.doors.delete(objectId);
        for (const [realId, id] of this.staticObjects) if (id === objectId) this.staticObjects.delete(realId);
        for (const vehicle of this.network.movement.vehicles.values()) vehicle.riders.delete(objectId);
        this.network.movement.endRide(objectId);
        this.network.movement.mounts.delete(objectId);
        this.network.items.privateStoreSellMsgs.delete(objectId);
        this.network.items.privateStoreBuyMsgs.delete(objectId);

        const pickup = this.pickups.get(objectId);

        if (pickup) {
            this.pickups.delete(objectId);
            this.network.getParent().getComponent("render").removePickup(pickup);
        }

        const object = this.objects.get(objectId);

        if (!object || object.kind === "user") return;

        object.isRemoved = true;
        object.resolveActor(null);
        this.objects.delete(objectId);
        this.appearances.delete(objectId);

        if (object.actor) this.network.getParent().getComponent("render").removePawn(object.actor);
    }

    public withActor(objectId: number, callback: (actor: BaseActor, object: NetObject_T) => void) {
        const object = this.objects.get(objectId);

        if (object && object.actor) callback(object.actor, object);
    }

    public clearKnownObjects() {
        for (const objectId of this.objects.keys()) if (objectId !== this.userId) this.removeObject(objectId);
        for (const objectId of this.pickups.keys()) this.removeObject(objectId);
        this.network.getParent().getComponent("render").clearDice();

        for (const objectId of this.network.movement.vehicles.keys()) this.network.movement.removeVehicle(objectId);
    }

    public getUserId() { return this.userId; }

    public getActor(objectId: number) { const object = this.objects.get(objectId); return object && !object.isRemoved ? object.actor : null; }

    public getDice() { return this.dice; }

    public getNameplates(): Nameplate_T[] {
        const player = this.network.getParent().getComponent("render").player;
        const mouseTarget = this.network.getParent().getComponent("input").getMouseTarget();
        const plates: Nameplate_T[] = [];
        const now = this.network.getParent().getCurrentTime();
        const clanId = this.objects.get(this.userId)?.clanId || 0;

        for (const object of this.objects.values()) {
            const actor = object.actor;

            if (!actor || !actor.parent || !object.name) continue;

            let parent = actor;

            while (parent && parent.visible) parent = parent.parent as BaseActor;
            if (parent) continue;

            const isTarget = object.objectId === this.network.getTargetId(), isMouseTarget = actor === mouseTarget;
            const distance = Math.trunc(actor.position.distanceTo(player.position));

            if (!isTarget && !isMouseTarget && distance >= NAMEPLATE_DISTANCE) continue; // FDynamicActor::Render branch C: retail l2.ini [CharacterDisplay] Name=true, Dist=1000.

            const storeMessages = object.privateStoreType === GamePackets.PrivateStoreType_T.STORE_PRIVATE_BUY ? this.network.items.privateStoreBuyMsgs : object.privateStoreType === GamePackets.PrivateStoreType_T.STORE_PRIVATE_MANUFACTURE ? this.network.items.recipeShopMessages : this.network.items.privateStoreSellMsgs;

            plates.push({ actor, name: object.name, title: object.title, isNpc: object.kind === "npc", hasQuestMark: object.hasQuestMark, isSummon: object.isSummon, isAttackable: object.isAttackable, isSelf: object.objectId === this.userId, isPartyMember: this.network.community.partyMembers.has(object.objectId), isPledgeMember: clanId !== 0 && object.clanId === clanId, isDead: object.isDead || object.waitType === GamePackets.WaitType_T.WT_START_FAKEDEATH, isSitting: object.waitType === GamePackets.WaitType_T.WT_SITTING, isChairSitting: object.waitType === GamePackets.WaitType_T.WT_SITTING && object.chairStaticObjectId > 0, abnormalState: object.abnormalState, karma: object.karma, pvpFlag: object.pvpFlag, recommendations: object.recommendations, nameColor: object.nameColor, titleColor: object.titleColor, clanCrestId: object.clanCrestId, allyCrestId: object.allyCrestId, isTarget, isMouseTarget, isChatRange: distance <= NAMEPLATE_DISTANCE, privateStoreType: object.privateStoreType, storeMessage: storeMessages.get(object.objectId) || "", chatMessage: now - object.chatTime < CHAT_BALLOON_TIME ? object.chatMessage : null });
        }

        return plates;
    }
}

export default NetworkActors;
