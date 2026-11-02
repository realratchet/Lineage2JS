import { Matrix4, Quaternion, Vector3, type Object3D } from "three";
import { getRotatorQuaternionElements, sinRotator } from "@l2js/engine/utils/rotator";
import type { QuaternionArr } from "@l2js/engine";

const tmpYAxis = new Vector3();
const tmpMeshCorrection = new Quaternion(0, 0, Math.SQRT1_2, Math.SQRT1_2);

export function getPawnRotation(pawn: Object3D, out: Quaternion): void {
    // PawnMovementComponent renders pawn yaw with -PI/2; emitters use UE axes directly.
    pawn.getWorldQuaternion(out).multiply(tmpMeshCorrection);
}

export class Rotator {
    public pitch: number;
    public yaw: number;
    public roll: number;
    protected readonly quaternionElements: QuaternionArr = [0, 0, 0, 1];

    public constructor(pitch: number = 0, yaw: number = 0, roll: number = 0) {
        this.pitch = pitch;
        this.yaw = yaw;
        this.roll = roll;
    }

    public set(pitch: number, yaw: number, roll: number): this {
        this.pitch = pitch;
        this.yaw = yaw;
        this.roll = roll;

        return this;
    }

    public toQuaternion(target: Quaternion = new Quaternion()): Quaternion {
        return target.fromArray(getRotatorQuaternionElements(this.pitch, this.yaw, this.roll, this.quaternionElements));
    }

    public rotateMatrix(matrix: Matrix4, inverse: boolean = false): Matrix4 {
        const elements = matrix.elements;
        const sine = inverse ? -1 : 1;

        // Core FCoords rotation stores float axes after each roll/pitch/yaw operation.
        for (let step = 0; step < 3; step++) {
            const axis = inverse ? 2 - step : step;
            const angle = axis === 0 ? this.roll : axis === 1 ? this.pitch : this.yaw;
            const s = sinRotator(angle) * sine, c = sinRotator(angle + 16384);

            for (let i = 0; i < 12; i += 4) {
                const x = elements[i], y = elements[i + 1], z = elements[i + 2];

                if (axis === 0) {
                    elements[i] = Math.fround(z * 0 + y * 0 + x);
                    elements[i + 1] = Math.fround(z * s + y * c + x * 0);
                    elements[i + 2] = Math.fround(z * c - y * s + x * 0);
                } else if (axis === 1) {
                    elements[i] = Math.fround(-z * s + y * 0 + x * c);
                    elements[i + 1] = Math.fround(z * 0 + y + x * 0);
                    elements[i + 2] = Math.fround(z * c + y * 0 + x * s);
                } else {
                    elements[i] = Math.fround(z * 0 - y * s + x * c);
                    elements[i + 1] = Math.fround(z * 0 + y * c + x * s);
                    elements[i + 2] = Math.fround(z + y * 0 + x * 0);
                }
            }
        }

        return matrix;
    }

    public setFromRotationMatrix(matrix: Matrix4): this {
        const elements = matrix.elements;

        // Retail Core FCoords::OrthoRotation 0x1014f940: double[0x10195450]=32768/PI, integer truncation at 0x1017cfa0.
        this.set(Math.trunc(Math.atan2(elements[2], Math.sqrt(elements[0] * elements[0] + elements[1] * elements[1])) * 32768 / Math.PI), Math.trunc(Math.atan2(elements[1], elements[0]) * 32768 / Math.PI), 0);
        tmpYAxis.set(-sinRotator(this.yaw), sinRotator(this.yaw + 16384), 0);
        // 0x1014f9f5..0x1014fa3f: atan2(ZAxis dot S.YAxis, YAxis dot S.YAxis).
        this.roll = Math.trunc(Math.atan2(elements[9] * tmpYAxis.y + elements[10] * tmpYAxis.z + elements[8] * tmpYAxis.x, elements[5] * tmpYAxis.y + elements[6] * tmpYAxis.z + elements[4] * tmpYAxis.x) * 32768 / Math.PI);
        return this;
    }
}

export default Rotator;
