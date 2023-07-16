import GMath from "@client/assets/unreal/un-gmath";
import FPlane from "@client/assets/unreal/un-plane";
import hsvToRgb, { saturationToBrightness } from "@client/utils/hsv-to-rgb";
import { clamp, generateUUID, RAD2DEG } from "three/src/math/MathUtils";
import UAActor from "./un-aactor";
import FVector from "./un-vector";

function getHSV(H: number, S: number, V: number): FPlane {
    let Brightness = V * 1.4 / 255;

    Brightness *= 0.7 / (0.01 + Math.sqrt(Brightness));
    Brightness = clamp(Brightness, 0, 1);

    const Hue = (H < 86) ? FVector.make((85 - H) / 85, (H - 0) / 85, 0) : (H < 171) ? FVector.make(0, (170 - H) / 85, (H - 85) / 85) : FVector.make((H - 170) / 85, 0, (255 - H) / 84);
    const invHue = FVector.make(1, 1, 1).sub(Hue);
    const rgbComp = Hue.addScalar(S / 255).mul(invHue).multiplyScalar(Brightness);

    return FPlane.make(rgbComp.x, rgbComp.y, rgbComp.z, 1);
}

class FDynamicLight {
    public readonly actor: ULight;
    public readonly env: GA.UL2NEnvLight;

    public alpha: number;
    public color: FPlane;
    public direction: FVector;
    public position: FVector;
    public radius: number;
    public dynamic: boolean;

    public constructor(actor: ULight, env: GA.UL2NEnvLight) {
        console.log(actor.dumpLayout());

        this.env = env;
        this.actor = actor;
        this.alpha = 1;
        this.update();
    }

    public update() {
        const Actor = this.actor;
        const Env = this.env;

        let baseColor: FPlane;

        if (Actor.isSunlightColor) {
            baseColor = Env.selectByTime(Env.lightActor).toColorPlane();
        } else baseColor = getHSV(Actor.hue, Actor.saturation, 255);

        let Intensity = 0;

        if (Actor.type === LightType_T.LT_Steady) Intensity = 1;
        else if (Actor.type === LightType_T.LT_Pulse)
            Intensity = 0.6 + 0.39 * GMath().sin(Math.floor((Actor.level.timeSeconds * 35 * 65536) / Math.max(Math.floor(Actor.period), 1) + (Actor.phase << 8)));
        else if (Actor.type === LightType_T.LT_Blink) {
            if ((Math.floor((Actor.level.timeSeconds * 35 * 65536) / (Actor.period + 1) + (Actor.phase << 8))) & 1)
                Intensity = 0;
            else Intensity = 1;
        }
        else if (Actor.type === LightType_T.LT_Flicker) {
            const Rand = Math.random();

            if (Rand < 0.5) Intensity = 0;
            else Intensity = Rand;
        }
        else if (Actor.type === LightType_T.LT_Strobe) {
            throw new Error("not implemented");
            //         static float LastUpdateTime = 0; static int Toggle = 0;
            // if (LastUpdateTime != Actor -> Level -> TimeSeconds) {
            //     LastUpdateTime = Actor -> Level -> TimeSeconds;
            //     Toggle ^= 1;
            // }
            // if (Toggle) Intensity = 0.0f;
            //         else Intensity = 1.0f;
        }
        else if (Actor.type == LightType_T.LT_SubtlePulse) {
            // throw new Error("not implemented");
            Intensity = 0.9 + 0.09 * GMath().sin(Math.floor((Actor.level.timeSeconds * 35 * 65536) / Math.max(Math.floor(Actor.period), 1) + (Actor.phase << 8)));
            //     else if (Actor .type === LightType_T.LT_TexturePaletteOnce) {
            // if (Actor -> Skins.Num() && Cast<UTexture>(Actor -> Skins(0)) && Cast<UTexture>(Actor -> Skins(0)) -> Palette) {
            //             FColor C = Cast<UTexture>(Actor -> Skins(0)) -> Palette -> Colors(appFloor(255.0f * Actor -> LifeFraction()));
            //     BaseColor = FVector(C.R, C.G, C.B).SafeNormal();
            //     Intensity = C.FBrightness() * 2.8;
            // }
        }
        else if (Actor.type === LightType_T.LT_TexturePaletteLoop) {
            throw new Error("not implemented");
            // if (Actor -> Skins.Num() && Cast<UTexture>(Actor -> Skins(0)) && Cast<UTexture>(Actor -> Skins(0)) -> Palette) {
            //             FLOAT Time = Actor -> Level -> TimeSeconds * 35 / Max((int)Actor -> LightPeriod, 1) + Actor -> LightPhase;
            //             FColor C = Cast<UTexture>(Actor -> Skins(0)) -> Palette -> Colors(((int)(Time * 256) & 255) % 255);
            //     BaseColor = FVector(C.R, C.G, C.B).UnsafeNormal();
            //     Intensity = C.FBrightness() * 2.8f;
            // }

            // Dynamic = 1;
        }
        else if (Actor.type === LightType_T.LT_FadeOut) {
            throw new Error("not implemented");
            // Intensity = Math.min(1. 1.5 * (1 - Actor. LifeFraction()));
        }

        this.color = baseColor.multiplyScalar(Actor.brightness / 255).multiplyScalar(Intensity).multiplyScalar(Actor.level.ambientBrightness);

        if (Actor.effect === LightEffect_T.LE_Sunlight) {
            this.direction = Actor.rotation.toVector();
            this.position = FVector.make(0, 0, 0);
            this.radius = 0;
        } else if (Actor.effect == LightEffect_T.LE_Spotlight || Actor.effect == LightEffect_T.LE_StaticSpot) {
            this.position = Actor.location;
            this.direction = Actor.rotation.toVector();
            this.radius = Actor.worldLightRadius();
        } else {
            this.position = Actor.location;
            this.radius = Actor.worldLightRadius();
        }

        this.alpha = 1;

        this.dynamic = Actor.isDynamic;
    }

