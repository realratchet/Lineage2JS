import { Euler, Object3D, Quaternion, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent, type IObject } from "../../game/components";
import { ANIMATION_NOTIFY_EVENT } from "../../audio/components/sound-component";
import Rotator from "../../utils/rotator";
import SoundComponent from "../../audio/components/sound-component";
import getNativeEffect from "../../skills/native-effects";
import NativeSkillEffects, { getPawnRotation, getPawnMeshHeight, getTargetRotation } from "../../skills/native-skill-effects";
import NProjectileComponent from "../../physics/components/projectile-component";
import NMover from "../../physics/mover";
import { EPhysics_T } from "../../assets/unreal/un-aactor";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type AnimationComponent from "./animation-component";
import type { ScriptComponent } from "../../game/script-component";
import type { IAnimationNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";
import type { NpcSkillAttack_T, NpcSkillSound_T, NpcSkillEffectAction_T, NpcSkillEffectPhase_T } from "@l2js/engine/contracts/pawn";

const ATTACK_RANGE_PADDING = 20;
const SKILL_EFFECT_RADIUS_SCALE = 1 / 9; // Engine.dll USkillAction_LocateEffect::Notify 0x796514, float 0xaabad4.
const arrPhysicalAnimations = ["atk01", "atk02", "atk03"];
const arrHandBones = ["bip01_r_hand", "bip01_l_hand"];
const arrCastAnimations = ["CastShortAnimName", "CastMidAnimName", "CastLongAnimName"];
const tmpRotator = new Rotator();
const tmpNpcPosition = new Vector3();
const tmpTargetPosition = new Vector3();
const tmpEffectPosition = new Vector3();
const tmpEffectOffset = new Vector3();
const tmpEffectRotation = new Quaternion();
const tmpEffectEuler = new Euler(0, 0, 0, "ZYX");
const tmpAttackDirection = new Vector3();

export type NpcAttack_T = {
    label: string;
    animation: string;
    skill: NpcSkillAttack_T | null;
};

export type NpcAttackSelection_T = number | "random";

type PendingSkillEffect_T = { dueTime: number, action: NpcSkillEffectAction_T, skill: NpcSkillAttack_T };

export class NpcAttackComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "npcAttack";
    protected readonly renderManager: RenderManager;
    protected readonly attacks: NpcAttack_T[] = [];
    protected readonly pendingEffects: PendingSkillEffect_T[] = [];
    protected readonly attackEffects: Object3D[] = [];
    protected readonly preparedProjectiles: (Object3D & IObject)[] = [];
    protected readonly nativeEffects = new NativeSkillEffects();
    protected readonly pendingSounds: { dueTime: number, sound: NpcSkillSound_T }[] = [];
    protected target: BaseActor = null;
    protected locList: readonly Vector3Arr[] = [];
    protected selection: NpcAttackSelection_T = "random";
    protected currentAttack: NpcAttack_T = null;
    protected attackStartedAt = 0;
    protected shotTriggered = false;
    protected lastShotName: string = null;
    protected stageShot = 0;
    protected stagePreShot = 0;
    protected pendingPreShot = false;
    protected pendingShot: "shot" | "finalShot" = null;
    protected readonly skillAnimations: string[] = [];
    protected readonly skillAnimationTimes: number[] = [];
    protected skillAnimationIndex = -1;
    protected flexibleAnimationIndex = -1;
    protected skillAnimationRate = 1;
    protected skillTweenTime = 0;
    protected skillShotTime = 0;
    protected isActive = false;
    protected lastTime = 0;

    public constructor(renderManager: RenderManager, animationNames: readonly string[], skills: readonly NpcSkillAttack_T[]) {
        super();

        this.renderManager = renderManager;

        for (const physical of arrPhysicalAnimations) {
            const animation = animationNames.find(name => name.toLowerCase() === physical);

            if (animation) this.attacks.push({ label: `Physical: ${animation}`, animation, skill: null });
        }

        for (const skill of skills) {
            if (!skill.animation || skill.animation.toLowerCase() === "none") continue;

            const animation = animationNames.find(name => name.toLowerCase() === skill.animation.toLowerCase());

            if (!animation) throw new Error(`NPC skill '${skill.id}' has no '${skill.animation}' animation.`);

            this.attacks.push({ label: `Skill ${skill.id}: ${skill.name}`, animation, skill });
        }
    }

    public onDetach(): void {
        for (const effect of this.attackEffects)
            if (effect.parent) this.renderManager.removeTransientEffect(effect);

        this.nativeEffects.clear();
        this.pendingSounds.length = 0;
        this.attackEffects.length = 0;
        this.preparedProjectiles.length = 0;
        this.pendingEffects.length = 0;
        this.target = null;
        this.locList = [];
        this.currentAttack = null;
        this.shotTriggered = false;
        this.lastShotName = null;
        this.stageShot = 0;
        this.stagePreShot = 0;
        this.pendingPreShot = false;
        this.pendingShot = null;
        this.isActive = false;
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<void> {
        if (type !== ANIMATION_NOTIFY_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        const notify = data as IAnimationNotifyDecodeInfo;

        if (!this.currentAttack || this.currentAttack.skill?.castStyle === 0 || notify.object?.type !== "native") return COMPONENT_EVENT_NOT_HANDLED;

        const name = notify.object.className.toLowerCase();

        // Engine.dll AnimNotify_AttackPreShot 0x94c8d5..0x94c8e8: active skill action only.
        if (name === "animnotify_attackpreshot") {
            if (this.currentAttack.skill) this.pendingPreShot = true;
            return;
        }
        if (name !== "animnotify_attackshot") return COMPONENT_EVENT_NOT_HANDLED;

        // Engine.dll AnimNotify_AttackShot::Notify 0x94c34d / 0x94c368.
        const finalShot = !this.currentAttack.skill || notify.object.objectName === this.lastShotName;

        if (finalShot || this.currentAttack.skill.isMultiShot) {
            if (this.currentAttack.skill) this.pendingShot = finalShot ? "finalShot" : "shot";
            else this.triggerShot(this.lastTime, finalShot);
        }
    }

    public onUpdate(currentTime: number, _deltaTime: number): void {
        this.lastTime = currentTime;
        this.nativeEffects.update();
        this.updatePendingEffects(currentTime);

        for (let i = this.pendingSounds.length - 1; i >= 0; i--) {
            const pending = this.pendingSounds[i];

            if (pending.dueTime > currentTime) continue;

            this.pendingSounds.splice(i, 1);
            this.getComponent<SoundComponent>("sound").playSkillSound(pending.sound);
        }

        if (!this.isActive) return;

        // Engine.dll MagicProcess 0x7b5051..0x7b508d: consume PreShot before Shot.
        if (this.pendingPreShot) {
            this.stagePreShot++;
            if (!this.currentAttack.skill.hasVisualEffect) this.triggerPhase("preshot", currentTime);
            this.pendingPreShot = false;
        }
        if (this.pendingShot) {
            this.triggerShot(currentTime, this.pendingShot === "finalShot");
            this.pendingShot = null;
        }

        const parent = this.getParent();

        if (this.currentAttack) {
            if (this.currentAttack.skill) {
                if (this.currentAttack.skill.castStyle !== 0 && this.updateSkillAnimation(currentTime)) return;
            } else if (parent.isPlayingOneShotAnimation(this.currentAttack.animation)) {
                this.updateShot(parent, currentTime);
                return;
            }

            this.updateShot(parent, currentTime, true);

            if (this.pendingEffects.length > 0 || this.pendingSounds.length > 0) return;

            this.currentAttack = null;

            if (this.selection !== "random") {
                this.finish();
                return;
            }
        }

        const target = this.target;

        parent.getWorldPosition(tmpNpcPosition);
        target.getWorldPosition(tmpTargetPosition);

        const attackRange = parent.getCollisionRadius() + target.getCollisionRadius() + ATTACK_RANGE_PADDING;
        const dx = tmpTargetPosition.x - tmpNpcPosition.x;
        const dy = tmpTargetPosition.y - tmpNpcPosition.y;

        if (dx * dx + dy * dy > attackRange * attackRange) {
            if (!parent.isLocomoting()) parent.goToActor(target, attackRange);
            return;
        }

        parent.stopMoving();
        parent.faceActor(target === parent ? null : target);

        const index = this.selection === "random" ? Math.floor(Math.random() * this.attacks.length) : this.selection;
        const attack = this.attacks[index];

        if (!attack) throw new Error(`NPC attack '${this.selection}' does not exist.`);

        this.currentAttack = attack;
        this.attackStartedAt = currentTime;
        this.shotTriggered = false;
        this.stageShot = 0;
        this.stagePreShot = 0;
        this.pendingPreShot = false;
        this.pendingShot = null;
        if (attack.skill) {
            if (attack.skill.castStyle === 0) {
                // Engine.dll OnReceiveMagicSkillUse 0x7506b5..0x75075a: transient effects bypass MagicProcess.
                this.skillShotTime = 0;
                this.lastShotName = null;
                if (attack.skill.hasVisualEffect) this.triggerPhase("casting", currentTime);
                else if (!attack.skill.nativeTransientRejected) throw new Error(`Native transient effect '${attack.skill.name}' is not implemented.`);
            } else {
                this.initSkillAnimation(attack);
                this.triggerPhase("casting", currentTime);
                this.updateSkillAnimation(currentTime);
            }
        } else {
            parent.playAnimation(attack.animation, 0.1, 1, false, true);
            this.lastShotName = this.getAttackShotNotify(parent);
        }
    }

    protected initSkillAnimation(attack: NpcAttack_T): void {
        const parent = this.getParent();
        const animation = this.getComponent<AnimationComponent>("animation");
        const skill = attack.skill;
        const category = skill.animationCategory.toLowerCase();
        const weapon = parent.getUnrealScriptProperty("CurWeaponType") as number;
        const speed = parent.getUnrealScriptProperty("SkillSpeedRate") as number;
        const names = this.skillAnimations;
        const times = this.skillAnimationTimes;

        if (!Number.isFinite(speed) || speed <= 0) throw new Error(`${parent.name} has invalid SkillSpeedRate '${speed}'.`);

        names.length = 0;
        times.length = 0;
        this.skillAnimationIndex = -1;
        this.flexibleAnimationIndex = -1;
        this.skillShotTime = 0;
        this.lastShotName = null;

        // Engine.dll SetSkillAnim 0x796f50..0x797825: the NPC table replaces only the last slot.
        if (category && category !== "none") {
            const index = "abcdefghi".indexOf(category);

            if (category.length === 1 && index >= 0) {
                names.push((parent.getUnrealScriptProperty(arrCastAnimations[Math.floor(index / 3)]) as string[])[weapon]);
                this.flexibleAnimationIndex = 1;
            } else if (["j", "k", "l"].includes(category)) this.flexibleAnimationIndex = 0;
            else throw new Error(`Skill animation category '${skill.animationCategory}' is not implemented.`);

            names.push((parent.getUnrealScriptProperty("CastEndAnimName") as string[])[weapon]);
        }
        names.push(attack.animation);

        let totalTime = 0;
        let notifyTime = 0;
        let shotIndex = -1;

        // Engine.dll InitSkillProcess 0x798998..0x798a94.
        for (let i = names.length - 1; i >= 0; i--) {
            const clip = animation.getAnimationClip(names[i]);

            if (!clip && names[i].toLowerCase() !== "none") throw new Error(`${parent.name} has no skill animation '${names[i]}'.`);
            times[i] = clip && i !== this.flexibleAnimationIndex ? clip.duration : 0;
            if (!times[i]) continue;

            if (notifyTime !== 0) totalTime += times[i];
            else {
                const notifications = (clip as any).animationNotifies as IAnimationNotifyDecodeInfo[];
                let frame = 0;

                for (let j = (notifications?.length || 0) - 1; j >= 0; j--) {
                    const object = notifications[j].object;

                    if (object?.type !== "native" || object.className.toLowerCase() !== "animnotify_attackshot") continue;
                    this.lastShotName = object.objectName;
                    frame = notifications[j].time;
                    break;
                }

                shotIndex = i;
                totalTime = notifyTime = frame * times[i];
            }
        }

        if (totalTime === 0) {
            shotIndex = times.length - 1;
            notifyTime = times[shotIndex];
            for (const time of times) totalTime += time;
        }

        const hasVisual = skill.hasVisualEffect;
        const epsilon = hasVisual && skill.flyingTime >= 0.15 ? skill.flyingTime : skill.castStyle === 3 ? 0 : !hasVisual && [2, 5, 8, 10].includes(skill.castStyle) ? 0.4 : 0.15;
        const hitTime = skill.hitTime - epsilon;
        const flexible = this.flexibleAnimationIndex;

        // Engine.dll InitSkillProcess 0x798af9..0x798bb2.
        this.skillTweenTime = flexible < 0 ? 0.2 : 0.2 / speed;
        this.skillAnimationRate = flexible < 0 ? totalTime / (hitTime - 0.2) : speed;
        if (flexible >= 0) {
            times[flexible] = hitTime - (totalTime + 0.2) / speed;
            if (times[flexible] < 0 && hitTime - this.skillTweenTime > 0.0001) {
                this.skillAnimationRate = totalTime / (hitTime - this.skillTweenTime);
                times[flexible] = 0;
            }
        }

        let elapsed = this.skillTweenTime;
        for (let i = 0; i < times.length; i++) {
            if (i === shotIndex) this.skillShotTime = elapsed + (this.skillAnimationRate > 0 ? notifyTime / this.skillAnimationRate : 0);
            times[i] = elapsed + (i === flexible || this.skillAnimationRate <= 0 ? times[i] : times[i] / this.skillAnimationRate);
            if (i === 0 && i !== flexible && this.skillAnimationRate > 0 && epsilon >= 0.15) times[i] -= times[i] / hitTime * 0.15;
            elapsed = times[i];
        }
    }

    protected updateSkillAnimation(currentTime: number): boolean {
        const elapsed = (currentTime - this.attackStartedAt) / 1000;

        // Engine.dll MagicProcess 0x7b5110..0x7b5298: skip zero-length slots and advance by stage time.
        while (this.skillAnimationIndex < 0 || elapsed > this.skillAnimationTimes[this.skillAnimationIndex]) {
            const index = ++this.skillAnimationIndex;

            if (index >= this.skillAnimations.length) return false;
            if (this.skillAnimationTimes[index] <= 0) continue;

            const name = this.skillAnimations[index];
            // Engine.dll USkeletalMeshInstance::PlayAnim 0x94406b: negative rates are rejected.
            if (name.toLowerCase() !== "none" && this.skillAnimationRate >= 0)
                this.getParent().playAnimation(name, elapsed === 0 ? this.skillTweenTime : 0, this.skillAnimationRate, index === this.flexibleAnimationIndex, true);
            break;
        }

        return this.skillAnimationIndex < this.skillAnimations.length;
    }

    public getAttacks(): readonly NpcAttack_T[] { return this.attacks; }

    public attack(target: BaseActor, selection: NpcAttackSelection_T, locList: readonly Vector3Arr[] = []): void {
        if (!target) throw new Error("NPC attack has no target.");
        if (this.attacks.length === 0) throw new Error(`${this.getParent().name || "NPC"} has no attacks.`);
        if (selection !== "random" && !this.attacks[selection]) throw new Error(`NPC attack '${selection}' does not exist.`);
        if (!Array.isArray(locList) || locList.some(location => !Array.isArray(location) || location.length !== 3 || !location.every(Number.isFinite))) throw new Error(`NPC skill locations must be XYZ triples of finite numbers.`);

        const parent = this.getParent();

        this.stop();
        this.target = target;
        this.locList = locList.map(location => location.slice() as Vector3Arr);
        this.selection = selection;
        this.pendingEffects.length = 0;
        this.currentAttack = null;
        this.shotTriggered = false;
        this.lastShotName = null;
        this.stageShot = 0;
        this.stagePreShot = 0;
        this.pendingPreShot = false;
        this.pendingShot = null;
        this.isActive = true;
        parent.stopMoving();
        parent.faceActor(null);
        parent.playMovementAnimation("idle");
    }

    public stop(): void {
        if (!this.isActive && !this.currentAttack && this.pendingEffects.length === 0 && this.attackEffects.length === 0) return;

        for (const effect of this.attackEffects)
            if (effect.parent) this.renderManager.removeTransientEffect(effect);

        this.attackEffects.length = 0;
        this.preparedProjectiles.length = 0;
        this.nativeEffects.clear();

        this.finish();
    }

    protected finish(): void {
        const parent = this.getParent();

        this.pendingEffects.length = 0;
        this.pendingSounds.length = 0;
        this.target = null;
        this.currentAttack = null;
        this.shotTriggered = false;
        this.lastShotName = null;
        this.stageShot = 0;
        this.stagePreShot = 0;
        this.pendingPreShot = false;
        this.pendingShot = null;
        this.isActive = false;
        parent.stopMoving();
        parent.faceActor(null);
        parent.playMovementAnimation("idle");
    }

    protected updateShot(parent: BaseActor, currentTime: number, force: boolean = false): void {
        if (this.shotTriggered || this.currentAttack.skill?.castStyle === 0) return;
        // Engine.dll MagicProcess 0x7b516a: synthesize FinalShot only without LastShotName.
        if (this.currentAttack.skill) {
            if (!force || this.lastShotName) return;
        } else if (this.lastShotName && !force) return;

        const action = parent.getAnimationAction();
        const clip = action ? action.getClip() : null;
        const frame = action && clip.duration > 0 ? action.time / clip.duration : 1;
        const attackEffectFrame = clip ? Number((clip as any).attackEffectFrame) || 0 : 0;

        if (!force && frame < attackEffectFrame) return;

        this.triggerShot(currentTime);
    }

    protected triggerShot(currentTime: number, finalShot: boolean = true): void {
        if (this.shotTriggered) return;

        this.shotTriggered = finalShot;
        this.stageShot++;
        const projectileExplosion = this.triggerPhase("shot", currentTime);
        if (finalShot && !projectileExplosion) this.triggerPhase("explosion", currentTime + (this.currentAttack.skill?.flyingTime || 0) * 1000);
    }

    protected getAttackShotNotify(parent: BaseActor): string {
        const action = parent.getAnimationAction();
        const notifications = action ? (action.getClip() as any).animationNotifies as IAnimationNotifyDecodeInfo[] : null;

        if (!notifications) return null;

        // Engine.dll AnimGetAttackShotNotifyTimeRev 0x949da7 / 0x949df7.
        for (let i = notifications.length - 1; i >= 0; i--) {
            const object = notifications[i].object;

            if (object?.type === "native" && object.className.toLowerCase() === "animnotify_attackshot") return object.objectName;
        }

        return null;
    }

    protected triggerPhase(phase: NpcSkillEffectPhase_T, phaseTime: number, skill: NpcSkillAttack_T = this.currentAttack?.skill, source: Object3D = this.getParent(), target: BaseActor = this.target): boolean {
        if (!skill) return false;

        const hasVisual = skill.hasVisualEffect;
        let projectileExplosion = false;

        if (!hasVisual && phase === "shot" && skill.nativeFinalShotOnly && !this.shotTriggered) return false;

        if (!hasVisual && skill.nativeEffects.length) {
            const script = this.getComponent<ScriptComponent<BaseActor>>("script");

            for (const name of skill.nativeEffects)
                for (const effect of getNativeEffect(name, skill.nativeEffectGroup))
                    if (effect.phase === phase) {
                        let effectSource = source;

                        if (effect.releaseProjectile) {
                            // Engine.dll Shot 0x7afa3a exits without an impact when no prepared arrow exists.
                            projectileExplosion = true;
                            // Engine.dll Shot 0x7afa26..0x7afa70: detach, ShotNotify, remove prepared arrow.
                            if (!target || this.preparedProjectiles.length === 0) continue;

                            const projectile = this.preparedProjectiles[this.preparedProjectiles.length - 1];

                            projectile.getComponent<NProjectileComponent>("nProjectile").detachFromBase();
                            projectile.getComponent<ScriptComponent>("script").call("ShotNotify");
                            this.preparedProjectiles.pop();
                            effectSource = projectile;
                        }

                        this.nativeEffects.spawn(effect, skill, this.getParent(), target, script, this.skillShotTime, actor => {
                            // Engine.dll SpawnSkillEffect 0x79869a..0x7986b0.
                            if (phase === "casting" && skill.castStyle !== 0 && effect.adjustParticleLife !== false) (actor as any).adjustParticleLife(this.skillShotTime + (effect.adjustParticleLife === "shotTime" ? 0 : 1));
                            if (effect.projectile) {
                                const flight = effect.projectile;
                                const destination = flight.target === "caster" ? this.getParent() : target;
                                const properties = (actor as any).scriptProperties;

                                destination.getWorldPosition(tmpTargetPosition);
                                tmpTargetPosition.z += destination.getCollisionHeight();
                                properties.set("SkillID", skill.id);
                                properties.get("MagicInfo").MagicID = skill.id;
                                properties.get("MagicInfo").LevelID = skill.level;
                                if (flight.speed !== undefined) properties.set("Speed", flight.speed);
                                if (flight.acceleration !== undefined) properties.set("AccSpeed", flight.acceleration);
                                if (phase !== "preshot") properties.set("Physics", EPhysics_T.PHYS_NProjectile);
                                (actor as any).addComponent(new NProjectileComponent(this.renderManager, this.getParent(), destination, projectile => {
                                    this.triggerPhase("explosion", this.lastTime, skill, projectile, destination);
                                }, flight.path ? new NMover(actor.position, tmpTargetPosition, flight.path, flight.speed, flight.acceleration) : null));
                                if (phase === "preshot") this.preparedProjectiles.push(actor as Object3D & IObject);
                                projectileExplosion = true;
                            }
                            this.addAttackEffect(actor, effect.owner === "none" ? null : effect.owner === "target" ? target : effect.owner === "source" ? effectSource as Object3D & IObject : this.getParent());
                        }, effectSource, this.locList);
                    }
        }

        // Engine.dll: native Init 0x7a1bb6 / Shot 0x7b0e33; serialized phases 0x796a11 / 0x796ca8 / 0x795ebe.
        if (hasVisual || skill.nativeSoundPhases.includes(phase))
            for (const sound of skill.sounds) {
                if (sound.phase !== phase) continue;

                if (phaseTime > this.lastTime) this.pendingSounds.push({ dueTime: phaseTime, sound });
                else this.getComponent<SoundComponent>("sound").playSkillSound(sound);
            }

        for (const action of skill.actions) {
            if (action.phase !== phase) continue;
            // Engine.dll TriggerShot 0x796b50: zero selects FinalShot, otherwise StageShot.
            if (phase === "shot" && !(action.specificStage === 0 && this.shotTriggered) && action.specificStage !== this.stageShot) continue;

            if (phaseTime > this.lastTime) this.pendingEffects.push({ dueTime: phaseTime, action, skill });
            else {
                const effect = this.spawnSkillEffect(action, skill, source, target);

                if ((effect as any).findComponent("nProjectile")) projectileExplosion = true;
            }
        }

        return projectileExplosion;
    }

    protected updatePendingEffects(currentTime: number): void {
        for (let i = this.pendingEffects.length - 1; i >= 0; i--) {
            const pending = this.pendingEffects[i];

            if (pending.dueTime > currentTime) continue;

            this.pendingEffects.splice(i, 1);
            this.spawnSkillEffect(pending.action, pending.skill);
        }
    }

    protected spawnSkillEffect(action: NpcSkillEffectAction_T, skill: NpcSkillAttack_T, source: Object3D = this.getParent(), target: BaseActor = this.target): Object3D {
        const parent = this.getParent();
        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        if (!script) throw new Error(`${parent.name || "NPC"} has no script runtime for skill effect '${action.effectClass}'.`);

        const effect = script.createObject(action.effectClass) as unknown as Object3D;

        if (!(effect as any).isObject3D) throw new Error(`Skill effect '${action.effectClass}' is not an actor.`);

        // Engine.dll TriggerCasting 0x7969a2..0x7969e3; transient casting does not adjust lifetime.
        if (action.phase === "casting" && skill.castStyle !== 0 && this.skillShotTime > 0) {
            const fixed = (effect as any).scriptProperties.get("FixedLifeTime") as number;

            if (!Number.isFinite(fixed)) throw new Error(`Skill effect '${action.effectClass}' has no FixedLifeTime default.`);
            (effect as any).adjustParticleLife(fixed === 0 ? this.skillShotTime + 0.2 : fixed);
        }

        const host = (action.spawnOnTarget && target ? target : source) as BaseActor;
        const hostIsPawn = !!host.isActor;
        const radius = hostIsPawn ? host.getCollisionRadius() : host.scriptProperties.get("CollisionRadius") as number;
        const height = hostIsPawn ? host.getCollisionHeight() : 0;
        const sourceProjectile = !action.useCharacterRotation && (source as any).findComponent("nProjectile");
        let projectile = false;

        if (action.phase === "shot") {
            const classes = script.getVM().library.scriptClasses;

            for (let cls = classes[(effect as any).scriptClassId]; cls; cls = classes[cls.superClassId]) {
                if (cls.id !== "engine.NSkillProjectile") continue;

                projectile = true;
                (effect as any).scriptProperties.set("SkillID", skill.id);
                (effect as any).scriptProperties.set("Physics", EPhysics_T.PHYS_NProjectile);
                (effect as any).addComponent(new NProjectileComponent(this.renderManager, parent, target, actor => {
                    this.triggerPhase("explosion", this.lastTime, skill, actor, target);
                }));
                break;
            }
        }
        // Engine.dll USkillAction_LocateEffect::Notify 0x796643 / 0x79666a: delay emission after spawning the actor.
        const delay = action.spawnDelay < 0 ? skill.hitTime + action.spawnDelay : action.spawnDelay;

        if (delay > 0)
            effect.traverse((emitter: any) => {
                if (emitter.particlePool) emitter.setDelayed(delay);
            });

        if (action.sizeScale) {
            const sizeScale = radius * SKILL_EFFECT_RADIUS_SCALE;

            effect.traverse((child: any) => {
                if (typeof child.setSizeScale === "function") child.setSizeScale(sizeScale);
            });
        }

        // Engine.dll LocateEffect 0x796246 / 0x7962b1: no owner for unattached effects, selected host otherwise.
        this.addAttackEffect(effect, action.attachOn === "none" ? null : host);

        if (action.useCharacterRotation) {
            if (hostIsPawn) getPawnRotation(host, tmpEffectRotation);
            else host.getWorldQuaternion(tmpEffectRotation);
        }
        else if (sourceProjectile) {
            tmpRotator.set(...(source as any).scriptProperties.get("HitRot")).toQuaternion(tmpEffectRotation);
        }
        else getTargetRotation(source as BaseActor, target, tmpEffectRotation);

        tmpEffectOffset.fromArray(action.offset);
        if (action.relativeToCylinder) {
            // Engine.dll LocateEffect 0x796155: radius scales X only; skeletal Z uses DrawScale * mesh Origin.Z.
            tmpEffectOffset.x *= radius;
            tmpEffectOffset.z *= hostIsPawn ? getPawnMeshHeight(host) : host.scriptProperties.get("CollisionHeight") as number;
        }
        tmpEffectPosition.copy(tmpEffectOffset);
        if (action.relativeToCylinder) tmpEffectPosition.applyQuaternion(tmpEffectRotation);

        // Engine.dll LocateEffect 0x796217 clears pitch after transforming the offset.
        tmpEffectEuler.setFromQuaternion(tmpEffectRotation);
        tmpEffectEuler.y = 0;
        effect.quaternion.setFromEuler(tmpEffectEuler);

        if (action.attachOn !== "none" && action.attachOn !== "trail") {
            const bone = action.attachOn === "rightHand" ? arrHandBones[0] : action.attachOn === "leftHand" ? arrHandBones[1] : action.attachBoneName;

            if (!host.attachObjectToBone(effect, bone, action.isAbsolute)) throw new Error(`${host.name || "NPC"} has no '${bone}' bone for skill effect '${action.effectClass}'.`);

            effect.position.copy(tmpEffectPosition);
            return effect;
        }

        if (action.attachOn === "trail" && !projectile) {
            const selfRotation = !!(effect as any).scriptProperties.get("bSelfRotation");
            const sameRotation = !selfRotation && (action.useCharacterRotation || !!(effect as any).scriptProperties.get("bTrailerSameRotation"));

            // Engine.dll LocateEffect 0x79634c / physTrailer 0x8ce46a: local RelativeTrailOffset or world TrailerPrePivot.
            if (action.useCharacterRotation) this.nativeEffects.addTrailer(effect, host, tmpEffectOffset, true, sameRotation);
            else {
                tmpEffectPosition.z += height;
                this.nativeEffects.addTrailer(effect, host, tmpEffectPosition, false, sameRotation);
            }
            this.nativeEffects.update();
            return effect;
        }

        // Engine.dll LocateEffect 0x79608f / 0x796221: the HitRot branch retains the projectile's LastTargetLocation.
        if (action.attachOn === "none" && sourceProjectile) effect.position.fromArray((source as any).scriptProperties.get("LastTargetLocation"));
        else {
            host.getWorldPosition(effect.position);
            effect.position.z += height;
        }
        effect.position.add(tmpEffectPosition);
        return effect;
    }

    protected getAttackDirection(out: Vector3): Vector3 {
        const parent = this.getParent();

        if (this.target) {
            parent.getWorldPosition(tmpNpcPosition);
            this.target.getWorldPosition(tmpTargetPosition);
            out.set(tmpTargetPosition.x - tmpNpcPosition.x, tmpTargetPosition.y - tmpNpcPosition.y, 0);

            if (out.lengthSq() > 0) return out.normalize();
        }

        return out.set(Math.cos(parent.rotation.z + Math.PI / 2), Math.sin(parent.rotation.z + Math.PI / 2), 0);
    }

    protected addAttackEffect(effect: Object3D, owner: Object3D & IObject = this.getParent()): void {
        for (let i = this.attackEffects.length - 1; i >= 0; i--)
            if (!this.attackEffects[i].parent) this.attackEffects.splice(i, 1);

        this.attackEffects.push(effect);
        this.renderManager.addTransientEffect(effect, owner);
    }
}

export default NpcAttackComponent;
