import UObject from "@l2js/core";

class FRange extends UObject {
    declare protected min: number;
    declare protected max: number;

    constructor(min: number = 0, max: number = 0) {
        super();

        this.set(min, max);
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Min": "min",
            "Max": "max"
        });
    }

    public set(min: number, max: number) {
        this.min = min;
        this.max = max;
    }

    public getDecodeInfo(library: GA.DecodeLibrary): Range_T { return [this.min, this.max]; }

    public toString() { return `Range=(min=${this.min.toFixed(2)},max=${this.max.toFixed(2)})`; }

    public mid() { return (this.max + this.min) / 2; }
    public rand() { return this.max + (this.min - this.max) * Math.random(); }
}

class FRangeVector extends UObject {
    declare protected x: FRange;
    declare protected y: FRange;
    declare protected z: FRange;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "X": "x",
            "Y": "y",
            "Z": "z"
        });
    }

    public getDecodeInfo(library: GA.DecodeLibrary): RangeVector_T {
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

export default FRange;
export { FRange, FRangeVector };

type Range_T = [number, number];
type RangeVector_T = { min: GD.Vector3Arr, max: GD.Vector3Arr };