import type NetworkManager from "./network-manager";
import type AnimationComponent from "../objects/components/animation-component";
import { LoopOnce, Vector3 } from "three";
import BaseActor from "../base-actor";
import PawnAttackComponent, { type NAttackActionParam_T } from "../objects/components/pawn-attack-component";
import PawnEquipmentComponent from "../objects/components/pawn-equipment-component";
import * as GamePackets from "./game-packets";
import PawnFishingComponent, { FishingType_T } from "../objects/components/pawn-fishing-component";
import PawnCubicComponent from "../objects/components/pawn-cubic-component";
import PawnAbnormalComponent from "../objects/components/pawn-abnormal-component";
import { PStopType_T, type NpcLifecycleComponent } from "../objects/components/npc-lifecycle-component";
import PacketReader from "./packet-reader";
import type { NetSkill_T, NetObject_T } from "./network-actors";

const CUBIC_SKILLS = new Set([4049, 4050, 4051, 4052, 4053, 4054, 4055, 4164, 4165, 4166]);

const tmpEarthquakePosition = new Vector3();

const tmpEarthquakeRotationAmplitude = new Vector3(0, 0.1, 0);

const tmpEarthquakeRotationVelocity = new Vector3(0, 1000, 0);

const tmpEarthquakePositionAmplitude = new Vector3();

export class NetworkCombat {

    public constructor(protected readonly network: NetworkManager) {}

    public useSkill(id: number, ctrl: boolean = false, shift: boolean = false) {
        const skill = this.network.items.skills.get(id);

        if (this.network.actors.inWorld && skill) this.network.session.game.requestMagicSkillUse(id, ctrl, shift);
    }

    public onAttack(packet: PacketReader) {
        const attacker = this.network.actors.objects.get(packet.d());
        const hits = [this.readAttackHit(packet)];
        const position = this.network.movement.readLocation(packet);
        const count = packet.h();

        if (count > packet.getRemaining() / 9) throw new Error(`Invalid attack hit count '${count}'.`);

        for (let i = 0; i < count; i++) hits.push(this.readAttackHit(packet));

        if (!attacker || attacker.isDead || hits[0].targetObjectId === attacker.objectId) return;

        attacker.destination = null;
        attacker.pendingFly = null;
        attacker.pendingVehicleMove = null;
        if (attacker.actor) attacker.actor.stopMoving();
        this.stopSkill(attacker.objectId);

        if (!attacker.actor || !hits[0].actionTarget) {
            attacker.pendingAttack = { hits, position: { x: position.x, y: position.y, z: position.z } };
            return;
        }

        this.startServerAttack(attacker, hits, position);
    }

    public onActionFailed() {
        const object = this.network.actors.objects.get(this.network.actors.userId);

        if (!object) return;

        object.pendingAttack = null;
        object.pendingSkill = null;
        object.pendingTransientSkills.length = 0;
    }

    protected readAttackHit(packet: PacketReader): NAttackActionParam_T {
        const targetObjectId = packet.d(), target = this.network.actors.objects.get(targetObjectId);
        const damage = packet.d(), flags = packet.c();

        return { targetObjectId, actionTarget: target ? target.actor : null, damage, isMiss: !!(flags & GamePackets.AttackFlags_T.MISS), isCritical: !!(flags & GamePackets.AttackFlags_T.CRITICAL), isShieldDefense: !!(flags & GamePackets.AttackFlags_T.SHIELD), isSpirit: !!(flags & GamePackets.AttackFlags_T.SOULSHOT), soulshotGrade: flags & GamePackets.AttackFlags_T.GRADE };
    }

