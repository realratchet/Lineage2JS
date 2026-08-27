import { Bone, Mesh, Quaternion, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { MESHES_CHANGED_EVENT } from "./animation-component";
import type PawnMovementComponent from "../../physics/components/pawn-movement-component";
import type BaseActor from "../../base-actor";

const HAIR_STEP = 1 / 60; // Local fixed step; retail DynamicHairGetFrame 0x94f010 only supplies bone coordinates.
const HAIR_SPRING = 32;
const HAIR_DAMPING = 8;
const HAIR_MAX_ANGLE = 0.24;
const tmpVelocity = new Vector3();
const tmpRotationX = new Quaternion();
const tmpRotationY = new Quaternion();
const tmpAxisX = new Vector3(1, 0, 0);
const tmpAxisY = new Vector3(0, 1, 0);
const tmpUp = new Vector3(0, 0, 1);

class HairSimulationComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "hairSimulation";
    protected stepTime = 0;
    protected readonly chains: HairChainState_T[] = [];

    public onEvent(type: string, data: unknown): ComponentEventResult_T<void> {
        if (type !== MESHES_CHANGED_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        this.setMeshes(data as Mesh[]);
    }

    public onUpdate(currentTime: number, deltaTime: number): void {
        if (this.chains.length === 0) return;

        const parent = this.getParent();
        const movement = this.getComponent<PawnMovementComponent>("pawnMovement");

        this.stepTime += Math.min(deltaTime, 0.2);
        tmpVelocity.copy(movement.getVelocity()).applyAxisAngle(tmpUp, -parent.rotation.z);
        currentTime *= 0.001;

        while (this.stepTime >= HAIR_STEP) {
            for (const chain of this.chains) {
                const targetX = clampHairAngle(-tmpVelocity.x * 0.002 + Math.sin(currentTime * 1.7 + chain.phase) * 0.035);
                const targetY = clampHairAngle(-tmpVelocity.y * 0.002 + Math.sin(currentTime * 1.3 + chain.phase * 0.7) * 0.025);

                chain.velocityX += ((targetX - chain.angleX) * HAIR_SPRING - chain.velocityX * HAIR_DAMPING) * HAIR_STEP;
                chain.velocityY += ((targetY - chain.angleY) * HAIR_SPRING - chain.velocityY * HAIR_DAMPING) * HAIR_STEP;
                chain.angleX += chain.velocityX * HAIR_STEP;
                chain.angleY += chain.velocityY * HAIR_STEP;
            }

            this.stepTime -= HAIR_STEP;
        }

        for (const chain of this.chains)
            for (let i = 0, len = chain.bones.length; i < len; i++) {
                const strength = (i + 1) / chain.bones.length;

                tmpRotationX.setFromAxisAngle(tmpAxisX, chain.angleX * strength);
                tmpRotationY.setFromAxisAngle(tmpAxisY, chain.angleY * strength);
                chain.bones[i].quaternion.copy(chain.rest[i]).multiply(tmpRotationX).multiply(tmpRotationY);
            }
    }

    protected setMeshes(meshes: Mesh[]): void {
        this.chains.length = 0;
        this.stepTime = 0;

        for (const mesh of meshes) {
            const skeleton = (mesh as any).skeleton as THREE.Skeleton;

            if (!skeleton) continue;
            if (!/(?:^|_)(?:ah|bh)$/i.test(mesh.name)) continue;

            const bones = skeleton.bones.filter(bone => /^hair/i.test(bone.name));

            if (bones.length === 0) continue;

            this.chains.push({ bones, rest: bones.map(bone => bone.quaternion.clone()), angleX: 0, angleY: 0, velocityX: 0, velocityY: 0, phase: hashName(mesh.name) / 0xffffffff * Math.PI * 2 });
        }
    }
}

type HairChainState_T = {
    bones: Bone[];
    rest: Quaternion[];
    angleX: number;
    angleY: number;
    velocityX: number;
    velocityY: number;
    phase: number;
};

function hashName(name: string): number {
    let hash = 2166136261;

    for (let i = 0, len = name.length; i < len; i++) {
        hash ^= name.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function clampHairAngle(value: number): number {
    return Math.max(-HAIR_MAX_ANGLE, Math.min(HAIR_MAX_ANGLE, value));
}

export default HairSimulationComponent;
export { HairSimulationComponent };
