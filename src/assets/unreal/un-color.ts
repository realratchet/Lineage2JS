import { UObject } from "@l2js/core";

abstract class FColor extends UObject {
    declare public ["constructor"]: typeof FColor;

    declare public r: number;
    declare public g: number;
    declare public b: number;
    declare public a: number;

    public constructor(r = 0, g = 0, b = 0, a = 0) {
        super();

        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "R": "r",
            "G": "g",
            "B": "b",
            "A": "a",
        });
    }

    getBrightness() { return (this.g * 3.0 + this.b + this.b + this.r) * 0.0006510417; }

    toArray(array: number[] | ArrayLike<number> | GD.ColorArr = [], offset = 0) {
        (array as number[])[offset] = this.r;
        (array as number[])[offset + 1] = this.g;
        (array as number[])[offset + 2] = this.b;
        (array as number[])[offset + 3] = this.a;

        return array;
    }

    public toString() { return `Color=(r=${this.r.toFixed(2)}, g=${this.g.toFixed(2)}, b=${this.b.toFixed(2)}, a=${this.a.toFixed(2)})` }
}

export default FColor;
export { FColor };