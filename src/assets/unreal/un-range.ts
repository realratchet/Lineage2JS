import { FConstructable } from "./un-constructable";
import UPackage from "./un-package";
import { Vector2 } from "three";
import BufferValue from "../buffer-value";

class FRangeVector extends FConstructable {
    public static readonly typeSize: number = 1;

    protected x: Vector2 = new Vector2();
    protected y: Vector2 = new Vector2();
    protected z: Vector2 = new Vector2();

    public async load(pkg: UPackage): Promise<this> {
        const f = new BufferValue(BufferValue.float);

        ["x", "y"].forEach((r: "x" | "y") => {
            ["x", "y", "z"].forEach((ax: "x" | "y" | "z") => {
                this[ax][r] = pkg.read(f).value as number;
            });
        });

        return this;
    }
}

export default FRangeVector;
export { FRangeVector };