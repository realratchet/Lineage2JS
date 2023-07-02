import UObject from "@l2js/core";

abstract class FTIntMap extends UObject {
    declare public readonly time: number;
    declare public readonly intensity: C.FPrimitiveArray<"uint8">;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Time": "time",
            "Intensity": "intensity"
        });
    }
}

export default FTIntMap;
export { FTIntMap };