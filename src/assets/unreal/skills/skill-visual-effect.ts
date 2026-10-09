import SkillEffectPlacement from "./skill-effect-placement";
import FVector from "../un-vector";
import { EPhysics_T } from "../un-aactor";
import type { SkillActor_T, SkillEffectHost_T, SkillScriptHost_T } from "./skill-effect-host";
import type { NativeSkillEffect_T } from "./native-effects";
import type { NpcSkillAttack_T, NpcSkillEffectAction_T, NpcSkillEffectPhase_T, NpcSkillSound_T } from "../un-pawn";
import type { Vector3Arr, QuaternionArr } from "../library-types";

const tmpPosition: Vector3Arr = [0, 0, 0];
const tmpCasterPosition: Vector3Arr = [0, 0, 0];
const tmpRotation: QuaternionArr = [0, 0, 0, 1];

export type SkillCast_T = {
    skill: NpcSkillAttack_T;
    caster: SkillActor_T;
    target: SkillActor_T;
    associatedActors: readonly SkillActor_T[];
    locList: readonly Vector3Arr[];
    targetExcepted: boolean;
    stageShot: number;
    stagePreShot: number;
    finalShot: boolean;
    shotTime: number;
    firstShotTime: number;
};

type SkillPhase_T = {
    phase: NpcSkillEffectPhase_T;
    dueTime: number;
    cast: SkillCast_T;
    source: SkillActor_T;
    target: SkillActor_T;
    hitActor: boolean;
    impactActor: SkillActor_T;
    associatedActors: readonly SkillActor_T[];
    actions: NpcSkillEffectAction_T[];
    effects: NativeSkillEffect_T[];
    first: number;
    end: number;
    projectileExplosion: boolean;
    effectSpawned: boolean;
    targeted: boolean;
    primaryAssociated: boolean;
    soundWithoutEffect: boolean;
    lastEffect: SkillActor_T;
};

export class SkillVisualEffect implements SkillScriptHost_T {
    public readonly scriptClassId = "SkillVisualEffect";
    public readonly scriptProperties = new Map<string, any>();
    protected readonly placement: SkillEffectPlacement;
    protected readonly pendingEffects: SkillPhase_T[] = [];
    protected readonly pendingSounds: { dueTime: number, sound: NpcSkillSound_T, pawn: SkillActor_T }[] = [];
    protected readonly preparedProjectiles: SkillActor_T[] = [];
    protected readonly castingEffects: SkillActor_T[] = [];
    protected frame: SkillPhase_T = null;
    protected lastTime = 0;

    public constructor(protected readonly host: SkillEffectHost_T) {
        this.placement = new SkillEffectPlacement(host);
    }

    public update(currentTime: number): void {
        this.lastTime = currentTime;
        this.placement.update();

        for (let i = 0; i < this.pendingEffects.length; i++) {
            const pending = this.pendingEffects[i];

            if (pending.dueTime > currentTime) continue;
            this.pendingEffects.splice(i--, 1);
            this.execute(pending);
        }
        for (let i = this.pendingSounds.length - 1; i >= 0; i--) {
            const pending = this.pendingSounds[i];

            if (pending.dueTime > currentTime) continue;
            this.pendingSounds.splice(i, 1);
            this.host.playSkillSound(pending.pawn, pending.sound);
        }
    }

    public hasPending(): boolean { return this.pendingEffects.length > 0 || this.pendingSounds.length > 0; }

    public finish(): void {
        this.pendingEffects.length = 0;
        this.pendingSounds.length = 0;
    }

    public clear(): void {
        this.finish();
        this.preparedProjectiles.length = 0;
        this.castingEffects.length = 0;
        this.placement.clear();
    }

    public cancel(): void {
        for (const effect of this.castingEffects) // Engine.dll MagicStop 0x7b5410 destroys Pawn+0x52c (TriggerCasting) and Pawn+0x364 (NSkillProjectileActor) only.
            if (this.host.isAlive(effect)) this.host.removeEffect(effect);
        for (const projectile of this.preparedProjectiles)
            if (this.host.isAlive(projectile)) this.host.removeEffect(projectile);
        this.castingEffects.length = 0;
        this.preparedProjectiles.length = 0;
    }

    public addAttackLight(caster: SkillActor_T, target: SkillActor_T): void { this.placement.addAttackLight(caster, target); }
    public addAttackImpact(caster: SkillActor_T, target: SkillActor_T, critical: boolean, shield: boolean, spirit: boolean, grade: number): void { this.placement.addAttackImpact(caster, target, critical, shield, spirit, grade); }

