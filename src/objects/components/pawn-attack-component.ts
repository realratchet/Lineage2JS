import { Object3D, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent, type IObject } from "../../game/components";
import { ANIMATION_NOTIFY_EVENT } from "../../audio/components/sound-component";
import { getPawnRotation } from "../../utils/rotator";
import SoundComponent from "../../audio/components/sound-component";
import SkillVisualEffect, { type SkillCast_T } from "@l2js/engine/skills/skill-visual-effect";
import { getSkillHitTimeOffset, getSkillPreviewListTarget } from "@l2js/engine/skills/skill-visual-definition";
import SkillEffectHost from "./skill-effect-host";
import NProjectileComponent, { type ProjectileActor_T } from "../../physics/components/projectile-component";
import getSkillAnimation from "../../skills/skill-animation";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type AnimationComponent from "./animation-component";
import type { ScriptComponent } from "../../game/script-component";
import type { IAnimationNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";
import type { NpcSkillAttack_T, NpcSkillEffectPhase_T } from "@l2js/engine/contracts/pawn";

const ATTACK_RANGE_PADDING = 20;
const arrPhysicalAnimations = ["atk01", "atk02", "atk03"];
const tmpNpcPosition = new Vector3();
const tmpTargetPosition = new Vector3();
const tmpEffectPosition = new Vector3();
const tmpAttackDirection = new Vector3();

export type PawnAttack_T = {
    label: string;
    animation: string;
    skill: NpcSkillAttack_T | null;
};

export type PawnAttackSelection_T = number | "random";

export class PawnAttackComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnAttack";
    protected readonly renderManager: RenderManager;
    protected readonly attacks: PawnAttack_T[] = [];
    protected readonly attackEffects: Object3D[] = [];
    protected readonly skillEffects: SkillVisualEffect;
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
        this.skillEffects = new SkillVisualEffect(new SkillEffectHost(renderManager, (effect, owner) => this.addAttackEffect(effect as any, owner as any), effect => {
            renderManager.removeTransientEffect(effect as any);
            const index = this.attackEffects.indexOf(effect as any);

            if (index >= 0) this.attackEffects.splice(index, 1);
        }));

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

        this.skillEffects.clear();
        this.attackEffects.length = 0;
        this.bowProjectile = null;
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
                    this.skillEffects.addAttackLight(this.getParent(), this.target);
                }
                this.triggerShot(this.lastTime, finalShot);
            }
        }
    }

    public onUpdate(currentTime: number, _deltaTime: number): void {
        this.lastTime = currentTime;
        this.skillEffects.update(currentTime);

        if (!this.isActive) return;

        // Engine.dll MagicProcess 0x7b5051..0x7b508d: consume PreShot before Shot.
        if (this.pendingPreShot) {
            this.stagePreShot++;
            this.triggerPhase("preshot", currentTime);
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

            if (this.skillEffects.hasPending()) return;

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
        // Server supplies AssociatedActor; the preview selects the engine-defined default list.
        else if (attack.skill) {
            const listTarget = getSkillPreviewListTarget(attack.skill);

            if (listTarget) this.associatedActors.push(listTarget === "selected" ? this.requestedTarget : this.target);
        }
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
                this.shotTriggered = this.skillEffects.start(this.getSkillCast(), currentTime);
            } else {
                this.initSkillAnimation(attack);
                this.skillEffects.start(this.getSkillCast(), currentTime);
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
        if (names.length === 0) return;

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

        const epsilon = getSkillHitTimeOffset(skill);
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
        this.skillEffects.clear();

        if (!this.isActive && !this.currentAttack && !this.skillEffects.hasPending() && this.attackEffects.length === 0) return;

        for (const effect of this.attackEffects)
            if (effect.parent) this.renderManager.removeTransientEffect(effect);

        this.attackEffects.length = 0;

        this.finish();
    }

    protected finish(): void {
        const parent = this.getParent();

        this.skillEffects.finish();

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
                    this.skillEffects.addAttackLight(parent, target);
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
        if (this.skillAnimations.length === 0) return this.skillShotTime;

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

    protected getSkillCast(skill: NpcSkillAttack_T = this.currentAttack.skill): SkillCast_T {
        return { skill, caster: this.getParent(), target: this.target, associatedActors: this.associatedActors, locList: this.locList, targetExcepted: this.targetExcepted, stageShot: this.stageShot, stagePreShot: this.stagePreShot, finalShot: this.shotTriggered, shotTime: this.skillShotTime, firstShotTime: skill.castStyle === 0 ? 0 : this.getFirstShotTime() } as SkillCast_T;
    }

    protected triggerPhase(phase: NpcSkillEffectPhase_T, phaseTime: number, skill: NpcSkillAttack_T = this.currentAttack?.skill, source: Object3D = this.getParent(), target: BaseActor = this.target, hitActor: boolean = !!target, associatedActors: readonly BaseActor[] = this.associatedActors, impactActor: Object3D = hitActor ? target : null): boolean {
        if (!skill) return false;

        return this.skillEffects.notify(phase, phaseTime, this.getSkillCast(skill), source as any, target, hitActor, associatedActors, impactActor as any);
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
