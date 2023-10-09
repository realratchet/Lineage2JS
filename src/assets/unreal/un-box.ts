import FVector from "@client/assets/unreal/un-vector";
import { UObject } from "@l2js/core";


abstract class FBox extends UObject {
    declare ["constructor"]: typeof FBox;

    declare public readonly min: GA.FVector;
    declare public readonly max: GA.FVector;

    declare public isValid: 0 | 1;

    public getSize() { return !this.isValid ? FVector.make() : this.max.sub(this.min); }
    public getCenter() { return !this.isValid ? FVector.make() : this.max.add(this.min).multiplyScalar(0.5); }
    public getExtents() { return !this.isValid ? FVector.make() : this.max.sub(this.min).multiplyScalar(0.5); }

    public constructor(min?: GA.FVector, max?: GA.FVector, isValid?: 0 | 1) {
        super();

        this.min = min ?? this.min ?? FVector.make();
        this.max = max ?? this.max ?? FVector.make();
        this.isValid = isValid ?? this.isValid ?? 0;
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

    public get 0() { return this.min; }
    public get 1() { return this.max; }
    public getExtrema(val: 0 | 1) { return this[val]; }

    public toString() {
        return `Box=(min=${this.min}, max=${this.max}, valid=${this.isValid ? "true" : "false"}, size=${this.getSize()})`;
    }

    public add(other: FVector): FBox {
        if (this.isValid) {
            const minx = Math.min(this.min.x, other.x);
            const miny = Math.min(this.min.y, other.y);
            const minz = Math.min(this.max.y, other.z);

            const maxx = Math.max(this.max.x, other.x);
            const maxy = Math.max(this.max.y, other.y);
            const maxz = Math.max(this.max.y, other.z);

            const min = FVector.make(minx, miny, minz);
            const max = FVector.make(maxx, maxy, maxz);

            return FBox.make(min, max, 1);
        }

        return FBox.make(other, other, 1);
    }

    public transformBy(matrix: GA.FMatrix): FBox {
        let bbox = FBox.make();

        for (let x: 0 | 1 = 0; x < 2; x++) {
            const ex = this.getExtrema(x as 0 | 1);

            for (let y: 0 | 1 = 0; y < 2; y++) {
                const ey = this.getExtrema(y as 0 | 1);

                for (let z: 0 | 1 = 0; z < 2; z++) {
                    const ez = this.getExtrema(z as 0 | 1);
                    const vec = FVector.make(ex.x, ey.y, ez.z);
                    const trans = matrix.transformVector(vec);

                    bbox = bbox.add(trans);
                }
            }
        }

        return bbox;
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