import FVector from "./un-vector";
import { BufferValue, UObject } from "@l2js/core";

class FBox extends UObject {
    declare public readonly min: FVector;
    declare public readonly max: FVector;

    declare public isValid: boolean;

    // public load(pkg: C.APackage): this {
    //     const b = new BufferValue(BufferValue.int8);

    //     this.min.load(pkg);
    //     this.max.load(pkg);

    //     this.isValid = (pkg.read(b).value as number) !== 0;

    //     return this;
    // }

    // public getSize() { return !this.isValid ? new FVector() : this.max.sub(this.min); }
    // public getCenter() { return !this.isValid ? new FVector() : this.max.add(this.min).multiplyScalar(0.5); }

    // public expandByPoint(point: FVector) {
    //     if (!this.isValid) {
    //         this.min.set(Infinity, Infinity, Infinity);
    //         this.max.set(-Infinity, -Infinity, -Infinity);
    //     }

    //     for (let ax of ["x", "y", "z"]) {
    //         this.min[ax as "x" | "y" | "z"] = Math.min(this.min[ax as "x" | "y" | "z"], point[ax as "x" | "y" | "z"]);
    //         this.max[ax as "x" | "y" | "z"] = Math.max(this.max[ax as "x" | "y" | "z"], point[ax as "x" | "y" | "z"]);
    //     }

    //     this.isValid = true;

    //     return this;
    // }

    // public getDecodeInfo(): IBoxDecodeInfo {
    //     return {
    //         isValid: this.isValid,
    //         min: this.min.getVectorElements(),
    //         max: this.max.getVectorElements()
    //     };
    // }

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