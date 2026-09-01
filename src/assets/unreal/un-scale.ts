import UObject from "./un-object";
import type { FVector } from "./un-vector";

abstract class FScale extends UObject {
    public static readonly plainStructFields = true; // values live in fields, not propertyDict (see UObject.loadNative)

    declare public readonly scale: FVector;

    declare public readonly sheerRate: number;
    declare public readonly sheerAxis: ESheerAxis_T;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Scale": "scale",
            "SheerRate": "sheerRate",
            "SheerAxis": "sheerAxis"
        });
    }

    public constructor(scale?: FVector, sheerRate?: number, sheerAxis?: ESheerAxis_T) {
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
