import { Quaternion } from "three";
import { getRotatorQuaternionElements } from "@l2js/engine/utils/rotator";
import type { QuaternionArr } from "@l2js/engine";

class Rotator {
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
}

export default Rotator;
export { Rotator };
