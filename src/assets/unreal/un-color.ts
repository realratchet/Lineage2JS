import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";

class FColor extends FConstructable {
    public static readonly typeSize: number = 4;

    public r: number = 0;
    public g: number = 0;
    public b: number = 0;
    public a: number = 0;

    public load(pkg: UPackage, tag: PropertyTag): this {
        const b = new BufferValue(BufferValue.uint8);

        for (let ax of ["b", "g", "r", "a"])
            this[ax as ("r" | "g" | "b" | "a")] = pkg.read(b).value as number;

        return this;
    }
}

export default FColor;
export { FColor };