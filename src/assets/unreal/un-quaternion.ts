import FVector from "./un-vector";
import UObject from "./un-object";
import type { QuaternionArr } from "./library-types";

export abstract class FQuaternion extends UObject {
    public static readonly plainStructFields = true; // values live in fields, not propertyDict (see UObject.loadNative)

    public static multiplyElements(a: QuaternionArr, b: QuaternionArr, out: QuaternionArr): QuaternionArr {
        const ax = a[0], ay = a[1], az = a[2], aw = a[3];
        const bx = b[0], by = b[1], bz = b[2], bw = b[3];

        out[0] = ax * bw + aw * bx + ay * bz - az * by;
        out[1] = ay * bw + aw * by + az * bx - ax * bz;
        out[2] = az * bw + aw * bz + ax * by - ay * bx;
        out[3] = aw * bw - ax * bx - ay * by - az * bz;
        return out;
    }

    public static removeEulerY(rotation: QuaternionArr, out: QuaternionArr): QuaternionArr {
        const x = rotation[0], y = rotation[1], z = rotation[2], w = rotation[3];
        const m11 = 1 - 2 * (y * y + z * z);
        const m21 = 2 * (x * y + z * w);
        const m31 = 2 * (x * z - y * w);
        const m32 = 2 * (y * z + x * w);
        const m33 = 1 - 2 * (x * x + y * y);
        let eulerX: number, eulerZ: number;

        if (Math.abs(m31) < 0.9999999) {
            eulerX = Math.atan2(m32, m33);
            eulerZ = Math.atan2(m21, m11);
        } else {
            eulerX = 0;
            eulerZ = Math.atan2(-2 * (x * y - z * w), 1 - 2 * (x * x + z * z));
        }

        const sx = Math.sin(eulerX / 2), cx = Math.cos(eulerX / 2);
        const sz = Math.sin(eulerZ / 2), cz = Math.cos(eulerZ / 2);

        out[0] = sx * cz;
        out[1] = sx * sz;
        out[2] = cx * sz;
        out[3] = cx * cz;
        return out;
    }

    declare public x: number;
    declare public y: number;
    declare public z: number;
    declare public w: number;

    public constructor(x = 0, y = 0, z = 0, w = 1) {
        super();

        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    protected getPropertyMap() {
        return {
            "X": "x",
            "Y": "y",
            "Z": "z",
            "W": "w"
        };
    }


    public toQuatElements(): QuaternionArr { return [this.x, this.y, this.z, this.w]; }

    public conjugate() { return FQuaternion.make(-this.x, -this.y, -this.z, this.w); }

    public clone() { return FQuaternion.make(this.x, this.y, this.z, this.w); }

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

export class FAxis {
    public x = FVector.make();
    public y = FVector.make();
    public z = FVector.make();

    public transformVector(src: FVector) {
        const dst = FVector.make();

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

    public untransformVector(src: FVector): FVector {
        let tmp = this.x.multiplyScalar(src.x);

        tmp = this.y.multiplyScalar(src.y).add(tmp);
        tmp = this.z.multiplyScalar(src.z).add(tmp);

        return tmp;
    }
}

export default FQuaternion;
