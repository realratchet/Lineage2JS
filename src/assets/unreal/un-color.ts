import { APackage, UExport, UObject } from "@l2js/core";

abstract class FColor extends UObject {
    declare public ["constructor"]: typeof FColor;

    public static readonly plainStructFields = true; // values live in fields, not propertyDict (see UObject.loadNative)

    declare public r: number;
    declare public g: number;
    declare public b: number;
    declare public a: number;

    public constructor(r = 0, g = 0, b = 0, a = 0) {
        super();

        this.set(r, g, b, a);
    }

    public set(r: number, g: number, b: number, a: number) {
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

    protected doLoad(pkg: APackage, exp: UExport): void {
        const bytes = pkg.read(4);

        this.b = bytes.getUint8(0);
        this.g = bytes.getUint8(1);
        this.r = bytes.getUint8(2);
        this.a = bytes.getUint8(3);

        this.readHead = pkg.tell();

        return super.doLoad(pkg, exp);
    }

    public static fromFloating(r: number, g: number, b: number, a?: number) {
        return FColor.make(
            Math.floor(Math.max(0, Math.min(255, r * 255))),
            Math.floor(Math.max(0, Math.min(255, g * 255))),
            Math.floor(Math.max(0, Math.min(255, b * 255))),
            Math.floor(Math.max(0, Math.min(255, (a ?? 0) * 255)))
        );
    }

    getBrightness() { return (this.g * 3.0 + this.b + this.b + this.r) * 0.0006510417; }

    toArray(array: number[] | ArrayLike<number> | GD.ColorArr = [], offset = 0) {
        (array as number[])[offset] = this.r;
        (array as number[])[offset + 1] = this.g;
        (array as number[])[offset + 2] = this.b;
        (array as number[])[offset + 3] = this.a;

        return array;
    }

    public toString() { return `Color=(r=${this.r}, g=${this.g}, b=${this.b}, a=${this.a})` }
}

export default FColor;
export { FColor };