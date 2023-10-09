import { BufferValue } from "@l2js/core";

class FZoneProperties implements C.IConstructable {
    public connectivity: bigint;
    public visibility: bigint;
    public lastRenderTime: number;
    public zoneActorId: number;
    public zoneActor: GA.FZoneInfo;

    public load(pkg: GA.UPackage): this {
        const uint64 = new BufferValue(BufferValue.uint64);
        const float = new BufferValue(BufferValue.float);

        this.zoneActorId = pkg.read(new BufferValue(BufferValue.compat32)).value;
        this.connectivity = pkg.read(uint64).value
        this.visibility = pkg.read(uint64).value
        this.lastRenderTime = pkg.read(float).value;

        if (this.zoneActorId > 0)  // Lineage2 breaks the rule that ULevelInfo must be first export
            this.zoneActor = pkg.fetchObject<GA.FZoneInfo>(this.zoneActorId).loadSelf();

        return this;
    }

    public getDecodeInfo(library: GD.DecodeLibrary, uLevelInfo: GA.ULevelInfo): GD.IBSPZoneDecodeInfo_T {
        return {
            connectivity: this.connectivity,
            visibility: this.visibility,
            zoneInfo: (this.zoneActorId === 0 ? uLevelInfo : this.zoneActor).getDecodeInfo(library)
        };
    }
}

export default FZoneProperties;
export { FZoneProperties };