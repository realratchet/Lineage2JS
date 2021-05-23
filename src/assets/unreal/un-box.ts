import FConstructable from "./un-constructable";
import { Vector3, Box3 } from "three";
import BufferValue from "../buffer-value";

type UPackage = import("./un-package").UPackage;

class UBox extends FConstructable {
    public readonly box: Box3 = new Box3();
    public readonly min: Vector3 = this.box.min;
    public readonly max: Vector3 = this.box.max;
    public isValid: number;

    public async load(pkg: UPackage): Promise<this> {
        const f = new BufferValue(BufferValue.float);
        const b = new BufferValue(BufferValue.int8);

        [this.min, this.max].forEach(vec => {
            ["x", "y", "z"].forEach((ax: "x" | "y" | "z") => {
                vec[ax] = pkg.read(f).value as number;
            });
        });

        this.isValid = pkg.read(b).value as number;

        return this;
    }

}

export default UBox;
export { UBox };