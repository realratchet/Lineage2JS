import GMath from "@client/assets/unreal/un-gmath";
import { UObject } from "@l2js/core";


const RAD2DEG = 180 / Math.PI;
const _PI = Math.PI;
const _TWO_PI = 2 * _PI;
const _TWO_TO_FIFTEEN = 2 ** 15;
const _INV_TWO_TO_FIFTEEN = 1 / _TWO_TO_FIFTEEN;
const _INV_TWO_TO_FIFTEEN_TIMES_PI = _INV_TWO_TO_FIFTEEN * _PI;

enum RotName {
    PITCH,                          // looking up and down (0=Straight Ahead, +Up, -Down).
    YAW,                            // rotating around (running in circles), 0=East, +North, -South.
    ROLL                            // rotation about axis of screen, 0=Straight, +Clockwise, -CCW.
}

abstract class FRotator extends UObject {
    declare public readonly pitch: number;
    declare public readonly yaw: number;
    declare public readonly roll: number;

    public constructor(pitch = 0, yaw = 0, roll = 0) {
        super();

        this.pitch = pitch;
        this.yaw = yaw;
        this.roll = roll;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Pitch": "pitch",
            "Yaw": "yaw",
            "Roll": "roll"
        });
    }

    public toVector() { return GMath().unitCoords.div(this).xAxis; }
    public toArray() { return [this.pitch, this.yaw, this.roll]; }

    public getEulerElements(): GD.EulerArr {
        const yAxis = (-this.yaw * _INV_TWO_TO_FIFTEEN_TIMES_PI) % _TWO_PI;
        const xAxis = (this.roll * _INV_TWO_TO_FIFTEEN_TIMES_PI) % _TWO_PI;
        const zAxis = (_TWO_PI + this.pitch * _INV_TWO_TO_FIFTEEN_TIMES_PI) % _TWO_PI;

        // const euler = new Array<number>(3);
        // euler[RotName.YAW] = this.yaw * (180 / 32768.0) * DEG2RAD;
        // euler[RotName.PITCH] = this.pitch * (180 / 32768.0) * DEG2RAD;
        // euler[RotName.ROLL] = this.roll * (180 / 32768.0) * DEG2RAD;

        // // debugger;

        // return [...euler, "XYZ"];

        // const yAxis = Math.asin(GMath.sin(TrigFLOAT[this.yaw]));
        // const xAxis = Math.asin(GMath.sin(TrigFLOAT[this.roll]));
        // const zAxis = Math.asin(GMath.sin(TrigFLOAT[this.pitch]));

        // const v = this.toVector()

        // debugger;

        return [xAxis, yAxis, zAxis, "XZY"];
    }

    public toString(asEuler: boolean = false) {
        if (asEuler) {
            const [x, z, y, axis] = this.getEulerElements();

            return `Rotator=(x=${(x * RAD2DEG).toFixed(2)}, y=${(y * RAD2DEG).toFixed(2)}, z=${(z * RAD2DEG).toFixed(2)}, axis=${axis})`;
        }

        return `Rotator=(pitch=${this.pitch}, yaw=${this.yaw}, roll=${this.roll})`;
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

    public getQuaternionElements(): GD.QuaternionArr {
        const SR = GMath().sin(this.roll),
            SP = GMath().sin(this.pitch),
            SY = GMath().sin(this.yaw),
            CR = GMath().cos(this.roll),
            CP = GMath().cos(this.pitch),
            CY = GMath().cos(this.yaw);

        const LX = CP * CY;
        const LY = CP * SY;
        const LZ = SP;

        const PX = SR * SP * CY - CR * SY;
        const PY = SR * SP * SY + CR * CY;
        const PZ = - SR * CP;

        const YX = -(CR * SP * CY + SR * SY);
        const YY = CY * SR - CR * SP * SY;
        const YZ = CR * CP;

        // Matrix elements arranged as:
        // m00 = LX, m01 = YX, m02 = PX
        // m10 = LZ, m11 = YZ, m12 = PZ
        // m20 = LY, m21 = YY, m22 = PY
        const m00 = LX, m01 = YX, m02 = PX;
        const m10 = LZ, m11 = YZ, m12 = PZ;
        const m20 = LY, m21 = YY, m22 = PY;

        const trace = m00 + m11 + m22;
        let x, y, z, w;

        if (trace > 0) {
            const s = Math.sqrt(trace + 1.0) * 2; // s = 4 * qw
            w = 0.25 * s;
            x = (m21 - m12) / s;
            y = (m02 - m20) / s;
            z = (m10 - m01) / s;
        } else if ((m00 > m11) && (m00 > m22)) {
            const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2; // s = 4 * qx
            w = (m21 - m12) / s;
            x = 0.25 * s;
            y = (m01 + m10) / s;
            z = (m02 + m20) / s;
        } else if (m11 > m22) {
            const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2; // s = 4 * qy
            w = (m02 - m20) / s;
            x = (m01 + m10) / s;
            y = 0.25 * s;
            z = (m12 + m21) / s;
        } else {
            const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2; // s = 4 * qz
            w = (m10 - m01) / s;
            x = (m02 + m20) / s;
            y = (m12 + m21) / s;
            z = 0.25 * s;
        }

        return [x, y, z, w];
    }
}

export default FRotator;
export { FRotator };
