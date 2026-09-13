import { Object3D, Quaternion, Vector3 } from "three";
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

const tmpRotator = new Rotator();
const tmpPosition = new Vector3();
const tmpCasterPosition = new Vector3();
const tmpLightPosition = new Vector3();
const tmpLightDirection = new Vector3();
const tmpRotation = new Quaternion();
const tmpMeshCorrection = new Quaternion(0, 0, Math.SQRT1_2, Math.SQRT1_2);

export function getPawnRotation(pawn: BaseActor, out: Quaternion): void {
    // PawnMovementComponent renders pawn yaw with -PI/2; emitters use UE axes directly.
    pawn.getWorldQuaternion(out).multiply(tmpMeshCorrection);
}

export function getPawnMeshHeight(pawn: BaseActor, scaled: boolean = true): number {
    const mesh = pawn.getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh;
    const drawScale = pawn.scriptClassId ? pawn.getUnrealScriptProperty("DrawScale") as number : 1;

    return mesh ? mesh.meshOrigin.z * (scaled ? drawScale : 1) : scaled ? pawn.getCollisionHeight() : 0;
}

export function getTargetRotation(caster: BaseActor, target: BaseActor, out: Quaternion): void {
    if (!target || caster === target) { getPawnRotation(caster, out); return; }

    target.getWorldPosition(tmpPosition);
    caster.getWorldPosition(tmpCasterPosition);
    tmpPosition.sub(tmpCasterPosition);
    tmpPosition.z += target.getCollisionHeight() - caster.getCollisionHeight();
    // Retail Core FVector::Rotation 0x1014f310: 65535/(2*PI), float-to-int truncation at 0x1017cfa0.
    tmpRotator.set(Math.trunc(Math.atan2(tmpPosition.z, Math.hypot(tmpPosition.x, tmpPosition.y)) * 65535 / (2 * Math.PI)), Math.trunc(Math.atan2(tmpPosition.y, tmpPosition.x) * 65535 / (2 * Math.PI)), 0).toQuaternion(out);
}

export class NativeSkillEffects {
    protected readonly trailers: { effect: Object3D, host: Object3D, sameRotation: boolean, relative: boolean, offset: Vector3 }[] = [];
    protected readonly pawnLights: { component: NPawnLightComponent, light: PawnLight_T }[] = [];

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

