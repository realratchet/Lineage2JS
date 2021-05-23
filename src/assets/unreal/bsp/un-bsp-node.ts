import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import { Plane } from "three";
import BufferValue from "../../buffer-value";

class FBSPNode extends FConstructable {
    public static readonly typeSize = 1;
    protected readonly plane = new Plane();
    protected zoneMask: number;

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        const float = new BufferValue(BufferValue.float);
        const uint64 = new BufferValue(BufferValue.uint64);

        ["x", "y", "z"].forEach((ax: "x" | "y" | "z") => {
            this.plane.normal[ax] = pkg.read(float).value as number;
        });

        this.plane.constant = pkg.read(float).value as number;

        this.zoneMask = pkg.read(uint64).value as number;

        return this;
    }

}

export default FBSPNode;
export { FBSPNode };