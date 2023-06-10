import { BufferValue } from "@l2js/core";
import { RAD2DEG } from "three/src/math/MathUtils";

const _PI = Math.PI;
const _TWO_PI = 2 * _PI;
const _TWO_TO_FIFTEEN = 2 ** 15;
const _INV_TWO_TO_FIFTEEN = 1 / _TWO_TO_FIFTEEN;
const _INV_TWO_TO_FIFTEEN_TIMES_PI = _INV_TWO_TO_FIFTEEN * _PI;

class GMath {
    static ANGLE_SHIFT = 2;		// Bits to right-shift to get lookup value.
    static ANGLE_BITS = 14;		// Number of valid bits in angles.
    static NUM_ANGLES = 16384; 	// Number of angles that are in lookup table.
    static NUM_SQRTS = 16384;	// Number of square roots in lookup table.
    static ANGLE_MASK = ((1 << GMath.ANGLE_BITS) - 1) << (16 - GMath.ANGLE_BITS);

    static sin(i: number) { return TrigFLOAT[((i >> GMath.ANGLE_SHIFT) & (GMath.NUM_ANGLES - 1))]; }
    static cos(i: number) { return TrigFLOAT[(((i + 16384) >> GMath.ANGLE_SHIFT) & (GMath.NUM_ANGLES - 1))]; };
}

const TrigFLOAT = new Array<number>(GMath.NUM_ANGLES);
const SqrtFLOAT = new Array<number>(GMath.NUM_SQRTS);

// Init base angle table.
for (let i = 0; i < GMath.NUM_ANGLES; i++)
    TrigFLOAT[i] = Math.sin(i * 2 * Math.PI / GMath.NUM_ANGLES);

// Init square root table.

for (let i = 0; i < GMath.NUM_SQRTS; i++)
    SqrtFLOAT[i] = Math.sqrt(i / 16384);


class FRotator implements C.IConstructable {
    public pitch: number;
    public yaw: number;
    public roll: number;

    public constructor(pitch = 0, yaw = 0, roll = 0) {
        this.pitch = pitch;
        this.yaw = yaw;
        this.roll = roll;
    }

    public load(pkg: C.APackage): this {
        const int32 = new BufferValue(BufferValue.int32);

        for (let key of ["pitch", "yaw", "roll"])
            this[key as ("pitch" | "yaw" | "roll")] = pkg.read(int32).value as number;

        return this;
    }

    public getEulerElements(): GD.EulerArr {
        const yAxis = (-this.yaw * _INV_TWO_TO_FIFTEEN_TIMES_PI) % _TWO_PI;
        const xAxis = (_TWO_PI - this.roll * _INV_TWO_TO_FIFTEEN_TIMES_PI) % _TWO_PI;
        const zAxis = (_TWO_PI + this.pitch * _INV_TWO_TO_FIFTEEN_TIMES_PI) % _TWO_PI;

        // const yAxis = Math.asin(GMath.sin(TrigFLOAT[this.yaw]));
        // const xAxis = Math.asin(GMath.sin(TrigFLOAT[this.roll]));
        // const zAxis = Math.asin(GMath.sin(TrigFLOAT[this.pitch]));

        return [xAxis, yAxis, zAxis, "XYZ"];
    }

    public toString() {
        const [x, z, y, axis] = this.getEulerElements();


        return `Rotator=(x=${(x * RAD2DEG).toFixed(2)}, y=${(y * RAD2DEG).toFixed(2)}, z=${(z * RAD2DEG).toFixed(2)}, axis=${axis})`;
    }

    public rotationMatrix() {
        throw new Error("Not implemented");
        // let SR = GMath.SinTab(this.roll),
        //     SP = GMath.SinTab(this.pitch),
        //     SY = GMath.SinTab(this.yaw),
        //     CR = GMath.CosTab(this.roll),
        //     CP = GMath.CosTab(this.pitch),
        //     CY = GMath.CosTab(this.yaw);

        // M[0][0] = CP * CY;
        // M[0][1] = CP * SY;
        // M[0][2] = SP;
        // M[0][3] = 0;

        // M[1][0] = SR * SP * CY - CR * SY;
        // M[1][1] = SR * SP * SY + CR * CY;
        // M[1][2] = - SR * CP;
        // M[1][3] = 0;

        // M[2][0] = -(CR * SP * CY + SR * SY);
        // M[2][1] = CY * SR - CR * SP * SY;
        // M[2][2] = CR * CP;
        // M[2][3] = 0;

        // M[3][0] = 0;
        // M[3][1] = 0;
        // M[3][2] = 0;
        // M[3][3] = 1;
    }
}

export default FRotator;
export { FRotator };
