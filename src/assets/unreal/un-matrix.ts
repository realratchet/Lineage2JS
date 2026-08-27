import FCoords from "./un-coords";
import GMath from "./un-gmath";
import FPlane from "./un-plane";
import FVector from "./un-vector";
import UObject from "@l2js/core";

const eps = 1e-8;

abstract class FMatrix extends UObject {
    public static readonly plainStructFields = true; // values live in fields, not propertyDict (see UObject.loadNative)

    declare public readonly planeX: GA.FPlane;
    declare public readonly planeY: GA.FPlane;
    declare public readonly planeZ: GA.FPlane;
    declare public readonly planeW: GA.FPlane;

    public constructor() {
        super();

        this.planeX = FPlane.make();
        this.planeY = FPlane.make();
        this.planeZ = FPlane.make();
        this.planeW = FPlane.make();
    }

    public get 0() { return this.planeX; }
    public get 1() { return this.planeY; }
    public get 2() { return this.planeZ; }
    public get 3() { return this.planeW; }

    public toString(..._: any) {
        return "Matrix=(\n" + [
            "\    " + [this.planeX.x.toFixed(3), this.planeX.y.toFixed(3), this.planeX.z.toFixed(3), this.planeX.w.toFixed(3)].join(", "),
            "\    " + [this.planeY.x.toFixed(3), this.planeY.y.toFixed(3), this.planeY.z.toFixed(3), this.planeY.w.toFixed(3)].join(", "),
            "\    " + [this.planeZ.x.toFixed(3), this.planeZ.y.toFixed(3), this.planeZ.z.toFixed(3), this.planeZ.w.toFixed(3)].join(", "),
            "\    " + [this.planeW.x.toFixed(3), this.planeW.y.toFixed(3), this.planeW.z.toFixed(3), this.planeW.w.toFixed(3)].join(", ")
        ].join("\n") + "\n)";
    }

    public getElements3x3() {
        return [
            this.planeX.x, this.planeX.y, this.planeX.z,
            this.planeY.x, this.planeY.y, this.planeY.z,
            this.planeZ.x, this.planeZ.y, this.planeZ.z
        ];
    }

    public getElements4x4() {
        return [
            this.planeX.x, this.planeX.y, this.planeX.z, this.planeX.w,
            this.planeY.x, this.planeY.y, this.planeY.z, this.planeY.w,
            this.planeZ.x, this.planeZ.y, this.planeZ.z, this.planeZ.w,
            this.planeW.x, this.planeW.y, this.planeW.z, this.planeW.w
        ];
    }

    public getMatrix3(output: THREE.Matrix3): THREE.Matrix3 {
        return output.set(
            this.planeX.x, this.planeY.x, this.planeZ.x,
            this.planeX.y, this.planeY.y, this.planeZ.y,
            this.planeX.z, this.planeY.z, this.planeZ.z
        );
    }