    protected startServerAttack(attacker: NetObject_T, hits: readonly NAttackActionParam_T[], position: GamePackets.Location_T) {
        if (!attacker.actor || !hits[0].actionTarget || attacker.actor === hits[0].actionTarget || attacker.isDead) return;

        attacker.pendingAttack = null;
        this.network.movement.adjustPawnLocation(attacker, position);
        attacker.destination = null;
        attacker.pendingFly = null;
        attacker.pendingVehicleMove = null;
        attacker.actor.getComponent<PawnAttackComponent>("pawnAttack").attackFromServer(hits);
        if (!attacker.isDead)
            for (const hit of hits) {
                const defender = this.network.actors.objects.get(hit.targetObjectId);

                if (defender && defender.actor && defender.actor !== attacker.actor) this.network.ui.notifyOlympiadAttack(attacker.objectId, defender.objectId, attacker.name, hit.isMiss, hit.isCritical);
            }
    }

    public flushPendingAttacks(targetObjectId?: number) {
        for (const attacker of this.network.actors.objects.values()) {
            const pending = attacker.pendingAttack;

            if (!pending || targetObjectId !== undefined && !pending.hits.some(hit => hit.targetObjectId === targetObjectId)) continue;

            const hits = pending.hits.map(hit => {
                const target = this.network.actors.objects.get(hit.targetObjectId);

                return { ...hit, actionTarget: target ? target.actor : null };
            });

            if (!hits[0].actionTarget) continue;
            this.startServerAttack(attacker, hits, pending.position);
        }
    }

    public onMagicSkillUse(packet: PacketReader) {
        const receivedTime = this.network.getParent().getCurrentTime();
        const caster = this.network.actors.objects.get(packet.d());
        const targetObjectId = packet.d(), target = this.network.actors.objects.get(targetObjectId);
        const id = packet.d(), level = packet.d(), hitTime = Math.max(0, packet.d());

        const reuseDelay = packet.d();
        const position = this.network.movement.readLocation(packet);

        packet.d();

        if (caster && caster.isDead) return;

        if (caster && caster.objectId === this.network.actors.userId) this.network.ui.setSkillCoolTime(id, level, Math.trunc(reuseDelay / 1000), Math.trunc(reuseDelay / 1000)); // OnReceiveMagicSkillUse 0x7505a2 / 0x750690.

        const isTransient = CUBIC_SKILLS.has(id) || this.network.ui.getStrings().skillCastStyles[`${id}:${level}`] === 0;

        if (!caster) return;
        if (!isTransient) {
            caster.pendingAttack = null;
            caster.destination = null;
            caster.pendingFly = null;
            caster.pendingVehicleMove = null;
            if (caster.actor) caster.actor.stopMoving();
        }

        if (caster.actor === this.network.getParent().getComponent("render").player && !caster.isDead && (target ? target.actor : this.network.actors.doors.has(targetObjectId)) && this.network.ui.getStrings().skillInfos[`${id}:${level}`])
            this.network.macroExecutor.notifySkill(id, hitTime);

        if (!caster.actor || !target) {
            if (!isTransient) this.stopSkill(caster.objectId);
            const pending = { targetObjectId, id, level, hitTime: hitTime / 1000, receivedTime, position: { x: position.x, y: position.y, z: position.z }, isTransient, associatedObjectIds: [] };

            if (isTransient) caster.pendingTransientSkills.push(pending);
            else caster.pendingSkill = pending;
            return;
        }

        this.startServerSkill(caster, target, id, level, hitTime / 1000, position, isTransient, receivedTime);
    }

    protected startServerSkill(caster: NetObject_T, target: NetObject_T, id: number, level: number, hitTime: number, position: GamePackets.Location_T, isTransient: boolean, receivedTime: number, associatedObjectIds: readonly number[] = []) {
        if (caster.isDead) return;

        const skill: NetSkill_T = { id, level, hitTime, receivedTime, associatedActors: [], associatedObjectIds: [...associatedObjectIds] }; // OnReceiveMagicSkillUse 0x7507f7..0x750831.

        for (const objectId of skill.associatedObjectIds) {
            const object = this.network.actors.objects.get(objectId);

            if (object?.actor) skill.associatedActors.push(object.actor);
        }

        this.network.movement.adjustPawnLocation(caster, position);

        if (!isTransient) {
            caster.destination = null;
            caster.pendingFly = null;
            caster.pendingVehicleMove = null;
            this.network.getParent().getComponent("asset").stopPawnSkill(caster.actor);
            caster.skill = skill;
            caster.pendingSkill = null;
        }

        void this.castSkill(caster, target, skill, isTransient);
    }

