import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import { Vector3, Euler } from "three";
import BufferValue from "../buffer-value";

class FRotator extends FConstructable {
    public static readonly typeSize = 12;
    public pitch = 0;
    public yaw = 0;
    public roll = 0;

    public load(pkg: UPackage): this {
        const int32 = new BufferValue(BufferValue.int32);

        for (let key of ["pitch", "yaw", "roll"])
            this[key as ("pitch" | "yaw" | "roll")] = pkg.read(int32).value as number;


        return this;
    }

    public getEuler(output: Euler): Euler {
        const _PI = Math.PI;
        const yAxis = (-this.yaw / 32768. * _PI) % (_PI * 2);
        const xAxis = (2 * _PI - this.roll / 32768. * _PI) % (_PI * 2);
        const zAxis = (2 * _PI - this.pitch / 32768. * _PI) % (_PI * 2);

        return output.set(xAxis, yAxis, zAxis, "XYZ");
    }
}

export default FRotator;
export { FRotator };
