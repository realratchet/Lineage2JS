import { getRotatorQuaternionElements } from "../utils/rotator";
import FVector from "../un-vector";
import FQuaternion from "../un-quaternion";
import FCoords from "../un-coords";
import { EPhysics_T } from "../un-aactor";
import type { NpcSkillAttack_T, NpcSkillEffectAction_T } from "../un-pawn";
import type { NativeSkillEffect_T } from "./native-effects";
import type { SkillActor_T, SkillCoords_T, SkillEffectHost_T } from "./skill-effect-host";
import type { QuaternionArr, Vector3Arr } from "../library-types";

const tmpPosition: Vector3Arr = [0, 0, 0];
const tmpPosition2: Vector3Arr = [0, 0, 0];
const tmpMeshOrigin: Vector3Arr = [0, 0, 0];
const tmpTargetPosition: Vector3Arr = [0, 0, 0];
const tmpTargetCasterPosition: Vector3Arr = [0, 0, 0];
const tmpCasterPosition: Vector3Arr = [0, 0, 0];
const tmpLightPosition: Vector3Arr = [0, 0, 0];
const tmpLightDirection: Vector3Arr = [0, 0, 0];
const tmpNormal: Vector3Arr = [0, 0, 0];
const pawnMeshRotation: QuaternionArr = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
const tmpRotation: QuaternionArr = [0, 0, 0, 1];
const tmpRotation2: QuaternionArr = [0, 0, 0, 1];
const tmpBoneCoords: SkillCoords_T = { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1] };
const tmpShakeAmplitude: Vector3Arr = [0, 0, 0];
const tmpShakeVelocity: Vector3Arr = [0, 0, 0];
const tmpShakePosition: Vector3Arr = [0, 0, 0];

function getPawnMeshHeight(host: SkillEffectHost_T, pawn: SkillActor_T, scaled: boolean = true): number {
    const hasMesh = host.getMeshOrigin(pawn, tmpMeshOrigin);
    const drawScale = pawn.scriptClassId ? pawn.getUnrealScriptProperty("DrawScale") as number : 1;

    return hasMesh ? tmpMeshOrigin[2] * (scaled ? drawScale : 1) : scaled ? host.getCollisionHeight(pawn) : 0;
}

export function getPawnCastingEffectScale(pawn: SkillActor_T): number {
    const scale = pawn.scriptClassId ? pawn.getUnrealScriptProperty("CastingEffectScale") as number : 1;

    if (!Number.isFinite(scale) || scale < 0) throw new Error(`${pawn.name} has invalid CastingEffectScale '${scale}'.`);
    return scale;
}

export function getPawnRotation(host: SkillEffectHost_T, pawn: SkillActor_T, out: QuaternionArr): QuaternionArr {
    host.getRotation(pawn, out, true);
    return FQuaternion.multiplyElements(out, pawnMeshRotation, out);
}

export function getTargetRotation(host: SkillEffectHost_T, caster: SkillActor_T, target: SkillActor_T, out: QuaternionArr, useCasterRotation: boolean = true): QuaternionArr {
    if (!target || caster === target && useCasterRotation) return getPawnRotation(host, caster, out);

    host.getPosition(target, tmpTargetPosition, true);
    host.getPosition(caster, tmpTargetCasterPosition, true);
    FVector.subElements(tmpTargetPosition, tmpTargetCasterPosition, tmpTargetPosition);
    tmpTargetPosition[2] += host.getCollisionHeight(target) - host.getCollisionHeight(caster);
    return FVector.getRotationQuaternionElements(tmpTargetPosition, out);
}

function getBoneRotation(host: SkillEffectHost_T, actor: SkillActor_T, bone: string, out: QuaternionArr, fallback?: number): QuaternionArr {
    host.getBoneCoords(actor, bone, tmpBoneCoords, fallback);
    const { xAxis, yAxis, zAxis } = tmpBoneCoords;
    return FCoords.getOrthoRotationQuaternionElements(xAxis, yAxis, zAxis, out);
}

export class SkillEffectPlacement {
    protected readonly host: SkillEffectHost_T;
    protected readonly trailers: { effect: SkillActor_T, host: SkillActor_T, sameRotation: boolean, relative: boolean, offset: Vector3Arr }[] = [];
    protected readonly pawnLights: { actor: SkillActor_T, light: unknown, isCasting: boolean }[] = [];

    public constructor(host: SkillEffectHost_T) { this.host = host; }

    public update(): void {
        for (let i = this.pawnLights.length - 1; i >= 0; i--)
            if (!this.host.hasPawnLight(this.pawnLights[i].actor, this.pawnLights[i].light)) this.pawnLights.splice(i, 1);

        for (let i = this.trailers.length - 1; i >= 0; i--) {
            const { effect, host, sameRotation, relative, offset } = this.trailers[i];

            if (!this.host.isAlive(effect)) { this.trailers.splice(i, 1); continue; }

            this.host.getPosition(host, tmpPosition, true);
            if (relative) {
                if (host.isActor) getPawnRotation(this.host, host, tmpRotation);
                else this.host.getRotation(host, tmpRotation, true);
                FVector.applyQuaternionElements(offset, tmpRotation, tmpPosition2);
                if (host.isActor) tmpPosition[2] += this.host.getCollisionHeight(host);
            } else FVector.setElements(tmpPosition2, ...offset);
            FVector.addElements(tmpPosition, tmpPosition2, tmpPosition);
            this.host.setPosition(effect, tmpPosition);
            if (sameRotation) {
                if (host.isActor) getPawnRotation(this.host, host, tmpRotation);
                else this.host.getRotation(host, tmpRotation, true);
                this.host.setRotation(effect, tmpRotation);
            }
        }
    }

    public clear(): void {
        for (const { actor, light } of this.pawnLights) this.host.removePawnLight(actor, light);
        this.pawnLights.length = 0;
        this.trailers.length = 0;
    }

