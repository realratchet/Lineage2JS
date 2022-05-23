import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";

class FVector extends FConstructable {
    public static readonly typeSize = 12;
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;

    public load(pkg: UPackage): this {
        const f = new BufferValue(BufferValue.float);

        for (let ax of ["x", "y", "z"])
            this[ax as "x" | "y" | "z"] = pkg.read(f).value as number;

        return this;
    }

    public constructor(x = 0, y = 0, z = 0) {
        super();

        this.set(x, y, z);
    }

    public set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public getElements(): number[] { return [this.x, this.y, this.z]; }

    public multiplyScalar(scalar: number): FVector {
        return new FVector(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    public divideScalar(scalar: number) { return this.multiplyScalar(1 / scalar); }

    public add(other: FVector) {
        return new FVector(
            this.x + other.x,
            this.y + other.y,
            this.z + other.z
        );
    }

    public sub(other: FVector) {
        return new FVector(
            this.x - other.x,
            this.y - other.y,
            this.z - other.z
        );
    }

    public div(other: FVector) {
        return new FVector(
            this.x / other.x,
            this.y / other.y,
            this.z / other.z
        );
    }

    distanceTo(other: FVector) { return this.distanceToSquared(other) ** 0.5; }
    distanceToSquared(other: FVector) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dz = this.z - other.z;

        return dx * dx + dy * dy + dz * dz;
    }

    length() { return this.lengthSq() ** 0.5; }
    lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }

    /**
     * operator ^
     * @param other 
     */
    public cross(other: FVector) {
        const ax = this.x, ay = this.y, az = this.z;
        const bx = other.x, by = other.y, bz = other.z;

        const x = ay * bz - az * by;
        const y = az * bx - ax * bz;
        const z = ax * by - ay * bx;

        return new FVector(x, y, z);
    }

    /**
     * operator |
     * @param other 
     */
    public dot(other: FVector) { return this.x * other.x + this.y * other.y + this.z * other.z; }

    toArray(array: number[] | ArrayLike<number> = [], offset = 0) {

        (array as number[])[offset] = this.x;
        (array as number[])[offset + 1] = this.y;
        (array as number[])[offset + 2] = this.z;

        return array;
    }

    normalized() {
        const len = this.length();

        return new FVector(
            this.x / len,
            this.y / len,
            this.z / len
        );
    }

    applyMatrix4(m: FMatrix) {

        const x = this.x, y = this.y, z = this.z;
        const e = m.elements;

        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);

        const nx = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
        const ny = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
        const nz = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;

        return new FVector(nx, ny, nz);
    }
}

export default FVector;
export { FVector };