import { type FPrimitiveArray } from "@l2js/core";
import UObject from "./un-object";

export abstract class FTIntMap extends UObject {
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