    protected async castSkill(caster: NetObject_T, target: NetObject_T, cast: NetSkill_T, isTransient: boolean) {
        const actor = caster.actor;

        const asset = this.network.getParent().getComponent("asset");
        const skill = asset.getPawnSkillRecord(actor, cast.id, cast.level);
        const attack = actor.getComponent<PawnAttackComponent>("pawnAttack");
        const visual = skill.visual, request = asset.getPawnSkillRequest(actor);

        if (!target.actor) skill.visual = null;

        if (!isTransient && caster.skill !== cast || caster.isRemoved || target.isRemoved) return;

        attack.castFromServer(target.actor, skill, cast.hitTime, cast.associatedActors, cast.associatedActors.length > 0, (this.network.getParent().getCurrentTime() - cast.receivedTime) / 1000);
        if (isTransient && visual?.transientRejected) this.stopSkill(caster.objectId);

        if (!skill.visual) {
            const [loaded, targetActor] = await Promise.all([visual ? { ...skill, visual } : asset.loadPawnSkill(actor, cast.id, cast.level, isTransient), target.actor || target.actorReady]);

            if (!loaded || !targetActor || !isTransient && (caster.skill !== cast || request !== asset.getPawnSkillRequest(actor)) || caster.isRemoved || target.isRemoved || caster.actor !== actor || !attack.isAttached()) return;

            if (isTransient && loaded.visual.transientRejected && request === asset.getPawnSkillRequest(actor)) this.stopSkill(caster.objectId);

            Object.assign(skill, { visual: loaded.visual, flyingTime: loaded.flyingTime, sounds: loaded.sounds, assets: loaded.assets });
            attack.setSkillTargets(cast.id, cast.associatedActors, target.actor);
            attack.attachSkillVisual(skill, target.actor, cast.hitTime, cast.associatedActors, (this.network.getParent().getCurrentTime() - cast.receivedTime) / 1000);
        }
        if (target.actor) this.network.ui.notifyOlympiadSkill(caster.objectId, cast.id);
    }

    public onMagicSkillLaunched(packet: PacketReader) {
        const caster = this.network.actors.objects.get(packet.d());
        const skillId = packet.d(), level = packet.d();

        const count = packet.d(), objectIds: number[] = [];

        if (count < 0 || count > packet.getRemaining() / 4) throw new Error(`Invalid skill target count '${count}'.`);

        for (let i = 0; i < count; i++) objectIds.push(packet.d());

        if (!caster) return;

        if (caster.pendingSkill && caster.pendingSkill.id === skillId && caster.pendingSkill.level === level) caster.pendingSkill.associatedObjectIds.push(...objectIds);
        for (let i = caster.pendingTransientSkills.length - 1; i >= 0; i--) {
            const pending = caster.pendingTransientSkills[i];

            if (pending.id !== skillId || pending.level !== level) continue;
            pending.associatedObjectIds.push(...objectIds);
            break;
        }
        if (!caster.skill || caster.skill.id !== skillId || caster.skill.level !== level) return;

        caster.skill.associatedObjectIds.push(...objectIds);
        if (caster.actor) this.applySkillTargets(caster);
    }

    public flushPendingSkills(targetObjectId?: number) {
        for (const caster of this.network.actors.objects.values()) {
            if (!caster.actor) continue;

            const pending = caster.pendingSkill;

            if (pending && (targetObjectId === undefined || pending.targetObjectId === targetObjectId)) {
                const target = this.network.actors.objects.get(pending.targetObjectId);

                if (target) {
                    caster.pendingSkill = null;
                    this.startServerSkill(caster, target, pending.id, pending.level, pending.hitTime, pending.position, pending.isTransient, pending.receivedTime, pending.associatedObjectIds);
                }
            }

            for (let i = 0; i < caster.pendingTransientSkills.length;) {
                const pending = caster.pendingTransientSkills[i], target = this.network.actors.objects.get(pending.targetObjectId);

                if (!target || targetObjectId !== undefined && pending.targetObjectId !== targetObjectId) { i++; continue; }

                caster.pendingTransientSkills.splice(i, 1);
                this.startServerSkill(caster, target, pending.id, pending.level, pending.hitTime, pending.position, true, pending.receivedTime, pending.associatedObjectIds);
            }
        }
    }

