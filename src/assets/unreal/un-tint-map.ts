import UObject from "@l2js/core";

class FTIntMap extends UObject {
    declare public time: number;
    declare public intensity: C.FPrimitiveArray<"uint8">;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Time": "time",
            "Intensity": "intensity"
        });
    }
}

export default FTIntMap;
export { FTIntMap };