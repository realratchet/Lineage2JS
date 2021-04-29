import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { Vector2 } from "three";
import BufferValue from "../buffer-value";

class FRangeVector extends FConstructable {
    public static readonly typeSize: number = 1;

    public x: Vector2 = new Vector2();
    public y: Vector2 = new Vector2();
    public z: Vector2 = new Vector2();

    public async load(pkg: UPackage): Promise<this> {
        const f = new BufferValue(BufferValue.float);

        ["x", "y"].forEach((r: "x" | "y") => {
            [this.x, this.y, this.z].forEach(ax => {
                ax[r] = pkg.read(f).value as number;
            });
        });

        return this;
    }
}

export default FRangeVector;
export { FRangeVector };