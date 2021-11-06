import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import BufferValue from "../buffer-value";

class FPlane extends FConstructable {
    public static readonly typeSize: number = 16;

    public x: number;
    public y: number;
    public z: number;
    public w: number;

    public async load(pkg: UPackage): Promise<this> {
        const f = new BufferValue(BufferValue.float);

        ["x", "y", "z", "w"].forEach((ax: "x" | "y" | "z" | "w") => {
            this[ax] = pkg.read(f).value as number;
        });

        return this;
    }
}

export default FPlane;
export { FPlane };