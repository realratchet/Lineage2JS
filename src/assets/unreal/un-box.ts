import FConstructable from "./un-constructable";
import { Vector3 } from "three";
import BufferValue from "../buffer-value";

type PropertyTag = import("./un-property").PropertyTag;
type UPackage = import("./un-package").UPackage;


class UBox extends FConstructable {
    public min: Vector3 = new Vector3();
    public max: Vector3 = new Vector3();
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