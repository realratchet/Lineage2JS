import { UObject } from "@l2js/core";

abstract class FScale extends UObject {
    declare public readonly scale: GA.FVector;

    declare public readonly sheerRate: number;
    declare public readonly sheerAxis: ESheerAxis_T;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Scale": "scale",
            "SheerRate": "sheerRate",
            "SheerAxis": "sheerAxis"
        });
    }

    public constructor(scale?: GA.FVector, sheerRate?: number, sheerAxis?: ESheerAxis_T) {
        super();

        this.scale = scale || this.scale;
        this.sheerRate = sheerRate || this.sheerRate;
        this.sheerAxis = sheerAxis || this.sheerAxis;
    }
}

enum ESheerAxis_T {
    SHEER_None = 0,
    SHEER_XY = 1,
    SHEER_XZ = 2,
    SHEER_YX = 3,
    SHEER_YZ = 4,
    SHEER_ZX = 5,
    SHEER_ZY = 6,
};

export default FScale;
export { FScale, ESheerAxis_T };

