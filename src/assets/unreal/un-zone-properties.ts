import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";

class FZoneProperties extends FConstructable {
    public connectivity: BigInt;
    public visibility: BigInt;
    public lastRenderTime: number;
    public index: number;

    public load(pkg: UPackage): this {
        const uint64 = new BufferValue(BufferValue.uint64);
        const float = new BufferValue(BufferValue.float);
        
        this.index = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        this.connectivity = pkg.read(uint64).value as BigInt;
        this.visibility = pkg.read(uint64).value as BigInt;
        this.lastRenderTime = pkg.read(float).value as number;

        return this;
    }

}

export default FZoneProperties;
export { FZoneProperties };