    public spawn(info: NativeSkillEffect_T, skill: NpcSkillAttack_T, caster: BaseActor, target: BaseActor, script: ScriptComponent<BaseActor>, shotTime: number, addEffect: (effect: Object3D) => void, source: Object3D = caster, locList: readonly Vector3Arr[] = []): void {
        if (info.locList) {
            let locations = locList;

            if (locations.length === 0 && info.locList.random) {
                caster.getWorldPosition(tmpPosition);
                locations = Array.from({ length: info.locList.random.count }, () => [
                    tmpPosition.x + (Math.random() * 2 - 1) * info.locList.random.range,
                    tmpPosition.y + (Math.random() * 2 - 1) * info.locList.random.range,
                    tmpPosition.z
                ] as Vector3Arr);
            }

            for (let i = 0; i < locations.length; i++)
                this.spawn({ ...info, locList: undefined, location: locations[i], delay: shotTime + info.locList.delay + i * info.locList.interval }, skill, caster, target, script, shotTime, addEffect, source);
            return;
        }

        const effect = script.createObject(info.effectClass) as unknown as Object3D;
        const host = (info.host === "caster" ? caster : info.host === "source" ? source : target) as BaseActor;

        if (!(effect as any).isObject3D) throw new Error(`Skill effect '${info.effectClass}' is not an actor.`);

        if (info.speedRate !== undefined) (effect as any).scriptProperties.set("SpeedRate", info.speedRate);
        if (info.useSkillSpeed) {
            const speed = caster.getUnrealScriptProperty("SkillSpeedRate") as number;

            if (!Number.isFinite(speed)) throw new Error(`${caster.name} has invalid SkillSpeedRate '${speed}'.`);
            (effect as any).scriptProperties.set("SpeedRate", speed);
        }

        host.getWorldPosition(effect.position);
        if (info.location) effect.position.fromArray(info.location);
        if (info.positionBone) host.getBoneWorldPosition(info.positionBone, effect.position);
        if (info.attach === "trail" && info.position === undefined) {
            const properties = (effect as any).scriptProperties;
            const pivot = properties.get("TrailerPrePivot");

            // Engine.dll SpawnSkillEffect 0x79841e..0x798443: location mode 1 negates scaled mesh Origin.Z.
            pivot[2] = -getPawnMeshHeight(host);
            effect.position.z += host.getCollisionHeight();
            if (properties.get("bTrailerPrePivot")) effect.position.add(tmpPosition.fromArray(pivot));
        } else if (info.position === "center") effect.position.z += host.getCollisionHeight();
        else if (info.position === "lastTarget") effect.position.fromArray((source as any).scriptProperties.get("LastTargetLocation"));
        if (info.heightOffset !== undefined) effect.position.z += info.heightOffset * host.getCollisionHeight();
        if (info.lifeSpan === "shotTime") (effect as any).scriptProperties.set("LifeSpan", shotTime);
        if (info.physics === "none") (effect as any).scriptProperties.set("Physics", EPhysics_T.PHYS_None);
        if (info.offset) effect.position.add(tmpPosition.fromArray(info.offset));
        if (info.trailerPrePivot === "casterMeshOrigin") {
            // Engine.dll 0x7afbe9 writes TrailerPrePivot.Z; AEmitter::GetTrailerPrePivot 0x60d794 reads +0x454.
            const height = getPawnMeshHeight(caster, false);

            (effect as any).scriptProperties.get("TrailerPrePivot")[2] = height;
            effect.position.z += height;
        }

        if (info.rotation === "hit") tmpRotator.set(...(source as any).scriptProperties.get("HitRot")).toQuaternion(effect.quaternion);
        else if (info.rotation === "caster") getPawnRotation(caster, effect.quaternion);
        else if (info.rotation === "target") getPawnRotation(target, effect.quaternion);
        else if (info.rotation === "desiredCaster") {
            const movement = caster.getComponent<PawnMovementComponent>("pawnMovement");

            tmpRotator.set(0, movement.getDesiredRotationYaw(), 0).toQuaternion(effect.quaternion);
        }
        else if (info.rotation === "targetPosition") {
            target.getWorldPosition(tmpPosition);
            tmpRotator.set(0, Math.trunc(Math.atan2(tmpPosition.y, tmpPosition.x) * 65535 / (2 * Math.PI)), 0).toQuaternion(effect.quaternion);
        } else if (info.rotation === "targetDirection") getTargetRotation(caster, target, effect.quaternion);

        if (info.radiusOffset !== undefined) {
            tmpRotation.copy(effect.quaternion);
            if (info.offsetRotation === "desiredCaster") tmpRotator.set(0, caster.getComponent<PawnMovementComponent>("pawnMovement").getDesiredRotationYaw(), 0).toQuaternion(tmpRotation);
            else if (info.offsetRotation === "targetDirection") getTargetRotation(caster, target, tmpRotation);
            tmpPosition.set(info.radiusOffset * host.getCollisionRadius(), 0, 0).applyQuaternion(tmpRotation);

            // Engine.dll SpawnSkillEffect 0x798449: trailer XY offset applies only when both components are nonzero.
            if (info.attach !== "trail" || tmpPosition.x !== 0 && tmpPosition.y !== 0) effect.position.add(tmpPosition);
        }

        // Engine.dll SpawnSkillEffect 0x7986b5: radius > 11; 0x7986f0: radius * (1/9).
        const radius = caster.getCollisionRadius();
        let scale = info.scale && radius > 11 ? radius / 9 : 1;

        // Engine.dll SkillEffectInit 0x79e9cc: undo Energy Wave's automatic radius scaling.
        if (info.scale === "cancelCasterRadius") scale *= 9 / radius;

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

        if (info.pawnLight) {
            const light = info.pawnLight;
            const lights = host.findComponent<NPawnLightComponent>("nPawnLight") || host.addComponent(new NPawnLightComponent());

            tmpLightPosition.copy(effect.position);
            if (light.position === "center") {
                host.getWorldPosition(tmpLightPosition);
                tmpLightPosition.z += host.getCollisionHeight();
            } else if (light.position === "lastTarget") tmpLightPosition.fromArray((source as any).scriptProperties.get("LastTargetLocation"));
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

        if (info.attach === "rightHand" && !caster.attachObjectToBone(effect, "bip01_r_hand")) throw new Error(`${caster.name} has no right-hand bone.`);
        if (info.boneProperty) {
            const bone = host.getUnrealScriptProperty(info.boneProperty);

            if (typeof bone !== "string") throw new Error(`${host.name} has invalid bone property '${info.boneProperty}': '${bone}'.`);

            // Engine.dll Init 0x7a1883 and PreShot 0x7a446c ignore AttachToBone's return value.
            if (!host.attachObjectToBone(effect, bone, info.isAbsolute)) console.warn(`[skill-effects] ${host.name} has no bone '${bone}' from '${info.boneProperty}'; '${info.effectClass}' remains unattached.`);
        } else if (info.bone !== undefined && !host.attachObjectToBone(effect, info.bone, info.isAbsolute)) {
            if (info.boneFallback === undefined || !host.attachObjectToBone(effect, info.boneFallback, info.isAbsolute)) throw new Error(`${host.name} has no bone ${info.bone}.`);
        }

        if (info.relativeLocation) {
            (effect as any).scriptProperties.set("RelativeLocation", info.relativeLocation.slice());
            effect.position.fromArray(info.relativeLocation);
        }
        if (info.relativeRotation) {
            (effect as any).scriptProperties.set("RelativeRotation", info.relativeRotation.slice());
            tmpRotator.set(...info.relativeRotation).toQuaternion(effect.quaternion);
        }

        if (info.damageEffect) {
            const damage = target.getComponent<EffectsComponent>("effects").createDamageEffect();

            // Engine.dll 0x791861..0x7918c0: hit-pawn DamageEffect shares the impact location and HitRot.
            if (damage) {
                damage.position.copy(effect.position);
                damage.quaternion.copy(effect.quaternion);
                addEffect(damage);
            }
        }
    }
}

export default NativeSkillEffects;
