import { Matrix4, Object3D, Quaternion, Vector3 } from "three";
import Rotator from "../utils/rotator";
import NPawnLightComponent, { type PawnLight_T } from "../rendering/components/pawn-light-component";
import { EPhysics_T } from "../assets/unreal/un-aactor";
import type BaseActor from "../base-actor";
import type { ScriptComponent } from "../game/script-component";
import type { NpcSkillAttack_T } from "@l2js/engine/contracts/pawn";
import type { NativeSkillEffect_T } from "./native-effects";
import type PawnMovementComponent from "../physics/components/pawn-movement-component";
import type AnimationComponent from "../objects/components/animation-component";
import type LitSkinnedMesh from "../objects/lit-skinned-mesh";
import type EffectsComponent from "../rendering/components/effects-component";
import type MovableObject from "../objects/movable-object";
import type RenderManager from "../rendering/render-manager";
import type PawnRenderableComponent from "../rendering/components/pawn-renderable-component";

const tmpRotator = new Rotator();
const tmpPosition = new Vector3();
const tmpCasterPosition = new Vector3();
const tmpLightPosition = new Vector3();
const tmpLightDirection = new Vector3();
const tmpRotation = new Quaternion();
const tmpBoneMatrix = new Matrix4();
const tmpMeshCorrection = new Quaternion(0, 0, Math.SQRT1_2, Math.SQRT1_2);
const tmpViewShake = new Object3D();
const tmpShakeAmplitude = new Vector3();
const tmpShakeVelocity = new Vector3();
const tmpShakePosition = new Vector3();

export function getPawnRotation(pawn: BaseActor, out: Quaternion): void {
    // PawnMovementComponent renders pawn yaw with -PI/2; emitters use UE axes directly.
    pawn.getWorldQuaternion(out).multiply(tmpMeshCorrection);
}

export function getPawnMeshHeight(pawn: BaseActor, scaled: boolean = true): number {
    const mesh = pawn.getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh;
    const drawScale = pawn.scriptClassId ? pawn.getUnrealScriptProperty("DrawScale") as number : 1;

    return mesh ? mesh.meshOrigin.z * (scaled ? drawScale : 1) : scaled ? pawn.getCollisionHeight() : 0;
}

export function getPawnCastingEffectScale(pawn: BaseActor): number {
    const scale = pawn.scriptClassId ? pawn.getUnrealScriptProperty("CastingEffectScale") as number : 1;

    if (!Number.isFinite(scale) || scale < 0) throw new Error(`${pawn.name} has invalid CastingEffectScale '${scale}'.`);
    return scale;
}

export function getTargetRotation(caster: BaseActor, target: BaseActor, out: Quaternion, useCasterRotation: boolean = true): void {
    if (!target || caster === target && useCasterRotation) { getPawnRotation(caster, out); return; }

    target.getWorldPosition(tmpPosition);
    caster.getWorldPosition(tmpCasterPosition);
    tmpPosition.sub(tmpCasterPosition);
    tmpPosition.z += target.getCollisionHeight() - caster.getCollisionHeight();
    // Retail Core FVector::Rotation 0x1014f310: 65535/(2*PI), float-to-int truncation at 0x1017cfa0.
    tmpRotator.set(Math.trunc(Math.atan2(tmpPosition.z, Math.hypot(tmpPosition.x, tmpPosition.y)) * 65535 / (2 * Math.PI)), Math.trunc(Math.atan2(tmpPosition.y, tmpPosition.x) * 65535 / (2 * Math.PI)), 0).toQuaternion(out);
}

export class NativeSkillEffects {
    protected readonly renderManager: RenderManager;
    protected readonly trailers: { effect: Object3D, host: Object3D, sameRotation: boolean, relative: boolean, offset: Vector3 }[] = [];
    protected readonly pawnLights: { component: NPawnLightComponent, light: PawnLight_T }[] = [];

    public constructor(renderManager: RenderManager) {
        this.renderManager = renderManager;
    }

