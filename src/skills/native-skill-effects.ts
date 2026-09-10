import { Object3D, Quaternion, Vector3 } from "three";
import Rotator from "../utils/rotator";
import NPawnLightComponent from "../rendering/components/n-pawn-light-component";
import type BaseActor from "../base-actor";
import type { ScriptComponent } from "../game/script-component";
import type { NpcSkillAttack_T } from "@l2js/engine/contracts/pawn";
import type { NativeSkillEffect_T } from "./native-effects";
import type PawnMovementComponent from "../physics/components/pawn-movement-component";
import type AnimationComponent from "../objects/components/animation-component";
import type LitSkinnedMesh from "../objects/lit-skinned-mesh";

const tmpRotator = new Rotator();
const tmpPosition = new Vector3();
const tmpCasterPosition = new Vector3();
const tmpRotation = new Quaternion();
const tmpMeshCorrection = new Quaternion(0, 0, Math.SQRT1_2, Math.SQRT1_2);

export function getPawnRotation(pawn: BaseActor, out: Quaternion): void {
    // PawnMovementComponent renders pawn yaw with -PI/2; emitters use UE axes directly.
    pawn.getWorldQuaternion(out).multiply(tmpMeshCorrection);
}

function getPawnMeshHeight(pawn: BaseActor): number {
    const mesh = pawn.getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh;
    const drawScale = pawn.scriptClassId ? pawn.getUnrealScriptProperty("DrawScale") as number : 1;

    return mesh ? mesh.meshOrigin.z * drawScale : pawn.getCollisionHeight();
}

export class NativeSkillEffects {
    protected readonly trailers: { effect: Object3D, host: Object3D, sameRotation: boolean, relative: boolean, offset: Vector3 }[] = [];

    public update(): void {
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

    public clear(): void { this.trailers.length = 0; }

    public addTrailer(effect: Object3D, host: Object3D, offset: Vector3, relative: boolean, sameRotation: boolean): void {
        this.trailers.push({ effect, host, sameRotation, relative, offset: offset.clone() });
    }

    public spawn(info: NativeSkillEffect_T, skill: NpcSkillAttack_T, caster: BaseActor, target: BaseActor, script: ScriptComponent<BaseActor>, shotTime: number, addEffect: (effect: Object3D) => void): void {
        const effect = script.createObject(info.effectClass) as unknown as Object3D;
        const host = info.host === "caster" ? caster : target;

        if (!(effect as any).isObject3D) throw new Error(`Skill effect '${info.effectClass}' is not an actor.`);

        host.getWorldPosition(effect.position);
        if (info.position === "center") effect.position.z += host.getCollisionHeight();
        if (info.offset) effect.position.add(tmpPosition.fromArray(info.offset));

        if (info.rotation === "caster") getPawnRotation(caster, effect.quaternion);
        else if (info.rotation === "desiredCaster") {
            const movement = caster.getComponent<PawnMovementComponent>("pawnMovement");

            tmpRotator.set(0, movement.getDesiredRotationYaw(), 0).toQuaternion(effect.quaternion);
        }
        else if (info.rotation === "targetPosition") {
            target.getWorldPosition(tmpPosition);
            tmpRotator.set(0, Math.atan2(tmpPosition.y, tmpPosition.x) * 32768 / Math.PI, 0).toQuaternion(effect.quaternion);
        } else if (info.rotation === "targetDirection") {
            target.getWorldPosition(tmpPosition);
            caster.getWorldPosition(tmpCasterPosition);
            tmpPosition.sub(tmpCasterPosition);
            tmpPosition.z += target.getCollisionHeight() - caster.getCollisionHeight();
            tmpRotator.set(Math.atan2(tmpPosition.z, Math.hypot(tmpPosition.x, tmpPosition.y)) * 32768 / Math.PI, Math.atan2(tmpPosition.y, tmpPosition.x) * 32768 / Math.PI, 0).toQuaternion(effect.quaternion);
        }

        if (info.radiusOffset !== undefined) {
            tmpPosition.set(info.radiusOffset * host.getCollisionRadius(), 0, 0).applyQuaternion(effect.quaternion);

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
            if (sameRotation) getPawnRotation(host, effect.quaternion);
            host.getWorldPosition(tmpPosition);
            this.addTrailer(effect, host, effect.position.clone().sub(tmpPosition), false, sameRotation);
        }

        addEffect(effect);

        if (info.pawnLight) {
            const lights = caster.findComponent<NPawnLightComponent>("nPawnLight") || caster.addComponent(new NPawnLightComponent());

            lights.add(effect, info.pawnLight.color, info.pawnLight.radius, shotTime);
        }

        if (info.attach === "rightHand" && !caster.attachObjectToBone(effect, "bip01_r_hand")) throw new Error(`${caster.name} has no right-hand bone.`);
        if (info.bone !== undefined && !host.attachObjectToBone(effect, info.bone, info.isAbsolute)) throw new Error(`${host.name} has no bone ${info.bone}.`);
    }
}

export default NativeSkillEffects;
export { getPawnMeshHeight };
