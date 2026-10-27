import { MathUtils } from "three";
import FVector from "@l2js/engine/un-vector";
import { getRotatorQuaternionElements, sinRotator } from "@l2js/engine/utils/rotator";
import type { QuaternionArr, Vector3Arr } from "@l2js/engine";
import type { ScriptSlot_T } from "./vm";

const tmpRotation: QuaternionArr = [0, 0, 0, 1];

type UNativeRegistry_T = typeof import("./native-registry").UNativeRegistry;
type InterpCurve_T = { Points: { InVal: number, OutVal: number }[] };

function pre_op_not_bool                /* !  */(a: boolean) { return !a; }
function op_eq_bool_bool                /* == */(a: boolean, b: boolean) { return a === b; }
function op_not_eq_bool_bool            /* != */(a: boolean, b: boolean) { return a !== b; }
function op_and_bool_bool               /* && */(a: boolean, b: boolean) { return a && b; }
function op_xor_bool_bool               /* ^  */(a: boolean, b: boolean) { return !(a === b); }
function op_or_bool_bool                /* || */(a: boolean, b: boolean) { return a || b; }


function op_mul_num_num                 /* *  */(a: number, b: number) { return a * b; }
function op_div_num_num                 /* /  */(a: number, b: number) { return a / b; }
function op_add_num_num                 /* +  */(a: number, b: number) { return a + b; }
function op_sub_num_num                 /* -  */(a: number, b: number) { return a - b; }
function pre_op_sub_int(a: number) { return -a | 0; }
function pre_op_sub_num                 /* -  */(a: number) { return -a; }
function op_inv_num                     /* ~  */(a: number) { return ~a; }
function op_pow_num_num                 /* ** */(a: number, b: number) { return a ** b; }
function op_mod_num_num                 /* % */(a: number, b: number) { return a % b; }

function op_shl_num_num                 /* << */(a: number, b: number) { return a << b; }
function op_shr_arithmetic_num_num      /* >> */(a: number, b: number) { return a >> b; }
function op_shr_num_num                 /* >> */(a: number, b: number) { return a >>> b; }


function op_le_num_num                  /* <  */(a: number, b: number) { return a < b; }
function op_gt_num_num                  /* >  */(a: number, b: number) { return a > b; }
function op_leq_num_num                 /* <= */(a: number, b: number) { return a <= b; }
function op_gtq_num_num                 /* >= */(a: number, b: number) { return a >= b; }

function op_eq_num_num                  /* == */(a: number, b: number) { return a === b; }
function op_neq_num_num                 /* != */(a: number, b: number) { return a !== b; }

function op_eq_approx_num_num           /* ~= */(a: number, b: number) { return Math.abs(a - b) <= 0.0001; }

function op_and_bit_num_num             /* &  */(a: number, b: number) { return a & b; }
function op_xor_bit_num_num             /* ^  */(a: number, b: number) { return a ^ b; }
function op_or_bit_num_num              /* |  */(a: number, b: number) { return a | b; }

function min_num(a: number, b: number) { return Math.min(a, b); }
function max_num(a: number, b: number) { return Math.max(a, b); }
function clamp_num(v: number, a: number, b: number) { return MathUtils.clamp(v, a, b); }

function Abs(a: number) { return Math.abs(a); }
function Sin(a: number) { return Math.sin(a); }
function Asin(a: number) { return Math.asin(a); }
function Cos(a: number) { return Math.cos(a); }
function Acos(a: number) { return Math.acos(a); }
function Tan(a: number) { return Math.tan(a); }
// Core.dll 0x1013d268..0x1013d286 calls FPATAN with both float arguments.
function Atan(a: number, b: number) { return Math.atan2(a, b); }
function Exp(a: number) { return Math.exp(a); }
function Loge(a: number) { return Math.log(a); }
function Sqrt(a: number) { return Math.sqrt(a); }
function Square(a: number) { return a * a; }
function FRand() { return Math.random(); }
function FMin(a: number, b: number) { return min_num(a, b); }
function FMax(a: number, b: number) { return max_num(a, b); }
function FClamp(v: number, a: number, b: number) { return clamp_num(v, a, b); }
function Lerp(alpha: number, a: number, b: number) { return (b - a) * alpha + a; }
function Smerp(alpha: number, a: number, b: number) { return (-2 * (b - a) * alpha ** 3) + (3 * (b - a) * alpha ** 2) + a; }

