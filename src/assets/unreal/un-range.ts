import UObject from "./un-object";

class URange extends UObject {
    protected min: number;
    protected max: number;

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
}

class URangeVector extends UObject {
    protected x: URange;
    protected y: URange;
    protected z: URange;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "X": "x",
            "Y": "y",
            "Z": "z"
        });
    }

    public getDecodeInfo(library: DecodeLibrary): RangeVector_T {
        return {
            x: this.x.getDecodeInfo(library),
            y: this.x.getDecodeInfo(library),
            z: this.x.getDecodeInfo(library)
        };
    }
}

export default URange;
export { URange, URangeVector };

type Range_T = [number, number];
type RangeVector_T = { x: Range_T, y: Range_T, z: Range_T };