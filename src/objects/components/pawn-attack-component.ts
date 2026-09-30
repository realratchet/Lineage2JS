import { Euler, Object3D, Quaternion, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent, type IObject } from "../../game/components";
import { ANIMATION_NOTIFY_EVENT } from "../../audio/components/sound-component";
import Rotator from "../../utils/rotator";
import SoundComponent from "../../audio/components/sound-component";
import getNativeEffect from "../../skills/native-effects";
import NativeSkillEffects, { getPawnRotation, getPawnMeshHeight, getPawnCastingEffectScale, getTargetRotation } from "../../skills/native-skill-effects";
import NProjectileComponent, { type ProjectileActor_T } from "../../physics/components/projectile-component";
import NMover from "../../physics/mover";
import getSkillAnimation from "../../skills/skill-animation";
import { EPhysics_T } from "../../assets/unreal/un-aactor";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type AnimationComponent from "./animation-component";
import type LitSkinnedMesh from "../lit-skinned-mesh";
import type { ScriptComponent } from "../../game/script-component";
import type { IAnimationNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";
import type { NpcSkillAttack_T, NpcSkillSound_T, NpcSkillEffectAction_T, NpcSkillEffectPhase_T } from "@l2js/engine/contracts/pawn";

const ATTACK_RANGE_PADDING = 20;
const SKILL_EFFECT_RADIUS_SCALE = 1 / 9; // Engine.dll USkillAction_LocateEffect::Notify 0x796514, float 0xaabad4.
const arrPhysicalAnimations = ["atk01", "atk02", "atk03"];
const tmpRotator = new Rotator();
const tmpNpcPosition = new Vector3();
const tmpTargetPosition = new Vector3();
const tmpEffectPosition = new Vector3();
const tmpEffectOffset = new Vector3();
const tmpEffectRotation = new Quaternion();
const tmpEffectEuler = new Euler(0, 0, 0, "ZYX");
const tmpAttackDirection = new Vector3();

export type PawnAttack_T = {
    label: string;
    animation: string;
    skill: NpcSkillAttack_T | null;
};

export type PawnAttackSelection_T = number | "random";

type PendingSkillEffect_T = { dueTime: number, phase: NpcSkillEffectPhase_T, actions: readonly NpcSkillEffectAction_T[], skill: NpcSkillAttack_T, source: Object3D, target: BaseActor, associatedActors: readonly BaseActor[] };

export class PawnAttackComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnAttack";
    protected readonly renderManager: RenderManager;
    protected readonly attacks: PawnAttack_T[] = [];
    protected readonly pendingEffects: PendingSkillEffect_T[] = [];
    protected readonly attackEffects: Object3D[] = [];
    protected readonly preparedProjectiles: (Object3D & IObject)[] = [];
    protected readonly nativeEffects: NativeSkillEffects;
    protected readonly pendingSounds: { dueTime: number, sound: NpcSkillSound_T, pawn: BaseActor }[] = [];
    protected target: BaseActor = null;
    protected requestedTarget: BaseActor = null;
    protected nextAttack: PawnAttack_T = null;
    protected locList: readonly Vector3Arr[] = [];
    protected readonly associatedActors: BaseActor[] = [];
    protected requestedAssociatedActors: readonly BaseActor[] = null;
    protected targetExcepted = false;
    protected selection: PawnAttackSelection_T = "random";
    protected currentAttack: PawnAttack_T = null;
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
    protected bowProjectile: ProjectileActor_T = null;
    protected bowPreShotFrame = 0;
    protected bowShotFrame = 0;

    public constructor(renderManager: RenderManager, protected readonly animationNames: readonly string[], skills: readonly NpcSkillAttack_T[], protected readonly bow: L2JS.Engine.INpcBowDecodeInfo = null) {
        super();

        this.renderManager = renderManager;
        this.nativeEffects = new NativeSkillEffects(renderManager);

        for (const physical of arrPhysicalAnimations) {
            const animation = animationNames.find(name => name.toLowerCase() === physical);

            if (animation) this.attacks.push({ label: `Physical: ${animation}`, animation, skill: null });
        }

        for (const skill of skills) {
            if (skill.passive) continue;
            if (!skill.animation || skill.animation.toLowerCase() === "none") continue;

            this.addSkill(skill);
        }
    }

    public addSkill(skill: NpcSkillAttack_T): number {
        const animation = skill.animation || null;

        const attack = { label: `Skill ${skill.id}: ${skill.name}`, animation, skill };
        const index = this.attacks.findIndex(entry => entry.skill?.id === skill.id && entry.skill.level === skill.level && entry.animation === animation);

        if (index < 0) return this.attacks.push(attack) - 1;
        this.attacks[index] = attack;
        return index;
    }

    public onDetach(): void {
        for (const effect of this.attackEffects)
            if (effect.parent) this.renderManager.removeTransientEffect(effect);

        this.nativeEffects.clear();
        this.pendingSounds.length = 0;
        this.attackEffects.length = 0;
        this.preparedProjectiles.length = 0;
        this.bowProjectile = null;
        this.pendingEffects.length = 0;
        this.target = null;
        this.requestedTarget = null;
        this.nextAttack = null;
        this.locList = [];
        this.associatedActors.length = 0;
        this.requestedAssociatedActors = null;
        this.targetExcepted = false;
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
        if (!this.currentAttack.skill && this.bow) return COMPONENT_EVENT_NOT_HANDLED;

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
            else {
                // Engine.dll AnimNotify_AttackShot 0x94c414..0x94c44b: first physical hit, not the animation-end fallback.
                if (!this.shotTriggered && this.target) {
                    this.target.getComponent<SoundComponent>("sound").playAttackSounds();
                    this.nativeEffects.addAttackLight(this.getParent(), this.target);
                }
                this.triggerShot(this.lastTime, finalShot);
            }
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
            pending.pawn.getComponent<SoundComponent>("sound").playSkillSound(pending.sound);
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

        if (!this.currentAttack && this.selection === "random" && !this.nextAttack)
            this.nextAttack = this.attacks[Math.floor(Math.random() * this.attacks.length)];

        const target = this.requestedTarget;
        const index = this.selection === "random" ? this.attacks.indexOf(this.nextAttack) : this.selection;
        const attack = this.attacks[index];

        if (!attack) throw new Error(`NPC attack '${this.selection}' does not exist.`);

        const rangeTarget = attack.skill?.previewTarget === "self" ? parent : target;

        parent.getWorldPosition(tmpNpcPosition);
        rangeTarget.getWorldPosition(tmpTargetPosition);

        const range = attack.skill ? attack.skill.castRange : this.bow?.attackRange;
        const attackRange = parent.getCollisionRadius() + target.getCollisionRadius() + (range === undefined ? ATTACK_RANGE_PADDING : Math.max(0, range));
        const dx = tmpTargetPosition.x - tmpNpcPosition.x;
        const dy = tmpTargetPosition.y - tmpNpcPosition.y;

        if (dx * dx + dy * dy - attackRange * attackRange > 1e-5) {
            if (!parent.isLocomoting()) parent.goToActor(rangeTarget, attackRange);
            return;
        }

        parent.stopMoving();
        parent.faceActor(rangeTarget === parent ? null : target);

        this.target = attack.skill?.previewTarget === "self" ? parent : this.requestedTarget;
        this.associatedActors.length = 0;
        if (this.requestedAssociatedActors) this.associatedActors.push(...this.requestedAssociatedActors);
        // Server supplies the hit list separately from an aura's primary self target.
        else if (attack.skill?.previewTarget === "self" && attack.skill.actions.some(action => action.onMultiTarget)) this.associatedActors.push(this.requestedTarget);
        // Server supplies AssociatedActor; the offline preview supplies the selected pawn.
        else if (attack.skill && (attack.skill.nativeAssociatedActors || attack.skill.nativeEffects.some(name => getNativeEffect(name, attack.skill.nativeEffectGroup).some(effect => effect.phase === "shot" && effect.pawnLightOnly && effect.associatedActors)))) this.associatedActors.push(this.target);
        this.nextAttack = null;
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
                else if (attack.skill.nativeEffects.length) this.triggerShot(currentTime);
                else if (!attack.skill.nativeTransientRejected) throw new Error(`Native transient effect '${attack.skill.name}' is not implemented.`);
            } else {
                this.initSkillAnimation(attack);
                this.triggerPhase("casting", currentTime);
                this.updateSkillAnimation(currentTime);
            }
        } else {
            parent.playAnimation(attack.animation, 0.1, 1, false, true);
            this.lastShotName = this.getAttackShotNotify(parent);
            if (this.bow) this.initBowAttack();
        }
    }

    protected initSkillAnimation(attack: PawnAttack_T): void {
        const parent = this.getParent();
        const animation = this.getComponent<AnimationComponent>("animation");
        const skill = attack.skill;
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

        const selected = getSkillAnimation(parent, skill.animationCategory);

        names.push(...selected.names);
        this.flexibleAnimationIndex = selected.flexibleIndex;
        // Engine.dll SetSkillAnim 0x7977ca..0x797825: mobskillanimgrp replaces only the NPC's final slot.
        if (attack.animation) names[Math.max(0, names.length - 1)] = attack.animation;
        if (names.length === 0) throw new Error(`Skill '${skill.id}' has no casting animation.`);

        let totalTime = 0;
        let notifyTime = 0;
        let shotIndex = -1;

        // Engine.dll InitSkillProcess 0x798998..0x798a94.
        for (let i = names.length - 1; i >= 0; i--) {
            const clip = animation.getAnimationClip(names[i]);

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
            const isNone = name.toLowerCase() === "none";
            if (!isNone && !this.getComponent<AnimationComponent>("animation").getAnimationClip(name)) continue;
            // Engine.dll USkeletalMeshInstance::PlayAnim 0x94406b: negative rates are rejected.
            if (!isNone && this.skillAnimationRate >= 0)
                this.getParent().playAnimation(name, elapsed === 0 ? this.skillTweenTime : 0, this.skillAnimationRate, index === this.flexibleAnimationIndex, true);
            break;
        }

        return this.skillAnimationIndex < this.skillAnimations.length;
    }

    public getAttacks(): readonly PawnAttack_T[] { return this.attacks; }

    public attack(target: BaseActor, selection: PawnAttackSelection_T, locList: readonly Vector3Arr[] = [], associatedActors: readonly BaseActor[] = null, targetExcepted: boolean = false): void {
        if (!target) throw new Error("NPC attack has no target.");
        if (this.attacks.length === 0) throw new Error(`${this.getParent().name || "NPC"} has no attacks.`);
        if (selection !== "random" && !this.attacks[selection]) throw new Error(`NPC attack '${selection}' does not exist.`);
        if (!Array.isArray(locList) || locList.some(location => !Array.isArray(location) || location.length !== 3 || !location.every(Number.isFinite))) throw new Error(`NPC skill locations must be XYZ triples of finite numbers.`);
        if (associatedActors !== null && (!Array.isArray(associatedActors) || associatedActors.some(actor => actor !== null && !actor?.isActor))) throw new Error(`NPC skill associated actors must be pawns or null.`);
        if (typeof targetExcepted !== "boolean") throw new Error(`NPC skill targetExcepted must be a boolean.`);

        const parent = this.getParent();

        this.stop();
        this.requestedTarget = target;
        this.requestedAssociatedActors = associatedActors && associatedActors.slice();
        // Server supplies bTargetExcepted; Engine.dll AddAssociatedActorNotify 0x798239 sets Pawn+0x500.
        this.targetExcepted = targetExcepted;
        this.target = selection !== "random" && this.attacks[selection].skill?.previewTarget === "self" ? parent : target;
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
        this.nativeEffects.clear();

        if (!this.isActive && !this.currentAttack && this.pendingEffects.length === 0 && this.attackEffects.length === 0) return;

        for (const effect of this.attackEffects)
            if (effect.parent) this.renderManager.removeTransientEffect(effect);

        this.attackEffects.length = 0;
        this.preparedProjectiles.length = 0;

        this.finish();
    }

    protected finish(): void {
        const parent = this.getParent();

        this.pendingEffects.length = 0;
        this.pendingSounds.length = 0;
        this.associatedActors.length = 0;
        this.requestedAssociatedActors = null;
        this.targetExcepted = false;
        this.target = null;
        this.requestedTarget = null;
        this.nextAttack = null;
        this.currentAttack = null;
        this.bowProjectile = null;
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
        if (!this.currentAttack.skill && this.bow) {
            this.updateBowAttack(force);
            return;
        }
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

    protected initBowAttack(): void {
        const clip = this.getParent().getAnimationAction().getClip() as any;

        this.bowProjectile = null;
        this.bowPreShotFrame = clip.attackEffectFrame;
        this.bowShotFrame = clip.attackEndEffectFrame;
        // Engine.dll BowAttackProcess 0x8c6c29 / 0x8c6e8c; AnimGetAttackShotNotifyTime 0x949c0d..0x949c5f keeps the last matching notify.
        for (const notify of clip.animationNotifies as IAnimationNotifyDecodeInfo[]) {
            if (notify.object?.type !== "native") continue;
            const name = notify.object.className.toLowerCase();

            if (clip.attackEffectFrame < 0 && name === "animnotify_attackpreshot") this.bowPreShotFrame = notify.time;
            if (clip.attackEndEffectFrame < 0 && name === "animnotify_attackshot") this.bowShotFrame = notify.time;
        }
        if (this.bowPreShotFrame < 0) this.bowPreShotFrame = 0;
        if (this.bowShotFrame < 0) this.bowShotFrame = 0;
    }

    protected updateBowAttack(force: boolean): void {
        const parent = this.getParent();
        const action = parent.getAnimationAction();
        const frame = action ? action.time / action.getClip().duration : 1;

        if (!this.bowProjectile && (force || frame >= this.bowPreShotFrame)) {
            const target = this.target;
            const arrow = parent.getComponent<ScriptComponent>("script").createObject("LineageEffect.NArrow") as unknown as ProjectileActor_T;
            const properties = arrow.scriptProperties;

            parent.getWorldPosition(arrow.position);
            getPawnRotation(parent, arrow.quaternion);
            // Engine.dll SetAtkArrow 0x8c04ae..0x8c0515 scales only DrawScale3D.X by sqrt(radius*height)/sqrt(207).
            const scale = Math.sqrt(parent.getCollisionRadius() * parent.getCollisionHeight() / 207);

            properties.get("DrawScale3D")[0] *= scale;
            arrow.scale.x *= scale;
            const projectile = arrow.addComponent(new NProjectileComponent(this.renderManager, parent, target, (_arrow, hitActor, impactActor) => {
                // Engine.dll ANProjectile::processHitWall 0x78d5b0: physical impact sounds/light are deferred until arrival.
                if (hitActor && impactActor === target) {
                    target.getComponent<SoundComponent>("sound").playAttackSounds();
                    this.nativeEffects.addAttackLight(parent, target);
                }
            }));

            this.addAttackEffect(arrow);
            // Engine.dll BowAttackProcess 0x8c6cde..0x8c6d22.
            if (!parent.attachObjectToBone(arrow, parent.getUnrealScriptProperty("RightHandBone") as string)) throw new Error(`Pawn '${parent.name}' cannot attach its arrow to RightHandBone.`);
            target.getEffectTargetLocation(tmpTargetPosition);
            tmpTargetPosition.toArray(properties.get("LastTargetLocation"));
            if (this.bow.curvature > 0) {
                arrow.getWorldPosition(tmpEffectPosition);
                projectile.prepareInterpolation(this.bow.curvature, tmpTargetPosition.sub(tmpEffectPosition));
            }
            this.bowProjectile = arrow;
        }

        if (!this.bowProjectile || !force && frame < this.bowShotFrame) return;

        const arrow = this.bowProjectile;

        // Engine.dll BowAttackProcess 0x8c6efb..0x8c6f57: detach, capture LocInitial for Hermite, then ShotNotify.
        arrow.getComponent<NProjectileComponent>("nProjectile").detachFromBase();
        if (arrow.scriptProperties.get("bHermiteInterpolation")) arrow.position.toArray(arrow.scriptProperties.get("LocInitial"));
        arrow.getComponent<ScriptComponent>("script").call("ShotNotify");
        this.bowProjectile = null;
        this.shotTriggered = true;
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

    protected getFirstShotTime(): number {
        const clip = this.getComponent<AnimationComponent>("animation").getAnimationClip(this.skillAnimations[0]);
        const notifications = clip ? (clip as any).animationNotifies as IAnimationNotifyDecodeInfo[] : [];

        // Engine.dll 0x7a00ec..0x7a0139: first AttackShot fraction * first SkillAnimTime (+0x55c).
        for (const notify of notifications) {
            if (notify.object?.type !== "native" || notify.object.className.toLowerCase() !== "animnotify_attackshot") continue;

            const time = notify.time * this.skillAnimationTimes[0];

            return time > 0 ? time : this.skillShotTime;
        }

        return this.skillShotTime;
    }

    protected triggerPhase(phase: NpcSkillEffectPhase_T, phaseTime: number, skill: NpcSkillAttack_T = this.currentAttack?.skill, source: Object3D = this.getParent(), target: BaseActor = this.target, hitActor: boolean = !!target, associatedActors: readonly BaseActor[] = this.associatedActors, impactActor: Object3D = hitActor ? target : null): boolean {
        if (!skill) return false;
        if (skill.previewTarget === "self") target = this.getParent();

        if (skill.hasVisualEffect) {
            // Engine.dll TriggerShot 0x796b50: zero selects FinalShot, otherwise StageShot.
            const actions = skill.actions.filter(action => action.phase === phase && (phase !== "shot" || action.specificStage === 0 && this.shotTriggered || action.specificStage === this.stageShot));
            const pending = { dueTime: phaseTime, phase, actions, skill, source, target, associatedActors: associatedActors.slice() };

            if (phaseTime <= this.lastTime) return this.spawnSkillEffects(pending);

            this.pendingEffects.push(pending);
            return false;
        }

        let projectileExplosion = false;
        let nativeEffectSpawned = false;
        let nativeTargeted = false;
        let soundWithoutEffect = false;

        if (phase === "shot" && skill.nativeFinalShotOnly && !this.shotTriggered) return false;
        // Engine.dll 0x7ac0d5..0x7ac0e0 and 0x7a8d21..0x7a8d2c return before particles and Shot sound when AssociatedActor is empty.
        if (phase === "shot" && skill.nativeAssociatedActors && associatedActors.length === 0) return false;

        if (skill.nativeEffects.length) {
            const script = this.getComponent<ScriptComponent<BaseActor>>("script");

            const effects = skill.nativeEffects.flatMap(name => getNativeEffect(name, skill.nativeEffectGroup)).filter(effect => effect.phase === phase && (effect.specificStage === undefined || effect.specificStage === this.stageShot));
            nativeTargeted = effects.some(effect => effect.associatedActors);
            const primaryAssociated = effects.some(effect => effect.associatedActors === "primaryPerAssociated");
            soundWithoutEffect = effects.some(effect => effect.soundWithoutEffect);

            // Engine.dll 0x7af128..0x7af1ec: Life Chant spawns once before its list; 0x7b003f..0x7b03c6 keeps drain pairs per target.
            for (let first = 0; first < effects.length;) {
                const targetMode = effects[first].associatedActors;
                let end = first + 1;

                while (end < effects.length && effects[end].associatedActors === targetMode) end++;

                // Engine.dll 0x7b003f..0x7b0042 dereferences each range-drain entry without a null guard.
                if (targetMode === "targetExceptedAndPrimary" && this.targetExcepted && associatedActors.some(actor => !actor)) throw new Error(`Native skill '${skill.name}' requires nonnull associated actors.`);

                // Engine.dll 0x7b03c6 falls through to the primary target after list pairs; 0x7ac101 instead ends Zaken's list branch.
                // Engine.dll 0x7a99b2..0x7a9b1f: primary first, then list excluding it, independent of bTargetExcepted.
                // Engine.dll 0x7a9f58..0x7a9f7f: each nonnull list slot repeats Action_Attack on the retained primary target.
                const targets = targetMode === "primaryPerAssociated" ? associatedActors.filter(actor => actor).map(() => target) : targetMode === "all" ? associatedActors : targetMode === "primaryAndSecondary" ? [target, ...associatedActors.filter(actor => actor !== target)] : !this.targetExcepted || !targetMode ? [target] : targetMode === "targetExceptedAndPrimary" ? [...associatedActors, target] : associatedActors;

                for (const effectTarget of targets)
                    for (let i = first; i < end; i++) {
                        let effect = effects[i];

                        if (targetMode && !effectTarget) {
                            if (effect.rejectNullAfterSpawn && nativeEffectSpawned) throw new Error(`Native skill '${skill.name}' has a null associated actor after a spawned effect.`);
                            continue;
                        }
                        if (effect.primaryTargetOnly && effectTarget !== target) continue;

                        if (effect.preShotBones) {
                            // Engine.dll 0x7a40cd..0x7a4123 / 0x7a42ee..0x7a430c: stage 1 uses right, otherwise left; only stages 1/2 reject NAME_None.
                            const boneProperty = effect.preShotBones[this.stagePreShot === 1 ? 0 : 1];
                            const bone = this.getParent().getUnrealScriptProperty(boneProperty);

                            if (typeof bone !== "string") throw new Error(`${this.getParent().name} has invalid bone property '${boneProperty}': '${bone}'.`);
                            if ((this.stagePreShot === 1 || this.stagePreShot === 2) && bone.toLowerCase() === "none") continue;
                            effect = { ...effect, boneProperty };
                        }

                        let effectSource = source;

                        if (effect.releaseProjectile) {
                            // Engine.dll Shot 0x7afa26 / 0x7ae073 require a target and prepared projectile.
                            projectileExplosion = true;
                            if (!effectTarget || this.preparedProjectiles.length === 0) return projectileExplosion;

                            // 0x7afa46 selects last; 0x7ae08d selects first. Both detach, ShotNotify, then RemoveItem.
                            const release = effect.releaseProjectile;
                            const projectile = this.preparedProjectiles[release !== true && release.first ? 0 : this.preparedProjectiles.length - 1];

                            if (!projectile) return projectileExplosion;

                            projectile.getComponent<NProjectileComponent>("nProjectile").detachFromBase();
                            projectile.getComponent<ScriptComponent>("script").call("ShotNotify");
                            for (let j = this.preparedProjectiles.length - 1; j >= 0; j--)
                                if (this.preparedProjectiles[j] === projectile) this.preparedProjectiles.splice(j, 1);
                            nativeEffectSpawned = true;
                            if (release !== true && !release.spawn) continue;
                            effectSource = projectile;
                        }

                        const continuePhase = this.nativeEffects.spawn(effect, skill, this.getParent(), effectTarget, script, effect.lifeSpan === "firstShotTime" ? this.getFirstShotTime() : this.skillShotTime, actor => {
                            // Engine.dll 0x7af1f1 stores list hits for sound; 0x7af205 -> 0x7b0e23 retains the caster Shot for a null primary.
                            // 0x7aa343 / 0x7ab0dd / Breath 0x7ab2cb retain the primary effect independently of bTargetExcepted.
                            if (phase === "explosion" || effect.projectile || primaryAssociated || effect.associatedActors || !this.targetExcepted) nativeEffectSpawned = true;
                            // Engine.dll SpawnSkillEffect 0x79869a..0x7986b0.
                            if (phase === "casting" && skill.castStyle !== 0 && effect.adjustParticleLife !== false) (actor as any).adjustParticleLife(this.skillShotTime + (effect.adjustParticleLife === "shotTime" ? 0 : 1));
                            if (effect.projectile) {
                                const flight = effect.projectile;
                                const destination = flight.target === "caster" ? this.getParent() : effectTarget;
                                const properties = (actor as any).scriptProperties;

                                destination.getWorldPosition(tmpTargetPosition);
                                tmpTargetPosition.z += destination.getCollisionHeight();
                                properties.set("SkillID", skill.id);
                                properties.get("MagicInfo").MagicID = skill.id;
                                properties.get("MagicInfo").LevelID = skill.level;
                                if (flight.speed !== undefined) properties.set("Speed", flight.speed);
                                if (flight.acceleration !== undefined) properties.set("AccSpeed", flight.acceleration);
                                if (phase !== "preshot") properties.set("Physics", EPhysics_T.PHYS_NProjectile);
                                // Engine.dll Explosion 0x7913ae/0x7913d8 reads the projectile's list, independently of the caster's current cast.
                                const targets = associatedActors.slice();
                                const projectile = new NProjectileComponent(this.renderManager, this.getParent(), destination, (projectile, hitActor, impactActor) => {
                                    this.triggerPhase("explosion", this.lastTime, skill, projectile, destination, hitActor, targets, impactActor);
                                }, flight.path ? new NMover(actor.position, tmpTargetPosition, flight.path, flight.speed, flight.acceleration) : null);

                                (actor as any).addComponent(projectile);
                                if (flight.interpolation !== undefined || flight.hermite) {
                                    // Engine.dll 0x7ace9b..0x7acf1e: launch origin, effect target location, caster-relative displacement.
                                    actor.position.toArray(properties.get("LocInitial"));
                                    destination.getEffectTargetLocation(tmpTargetPosition);
                                    this.getParent().getWorldPosition(tmpNpcPosition);
                                    tmpNpcPosition.z += this.getParent().getCollisionHeight();
                                    tmpTargetPosition.sub(tmpNpcPosition);
                                    if (flight.hermite) projectile.prepareHermiteInterpolation(tmpTargetPosition, actor.quaternion, flight.hermite.duration, flight.hermite.tangentScale, flight.hermite.finalDirectionZ);
                                    else projectile.prepareInterpolation(flight.interpolation, tmpTargetPosition);
                                }
                                if (phase === "preshot") this.preparedProjectiles.push(actor as Object3D & IObject);
                                projectileExplosion = true;
                            }
                            this.addAttackEffect(actor, effect.owner === "none" ? null : effect.owner === "target" ? effectTarget : effect.owner === "source" ? effectSource as Object3D & IObject : effect.owner === "impactActor" ? impactActor as Object3D & IObject : this.getParent());
                        }, effectSource, this.locList, hitActor, impactActor);

                        if (!continuePhase) return projectileExplosion;
                    }
                first = end;
            }
        }

        // Engine.dll 0x7b0e26..0x7b0e33: target-list Shot sound requires a spawned effect.
        if (phase === "shot" && nativeTargeted && !nativeEffectSpawned && !soundWithoutEffect) return false;

        const soundPawn = phase === "explosion" ? (source as any).scriptOwner as BaseActor : this.getParent();

        // Engine.dll 0x791ade..0x791b03: native Explosion sound requires a Pawn Owner and a returned effect.
        if (phase === "explosion" && (!nativeEffectSpawned || !soundPawn?.isActor)) return false;

        // Engine.dll: native Init 0x7a1bb6 / Shot 0x7b0e33.
        if (skill.nativeSoundPhases.includes(phase))
            for (const sound of skill.sounds) {
                if (sound.phase !== phase) continue;

                if (phaseTime > this.lastTime) this.pendingSounds.push({ dueTime: phaseTime, sound, pawn: soundPawn });
                else soundPawn.getComponent<SoundComponent>("sound").playSkillSound(sound);
            }

        return projectileExplosion;
    }

    protected spawnSkillEffects(pending: PendingSkillEffect_T): boolean {
        const { phase, actions, skill, source, target, associatedActors } = pending;
        let projectileExplosion = false;
        let effect: Object3D = null;

        for (const action of actions) {

            // Engine.dll Shot 0x796b6c..0x796b88 / Explosion 0x795e41..0x795e6d: empty lists fall back to the primary target.
            const multiTarget = phase === "shot" ? !target || action.onMultiTarget && associatedActors.length > 0 : phase === "explosion" && action.onMultiTarget && associatedActors.length > 0;
            const targets = multiTarget ? associatedActors : [target];

            for (const destination of targets) {
                effect = this.spawnSkillEffect(action, skill, source, destination, associatedActors, !multiTarget);

                if (effect && (effect as any).findComponent("nProjectile")) projectileExplosion = true;
            }
        }

        // Engine.dll 0x795e94..0x795ebe: Explosion requires a Pawn TargetActor and the last Notify result.
        if (phase === "explosion" && (!target?.isActor || !effect)) return projectileExplosion;

        // Engine.dll 0x796a11/0x796ca8: Casting and Shot sound follow all actions, including an empty stage.
        for (const sound of skill.sounds)
            if (sound.phase === phase) this.getComponent<SoundComponent>("sound").playSkillSound(sound, phase === "explosion" ? target : this.getParent());

        return projectileExplosion;
    }

    protected updatePendingEffects(currentTime: number): void {
        for (let i = 0; i < this.pendingEffects.length; i++) {
            const pending = this.pendingEffects[i];

            if (pending.dueTime > currentTime) continue;

            this.pendingEffects.splice(i--, 1);
            this.spawnSkillEffects(pending);
        }
    }

    protected spawnSkillEffect(action: NpcSkillEffectAction_T, skill: NpcSkillAttack_T, source: Object3D = this.getParent(), target: BaseActor = this.target, associatedActors: readonly BaseActor[] = this.associatedActors, initializeProjectile: boolean = true): Object3D {
        // Engine.dll LocateEffect 0x795ffa..0x796037 rejects a null selected host.
        if (action.spawnOnTarget && !target) return null;

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

        const host = (action.spawnOnTarget ? target : source) as BaseActor;
        const hostIsPawn = !!host.isActor;
        const radius = hostIsPawn ? host.getCollisionRadius() : host.scriptProperties.get("CollisionRadius") as number;
        const height = hostIsPawn ? host.getCollisionHeight() : 0;
        const sourceProjectile = !action.useCharacterRotation && (source as any).findComponent("nProjectile");
        let projectile = false;

        // Engine.dll 0x796c48..0x796c6b: multi-target Notify results bypass projectile initialization.
        if (action.phase === "shot" && initializeProjectile) {
            const classes = script.getVM().library.scriptClasses;

            for (let cls = classes[(effect as any).scriptClassId]; cls; cls = classes[cls.superClassId]) {
                if (cls.id !== "engine.NSkillProjectile") continue;

                projectile = true;
                // Engine.dll 0x796c16..0x796c1f copies MagicInfo, including AssociatedActor, into the projectile.
                const targets = associatedActors.slice();
                (effect as any).scriptProperties.set("SkillID", skill.id);
                (effect as any).scriptProperties.set("Physics", EPhysics_T.PHYS_NProjectile);
                (effect as any).addComponent(new NProjectileComponent(this.renderManager, parent, target, actor => {
                    this.triggerPhase("explosion", this.lastTime, skill, actor, target, !!target, targets);
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

        // Engine.dll LocateEffect 0x79603d..0x796053: target effects and non-pawns do not use CastingEffectScale.
        let sizeScale = !action.spawnOnTarget && hostIsPawn ? getPawnCastingEffectScale(host) : 1;

        if (action.sizeScale) sizeScale *= radius * SKILL_EFFECT_RADIUS_SCALE;

        // Engine.dll 0x796537: double 0xa97a60 is the SetSizeScale tolerance.
        if (Math.abs(sizeScale - 1) > 0.0001) {
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
        else if (source === target) getPawnRotation(target, tmpEffectRotation);
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
            let bone = action.attachBoneName;

            // Engine.dll 0x796401/0x79641d: pawn hand properties; AActor defaults at 0x5f6e50/0x5f6e80 return NAME_None.
            if (action.attachOn === "rightHand" || action.attachOn === "leftHand")
                bone = hostIsPawn ? host.getUnrealScriptProperty(action.attachOn === "rightHand" ? "RightHandBone" : "LeftHandBone") as string : "None";

            if (action.attachOn === "aliasSpecified") {
                const mesh = hostIsPawn ? host.getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh : null;
                const index = mesh ? mesh.tagAliases.findIndex(alias => alias.toLowerCase() === action.attachBoneName.toLowerCase()) : -1;

                // Engine.dll 0x7964b2/0x7964e7: resolve TagNames, then add only TagCoords.Origin.
                bone = index < 0 ? "None" : mesh.tagNames[index];
                if (index >= 0) tmpEffectPosition.add(tmpEffectOffset.fromArray(mesh.tagOrigins[index]));
            }

            if (typeof bone !== "string") throw new Error(`${host.name} has invalid skill attachment bone '${bone}'.`);
            // Engine.dll 0x796578/0x796596 -> 0x79660c destroys the effect for NAME_None or failed attachment.
            if (bone.toLowerCase() === "none" || !host.attachObjectToBone(effect, bone, action.isAbsolute)) {
                this.renderManager.removeTransientEffect(effect);
                this.attackEffects.splice(this.attackEffects.indexOf(effect), 1);
                return null;
            }

            effect.position.copy(tmpEffectPosition);
            (effect as any).scriptProperties.set("RelativeLocation", effect.position.toArray());
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

export default PawnAttackComponent;
