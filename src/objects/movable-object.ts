import { RigidBodyDesc } from "@dimforge/rapier3d";
import { Object3D, Quaternion, Vector3 } from "three";
import type BaseActor from "@client/base-actor";
import CollidingMesh from "./colliding-mesh";
import { MeshLight_T } from "./lit-actor";
import { pointPrimitive } from "@client/physics/collision-primitive";
import { MoverComponent } from "@client/physics/components/physics-component";

type MoverState_T = "closed" | "delaying" | "opening" | "open" | "closing" | "stopped";

const frozenUpdateMatrixWorld = function () { };
const tmpOldPosition = new Vector3();
const tmpOldQuaternion = new Quaternion();
const tmpOldInverseQuaternion = new Quaternion();
const tmpActorPosition = new Vector3();
const tmpActorLocalPosition = new Vector3();
const tmpActorTargetPosition = new Vector3();
const tmpEncroachMovement = new Vector3();
const tmpEncroachBack = new Vector3();
const tmpExtent = new Vector3();

class MovableObject extends CollidingMesh {
    public readonly isMovableObject: boolean = true;

    protected readonly mover: GD.IMoverDecodeInfo;
    protected readonly keyPositions: Vector3[];
    protected readonly keyQuaternions: Quaternion[];
    protected state: MoverState_T = "closed";
    protected keyNum: number;
    protected stateStart: number = 0;
    protected transformAlpha: number = 0;

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo: MeshLight_T, colliderIndices: Uint32Array, scaledGlow: number, isSunAffected?: boolean, ambient?: { glow: number, vector: number[], isUnlit: boolean }, mover: GD.IMoverDecodeInfo }) {
        super(props);

        this.mover = props.mover;
        this.keyPositions = props.mover.keyPositions.map(v => new Vector3().fromArray(v));
        this.keyQuaternions = props.mover.keyQuaternions.map(v => new Quaternion().fromArray(v));
        this.keyNum = props.mover.keyNum;

        if (this.keyNum > 0) this.state = "open";

        this.addComponent(new MoverComponent());
    }

    public makeCollider(indices: Uint32Array, vertices: Float32Array) {
        super.makeCollider(indices, vertices);
        this.rigidbodyDesc = RigidBodyDesc.kinematicPositionBased();
    }

    protected isTriggered(position: Vector3): boolean {
        const closed = this.keyPositions[0];
        const dx = position.x - closed.x;
        const dy = position.y - closed.y;

        return dx * dx + dy * dy <= this.mover.collisionRadius * this.mover.collisionRadius
            && Math.abs(position.z - closed.z) <= this.mover.collisionHeight;
    }

    protected beginMove(state: "opening" | "closing", keyNum: number, currentTime: number): void {
        this.state = state;
        this.keyNum = keyNum;
        this.stateStart = currentTime;
        this.transformAlpha = 0;
        this.unfreezeMover();
    }

    protected updateTransform(alpha: number, fromKey: number, toKey: number, actors?: BaseActor[], isGliding: boolean = this.mover.isGliding): boolean {
        tmpOldPosition.copy(this.position);
        tmpOldQuaternion.copy(this.quaternion);

        const blendAlpha = isGliding ? 3 * alpha * alpha - 2 * alpha * alpha * alpha : alpha;

        this.position.lerpVectors(this.keyPositions[fromKey], this.keyPositions[toKey], blendAlpha);
        this.quaternion.slerpQuaternions(this.keyQuaternions[fromKey], this.keyQuaternions[toKey], blendAlpha);

        if (this.rigidbody) {
            this.rigidbody.setTranslation(this.position, true);
            this.rigidbody.setRotation(this.quaternion, true);
        }

        if (actors && this.checkEncroachment(actors, tmpOldPosition, tmpOldQuaternion)) {
            this.position.copy(tmpOldPosition);
            this.quaternion.copy(tmpOldQuaternion);

            if (this.rigidbody) {
                this.rigidbody.setTranslation(this.position, true);
                this.rigidbody.setRotation(this.quaternion, true);
            }

            return false;
        }

        this.transformAlpha = alpha;

        return true;
    }

    protected checkEncroachment(actors: BaseActor[], oldPosition: Vector3, oldQuaternion: Quaternion): boolean {
        const primitive = this.getCollisionPrimitive();

        if (!primitive) return false;

        tmpOldInverseQuaternion.copy(oldQuaternion).invert();

        for (const actor of actors) {
            if (this.basedActors.has(actor)) continue;

            const actorPrimitive = actor.getCollisionPrimitive();

            if (actorPrimitive.kind !== "cylinder") continue;

            tmpExtent.set(actorPrimitive.radius, actorPrimitive.radius, actorPrimitive.halfHeight);
            if (!pointPrimitive(primitive, actorPrimitive.center, tmpExtent)) continue;

            tmpActorLocalPosition.copy(actorPrimitive.center).sub(oldPosition).applyQuaternion(tmpOldInverseQuaternion);
            tmpActorTargetPosition.copy(tmpActorLocalPosition).applyQuaternion(this.quaternion).add(this.position);
            tmpEncroachMovement.copy(this.position).sub(oldPosition).addScaledVector(tmpActorTargetPosition.sub(actorPrimitive.center), 1.5);

            actor.moveSmooth(tmpEncroachMovement, this);

            const movedPrimitive = actor.getCollisionPrimitive();
            const stillEncroaching = pointPrimitive(primitive, movedPrimitive.center, tmpExtent);

            if (stillEncroaching) {
                if (this.mover.moverEncroachType === "stop" || this.mover.moverEncroachType === "return") return true;
                continue;
            }

            tmpActorPosition.copy(actor.position);
            actor.moveActor(tmpActorPosition, tmpEncroachBack.copy(tmpEncroachMovement).negate());
            actor.position.copy(tmpActorPosition);
        }

        return false;
    }

    public freezeMover(): void {
        this.updateMatrix();
        Object3D.prototype.updateMatrixWorld.call(this, true);
        this.matrixAutoUpdate = false;
        this.updateMatrixWorld = frozenUpdateMatrixWorld;
    }

    public unfreezeMover(): void {
        this.matrixAutoUpdate = true;
        this.updateMatrixWorld = Object3D.prototype.updateMatrixWorld;
    }

    public setPosition(alpha: number): void {
        if (this.keyPositions.length < 2) return;

        alpha = Math.max(0, Math.min(alpha, 1));

        const value = alpha * (this.keyPositions.length - 1);
        const fromKey = Math.min(Math.floor(value), this.keyPositions.length - 2);

        this.unfreezeMover();
        this.updateTransform(value - fromKey, fromKey, fromKey + 1, null, false);
        this.state = alpha === 1 ? "open" : "closed";
        this.keyNum = alpha === 1 ? this.keyPositions.length - 1 : 0;
        this.freezeMover();
    }

    public tryTrigger(currentTime: number, triggerPosition: Vector3): number | null {
        if (this.mover.initialState !== "BumpOpenTimed" || this.keyPositions.length < 2 || this.state !== "closed") return null;
        if (!this.isTriggered(triggerPosition)) return null;

        if (this.mover.delayTime > 0) {
            this.state = "delaying";
            this.stateStart = currentTime;

            return currentTime + this.mover.delayTime * 1000;
        }

        this.beginMove("opening", 1, currentTime);

        return 0;
    }

    public updateMover(currentTime: number, actors?: BaseActor[]): number {
        const moveTime = Math.max(this.mover.moveTime * 1000, 5);
        let transitions = 0;

        while (transitions++ < this.keyPositions.length * 2 + 4) {
            if (this.state === "closed" || this.state === "stopped") return -1;

            if (this.state === "delaying") {
                const wakeTime = this.stateStart + this.mover.delayTime * 1000;

                if (currentTime < wakeTime) return wakeTime;

                this.beginMove("opening", 1, wakeTime);
                continue;
            }

            if (this.state === "open") {
                if (this.mover.triggerOnceOnly) return -1;

                const wakeTime = this.stateStart + this.mover.stayOpenTime * 1000;

                if (currentTime < wakeTime) return wakeTime;

                this.beginMove("closing", this.keyPositions.length - 2, wakeTime);
                continue;
            }

            const segmentEnd = this.stateStart + moveTime;
            const alpha = Math.min((currentTime - this.stateStart) / moveTime, 1);
            const fromKey = this.state === "opening" ? this.keyNum - 1 : this.keyNum + 1;

            if (!this.updateTransform(alpha, fromKey, this.keyNum, actors)) {
                if (this.mover.moverEncroachType === "stop") {
                    this.state = "stopped";
                    this.freezeMover();
                    return -1;
                }

                const reverseAlpha = 1 - this.transformAlpha;

                if (this.state === "opening") {
                    this.state = "closing";
                    this.keyNum = fromKey;
                } else {
                    this.state = "opening";
                    this.keyNum = fromKey;
                }

                this.stateStart = currentTime - reverseAlpha * moveTime;
                this.transformAlpha = reverseAlpha;

                return 0;
            }

            if (alpha < 1) return 0;

            if (this.state === "opening") {
                if (this.keyNum < this.keyPositions.length - 1) {
                    this.beginMove("opening", this.keyNum + 1, segmentEnd);
                    continue;
                }

                this.state = "open";
                this.stateStart = segmentEnd;
                this.freezeMover();
                continue;
            }

            if (this.keyNum > 0) {
                this.beginMove("closing", this.keyNum - 1, segmentEnd);
                continue;
            }

            this.state = "closed";
            this.stateStart = segmentEnd;
            this.freezeMover();

            return -1;
        }

        return 0;
    }
}

export default MovableObject;
export { MovableObject };
