import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";

class FColor extends FConstructable {
    public r: number = 0;
    public g: number = 0;
    public b: number = 0;
    public a: number = 0;

    public load(pkg: UPackage): this {
        const b = new BufferValue(BufferValue.uint8);

        for (let ax of ["b", "g", "r", "a"])
            this[ax as ("r" | "g" | "b" | "a")] = pkg.read(b).value as number;

        return this;
    }

    toArray(array: number[] | ArrayLike<number> = [], offset = 0) {

        (array as number[])[offset] = this.r;
        (array as number[])[offset + 1] = this.g;
        (array as number[])[offset + 2] = this.b;
        (array as number[])[offset + 3] = this.a;

        return array;
    }
}

export default FColor;
export { FColor };