    public start(cast: SkillCast_T, currentTime: number): boolean {
        const skill = cast.skill;

        if (skill.visual.soulshot) {
            this.placement.spawnSoulShot(skill, cast.caster);
            for (const sound of skill.sounds)
                if (sound.phase === "casting") this.host.playSkillSound(cast.caster, sound);
            return true;
        }

        // Engine.dll OnReceiveMagicSkillUse 0x7506b5..0x75075a: transient effects bypass MagicProcess.
        if (skill.castStyle === 0 && skill.visual.actions === null) {
            if (skill.visual.effects.length) {
                cast = { ...cast, stageShot: 1, finalShot: true };
                const projectile = this.notify("shot", currentTime, cast);

                if (!projectile) this.notify("explosion", currentTime + skill.flyingTime * 1000, cast);
                return true;
            }
            if (!skill.visual.transientRejected) throw new Error(`Native transient effect '${skill.name}' is not implemented.`);
            return false;
        }
        this.castingEffects.length = 0;
        this.notify("casting", currentTime, cast);
        return skill.castStyle === 0; // TriggerTransientEffect 0x795c20 executes CastingActions and leaves the action intact.
    }

    public notify(phase: NpcSkillEffectPhase_T, phaseTime: number, cast: SkillCast_T, source: SkillActor_T = cast.caster, target: SkillActor_T = cast.target, hitActor: boolean = !!target, associatedActors: readonly SkillActor_T[] = cast.associatedActors, impactActor: SkillActor_T = hitActor ? target : null): boolean {
        if (cast.skill.previewTarget === "self") target = cast.caster;

        return this.execute({ phase, dueTime: phaseTime, cast, source, target, hitActor, associatedActors, impactActor, actions: [], effects: [], first: 0, end: 0, projectileExplosion: false, effectSpawned: false, targeted: false, primaryAssociated: false, soundWithoutEffect: false, lastEffect: null });
    }

    protected execute(frame: SkillPhase_T): boolean {
        const previous = this.frame;

        this.frame = frame;
        try { return this.host.executeProgram(frame.cast.caster, this, frame.cast.skill.visual.programs[frame.phase]); }
        finally { this.frame = previous; }
    }

    public handlesUnrealNative(index: number, name: string): boolean {
        return index === 0 && ["BeginPhase", "NextAction", "NotifyAction", "EndPhase", "PhaseResult"].includes(name);
    }

    public callUnrealNative(call: { name: string, args: any[] }): any {
        if (!this.frame) throw new Error(`Skill native '${call.name}' called outside a skill phase.`);

        switch (call.name) {
            case "BeginPhase":
                if (call.args[0] !== this.frame.phase) throw new Error(`Skill program phase '${call.args[0]}' does not match '${this.frame.phase}'.`);
                return this.beginPhase();
            case "NextAction": return this.nextAction();
            case "NotifyAction": return this.notifyAction();
            case "EndPhase": this.endPhase(); return null;
            case "PhaseResult": return this.frame.projectileExplosion;
            default: throw new Error(`Skill native '${call.name}' is not implemented.`);
        }
    }

    protected beginPhase(): boolean {
        const frame = this.frame;
        const { skill, stageShot, finalShot } = frame.cast;
        const visual = skill.visual;

        if (visual.actions !== null) {
            if (frame.phase === "preshot") return false;
            if (frame.dueTime > this.lastTime) {
                this.pendingEffects.push({ ...frame, cast: { ...frame.cast }, associatedActors: frame.associatedActors.slice() });
                return false;
            }
            // Engine.dll TriggerShot 0x796b50: zero selects FinalShot, otherwise StageShot.
            frame.actions = visual.actions.filter(action => action.phase === frame.phase && (frame.phase !== "shot" || action.specificStage === 0 && finalShot || action.specificStage === stageShot));
        } else {
            if (frame.phase === "shot" && visual.finalShotOnly && !finalShot) return false;
            // Engine.dll 0x7ac0d5..0x7ac0e0 and 0x7a8d21..0x7a8d2c reject an empty AssociatedActor list.
            if (frame.phase === "shot" && visual.associatedActors && frame.associatedActors.length === 0) return false;
            frame.effects = visual.effects.filter(effect => effect.phase === frame.phase && (effect.specificStage === undefined || effect.specificStage === stageShot));
            frame.targeted = frame.effects.some(effect => effect.associatedActors);
            frame.primaryAssociated = frame.effects.some(effect => effect.associatedActors === "primaryPerAssociated");
            frame.soundWithoutEffect = frame.effects.some(effect => effect.soundWithoutEffect);
        }
        frame.first = frame.end = 0;
        return true;
    }

    protected nextAction(): boolean {
        const frame = this.frame;

        frame.first = frame.end;
        if (frame.cast.skill.visual.actions !== null) return frame.end++ < frame.actions.length;
        if (frame.first >= frame.effects.length) return false;

        const mode = frame.effects[frame.first].associatedActors;

        while (frame.end < frame.effects.length && frame.effects[frame.end].associatedActors === mode) frame.end++;
        return true;
    }

