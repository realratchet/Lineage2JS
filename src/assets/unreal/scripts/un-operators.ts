import { MathUtils } from "three";
import FVector from "../un-vector";

type UNativeRegistry = import("./un-native-registry").UNativeRegistry;

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
function op_inc_num                     /* ++ */(a: number) { return a + 1; }
function op_dec_num                     /* -- */(a: number) { return a - 1; }
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
function Atan(a: number) { return Math.atan(a); }
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

function op_div_int_int                 /* /  */(a: number, b: number) { return Math.round(op_div_num_num(a, b)); }
function rand_int(max: number) { return Math.floor(Math.random() * max); }


function pre_op_sub_vector(a: FVector) { return a.negate(); }
function op_mul_vector_float(a: FVector, b: number) { return a.multiplyScalar(b); }
function op_mul_float_vector(a: number, b: FVector) { return b.multiplyScalar(a); }
function op_mul_vector_vector(a: FVector, b: FVector) { return a.mul(b); }
function op_div_vector_float(a: FVector, b: number) { return a.divideScalar(b); }
function op_add_vector_vector(a: FVector, b: FVector) { return a.add(b); }
function op_sub_vector_vector(a: FVector, b: FVector) { return a.sub(b); }

function op_eq_vector_vector(a: FVector, b: FVector) { return a.equals(b); }
function op_neq_vector_vector(a: FVector, b: FVector) { return a.nequals(b); }

function op_dot_vector_vector(a: FVector, b: FVector) { return a.dot(b); }
function op_cross_vector_vector(a: FVector, b: FVector) { return a.cross(b); }

function fn_not_implemented(...args: any[]) { throw new Error(`Called non-implemented function with arguments: ${JSON.stringify(args, undefined, 4)}`) };

function VSize(a: FVector) { return a.length(); }
function Normal(a: FVector) { return a.normalized(); }
function VRand() { return new FVector(Math.random(), Math.random(), Math.random()); }

function Log(s: string, tag?: string) { console.log(`[UEScript] ${tag ? `{${tag}} ` : ""}${s}`); }
function Warn(s: string) { console.warn(`[UEScript] ${s}`); }

function op_cat_str_str(a: string, b: string) { return a.toString() + b.toString(); }
function op_scat_str_str(a: string, b: string) { return a.toString() + " " + b.toString(); }
function op_le_str_str(a: string, b: string) { return a.toString() < b.toString(); }
function op_ge_str_str(a: string, b: string) { return a.toString() > b.toString(); }
function op_leq_str_str(a: string, b: string) { return a.toString() <= b.toString(); }
function op_geq_str_str(a: string, b: string) { return a.toString() >= b.toString(); }
function op_eq_str_str(a: string, b: string) { return a.toString() === b.toString(); }
function op_neq_str_str(a: string, b: string) { return a.toString() !== b.toString(); }
function op_eq_case_str_str(a: string, b: string) { return a.toString().toLowerCase() === b.toString().toLowerCase(); }

function Len(a: string): number { return a.toString().length; }
function InStr(a: string, b: string): number { return a.toString().indexOf(b.toString()); }
function Mid(a: string, ...b: [number, number?]) { return a.toString().slice(...b); }
function Left(a: string, b: number) { return Mid(a.toString(), 0, b); }
function Right(a: string, b: number) { return Mid(a.toString(), -b); }
function Caps(a: string) { return a.toString().toUpperCase(); }
function Chr(a: number) { return String.fromCharCode(a); }
function Asc(a: string) { return a.charCodeAt(0); }

