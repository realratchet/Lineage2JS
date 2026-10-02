import GMath from "./un-gmath";
import UObject from "./un-object";
import { getRotatorQuaternionElements } from "./utils/rotator";
import type { EulerArr, QuaternionArr } from "./library-types";


const RAD2DEG = 180 / Math.PI;
const _PI = Math.PI;
const _TWO_PI = 2 * _PI;
const _TWO_TO_FIFTEEN = 2 ** 15;
const _INV_TWO_TO_FIFTEEN = 1 / _TWO_TO_FIFTEEN;
const _INV_TWO_TO_FIFTEEN_TIMES_PI = _INV_TWO_TO_FIFTEEN * _PI;

export enum RotName {
    PITCH,                          // looking up and down (0=Straight Ahead, +Up, -Down).
    YAW,                            // rotating around (running in circles), 0=East, +North, -South.
    ROLL                            // rotation about axis of screen, 0=Straight, +Clockwise, -CCW.
}

export abstract class FRotator extends UObject {
    public static readonly plainStructFields = true; // values live in fields, not propertyDict (see UObject.loadNative)

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

    public getEulerElements(): EulerArr {
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

    public getQuaternionElements(): QuaternionArr {
        return getRotatorQuaternionElements(this.pitch, this.yaw, this.roll);
    }
}

export default FRotator;
