import FConstructable from "./un-constructable";
import { BufferValue } from "@l2js/core";

class FZoneProperties extends FConstructable {
    public connectivity: bigint;
    public visibility: bigint;
    public lastRenderTime: number;
    public zoneIndex: number;
    public zone: IInfo;

    public load(pkg: UPackage): this {
        const uint64 = new BufferValue(BufferValue.uint64);
        const float = new BufferValue(BufferValue.float);

        this.zoneIndex = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        this.connectivity = pkg.read(uint64).value as bigint;
        this.visibility = pkg.read(uint64).value as bigint;
        this.lastRenderTime = pkg.read(float).value as number;

        if (this.zoneIndex > 0)  // Lineage2 breaks the rule that ULevelInfo must be first export
            this.zone = pkg.fetchObject(this.zoneIndex).loadSelf() as any as IInfo;

        return this;
    }

    public getDecodeInfo(library: DecodeLibrary, uLevelInfo: ULevelInfo): IBSPZoneDecodeInfo_T {
        return {
            connectivity: this.connectivity,
            visibility: this.visibility,
            zoneInfo: (this.zoneIndex === 0 ? uLevelInfo : this.zone).getDecodeInfo(library)
        };
    }
}

export default FZoneProperties;
export { FZoneProperties };