    sampleIntensity(SamplePosition: FVector, SampleNormal: FVector): number {
        const Actor = this.actor;
        const Direction = this.direction;
        const Position = this.position;
        const Radius = this.radius;

        if (Actor.effect === LightEffect_T.LE_Sunlight) {
            // Directional light.

            if ((Direction.dot(SampleNormal)) < 0)
                return (Direction.dot(SampleNormal)) * -2;
            else return 0;
        }
        else if (Actor.effect === LightEffect_T.LE_Cylinder) {
            // Cylindrical light.

            const LightVector = Position.sub(SamplePosition);
            const DistanceSquared = LightVector.lengthSq(), Distance = Math.sqrt(DistanceSquared);

            if (Distance < Radius)
                return Math.max(0, 1 - ((LightVector.x ** 2) + (LightVector.y ** 2)) / (Radius ** 2)) * 2;
            else return 0;
        }
        else if (Actor.effect === LightEffect_T.LE_NonIncidence) {
            // Non incidence light.

            const LightVector = Position.sub(SamplePosition);
            const DistanceSquared = LightVector.lengthSq(), Distance = Math.sqrt(DistanceSquared);

            if ((LightVector.dot(SampleNormal)) > 0 && Distance < Radius)
                return Math.sqrt(1.02 - Distance / Radius) * 2;
            else return 0;
        }
        else if (Actor.effect === LightEffect_T.LE_QuadraticNonIncidence) {
            // Quadratic non incidence light.

            const LightVector = Position.sub(SamplePosition);
            const DistanceSquared = LightVector.lengthSq(), RadiusSquared = (Radius ** 2);

            if ((LightVector.dot(SampleNormal)) > 0 && DistanceSquared < RadiusSquared)
                return (1.02 - DistanceSquared / RadiusSquared) * 2;
            else return 0;
        }
        else if (Actor.effect == LightEffect_T.LE_Spotlight || Actor.effect === LightEffect_T.LE_StaticSpot) {
            // Spot light.

            const LightVector = Position.sub(SamplePosition);
            const DistanceSquared = LightVector.lengthSq(),
                Distance = Math.sqrt(DistanceSquared), BaseAttenuation = UnrealAttenuation(Distance, Radius, LightVector, SampleNormal);

            if (BaseAttenuation > 0) {
                const Sine = 1.0 - Actor.cone / 256.0, RSine = 1.0 / (1.0 - Sine);
                const SineRSine = Sine * RSine, SineSq = Sine * Sine;
                const VDotV = -LightVector.dot(Direction);

                if (VDotV > 0.0 && (VDotV ** 2) > SineSq * DistanceSquared)
                    return Math.pow(VDotV * RSine / Distance - SineRSine, 2) * BaseAttenuation;
            }

            return 0;
        }
        else {
            // Point light.

            const LightVector = Position.sub(SamplePosition);

            return UnrealAttenuation(Math.sqrt(LightVector.lengthSq()), Radius, LightVector, SampleNormal);
        }
    }
}

function UnrealAttenuation(Distance: number, Radius: number, LightVector: FVector, Normal: FVector) {
    if ((LightVector.dot(Normal)) > 0 && Distance <= Radius) {
        const A = Distance / Radius,					// Unreal's lighting model.
            B = (2 * A * A * A - 3 * A * A + 1),
            C = Math.abs((LightVector.dot(Normal)) / Radius);

        return B / A * C * 2;
    }

    return 0;
}