    protected notifyAction(): boolean {
        const frame = this.frame;
        const { cast, phase, source, target, associatedActors } = frame;
        const { caster, skill } = cast;

        if (skill.visual.actions !== null) {
            const action = frame.actions[frame.first];
            // Engine.dll Shot 0x796b6c..0x796b88 / Explosion 0x795e41..0x795e6d.
            const multiTarget = phase === "shot" ? !target || action.onMultiTarget && associatedActors.length > 0 : phase === "explosion" && action.onMultiTarget && associatedActors.length > 0;

            for (const destination of multiTarget ? associatedActors : [target]) {
                frame.lastEffect = this.placement.spawnSerialized(action, skill, caster, source, destination, cast.shotTime, !multiTarget, actor => {
                    const targets = associatedActors.slice();

                    actor.scriptProperties.set("SkillID", skill.id);
                    actor.scriptProperties.set("Physics", EPhysics_T.PHYS_NProjectile);
                    this.host.initProjectile(actor, caster, destination, projectile => {
                        this.notify("explosion", this.lastTime, cast, projectile, destination, !!destination, targets);
                    });
                });
                if (frame.lastEffect && phase === "casting" && cast.shotTime > 0) this.castingEffects.push(frame.lastEffect); // Engine.dll TriggerCasting 0x7969ea.
                if (frame.lastEffect && this.host.getProjectile(frame.lastEffect)) frame.projectileExplosion = true;
            }
            return true;
        }

        const effects = frame.effects;
        const targetMode = effects[frame.first].associatedActors;

        // Engine.dll 0x7b003f..0x7b0042 dereferences each range-drain entry without a null guard.
        if (targetMode === "targetExceptedAndPrimary" && cast.targetExcepted && associatedActors.some(actor => !actor)) throw new Error(`Native skill '${skill.name}' requires nonnull associated actors.`);

        // Engine.dll 0x7af128..0x7af1ec / 0x7b003f..0x7b03c6 retain effect order within each target.
        const targets = targetMode === "primaryPerAssociated" ? associatedActors.filter(actor => actor).map(() => target) : targetMode === "all" ? associatedActors : targetMode === "primaryAndSecondary" ? [target, ...associatedActors.filter(actor => actor !== target)] : !cast.targetExcepted || !targetMode ? [target] : targetMode === "targetExceptedAndPrimary" ? [...associatedActors, target] : associatedActors;

        for (const effectTarget of targets)
            for (let i = frame.first; i < frame.end; i++) {
                let effect = effects[i];

                if (targetMode && !effectTarget) {
                    if (effect.rejectNullAfterSpawn && frame.effectSpawned) throw new Error(`Native skill '${skill.name}' has a null associated actor after a spawned effect.`);
                    continue;
                }
                if (effect.primaryTargetOnly && effectTarget !== target) continue;
                if (effect.secondaryTargetOnly && effectTarget === target) continue;
                if (effect.preShotBones) {
                    // Engine.dll 0x7a40cd..0x7a4123 / 0x7a42ee..0x7a430c.
                    const boneProperty = effect.preShotBones[cast.stagePreShot === 1 ? 0 : 1];
                    const bone = caster.getUnrealScriptProperty(boneProperty);

                    if (typeof bone !== "string") throw new Error(`${caster.name} has invalid bone property '${boneProperty}': '${bone}'.`);
                    if ((cast.stagePreShot === 1 || cast.stagePreShot === 2) && bone.toLowerCase() === "none") continue;
                    effect = { ...effect, boneProperty };
                }

                let effectSource = source;

                if (effect.releaseProjectile) {
                    // Engine.dll Shot 0x7afa26 / 0x7ae073.
                    frame.projectileExplosion = true;
                    if (!effectTarget || this.preparedProjectiles.length === 0) return false;

                    const release = effect.releaseProjectile;
                    const projectile = this.preparedProjectiles[release !== true && release.first ? 0 : this.preparedProjectiles.length - 1];

                    if (!projectile) return false;
                    this.host.getProjectile(projectile).detachFromBase();
                    this.host.call(projectile, "ShotNotify");
                    for (let j = this.preparedProjectiles.length - 1; j >= 0; j--)
                        if (this.preparedProjectiles[j] === projectile) this.preparedProjectiles.splice(j, 1);
                    frame.effectSpawned = true;
                    if (release !== true && !release.spawn) continue;
                    effectSource = projectile;
                }

                const continuePhase = this.placement.spawn(effect, skill, caster, effectTarget, effect.lifeSpan === "firstShotTime" ? cast.firstShotTime : cast.shotTime, actor => {
                    // Engine.dll 0x7af1f1 / 0x7aa343 / 0x7ab0dd / 0x7ab2cb.
                    if (phase === "explosion" || effect.projectile || frame.primaryAssociated || effect.associatedActors || !cast.targetExcepted) frame.effectSpawned = true;
                    // Engine.dll SpawnSkillEffect 0x79869a..0x7986b0.
                    if (phase === "casting" && skill.castStyle !== 0 && effect.adjustParticleLife !== false) this.host.adjustParticleLife(actor, cast.shotTime + (effect.adjustParticleLife === "shotTime" ? 0 : 1));
                    if (effect.projectile) {
                        this.initProjectile(actor, effect, effectTarget, frame);
                        frame.projectileExplosion = true;
                    }
                    this.host.addEffect(actor, effect.owner === "none" ? null : effect.owner === "target" ? effectTarget : effect.owner === "source" ? effectSource : effect.owner === "impactActor" ? frame.impactActor : caster);
                }, effectSource, cast.locList, frame.hitActor, frame.impactActor);

                if (!continuePhase) return false;
            }
        return true;
    }

