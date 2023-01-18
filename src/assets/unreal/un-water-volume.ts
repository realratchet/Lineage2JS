import UBrush from "./un-brush";
import FArray from "./un-array";
import BufferValue from "../buffer-value";
import FNumber from "./un-number";
import UPhysicsVolume from "./un-physics-volume";

class UWaterVolume extends UPhysicsVolume {
    // protected colLocation: FVector;
    // protected nextPhysicsVolume: UPhysicsVolume;
    // protected touching: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);
    // protected locationName: string;

    // protected useDistanceFogColor: boolean;
    // protected useCellophane: boolean;

    // protected getPropertyMap() {
    //     return Object.assign({}, super.getPropertyMap(), {
    //         "ColLocation": "colLocation",
    //         "NextPhysicsVolume": "nextPhysicsVolume",
    //         "Touching": "touching",
    //         "LocationName": "locationName",
    //         "bUseDistanceFogColor": "useDistanceFogColor",
    //         "bUseCellophane": "useCellophane"
    //     });
    // }

}

export default UWaterVolume;
export { UWaterVolume };