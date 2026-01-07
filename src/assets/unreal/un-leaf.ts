class FLeaf implements C.IConstructable {
    public iZone: number;
    public iPermeating: number;
    public iVolumetric: number;
    public visibleZones: bigint;

    public load(pkg: C.APackage): this {
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
            visibleZones: this.visibleZones
        };
    }
}

export default FLeaf;
export { FLeaf };