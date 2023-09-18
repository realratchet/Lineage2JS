import FCoords from "@client/assets/unreal/un-coords";
import GMath from "@client/assets/unreal/un-gmath";
import FPlane from "@client/assets/unreal/un-plane";
import FVector from "@client/assets/unreal/un-vector";
import UObject from "@l2js/core";

const eps = 1e-8;

abstract class FMatrix extends UObject {
    declare public readonly planeX: GA.FPlane;
    declare public readonly planeY: GA.FPlane;
    declare public readonly planeZ: GA.FPlane;
    declare public readonly planeW: GA.FPlane;

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

        result[0][0] = this[0][0] * other[0][0] + this[0][1] * other[1][0] + this[0][2] * other[2][0] + this[0][3] * other[3][0];
        result[0][1] = this[0][0] * other[0][1] + this[0][1] * other[1][1] + this[0][2] * other[2][1] + this[0][3] * other[3][1];
        result[0][2] = this[0][0] * other[0][2] + this[0][1] * other[1][2] + this[0][2] * other[2][2] + this[0][3] * other[3][2];
        result[0][3] = this[0][0] * other[0][3] + this[0][1] * other[1][3] + this[0][2] * other[2][3] + this[0][3] * other[3][3];

        result[1][0] = this[1][0] * other[0][0] + this[1][1] * other[1][0] + this[1][2] * other[2][0] + this[1][3] * other[3][0];
        result[1][1] = this[1][0] * other[0][1] + this[1][1] * other[1][1] + this[1][2] * other[2][1] + this[1][3] * other[3][1];
        result[1][2] = this[1][0] * other[0][2] + this[1][1] * other[1][2] + this[1][2] * other[2][2] + this[1][3] * other[3][2];
        result[1][3] = this[1][0] * other[0][3] + this[1][1] * other[1][3] + this[1][2] * other[2][3] + this[1][3] * other[3][3];

        result[2][0] = this[2][0] * other[0][0] + this[2][1] * other[1][0] + this[2][2] * other[2][0] + this[2][3] * other[3][0];
        result[2][1] = this[2][0] * other[0][1] + this[2][1] * other[1][1] + this[2][2] * other[2][1] + this[2][3] * other[3][1];
        result[2][2] = this[2][0] * other[0][2] + this[2][1] * other[1][2] + this[2][2] * other[2][2] + this[2][3] * other[3][2];
        result[2][3] = this[2][0] * other[0][3] + this[2][1] * other[1][3] + this[2][2] * other[2][3] + this[2][3] * other[3][3];

        result[3][0] = this[3][0] * other[0][0] + this[3][1] * other[1][0] + this[3][2] * other[2][0] + this[3][3] * other[3][0];
        result[3][1] = this[3][0] * other[0][1] + this[3][1] * other[1][1] + this[3][2] * other[2][1] + this[3][3] * other[3][1];
        result[3][2] = this[3][0] * other[0][2] + this[3][1] * other[1][2] + this[3][2] * other[2][2] + this[3][3] * other[3][2];
        result[3][3] = this[3][0] * other[0][3] + this[3][1] * other[1][3] + this[3][2] * other[2][3] + this[3][3] * other[3][3];