    public getMatrix4(output: THREE.Matrix4): THREE.Matrix4 {
        return output.set(
            this.planeX.x, this.planeY.x, this.planeZ.x, this.planeW.x,
            this.planeX.y, this.planeY.y, this.planeZ.y, this.planeW.y,
            this.planeX.z, this.planeY.z, this.planeZ.z, this.planeW.z,
            this.planeX.w, this.planeY.w, this.planeZ.w, this.planeW.w
        );
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "XPlane": "planeX",
            "YPlane": "planeY",
            "ZPlane": "planeZ",
            "WPlane": "planeW",
        });
    }

    protected mul(other: FMatrix): FMatrix {
        const result = FMatrix.make();

        const tX = this.planeX, tY = this.planeY, tZ = this.planeZ, tW = this.planeW;
        const oX = other.planeX, oY = other.planeY, oZ = other.planeZ, oW = other.planeW;

        result.planeX.x = tX.x * oX.x + tX.y * oY.x + tX.z * oZ.x + tX.w * oW.x;
        result.planeX.y = tX.x * oX.y + tX.y * oY.y + tX.z * oZ.y + tX.w * oW.y;
        result.planeX.z = tX.x * oX.z + tX.y * oY.z + tX.z * oZ.z + tX.w * oW.z;
        result.planeX.w = tX.x * oX.w + tX.y * oY.w + tX.z * oZ.w + tX.w * oW.w;

        result.planeY.x = tY.x * oX.x + tY.y * oY.x + tY.z * oZ.x + tY.w * oW.x;
        result.planeY.y = tY.x * oX.y + tY.y * oY.y + tY.z * oZ.y + tY.w * oW.y;
        result.planeY.z = tY.x * oX.z + tY.y * oY.z + tY.z * oZ.z + tY.w * oW.z;
        result.planeY.w = tY.x * oX.w + tY.y * oY.w + tY.z * oZ.w + tY.w * oW.w;

        result.planeZ.x = tZ.x * oX.x + tZ.y * oY.x + tZ.z * oZ.x + tZ.w * oW.x;
        result.planeZ.y = tZ.x * oX.y + tZ.y * oY.y + tZ.z * oZ.y + tZ.w * oW.y;
        result.planeZ.z = tZ.x * oX.z + tZ.y * oY.z + tZ.z * oZ.z + tZ.w * oW.z;
        result.planeZ.w = tZ.x * oX.w + tZ.y * oY.w + tZ.z * oZ.w + tZ.w * oW.w;

        result.planeW.x = tW.x * oX.x + tW.y * oY.x + tW.z * oZ.x + tW.w * oW.x;
        result.planeW.y = tW.x * oX.y + tW.y * oY.y + tW.z * oZ.y + tW.w * oW.y;
        result.planeW.z = tW.x * oX.z + tW.y * oY.z + tW.z * oZ.z + tW.w * oW.z;
        result.planeW.w = tW.x * oX.w + tW.y * oY.w + tW.z * oZ.w + tW.w * oW.w;

        return result;
    }

    public transformPlane(plane: FPlane): FPlane {
        const result = FPlane.make();

        const pX = this.planeX, pY = this.planeY, pZ = this.planeZ, pW = this.planeW;

        result.x = plane.x * pX.x + plane.y * pY.x + plane.z * pZ.x + plane.w * pW.x;
        result.y = plane.x * pX.y + plane.y * pY.y + plane.z * pZ.y + plane.w * pW.y;
        result.z = plane.x * pX.z + plane.y * pY.z + plane.z * pZ.z + plane.w * pW.z;
        result.w = plane.x * pX.w + plane.y * pY.w + plane.z * pZ.w + plane.w * pW.w;

        return result;
    }

    public transformVector(vec: FVector, target = FVector.make()): FVector {
        const x = vec.x, y = vec.y, z = vec.z;
        const pX = this.planeX, pY = this.planeY, pZ = this.planeZ, pW = this.planeW;

        const rx = x * pX.x + y * pY.x + z * pZ.x + pW.x;
        const ry = x * pX.y + y * pY.y + z * pZ.y + pW.y;
        const rz = x * pX.z + y * pY.z + z * pZ.z + pW.z;

        return target.set(rx, ry, rz);
    }

    public transformNormal(vec: FVector, target = FVector.make()): FVector {
        const x = vec.x, y = vec.y, z = vec.z;
        const pX = this.planeX, pY = this.planeY, pZ = this.planeZ;

        const rx = x * pX.x + y * pY.x + z * pZ.x;
        const ry = x * pX.y + y * pY.y + z * pZ.y;
        const rz = x * pX.z + y * pY.z + z * pZ.z;

        return target.set(rx, ry, rz);
    }

    public transpose(): FMatrix {
        const result = FMatrix.make();
        const pX = this.planeX, pY = this.planeY, pZ = this.planeZ, pW = this.planeW;

        result.planeX.x = pX.x;
        result.planeX.y = pY.x;
        result.planeX.z = pZ.x;
        result.planeX.w = pW.x;

        result.planeY.x = pX.y;
        result.planeY.y = pY.y;
        result.planeY.z = pZ.y;
        result.planeY.w = pW.y;

        result.planeZ.x = pX.z;
        result.planeZ.y = pY.z;
        result.planeZ.z = pZ.z;
        result.planeZ.w = pW.z;

        result.planeW.x = pX.w;
        result.planeW.y = pY.w;
        result.planeW.z = pZ.w;
        result.planeW.w = pW.w;

        return result;
    }

    public det(): number {
        const pX = this.planeX, pY = this.planeY, pZ = this.planeZ, pW = this.planeW;

        return pX.x * (
            pY.y * (pZ.z * pW.w - pZ.w * pW.z) -
            pZ.y * (pY.z * pW.w - pY.w * pW.z) +
            pW.y * (pY.z * pZ.w - pY.w * pZ.z)
        ) - pY.x * (
            pX.y * (pZ.z * pW.w - pZ.w * pW.z) -
            pZ.y * (pX.z * pW.w - pX.w * pW.z) +
            pW.y * (pX.z * pZ.w - pX.w * pZ.z)
        ) + pZ.x * (
            pX.y * (pY.z * pW.w - pY.w * pW.z) -
            pY.y * (pX.z * pW.w - pX.w * pW.z) +
            pW.y * (pX.z * pY.w - pX.w * pY.z)
        ) - pW.x * (
            pX.y * (pY.z * pZ.w - pY.w * pZ.z) -
            pY.y * (pX.z * pZ.w - pX.w * pZ.z) +
            pZ.y * (pX.z * pY.w - pX.w * pY.z)
        );
    }

    public static ident() {
        const M = FMatrix.make();

        M.planeX.set(1, 0, 0, 0);
        M.planeY.set(0, 1, 0, 0);
        M.planeZ.set(0, 0, 1, 0);
        M.planeW.set(0, 0, 0, 1);

        return M;
    }

    public inverse(): FMatrix {
        const pX = this.planeX, pY = this.planeY, pZ = this.planeZ, pW = this.planeW;
        const Det = this.det();

        if (Math.abs(Det) < eps) return FMatrix.ident();

        const Result = FMatrix.make();
        const RDet = 1.0 / Det;

        Result.planeX.x = RDet * (
            pY.y * (pZ.z * pW.w - pZ.w * pW.z) -
            pZ.y * (pY.z * pW.w - pY.w * pW.z) +
            pW.y * (pY.z * pZ.w - pY.w * pZ.z)
        );

        Result.planeX.y = -RDet * (
            pX.y * (pZ.z * pW.w - pZ.w * pW.z) -
            pZ.y * (pX.z * pW.w - pX.w * pW.z) +
            pW.y * (pX.z * pZ.w - pX.w * pZ.z)
        );

        Result.planeX.z = RDet * (
            pX.y * (pY.z * pW.w - pY.w * pW.z) -
            pY.y * (pX.z * pW.w - pX.w * pW.z) +
            pW.y * (pX.z * pY.w - pX.w * pY.z)
        );

        Result.planeX.w = -RDet * (
            pX.y * (pY.z * pZ.w - pY.w * pZ.z) -
            pY.y * (pX.z * pZ.w - pX.w * pZ.z) +
            pZ.y * (pX.z * pY.w - pX.w * pY.z)
        );

        Result.planeY.x = -RDet * (
            pY.x * (pZ.z * pW.w - pZ.w * pW.z) -
            pZ.x * (pY.z * pW.w - pY.w * pW.z) +
            pW.x * (pY.z * pZ.w - pY.w * pZ.z)
        );
        Result.planeY.y = RDet * (
            pX.x * (pZ.z * pW.w - pZ.w * pW.z) -
            pZ.x * (pX.z * pW.w - pX.w * pW.z) +
            pW.x * (pX.z * pZ.w - pX.w * pZ.z)
        );

        Result.planeY.z = -RDet * (
            pX.x * (pY.z * pW.w - pY.w * pW.z) -
            pY.x * (pX.z * pW.w - pX.w * pW.z) +
            pW.x * (pX.z * pY.w - pX.w * pY.z)
        );

        Result.planeY.w = RDet * (
            pX.x * (pY.z * pZ.w - pY.w * pZ.z) -
            pY.x * (pX.z * pZ.w - pX.w * pZ.z) +
            pZ.x * (pX.z * pY.w - pX.w * pY.z)
        );

        Result.planeZ.x = RDet * (
            pY.x * (pZ.y * pW.w - pZ.w * pW.y) -
            pZ.x * (pY.y * pW.w - pY.w * pW.y) +
            pW.x * (pY.y * pZ.w - pY.w * pZ.y)
        );
        Result.planeZ.y = -RDet * (
            pX.x * (pZ.y * pW.w - pZ.w * pW.y) -
            pZ.x * (pX.y * pW.w - pX.w * pW.y) +
            pW.x * (pX.y * pZ.w - pX.w * pZ.y)
        );

        Result.planeZ.z = RDet * (
            pX.x * (pY.y * pW.w - pY.w * pW.y) -
            pY.x * (pX.y * pW.w - pX.w * pW.y) +
            pW.x * (pX.y * pY.w - pX.w * pY.y)
        );

        Result.planeZ.w = -RDet * (
            pX.x * (pY.y * pZ.w - pY.w * pZ.y) -
            pY.x * (pX.y * pZ.w - pX.w * pZ.y) +
            pZ.x * (pX.y * pY.w - pX.w * pY.y)
        );

        Result.planeW.x = -RDet * (
            pY.x * (pZ.y * pW.z - pZ.z * pW.y) -
            pZ.x * (pY.y * pW.z - pY.z * pW.y) +
            pW.x * (pY.y * pZ.z - pY.z * pZ.y)
        );
        Result.planeW.y = RDet * (
            pX.x * (pZ.y * pW.z - pZ.z * pW.y) -
            pZ.x * (pX.y * pW.z - pX.z * pW.y) +
            pW.x * (pX.y * pZ.z - pX.z * pZ.y)
        );

        Result.planeW.z = -RDet * (
            pX.x * (pY.y * pW.z - pY.z * pW.y) -
            pY.x * (pX.y * pW.z - pX.z * pW.y) +
            pW.x * (pX.y * pY.z - pX.z * pY.y)
        );

        Result.planeW.w = RDet * (
            pX.x * (pY.y * pZ.z - pY.z * pZ.y) -
            pY.x * (pX.y * pZ.z - pX.z * pZ.y) +
            pZ.x * (pX.y * pY.z - pY.y * pX.z)
        );

        return Result;
    }

    public transposeAdjoint(): FMatrix {
        const ta = FMatrix.make();
        const pX = this.planeX, pY = this.planeY, pZ = this.planeZ;

        ta.planeX.x = pY.y * pZ.z - pY.z * pZ.y;
        ta.planeX.y = pY.z * pZ.x - pY.x * pZ.z;
        ta.planeX.z = pY.x * pZ.y - pY.y * pZ.x;
        ta.planeX.w = 0;

        ta.planeY.x = pZ.y * pX.z - pZ.z * pX.y;
        ta.planeY.y = pZ.z * pX.x - pZ.x * pX.z;
        ta.planeY.z = pZ.x * pX.y - pZ.y * pX.x;
        ta.planeY.w = 0;

        ta.planeZ.x = pX.y * pY.z - pX.z * pY.y;
        ta.planeZ.y = pX.z * pY.x - pX.x * pY.z;
        ta.planeZ.z = pX.x * pY.y - pX.y * pY.x;
        ta.planeZ.w = 0;

        ta.planeW.x = 0;
        ta.planeW.y = 0;
        ta.planeW.z = 0;
        ta.planeW.w = 1;

        return ta;
    }

    // Remove any scaling from this matrix (ie magnitude of each row is 1)
    public removeScaling(): FMatrix {
        const pX = this.planeX, pY = this.planeY, pZ = this.planeZ;

        let sqSum = pX.x * pX.x + pX.y * pX.y + pX.z * pX.z;
        if (sqSum > eps) {
            const scale = 1 / Math.sqrt(sqSum);
            pX.x *= scale; pX.y *= scale; pX.z *= scale;
        }

        sqSum = pY.x * pY.x + pY.y * pY.y + pY.z * pY.z;
        if (sqSum > eps) {
            const scale = 1 / Math.sqrt(sqSum);
            pY.x *= scale; pY.y *= scale; pY.z *= scale;
        }

        sqSum = pZ.x * pZ.x + pZ.y * pZ.y + pZ.z * pZ.z;
        if (sqSum > eps) {
            const scale = 1 / Math.sqrt(sqSum);
            pZ.x *= scale; pZ.y *= scale; pZ.z *= scale;
        }

        return this;
    }

    public coords(): FCoords {
        const result = FCoords.make();
        const pX = this.planeX, pY = this.planeY, pZ = this.planeZ, pW = this.planeW;

        result.xAxis.set(pX.x, pY.x, pZ.x);
        result.yAxis.set(pX.y, pY.y, pZ.y);
        result.zAxis.set(pX.z, pY.z, pZ.z);
        result.origin.set(pW.x, pW.y, pW.z);

        return result;
    }

    public static fromTranslation(vec: FVector): FMatrix {
        const res = FMatrix.make();

        res.planeX.set(1, 0, 0, 0);
        res.planeY.set(0, 1, 0, 0);
        res.planeZ.set(0, 0, 1, 0);
        res.planeW.set(vec.x, vec.y, vec.z, 1);

        return res;
    }

    public static fromRotator(rot: GA.FRotator) {
        const SR = GMath().sin(rot.roll),
            SP = GMath().sin(rot.pitch),
            SY = GMath().sin(rot.yaw),
            CR = GMath().cos(rot.roll),
            CP = GMath().cos(rot.pitch),
            CY = GMath().cos(rot.yaw);

        const M = FMatrix.make();

        M.planeX.x = CP * CY;
        M.planeX.y = CP * SY;
        M.planeX.z = SP;
        M.planeX.w = 0;

        M.planeY.x = SR * SP * CY - CR * SY;
        M.planeY.y = SR * SP * SY + CR * CY;
        M.planeY.z = - SR * CP;
        M.planeY.w = 0;

        M.planeZ.x = -(CR * SP * CY + SR * SY);
        M.planeZ.y = CY * SR - CR * SP * SY;
        M.planeZ.z = CR * CP;
        M.planeZ.w = 0;

        M.planeW.x = 0;
        M.planeW.y = 0;
        M.planeW.z = 0;
        M.planeW.w = 1;

        return M;
    }

    public static fromQuaternion(quat: GA.FQuaternion) {
        const M = FMatrix.make();

        const x2 = quat.x + quat.x, y2 = quat.y + quat.y, z2 = quat.z + quat.z;
        const xx = quat.x * x2, xy = quat.x * y2, xz = quat.x * z2;
        const yy = quat.y * y2, yz = quat.y * z2, zz = quat.z * z2;
        const wx = quat.w * x2, wy = quat.w * y2, wz = quat.w * z2;

        M.planeX.x = 1 - (yy + zz);
        M.planeY.x = xy - wz;
        M.planeZ.x = xz + wy;
        M.planeW.x = 0;

        M.planeX.y = xy + wz;
        M.planeY.y = 1 - (xx + zz);
        M.planeZ.y = yz - wx;
        M.planeW.y = 0;

        M.planeX.z = xz - wy;
        M.planeY.z = yz + wx;
        M.planeZ.z = 1 - (xx + yy);
        M.planeW.z = 0;

        M.planeX.w = 0;
        M.planeY.w = 0;
        M.planeZ.w = 0;
        M.planeW.w = 1;

        return M;
    }

    public static fromScale(scale: FVector) {
        const M = FMatrix.make();

        M.planeX.set(scale.x, 0, 0, 0)
        M.planeY.set(0, scale.y, 0, 0)
        M.planeZ.set(0, 0, scale.z, 0)
        M.planeW.set(0, 0, 0, 1)

        return M;
    }

    public toArray(): [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] {
        const arr = new Array<number>(16) as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
        const pX = this.planeX, pY = this.planeY, pZ = this.planeZ, pW = this.planeW;

        arr[0] = pX.x; arr[1] = pY.x; arr[2] = pZ.x; arr[3] = pW.x;
        arr[4] = pX.y; arr[5] = pY.y; arr[6] = pZ.y; arr[7] = pW.y;
        arr[8] = pX.z; arr[9] = pY.z; arr[10] = pZ.z; arr[11] = pW.z;
        arr[12] = pX.w; arr[13] = pY.w; arr[14] = pZ.w; arr[15] = pW.w;

        return arr;
    }
}

export default FMatrix;
export { FMatrix };