    public cancelCastingLights(): void {
        // Engine.dll MagicStop 0x7b554f..0x7b5587 removes FNPawnLight type2 only.
        for (let i = this.pawnLights.length - 1; i >= 0; i--) {
            const light = this.pawnLights[i];

            if (!light.isCasting) continue;
            this.host.removePawnLight(light.actor, light.light);
            this.pawnLights.splice(i, 1);
        }
    }

    public addTrailer(effect: SkillActor_T, host: SkillActor_T, offset: Vector3Arr, relative: boolean, sameRotation: boolean): void {
        this.trailers.push({ effect, host, sameRotation, relative, offset: [...offset] });
    }

    public spawnSoulShot(skill: NpcSkillAttack_T, caster: SkillActor_T): void {
        const shot = skill.visual.soulshot;
        const weapon = caster.getUnrealScriptProperty("CurWeaponType") as number;
        const hands = shot.hands[weapon];

        if (!hands) throw new Error(`Pawn '${caster.name}' has invalid weapon type '${weapon}'.`);

        for (let i = 0; i < hands.length; i++) {
            if (hands[i] === -1) continue;
            const length = this.host.getWeaponLength(caster, i === 0);

            if (length === null) continue;
            if (!Number.isFinite(length)) throw new Error(`Pawn '${caster.name}' has invalid weapon length '${length}'.`);

            const sticks = hands[i] === 1 && length > 12;
            const boneProperty = i === 0 ? "LeftHandBone" : "RightHandBone";
            const hasBone = (caster.getUnrealScriptProperty(boneProperty) as string).toLowerCase() !== "none";
            let actor: SkillActor_T;

            this.spawn({ phase: "casting", effectClass: sticks ? shot.sticks : shot.books, host: "caster", location: [0, 0, 0], rotation: "zero", boneProperty: hasBone ? boneProperty : undefined, relativeRotation: hasBone && !sticks && i === 0 ? [0, 16384, 0] : undefined }, skill, caster, caster, 0, effect => {
                actor = effect;
                this.host.addEffect(effect, caster);
            });
            if (hasBone && sticks) this.host.setSoulShotVelocity(actor, length);
        }
    }