    protected initProjectile(actor: SkillActor_T, effect: NativeSkillEffect_T, target: SkillActor_T, frame: SkillPhase_T): void {
        const { cast, phase } = frame;
        const { caster, skill } = cast;
        const flight = effect.projectile;
        const destination = flight.target === "caster" ? caster : target;
        const properties = actor.scriptProperties;

        properties.set("SkillID", skill.id);
        properties.get("MagicInfo").MagicID = skill.id;
        properties.get("MagicInfo").LevelID = skill.level;
        if (flight.speed !== undefined) properties.set("Speed", flight.speed);
        if (flight.acceleration !== undefined) properties.set("AccSpeed", flight.acceleration);
        if (phase !== "preshot") properties.set("Physics", EPhysics_T.PHYS_NProjectile);
        // Engine.dll Explosion 0x7913ae/0x7913d8 reads the projectile's retained list.
        const targets = frame.associatedActors.slice();
        const projectile = this.host.initProjectile(actor, caster, destination, (projectile, hitActor, impactActor) => {
            this.notify("explosion", this.lastTime, cast, projectile, destination, hitActor, targets, impactActor);
        }, flight.path, flight.speed, flight.acceleration);

        if (flight.interpolation !== undefined || flight.hermite) {
            // Engine.dll 0x7ace9b..0x7acf1e: launch origin, effect target, caster-relative displacement.
            this.host.getPosition(actor, properties.get("LocInitial"));
            this.host.getEffectTargetLocation(destination, tmpPosition);
            this.host.getPosition(caster, tmpCasterPosition, true);
            tmpCasterPosition[2] += this.host.getCollisionHeight(caster);
            FVector.subElements(tmpPosition, tmpCasterPosition, tmpPosition);

            if (flight.hermite) projectile.prepareHermiteInterpolation(tmpPosition, this.host.getRotation(actor, tmpRotation), flight.hermite.duration, flight.hermite.tangentScale, flight.hermite.finalDirectionZ);
            else projectile.prepareInterpolation(flight.interpolation, tmpPosition);
        }
        if (phase === "preshot") this.preparedProjectiles.push(actor);
    }

    protected endPhase(): void {
        const frame = this.frame;
        const { cast, phase, source, target } = frame;
        const { caster, skill } = cast;

        if (skill.visual.actions !== null) {
            // Engine.dll 0x795e94..0x795ebe / 0x796a11 / 0x796ca8.
            if (phase === "explosion" && (!target?.isActor || !frame.lastEffect)) return;
            for (const sound of skill.sounds)
                if (sound.phase === phase) this.host.playSkillSound(caster, sound, phase === "explosion" ? target : caster);
            return;
        }
        // Engine.dll 0x7b0e26..0x7b0e33.
        if (phase === "shot" && frame.targeted && !frame.effectSpawned && !frame.soundWithoutEffect) { frame.projectileExplosion = false; return; }

        const soundPawn = phase === "explosion" ? source.scriptOwner : caster;

        // Engine.dll 0x791ade..0x791b03.
        if (phase === "explosion" && (!frame.effectSpawned || !soundPawn?.isActor)) { frame.projectileExplosion = false; return; }
        if (skill.visual.soundPhases.includes(phase))
            for (const sound of skill.sounds) {
                if (sound.phase !== phase) continue;
                if (frame.dueTime > this.lastTime) this.pendingSounds.push({ dueTime: frame.dueTime, sound, pawn: soundPawn });
                else this.host.playSkillSound(soundPawn, sound);
            }
    }
}

export default SkillVisualEffect;
