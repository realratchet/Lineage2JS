import { BufferValue } from "@l2js/core";
import FConstructable from "./un-constructable";
import FVector from "./un-vector";

class FQuaternion extends FConstructable {
    public x: number;
    public y: number;
    public z: number;
    public w: number;

    constructor(x = 0, y = 0, z = 0, w = 1) {
        super();

        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);

        this.x = pkg.read(float).value as number;
        this.y = pkg.read(float).value as number;
        this.z = pkg.read(float).value as number;
        this.w = pkg.read(float).value as number;

        return this;
    }

    public toQuatElements(): QuaternionArr { return [this.x, this.y, this.z, this.w]; }

    public conjugate() { return new FQuaternion(-this.x, -this.y, -this.z, this.w); }

    public clone() { return new FQuaternion(this.x, this.y, this.z, this.w); }

    public toAxis() {
        const axis = new FAxis();

        const x2 = this.x * 2;
        const y2 = this.y * 2;
        const z2 = this.z * 2;

        const xx = this.x * x2;
        const xy = this.x * y2;
        const xz = this.x * z2;

        const yy = this.y * y2;
        const yz = this.y * z2;
        const zz = this.z * z2;

        const wx = this.w * x2;
        const wy = this.w * y2;
        const wz = this.w * z2;

        axis.x.x = 1.0 - (yy + zz);
        axis.x.y = xy - wz;
        axis.x.z = xz + wy;

        axis.y.x = xy + wz;
        axis.y.y = 1.0 - (xx + zz);
        axis.y.z = yz - wx;

        axis.z.x = xz - wy;
        axis.z.y = yz + wx;
        axis.z.z = 1.0 - (xx + yy);

        return axis;
    }
}

class FAxis {
    public x = new FVector();
    public y = new FVector();
    public z = new FVector();

    public transformVector(src: FVector) {
        const dst = new FVector();

        dst.x = src.dot(this.x);
        dst.y = src.dot(this.y);
        dst.z = src.dot(this.z);

        return dst;
    }

    public untransformAxis(src: FAxis): FAxis {
        const out = new FAxis();

        out.x = this.untransformVector(src.x);
        out.y = this.untransformVector(src.y);
        out.z = this.untransformVector(src.z);

        return out;
    }

    untransformVector(src: FVector): FVector {
        let tmp = this.x.multiplyScalar(src.x);

        tmp = this.y.multiplyScalar(src.y).add(tmp);
        tmp = this.z.multiplyScalar(src.z).add(tmp);

        return tmp;
    }
}

export default FQuaternion;
export { FQuaternion, FAxis };