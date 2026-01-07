import FVector from "@client/assets/unreal/un-vector";
import UObject from "@l2js/core";

abstract class FPlane extends UObject {
    declare public ["constructor"]: typeof FPlane;

    declare public x: number;
    declare public y: number;
    declare public z: number;
    declare public w: number;

    public get 0() { return this.x; }
    public set 0(v: number) { this.x = v; }
    public get 1() { return this.y; }
    public set 1(v: number) { this.y = v; }
    public get 2() { return this.z; }
    public set 2(v: number) { this.z = v; }
    public get 3() { return this.w; }
    public set 3(v: number) { this.w = v; }

    public constructor(x = 0, y = 0, z = 0, w = 0) {
        super();

        this.set(x, y, z, w);
    }

    public static fromPoints(a: FVector, b: FVector, c: FVector): FPlane {
        const xyz = ((b.sub(a)).cross(c.sub(a))).normalized();
        const w = a.dot((b.sub(a)).cross(c.sub(a)).normalized());

        return FPlane.make(xyz.x, xyz.y, xyz.z, w);
    }

    public vector() { return FVector.make(this.x, this.y, this.z); }

    public set(x: number, y: number, z: number, w: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "X": "x",
            "Y": "y",
            "Z": "z",
            "W": "w",
        });
    }

    public add(other: FPlane) {
        return FPlane.make(
            this.x + other.x,
            this.y + other.y,
            this.z + other.z,
            this.w + other.w
        );
    }

    public sub(other: FPlane) {
        return FPlane.make(
            this.x - other.x,
            this.y - other.y,
            this.z - other.z,
            this.w - other.w
        );
    }

    public getElements(): GD.Vector4Arr { return [this.x, this.y, this.z, this.w]; }
    public toString() { return `Plane=(x=${this.x.toFixed(2)}, y=${this.y.toFixed(2)}, z=${this.z.toFixed(2)}, w=${this.w.toFixed(2)})`; }

    public divideScalar(scalar: number) { return this.multiplyScalar(1 / scalar); }
    public multiplyScalar(scalar: number) {
        return FPlane.make(this.x * scalar, this.y * scalar, this.z * scalar, this.w * scalar);
    }

    public dot(other: FPlane | GA.FVector) {
        if (other instanceof FPlane)
            return this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w;

        return this.x * other.x + this.y * other.y + this.z * other.z - this.w;
    }

    public toArray(array: number[] | ArrayLike<number> = [], offset = 0) {

        (array as number[])[offset] = this.x;
        (array as number[])[offset + 1] = this.y;
        (array as number[])[offset + 2] = this.z;
        (array as number[])[offset + 3] = this.w;

        return array;
    }

}

export { FPlane };
export default FPlane;