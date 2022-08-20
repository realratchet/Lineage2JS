import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";

class FLeaf extends FConstructable {
    public iZone: number;
    public iPermeating: number;
    public iVolumetric: number;
    public visibleZones: BigInt;
    
    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint64 = new BufferValue(BufferValue.uint64);
        
        this.iZone = pkg.read(compat32).value as number;
        this.iPermeating = pkg.read(compat32).value as number;
        this.iVolumetric = pkg.read(compat32).value as number;
        this.visibleZones = pkg.read(uint64).value as BigInt;
        
        return this;
    }
    
    public getDecodeInfo(): IBSPLeafDecodeInfo_T {
        return {
            zone: this.iZone,
            permiating: this.iPermeating,
            volumetric: this.iVolumetric,
            visibleZones: this.visibleZones
        };
    }
}

export default FLeaf;
export { FLeaf };