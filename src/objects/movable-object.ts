import { RigidBodyDesc } from "@dimforge/rapier3d";
import { Object3D, Quaternion, Vector3 } from "three";
import type BaseActor from "../base-actor";
import CollidingMesh from "./colliding-mesh";
import { MeshLight_T } from "./lit-actor";
import { getRotatorQuaternionElements } from "../assets/unreal/utils/rotator";
import { EPhysics_T } from "../assets/unreal/un-aactor";
import type { ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";
import { pointPrimitive } from "../physics/collision-primitive";
import { MoverComponent } from "../physics/components/physics-component";
import type { SectorObject } from "./zone-object";
import type { IMoverDecodeInfo } from "@l2js/engine/contracts/mesh";

const frozenUpdateMatrixWorld = function () { };
const tmpOldPosition = new Vector3();
const tmpOldQuaternion = new Quaternion();
const tmpProposedPosition = new Vector3();
const tmpProposedQuaternion = new Quaternion();
const tmpOldInverseQuaternion = new Quaternion();
const tmpActorLocalPosition = new Vector3();
const tmpActorTargetPosition = new Vector3();
const tmpEncroachMovement = new Vector3();
const tmpEncroachBack = new Vector3();
const tmpExtent = new Vector3();
const tmpRotation = [0, 0, 0];
const tmpPreviousRotation = [0, 0, 0];
const tmpStartPosition = new Vector3();
const tmpQuaternionElements: [number, number, number, number] = [0, 0, 0, 1];

export class MovableObject extends CollidingMesh {
    public readonly isMovableObject: boolean = true;
    public readonly damageGrade: number;
    public readonly hitActorNormal: Vector3;

    protected readonly mover: IMoverDecodeInfo;

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo: MeshLight_T, colliderIndices: Uint32Array, scaledGlow: number, isSunAffected?: boolean, isSpecialLit?: boolean, forcedRegionTag?: string, forcedRegion?: number, ambient?: { glow: number, vector: number[], isUnlit: boolean }, mover: IMoverDecodeInfo }) {
        super(props);

        this.mover = props.mover;
        this.damageGrade = props.mover.damageGrade;
        this.hitActorNormal = new Vector3().fromArray(props.mover.hitActorNormal);

        this.addComponent(new MoverComponent());
    }

    public makeCollider(indices: Uint32Array, vertices: Float32Array) {
        super.makeCollider(indices, vertices);
        this.rigidbodyDesc = RigidBodyDesc.kinematicPositionBased();
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        if (call.context !== this) return super.callUnrealNative(call);

        switch (call.index) {
            case 3970:
                if (call.args[0] !== EPhysics_T.PHYS_MovingBrush) throw new Error(`Mover physics '${call.args[0]}' is not implemented.`);
                this.setUnrealScriptProperty("Physics", call.args[0]);
                return;
            case 266: {
                const delta = call.args[0] as number[];

                this.unfreezeMover();
                this.position.x += delta[0];
                this.position.y += delta[1];
                this.position.z += delta[2];
                this.syncCollisionTransform();
                this.freezeMover();
                return true;
            }
            case 299: {
                const rotation = call.args[0] as number[];

                this.unfreezeMover();
                this.setRotation(rotation);
                this.syncCollisionTransform();
                this.freezeMover();
                return true;
            }
        }

        return super.callUnrealNative(call);
    }

    protected setRotation(rotation: number[]): void {
        const value = this.getUnrealScriptProperty("Rotation") as number[];

        for (let i = 0; i < 3; i++) value[i] = rotation[i];
        this.setUnrealScriptProperty("Rotation", value);
        this.quaternion.fromArray(getRotatorQuaternionElements(rotation[0], rotation[1], rotation[2], tmpQuaternionElements));
    }

    protected checkEncroachment(actors: BaseActor[], oldPosition: Vector3, oldQuaternion: Quaternion): boolean {
        const primitive = this.getCollisionPrimitive();

        if (!primitive) return false;

        tmpProposedPosition.copy(this.position);
        tmpProposedQuaternion.copy(this.quaternion);
        tmpOldInverseQuaternion.copy(oldQuaternion).invert();

        for (const actor of actors) {
            if (this.basedActors.has(actor)) continue;

            const actorPrimitive = actor.getCollisionPrimitive();

            if (actorPrimitive.kind !== "cylinder") continue;

            tmpExtent.set(actorPrimitive.radius, actorPrimitive.radius, actorPrimitive.halfHeight);
            if (!pointPrimitive(primitive, actorPrimitive.center, tmpExtent)) continue;

            tmpEncroachMovement.copy(this.position).sub(oldPosition);
            // ULevel::CheckEncroachment 0x1058ce64..0x1058d076 applies the extra displacement only for rotation.
            if (!this.quaternion.equals(oldQuaternion)) {
                tmpActorLocalPosition.copy(actorPrimitive.center).sub(oldPosition).applyQuaternion(tmpOldInverseQuaternion);
                tmpActorTargetPosition.copy(tmpActorLocalPosition).applyQuaternion(this.quaternion).add(this.position);
                tmpEncroachMovement.addScaledVector(tmpActorTargetPosition.sub(actorPrimitive.center), 1.5);
            }

            // ULevel::CheckEncroachment 0x1058d076..0x1058d2df uses different source poses for the two moves.
            this.position.copy(oldPosition);
            this.quaternion.copy(oldQuaternion);
            this.syncCollisionTransform();
            try {
                actor.moveSmooth(tmpEncroachMovement);
            } finally {
                this.position.copy(tmpProposedPosition);
                this.quaternion.copy(tmpProposedQuaternion);
                this.syncCollisionTransform();
            }

            const movedPrimitive = actor.getCollisionPrimitive();
            const stillEncroaching = pointPrimitive(primitive, movedPrimitive.center, tmpExtent);

            if (stillEncroaching) {
                if (this.scriptComponent.call("EncroachingOn", [actor])) return true;
                continue;
            }

            this.quaternion.copy(oldQuaternion);
            this.syncCollisionTransform();
            try {
                actor.moveActor(actor.position, tmpEncroachBack.copy(tmpEncroachMovement).negate());
            } finally {
                this.quaternion.copy(tmpProposedQuaternion);
                this.syncCollisionTransform();
            }
        }

        return false;
    }

    public freezeMover(): void {
        this.updateMatrix();
        Object3D.prototype.updateMatrixWorld.call(this, true);
        this.matrixAutoUpdate = false;
        this.updateMatrixWorld = frozenUpdateMatrixWorld;

        this.invalidateDoorPortals();
    }

    protected invalidateDoorPortals(): void {
        let parent = this.parent;

        while (parent && !(parent as SectorObject).isSectorObject) parent = parent.parent;
        if (parent) (parent as SectorObject).invalidateDoorPortals();
    }

    public unfreezeMover(): void {
        if (!this.matrixAutoUpdate) this.invalidateDoorPortals();
        this.matrixAutoUpdate = true;
        this.updateMatrixWorld = Object3D.prototype.updateMatrixWorld;
    }

    public isServerControlled(): boolean { return (this.getUnrealScriptProperty("L2ServerObjectRealID") as number) > 0; }

    public initializeMover(): void {
        this.scriptComponent.beginPlay(() => this.scriptComponent.call("BeginPlay"));
        this.freezeMover();
    }

    public setOpen(isOpen: boolean): void {
        if (!!this.getUnrealScriptProperty("bOpen") === isOpen) return;

        this.scriptComponent.call(isOpen ? "Trigger" : "UnTrigger", [null, null]);
        this.setUnrealScriptProperty("bOpen", isOpen);
    }

    public updateMover(deltaTime: number, actors: BaseActor[]): boolean {
        const seconds = Math.fround(deltaTime * 0.001);

        this.scriptComponent.tick(seconds);
        const velocity = this.getUnrealScriptProperty("Velocity") as number[];

        if (!this.getUnrealScriptProperty("bInterpolating") || seconds <= 0) {
            velocity[0] = velocity[1] = velocity[2] = 0;
            return false;
        }

        let remaining = seconds, steps = 0;
        tmpStartPosition.copy(this.position);

        while (this.getUnrealScriptProperty("bInterpolating") && remaining > 0) {
            if (++steps > 64) throw new Error(`Mover '${this.name}' exceeded its interpolation limit.`);
            const alpha = this.getUnrealScriptProperty("PhysAlpha") as number, rate = this.getUnrealScriptProperty("PhysRate") as number;
            let nextAlpha = Math.fround(alpha + remaining * rate);

            if (nextAlpha > 1) {
                remaining *= (nextAlpha - 1) / (nextAlpha - alpha);
                nextAlpha = 1;
            } else remaining = 0;

            const blend = this.mover.isGliding ? Math.fround(3 * nextAlpha * nextAlpha - 2 * nextAlpha * nextAlpha * nextAlpha) : nextAlpha;
            const key = this.getUnrealScriptProperty("KeyNum") as number, oldPos = this.getUnrealScriptProperty("OldPos") as number[], oldRot = this.getUnrealScriptProperty("OldRot") as number[];
            const baseRot = this.getUnrealScriptProperty("BaseRot") as number[], keyRot = (this.getUnrealScriptProperty("KeyRot") as number[][])[key];
            const basePos = this.getUnrealScriptProperty("BasePos") as number[], target = (this.getUnrealScriptProperty("KeyPos") as number[][])[key];

            if (!target || !keyRot) throw new Error(`Mover '${this.name}' has no key '${key}'.`);
            tmpOldPosition.copy(this.position);
            tmpOldQuaternion.copy(this.quaternion);
            const rotation = this.getUnrealScriptProperty("Rotation") as number[];

            for (let i = 0; i < 3; i++) tmpPreviousRotation[i] = rotation[i];
            this.unfreezeMover();
            this.position.set(Math.fround(oldPos[0] + Math.fround((Math.fround(basePos[0] + target[0]) - oldPos[0]) * blend)), Math.fround(oldPos[1] + Math.fround((Math.fround(basePos[1] + target[1]) - oldPos[1]) * blend)), Math.fround(oldPos[2] + Math.fround((Math.fround(basePos[2] + target[2]) - oldPos[2]) * blend)));
            for (let i = 0; i < 3; i++) tmpRotation[i] = oldRot[i] + (Math.fround(((baseRot[i] + keyRot[i] - oldRot[i]) | 0) * blend) | 0) | 0;
            this.setRotation(tmpRotation);
            this.syncCollisionTransform();

            if (this.checkEncroachment(actors, tmpOldPosition, tmpOldQuaternion)) {
                this.position.copy(tmpOldPosition);
                this.setRotation(tmpPreviousRotation);
                this.quaternion.copy(tmpOldQuaternion);
                this.syncCollisionTransform();
                this.freezeMover();
                velocity[0] = velocity[1] = velocity[2] = 0;
                return true;
            }

            this.setUnrealScriptProperty("PhysAlpha", nextAlpha);
            if (nextAlpha === 1) {
                this.setUnrealScriptProperty("bInterpolating", false);
                this.scriptComponent.call("KeyFrameReached");
            }
        }

        velocity[0] = Math.fround((this.position.x - tmpStartPosition.x) / seconds);
        velocity[1] = Math.fround((this.position.y - tmpStartPosition.y) / seconds);
        velocity[2] = Math.fround((this.position.z - tmpStartPosition.z) / seconds);
        if (!this.getUnrealScriptProperty("bInterpolating")) this.freezeMover();
        return true;
    }

}

export default MovableObject;
