import { BufferValue, type APackage, type Constructable_T } from "@l2js/core";

class FZoneProperties implements Constructable_T {
    public connectivity: bigint;
    public visibility: bigint;
    public lastRenderTime: number;
    public zoneActorId: number;
    public zoneActor: GA.FZoneInfo;

    public load(pkg: APackage): this {
        this.zoneActorId = pkg.read("compat32");
        this.connectivity = pkg.read("uint64");
        this.visibility = pkg.read("uint64");
        this.lastRenderTime = pkg.read("float");

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