    public update(): void {
        for (let i = this.pawnLights.length - 1; i >= 0; i--)
            if (!this.pawnLights[i].component.getLights().includes(this.pawnLights[i].light)) this.pawnLights.splice(i, 1);

        for (let i = this.trailers.length - 1; i >= 0; i--) {
            const { effect, host, sameRotation, relative, offset } = this.trailers[i];

            if (!effect.parent) { this.trailers.splice(i, 1); continue; }

            host.getWorldPosition(effect.position);
            tmpPosition.copy(offset);
            if (relative) {
                if ((host as BaseActor).isActor) getPawnRotation(host as BaseActor, tmpRotation);
                else host.getWorldQuaternion(tmpRotation);
                tmpPosition.applyQuaternion(tmpRotation);
                if ((host as BaseActor).isActor) effect.position.z += (host as BaseActor).getCollisionHeight();
            }
            effect.position.add(tmpPosition);
            if (sameRotation) {
                if ((host as BaseActor).isActor) getPawnRotation(host as BaseActor, effect.quaternion);
                else host.getWorldQuaternion(effect.quaternion);
            }
        }
    }

    public clear(): void {
        for (const { component, light } of this.pawnLights) component.remove(light);
        this.pawnLights.length = 0;
        this.trailers.length = 0;
    }

    public addTrailer(effect: Object3D, host: Object3D, offset: Vector3, relative: boolean, sameRotation: boolean): void {
        this.trailers.push({ effect, host, sameRotation, relative, offset: offset.clone() });
    }

