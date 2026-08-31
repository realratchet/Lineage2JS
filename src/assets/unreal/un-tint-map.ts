import { UObject, type FPrimitiveArray } from "@l2js/core";

abstract class FTIntMap extends UObject {
    declare public readonly time: number;
    declare public readonly intensity: FPrimitiveArray<"uint8">;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Time": "time",
            "Intensity": "intensity"
        });
    }
}

export default FTIntMap;
export { FTIntMap };
