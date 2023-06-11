import { BufferValue } from "@l2js/core";

class FZoneProperties implements C.IConstructable {
    public connectivity: bigint;
    public visibility: bigint;
    public lastRenderTime: number;
    public zoneIndex: number;
    public zone: GA.AInfo;

    public load(pkg: GA.UPackage): this {
        const uint64 = new BufferValue(BufferValue.uint64);
        const float = new BufferValue(BufferValue.float);

        this.zoneIndex = pkg.read(new BufferValue(BufferValue.compat32)).value;
        this.connectivity = pkg.read(uint64).value
        this.visibility = pkg.read(uint64).value
        this.lastRenderTime = pkg.read(float).value;

        if (this.zoneIndex > 0)  // Lineage2 breaks the rule that ULevelInfo must be first export
            this.zone = pkg.fetchObject<GA.AInfo>(this.zoneIndex).loadSelf();

        return this;
    }

    public getDecodeInfo(library: GD.DecodeLibrary, uLevelInfo: GA.ULevelInfo): IBSPZoneDecodeInfo_T {
        return {
            connectivity: this.connectivity,
            visibility: this.visibility,
            zoneInfo: (this.zoneIndex === 0 ? uLevelInfo : this.zone).getDecodeInfo(library)
        };
    }
}

export default FZoneProperties;
export { FZoneProperties };