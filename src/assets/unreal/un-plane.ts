import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";
import UObject from "./un-object";

class FPlane extends FConstructable {
    public x: number;
    public y: number;
    public z: number;
    public w: number;

    constructor(x = 0, y = 0, z = 0, w = 0) {
        super();

        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    public getElements(): [number, number, number, number] { return [this.x, this.y, this.z, this.w]; }

    public divideScalar(scalar: number) { return this.multiplyScalar(1 / scalar); }
    public multiplyScalar(scalar: number) {
        return new FPlane(this.x * scalar, this.y * scalar, this.z * scalar, this.w * scalar);
    }

    public dot(other: FPlane) { return this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w; }


    public toArray(array: number[] | ArrayLike<number> = [], offset = 0) {

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