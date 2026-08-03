import { RigidBodyDesc } from "@dimforge/rapier3d";
import CollidingMesh from "./colliding-mesh";
import { MeshLight } from "./lit-actor";

const UNITS_TO_RAD = Math.PI / 32768; // 65536 rotator units per revolution

class RotatingObject extends CollidingMesh {
    public readonly isRotatingObject: boolean = true;

    protected pitch: number;
    protected yaw: number;
    protected roll: number;
    protected readonly ratePitch: number;
    protected readonly rateYaw: number;
    protected readonly rateRoll: number;

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo: MeshLight, colliderIndices: Uint32Array, scaledGlow: number, isSunAffected?: boolean, ambient?: { glow: number, vector: number[], isUnlit: boolean }, rotating: GD.IRotatingDecodeInfo }) {
        super(props);

        [this.pitch, this.yaw, this.roll] = props.rotating.rotator;
        [this.ratePitch, this.rateYaw, this.rateRoll] = props.rotating.rate;
    }

    public makeCollider(indices: Uint32Array, vertices: Float32Array) {
        super.makeCollider(indices, vertices);
        this.rigidbodyDesc = RigidBodyDesc.kinematicPositionBased();
    }

    // fixed-dir physicsRotation: Rotation += RotationRate * deltaTime per axis (fixedTurn, UnPhysic.cpp:460)
    public updateRotation(deltaTime: number): void {
        const dt = deltaTime / 1000;

        this.pitch += this.ratePitch * dt;
        this.yaw += this.rateYaw * dt;
        this.roll += this.rateRoll * dt;

        this.setQuaternionFromRotator(this.pitch, this.yaw, this.roll);

        if (this.rigidbody) this.rigidbody.setRotation(this.quaternion, true);
    }

    // same native UE2 rotator -> quaternion path as FRotator.getQuaternionElements (un-rotator.ts)
    protected setQuaternionFromRotator(pitch: number, yaw: number, roll: number): void {
        const SR = Math.sin(roll * UNITS_TO_RAD),
            SP = Math.sin(pitch * UNITS_TO_RAD),
            SY = Math.sin(yaw * UNITS_TO_RAD),
            CR = Math.cos(roll * UNITS_TO_RAD),
            CP = Math.cos(pitch * UNITS_TO_RAD),
            CY = Math.cos(yaw * UNITS_TO_RAD);

        const m00 = CP * CY, m01 = SR * SP * CY - CR * SY, m02 = -(CR * SP * CY + SR * SY);
        const m10 = CP * SY, m11 = SR * SP * SY + CR * CY, m12 = CY * SR - CR * SP * SY;
        const m20 = SP, m21 = -SR * CP, m22 = CR * CP;

        const trace = m00 + m11 + m22;
        let x: number, y: number, z: number, w: number;

        if (trace > 0) {
            const s = Math.sqrt(trace + 1.0) * 2;
            w = 0.25 * s;
            x = (m21 - m12) / s;
            y = (m02 - m20) / s;
            z = (m10 - m01) / s;
        } else if (m00 > m11 && m00 > m22) {
            const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2;
            w = (m21 - m12) / s;
            x = 0.25 * s;
            y = (m01 + m10) / s;
            z = (m02 + m20) / s;
        } else if (m11 > m22) {
            const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2;
            w = (m02 - m20) / s;
            x = (m01 + m10) / s;
            y = 0.25 * s;
            z = (m12 + m21) / s;
        } else {
            const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2;
            w = (m10 - m01) / s;
            x = (m02 + m20) / s;
            y = (m12 + m21) / s;
            z = 0.25 * s;
        }

        this.quaternion.set(x, y, z, w);
    }
}

export default RotatingObject;
export { RotatingObject };
