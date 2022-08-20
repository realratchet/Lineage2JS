import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";

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

        if (this.zoneIndex > 0) { // Lineage2 breaks the rule that ULevelInfo must be first export
            this.promisesLoading.push(new Promise<void>(async resolve => {
                this.zone = await pkg.fetchObject(this.zoneIndex) as any as IInfo;

                resolve();
            }));
        }

        return this;
    }

    public async getDecodeInfo(library: DecodeLibrary, uLevelInfo: ULevelInfo): Promise<IBSPZoneDecodeInfo_T> {
        await Promise.all(this.promisesLoading);

        return {
            connectivity: this.connectivity,
            visibility: this.visibility,
            zoneInfo: await (this.zoneIndex === 0 ? uLevelInfo : this.zone).getDecodeInfo(library)
        };
    }
}

export default FZoneProperties;
export { FZoneProperties };