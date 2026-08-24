import RotatingObject from "./rotating-object";
import { MeshLight_T } from "./lit-actor";

type AttachedActor_T = { object: THREE.Object3D, relativeLocation: THREE.Vector3, relativeRotation: THREE.Quaternion };

// PHYS_L2Movement sway per cpp/l2_editor_leak/Engine/Classes/MovableStaticMeshActor.uc; the native
// physL2Movement body is not in the leaks - omega = (rate/max) * accelRatio is unverified vs retail (needs IDA)
class SwayingObject extends RotatingObject {
    public readonly isSwayingObject: boolean = true;

    protected readonly swaying: GD.ISwayingDecodeInfo;
    protected readonly omega: [number, number, number];
    protected readonly currentMax: [number, number, number];
    protected readonly phase: [number, number, number];
    protected readonly attached: AttachedActor_T[] = [];

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo: MeshLight_T, colliderIndices: Uint32Array, scaledGlow: number, isSunAffected?: boolean, ambient?: { glow: number, vector: number[], isUnlit: boolean }, swaying: GD.ISwayingDecodeInfo }) {
        super({ ...props, rotating: { rotator: props.swaying.orgRotator, rate: [0, 0, 0] } });

        this.swaying = props.swaying;

        const { rate, max, accelRatio, randomStart } = props.swaying;

        this.omega = [0, 0, 0];
        this.currentMax = [max[0], max[1], max[2]];
        this.phase = [0, 0, 0];

        for (let i = 0; i < 3; i++) {
            if (max[i] === 0) continue;

            this.omega[i] = (rate[i] / max[i]) * (accelRatio[i] || 1);
            if (randomStart) this.phase[i] = Math.random() * Math.PI * 2;
        }
    }

    // attached actors keep their scene-graph parent (zone emitter bookkeeping stays intact); the sway
    // transform is applied to them here each frame, pivoting around this movable's origin
    // (Attached/RelativeLocation/RelativeRotation - Actor.uc:398; matched by AActor.L2MoveEvent)
    public attachActor(object: THREE.Object3D): void {
        const inv = this.quaternion.clone().invert();

        this.attached.push({
            object,
            relativeLocation: object.position.clone().sub(this.position).applyQuaternion(inv),
            relativeRotation: inv.clone().multiply(object.quaternion)
        });
    }

    public updateRotation(deltaTime: number): void {
        const dt = deltaTime / 1000;
        const { orgRotator, max, maxRandom } = this.swaying;

        for (let i = 0; i < 3; i++) {
            if (this.omega[i] === 0) continue;

            this.phase[i] += this.omega[i] * dt;

            if (this.phase[i] > Math.PI * 2) {
                this.phase[i] -= Math.PI * 2;
                if (maxRandom) this.currentMax[i] = max[i] * Math.random();
            }
        }

        this.rotator.set(
            orgRotator[0] + this.currentMax[0] * Math.sin(this.phase[0]),
            orgRotator[1] + this.currentMax[1] * Math.sin(this.phase[1]),
            orgRotator[2] + this.currentMax[2] * Math.sin(this.phase[2])
        ).toQuaternion(this.quaternion);

        for (const attachment of this.attached) {
            attachment.object.position.copy(attachment.relativeLocation).applyQuaternion(this.quaternion).add(this.position);
            attachment.object.quaternion.multiplyQuaternions(this.quaternion, attachment.relativeRotation);
            attachment.object.updateMatrix(); // freezeStaticSubtree clears matrixAutoUpdate on emitter wrappers - recompose explicitly
        }

        if (this.rigidbody) this.rigidbody.setRotation(this.quaternion, true);
    }
}

export default SwayingObject;
export { SwayingObject };