function registerNativeFuncs(registry: UNativeRegistry) {
    const native = registry.registerNativeFunc.bind(registry);

    // boolean operators
    native(129, pre_op_not_bool);
    native(242, op_eq_bool_bool);
    native(243, op_not_eq_bool_bool);
    native(130, op_and_bool_bool);
    native(131, op_xor_bool_bool);
    native(132, op_or_bool_bool);

    // byte operators
    native(133, op_mul_num_num);
    native(134, op_div_int_int);
    native(135, op_add_num_num);
    native(136, op_sub_num_num);
    native(137, op_inc_num);
    native(138, op_dec_num);
    native(139, op_inc_num);
    native(140, op_dec_num);
    native(141, op_inv_num);

    // integer operators
    native(143, op_sub_num_num);
    native(144, op_mul_num_num);
    native(145, op_div_int_int);
    native(146, op_add_num_num);
    native(147, op_sub_num_num);
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
    native(159, op_mul_num_num);
    native(160, op_div_int_int);
    native(161, op_add_num_num);
    native(162, op_sub_num_num);
    native(163, op_inc_num);
    native(164, op_dec_num);
    native(165, op_inc_num);
    native(166, op_dec_num);

    // integer functions
    native(167, rand_int);
    native(249, min_num);
    native(250, max_num);
    native(251, clamp_num);

    // float operators
    native(169, op_sub_num_num);
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
    native(275, function op_vec_rot_lsh() { fn_not_implemented() });  // vector <<    ( vector A, rotator B );
    native(276, function op_vec_rot_rsh() { fn_not_implemented() });  // vector >>    ( vector A, rotator B );
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
    native(227, function vec_Invert() { fn_not_implemented() }); // Invert
    native(252, VRand);
    native(300, function vec_MirrorByNormal() { fn_not_implemented() }); // MirrorByNormal

    // Rotator operators and functions.
    native(142, fn_not_implemented); // static final operator(24) bool ==     ( rotator A, rotator B );
    native(203, fn_not_implemented); // static final operator(26) bool !=     ( rotator A, rotator B );
    native(287, fn_not_implemented); // static final operator(16) rotator *   ( rotator A, float    B );
    native(288, fn_not_implemented); // static final operator(16) rotator *   ( float    A, rotator B );
    native(289, fn_not_implemented); // static final operator(16) rotator /   ( rotator A, float    B );
    native(290, fn_not_implemented); // static final operator(34) rotator *=  ( out rotator A, float B  );
    native(291, fn_not_implemented); // static final operator(34) rotator /=  ( out rotator A, float B  );
    native(316, fn_not_implemented); // static final operator(20) rotator +   ( rotator A, rotator B );
    native(317, fn_not_implemented); // static final operator(20) rotator -   ( rotator A, rotator B );
    native(318, fn_not_implemented); // static final operator(34) rotator +=  ( out rotator A, rotator B );
    native(319, fn_not_implemented); // static final operator(34) rotator -=  ( out rotator A, rotator B );
    native(229, fn_not_implemented); // static final function GetAxes         ( rotator A, out vector X, out vector Y, out vector Z );
    native(230, fn_not_implemented); // static final function GetUnAxes       ( rotator A, out vector X, out vector Y, out vector Z );
    native(320, fn_not_implemented); // static final function rotator RotRand ( optional bool bRoll );
    native("OrthoRotation", function rot_OrthoRotation() { fn_not_implemented() }); //      static final function rotator OrthoRotation( vector X, vector Y, vector Z );
    native("Normalize", function rot_Normalize() { fn_not_implemented() }); //      static final function rotator Normalize( rotator Rot );
    native("op_ClockwiseFrom_int_int", fn_not_implemented); //static final operator(24) bool ClockwiseFrom( int A, int B );
    native("Vector2Rotator", function rot_Vector2Rotator() { fn_not_implemented() }); //      static final function rotator Vector2Rotator( vector V );
    native("Rotator2Vector", function rot_Rotator2Vector() { fn_not_implemented() }); //      static final function vector Rotator2Vector( rotator R );


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
    native(114, fn_not_implemented); // static final operator(24) bool == ( Object A, Object B );
    native(119, fn_not_implemented); // static final operator(26) bool != ( Object A, Object B );

    // Name operators.
    native(254, fn_not_implemented); // static final operator(24) bool == ( name A, name B );
    native(255, fn_not_implemented); // static final operator(26) bool != ( name A, name B );

    // InterpCurve operator
    native("InterpCurveEval", function InterpCurveEval() { fn_not_implemented() }); //   static final function float InterpCurveEval( InterpCurve curve, float input );
    native("InterpCurveGetOutputRange", function InterpCurveGetOutputRange() { fn_not_implemented() }); // static final function InterpCurveGetOutputRange( InterpCurve curve, out float min, out float max );
    native("InterpCurveGetInputDomain", function InterpCurveGetInputDomain() { fn_not_implemented() }); // static final function InterpCurveGetInputDomain( InterpCurve curve, out float min, out float max );

    // Quaternion functions
    native("QuatProduct", function QuatProduct() { fn_not_implemented() }); //   static final function Quat QuatProduct( Quat A, Quat B );
    native("QuatInvert", function QuatInvert() { fn_not_implemented() }); //    static final function Quat QuatInvert( Quat A );
    native("QuatRotateVector", function QuatRotateVector() { fn_not_implemented() }); //  static final function vector QuatRotateVector( Quat A, vector B );
    native("QuatFindBetween", function QuatFindBetween() { fn_not_implemented() }); //   static final function Quat QuatFindBetween( Vector A, Vector B );
    native("QuatFromAxisAndAngle", function QuatFromAxisAndAngle() { fn_not_implemented() }); //  static final function Quat QuatFromAxisAndAngle( Vector Axis, Float Angle );

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
    native("DynamicLoadObject", function DynamicLoadObject() { fn_not_implemented() }); // static final function object DynamicLoadObject( string ObjectName, class ObjectClass, optional bool MayFail );
    native("FindObject", function FindObject() { fn_not_implemented() }); // static final function object FindObject( string ObjectName, class ObjectClass );

    // Configuration.
    native(536, fn_not_implemented);    // final function SaveConfig();
    native("StaticSaveConfig", function StaticSaveConfig() { fn_not_implemented() });   // static final function StaticSaveConfig();
    native("ResetConfig", function ResetConfig() { fn_not_implemented() });    // static final function ResetConfig();

}

export default registerNativeFuncs;
export { registerNativeFuncs };