    public spawn(info: NativeSkillEffect_T, skill: NpcSkillAttack_T, caster: SkillActor_T, target: SkillActor_T, shotTime: number, addEffect: (effect: SkillActor_T) => void, source: SkillActor_T = caster, locList: readonly Vector3Arr[] = [], hitActor: boolean = !!target, impactActor: SkillActor_T = hitActor ? target : null): boolean {
        // Engine.dll 0x7aa351..0x7aa35b: reject NULL, then distinguish TargetPawn == caster.
        if (info.targetIsCaster !== undefined && (!target || info.targetIsCaster !== (target === caster))) return true;
        // Engine.dll 0x7a9288..0x7a928e: Siege Hammer exits before both shake and particle without a target.
        if (info.targetRequired === "phase" && !target) return false;
        // Engine.dll 0x7a8198..0x7a81be rejects null/non-Pawn/NPC targets before the arm effect and Shot sound.
        if (info.targetIsNpc !== undefined && (!target || !target.isActor || target.getUnrealScriptProperty("bNpc") !== info.targetIsNpc)) return false;
        // Engine.dll Explosion 0x78f7cd/0x78fa8d/0x78fab4: hit actor, projectile Owner, then TargetActor.
        if (info.hitActor !== undefined && (info.hitActor !== hitActor || info.hitActor && !(info.host === "impactActor" ? impactActor : target))) return true;
        if (info.sourceOwner !== undefined && info.sourceOwner !== !!source.scriptOwner) return true;
        // Engine.dll 0x79106a..0x791072: ownerless Beam requires the projectile's retained TargetActor.
        if (info.sourceTarget !== undefined && info.sourceTarget !== !!source.scriptProperties.get("TargetActor")) return true;
        // Engine.dll 0x790861 -> 0x7485d0: Cast<AMover> selects the door impact.
        if (info.hitActorIsMover !== undefined && info.hitActorIsMover !== !!impactActor?.isMovableObject) return true;
        // Engine.dll 0x7a92ac..0x7a92b4: Siege Hammer's shake requires caster Owner; the particle does not.
        if (info.viewShake?.ownerRequired && !caster.scriptOwner) return true;

        const effectHost = (info.host === "caster" ? caster : info.host === "source" ? source : info.host === "impactActor" ? impactActor : target) as SkillActor_T;
        const damageOnly = info.damageEffect === "only";

        if (info.bonePropertyRequired) {
            const bone = effectHost.getUnrealScriptProperty(info.boneProperty);
            if (typeof bone !== "string") throw new Error(`${effectHost.name} has invalid bone property '${info.boneProperty}': '${bone}'.`);
            // Engine.dll 0x7a81c4..0x7a8204 checks NAME_None before spawning, not AttachToBone's result.
            if (bone.toLowerCase() === "none") return false;
        }

        if (damageOnly && !effectHost.isActor) return true;
        // Engine.dll 0x78f63c -> 0x78f6f0: an ownerless projectile still lights the hit Pawn without spawning a particle.
        if (info.pawnLightOnly) {
            // Engine.dll Action_Attack 0x8bdd15..0x8bddf2 precedes its pawn light at 0x8bdf44.
            if (info.attackSounds && effectHost.isActor) this.host.playAttackSounds(effectHost, info.attackSounds === "critical");
            // Engine.dll Action_Attack 0x8bde04..0x8bde4a: IsRendered and GL2KeepMinFrameRate precede the light.
            if (info.damageEffect === "associated") this.spawnAssociatedDamageEffect(caster, effectHost, addEffect);
            this.addPawnLight(info.pawnLight, caster, effectHost, source, shotTime, null, info.phase === "casting");
            return true;
        }

        if (info.locList) {
            let locations = locList;
            if (locations.length === 0 && info.locList.random) {
                // Server supplies impact positions; preview samples the configured range when absent.
                this.host.getPosition(caster, tmpPosition, true);
                locations = Array.from({ length: info.locList.random.count }, () => [
                    tmpPosition[0] + (Math.random() * 2 - 1) * info.locList.random.range,
                    tmpPosition[1] + (Math.random() * 2 - 1) * info.locList.random.range,
                    tmpPosition[2]
                ] as Vector3Arr);
            }
            for (let i = 0; i < locations.length; i++)
                if (!this.spawn({ ...info, locList: undefined, location: locations[i], delay: shotTime + info.locList.delay + i * info.locList.interval }, skill, caster, target, shotTime, addEffect, source, [], hitActor, impactActor)) return false;
            return true;
        }

        // Engine.dll 0x7a9bec/0x7a9fac/0x7aa5e3/0x7aaccf skip placement, retaining the zero-initialized shake position.
        let hasPosition = info.targetRequired !== "position" || !!target;
        // Engine.dll Breath 0x7ab16a checks the bone before the null target at 0x7ab20c.
        if ((hasPosition || info.missingBoneStopsPhase === "beforeTarget") && info.missingBoneStopsPhase) {
            const mesh = this.host.getMeshOrigin(effectHost, tmpPosition);
            // Engine.dll 0x7b0cbb/0x7b0cce keeps Shot sound without a skeletal mesh; 0x7b0d00 exits the phase for a missing name.
            if (!mesh && !info.viewShake) return true;
            // Engine.dll 0x7b0cf8..0x7b0d00 checks MatchRefBone, including mesh aliases.
            if (mesh && this.host.matchBone(effectHost, info.positionBone) < 0) return false;
            hasPosition = hasPosition && mesh;
        }
        if (!hasPosition && !info.viewShake) return true;

        let targetHeight: number;
        if (hasPosition && (info.height === "targetMeshOrigin" || info.height === "targetMeshOriginOrFeet")) {
            const hasMesh = this.host.getMeshOrigin(target, tmpPosition);
            // Engine.dll 0x7a9cd9/0x7aa099 reject non-skeletal targets; 0x7aae11..0x7aae1a falls back to CollisionHeight.
            if (!hasMesh && info.height === "targetMeshOrigin") return false;
            this.host.getPosition(target, tmpPosition2, true);
            targetHeight = tmpPosition2[2] + this.host.getCollisionHeight(target) - (hasMesh ? tmpPosition[2] : this.host.getCollisionHeight(target));
        }

        const effect = info.viewShake ? null : damageOnly ? this.host.createDamageEffect(effectHost) : this.host.createEffect(caster, info.effectClass);
        if (damageOnly && effect === null) return true;
        const effectRotation = tmpRotation2;
        if (effect) this.host.getRotation(effect, effectRotation);
        else { effectRotation[0] = 0; effectRotation[1] = 0; effectRotation[2] = 0; effectRotation[3] = 1; }
        if (effect && info.speedRate !== undefined) effect.scriptProperties.set("SpeedRate", info.speedRate);
        if (effect && info.useSkillSpeed) {
            const pawn = info.useSkillSpeed === "sourceOwner" ? source.scriptOwner : info.useSkillSpeed === "sourceTarget" ? source.scriptProperties.get("TargetActor") : info.useSkillSpeed === "target" ? target : caster;
            // Engine.dll 0x78f88b..0x78f89a / 0x791078..0x791097: non-Pawn Owner/TargetActor supplies rate1.
            const speed = (info.useSkillSpeed === "sourceOwner" || info.useSkillSpeed === "sourceTarget") && !pawn?.isActor ? 1 : pawn.getUnrealScriptProperty("SkillSpeedRate") as number;
            if (!Number.isFinite(speed)) throw new Error(`${pawn.name} has invalid SkillSpeedRate '${speed}'.`);
            effect.scriptProperties.set("SpeedRate", speed);
        }

        this.host.getPosition(effectHost, tmpPosition, true);
        if (info.location) FVector.setElements(tmpPosition, info.location[0], info.location[1], info.location[2]);
        if (!hasPosition) FVector.setElements(tmpPosition, 0, 0, 0);
        if (hasPosition && info.positionBone && info.rotation !== "bone") this.host.getBonePosition(effectHost, info.positionBone, tmpPosition, info.boneOffset);
        if (info.positionBoneProperty || info.positionBone && info.rotation === "bone") {
            const bone = info.positionBone || effectHost.getUnrealScriptProperty(info.positionBoneProperty);
            if (typeof bone !== "string") throw new Error(`${effectHost.name} has invalid bone property '${info.positionBoneProperty}': '${bone}'.`);
            this.host.getBoneCoords(effectHost, bone, tmpBoneCoords, info.boneFallback);
            FVector.setElements(tmpPosition, ...tmpBoneCoords.origin);
            if (info.rotation === "bone") getBoneRotation(this.host, effectHost, bone, effectRotation, info.boneFallback);
        }

        if (effect && info.attach === "trail" && info.position === undefined) {
            const pivot = effect.scriptProperties.get("TrailerPrePivot");
            // Engine.dll SpawnSkillEffect 0x79841e..0x798443: location mode 1 negates scaled mesh Origin.Z; 0x7983de skips it for a null host.
            if (!info.templatePivot) pivot[2] = -getPawnMeshHeight(this.host, effectHost);
            tmpPosition[2] += this.host.getCollisionHeight(effectHost);
            if (effect.scriptProperties.get("bTrailerPrePivot")) FVector.addElements(tmpPosition, pivot, tmpPosition);
        } else if (info.position === "center") tmpPosition[2] += this.host.getCollisionHeight(effectHost);
        // Engine.dll Shot 0x7abdd6..0x7abdd9: Actor.Location.Z - USkeletalMesh.Origin.Z, without DrawScale.
        else if (info.position === "meshOrigin") tmpPosition[2] += this.host.getCollisionHeight(effectHost) - getPawnMeshHeight(this.host, effectHost, false);
        else if (info.position === "lastTarget") FVector.setElements(tmpPosition, ...source.scriptProperties.get("LastTargetLocation"));
        else if (info.position === "source") this.host.getPosition(source, tmpPosition, true);
        if (hasPosition && info.height === "targetFeet") { this.host.getPosition(target, tmpPosition2, true); tmpPosition[2] = tmpPosition2[2]; }
        if (info.heightOffset !== undefined) tmpPosition[2] += info.heightOffset * this.host.getCollisionHeight(effectHost);
        if (effect && info.lifeSpan) effect.scriptProperties.set("LifeSpan", shotTime + (info.lifeSpanOffset || 0));
        if (effect && info.physics === "none") effect.scriptProperties.set("Physics", EPhysics_T.PHYS_None);
        if (info.offset) { FVector.addElements(tmpPosition, info.offset, tmpPosition); }
        if (effect && info.trailerPrePivot === "casterMeshOrigin") {
            // Engine.dll 0x7afbe9 writes TrailerPrePivot.Z; AEmitter::GetTrailerPrePivot 0x60d794 reads +0x454.
            const height = getPawnMeshHeight(this.host, caster, false);
            effect.scriptProperties.get("TrailerPrePivot")[2] = height;
            tmpPosition[2] += height;
        }

        if (info.rotation === "zero") { effectRotation[0] = 0; effectRotation[1] = 0; effectRotation[2] = 0; effectRotation[3] = 1; }
        else if (info.rotation === "hitActorNormal") {
            // Engine.dll 0x790881/0x790887: AMover.HitActorNormal (+0x410), FVector::Rotation.
            this.host.getHitNormal(impactActor, tmpNormal);
            FVector.getRotationQuaternionElements(tmpNormal, effectRotation);
        } else if (info.rotation === "hit") getRotatorQuaternionElements(...source.scriptProperties.get("HitRot"), effectRotation);
        else if (info.rotation === "reverseHitHorizontal") {
            // Engine.dll 0x7907ac..0x7907db negates incoming XY and clears Z before FVector::Rotation.
            getRotatorQuaternionElements(...source.scriptProperties.get("HitRot"), tmpRotation);
            FVector.applyQuaternionElements([-1, 0, 0], tmpRotation, tmpPosition2);
            FVector.getRotationQuaternionElements([tmpPosition2[0], tmpPosition2[1], 0], effectRotation);
        } else if (info.rotation === "caster") getPawnRotation(this.host, caster, effectRotation);
        else if (info.rotation === "target") getPawnRotation(this.host, target, effectRotation);
        else if (info.rotation === "desiredCaster") getRotatorQuaternionElements(0, this.host.getDesiredRotationYaw(caster), 0, effectRotation);
        else if (info.rotation === "targetPosition") {
            this.host.getPosition(target, tmpPosition2, true);
            getRotatorQuaternionElements(0, Math.trunc(Math.atan2(tmpPosition2[1], tmpPosition2[0]) * 65535 / (2 * Math.PI)), 0, effectRotation);
        } else if (info.rotation === "targetDirection" || info.rotation === "targetDisplacement") getTargetRotation(this.host, caster, target, effectRotation, info.rotation === "targetDirection");
        // Engine.dll Shot 0x7a4a2b..0x7a4a3f replaces Roll with appFrand() * 16384.
        if (info.randomRoll) FQuaternion.multiplyElements(effectRotation, getRotatorQuaternionElements(0, 0, Math.trunc(Math.random() * info.randomRoll), tmpRotation), effectRotation);

        if (hasPosition && info.forwardOffset !== undefined) {
            const rotation = effectRotation;
            if (info.offsetRotation === "caster") getPawnRotation(this.host, caster, tmpRotation);
            else if (info.offsetRotation === "desiredCaster") getRotatorQuaternionElements(0, this.host.getDesiredRotationYaw(caster), 0, tmpRotation);
            else if (info.offsetRotation === "targetDirection") getTargetRotation(this.host, caster, target, tmpRotation);
            else if (info.offsetRotation === "hit") getRotatorQuaternionElements(...source.scriptProperties.get("HitRot"), tmpRotation);
            else tmpRotation.splice(0, 4, ...rotation);
            FVector.applyQuaternionElements([info.forwardOffset, 0, 0], tmpRotation, tmpPosition2);
            FVector.addElements(tmpPosition, tmpPosition2, tmpPosition);
        }
        if (info.radiusOffset !== undefined) {
            if (info.offsetRotation === "caster") getPawnRotation(this.host, caster, tmpRotation);
            else if (info.offsetRotation === "desiredCaster") getRotatorQuaternionElements(0, this.host.getDesiredRotationYaw(caster), 0, tmpRotation);
            else if (info.offsetRotation === "targetDirection") getTargetRotation(this.host, caster, target, tmpRotation);
            else tmpRotation.splice(0, 4, ...effectRotation);
            const distance = info.npcForwardOffset !== undefined && effectHost.getUnrealScriptProperty("bNpc") ? info.npcForwardOffset : info.radiusOffset * this.host.getCollisionRadius(effectHost);
            FVector.applyQuaternionElements([distance, 0, 0], tmpRotation, tmpPosition2);
            if (info.attach === "trail") {
                // Engine.dll 0x798449..0x798481: XY requires both nonzero; 0x79849b..0x7984a4 adds the supplied Z to TrailerPrePivot.Y.
                if (tmpPosition2[0] !== 0 && tmpPosition2[1] !== 0) { tmpPosition[0] += tmpPosition2[0]; tmpPosition[1] += tmpPosition2[1]; }
                tmpPosition[1] += tmpPosition2[2];
            } else FVector.addElements(tmpPosition, tmpPosition2, tmpPosition);
        }
        // Engine.dll 0x7a9ccc/0x7a9ce4, 0x7aa08c/0x7aa0a4, 0x7aadf4/0x7aae09 replace offset Z with target Location.Z - mesh Origin.Z.
        if (targetHeight !== undefined) tmpPosition[2] = targetHeight;

        if (info.viewShake) {
            const shake = info.viewShake;
            if (shake.direction === "fixedY") FVector.setElements(tmpShakeAmplitude, 0, 1, 0);
            else FVector.setElements(tmpShakeAmplitude, shake.direction === "y" ? 0 : Math.random(), Math.random(), 0);
            FVector.safeNormalElements(tmpShakeAmplitude, tmpShakeAmplitude);
            FVector.scaleElements(tmpShakeAmplitude, shake.rotationVelocity, tmpShakeVelocity);
            FVector.scaleElements(tmpShakeAmplitude, shake.rotationAmplitude, tmpShakeAmplitude);
            FVector.setElements(tmpShakePosition, ...shake.positionAmplitude);
            this.host.addViewShakeState(shake.duration, shake.rotationScale, shake.rotationFrequency, shake.positionFrequency, tmpShakeAmplitude, tmpShakeVelocity, tmpShakePosition, tmpPosition, shake.strength, shake.range, shake.type);
            if (shake.event) this.host.triggerL2Event(shake.event.name, tmpPosition, shake.event.radius);
            return true;
        }

        this.host.setPosition(effect, tmpPosition);
        this.host.setRotation(effect, effectRotation);
        // Engine.dll SpawnSkillEffect 0x7986b5: radius > 11; 0x7986f0: radius * (1/9).
        const radius = this.host.getCollisionRadius(caster);
        let scale = typeof info.scale === "number" ? info.scale : info.scale && radius > 11 ? radius / 9 : 1;
        // Engine.dll SpawnSkillEffect 0x7986dc..0x7986e2: Pawn.CastingEffectScale (+0x170c) multiplies caster radius.
        if (radius > 11 && (info.scale === "casterRadius" || info.scale === "cancelCasterRadius")) scale *= getPawnCastingEffectScale(caster);
        // Engine.dll SkillEffectInit 0x79e9cc: undo Energy Wave's automatic radius scaling.
        if (info.scale === "cancelCasterRadius") scale *= 9 / radius;
        // Engine.dll Shot 0x7a8ed7..0x7a8ee9: target radius / 9, without the casting radius threshold.
        if (info.scale === "targetRadius") scale = this.host.getCollisionRadius(target) / 9;
        const delay = info.hitDelay === undefined ? info.delay || 0 : Math.max(0, skill.hitTime + info.hitDelay);
        this.host.setParticleScale(effect, scale);
        this.host.setParticleDelay(effect, delay);

        if (info.attach === "trail") {
            // Engine.dll SpawnSkillEffect 0x79831b initializes trailer rotation to zero.
            const properties = effect.scriptProperties;
            const trailer = properties.get("Physics") === EPhysics_T.PHYS_Trailer;
            const sameRotation = trailer && !!properties.get("bTrailerSameRotation");
            effectRotation[0] = effectRotation[1] = effectRotation[2] = 0;
            effectRotation[3] = 1;
            if (sameRotation) {
                if (effectHost.isActor) getPawnRotation(this.host, effectHost, effectRotation);
                else this.host.getRotation(effectHost, effectRotation, true);
            }
            this.host.getPosition(effectHost, tmpPosition2, true);
            // SpawnSkillEffect 0x798306..0x7983b0 spawns at zero; performPhysics 0x8d4695..0x8d46d0 only follows for PHYS_Trailer.
            if (!trailer && info.position === undefined) {
                const hasPlacement = info.initialPosition !== undefined || info.bone !== undefined || info.boneProperty !== undefined || info.relativeLocation !== undefined;
                FVector.setElements(tmpPosition, 0, 0, 0);
                // Without physics or later placement this actor remains stranded at the default spawn origin.
                if (properties.get("Physics") === EPhysics_T.PHYS_None && !hasPlacement && !info.projectile && !info.pawnLight && !info.damageEffect) {
                    this.host.setPosition(effect, tmpPosition);
                    this.host.removeEffect(effect);
                    return true;
                }
            }
            if (trailer && info.relativeTrailOffset === undefined) {
                FVector.subElements(tmpPosition, tmpPosition2, tmpPosition2);
                this.addTrailer(effect, effectHost, tmpPosition2, false, sameRotation);
            }
        }
        if (effect && info.relativeTrailOffset !== undefined) {
            const offset = effect.scriptProperties.get("RelativeTrailOffset");
            offset[0] = this.host.getCollisionRadius(caster) * info.relativeTrailOffset;
            if (effect.scriptProperties.get("Physics") === EPhysics_T.PHYS_Trailer) this.addTrailer(effect, caster, offset, true, !!effect.scriptProperties.get("bTrailerSameRotation"));
        }
        if (typeof info.trailerPrePivot === "object") {
            const properties = effect.scriptProperties;
            const pivot = properties.get("TrailerPrePivot");

            // Engine.dll 0x7a1a97..0x7a1b6f: unscaled mesh Origin.Z; bNpc skips only the XY override.
            if (this.host.getMeshOrigin(caster, tmpMeshOrigin)) {
                pivot[2] = tmpMeshOrigin[2] * info.trailerPrePivot.meshOriginScale;
                if (info.trailerPrePivot.radiusOffset !== undefined && !caster.getUnrealScriptProperty("bNpc")) {
                    getRotatorQuaternionElements(0, this.host.getDesiredRotationYaw(caster), 0, tmpRotation);
                    FVector.applyQuaternionElements([this.host.getCollisionRadius(caster) * info.trailerPrePivot.radiusOffset, 0, 0], tmpRotation, tmpPosition2);
                    pivot[0] = tmpPosition2[0];
                    pivot[1] = tmpPosition2[1];
                }
            }
            // Engine.dll physTrailer 0x8ce46a..0x8ce581: the authored trailer follows its Owner without a bone attachment.
            if (properties.get("Physics") === EPhysics_T.PHYS_Trailer) {
                FVector.setElements(tmpPosition2, 0, 0, this.host.getCollisionHeight(effectHost));
                if (properties.get("bTrailerPrePivot")) FVector.addElements(tmpPosition2, pivot, tmpPosition2);
                const sameRotation = !!properties.get("bTrailerSameRotation");

                if (sameRotation) getPawnRotation(this.host, effectHost, effectRotation);
                this.addTrailer(effect, effectHost, tmpPosition2, false, sameRotation);
                this.host.getPosition(effectHost, tmpPosition, true);
                FVector.addElements(tmpPosition, tmpPosition2, tmpPosition);
            }
        }
        if (info.initialPosition === "center") {
            this.host.getPosition(effectHost, tmpPosition, true);
            tmpPosition[2] += this.host.getCollisionHeight(effectHost);
            this.host.setPosition(effect, tmpPosition);
        }

        this.host.setPosition(effect, tmpPosition);
        this.host.setRotation(effect, effectRotation);

        addEffect(effect);
        if (info.pawnLight) this.addPawnLight(info.pawnLight, caster, effectHost, source, shotTime, effect, info.phase === "casting");
        if (info.physics === "trailer") {
            const properties = effect.scriptProperties;
            // Engine.dll Explosion 0x78eb27..0x78eb46: PHYS_Trailer, bTrailerPrePivot set, bTrailerSameRotation cleared; follows its Owner.
            properties.set("Physics", EPhysics_T.PHYS_Trailer);
            properties.set("bTrailerPrePivot", true);
            properties.set("bTrailerSameRotation", false);
            FVector.setElements(tmpPosition, ...properties.get("TrailerPrePivot"));
            tmpPosition[2] += this.host.getCollisionHeight(caster);
            this.addTrailer(effect, caster, tmpPosition, false, false);
        }
        let hasNamedBone = false;
        if (info.boneProperty) {
            const bone = effectHost.getUnrealScriptProperty(info.boneProperty);
            if (typeof bone !== "string") throw new Error(`${effectHost.name} has invalid bone property '${info.boneProperty}': '${bone}'.`);
            hasNamedBone = bone.toLowerCase() !== "none";
            // Engine.dll Init 0x7a1883 and PreShot 0x7a446c ignore AttachToBone's return value.
            // Engine.dll Init 0x79bdea/0x79e29c: NAME_None selects bone 2, an unmatched name does not.
            if (!this.host.attachToBone(effectHost, effect, !hasNamedBone && info.boneFallback !== undefined ? info.boneFallback : bone, info.isAbsolute)) console.warn(`[skill-effects] ${effectHost.name} has no bone '${bone}' from '${info.boneProperty}'; '${info.effectClass}' remains unattached.`);
        } else if (info.bone !== undefined) {
            let bone: number | string = info.bone;
            if (info.boneFallback !== undefined) {
                // Engine.dll 0x7b0c9f..0x7b0cae: fallback index depends on MatchRefBone, not AttachToBone's result.
                if (!this.host.getMeshOrigin(effectHost, tmpMeshOrigin)) bone = null;
                else if (typeof bone === "string" && this.host.matchBone(effectHost, bone) < 0) bone = info.boneFallback;
            }
            const attached = bone !== null && this.host.attachToBone(effectHost, effect, bone, info.isAbsolute);
            // Engine.dll 0x78f6eb ignores AttachToBone failure; 0x7ceb50 rejects non-skeletal hosts.
            if (!attached && !info.boneOptional) throw new Error(`${effectHost.name} has no bone ${info.bone}.`);
            const properties = effect.scriptProperties;
            const owner = effect.scriptOwner;
            // Engine.dll physTrailer 0x8ce46a..0x8ce581: an unbased PHYS_Trailer still follows Owner after AttachToBone fails.
            if (!attached && properties.get("Physics") === EPhysics_T.PHYS_Trailer && owner && !effect.scriptBase) {
                const relative = !!properties.get("bRelativeTrail");
                FVector.setElements(tmpPosition, 0, 0, 0);
                if (relative) FVector.setElements(tmpPosition, ...properties.get("RelativeTrailOffset"));
                else {
                    if (properties.get("bTrailerPrePivot")) FVector.setElements(tmpPosition, ...properties.get("TrailerPrePivot"));
                    if (owner.isActor) tmpPosition[2] += this.host.getCollisionHeight(owner);
                }
                this.addTrailer(effect, owner, tmpPosition, relative, !!properties.get("bTrailerSameRotation") && !properties.get("bSelfRotation"));
            }
        }
        if (info.relativeLocation && (!info.relativeLocationOnNamedBone || hasNamedBone)) {
            effect.scriptProperties.set("RelativeLocation", info.relativeLocation.slice());
            this.host.setPosition(effect, info.relativeLocation);
        }
        // Engine.dll Init 0x7a1984 skips the rotation write on the NAME_None branch.
        if (info.relativeRotation && (!info.relativeRotationOnNamedBone || hasNamedBone)) {
            effect.scriptProperties.set("RelativeRotation", info.relativeRotation.slice());
            getRotatorQuaternionElements(...info.relativeRotation, effectRotation);
            this.host.setRotation(effect, effectRotation);
        }

        if (info.damageEffect === true && effectHost.isActor) {
            const damage = this.host.createDamageEffect(effectHost);
            // Engine.dll 0x791861..0x7918c0: hit-pawn DamageEffect shares the impact location and HitRot.
            if (damage) {
                this.host.getPosition(effect, tmpPosition);
                this.host.getRotation(effect, effectRotation);
                this.host.setPosition(damage, tmpPosition);
                this.host.setRotation(damage, effectRotation);
                addEffect(damage);
            }
        }
        if (info.damageEffect === "associated") this.spawnAssociatedDamageEffect(caster, effectHost, addEffect);
        return true;
    }

