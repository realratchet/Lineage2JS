import { UObject } from "@l2js/core";

class FScale extends UObject {
    declare public x: number;
    declare public y: number;
    declare public z: number;

    declare public sheerRate: number;
    declare public sheerAxis: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "X": "x",
            "Y": "y",
            "Z": "z",
            "SheerRate": "sheerRate",
            "SheerAxis": "sheerAxis"
        });
    }
}

export default FScale;
export { FScale };