function op_mul_byte_byte(a: number, b: number) { return (a * b) & 255; }
function op_div_byte_byte(a: number, b: number) { return b === 0 ? 0 : Math.trunc(a / b); }
function op_add_byte_byte(a: number, b: number) { return (a + b) & 255; }
function op_sub_byte_byte(a: number, b: number) { return (a - b) & 255; }
function op_inc_byte(a: number) { return (a + 1) & 255; }
function op_dec_byte(a: number) { return (a - 1) & 255; }
function op_mul_int_int(a: number, b: number) { return Math.imul(a, b); }
function op_div_int_int(a: number, b: number) {
    if (a === -2147483648 && b === -1) throw new Error(`UnrealScript integer division overflow.`);

    return b === 0 ? a : Math.trunc(a / b) | 0;
}
function op_add_int_int(a: number, b: number) { return (a + b) | 0; }
function op_sub_int_int(a: number, b: number) { return (a - b) | 0; }
function op_inc_int(a: number) { return (a + 1) | 0; }
function op_dec_int(a: number) { return (a - 1) | 0; }
function op_mul_assign_int_float(a: number, b: number) { return multiplyRotatorComponent(a, Math.fround(b)); }
function op_div_assign_int_float(a: number, b: number): number {
    b = Math.fround(b);
    const value = a / b;

    if (!Number.isFinite(value) || Math.abs(value) >= 9223372036854775808) return 0;
    if (Math.abs(value - Math.round(value)) > Math.abs(value) * Number.EPSILON * 2 || a === 0) return value | 0;

    // Core 0x1013b848 divides in x87 before converting to a signed 64-bit integer.
    const exponent = Math.floor(Math.log2(Math.abs(b))), significand = BigInt(Math.abs(b) * Math.pow(2, 23 - exponent)), shift = 23 - exponent;
    let numerator = BigInt(Math.abs(a)), denominator = significand, power = Math.floor(Math.log2(Math.abs(value)));

    if (shift >= 0) numerator <<= BigInt(shift);
    else denominator <<= BigInt(-shift);
    if (power >= 0 ? numerator < denominator << BigInt(power) : numerator << BigInt(-power) < denominator) power--;

    const scale = power - 63;
    let result = scale >= 0 ? roundRotatorQuotient(numerator, denominator << BigInt(scale)) : roundRotatorQuotient(numerator << BigInt(-scale), denominator);

    result = scale >= 0 ? result << BigInt(scale) : result >> BigInt(-scale);
    if ((a < 0) !== (b < 0)) result = -result;

    return Number(BigInt.asIntN(32, result));
}
function rand_int(max: number) { return Math.floor(Math.random() * max); }


