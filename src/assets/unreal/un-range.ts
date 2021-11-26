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

    public load(pkg: UPackage, tag: PropertyTag): this {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;

        this.readNamedProps(pkg);

        return this;
    }
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

    public load(pkg: UPackage, tag: PropertyTag): this {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;

        this.readNamedProps(pkg);

        return this;
    }
}

export default URange;
export { URange, URangeVector };