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

    public load(pkg: UPackage, tag: PropertyTag): this {

        this.readHead = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;

        this.readNamedProps(pkg);

        return this;
    }
}

export default UPointRegion;
export { UPointRegion };