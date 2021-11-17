import FConstructable from "./un-constructable";
import { Vector3, Box3 } from "three";
import BufferValue from "../buffer-value";

type UPackage = import("./un-package").UPackage;

class FBox extends FConstructable {
    public static readonly typeSize = 13;

    public readonly box: Box3 = new Box3();
    public readonly min: Vector3 = this.box.min;
    public readonly max: Vector3 = this.box.max;
    public isValid: boolean;

    public async load(pkg: UPackage): Promise<this> {
        const f = new BufferValue(BufferValue.float);
        const b = new BufferValue(BufferValue.int8);

        for (let vec of [this.min, this.max]) {
            for (let ax of ["x", "y", "z"]) {
                vec[ax as "x" | "y" | "z"] = await pkg.read(f).value as number;
            }
        }

        this.isValid = (pkg.read(b).value as number) !== 0;

        return this;
    }
}

export default FBox;
export { FBox };