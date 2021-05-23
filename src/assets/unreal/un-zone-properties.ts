import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import BufferValue from "../buffer-value";

class FZoneProperties extends FConstructable {

    public static readonly typeSize = 16;

    public connectivity: BigInt;
    public visibility: BigInt;

    public async load(pkg: UPackage): Promise<this> {
        const uint64 = new BufferValue(BufferValue.uint64);
        const index = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        
        this.connectivity = pkg.read(uint64).value as BigInt;
        this.visibility = pkg.read(uint64).value as BigInt;

        return this;
    }

}

export default FZoneProperties;
export { FZoneProperties };