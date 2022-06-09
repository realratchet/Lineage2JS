import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";

class FLeaf extends FConstructable {
    public iZone: number;
    public iPermeating: number;
    public iVolumetric: number;
    public visibleZones: BigInt;

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const int64 = new BufferValue(BufferValue.int64);

        this.iZone = pkg.read(compat32).value as number;
        this.iPermeating = pkg.read(compat32).value as number;
        this.iVolumetric = pkg.read(compat32).value as number;
        this.visibleZones = pkg.read(int64).value as BigInt;

        return this;
    }
}

export default FLeaf;
export { FLeaf };