    public flushSkillTargets(objectId?: number) {
        for (const caster of this.network.actors.objects.values()) {
            const skill = caster.skill;

            if (!skill || objectId !== undefined && !skill.associatedObjectIds.includes(objectId) || !caster.actor) continue;

            this.applySkillTargets(caster);
        }
    }

    protected applySkillTargets(caster: NetObject_T) {
        const skill = caster.skill;

        skill.associatedActors.length = 0;
        for (const targetId of skill.associatedObjectIds) {
            const target = this.network.actors.objects.get(targetId);

            if (target?.actor) skill.associatedActors.push(target.actor);
        }
        caster.actor.getComponent<PawnAttackComponent>("pawnAttack").setSkillTargets(skill.id, skill.associatedActors);
        this.network.getParent().getComponent("render").setRetainedSkillTargets(caster.actor, skill.id, skill.associatedActors);
    }

    public stopSkill(objectId: number) {
        const object = this.network.actors.objects.get(objectId);

        if (!object) return;

        object.skill = null;
        object.pendingSkill = null;
        if (object.actor) this.network.getParent().getComponent("asset").stopPawnSkill(object.actor);
        if (objectId === this.network.actors.userId) this.network.ui.setupGauge(GamePackets.GaugeColor_T.BLUE, 0, 0); // MagicCancel 0x7b5e6d..0x7b5e7d.
    }

    public onDie(packet: PacketReader) {
        const objectId = packet.d();
        const options = [packet.d() !== 0, packet.d() !== 0, packet.d() !== 0, packet.d() !== 0];

        packet.d();
        options.push(packet.d() !== 0);

        const object = this.network.actors.objects.get(objectId);

        if (!object) return;

        object.isDead = true;
        object.pendingRotation = null;
        object.pendingAttack = null;
        object.pendingTransientSkills.length = 0;
        object.isInCombat = false;
        object.selectedId = 0; // OnDie 0x744e51 / 0x744e95 clears bAutoAttacking and SelectedActor.
        object.destination = null;
        object.pendingFly = null;
        object.pendingVehicleMove = null;
        this.stopSkill(objectId);

        if (object.actor) object.actor.playDeathAnimation(() => { });
        if (object.kind !== "user") return;

        this.updateTarget();
        this.network.ui.showDeath(options);
    }

    public onRevive(objectId: number) {
        const object = this.network.actors.objects.get(objectId);

        if (!object) return;

        object.isDead = false;
        this.setIdleAnimation(object, false);

        if (object.actor) object.actor.revive();
        if (object.kind === "user") this.network.ui.hideDeath();
    }

    public updateCubics(object: NetObject_T) {
        const actor = object.actor;

        if (!actor) return;

        let component = actor.findComponent<PawnCubicComponent>("pawnCubic");

        if (!object.cubics.length) {
            if (component) actor.removeComponent(component);
            return;
        }

        if (!component) component = actor.addComponent(new PawnCubicComponent(this.network.getParent().getComponent("render")));
        component.setPosture(object.waitType === GamePackets.WaitType_T.WT_SITTING, object.waitType === GamePackets.WaitType_T.WT_START_FAKEDEATH);
        void component.setCubics(object.cubics);
    }