    protected spawnAssociatedDamageEffect(caster: SkillActor_T, effectHost: SkillActor_T, addEffect: (effect: SkillActor_T) => void): void {
        // APawn::AssociateAttackedNotify 0x8bf853..0x8bf869: full-detail, rendered-target DamageEffect.
        if (effectHost.isActor && !this.host.isLowDetail() && this.host.isRendered(effectHost)) {
            const damage = this.host.createDamageEffect(effectHost);
            if (damage) {
                this.setAttackImpactTransform(caster, effectHost, damage);
                addEffect(damage);
            }
        }
    }

    public spawnSerialized(action: NpcSkillEffectAction_T, skill: NpcSkillAttack_T, caster: SkillActor_T, source: SkillActor_T, target: SkillActor_T, shotTime: number, initializeProjectile: boolean, onProjectile: (actor: SkillActor_T) => void): SkillActor_T {
        // Engine.dll LocateEffect 0x795ffa..0x796037 rejects a null selected host.
        if (action.spawnOnTarget && !target) return null;
        const effect = this.host.createEffect(caster, action.effectClass);
        // Engine.dll TriggerCasting 0x7969a2..0x7969e3; transient casting does not adjust lifetime.
        if (action.phase === "casting" && skill.castStyle !== 0 && shotTime > 0) {
            const fixed = effect.scriptProperties.get("FixedLifeTime") as number;
            if (!Number.isFinite(fixed)) throw new Error(`Skill effect '${action.effectClass}' has no FixedLifeTime default.`);
            this.host.adjustParticleLife(effect, fixed === 0 ? shotTime + 0.2 : fixed);
        }

        const attachHost = action.spawnOnTarget ? target : source;
        const hostIsPawn = !!attachHost.isActor;
        const radius = hostIsPawn ? this.host.getCollisionRadius(attachHost) : attachHost.scriptProperties.get("CollisionRadius") as number;
        const height = hostIsPawn ? this.host.getCollisionHeight(attachHost) : 0;
        const sourceProjectile = !action.useCharacterRotation && !!this.host.getProjectile(source);
        let projectile = false;
        // Engine.dll 0x796c48..0x796c6b: multi-target Notify results bypass projectile initialization.
        if (action.phase === "shot" && initializeProjectile && this.host.isA(effect, "engine.NSkillProjectile", caster)) {
            projectile = true;
            onProjectile(effect);
        }

        // Engine.dll USkillAction_LocateEffect::Notify 0x796643 / 0x79666a: delay emission after spawning the actor.
        const delay = action.spawnDelay < 0 ? skill.hitTime + action.spawnDelay : action.spawnDelay;
        if (delay > 0) this.host.setParticleDelay(effect, delay);
        // Engine.dll LocateEffect 0x79603d..0x796053: target effects and non-pawns do not use CastingEffectScale.
        let sizeScale = !action.spawnOnTarget && hostIsPawn ? getPawnCastingEffectScale(attachHost) : 1;
        // Engine.dll USkillAction_LocateEffect::Notify 0x796514, float 0xaabad4: radius * (1/9).
        if (action.sizeScale) sizeScale *= radius / 9;
        // Engine.dll 0x796537: double 0xa97a60 is the SetSizeScale tolerance.
        if (Math.abs(sizeScale - 1) > 0.0001) this.host.setParticleScale(effect, sizeScale, true);
        // Engine.dll LocateEffect 0x796246 / 0x7962b1: no owner for unattached effects, selected host otherwise.
        this.host.addEffect(effect, action.attachOn === "none" ? null : attachHost);

        if (action.useCharacterRotation) {
            if (hostIsPawn) getPawnRotation(this.host, attachHost, tmpRotation);
            else this.host.getRotation(attachHost, tmpRotation, true);
        } else if (sourceProjectile) getRotatorQuaternionElements(...source.scriptProperties.get("HitRot"), tmpRotation);
        else if (source === target) getPawnRotation(this.host, target, tmpRotation);
        else getTargetRotation(this.host, source, target, tmpRotation);

        const offset = action.offset;
        if (action.relativeToCylinder) {
            // Engine.dll LocateEffect 0x796155: radius scales X only; skeletal Z uses DrawScale * mesh Origin.Z.
            tmpPosition[0] = offset[0] * radius;
            tmpPosition[1] = offset[1];
            tmpPosition[2] = offset[2] * (hostIsPawn ? getPawnMeshHeight(this.host, attachHost) : attachHost.scriptProperties.get("CollisionHeight") as number);
            FVector.applyQuaternionElements(tmpPosition, tmpRotation, tmpPosition2);
        } else { FVector.setElements(tmpPosition, ...offset); FVector.setElements(tmpPosition2, ...offset); }
        // Engine.dll LocateEffect 0x796217 clears pitch after transforming the offset.
        FQuaternion.removeEulerY(tmpRotation, tmpRotation2);
        this.host.setRotation(effect, tmpRotation2);

        if (action.attachOn !== "none" && action.attachOn !== "trail") {
            let bone: string | number = action.attachBoneName;
            // Engine.dll 0x796401/0x79641d: pawn hand properties; AActor defaults at 0x5f6e50/0x5f6e80 return NAME_None.
            if (action.attachOn === "rightHand" || action.attachOn === "leftHand") bone = hostIsPawn ? attachHost.getUnrealScriptProperty(action.attachOn === "rightHand" ? "RightHandBone" : "LeftHandBone") as string : "None";
            if (action.attachOn === "aliasSpecified") {
                // Engine.dll 0x7964b2/0x7964e7: resolve TagNames, then add only TagCoords.Origin.
                FVector.setElements(tmpPosition, 0, 0, 0);
                bone = hostIsPawn ? this.host.getBoneAlias(attachHost, action.attachBoneName, tmpPosition) : "None";
                FVector.addElements(tmpPosition2, tmpPosition, tmpPosition2);
            }
            if (typeof bone !== "string") throw new Error(`${attachHost.name} has invalid skill attachment bone '${bone}'.`);
            // Engine.dll 0x796578/0x796596 -> 0x79660c destroys the effect for NAME_None or failed attachment.
            if (bone.toLowerCase() === "none" || !this.host.attachToBone(attachHost, effect, bone, action.isAbsolute)) {
                this.host.removeEffect(effect);
                return null;
            }
            this.host.setPosition(effect, tmpPosition2);
            effect.scriptProperties.set("RelativeLocation", [...tmpPosition2]);
            return effect;
        }

        if (action.attachOn === "trail" && !projectile) {
            const selfRotation = !!effect.scriptProperties.get("bSelfRotation");
            const sameRotation = !selfRotation && (action.useCharacterRotation || !!effect.scriptProperties.get("bTrailerSameRotation"));
            // Engine.dll LocateEffect 0x79634c / physTrailer 0x8ce46a: local RelativeTrailOffset or world TrailerPrePivot.
            if (action.useCharacterRotation) this.addTrailer(effect, attachHost, tmpPosition, true, sameRotation);
            else {
                tmpPosition2[2] += height;
                this.addTrailer(effect, attachHost, tmpPosition2, false, sameRotation);
            }
            this.update();
            return effect;
        }

        // Engine.dll LocateEffect 0x79608f / 0x796221: the HitRot branch retains the projectile's LastTargetLocation.
        if (action.attachOn === "none" && sourceProjectile) FVector.setElements(tmpPosition, ...source.scriptProperties.get("LastTargetLocation"));
        else {
            this.host.getPosition(attachHost, tmpPosition, true);
            tmpPosition[2] += height;
        }
        FVector.addElements(tmpPosition, tmpPosition2, tmpPosition);
        this.host.setPosition(effect, tmpPosition);
        this.host.setRotation(effect, tmpRotation2);
        return effect;
    }

