import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";
import { PropertyTag } from "./un-property";

type UPackage = import("./un-package").UPackage;

class FLeaf extends FConstructable {
    public static readonly typeSize: number = -1;

    public iZone: number;
    public iPermeating: number;
    public iVolumetric: number;
    public visibleZones: BigInt;

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint64 = new BufferValue(BufferValue.uint64);

        this.iZone = await pkg.read(compat32).value as number;
        this.iPermeating = await pkg.read(compat32).value as number;
        this.iVolumetric = await pkg.read(compat32).value as number;
        this.visibleZones = await pkg.read(uint64).value as BigInt;

        return this;
    }
}

export default FLeaf;
export { FLeaf };