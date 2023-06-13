import UObject from "@l2js/core";

class UPointRegion extends UObject {
    declare protected zone: GA.FZoneInfo;
    declare protected indexLeaf: number;
    declare protected zoneNumber: number;

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