function pre_op_sub_vector(a: Vector3Arr): Vector3Arr { return [-a[0], -a[1], -a[2]]; }
function op_mul_vector_float(a: Vector3Arr, b: number): Vector3Arr { return [a[0] * b, a[1] * b, a[2] * b]; }
function op_mul_float_vector(a: number, b: Vector3Arr): Vector3Arr { return op_mul_vector_float(b, a); }
function op_mul_vector_vector(a: Vector3Arr, b: Vector3Arr): Vector3Arr { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; }
function op_div_vector_float(a: Vector3Arr, b: number): Vector3Arr { return op_mul_vector_float(a, 1 / b); }
function op_add_vector_vector(a: Vector3Arr, b: Vector3Arr): Vector3Arr { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function op_sub_vector_vector(a: Vector3Arr, b: Vector3Arr): Vector3Arr { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function op_add_rotator_rotator(a: Vector3Arr, b: Vector3Arr): Vector3Arr { return [(a[0] + b[0]) | 0, (a[1] + b[1]) | 0, (a[2] + b[2]) | 0]; }
function op_sub_rotator_rotator(a: Vector3Arr, b: Vector3Arr): Vector3Arr { return [(a[0] - b[0]) | 0, (a[1] - b[1]) | 0, (a[2] - b[2]) | 0]; }
function op_eq_rotator_rotator(a: Vector3Arr, b: Vector3Arr) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
function op_neq_rotator_rotator(a: Vector3Arr, b: Vector3Arr) { return !op_eq_rotator_rotator(a, b); }

function multiplyRotatorComponent(a: number, b: number): number {
    if (Math.abs(a * b) >= 9223372036854775808) return 0;

    return (Math.imul(a, b | 0) + Math.trunc(a * (b % 1))) | 0;
}

function op_mul_rotator_float(a: Vector3Arr, b: number): Vector3Arr {
    b = Math.fround(b);

    return [multiplyRotatorComponent(a[0], b), multiplyRotatorComponent(a[1], b), multiplyRotatorComponent(a[2], b)];
}

function op_mul_float_rotator(a: number, b: Vector3Arr): Vector3Arr { return op_mul_rotator_float(b, a); }

function roundRotatorQuotient(a: bigint, b: bigint): bigint {
    const quotient = a / b, remainder = (a % b) * 2n;

    return quotient + (remainder > b || remainder === b && (quotient & 1n) !== 0n ? 1n : 0n);
}

function divideRotatorComponent(a: number, b: number): number {
    const value = a * (1 / b);

    if (!Number.isFinite(value) || Math.abs(value) >= 9223372036854775808) return 0;
    if (Math.abs(value - Math.round(value)) > Math.abs(value) * Number.EPSILON * 2) return value | 0;
    if (a === 0) return 0;

    // Core 0x1013f7b3 retains the 64-bit x87 reciprocal through all three integer conversions.
    const exponent = Math.floor(Math.log2(Math.abs(b))), significand = BigInt(Math.abs(b) * Math.pow(2, 23 - exponent)), power = Math.floor(Math.log2(1 / Math.abs(b))) - 63, shift = 23 - exponent - power;
    const inverse = shift >= 0 ? roundRotatorQuotient(1n << BigInt(shift), significand) : roundRotatorQuotient(1n, significand << BigInt(-shift));
    let result = BigInt(Math.abs(a)) * inverse, bits = result.toString(2).length - 64;

    if (bits > 0) result = roundRotatorQuotient(result, 1n << BigInt(bits));
    else bits = 0;

    const scale = power + bits;

    result = scale >= 0 ? result << BigInt(scale) : result >> BigInt(-scale);
    if ((a < 0) !== (b < 0)) result = -result;

    return Number(BigInt.asIntN(32, result));
}

function op_div_assign_rotator_float(a: Vector3Arr, b: number): Vector3Arr {
    b = Math.fround(b);

    return [divideRotatorComponent(a[0], b), divideRotatorComponent(a[1], b), divideRotatorComponent(a[2], b)];
}

function op_div_rotator_float(a: Vector3Arr, b: number): Vector3Arr {
    return Math.fround(b) === 0 ? [a[0], a[1], a[2]] : op_div_assign_rotator_float(a, b);
}

function rot_Normalize(a: Vector3Arr): Vector3Arr { return [(a[0] << 16) >> 16, (a[1] << 16) >> 16, (a[2] << 16) >> 16]; }
function op_clockwise_int_int(a: number, b: number): boolean {
    a &= 65535;
    b &= 65535;

    return Math.abs(a - b) > 32768 ? a < b : a > b;
}

function op_vec_rot_lsh(a: Vector3Arr, b: Vector3Arr): Vector3Arr {
    getRotatorQuaternionElements(b[0], b[1], b[2], tmpRotation);
    tmpRotation[0] = -tmpRotation[0]; tmpRotation[1] = -tmpRotation[1]; tmpRotation[2] = -tmpRotation[2];
    return FVector.applyQuaternionElements(a, tmpRotation, [0, 0, 0]);
}
function op_vec_rot_rsh(a: Vector3Arr, b: Vector3Arr): Vector3Arr {
    getRotatorQuaternionElements(b[0], b[1], b[2], tmpRotation);
    return FVector.applyQuaternionElements(a, tmpRotation, [0, 0, 0]);
}

function op_eq_vector_vector(a: Vector3Arr, b: Vector3Arr) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
function op_neq_vector_vector(a: Vector3Arr, b: Vector3Arr) { return !op_eq_vector_vector(a, b); }

function op_dot_vector_vector(a: Vector3Arr, b: Vector3Arr) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function op_cross_vector_vector(a: Vector3Arr, b: Vector3Arr): Vector3Arr { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

function fn_not_implemented(...args: any[]) { throw new Error(`Called non-implemented function with arguments: ${JSON.stringify(args, undefined, 4)}`) };

function VSize(a: Vector3Arr) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
function Normal(a: Vector3Arr): Vector3Arr {
    const x = Math.fround(a[0]), y = Math.fround(a[1]), z = Math.fround(a[2]);
    const lengthSq = x * x + y * y + z * z;

    if (lengthSq < 1e-8) return [0, 0, 0];

    // Core SafeNormal 0x1014fc8f..0x1014fcae retains the x87 inverse for Z, stores float scale for X/Y.
    const inverse = 1 / Math.sqrt(lengthSq), scale = Math.fround(inverse);

    return [Math.fround(x * scale), Math.fround(y * scale), Math.fround(z * inverse)];
}
function VRand(): Vector3Arr {
    // Core VRand 0x101384d0 rejects outside the unit sphere before UnsafeNormal.
    let x: number, y: number, z: number, last: number;

    do {
        x = Math.fround(rand_int(32768) * 0.000030518509447574615 * 2 - 1);
        y = Math.fround(rand_int(32768) * 0.000030518509447574615 * 2 - 1);
        last = rand_int(32768) * 0.000030518509447574615 * 2 - 1;
        z = Math.fround(last);
    } while (x * x + y * y + last * z > 1);

    const inverse = 1 / Math.sqrt(x * x + y * y + z * z), scale = Math.fround(inverse);

    return [Math.fround(x * scale), Math.fround(y * scale), Math.fround(z * inverse)];
}

function Vector2Rotator(v: Vector3Arr): Vector3Arr {
    // Core FVector::Rotation 0x1014f310 uses 65535/(2*PI) and truncates.
    const scale = 32767.5 / Math.PI;
    const yaw = Math.trunc(Math.atan2(v[1], v[0]) * scale);
    const pitch = Math.trunc(Math.atan2(v[2], Math.hypot(v[0], v[1])) * scale);

    return [pitch, yaw, 0];
}

function Rotator2Vector(r: Vector3Arr): Vector3Arr {
    const pitch = r[0] * Math.PI / 32768;
    const yaw = r[1] * Math.PI / 32768;
    const cosPitch = Math.cos(pitch);

    return [cosPitch * Math.cos(yaw), cosPitch * Math.sin(yaw), Math.sin(pitch)];
}

function getRotationAxes(a: Vector3Arr, isInverse = false): Vector3Arr[] {
    const sp = sinRotator(a[0]), cp = sinRotator(a[0] + 16384), sy = sinRotator(a[1]), cy = sinRotator(a[1] + 16384), sr = sinRotator(a[2]), cr = sinRotator(a[2] + 16384), f = Math.fround;

    // Core FCoords 0x10111b30/0x10111650 round after each rotation, in opposite orders.
    if (isInverse) return [[f(cp * cy), f(sr * f(sp * cy) - cr * sy), f(-cr * f(sp * cy) - sr * sy)], [f(cp * sy), f(sr * f(sp * sy) + cr * cy), f(sr * cy - cr * f(sp * sy))], [sp, f(-sr * cp), f(cr * cp)]];

    return [[f(cp * cy), f(cp * sy), sp], [f(f(sr * sp) * cy - cr * sy), f(f(sr * sp) * sy + cr * cy), f(-sr * cp)], [f(-f(cr * sp) * cy - sr * sy), f(sr * cy - f(cr * sp) * sy), f(cr * cp)]];
}

function GetAxes(a: Vector3Arr, x: ScriptSlot_T, y: ScriptSlot_T, z: ScriptSlot_T): void {
    const axes = getRotationAxes(a);

    x.set(axes[0]); y.set(axes[1]); z.set(axes[2]);
}

function GetUnAxes(a: Vector3Arr, x: ScriptSlot_T, y: ScriptSlot_T, z: ScriptSlot_T): void {
    const axes = getRotationAxes(a, true);

    x.set(axes[0]); y.set(axes[1]); z.set(axes[2]);
}

function vec_Invert(x: ScriptSlot_T, y: ScriptSlot_T, z: ScriptSlot_T): void {
    const a = x.get() as Vector3Arr, b = y.get() as Vector3Arr, c = z.get() as Vector3Arr, f = Math.fround;
    const determinant = (b[1] * c[2] - b[2] * c[1]) * a[0] + (b[2] * c[0] - b[0] * c[2]) * a[1] + (b[0] * c[1] - b[1] * c[0]) * a[2], scale = 1 / (determinant === 0 ? 1 : determinant);
    const axes: Vector3Arr[] = [[f((b[1] * c[2] - b[2] * c[1]) * scale), f((a[2] * c[1] - a[1] * c[2]) * scale), f(f(a[1] * b[2] - a[2] * b[1]) * scale)], [f((b[2] * c[0] - b[0] * c[2]) * scale), f((a[0] * c[2] - a[2] * c[0]) * scale), f(f(a[2] * b[0] - a[0] * b[2]) * scale)], [f((b[0] * c[1] - b[1] * c[0]) * scale), f((a[1] * c[0] - a[0] * c[1]) * scale), f(f(a[0] * b[1] - a[1] * b[0]) * scale)]];

    x.set(axes[0]); y.set(axes[1]); z.set(axes[2]);
}

function vec_MirrorByNormal(a: Vector3Arr, b: Vector3Arr): Vector3Arr {
    const n = Normal(b), f = Math.fround, dot = f(a[0] * n[0] + a[1] * n[1] + a[2] * n[2]);

    return [f(a[0] - f(2 * n[0] * dot)), f(a[1] - 2 * n[1] * dot), f(a[2] - 2 * n[2] * dot)];
}

function rot_OrthoRotation(x: Vector3Arr, y: Vector3Arr, z: Vector3Arr): Vector3Arr {
    // Core FCoords::OrthoRotation 0x1014f971 uses 65536 units, unlike FVector::Rotation.
    const scale = 32768 / Math.PI, rotation: Vector3Arr = [Math.trunc(Math.atan2(x[2], Math.hypot(x[0], x[1])) * scale), Math.trunc(Math.atan2(x[1], x[0]) * scale), 0], axis = getRotationAxes(rotation)[1];

    rotation[2] = Math.trunc(Math.atan2(axis[0] * z[0] + axis[1] * z[1] + axis[2] * z[2], axis[0] * y[0] + axis[1] * y[1] + axis[2] * y[2]) * scale);

    return rotation;
}

function RotRand(hasRoll = false): Vector3Arr {
    const yaw = rand_int(32768) * 2, pitch = rand_int(32768) * 2;

    return [pitch, yaw, hasRoll ? rand_int(32768) * 2 : 0];
}

function QuatProduct(a: QuaternionArr, b: QuaternionArr): QuaternionArr {
    const f = Math.fround;

    return [f(a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1]), f(a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0]), f(a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3]), f(a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2])];
}

