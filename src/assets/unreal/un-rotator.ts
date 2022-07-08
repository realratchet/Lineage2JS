import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";

const _PI = Math.PI;
const _TWO_PI = 2 * _PI;
const _TWO_TO_FIFTEEN = 2 ** 15;
const _INV_TWO_TO_FIFTEEN = 1 / _TWO_TO_FIFTEEN;
const _INV_TWO_TO_FIFTEEN_TIMES_PI = _INV_TWO_TO_FIFTEEN * _PI;

class FRotator extends FConstructable {
    public pitch: number;
    public yaw: number;
    public roll: number;

    public constructor(pitch = 0, yaw = 0, roll = 0) {
        super();

        this.pitch = pitch;
        this.yaw = yaw;
        this.roll = roll;
    }

    public load(pkg: UPackage): this {
        const int32 = new BufferValue(BufferValue.int32);

        for (let key of ["pitch", "yaw", "roll"])
            this[key as ("pitch" | "yaw" | "roll")] = pkg.read(int32).value as number;

        return this;
    }

    public getEulerElements(): EulerArr {
        const yAxis = (-this.yaw * _INV_TWO_TO_FIFTEEN_TIMES_PI) % _TWO_PI;
        const xAxis = (_TWO_PI - this.roll * _INV_TWO_TO_FIFTEEN_TIMES_PI) % _TWO_PI;
        const zAxis = (_TWO_PI + this.pitch * _INV_TWO_TO_FIFTEEN_TIMES_PI) % _TWO_PI;

        return [xAxis, yAxis, zAxis, "XYZ"];
    }
}

export default FRotator;
export { FRotator };
