import UBrush from "./un-brush";
import { FPrimitiveArray } from "./un-array";
import BufferValue from "../buffer-value";

class UWaterVolume extends UBrush {
    protected readHeadOffset = 17;

    protected colLocation: FVector;
    protected nextPhysicsVolume: UPhysicsVolume;
    protected touching: FPrimitiveArray = new FPrimitiveArray(BufferValue.int16);
    protected locationName: string;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "ColLocation": "colLocation",
            "NextPhysicsVolume": "nextPhysicsVolume",
            "Touching": "touching",
            "LocationName": "locationName"
        });
    }

}

export default UWaterVolume;
export { UWaterVolume };