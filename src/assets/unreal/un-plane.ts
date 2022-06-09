import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";
import UObject from "./un-object";

class FPlane extends FConstructable {
    public x: number;
    public y: number;
    public z: number;
    public w: number;

    toArray(array: number[] | ArrayLike<number> = [], offset = 0) {

        (array as number[])[offset] = this.x;
        (array as number[])[offset + 1] = this.y;
        (array as number[])[offset + 2] = this.z;
        (array as number[])[offset + 3] = this.w;

        return array;
    }

    public load(pkg: UPackage): this {
        const f = new BufferValue(BufferValue.float);

        ["x", "y", "z", "w"].forEach((ax: "x" | "y" | "z" | "w") => {
            this[ax] = pkg.read(f).value as number;
        });

        return this;
    }
}

class UPlane extends UObject {
    public x: number;
    public y: number;
    public z: number;
    public w: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "X": "x",
            "Y": "y",
            "Z": "z",
            "W": "w",
        });
    }

    protected preLoad(pkg: UPackage, tag: any): void {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;
    }

    public doLoad(pkg: UPackage, tag: any): this {

        this.readNamedProps(pkg);

        return this;
    }
}

export { FPlane, UPlane };