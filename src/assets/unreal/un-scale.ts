import { UObject } from "@l2js/core";

abstract class FScale extends UObject {
    declare public readonly scale: GA.FVector;

    declare public readonly sheerRate: number;
    declare public readonly sheerAxis: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Scale": "scale",
            "SheerRate": "sheerRate",
            "SheerAxis": "sheerAxis"
        });
    }
}

export default FScale;
export { FScale };