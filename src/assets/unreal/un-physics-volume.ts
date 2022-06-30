
import UBrush from "./un-brush";
import UExport from "./un-export";
import UObject from "./un-object";
import UPackage from "./un-package";

class UPhysicsVolume extends UBrush {
    protected readHeadOffset = 17;

    protected priority: number;
    protected locationName: number;
    protected isNoDelete: boolean;
    protected colLocation: FVector;
    protected nextPhysicsVolume: UPhysicsVolume;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Priority": "priority",
            "LocationName": "locationName",
            "bNoDelete": "isNoDelete",
            "ColLocation": "colLocation",
            "NextPhysicsVolume": "nextPhysicsVolume",
        });
    }

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.onLoaded().then(() => {
            if (this.brush)
                debugger;
        });
    }
}

export default UPhysicsVolume;
export { UPhysicsVolume };