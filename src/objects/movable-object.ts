import { RigidBodyDesc } from "@dimforge/rapier3d";
import { Object3D, Quaternion, Vector3 } from "three";
import CollidingMesh from "./colliding-mesh";
import { MeshLight } from "./lit-actor";

type MoverState_T = "closed" | "delaying" | "opening" | "open" | "closing";

const frozenUpdateMatrixWorld = function () { };

class MovableObject extends CollidingMesh {
    public readonly isMovableObject: boolean = true;

    protected readonly mover: GD.IMoverDecodeInfo;
    protected readonly keyPositions: Vector3[];
    protected readonly keyQuaternions: Quaternion[];
    protected state: MoverState_T = "closed";
    protected keyNum: number;
    protected stateStart: number = 0;

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo: MeshLight, colliderIndices: Uint32Array, scaledGlow: number, isSunAffected?: boolean, ambient?: { glow: number, vector: number[], isUnlit: boolean }, mover: GD.IMoverDecodeInfo }) {
        super(props);

        this.mover = props.mover;
        this.keyPositions = props.mover.keyPositions.map(v => new Vector3().fromArray(v));
        this.keyQuaternions = props.mover.keyQuaternions.map(v => new Quaternion().fromArray(v));
        this.keyNum = props.mover.keyNum;

        if (this.keyNum > 0) this.state = "open";
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
        this.unfreezeMover();
    }

    protected updateTransform(alpha: number, fromKey: number, toKey: number, isGliding: boolean = this.mover.isGliding): void {
        if (isGliding) alpha = 3 * alpha * alpha - 2 * alpha * alpha * alpha;

        this.position.lerpVectors(this.keyPositions[fromKey], this.keyPositions[toKey], alpha);
        this.quaternion.slerpQuaternions(this.keyQuaternions[fromKey], this.keyQuaternions[toKey], alpha);

        if (this.rigidbody) {
            this.rigidbody.setTranslation(this.position, true);
            this.rigidbody.setRotation(this.quaternion, true);
        }
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
        this.updateTransform(value - fromKey, fromKey, fromKey + 1, false);
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

    public updateMover(currentTime: number): number {
        if (this.state === "closed") return -1;

        if (this.state === "delaying") {
            const wakeTime = this.stateStart + this.mover.delayTime * 1000;

            if (currentTime < wakeTime) return wakeTime;

            this.beginMove("opening", 1, currentTime);

            return 0;
        }

        if (this.state === "open") {
            if (this.mover.triggerOnceOnly) return -1;

            const wakeTime = this.stateStart + this.mover.stayOpenTime * 1000;

            if (currentTime < wakeTime) return wakeTime;

            this.beginMove("closing", this.keyPositions.length - 2, currentTime);

            return 0;
        }

        const moveTime = Math.max(this.mover.moveTime * 1000, 5);
        const alpha = Math.min((currentTime - this.stateStart) / moveTime, 1);
        const fromKey = this.state === "opening" ? this.keyNum - 1 : this.keyNum + 1;

        this.updateTransform(alpha, fromKey, this.keyNum);

        if (alpha < 1) return 0;

        if (this.state === "opening") {
            if (this.keyNum < this.keyPositions.length - 1)
                this.beginMove("opening", this.keyNum + 1, currentTime);
            else {
                this.state = "open";
                this.stateStart = currentTime;
                this.freezeMover();

                if (this.mover.triggerOnceOnly) return -1;

                return currentTime + this.mover.stayOpenTime * 1000;
            }
        } else if (this.keyNum > 0) {
            this.beginMove("closing", this.keyNum - 1, currentTime);
        } else {
            this.state = "closed";
            this.stateStart = currentTime;
            this.freezeMover();

            return -1;
        }

        return 0;
    }
}

export default MovableObject;
export { MovableObject };
