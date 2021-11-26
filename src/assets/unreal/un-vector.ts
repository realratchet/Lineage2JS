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

        this.x = x;
        this.y = y;
        this.z = z;
    }

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
}

export default FVector;
export { FVector };