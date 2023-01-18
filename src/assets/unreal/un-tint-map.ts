import UObject from "./un-object";
import BufferValue from "../buffer-value";
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