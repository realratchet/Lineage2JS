import FVector from "@client/assets/unreal/un-vector";
import UObject from "@l2js/core";

abstract class FRange extends UObject implements GD.IDecodableStruct<Range_T> {
    public static readonly plainStructFields = true; // values live in fields, not propertyDict (see UObject.loadNative)

    declare public min: number;
    declare public max: number;

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

    public getDecodeInfo(_library: GD.DecodeLibrary): Range_T { return [this.min, this.max]; }


    public toString() { return `Range=(min=${this.min.toFixed(2)},max=${this.max.toFixed(2)})`; }

    public mid() { return (this.max + this.min) / 2; }
    public rand() { return this.max + (this.min - this.max) * Math.random(); }
}

abstract class FRangeVector extends UObject implements GD.IDecodableStruct<RangeVector_T> {
    public static readonly plainStructFields = true; // values live in fields, not propertyDict (see UObject.loadNative)

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

    public getDecodeInfo(library: GD.DecodeLibrary): RangeVector_T {
        const [minx, maxx] = this.x.getDecodeInfo(library)
        const [miny, maxy] = this.y.getDecodeInfo(library)
        const [minz, maxz] = this.z.getDecodeInfo(library)

        /*
         * Native component order. The scene uses ue coordinates as-is (see
         * AActor.getWorldMatrixElements - "no axis reordering"); the old y/z swap
         * here predated that and sent StartVelocityRange's +Z (up) sideways - and
         * swapped G/B in ColorMultiplierRange.
         */
        return {
            min: [minx, miny, minz],
            max: [maxx, maxy, maxz],
        };
    }

    public toString() { return `RangeVector=(x=${this.x}, y=${this.y}, z=${this.z})`; }

    public rand() { return FVector.make(this.x.rand(), this.y.rand(), this.z.rand()); }
}

export default FRange;
export { FRange, FRangeVector };

type Range_T = [number, number];
type RangeVector_T = { min: GD.Vector3Arr, max: GD.Vector3Arr };