function QuatInvert(a: QuaternionArr): QuaternionArr { return [-a[0], -a[1], -a[2], a[3]]; }

function QuatRotateVector(q: QuaternionArr, v: Vector3Arr): Vector3Arr {
    const f = Math.fround, scale = f(q[3] * q[3] - (q[0] * q[0] + q[1] * q[1] + q[2] * q[2])), dot = 2 * (q[0] * v[0] + q[1] * v[1] + q[2] * v[2]), roundedDot = f(dot), w = f(q[3] * 2);

    return [f(f(v[0] * scale + f((q[1] * v[2] - q[2] * v[1]) * w)) + f(dot * q[0])), f(f(v[1] * scale + (q[2] * v[0] - q[0] * v[2]) * w) + roundedDot * q[1]), f(f(f(v[2] * scale) + f(q[0] * v[1] - q[1] * v[0]) * w) + roundedDot * q[2])];
}

function QuatFindBetween(a: Vector3Arr, b: Vector3Arr): QuaternionArr {
    const f = Math.fround, x = f(a[1] * b[2] - a[2] * b[1]), y = f(a[2] * b[0] - a[0] * b[2]), z = f(a[0] * b[1] - a[1] * b[0]), length = f(Math.sqrt(x * x + y * y + z * z));

    if (length < 0.0001) return [0, 0, 0, 1];

    let angle = Math.asin(length);

    if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < 0) angle = Math.PI - angle;
    angle *= 0.5;

    const sine = Math.sin(angle), inverse = 1 / length;

    return [f(x * inverse * sine), f(f(y * inverse) * sine), f(f(z * inverse) * sine), f(Math.cos(f(angle)))];
}

