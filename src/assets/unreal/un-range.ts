import { UObject } from "@l2js/core";
import FVector from "./un-vector";

class URange extends UObject {
    protected min: number;
    protected max: number;

    constructor(min: number = 0, max: number = 0) {
        super();

        this.min = min;
        this.max = max;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Min": "min",
            "Max": "max"
        });
    }

    // public load(pkg: UPackage, tag: PropertyTag): this {
    //     this.readHead = pkg.tell();
    //     this.readTail = this.readHead + tag.dataSize;

    //     this.readNamedProps(pkg);

    //     return this;
    // }

    public getDecodeInfo(library: DecodeLibrary): Range_T { return [this.min, this.max]; }

    public toString() { return `Range=(min=${this.min.toFixed(2)},max=${this.max.toFixed(2)})`; }

    public mid() { return (this.max + this.min) / 2; }
    public rand() { return this.max + (this.min - this.max) * Math.random(); }
}

class URangeVector extends UObject {
    protected x: URange;
    protected y: URange;
    protected z: URange;

    constructor(x = new URange(), y = new URange(), z = new URange()) {
        super();

        this.x = x;
        this.y = y;
        this.z = z;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "X": "x",
            "Y": "y",
            "Z": "z"
        });
    }

    public getDecodeInfo(library: DecodeLibrary): RangeVector_T {
        const [minx, maxx] = this.x.getDecodeInfo(library)
        const [miny, maxy] = this.y.getDecodeInfo(library)
        const [minz, maxz] = this.z.getDecodeInfo(library)

        return {
            min: [minx, minz, miny],
            max: [maxx, maxz, maxy],
        };
    }

    public toString() { return `RangeVector=(x=${this.x}, y=${this.y}, z=${this.z})`; }

    public rand() { return new FVector(this.x.rand(), this.y.rand(), this.z.rand()); }
}

export default URange;
export { URange, URangeVector };

type Range_T = [number, number];
type RangeVector_T = { min: Vector3Arr, max: Vector3Arr };