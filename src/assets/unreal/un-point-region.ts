import UObject from "@l2js/core";

abstract class UPointRegion extends UObject {
    declare protected readonly zone: GA.FZoneInfo;
    declare protected readonly indexLeaf: number;
    declare protected readonly zoneNumber: number;

    public getZone() { return this.zone; }
    public getZoneNumber() { return this.zoneNumber; }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Zone": "zone",
            "iLeaf": "indexLeaf",
            "ZoneNumber": "zoneNumber"
        });
    }

    public toString(...args: any): string;
    public toString(): string {
        return `PointRegion(Zone=${this.zone?.toString()}, iLeaf=${this.indexLeaf}, ZoneNumber=${this.zoneNumber})`;
    }
}

export default UPointRegion;
export { UPointRegion };