
import type { QuaternionArr } from "../library-types";

const _TWO_PI = 2 * Math.PI;

export function getRotatorQuaternionElements(pitch: number, yaw: number, roll: number, target: QuaternionArr = [0, 0, 0, 1]): QuaternionArr {
    const SR = sinRotator(roll),
        SP = sinRotator(pitch),
        SY = sinRotator(yaw),
        CR = sinRotator(roll + 0x4000),
        CP = sinRotator(pitch + 0x4000),
        CY = sinRotator(yaw + 0x4000);

    const LX = CP * CY;
    const LY = CP * SY;
    const LZ = SP;

    const PX = SR * SP * CY - CR * SY;
    const PY = SR * SP * SY + CR * CY;
    const PZ = - SR * CP;

    const YX = -(CR * SP * CY + SR * SY);
    const YY = CY * SR - CR * SP * SY;
    const YZ = CR * CP;

    // Native UE2 rotation matrix (column-vector convention: columns are the
    // world-space images of the local X/Y/Z axes), no axis swap:
    // m00 = LX, m01 = PX, m02 = YX
    // m10 = LY, m11 = PY, m12 = YY
    // m20 = LZ, m21 = PZ, m22 = YZ
    const m00 = LX, m01 = PX, m02 = YX;
    const m10 = LY, m11 = PY, m12 = YY;
    const m20 = LZ, m21 = PZ, m22 = YZ;

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

    target[0] = x;
    target[1] = y;
    target[2] = z;
    target[3] = w;

    return target;
}

function sinRotator(value: number): number {
    return Math.sin(((value >> 2) & 0x3fff) * _TWO_PI / 0x4000);
}

export default getRotatorQuaternionElements;
