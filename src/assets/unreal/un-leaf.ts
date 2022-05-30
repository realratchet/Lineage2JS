import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";
import { PropertyTag } from "./un-property";

type UPackage = import("./un-package").UPackage;

class FLeaf extends FConstructable {
    public iZone: number;
    public iPermeating: number;
    public iVolumetric: number;
    public visibleZones: BigInt;

    public load(pkg: UPackage, tag?: PropertyTag): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint64 = new BufferValue(BufferValue.uint64);

        this.iZone = pkg.read(compat32).value as number;
        this.iPermeating = pkg.read(compat32).value as number;
        this.iVolumetric = pkg.read(compat32).value as number;
        this.visibleZones = pkg.read(uint64).value as BigInt;

        return this;
    }
}

export default FLeaf;
export { FLeaf };