    public addAttackLight(caster: SkillActor_T, target: SkillActor_T): void {
        // Engine.dll Action_Attack 0x8bde58..0x8bdf44 (-2*radius); AddPawnLight 0x8b518f..0x8b51e8 (white, 30, 0.2).
        this.addPawnLight({ color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true, position: "center", rotation: "targetDisplacement", radiusOffset: -2 }, caster, target, caster, 0);
    }

    public addAttackImpact(caster: SkillActor_T, target: SkillActor_T, critical: boolean, shield: boolean, spirit: boolean, grade: number): void {
        if (!target?.isActor || !this.host.isRendered(target)) return;

        const add = (effect: SkillActor_T): void => {
            this.setAttackImpactTransform(caster, target, effect);
            this.host.addEffect(effect, target);
        };
        const damage = this.host.isLowDetail() ? null : this.host.createDamageEffect(target);

        if (damage) add(damage);

        if (spirit) {
            if (grade > 5) return;

            const suffix = critical ? (caster as any).isPlayer ? "d" : "e" : "c";
            add(this.host.createEffect(caster, `LineageEffect.e_u${505 + grade}_${suffix}`));
        } else if (critical && !shield) add(this.host.createEffect(caster, "LineageEffect.p_u004_a"));
    }

    protected setAttackImpactTransform(caster: SkillActor_T, target: SkillActor_T, effect: SkillActor_T): void {
        getTargetRotation(this.host, caster, target, tmpRotation, false);
        this.host.getPosition(target, tmpPosition, true);
        tmpPosition[2] += this.host.getCollisionHeight(target);
        this.host.getPosition(caster, tmpCasterPosition, true);
        tmpCasterPosition[2] += this.host.getCollisionHeight(caster);
        FVector.subElements(tmpPosition, tmpCasterPosition, tmpPosition2);
        const distance = Math.sqrt(FVector.lengthSqElements(tmpPosition2));
        const offset = this.host.getCollisionHeight(target) + this.host.getCollisionRadius(target) > 150 ? Math.min(distance * 0.85, distance - this.host.getCollisionRadius(caster)) : this.host.getCollisionRadius(target) / 2;

        FVector.applyQuaternionElements([1, 0, 0], tmpRotation, tmpPosition2);
        tmpPosition[0] -= tmpPosition2[0] * offset;
        tmpPosition[1] -= tmpPosition2[1] * offset;
        tmpPosition[2] -= tmpPosition2[2] * offset;
        this.host.setPosition(effect, tmpPosition);
        this.host.setRotation(effect, tmpRotation);
    }