    public spawn(info: NativeSkillEffect_T, skill: NpcSkillAttack_T, caster: BaseActor, target: BaseActor, script: ScriptComponent<BaseActor>, shotTime: number, addEffect: (effect: Object3D) => void, source: Object3D = caster, locList: readonly Vector3Arr[] = [], hitActor: boolean = !!target, impactActor: Object3D = hitActor ? target : null): boolean {
        // Engine.dll 0x7aa351..0x7aa35b: reject NULL, then distinguish TargetPawn == caster.
        if (info.targetIsCaster !== undefined && (!target || info.targetIsCaster !== (target === caster))) return true;
        // Engine.dll 0x7a9288..0x7a928e: Siege Hammer exits before both shake and particle without a target.
        if (info.targetRequired === "phase" && !target) return false;
        // Engine.dll Explosion 0x78f7cd/0x78fa8d/0x78fab4: hit actor, projectile Owner, then TargetActor.
        if (info.hitActor !== undefined && (info.hitActor !== hitActor || info.hitActor && !(info.host === "impactActor" ? impactActor : target))) return true;
        if (info.sourceOwner !== undefined && info.sourceOwner !== !!(source as any).scriptOwner) return true;
        // Engine.dll 0x79106a..0x791072: ownerless Beam requires the projectile's retained TargetActor.
        if (info.sourceTarget !== undefined && info.sourceTarget !== !!(source as any).scriptProperties.get("TargetActor")) return true;
        // Engine.dll 0x790861 -> 0x7485d0: Cast<AMover> selects the door impact.
        if (info.hitActorIsMover !== undefined && info.hitActorIsMover !== !!(impactActor as MovableObject)?.isMovableObject) return true;
        // Engine.dll 0x7a92ac..0x7a92b4: Siege Hammer's shake requires caster Owner; the particle does not.
        if (info.viewShake?.ownerRequired && !caster.scriptOwner) return true;

        const host = (info.host === "caster" ? caster : info.host === "source" ? source : info.host === "impactActor" ? impactActor : target) as BaseActor;
        const damageOnly = info.damageEffect === "only";

        if (damageOnly && !host.isActor) return true;

        // Engine.dll 0x78f63c -> 0x78f6f0: an ownerless projectile still lights the hit Pawn without spawning a particle.
        if (info.pawnLightOnly) {
            this.addPawnLight(info.pawnLight, caster, host, source, shotTime);
            return true;
        }

        if (info.locList) {
            let locations = locList;

            if (locations.length === 0 && info.locList.random) {
                // Server supplies impact positions; preview samples the configured range when absent.
                caster.getWorldPosition(tmpPosition);
                locations = Array.from({ length: info.locList.random.count }, () => [
                    tmpPosition.x + (Math.random() * 2 - 1) * info.locList.random.range,
                    tmpPosition.y + (Math.random() * 2 - 1) * info.locList.random.range,
                    tmpPosition.z
                ] as Vector3Arr);
            }

            for (let i = 0; i < locations.length; i++)
                if (!this.spawn({ ...info, locList: undefined, location: locations[i], delay: shotTime + info.locList.delay + i * info.locList.interval }, skill, caster, target, script, shotTime, addEffect, source, [], hitActor, impactActor)) return false;
            return true;
        }

        // Engine.dll 0x7a9bec/0x7a9fac/0x7aa5e3/0x7aaccf skip placement, retaining the zero-initialized shake position.
        let hasPosition = info.targetRequired !== "position" || !!target;

        if (!hasPosition && !info.viewShake) return true;

        if (hasPosition && info.missingBoneStopsPhase) {
            const mesh = host.getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh;

            // Engine.dll 0x7b0cbb/0x7b0cce keeps Shot sound without a skeletal mesh; 0x7b0d00 exits the phase for a missing name.
            if (!mesh && !info.viewShake) return true;

            const name = info.positionBone.replaceAll(" ", "_").toLowerCase();

            if (mesh && !mesh.skeleton.bones.some(bone => bone.name === name)) return false;
            hasPosition = !!mesh;
        }

        let targetHeight: number;

        if (hasPosition && (info.height === "targetMeshOrigin" || info.height === "targetMeshOriginOrFeet")) {
            const mesh = target.getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh;

            // Engine.dll 0x7a9cd9/0x7aa099 reject non-skeletal targets; 0x7aae11..0x7aae1a falls back to CollisionHeight.
            if (!mesh && info.height === "targetMeshOrigin") return false;
            targetHeight = target.getWorldPosition(tmpPosition).z + target.getCollisionHeight() - (mesh ? mesh.meshOrigin.z : target.getCollisionHeight());
        }

        const effect = info.viewShake ? tmpViewShake : damageOnly ? host.getComponent<EffectsComponent>("effects").createDamageEffect() : script.createObject(info.effectClass) as unknown as Object3D;

        if (damageOnly && effect === null) return true;

        if (!(effect as any).isObject3D) throw new Error(`Skill effect '${info.effectClass}' is not an actor.`);

        if (info.speedRate !== undefined) (effect as any).scriptProperties.set("SpeedRate", info.speedRate);
        if (info.useSkillSpeed) {
            const pawn = info.useSkillSpeed === "sourceOwner" ? (source as any).scriptOwner : info.useSkillSpeed === "sourceTarget" ? (source as any).scriptProperties.get("TargetActor") : info.useSkillSpeed === "target" ? target : caster;
            // Engine.dll 0x78f88b..0x78f89a / 0x791078..0x791097: non-Pawn Owner/TargetActor supplies rate1.
            const speed = (info.useSkillSpeed === "sourceOwner" || info.useSkillSpeed === "sourceTarget") && !pawn.isActor ? 1 : pawn.getUnrealScriptProperty("SkillSpeedRate") as number;

            if (!Number.isFinite(speed)) throw new Error(`${pawn.name} has invalid SkillSpeedRate '${speed}'.`);
            (effect as any).scriptProperties.set("SpeedRate", speed);
        }

        host.getWorldPosition(effect.position);
        if (info.location) effect.position.fromArray(info.location);
        if (!hasPosition) effect.position.set(0, 0, 0);
        if (hasPosition && info.positionBone && info.rotation !== "bone") host.getBoneWorldPosition(info.positionBone, effect.position, info.boneOffset ? tmpPosition.fromArray(info.boneOffset) : undefined);
        if (info.positionBoneProperty || info.positionBone && info.rotation === "bone") {
            const bone = info.positionBone || host.getUnrealScriptProperty(info.positionBoneProperty);

            if (typeof bone !== "string") throw new Error(`${host.name} has invalid bone property '${info.positionBoneProperty}': '${bone}'.`);
            host.getComponent<AnimationComponent>("animation").getBoneWorldMatrix(bone, tmpBoneMatrix, info.boneFallback);
            effect.position.setFromMatrixPosition(tmpBoneMatrix);
            if (info.rotation === "bone") tmpRotator.setFromRotationMatrix(tmpBoneMatrix).toQuaternion(effect.quaternion);
        }
        if (info.attach === "trail" && info.position === undefined) {
            const properties = (effect as any).scriptProperties;
            const pivot = properties.get("TrailerPrePivot");

            // Engine.dll SpawnSkillEffect 0x79841e..0x798443: location mode 1 negates scaled mesh Origin.Z.
            pivot[2] = -getPawnMeshHeight(host);
            effect.position.z += host.getCollisionHeight();
            if (properties.get("bTrailerPrePivot")) effect.position.add(tmpPosition.fromArray(pivot));
        } else if (info.position === "center") effect.position.z += host.getCollisionHeight();
        // Engine.dll Shot 0x7abdd6..0x7abdd9: Actor.Location.Z - USkeletalMesh.Origin.Z, without DrawScale.
        else if (info.position === "meshOrigin") effect.position.z += host.getCollisionHeight() - getPawnMeshHeight(host, false);
        else if (info.position === "lastTarget") effect.position.fromArray((source as any).scriptProperties.get("LastTargetLocation"));
        else if (info.position === "source") source.getWorldPosition(effect.position);
        if (hasPosition && info.height === "targetFeet") effect.position.z = target.getWorldPosition(tmpPosition).z;
        if (info.heightOffset !== undefined) effect.position.z += info.heightOffset * host.getCollisionHeight();
        if (info.lifeSpan) (effect as any).scriptProperties.set("LifeSpan", shotTime + (info.lifeSpanOffset || 0));
        if (info.physics === "none") (effect as any).scriptProperties.set("Physics", EPhysics_T.PHYS_None);
        if (info.offset) effect.position.add(tmpPosition.fromArray(info.offset));
        if (info.trailerPrePivot === "casterMeshOrigin") {
            // Engine.dll 0x7afbe9 writes TrailerPrePivot.Z; AEmitter::GetTrailerPrePivot 0x60d794 reads +0x454.
            const height = getPawnMeshHeight(caster, false);

            (effect as any).scriptProperties.get("TrailerPrePivot")[2] = height;
            effect.position.z += height;
        }

        if (info.rotation === "zero") effect.quaternion.identity();
        else if (info.rotation === "hitActorNormal") {
            // Engine.dll 0x790881/0x790887: AMover.HitActorNormal (+0x410), FVector::Rotation.
            const normal = (impactActor as MovableObject).hitActorNormal;

            tmpRotator.set(Math.trunc(Math.atan2(normal.z, Math.hypot(normal.x, normal.y)) * 65535 / (2 * Math.PI)), Math.trunc(Math.atan2(normal.y, normal.x) * 65535 / (2 * Math.PI)), 0).toQuaternion(effect.quaternion);
        }
        else if (info.rotation === "hit") tmpRotator.set(...(source as any).scriptProperties.get("HitRot")).toQuaternion(effect.quaternion);
        else if (info.rotation === "reverseHitHorizontal") {
            // Engine.dll 0x7907ac..0x7907db negates incoming XY and clears Z before FVector::Rotation.
            tmpRotator.set(...(source as any).scriptProperties.get("HitRot")).toQuaternion(tmpRotation);
            tmpPosition.set(-1, 0, 0).applyQuaternion(tmpRotation);
            tmpRotator.set(0, Math.trunc(Math.atan2(tmpPosition.y, tmpPosition.x) * 65535 / (2 * Math.PI)), 0).toQuaternion(effect.quaternion);
        }
        else if (info.rotation === "caster") getPawnRotation(caster, effect.quaternion);
        else if (info.rotation === "target") getPawnRotation(target, effect.quaternion);
        else if (info.rotation === "desiredCaster") {
            const movement = caster.getComponent<PawnMovementComponent>("pawnMovement");

            tmpRotator.set(0, movement.getDesiredRotationYaw(), 0).toQuaternion(effect.quaternion);
        }
        else if (info.rotation === "targetPosition") {
            target.getWorldPosition(tmpPosition);
            tmpRotator.set(0, Math.trunc(Math.atan2(tmpPosition.y, tmpPosition.x) * 65535 / (2 * Math.PI)), 0).toQuaternion(effect.quaternion);
        } else if (info.rotation === "targetDirection" || info.rotation === "targetDisplacement") getTargetRotation(caster, target, effect.quaternion, info.rotation === "targetDirection");

        if (hasPosition && info.forwardOffset !== undefined) {
            tmpRotation.copy(effect.quaternion);
            if (info.offsetRotation === "caster") getPawnRotation(caster, tmpRotation);
            else if (info.offsetRotation === "desiredCaster") tmpRotator.set(0, caster.getComponent<PawnMovementComponent>("pawnMovement").getDesiredRotationYaw(), 0).toQuaternion(tmpRotation);
            else if (info.offsetRotation === "targetDirection") getTargetRotation(caster, target, tmpRotation);
            else if (info.offsetRotation === "hit") tmpRotator.set(...(source as any).scriptProperties.get("HitRot")).toQuaternion(tmpRotation);
            effect.position.add(tmpPosition.set(info.forwardOffset, 0, 0).applyQuaternion(tmpRotation));
        }

        if (info.radiusOffset !== undefined) {
            tmpRotation.copy(effect.quaternion);
            if (info.offsetRotation === "caster") getPawnRotation(caster, tmpRotation);
            else if (info.offsetRotation === "desiredCaster") tmpRotator.set(0, caster.getComponent<PawnMovementComponent>("pawnMovement").getDesiredRotationYaw(), 0).toQuaternion(tmpRotation);
            else if (info.offsetRotation === "targetDirection") getTargetRotation(caster, target, tmpRotation);
            tmpPosition.set(info.radiusOffset * host.getCollisionRadius(), 0, 0).applyQuaternion(tmpRotation);

            if (info.attach === "trail") {
                // Engine.dll 0x798449..0x798481: XY requires both nonzero; 0x79849b..0x7984a4 adds the supplied Z to TrailerPrePivot.Y.
                if (tmpPosition.x !== 0 && tmpPosition.y !== 0) {
                    effect.position.x += tmpPosition.x;
                    effect.position.y += tmpPosition.y;
                }
                effect.position.y += tmpPosition.z;
            } else effect.position.add(tmpPosition);
        }

        // Engine.dll 0x7a9ccc/0x7a9ce4, 0x7aa08c/0x7aa0a4, 0x7aadf4/0x7aae09 replace offset Z with target Location.Z - mesh Origin.Z.
        if (targetHeight !== undefined) effect.position.z = targetHeight;

        if (info.viewShake) {
            const shake = info.viewShake;

            if (shake.direction === "fixedY") tmpShakeAmplitude.set(0, 1, 0);
            else tmpShakeAmplitude.set(shake.direction === "y" ? 0 : Math.random(), Math.random(), 0);
            // Core FVector::SafeNormal 0x1014fc40, double 0x10191798: squared-length cutoff 1e-8.
            if (tmpShakeAmplitude.lengthSq() < 1e-8) tmpShakeAmplitude.set(0, 0, 0);
            else tmpShakeAmplitude.normalize();
            tmpShakeVelocity.copy(tmpShakeAmplitude).multiplyScalar(shake.rotationVelocity);
            tmpShakeAmplitude.multiplyScalar(shake.rotationAmplitude);
            tmpShakePosition.fromArray(shake.positionAmplitude);
            this.renderManager.addViewShakeState(shake.duration, shake.rotationScale, shake.rotationFrequency, shake.positionFrequency, tmpShakeAmplitude, tmpShakeVelocity, tmpShakePosition, effect.position, shake.strength, shake.range, shake.type);
            if (shake.event) this.renderManager.triggerL2Event(shake.event.name, effect.position, shake.event.radius);
            return true;
        }

        // Engine.dll SpawnSkillEffect 0x7986b5: radius > 11; 0x7986f0: radius * (1/9).
        const radius = caster.getCollisionRadius();
        let scale = typeof info.scale === "number" ? info.scale : info.scale && radius > 11 ? radius / 9 : 1;

        // Engine.dll SpawnSkillEffect 0x7986dc..0x7986e2: Pawn.CastingEffectScale (+0x170c) multiplies caster radius.
        if (radius > 11 && (info.scale === "casterRadius" || info.scale === "cancelCasterRadius")) scale *= getPawnCastingEffectScale(caster);

        // Engine.dll SkillEffectInit 0x79e9cc: undo Energy Wave's automatic radius scaling.
        if (info.scale === "cancelCasterRadius") scale *= 9 / radius;

        // Engine.dll Shot 0x7a8ed7..0x7a8ee9: target radius / 9, without the casting radius threshold.
        if (info.scale === "targetRadius") scale = target.getCollisionRadius() / 9;

        const delay = info.hitDelay === undefined ? info.delay || 0 : Math.max(0, skill.hitTime + info.hitDelay);

        effect.traverse((emitter: any) => {
            if (!emitter.particlePool) return;

            emitter.setSizeScale(scale);
            emitter.setDelayed(delay);
        });

        if (info.attach === "trail") {
            // Engine.dll SpawnSkillEffect 0x79831b initializes trailer rotation to zero.
            const sameRotation = !!(effect as any).scriptProperties.get("bTrailerSameRotation");

            effect.quaternion.identity();
            if (sameRotation) {
                if (host.isActor) getPawnRotation(host, effect.quaternion);
                else host.getWorldQuaternion(effect.quaternion);
            }
            host.getWorldPosition(tmpPosition);
            if (info.relativeTrailOffset === undefined) this.addTrailer(effect, host, effect.position.clone().sub(tmpPosition), false, sameRotation);
        }
        if (info.relativeTrailOffset !== undefined) {
            const properties = (effect as any).scriptProperties;
            const offset = properties.get("RelativeTrailOffset");

            offset[0] = caster.getCollisionRadius() * info.relativeTrailOffset;
            this.addTrailer(effect, caster, tmpPosition.fromArray(offset), true, !!properties.get("bTrailerSameRotation"));
        }

        if (info.initialPosition === "center") {
            host.getWorldPosition(effect.position);
            effect.position.z += host.getCollisionHeight();
        }

        addEffect(effect);

        if (info.pawnLight) this.addPawnLight(info.pawnLight, caster, host, source, shotTime, effect);

        let hasNamedBone = false;

        if (info.boneProperty) {
            const bone = host.getUnrealScriptProperty(info.boneProperty);

            if (typeof bone !== "string") throw new Error(`${host.name} has invalid bone property '${info.boneProperty}': '${bone}'.`);

            hasNamedBone = bone.toLowerCase() !== "none";

            // Engine.dll Init 0x7a1883 and PreShot 0x7a446c ignore AttachToBone's return value.
            // Engine.dll Init 0x79bdea/0x79e29c: NAME_None selects bone 2, an unmatched name does not.
            if (!host.attachObjectToBone(effect, !hasNamedBone && info.boneFallback !== undefined ? info.boneFallback : bone, info.isAbsolute)) console.warn(`[skill-effects] ${host.name} has no bone '${bone}' from '${info.boneProperty}'; '${info.effectClass}' remains unattached.`);
        } else if (info.bone !== undefined) {
            let bone = info.bone;

            if (info.boneFallback !== undefined) {
                const mesh = host.getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh;

                // Engine.dll 0x7b0c9f..0x7b0cae: fallback index depends on MatchRefBone, not AttachToBone's result.
                if (!mesh) bone = null;
                else if (typeof bone === "string") {
                    const name = bone.replaceAll(" ", "_").toLowerCase();

                    if (!mesh.skeleton.bones.some(entry => entry.name === name)) bone = info.boneFallback;
                }
            }

            const attached = bone !== null && host.attachObjectToBone && host.attachObjectToBone(effect, bone, info.isAbsolute);

            // Engine.dll 0x78f6eb ignores AttachToBone failure; 0x7ceb50 rejects non-skeletal hosts.
            if (!attached && !info.boneOptional) throw new Error(`${host.name} has no bone ${info.bone}.`);

            const properties = (effect as any).scriptProperties;
            const owner = (effect as any).scriptOwner as BaseActor;

            // Engine.dll physTrailer 0x8ce46a..0x8ce581: an unbased PHYS_Trailer still follows Owner after AttachToBone fails.
            if (!attached && properties.get("Physics") === EPhysics_T.PHYS_Trailer && owner && !(effect as any).scriptBase) {
                const relative = !!properties.get("bRelativeTrail");

                tmpPosition.set(0, 0, 0);
                if (relative) tmpPosition.fromArray(properties.get("RelativeTrailOffset"));
                else {
                    if (properties.get("bTrailerPrePivot")) tmpPosition.fromArray(properties.get("TrailerPrePivot"));
                    if (owner.isActor) tmpPosition.z += owner.getCollisionHeight();
                }
                this.addTrailer(effect, owner, tmpPosition, relative, !!properties.get("bTrailerSameRotation") && !properties.get("bSelfRotation"));
            }
        }

        if (info.relativeLocation && (!info.relativeLocationOnNamedBone || hasNamedBone)) {
            (effect as any).scriptProperties.set("RelativeLocation", info.relativeLocation.slice());
            effect.position.fromArray(info.relativeLocation);
        }
        // Engine.dll Init 0x7a1984 skips the rotation write on the NAME_None branch.
        if (info.relativeRotation && (!info.relativeRotationOnNamedBone || hasNamedBone)) {
            (effect as any).scriptProperties.set("RelativeRotation", info.relativeRotation.slice());
            tmpRotator.set(...info.relativeRotation).toQuaternion(effect.quaternion);
        }

        if (info.damageEffect === true && host.isActor) {
            const damage = host.getComponent<EffectsComponent>("effects").createDamageEffect();

            // Engine.dll 0x791861..0x7918c0: hit-pawn DamageEffect shares the impact location and HitRot.
            if (damage) {
                damage.position.copy(effect.position);
                damage.quaternion.copy(effect.quaternion);
                addEffect(damage);
            }
        }
        // APawn::AssociateAttackedNotify 0x8bf853..0x8bf869: full-detail, rendered-target DamageEffect.
        if (info.damageEffect === "associated" && host.isActor && !this.renderManager.keepMinFrameRate && host.getComponent<PawnRenderableComponent>("pawnRenderable").isRendered) {
            const damage = host.getComponent<EffectsComponent>("effects").createDamageEffect();

            if (damage) {
                getTargetRotation(caster, host, damage.quaternion, false);
                host.getWorldPosition(damage.position);
                damage.position.z += host.getCollisionHeight();
                caster.getWorldPosition(tmpCasterPosition);
                tmpCasterPosition.z += caster.getCollisionHeight();

                // 0x8bf41a..0x8bf4a1: floats[0xa68640/0xad6508/0xacbc2c] = 1/2, 150, 0.85; distance-radius stays signed.
                const distance = damage.position.distanceTo(tmpCasterPosition);
                const offset = host.getCollisionHeight() + host.getCollisionRadius() > 150 ? Math.min(distance * 0.85, distance - caster.getCollisionRadius()) : host.getCollisionRadius() / 2;

                damage.position.addScaledVector(tmpPosition.set(1, 0, 0).applyQuaternion(damage.quaternion), -offset);
                addEffect(damage);
            }
        }

        return true;
    }

