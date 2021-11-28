import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";
import FVector from "./un-vector";

class FBox extends FConstructable {
    public static readonly typeSize = 13;

    public readonly min: FVector = new FVector();
    public readonly max: FVector = new FVector();
    public isValid: boolean = false;

    public load(pkg: UPackage): this {
        const f = new BufferValue(BufferValue.float);
        const b = new BufferValue(BufferValue.int8);

        for (let vec of [this.min, this.max]) {
            for (let ax of ["x", "y", "z"]) {
                vec[ax as "x" | "y" | "z"] = pkg.read(f).value as number;
            }
        }

        this.isValid = (pkg.read(b).value as number) !== 0;

        return this;
    }
}

export default FBox;
export { FBox };