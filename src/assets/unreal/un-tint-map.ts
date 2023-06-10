import { UObject } from "@l2js/core";
import { BufferValue } from "@l2js/core";
import { FPrimitiveArray } from "./un-array";

class FTIntMap extends UObject {
    public time: number;
    public intensity = new FPrimitiveArray(BufferValue.uint8);

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Time": "time",
            "Intensity": "intensity"
        });
    }
}

export default FTIntMap;
export { FTIntMap };