    public updateAbnormalState(object: NetObject_T, abnormalState: number = object.abnormalState) {
        if (abnormalState & ~object.abnormalState & (GamePackets.AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_1 | GamePackets.AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_2)) {
            object.pendingAttack = null;
            this.stopSkill(object.objectId);
        }
        object.abnormalState = abnormalState;

        const actor = object.actor;

        if (!actor) return;

        if (actor.ridePawn) this.setActorAbnormalState(actor.ridePawn, object.abnormalState & GamePackets.AbnormalEffect_T.ABNORMAL_EFFECT_BIG_HEAD); // FNAbnormalStat Init/Update/destructor select the flagged rider at APawn+660.
        this.setActorAbnormalState(actor, actor.ridePawn ? object.abnormalState & ~GamePackets.AbnormalEffect_T.ABNORMAL_EFFECT_BIG_HEAD : object.abnormalState);
    }

    protected setActorAbnormalState(actor: BaseActor, abnormalState: number): void {
        let component = actor.findComponent<PawnAbnormalComponent>("pawnAbnormal");

        if (!abnormalState) {
            if (component) {
                if (component.hasPendingSizeChange()) void component.setAbnormalState(0);
                else actor.removeComponent(component);
            }
            return;
        }

        if (!component) component = actor.addComponent(new PawnAbnormalComponent(this.network.getParent().getComponent("render")));
        void component.setAbnormalState(abnormalState);
    }

    public setIdleAnimation(object: NetObject_T, updatePose: boolean = true) {
        const actor = object.actor;

        if (!actor) return;

        actor.getComponent<NpcLifecycleComponent>("npcLifecycle").setControllerState(object.chairStaticObjectId ? PStopType_T.STP_CHAIR_SIT : object.waitType, object.isInCombat);
        if (object.isDead) return;

        actor.findComponent<PawnCubicComponent>("pawnCubic")?.setPosture(object.waitType === GamePackets.WaitType_T.WT_SITTING, object.waitType === GamePackets.WaitType_T.WT_START_FAKEDEATH);
        const field = object.waitType === GamePackets.WaitType_T.WT_SITTING ? object.chairStaticObjectId ? "ChairWaitAnimName" : "SitWaitAnimName" : object.waitType === GamePackets.WaitType_T.WT_START_FAKEDEATH ? "DeathWaitAnimName" : object.isInCombat ? "AtkWaitAnimName" : "WaitAnimName";
        const animation = (actor.getUnrealScriptProperty(field) as string[])[actor.getUnrealScriptProperty("CurWeaponType") as number];

        if (animation.toLowerCase() === "none") return;

        actor.setIdleAnimation(animation);
        if (updatePose && !actor.isLocomoting() && !actor.getComponent<PawnAttackComponent>("pawnAttack").isAttacking() && actor.getAnimationAction()?.loop !== LoopOnce) actor.playMovementAnimation("idle");
    }

    public onCombatState(objectId: number, isInCombat: boolean) {
        const object = this.network.actors.objects.get(objectId);

        if (!object) return;

        object.isInCombat = isInCombat;
        this.setIdleAnimation(object);
    }

    public onChangeWaitType(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());
        const waitType = packet.d() as GamePackets.WaitType_T;
        const position = this.network.movement.readLocation(packet);

        if (!object) return;

        this.network.movement.adjustPawnLocation(object, position);
        object.destination = null;
        object.pendingFly = null;
        object.pendingVehicleMove = null;

        if (object.waitType === waitType) return;

        if (waitType === GamePackets.WaitType_T.WT_SITTING && object.kind === "user") object.pendingRotation = null;
        object.pendingAttack = null;
        this.stopSkill(object.objectId);

        const actor = object.actor;

