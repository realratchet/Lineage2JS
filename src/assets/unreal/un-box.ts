import FConstructable from "./un-constructable";
import { BufferValue } from "@l2js/core";
import FVector from "./un-vector";

class FBox extends FConstructable {
    public readonly min: FVector = new FVector();
    public readonly max: FVector = new FVector();

    public isValid: boolean = false;

    public load(pkg: UPackage): this {
        const b = new BufferValue(BufferValue.int8);

        this.min.load(pkg);
        this.max.load(pkg);

        this.isValid = (pkg.read(b).value as number) !== 0;

        return this;
    }

    public getSize() { return !this.isValid ? new FVector() : this.max.sub(this.min); }
    public getCenter() { return !this.isValid ? new FVector() : this.max.add(this.min).multiplyScalar(0.5); }

    public expandByPoint(point: FVector) {
        if (!this.isValid) {
            this.min.set(Infinity, Infinity, Infinity);
            this.max.set(-Infinity, -Infinity, -Infinity);
        }

        for (let ax of ["x", "y", "z"]) {
            this.min[ax as "x" | "y" | "z"] = Math.min(this.min[ax as "x" | "y" | "z"], point[ax as "x" | "y" | "z"]);
            this.max[ax as "x" | "y" | "z"] = Math.max(this.max[ax as "x" | "y" | "z"], point[ax as "x" | "y" | "z"]);
        }

        this.isValid = true;

        return this;
    }

    public getDecodeInfo(): IBoxDecodeInfo {
        return {
            isValid: this.isValid,
            min: this.min.getVectorElements(),
            max: this.max.getVectorElements()
        };
    }
}

export default FBox;
export { FBox };