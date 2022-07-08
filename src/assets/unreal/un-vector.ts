import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";

class FVector extends FConstructable {
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

    public getElements(): [number, number, number] { return [this.x, this.y, this.z]; }

    public divideScalar(scalar: number) { return this.multiplyScalar(1 / scalar); }
    public multiplyScalar(scalar: number) {
        return new FVector(this.x * scalar, this.y * scalar, this.z * scalar);
    }

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

    fromArray(array: number[] | ArrayLike<number> = [], offset = 0, restoreOrder = false) {
        const [a, b, c] = restoreOrder ? [0, 2, 1] : [0, 1, 2];

        this.x = array[offset + a];
        this.y = array[offset + b];
        this.z = array[offset + c];

        return this;
    }

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

    getVectorElements(): [number, number, number] { return [this.x, this.z, this.y]; }

    applyRotator(rotator: FRotator, negate: boolean): FVector {

        let [x, y, z, order] = rotator.getEulerElements();

        if (negate) x = -x, y = -y, z = -z;

        // http://www.mathworks.com/matlabcentral/fileexchange/
        // 	20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/
        //	content/SpinCalc.m

        const cos = Math.cos;
        const sin = Math.sin;

        const c1 = cos(x / 2);
        const c2 = cos(y / 2);
        const c3 = cos(z / 2);

        const s1 = sin(x / 2);
        const s2 = sin(y / 2);
        const s3 = sin(z / 2);

        let qx: number, qy: number, qz: number, qw: number;

        switch (order) {
            case "XYZ":
                qx = s1 * c2 * c3 + c1 * s2 * s3;
                qy = c1 * s2 * c3 - s1 * c2 * s3;
                qz = c1 * c2 * s3 + s1 * s2 * c3;
                qw = c1 * c2 * c3 - s1 * s2 * s3;
                break;
            case "YXZ":
                qx = s1 * c2 * c3 + c1 * s2 * s3;
                qy = c1 * s2 * c3 - s1 * c2 * s3;
                qz = c1 * c2 * s3 - s1 * s2 * c3;
                qw = c1 * c2 * c3 + s1 * s2 * s3;
                break;
            case "ZXY":
                qx = s1 * c2 * c3 - c1 * s2 * s3;
                qy = c1 * s2 * c3 + s1 * c2 * s3;
                qz = c1 * c2 * s3 + s1 * s2 * c3;
                qw = c1 * c2 * c3 - s1 * s2 * s3;
                break;

            case "ZYX":
                qx = s1 * c2 * c3 - c1 * s2 * s3;
                qy = c1 * s2 * c3 + s1 * c2 * s3;
                qz = c1 * c2 * s3 - s1 * s2 * c3;
                qw = c1 * c2 * c3 + s1 * s2 * s3;
                break;
            case "YZX":
                qx = s1 * c2 * c3 + c1 * s2 * s3;
                qy = c1 * s2 * c3 + s1 * c2 * s3;
                qz = c1 * c2 * s3 - s1 * s2 * c3;
                qw = c1 * c2 * c3 - s1 * s2 * s3;
                break;
            case "XZY":
                qx = s1 * c2 * c3 - c1 * s2 * s3;
                qy = c1 * s2 * c3 - s1 * c2 * s3;
                qz = c1 * c2 * s3 + s1 * s2 * c3;
                qw = c1 * c2 * c3 + s1 * s2 * s3;
                break;
            default: throw new Error(`Unsupported order: ${order}`)
        }

        return this.applyQuaternion(qx, qy, qz, qw);
    }

    applyQuaternion(qx: number, qy: number, qz: number, qw: number) {

        const x = this.x, y = this.y, z = this.z;

        // calculate quat * vector

        const ix = qw * x + qy * z - qz * y;
        const iy = qw * y + qz * x - qx * z;
        const iz = qw * z + qx * y - qy * x;
        const iw = - qx * x - qy * y - qz * z;

        // calculate result * inverse quat

        const nx = ix * qw + iw * - qx + iy * - qz - iz * - qy;
        const ny = iy * qw + iw * - qy + iz * - qx - ix * - qz;
        const nz = iz * qw + iw * - qz + ix * - qy - iy * - qx;

        return new FVector(nx, ny, nz);
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