function QuatFromAxisAndAngle(axis: Vector3Arr, angle: number): QuaternionArr {
    const n = Normal(axis), sine = Math.fround(Math.sin(angle * 0.5)), f = Math.fround;

    return [f(n[0] * sine), f(n[1] * sine), f(n[2] * sine), f(Math.cos(angle * 0.5))];
}

function InterpCurveEval(curve: InterpCurve_T, input: number): number {
    const points = curve.Points;

    if (points.length < 2 || input < points[0].InVal || input > points[points.length - 1].InVal) return 0;

    for (let i = 1; i < points.length; i++) {
        if (points[i].InVal < input) continue;

        const previous = points[i - 1], current = points[i], alpha = Math.fround((input - previous.InVal) / (current.InVal - previous.InVal));

        if (!(alpha >= 0 && alpha <= 1)) throw new Error(`Invalid interpolation curve interval '${i}'.`);

        return Math.fround((current.OutVal - previous.OutVal) * alpha + previous.OutVal);
    }

    return 0;
}

function InterpCurveGetInputDomain(curve: InterpCurve_T, min: ScriptSlot_T, max: ScriptSlot_T): void {
    const points = curve.Points;

    min.set(points.length < 2 ? 0 : points[0].InVal);
    max.set(points.length < 2 ? 0 : points[0].InVal);

    for (let i = 1; i < points.length; i++) {
        min.set(Math.min(min.get() as number, points[i].InVal));
        max.set(Math.max(max.get() as number, points[i].InVal));
    }
}