abstract class ULight extends UAActor {
    declare public readonly effect: LightEffect_T;
    declare public readonly brightness: number;
    declare public readonly radius: number;
    declare public readonly hue: number;
    declare public readonly saturation: number;

    declare public readonly type: LightType_T;
    declare public readonly hasCorona: boolean;
    declare public readonly period: number;
    declare public readonly phase: number;
    declare public readonly cone: number;
    declare public readonly isDynamic: boolean;
    declare public readonly lightOnTime: number;
    declare public readonly lightOffTime: number;

    declare public readonly maxCoronaSize: number;

    public worldLightRadius() { return 25 * (this.radius + 1); }

    declare public readonly isSunlightColor: boolean;
    declare public readonly isTimeLight: boolean;
    // protected _lightPrevTime: any;
    // protected _lightLifeTime: any;
    // protected _minCoronaSize: any;
    // protected _coronaRotation: any;
    // protected _coronaRotationOffset: any;
    // protected _useOwnFinalBlend: any;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "LightEffect": "effect",
            "LightRadius": "radius",
            "LightBrightness": "brightness",
            "LightHue": "hue",
            "LightSaturation": "saturation",

            "LightType": "type",
            "bCorona": "hasCorona",

            "LightPeriod": "period",
            "LightPhase": "phase",
            "LightCone": "cone",
            "bDynamicLight": "isDynamic",

            "LightOnTime": "lightOnTime",
            "LightOffTime": "lightOffTime",


            "MaxCoronaSize": "maxCoronaSize",

            "bSunlightColor": "isSunlightColor",
            "bTimeLight": "isTimeLight",
            // "LightPrevTime": "_lightPrevTime",
            // "LightLifeTime": "_lightLifeTime",
            // "MinCoronaSize": "_minCoronaSize",
            // "CoronaRotation": "_coronaRotation",
            // "CoronaRotationOffset": "_coronaRotationOffset",
            // "UseOwnFinalBlend": "_useOwnFinalBlend"
        });
    }

    protected getRenderInfo(env: GA.UL2NEnvLight) { return new FDynamicLight(this, env); }

    protected getRegionLineHelper(library: GD.DecodeLibrary, color: [number, number, number] = [1, 0, 1], ignoreDepth: boolean = false) {
        const lineGeometryUuid = generateUUID();
        const _a = this.region.getZone().location;
        const _b = this.location;

        const a = FVector.make(_a.x, _a.z, _a.y);
        const b = FVector.make(_b.x, _b.z, _b.y);

        const geoPosition = a.sub(b);
        const regionHelper = {
            type: "Edges",
            geometry: lineGeometryUuid,
            color,
            ignoreDepth
        } as GD.IEdgesObjectDecodeInfo;

        library.geometries[lineGeometryUuid] = {
            indices: new Uint8Array([0, 1]),
            attributes: {
                positions: new Float32Array([
                    0, 0, 0,
                    geoPosition.x, geoPosition.y, geoPosition.z
                ])
            }
        };

        return regionHelper;
    }

    public getColor(): [number, number, number] {
        const [x, y, z] = hsvToRgb(this.hue, this.saturation, 255);
        const brightness = saturationToBrightness(this.brightness);

        // debugger;

        // const lightType = this.type;

        // console.log(`x: ${x}, y: ${y}, z: ${z}, w: ${w}`);

        // let someColor_88 = 0;
        // let actor1: any;
        // let GMath_exref: any;

        // debugger;

        // switch (lightType) {
        //     case 0x7:
        //         someColor_88 = actor1[0x2].field_0xe;
        //         if (someColor_88 === 0x0) {
        //             someColor_88 = 1.401298e-45;
        //         }
        //         let someFloat = actor1[0x2].field_0xf << 0x8;
        //         let uVar4 = FUN_10740ab4();
        //         let tmp_double = (GMath_exref + (uVar4 >> 0x2 & 0x3fff) * 0x4 + 0x8c) * 0.09 + 0.9;

        //         debugger;
        //         break;
        //     default:
        //         debugger;
        //         break;
        // }

        return [x * brightness, y * brightness, z * brightness];
    }

    public getDecodeInfo(library: GD.DecodeLibrary): GD.ILightDecodeInfo {
        // debugger;

        return {
            uuid: this.uuid,
            type: "Light",
            color: this.getColor(),
            dynamic: this.isDynamic,
            cone: this.cone,
            lightType: this.type.valueOf(),
            lightEffect: this.effect.valueOf(),
            directional: this.isDirectional,
            radius: this.radius,
            name: this.objectName,
            position: this.location.getVectorElements(),
            scale: this.scale.getVectorElements(),
            rotation: this.rotation?.getEulerElements() || [0, 0, 0, "XYZ"],
            children: [/*this.getRegionLineHelper(library, [1, 0, 0])*/]
        };
    }
}