        if (actor) {
            actor.stopMoving();
            if (waitType === GamePackets.WaitType_T.WT_SITTING && object.kind === "user") actor.stopRotating();
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

    public onSocialAction(objectId: number, actionId: number) {
        const object = this.network.actors.objects.get(objectId);

        if (!object || !object.actor || actionId < 1) return;
        if (actionId === 15 && objectId === this.network.actors.userId) this.network.session.game.requestSkillList();

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
        const asset = this.network.getParent().getComponent("asset"), render = this.network.getParent().getComponent("render");
        const library = await asset.loadSocialEffects();

        if (!actor.parent) return;

        const effect = asset.createScriptObject(render, library, path);

        effect.position.copy(actor.position);
        render.addTransientEffect(effect, actor);

        const mesh = actor.getComponent<AnimationComponent>("animation").getMeshes()[0];

        if (mesh) effect.scriptProperties.get("TrailerPrePivot")[2] = -mesh.meshOrigin.z;

        // Engine.dll SpawnNTransientEffect 0x79a7e1..0x79a8ee: level1 spell sounds at Pawn.Location.
        for (const sound of this.network.ui.getStrings().socialSounds[skillId] || []) {
            const uri = await asset.loadSound(sound.sound);

            void this.network.getParent().getComponent("audio").playOneShotSound(uri, actor.position, sound.volume / 255, 1, sound.radius, sound.radius * 100);
        }
    }

    public async onPlaySound(packet: PacketReader) {
        const type = packet.d() as GamePackets.PlaySoundType_T;
        const name = packet.S();

        packet.skip(20); // OnPlaySound 0x751275..0x7512ac ignores the five positional fields.

        const audio = this.network.getParent().getComponent("audio");

        if (type === GamePackets.PlaySoundType_T.SOUND) {
            const position = this.network.getParent().getComponent("render").player.position.clone();
            const uri = await this.network.getParent().getComponent("asset").loadSound(name);

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

    public async onEarthquake(packet: PacketReader) {
        if (packet.getRemaining() < 24) throw new Error("Invalid Earthquake packet.");

        tmpEarthquakePosition.set(packet.d(), packet.d(), packet.d());
        const intensity = packet.d();
        const duration = packet.d();
        packet.d();

        const render = this.network.getParent().getComponent("render");
        const positionFrequency = 30 * duration;

        tmpEarthquakePositionAmplitude.set(positionFrequency, positionFrequency, 0);
        render.addViewShakeState(duration + 2, 1, intensity * 60, positionFrequency, tmpEarthquakeRotationAmplitude, tmpEarthquakeRotationVelocity, tmpEarthquakePositionAmplitude, tmpEarthquakePosition, intensity, 0); // UGameEngine::OnEarthQuake 0x10438.

        const name = duration <= 7 ? "MonSound3.antaras_earthquake" : "MonSound3.antaras_earthquake_2";
        const uri = await this.network.getParent().getComponent("asset").loadSound(name);

        await this.network.getParent().getComponent("audio").playOneShotSound(uri, render.player.position, 1, 1, 80, 8000);
    }

    public setTarget(objectId: number, levelDifference: number = 0) {
        const user = this.network.actors.objects.get(this.network.actors.userId);

        if (!user) return;

        this.setSelectedActor(user, objectId);

        const object = this.network.actors.objects.get(objectId);

        if (object) object.levelDifference = levelDifference;

        this.updateTarget();
    }

    protected setSelectedActor(object: NetObject_T, objectId: number) {
        if (this.network.actors.hasServerObject(objectId)) object.selectedId = objectId;
    }

    public onTargetSelected(packet: PacketReader, isSelected: boolean) {
        const objectId = packet.d(), selectedId = isSelected ? packet.d() : 0;
        const position = this.network.movement.readLocation(packet);
        const object = this.network.actors.objects.get(objectId);

        if (!object) return;

        this.network.movement.adjustPawnLocation(object, position);
        // OnTargetSelected 0x745910 / OnTargetUnselected 0x745b10: SelectedActor, independent of the current action.
        if (isSelected) this.setSelectedActor(object, selectedId);
        else object.selectedId = 0;
        if (objectId === this.network.actors.userId) this.updateTarget();
    }

    public updateTarget() {
        const object = this.network.actors.objects.get(this.network.getTargetId());

        this.network.ui.setTarget(object ? { npcId: object.npcId, name: object.name, curHp: object.curHp, maxHp: object.maxHp, curMp: object.curMp, maxMp: object.maxMp, showHp: object.isSummon ? object.objectId === this.network.actors.petInfo.objectId : object.maxHp > 0, showMp: object.kind !== "npc" && object.maxMp > 0, levelDifference: object.levelDifference } : null); // NCTargetStatusWnd paint 0x10113600: summons show HP + level colour only to their owner.
    }

    public onFishingStart(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());
        const fishType = packet.d(), x = packet.d(), y = packet.d(), z = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid ExFishingStart payload.");

        if (!object || object.fishing || object.actor && object.actor.getUnrealScriptProperty("bFish")) return;

        object.fishing = { fishType, x, y, z, isFighting: false, time: 0, maxTime: 0, fishHp: 0, maxFishHp: 0, mode: 0, lureType: 0, isGoodUse: false, animation: 0, penalty: 0 };
        this.startFishing(object);
    }

    public startFishing(object: NetObject_T) {
        const state = object.fishing;
        if (!state || !object.actor) return;

        const render = this.network.getParent().getComponent("render");
        let component = object.actor.findComponent<PawnFishingComponent>("pawnFishing");

        if (!component) component = object.actor.addComponent(new PawnFishingComponent(render, () => this.startFishingCombat(object)));
        void component.start(new Vector3(state.x, state.y, state.z), state.fishType, object.actor === render.player, this.network.ui.getScreenCanvas().width);
        if (object.actor === render.player) this.network.ui.startFishing();
    }

    public onFishingEnd(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d()), isWin = packet.c();

        if (isWin > 1 || packet.getRemaining()) throw new Error("Invalid ExFishingEnd payload.");
        if (!object) return;

        object.fishing = null;
        if (!object.actor || !object.actor.getUnrealScriptProperty("bFish")) return;

        const component = object.actor.findComponent<PawnFishingComponent>("pawnFishing");

        if (component) component.end(isWin !== 0);
        if (object.actor === this.network.getParent().getComponent("render").player) this.network.ui.endFishing(isWin !== 0);
    }

    public onFishingStartCombat(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());
        const time = packet.d(), maxFishHp = packet.d(), mode = packet.c(), lureType = packet.c();

        if (packet.getRemaining()) throw new Error("Invalid ExFishingStartCombat payload.");
        if (!object || !object.fishing) return;

        Object.assign(object.fishing, { isFighting: true, time, maxTime: time, fishHp: maxFishHp, maxFishHp, mode, lureType });
        this.startFishingCombat(object);
    }

