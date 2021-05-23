import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import { Vector3 } from "three";
import BufferValue from "../buffer-value";

class FVector extends FConstructable {
    public static readonly typeSize = 12;
    public readonly vector = new Vector3();

    public async load(pkg: UPackage): Promise<this> {
        const f = new BufferValue(BufferValue.float);

        ["x", "y", "z"].forEach((ax: "x" | "y" | "z") => {
            this.vector[ax] = pkg.read(f).value as number;
        });

        return this;
    }
}

export default FVector;
export { FVector };