enum LightEffect_T {
    LE_None = 0x00,
    LE_TorchWaver = 0x01,
    LE_FireWaver = 0x02,
    LE_WateryShimmer = 0x03,
    LE_Searchlight = 0x04,
    LE_SlowWave = 0x05,
    LE_FastWave = 0x06,
    LE_CloudCast = 0x07,
    LE_StaticSpot = 0x08,
    LE_Shock = 0x09,
    LE_Disco = 0x0A,
    LE_Warp = 0x0B,
    LE_Spotlight = 0x0C,
    LE_NonIncidence = 0x0D,
    LE_Shell = 0x0E,
    LE_OmniBumpMap = 0x0F,
    LE_Interference = 0x10,
    LE_Cylinder = 0x11,
    LE_Rotor = 0x12,
    LE_Sunlight = 0x13,
    LE_QuadraticNonIncidence = 0x14
}

enum LightType_T {
    LT_None = 0x0,
    LT_Steady = 0x1,
    LT_Pulse = 0x2,
    LT_Blink = 0x3,
    LT_Flicker = 0x4,
    LT_Strobe = 0x5,
    LT_BackdropLight = 0x6,
    LT_SubtlePulse = 0x7,
    LT_TexturePaletteOnce = 0x8,
    LT_TexturePaletteLoop = 0x9,
    LT_FadeOut = 0xA,
    LT_Fade = 0xB
};

export default ULight;
export { ULight, LightEffect_T, LightType_T };

function LODWORD(x: number) { return x & 0xFFFFFFFF };

function __CFADD__(x: number, y: number) {
    return Number(x > (x + y));
}

function f2i(v: number) { return new Uint32Array(new Float32Array([v]).buffer)[0]; }
function i2f(v: number) { return new Float32Array(new Uint32Array([v]).buffer)[0]; }

function ftol2(a1: number) {
    // let b = Math.ceil(a);

    // if (isFinite(b) && b !== 0) {
    //     let c = a - b;

    //     if (c >= 0) {
    //         debugger;
    //     } else {
    //         let d = f2i(c);
    //         let e = (d + 0x7FFFFFFF)/* - 1*/;
    //         let carry = Number(new Uint32Array([e])[0] < e);

    //         if (!carry)
    //             debugger;

    //         return b - carry;
    //     }
    // } else {
    //     debugger;
    // }


    let a = Math.trunc(a1);
    let v1 = a;
    let result = Math.trunc(a1);
    if (result || (v1 = Math.trunc(a1) >> 32, (v1 & 0x7FFFFFFF) != 0)) {
        if (v1 >= 0) {
            // debugger;
            let c = a1 - Math.trunc(a1);
            let dwc = f2i(c);
            let carry = __CFADD__(LODWORD(dwc), 0x7FFFFFFF);

            if (carry > 0)
                debugger;

            result = result - carry;
        } else {
            debugger;
            // return (__PAIR64__(result, -(float)(a1 - (double)(__int64)a1)) + 0x7FFFFFFF) >> 32;
        }
    }
    return result;
}

function toSin(v: number) { return Math.sin((v + v) * 0.0001917475984857051); }
function toSqrt(v: number) { return Math.sqrt(v * 6.103516e-05); }

const LUT_SIN = new Array(0x4000).fill(1).map((_, i) => toSin(i));
const LUT_SQRT = new Array(0x4000).fill(1).map((_, i) => toSqrt(i));

const LUT_SIN_RAD = new Array(0x4000).fill(1).map((_, i) => toSin(i) * RAD2DEG)

// debugger;

// (function unkFunc() {
//     let a = 0x20;

//     if (a < 1) a = 1;

//     let x = 6.49065196514129638671875e-1;//5.4150390625e-1;
//     let y = 0;

//     // first branch without carry -> 1.28317940235137939453125
//     // with carry -> 6.49065196514129638671875e-1

//     // 5.8258211612701416015625e-1  -> 0.5825821161270142
//     // 5.4150390625e-1              -> 0.54150390625
//     // 6.4640057086944580078125e-1  -> 0.6464005708694458
//     let z = x * 2293760.0; // = 1192957.7734375
//     y = y << 8; // = 0

//     z = z / 32; // = 37279.930419921875

//     z = z + y; // = 37279.930419921875

//     // let [eax, edx] = ftol2_ghidra(z);

//     // let w = eax;

//     // let b = (Math.floor(w) >> 2) & 0x3FFF;
//     let c = (Math.floor(ftol2(z)) >> 2) & 0x3FFF;

//     let sin = LUT_SIN[c];
//     let out = sin * 0.090000004 + 0.89999998;

//     // debugger;

//     // const aa = i2f(-1099808769);
//     // let z = ftol2(x);

//     // 

//     debugger;

//     return out;
// })();