        return result;
    }

    public transformPlane(plane: FPlane): FPlane {
        const result = FPlane.make();

        result.x = plane.x * this[0][0] + plane.y * this[1][0] + plane.z * this[2][0] + plane.w * this[3][0];
        result.y = plane.x * this[0][1] + plane.y * this[1][1] + plane.z * this[2][1] + plane.w * this[3][1];
        result.z = plane.x * this[0][2] + plane.y * this[1][2] + plane.z * this[2][2] + plane.w * this[3][2];
        result.w = plane.x * this[0][3] + plane.y * this[1][3] + plane.z * this[2][3] + plane.w * this[3][3];

        return result;
    }

    public transformVector(vec: FVector): FVector {
        const inPlane = FPlane.make(vec.x, vec.y, vec.z, 1);
        const outPlane = this.transformPlane(inPlane);

        return FVector.make(outPlane.x, outPlane.y, outPlane.z);
    }

    public transformNormal(vec: FVector): FVector {
        const inPlane = FPlane.make(vec.x, vec.y, vec.z, 0);
        const outPlane = this.transformPlane(inPlane);

        return FVector.make(outPlane.x, outPlane.y, outPlane.z);
    }

    public transpose(): FMatrix {
        const result = FMatrix.make();

        result[0][0] = this[0][0];
        result[0][1] = this[1][0];
        result[0][2] = this[2][0];
        result[0][3] = this[3][0];

        result[1][0] = this[0][1];
        result[1][1] = this[1][1];
        result[1][2] = this[2][1];
        result[1][3] = this[3][1];

        result[2][0] = this[0][2];
        result[2][1] = this[1][2];
        result[2][2] = this[2][2];
        result[2][3] = this[3][2];

        result[3][0] = this[0][3];
        result[3][1] = this[1][3];
        result[3][2] = this[2][3];
        result[3][3] = this[3][3];

        return result;
    }

    public det(): number {
        return this[0][0] * (
            this[1][1] * (this[2][2] * this[3][3] - this[2][3] * this[3][2]) -
            this[2][1] * (this[1][2] * this[3][3] - this[1][3] * this[3][2]) +
            this[3][1] * (this[1][2] * this[2][3] - this[1][3] * this[2][2])
        ) - this[1][0] * (
            this[0][1] * (this[2][2] * this[3][3] - this[2][3] * this[3][2]) -
            this[2][1] * (this[0][2] * this[3][3] - this[0][3] * this[3][2]) +
            this[3][1] * (this[0][2] * this[2][3] - this[0][3] * this[2][2])
        ) + this[2][0] * (
            this[0][1] * (this[1][2] * this[3][3] - this[1][3] * this[3][2]) -
            this[1][1] * (this[0][2] * this[3][3] - this[0][3] * this[3][2]) +
            this[3][1] * (this[0][2] * this[1][3] - this[0][3] * this[1][2])
        ) - this[3][0] * (
            this[0][1] * (this[1][2] * this[2][3] - this[1][3] * this[2][2]) -
            this[1][1] * (this[0][2] * this[2][3] - this[0][3] * this[2][2]) +
            this[2][1] * (this[0][2] * this[1][3] - this[0][3] * this[1][2])
        );
    }

    public static ident() {
        const M = FMatrix.make();

        M[0][0] = 1; M[0][1] = 0; M[0][2] = 0; M[0][3] = 0;
        M[1][0] = 0; M[1][1] = 1; M[1][2] = 0; M[1][3] = 0;
        M[2][0] = 0; M[2][1] = 0; M[2][2] = 1; M[2][3] = 0;
        M[3][0] = 0; M[3][1] = 0; M[3][2] = 0; M[3][3] = 1;

        return M;
    }

    public inverse(): FMatrix {

        const Det = this.det();

        if (Math.abs(Det) < eps) return FMatrix.ident();

        const Result = FMatrix.make();
        const RDet = 1.0 / Det;

        Result[0][0] = RDet * (
            this[1][1] * (this[2][2] * this[3][3] - this[2][3] * this[3][2]) -
            this[2][1] * (this[1][2] * this[3][3] - this[1][3] * this[3][2]) +
            this[3][1] * (this[1][2] * this[2][3] - this[1][3] * this[2][2])
        );

        Result[0][1] = -RDet * (
            this[0][1] * (this[2][2] * this[3][3] - this[2][3] * this[3][2]) -
            this[2][1] * (this[0][2] * this[3][3] - this[0][3] * this[3][2]) +
            this[3][1] * (this[0][2] * this[2][3] - this[0][3] * this[2][2])
        );

        Result[0][2] = RDet * (
            this[0][1] * (this[1][2] * this[3][3] - this[1][3] * this[3][2]) -
            this[1][1] * (this[0][2] * this[3][3] - this[0][3] * this[3][2]) +
            this[3][1] * (this[0][2] * this[1][3] - this[0][3] * this[1][2])
        );

        Result[0][3] = -RDet * (
            this[0][1] * (this[1][2] * this[2][3] - this[1][3] * this[2][2]) -
            this[1][1] * (this[0][2] * this[2][3] - this[0][3] * this[2][2]) +
            this[2][1] * (this[0][2] * this[1][3] - this[0][3] * this[1][2])
        );

        Result[1][0] = -RDet * (
            this[1][0] * (this[2][2] * this[3][3] - this[2][3] * this[3][2]) -
            this[2][0] * (this[1][2] * this[3][3] - this[1][3] * this[3][2]) +
            this[3][0] * (this[1][2] * this[2][3] - this[1][3] * this[2][2])
        );
        Result[1][1] = RDet * (
            this[0][0] * (this[2][2] * this[3][3] - this[2][3] * this[3][2]) -
            this[2][0] * (this[0][2] * this[3][3] - this[0][3] * this[3][2]) +
            this[3][0] * (this[0][2] * this[2][3] - this[0][3] * this[2][2])
        );

        Result[1][2] = -RDet * (
            this[0][0] * (this[1][2] * this[3][3] - this[1][3] * this[3][2]) -
            this[1][0] * (this[0][2] * this[3][3] - this[0][3] * this[3][2]) +
            this[3][0] * (this[0][2] * this[1][3] - this[0][3] * this[1][2])
        );

        Result[1][3] = RDet * (
            this[0][0] * (this[1][2] * this[2][3] - this[1][3] * this[2][2]) -
            this[1][0] * (this[0][2] * this[2][3] - this[0][3] * this[2][2]) +
            this[2][0] * (this[0][2] * this[1][3] - this[0][3] * this[1][2])
        );

        Result[2][0] = RDet * (
            this[1][0] * (this[2][1] * this[3][3] - this[2][3] * this[3][1]) -
            this[2][0] * (this[1][1] * this[3][3] - this[1][3] * this[3][1]) +
            this[3][0] * (this[1][1] * this[2][3] - this[1][3] * this[2][1])
        );
        Result[2][1] = -RDet * (
            this[0][0] * (this[2][1] * this[3][3] - this[2][3] * this[3][1]) -
            this[2][0] * (this[0][1] * this[3][3] - this[0][3] * this[3][1]) +
            this[3][0] * (this[0][1] * this[2][3] - this[0][3] * this[2][1])
        );

        Result[2][2] = RDet * (
            this[0][0] * (this[1][1] * this[3][3] - this[1][3] * this[3][1]) -
            this[1][0] * (this[0][1] * this[3][3] - this[0][3] * this[3][1]) +
            this[3][0] * (this[0][1] * this[1][3] - this[0][3] * this[1][1])
        );

        Result[2][3] = -RDet * (
            this[0][0] * (this[1][1] * this[2][3] - this[1][3] * this[2][1]) -
            this[1][0] * (this[0][1] * this[2][3] - this[0][3] * this[2][1]) +
            this[2][0] * (this[0][1] * this[1][3] - this[0][3] * this[1][1])
        );

        Result[3][0] = -RDet * (
            this[1][0] * (this[2][1] * this[3][2] - this[2][2] * this[3][1]) -
            this[2][0] * (this[1][1] * this[3][2] - this[1][2] * this[3][1]) +
            this[3][0] * (this[1][1] * this[2][2] - this[1][2] * this[2][1])
        );
        Result[3][1] = RDet * (
            this[0][0] * (this[2][1] * this[3][2] - this[2][2] * this[3][1]) -
            this[2][0] * (this[0][1] * this[3][2] - this[0][2] * this[3][1]) +
            this[3][0] * (this[0][1] * this[2][2] - this[0][2] * this[2][1])
        );

        Result[3][2] = -RDet * (
            this[0][0] * (this[1][1] * this[3][2] - this[1][2] * this[3][1]) -
            this[1][0] * (this[0][1] * this[3][2] - this[0][2] * this[3][1]) +
            this[3][0] * (this[0][1] * this[1][2] - this[0][2] * this[1][1])
        );

        Result[3][3] = RDet * (
            this[0][0] * (this[1][1] * this[2][2] - this[1][2] * this[2][1]) -
            this[1][0] * (this[0][1] * this[2][2] - this[0][2] * this[2][1]) +
            this[2][0] * (this[0][1] * this[1][2] - this[0][2] * this[1][1])
        );

        return Result;
    }

    public transposeAdjoint(): FMatrix {
        const ta = FMatrix.make();

        ta[0][0] = this[1][1] * this[2][2] - this[1][2] * this[2][1];
        ta[0][1] = this[1][2] * this[2][0] - this[1][0] * this[2][2];
        ta[0][2] = this[1][0] * this[2][1] - this[1][1] * this[2][0];
        ta[0][3] = 0;

        ta[1][0] = this[2][1] * this[0][2] - this[2][2] * this[0][1];
        ta[1][1] = this[2][2] * this[0][0] - this[2][0] * this[0][2];
        ta[1][2] = this[2][0] * this[0][1] - this[2][1] * this[0][0];
        ta[1][3] = 0;

        ta[2][0] = this[0][1] * this[1][2] - this[0][2] * this[1][1];
        ta[2][1] = this[0][2] * this[1][0] - this[0][0] * this[1][2];
        ta[2][2] = this[0][0] * this[1][1] - this[0][1] * this[1][0];
        ta[2][3] = 0;

        ta[3][0] = 0;
        ta[3][1] = 0;
        ta[3][2] = 0;
        ta[3][3] = 1;

        return ta;
    }

    // Remove any scaling from this matrix (ie magnitude of each row is 1)
    public removeScaling(): FMatrix {
        let sqSum = 0, scale = 0;
        const result = this.nativeClone<FMatrix>() as any as number[][];


        // For each row, find magnitude, and if its non-zero re-scale so its unit length.
        for (let i = 0; i < 3; i++) {
            sqSum = ((result[i][0] * result[i][0])) + (result[i][1] * result[i][1]) + (result[i][2] * result[i][2]);

            if (sqSum > eps) {
                scale = 1 / Math.sqrt(sqSum);

                result[i][0] *= scale;
                result[i][1] *= scale;
                result[i][2] *= scale;
            }
        }

        return this as any as FMatrix;
    }

    public coords(): FCoords {
        const result = FCoords.make();

        result.xAxis.set(this[0][0], this[1][0], this[2][0]);
        result.yAxis.set(this[0][1], this[1][1], this[2][1]);
        result.zAxis.set(this[0][2], this[1][2], this[2][2]);
        result.origin.set(this[3][0], this[3][1], this[3][2]);

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

        M[0][0] = CP * CY;
        M[0][1] = CP * SY;
        M[0][2] = SP;
        M[0][3] = 0;

        M[1][0] = SR * SP * CY - CR * SY;
        M[1][1] = SR * SP * SY + CR * CY;
        M[1][2] = - SR * CP;
        M[1][3] = 0;

        M[2][0] = -(CR * SP * CY + SR * SY);
        M[2][1] = CY * SR - CR * SP * SY;
        M[2][2] = CR * CP;
        M[2][3] = 0;

        M[3][0] = 0;
        M[3][1] = 0;
        M[3][2] = 0;
        M[3][3] = 1;

        return M;
    }

    public static fromQuaternion(quat: GA.FQuaternion) {
        const M = FMatrix.make();

        let wx, wy, wz, xx, yy, yz, xy, xz, zz, x2, y2, z2;

        x2 = quat.x + quat.x; y2 = quat.y + quat.y; z2 = quat.z + quat.z;
        xx = quat.x * x2; xy = quat.x * y2; xz = quat.x * z2;
        yy = quat.y * y2; yz = quat.y * z2; zz = quat.z * z2;
        wx = quat.w * x2; wy = quat.w * y2; wz = quat.w * z2;

        M[0][0] = 1 - (yy + zz);
        M[1][0] = xy - wz;
        M[2][0] = xz + wy;
        M[3][0] = 0;

        M[0][1] = xy + wz;
        M[1][1] = 1 - (xx + zz);
        M[2][1] = yz - wx;
        M[3][1] = 0;

        M[0][2] = xz - wy;
        M[1][2] = yz + wx;
        M[2][2] = 1 - (xx + yy);
        M[3][2] = 0;

        M[0][3] = 0;
        M[1][3] = 0;
        M[2][3] = 0;
        M[3][3] = 1;

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
}

export default FMatrix;
export { FMatrix };
