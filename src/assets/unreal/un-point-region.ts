import UObject from "./un-object";

class UPointRegion extends UObject {
    protected zone: UZoneInfo;
    protected indexLeaf: number;
    protected zoneNumber: number;

    public getZone() { return this.zone; }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Zone": "zone",
            "iLeaf": "indexLeaf",
            "ZoneNumber": "zoneNumber"
        });
    }

    public preLoad(pkg: UPackage, tag: any) {
        // debugger;
        this.readHead = this.readStart = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;
    }



    // protected postLoad(pkg: UPackage, exp: UExport<UObject>): void {
    //     super.postLoad(pkg, exp);

    //     Promise.all(this.promisesLoading).then(z => {
    //         const self = this;

    //         debugger;
    //     });
    // }
}

export default UPointRegion;
export { UPointRegion };