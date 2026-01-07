import UObject from "@l2js/core";

abstract class UPointRegion extends UObject {
    declare protected readonly zone: GA.FZoneInfo;
    declare protected readonly indexLeaf: number;
    declare protected readonly zoneNumber: number;

    public getZone() { return this.zone; }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Zone": "zone",
            "iLeaf": "indexLeaf",
            "ZoneNumber": "zoneNumber"
        });
    }
}

export default UPointRegion;
export { UPointRegion };