function InterpCurveGetOutputRange(curve: InterpCurve_T, min: ScriptSlot_T, max: ScriptSlot_T): void {
    const points = curve.Points;

    min.set(points.length < 2 ? 0 : points[0].OutVal);
    max.set(points.length < 2 ? 0 : points[0].OutVal);

    for (let i = 1; i < points.length; i++) {
        min.set(Math.min(min.get() as number, points[i].OutVal));
        max.set(Math.max(max.get() as number, points[i].OutVal));
    }
}

function Log(s: string, tag?: string) { console.log(`[UEScript] ${tag ? `{${tag}} ` : ""}${s}`); }
function Warn(s: string) { console.warn(`[UEScript] ${s}`); }

function asString(value: string | null | undefined): string { return value === null || value === undefined ? "" : `${value}`; }
function op_cat_str_str(a: string, b: string) { return asString(a) + asString(b); }
function op_scat_str_str(a: string, b: string) { return asString(a) + " " + asString(b); }
function op_le_str_str(a: string, b: string) { return asString(a) < asString(b); }
function op_ge_str_str(a: string, b: string) { return asString(a) > asString(b); }
function op_leq_str_str(a: string, b: string) { return asString(a) <= asString(b); }
function op_geq_str_str(a: string, b: string) { return asString(a) >= asString(b); }
function op_eq_str_str(a: string, b: string) { return asString(a) === asString(b); }
function op_neq_str_str(a: string, b: string) { return asString(a) !== asString(b); }
function op_eq_case_str_str(a: string, b: string) { return asString(a).toLowerCase() === asString(b).toLowerCase(); }

function Len(a: string): number { return asString(a).length; }
function InStr(a: string, b: string): number { return asString(a).indexOf(asString(b)); }
function Mid(a: string, ...b: [number, number?]) { return asString(a).slice(...b); }
function Left(a: string, b: number) { return Mid(asString(a), 0, b); }
function Right(a: string, b: number) { return Mid(asString(a), -b); }
function Caps(a: string) { return asString(a).toUpperCase(); }
function Chr(a: number) { return String.fromCharCode(a); }
function Asc(a: string) { return a.charCodeAt(0); }
function op_eq_object_object(a: unknown, b: unknown) { return a === b; }
function op_neq_object_object(a: unknown, b: unknown) { return a !== b; }
function op_eq_name_name(a: string, b: string) { return a.toLowerCase() === b.toLowerCase(); }
function op_neq_name_name(a: string, b: string) { return !op_eq_name_name(a, b); }

