
import UBrush from "./un-brush";

class UPhysicsVolume extends UBrush { 
    protected readHeadOffset = 17;

    protected priority: number;
    protected locationName: number;
    protected isNoDelete: boolean;
    protected isDeleteMe: boolean;
    protected isPendingDelete: boolean;
    protected colLocation: FVector;
    protected nextPhysicsVolume: UPhysicsVolume;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Priority": "priority",
            "LocationName": "locationName",
            "bNoDelete": "isNoDelete",
            "bDeleteMe": "isDeleteMe",
            "bPendingDelete": "isPendingDelete",
            "ColLocation": "colLocation",
            "NextPhysicsVolume": "nextPhysicsVolume"
        });
    }
}

export default UPhysicsVolume;
export { UPhysicsVolume };