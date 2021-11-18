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

    public async load(pkg: UPackage): Promise<this> {
        const int32 = new BufferValue(BufferValue.int32);

        // debugger;

        for (let key of ["pitch", "yaw", "roll"]) {
            this[key as ("pitch" | "yaw" | "roll")] = await pkg.read(int32).value as number;
        }

        // if (this.pitch !== 0 || this.yaw !== 0 || this.roll !== 0) debugger;

        return this;
    }

    public getEuler(output: Euler): Euler {
        const _PI = Math.PI;
        const yAxis = (-this.yaw / 32768. * _PI) % (_PI * 2);
        const xAxis = (2 * _PI - this.roll / 32768. * _PI) % (_PI * 2);
        const zAxis = (2 * _PI - this.pitch / 32768. * _PI) % (_PI * 2);

        // if (zAxis !== 0 || xAxis !== 0 || yAxis !== 0) debugger;

        return output.set(xAxis, yAxis, zAxis, "XZY");
    }
}

export default FRotator;
export { FRotator };
