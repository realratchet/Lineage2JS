import UObject from "./un-object";

type UPackage = import("./un-package").UPackage;
type UZoneInfo = import("./un-zone-info").UZoneInfo;

class UPointRegion extends UObject {

    protected size: number;
    protected zone: UZoneInfo;
    protected indexLeaf: number;
    protected zoneNumber: number;

    public constructor(size: number) {
        super();

        this.size = size;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Zone": "zone",
            "iLeaf": "indexLeaf",
            "ZoneNumber": "zoneNumber"
        });
    }

    public async load(pkg: UPackage): Promise<this> {

        this.readHead = pkg.tell();
        this.readTail = this.readHead + this.size;

        await this.readNamedProps(pkg);

        return this;
    }
}

export default UPointRegion;
export { UPointRegion };