    protected addPawnLight(light: NativeSkillEffect_T["pawnLight"], caster: BaseActor, host: BaseActor, source: Object3D, shotTime: number, effect: Object3D = null): void {
        // Engine.dll 0x78f6f0..0x78f6fb: Cast<APawn> rejects non-Pawn impact actors.
        if (!host.isActor) return;
        if (!effect && (!light.spot || !light.position || !light.rotation || light.target)) throw new Error(`Pawn light without an effect requires a fixed spotlight transform.`);

        const lights = host.findComponent<NPawnLightComponent>("nPawnLight") || host.addComponent(new NPawnLightComponent());

        if (light.position === "center") {
            host.getWorldPosition(tmpLightPosition);
            tmpLightPosition.z += host.getCollisionHeight();
        } else if (light.position === "lastTarget") tmpLightPosition.fromArray((source as any).scriptProperties.get("LastTargetLocation"));
        else tmpLightPosition.copy(effect.position);
        if (light.spot) {
            if (light.rotation === "hit") tmpRotator.set(...(source as any).scriptProperties.get("HitRot")).toQuaternion(tmpRotation);
            else tmpRotation.copy(effect.quaternion);
            tmpLightDirection.set(1, 0, 0).applyQuaternion(tmpRotation);
            if (light.radiusOffset !== undefined) tmpLightPosition.addScaledVector(tmpLightDirection, light.radiusOffset * host.getCollisionRadius());
        }
        if (light.target === "caster") {
            caster.getWorldPosition(tmpCasterPosition);
            tmpCasterPosition.z += caster.getCollisionHeight();
            tmpLightDirection.subVectors(tmpCasterPosition, tmpLightPosition).normalize();
        }
        this.pawnLights.push({ component: lights, light: lights.add(light.spot && !light.target ? null : effect, light.color, light.radius, light.lifeTime === undefined ? shotTime : light.lifeTime, light.spot ? tmpLightPosition : null, light.spot ? tmpLightDirection : null, light.target ? tmpCasterPosition : null) });
    }
}

export default NativeSkillEffects;
