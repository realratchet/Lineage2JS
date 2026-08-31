import type { APackage, Constructable_T } from "@l2js/core";
class FLeaf implements Constructable_T {
    public iZone: number;
    public iPermeating: number;
    public iVolumetric: number;
    public visibleZones: bigint;
    public musicId?: number;

    public load(pkg: APackage): this {
        this.iZone = pkg.read("compat32");
        this.iPermeating = pkg.read("compat32");
        this.iVolumetric = pkg.read("compat32");
        this.visibleZones = pkg.read("uint64");

        return this;
    }

    public getDecodeInfo(): GD.IBSPLeafDecodeInfo_T {
        return {
            zone: this.iZone,
            permiating: this.iPermeating,
            volumetric: this.iVolumetric,
            visibleZones: this.visibleZones,
            musicId: this.musicId
        };
    }
}

export default FLeaf;
export { FLeaf };