    protected startFishingCombat(object: NetObject_T) {
        const state = object.fishing;
        if (!state || !state.isFighting || !object.actor || !object.actor.getUnrealScriptProperty("bFish")) return;

        const component = object.actor.findComponent<PawnFishingComponent>("pawnFishing");
        if (!component || !component.getFloat() || object.actor.getUnrealScriptProperty("CurFishingType") === FishingType_T.FST_BATTLE) return;

        component.startCombat(state.mode);
        component.updateCombat(state.mode, state.animation);
        if (object.actor === this.network.getParent().getComponent("render").player) {
            this.network.ui.startFishingCombat(state.maxFishHp, state.maxTime, state.mode, state.lureType);
            this.network.ui.updateFishing(state.fishHp, state.time, state.isGoodUse, state.mode, state.animation, state.penalty);
        }
    }

    public onFishingHpRegen(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());
        const time = packet.d(), fishHp = packet.d(), mode = packet.c(), isGoodUse = packet.c() !== 0, animation = packet.c(), penalty = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid ExFishingHpRegen payload.");
        if (!object || !object.fishing) return; // Broadcast: a fisher seen mid-fight never sent us ExFishingStart.

        Object.assign(object.fishing, { isFighting: true, time, fishHp, mode, isGoodUse, animation, penalty });
        if (!object.actor || !object.actor.getUnrealScriptProperty("bFish") || object.actor.getUnrealScriptProperty("CurFishingType") !== FishingType_T.FST_BATTLE) return;
        const component = object.actor.findComponent<PawnFishingComponent>("pawnFishing");

        if (component) component.updateCombat(mode, animation);
        if (component && component.getFloat() && object.actor === this.network.getParent().getComponent("render").player) this.network.ui.updateFishing(fishHp, time, isGoodUse, mode, animation, penalty);
    }
}

export default NetworkCombat;
