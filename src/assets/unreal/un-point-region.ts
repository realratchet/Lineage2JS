import UObject from "./un-object";
import type { FZoneInfo } from "./un-zone-info";

export abstract class UPointRegion extends UObject {
    declare protected readonly zone: FZoneInfo;
    declare protected readonly indexLeaf: number;
    declare protected readonly zoneNumber: number;

    public getZone() { return this.zone; }
    public getLeaf() { return this.indexLeaf; }
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