export function registerNativeFuncs(registry: UNativeRegistry_T) {
    const native = registry.registerNativeFunc.bind(registry);

    // boolean operators
    native(129, pre_op_not_bool);
    native(242, op_eq_bool_bool);
    native(243, op_not_eq_bool_bool);
    native(130, op_and_bool_bool);
    native(131, op_xor_bool_bool);
    native(132, op_or_bool_bool);

    // byte operators
    native(133, op_mul_byte_byte);
    native(134, op_div_byte_byte);
    native(135, op_add_byte_byte);
    native(136, op_sub_byte_byte);
    native(137, op_inc_byte);
    native(138, op_dec_byte);
    native(139, op_inc_byte);
    native(140, op_dec_byte);
    native(141, op_inv_num);

    // integer operators
    native(143, pre_op_sub_int);
    native(144, op_mul_int_int);
    native(145, op_div_int_int);
    native(146, op_add_int_int);
    native(147, op_sub_int_int);
    native(148, op_shl_num_num);
    native(149, op_shr_arithmetic_num_num);
    native(196, op_shr_num_num);
    native(150, op_le_num_num);
    native(151, op_gt_num_num);
    native(152, op_leq_num_num);
    native(153, op_gtq_num_num);
    native(154, op_eq_num_num);
    native(155, op_neq_num_num);
    native(156, op_and_bit_num_num);
    native(157, op_xor_bit_num_num);
    native(158, op_or_bit_num_num);
    native(159, op_mul_assign_int_float);
    native(160, op_div_assign_int_float);
    native(161, op_add_int_int);
    native(162, op_sub_int_int);
    native(163, op_inc_int);
    native(164, op_dec_int);
    native(165, op_inc_int);
    native(166, op_dec_int);

    // integer functions
    native(167, rand_int);
    native(249, min_num);
    native(250, max_num);
    native(251, clamp_num);

    // float operators
    native(169, pre_op_sub_num);
    native(170, op_pow_num_num);
    native(171, op_mul_num_num);
    native(172, op_div_num_num);
    native(173, op_mod_num_num);
    native(174, op_add_num_num);
    native(175, op_sub_num_num);
    native(176, op_le_num_num);
    native(177, op_gt_num_num);
    native(178, op_leq_num_num);
    native(179, op_gtq_num_num);
    native(180, op_eq_num_num);
    native(210, op_eq_approx_num_num);
    native(181, op_neq_num_num);
    native(182, op_mul_num_num);
    native(183, op_div_num_num);
    native(184, op_add_num_num);
    native(185, op_sub_num_num);

    // float functions
    native(186, Abs);
    native(187, Sin);
    native("Asin", Asin);
    native(188, Cos);
    native("Acos", Acos);
    native(189, Tan);
    native(190, Atan);
    native(191, Exp);
    native(192, Loge);
    native(193, Sqrt);
    native(194, Square);
    native(195, FRand);
    native(244, FMin);
    native(245, FMax);
    native(246, FClamp);
    native(247, Lerp);
    native(248, Smerp);

    // vector operators
    native(211, pre_op_sub_vector);
    native(212, op_mul_vector_float);
    native(213, op_mul_float_vector);
    native(296, op_mul_vector_vector);
    native(214, op_div_vector_float);
    native(215, op_add_vector_vector);
    native(216, op_sub_vector_vector);
    native(275, op_vec_rot_lsh);  // vector <<    ( vector A, rotator B );
    native(276, op_vec_rot_rsh);  // vector >>    ( vector A, rotator B );
    native(217, op_eq_vector_vector);
    native(218, op_neq_vector_vector);
    native(219, op_dot_vector_vector);
    native(220, op_cross_vector_vector);
    native(221, op_mul_vector_float);
    native(297, op_mul_vector_vector);
    native(222, op_div_vector_float);
    native(223, op_add_vector_vector);
    native(224, op_sub_vector_vector);

    // vector functions
    native(225, VSize);
    native(226, Normal);
    native(227, vec_Invert); // Invert
    native(252, VRand);
    native(300, vec_MirrorByNormal); // MirrorByNormal

    // Rotator operators and functions.
    native(142, op_eq_rotator_rotator); // static final operator(24) bool ==     ( rotator A, rotator B );
    native(203, op_neq_rotator_rotator); // static final operator(26) bool !=     ( rotator A, rotator B );
    native(287, op_mul_rotator_float); // static final operator(16) rotator *   ( rotator A, float    B );
    native(288, op_mul_float_rotator); // static final operator(16) rotator *   ( float    A, rotator B );
    native(289, op_div_rotator_float); // static final operator(16) rotator /   ( rotator A, float    B );
    native(290, op_mul_rotator_float); // static final operator(34) rotator *=  ( out rotator A, float B  );
    native(291, op_div_assign_rotator_float); // static final operator(34) rotator /=  ( out rotator A, float B  );
    native(316, op_add_rotator_rotator); // static final operator(20) rotator +   ( rotator A, rotator B );
    native(317, op_sub_rotator_rotator); // static final operator(20) rotator -   ( rotator A, rotator B );
    native(318, op_add_rotator_rotator); // static final operator(34) rotator +=  ( out rotator A, rotator B );
    native(319, op_sub_rotator_rotator); // static final operator(34) rotator -=  ( out rotator A, rotator B );
    native(229, GetAxes); // static final function GetAxes         ( rotator A, out vector X, out vector Y, out vector Z );
    native(230, GetUnAxes); // static final function GetUnAxes       ( rotator A, out vector X, out vector Y, out vector Z );
    native(320, RotRand); // static final function rotator RotRand ( optional bool bRoll );
    native("OrthoRotation", rot_OrthoRotation); //      static final function rotator OrthoRotation( vector X, vector Y, vector Z );
    native("Normalize", rot_Normalize); //      static final function rotator Normalize( rotator Rot );
    native("ClockwiseFrom_IntInt", op_clockwise_int_int); //static final operator(24) bool ClockwiseFrom( int A, int B );
    native("Vector2Rotator", Vector2Rotator); //      static final function rotator Vector2Rotator( vector V );
    native("Rotator2Vector", Rotator2Vector); //      static final function vector Rotator2Vector( rotator R );


    // String operators.
    native(112, op_cat_str_str);
    native(168, op_scat_str_str);
    native(115, op_le_str_str);
    native(116, op_ge_str_str);
    native(120, op_leq_str_str);
    native(121, op_geq_str_str);
    native(122, op_eq_str_str);
    native(123, op_neq_str_str);
    native(124, op_eq_case_str_str);

    // String functions.
    native(125, Len); // static final function int    Len    ( coerce string S );
    native(126, InStr); // static final function int    InStr  ( coerce string S, coerce string t );
    native(127, Mid); // static final function string Mid    ( coerce string S, int i, optional int j );
    native(128, Left); // static final function string Left   ( coerce string S, int i );
    native(234, Right); // static final function string Right  ( coerce string S, int i );
    native(235, Caps); // static final function string Caps   ( coerce string S );
    native(236, Chr); // static final function string Chr    ( int i );
    native(237, Asc); // static final function int    Asc    ( string S );

    // Object operators.
    native(114, op_eq_object_object); // static final operator(24) bool == ( Object A, Object B );
    native(119, op_neq_object_object); // static final operator(26) bool != ( Object A, Object B );

    // Name operators.
    native(254, op_eq_name_name); // static final operator(24) bool == ( name A, name B );
    native(255, op_neq_name_name); // static final operator(26) bool != ( name A, name B );

    // InterpCurve operator
    native("InterpCurveEval", InterpCurveEval); //   static final function float InterpCurveEval( InterpCurve curve, float input );
    native("InterpCurveGetOutputRange", InterpCurveGetOutputRange); // static final function InterpCurveGetOutputRange( InterpCurve curve, out float min, out float max );
    native("InterpCurveGetInputDomain", InterpCurveGetInputDomain); // static final function InterpCurveGetInputDomain( InterpCurve curve, out float min, out float max );

    // Quaternion functions
    native("QuatProduct", QuatProduct); //   static final function Quat QuatProduct( Quat A, Quat B );
    native("QuatInvert", QuatInvert); //    static final function Quat QuatInvert( Quat A );
    native("QuatRotateVector", QuatRotateVector); //  static final function vector QuatRotateVector( Quat A, vector B );
    native("QuatFindBetween", QuatFindBetween); //   static final function Quat QuatFindBetween( Vector A, Vector B );
    native("QuatFromAxisAndAngle", QuatFromAxisAndAngle); //  static final function Quat QuatFromAxisAndAngle( Vector Axis, Float Angle );

    // Logging.
    native(231, Log); // final static function Log(coerce string S, optional name Tag);
    native(232, Warn); // final static function Warn(coerce string S);
    native("Localize", function Localize() { fn_not_implemented() }); // static function string Localize(string SectionName, string KeyName, string PackageName);

    // Goto state and label.
    native(113, fn_not_implemented); // final function GotoState(optional name NewState, optional name Label);
    native(281, fn_not_implemented); // final function bool IsInState(name TestState);
    native(284, fn_not_implemented); // final function name GetStateName();

    // Objects.
    native(258, fn_not_implemented); // static final function bool ClassIsChildOf(class TestClass, class ParentClass );
    native(303, fn_not_implemented); // final function bool IsA(name ClassName);

    // Probe messages.
    native(117, fn_not_implemented); // final function Enable(name ProbeFunc);
    native(118, fn_not_implemented); // final function Disable(name ProbeFunc);

    // Properties.
    native("GetPropertyText", function GetPropertyText() { fn_not_implemented() }); //    final function string GetPropertyText( string PropName );
    native("SetPropertyText", function SetPropertyText() { fn_not_implemented() }); // final function SetPropertyText( string PropName, string PropValue );
    native("GetEnum", function GetEnum() { fn_not_implemented() }); // static final function name GetEnum( object E, int i );
    native("DynamicLoadObject", function DynamicLoadObject(objectName: string) { return objectName; }); // static final function object DynamicLoadObject( string ObjectName, class ObjectClass, optional bool MayFail );
    native("FindObject", function FindObject() { fn_not_implemented() }); // static final function object FindObject( string ObjectName, class ObjectClass );

    // Configuration.
    native(536, fn_not_implemented);    // final function SaveConfig();
    native("StaticSaveConfig", function StaticSaveConfig() { fn_not_implemented() });   // static final function StaticSaveConfig();
    native("ResetConfig", function ResetConfig() { fn_not_implemented() });    // static final function ResetConfig();

}

export default registerNativeFuncs;
