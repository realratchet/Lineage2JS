import UObject from "./un-object";

class UPointRegion extends UObject {
    protected zone: UZoneInfo;
    protected indexLeaf: number;
    protected zoneNumber: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Zone": "zone",
            "iLeaf": "indexLeaf",
            "ZoneNumber": "zoneNumber"
        });
    }

    public preLoad(pkg: UPackage, tag: any) {
        this.readHead = this.readStart = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;
    }
}

export default UPointRegion;
export { UPointRegion };