import { UObject } from "@l2js/core";


class FBox extends UObject {
    declare ["constructor"]: typeof FBox;

    declare public readonly min: GA.FVector;
    declare public readonly max: GA.FVector;

    declare public isValid: 0 | 1;

    public getSize() { return !this.isValid ? new (this.max.constructor)() : this.max.sub(this.min); }
    public getCenter() { return !this.isValid ? new (this.max.constructor)() : this.max.add(this.min).multiplyScalar(0.5); }

    public constructor(min?: GA.FVector, max?: GA.FVector) {
        super();

        this.min = min || this.min;
        this.max = max || this.max;
        this.isValid = 0;
    }

    public expandByPoint(point: GA.FVector) {
        if (!this.isValid) {
            this.min.set(Infinity, Infinity, Infinity);
            this.max.set(-Infinity, -Infinity, -Infinity);
        }

        for (let ax of ["x", "y", "z"]) {
            this.min[ax as "x" | "y" | "z"] = Math.min(this.min[ax as "x" | "y" | "z"], point[ax as "x" | "y" | "z"]);
            this.max[ax as "x" | "y" | "z"] = Math.max(this.max[ax as "x" | "y" | "z"], point[ax as "x" | "y" | "z"]);
        }

        this.isValid = 1;

        return this;
    }

    public getDecodeInfo(): GD.IBoxDecodeInfo {
        return {
            isValid: this.isValid,
            min: this.min.getVectorElements(),
            max: this.max.getVectorElements()
        };
    }

    public getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Min": "min",
            "Max": "max",
            "IsValid": "isValid"
        });
    }
}

export default FBox;
export { FBox };