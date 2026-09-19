import { Matrix4, Quaternion, Vector3 } from "three";
import { getRotatorQuaternionElements } from "@l2js/engine/utils/rotator";
import type { QuaternionArr } from "@l2js/engine";

const tmpRotation = new Quaternion();
const tmpYAxis = new Vector3();

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

    public setFromRotationMatrix(matrix: Matrix4): this {
        const elements = matrix.elements;

        // Retail Core FCoords::OrthoRotation 0x1014f940: double[0x10195450]=32768/PI, integer truncation at 0x1017cfa0.
        this.set(Math.trunc(Math.atan2(elements[2], Math.hypot(elements[0], elements[1])) * 32768 / Math.PI), Math.trunc(Math.atan2(elements[1], elements[0]) * 32768 / Math.PI), 0);
        tmpYAxis.set(0, 1, 0).applyQuaternion(this.toQuaternion(tmpRotation));
        // 0x1014f9f5..0x1014fa3f: atan2(ZAxis dot S.YAxis, YAxis dot S.YAxis).
        this.roll = Math.trunc(Math.atan2(elements[8] * tmpYAxis.x + elements[9] * tmpYAxis.y + elements[10] * tmpYAxis.z, elements[4] * tmpYAxis.x + elements[5] * tmpYAxis.y + elements[6] * tmpYAxis.z) * 32768 / Math.PI);
        return this;
    }
}

export default Rotator;
