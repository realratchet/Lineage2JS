import { BufferValue, type APackage, type Constructable_T } from "@l2js/core";
import type { FZoneInfo } from "./un-zone-info";
import type { ULevelInfo } from "./un-level-info";
import type { DecodeLibrary } from "./decode-library";

class FZoneProperties implements Constructable_T {
    public connectivity: bigint;
    public visibility: bigint;
    public lastRenderTime: number;
    public zoneActorId: number;
    public zoneActor: FZoneInfo;

    public load(pkg: APackage): this {
        this.zoneActorId = pkg.read("compat32");
        this.connectivity = pkg.read("uint64");
        this.visibility = pkg.read("uint64");
        this.lastRenderTime = pkg.read("float");

        if (this.zoneActorId > 0)  // Lineage2 breaks the rule that ULevelInfo must be first export
            this.zoneActor = pkg.fetchObject<FZoneInfo>(this.zoneActorId).loadSelf();

        return this;
    }

    public getDecodeInfo(library: DecodeLibrary, uLevelInfo: ULevelInfo): GD.IBSPZoneDecodeInfo_T {
        return {
            connectivity: this.connectivity,
            visibility: this.visibility,
            zoneInfo: (this.zoneActorId === 0 ? uLevelInfo : this.zoneActor).getDecodeInfo(library)
        };
    }
}

export default FZoneProperties;
export { FZoneProperties };
