import { BufferValue } from "@l2js/core";

const compat32 = new BufferValue(BufferValue.compat32);
const uint64 = new BufferValue(BufferValue.uint64);

class FLeaf implements C.IConstructable {
    public iZone: number;
    public iPermeating: number;
    public iVolumetric: number;
    public visibleZones: bigint;

    public load(pkg: C.APackage): this {
        this.iZone = pkg.read(compat32).value;
        this.iPermeating = pkg.read(compat32).value;
        this.iVolumetric = pkg.read(compat32).value;
        this.visibleZones = pkg.read(uint64).value;

        return this;
    }

    public getDecodeInfo(): GD.IBSPLeafDecodeInfo_T {
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