    protected addPawnLight(light: NativeSkillEffect_T["pawnLight"], caster: SkillActor_T, host: SkillActor_T, source: SkillActor_T, shotTime: number, effect: SkillActor_T = null, isCasting: boolean = false): void {
        // Engine.dll 0x78f6f0..0x78f6fb: Cast<APawn> rejects non-Pawn impact actors.
        if (!host.isActor) return;
        if (!effect && (!light.spot || !light.position || !light.rotation || light.target)) throw new Error("Pawn light without an effect requires a fixed spotlight transform.");
        if (light.position === "center") {
            this.host.getPosition(host, tmpLightPosition, true);
            tmpLightPosition[2] += this.host.getCollisionHeight(host);
        } else if (light.position === "lastTarget") FVector.setElements(tmpLightPosition, ...source.scriptProperties.get("LastTargetLocation"));
        else if (effect) this.host.getPosition(effect, tmpLightPosition);
        if (light.spot) {
            if (light.rotation === "hit") getRotatorQuaternionElements(...source.scriptProperties.get("HitRot"), tmpRotation);
            // Engine.dll Action_Attack 0x8bde58..0x8bde8c uses target minus caster, including a zero displacement.
            else if (light.rotation === "targetDisplacement") getTargetRotation(this.host, caster, host, tmpRotation, false);
            else if (effect) this.host.getRotation(effect, tmpRotation);
            FVector.applyQuaternionElements([1, 0, 0], tmpRotation, tmpLightDirection);
            if (light.radiusOffset !== undefined) {
                FVector.scaleElements(tmpLightDirection, light.radiusOffset * this.host.getCollisionRadius(host), tmpPosition2);
                FVector.addElements(tmpLightPosition, tmpPosition2, tmpLightPosition);
            }
        }
        if (light.target === "caster") {
            this.host.getPosition(caster, tmpCasterPosition, true);
            tmpCasterPosition[2] += this.host.getCollisionHeight(caster);
            FVector.subElements(tmpCasterPosition, tmpLightPosition, tmpLightDirection);
            FVector.normalElements(tmpLightDirection, tmpLightDirection);
        }
        this.pawnLights.push({ actor: host, isCasting, light: this.host.addPawnLight(host, light.spot && !light.target ? null : effect, light.color, light.radius, light.lifeTime === undefined ? shotTime : light.lifeTime, light.spot ? tmpLightPosition : null, light.spot ? tmpLightDirection : null, light.target ? tmpCasterPosition : null) });
    }
}

export default SkillEffectPlacement;
