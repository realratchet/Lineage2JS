import GMath from "@client/assets/unreal/un-gmath";
import FPlane from "@client/assets/unreal/un-plane";
import hsvToRgb, { saturationToBrightness } from "@client/utils/hsv-to-rgb";
import { clamp, generateUUID, RAD2DEG } from "three/src/math/MathUtils";
import UAActor from "./un-aactor";
import FVector from "./un-vector";

function getHSV(H: number, S: number, V: number): FPlane {

    return FPlane.make(...hsvToRgb(H, S, V), 1);

    // let Brightness = V * 1.4 / 255;

    // Brightness *= 0.7 / (0.01 + Math.sqrt(Brightness));
    // Brightness = clamp(Brightness, 0, 1);

    // const Hue = (H < 86) ? FVector.make((85 - H) / 85, (H - 0) / 85, 0) : (H < 171) ? FVector.make(0, (170 - H) / 85, (H - 85) / 85) : FVector.make((H - 170) / 85, 0, (255 - H) / 84);
    // const invHue = FVector.make(1, 1, 1).sub(Hue);
    // const rgbComp = Hue.addScalar(S / 255).mul(invHue).multiplyScalar(Brightness);

    // return FPlane.make(rgbComp.x, rgbComp.y, rgbComp.z, 1);
}

// Helper function to convert FColor to normalized FPlane (FVector with w=1)
function colorToPlane(color: GA.FColor): FPlane {
    const lengthSq = color.r * color.r + color.g * color.g + color.b * color.b;
    if (lengthSq === 0) {
        return FPlane.make(1, 1, 1, 1); // Default to white if zero-length
    }
    const length = Math.sqrt(lengthSq);
    return FPlane.make(color.r / length, color.g / length, color.b / length, 1);
}

// Per-instance state tracking for LT_Strobe (replaces static variables)
const strobeStateMap = new Map<GA.ULight, { lastUpdateTime: number, toggle: number }>();

class FDynamicLight {
    public readonly actor: ULight;
    public readonly envManager: GA.UL2NEnvManager;

    public alpha: number;
    public color: FPlane;
    public direction: FVector;
    public position: FVector;
    public radius: number;
    public dynamic: boolean;

    public constructor(actor: ULight, envManager: GA.UL2NEnvManager) {
        // console.log(actor.dumpLayout());

        this.envManager = envManager;
        this.actor = actor;
        this.alpha = 1;
        this.update();
    }

    public update() {
        const actor = this.actor;
        const envManager = this.envManager;
        const levelInfo = actor.levelInfo;

        let baseColor: FPlane;
        let brightness: number

        if (actor.isSunlightColor) {
            // Resolved call: UL2NEnvManager::GetBaseColorPlane_HSVActorSunLight(float, FPlane&)
            // Resolved call: UL2NEnvManager::GetBrightness_HSVActorSunLight(float)
            // In IDA: These are called through OrcBabo vtable when isSunlightColor is true
            baseColor = envManager.getBaseColorPlaneStaticMeshSunLight();
            brightness = envManager.getBrightnessStaticMeshSunLight();
        } else {
            // Standard HSV color calculation using actor properties
            baseColor = getHSV(actor.hue, actor.saturation, 255);
            brightness = actor.brightness;
        }

        let intensity: number = 0.0;

        if (actor.type === LightType_T.LT_Steady)
            intensity = 1.0;
        else if (actor.type === LightType_T.LT_Pulse)
            intensity = 0.6 + 0.39 * GMath().sin(Math.floor((actor.levelInfo.timeSeconds * 35 * 65536) / Math.max(Math.floor(actor.period), 1) + (actor.phase << 8)));
        else if (actor.type === LightType_T.LT_Blink) {
            if ((Math.floor((actor.levelInfo.timeSeconds * 35 * 65536) / (actor.period + 1) + (actor.phase << 8))) & 1)
                intensity = 0.0;
            else
                intensity = 1.0;
        }
        else if (actor.type === LightType_T.LT_Flicker) {
            const Rand = Math.random();

            if (Rand < 0.5)
                intensity = 0.0;
            else
                intensity = Rand;
        }
        else if (actor.type === LightType_T.LT_Strobe) {
            let state = strobeStateMap.get(actor);
            if (!state) {
                state = { lastUpdateTime: levelInfo.timeSeconds, toggle: 0 };
                strobeStateMap.set(actor, state);
            }

            if (state.lastUpdateTime !== levelInfo.timeSeconds) {
                state.lastUpdateTime = levelInfo.timeSeconds;
                state.toggle ^= 1;
            }

            if (state.toggle) intensity = 0.0;
            else intensity = 1.0;
        }
        else if (actor.type === LightType_T.LT_SubtlePulse)
            intensity = 0.9 + 0.09 * GMath().sin(Math.floor((actor.levelInfo.timeSeconds * 35 * 65536) / Math.max(Math.floor(actor.period), 1) + (actor.phase << 8)));
        else if (actor.type === LightType_T.LT_TexturePaletteOnce) {
            debugger; // LT_TexturePaletteOnce - requires LifeFraction
            // Note: LifeFraction is not available in TypeScript
            // In C++: if( Actor->Skins.Num() && Cast<UTexture>(Actor->Skins(0)) && Cast<UTexture>(Actor->Skins(0))->Palette )
            //   { FColor C = Cast<UTexture>(Actor->Skins(0))->Palette->Colors(appFloor(255.0f * Actor->LifeFraction()));
            //     BaseColor = FVector( C.R, C.G, C.B ).SafeNormal();
            //     Intensity = C.FBrightness() * 2.8f; }
            // Without LifeFraction, this case cannot be implemented correctly
        }
        else if (actor.type === LightType_T.LT_TexturePaletteLoop) {
            if (actor.skins && actor.skins.length > 0) {
                const firstSkin = (actor.skins as any)[0]?.loadSelf() as GA.UTexture;
                if (firstSkin && firstSkin.palette) {
                    const palette = firstSkin.palette.loadSelf();
                    const time = (levelInfo.timeSeconds * 35) / Math.max(Math.floor(actor.period), 1) + actor.phase;
                    const paletteIndex = ((Math.floor(time * 256) & 255) % 255);
                    const paletteColor = palette.colors.getElem(paletteIndex);
                    baseColor = colorToPlane(paletteColor);
                    intensity = paletteColor.getBrightness() * 2.8;
                }
            }
            // Note: In IDA decompilation, case 9 sets Direction.X = 1, then Dynamic is set later
            // This matches C++ behavior where Dynamic = 1 is set inside the LT_TexturePaletteLoop block
            this.dynamic = true;
        }
        else if (actor.type === LightType_T.LT_FadeOut) {
            debugger;
            // LT_FadeOut - requires LifeFraction
            // Note: LifeFraction is not available in TypeScript
            // In IDA (case 10): 
            //   v22 = (1.0f - AActor::LifeFraction(v19)) * 1.5f;
            //   v80 = v22;
            //   sub_5CBEBA(1.0, v80); // sub_5CBEBA -> sub_7473C0 -> Min(1.0, v22)
            // In C++: Intensity = ::Min(1.f,1.5f*(1.f - Actor->LifeFraction()));
            // Without LifeFraction, this case cannot be implemented correctly
        }
        else if (actor.type === LightType_T.LT_Fade) {
            debugger;
            // LT_Fade - obfuscated implementation
            // Note: In IDA decompilation (case 11):
            //   v41 = *(_DWORD *)((char *)&unk_4595FFF + 207228133); // Some global value
            //   if (v41)
            //     *(float *)&v19[1].Outer = *(float *)&v19[1].ObjectFlags * *(float *)(v41 + 588) + *(float *)&v19[1].Outer;
            //   v22 = *(float *)&this->Actor[1].Outer;
            //   sub_5CBEBA(1.0, v22); // Min(1.0, v22) - clamps intensity to 1.0
            // Uses Actor[1].Outer (unclear what this represents) and calls Min(1.0, v22)
            // Without understanding what Outer represents, this case cannot be implemented correctly
        }

        this.color = baseColor.multiplyScalar((brightness / 255) * intensity * levelInfo.brightness);

        if (actor.effect === LightEffect_T.LE_Sunlight) {
            this.direction = actor.rotation.toVector();
            this.position = FVector.make(0, 0, 0);
            this.radius = 0;
        } else if (actor.effect == LightEffect_T.LE_Spotlight || actor.effect == LightEffect_T.LE_StaticSpot) {
            this.position = actor.location;
            this.direction = actor.rotation.toVector();
            this.radius = actor.worldLightRadius();
        } else {
            this.position = actor.location;
            this.radius = actor.worldLightRadius();
        }

        this.alpha = 1.0;

        this.dynamic = actor.isDynamic;
        // Note: Changed is not implemented in TypeScript
        // In C++: Changed = !Actor->bDynamicLight && (Actor->bLightChanged || Actor->bDeleteMe);
    }

    public sampleIntensity(SamplePosition: FVector, SampleNormal: FVector): number {
        const Actor = this.actor;
        const Direction = this.direction;
        const Position = this.position;
        const Radius = this.radius;

        if (Actor.effect === LightEffect_T.LE_Sunlight) {
            // Directional light.

            if ((Direction.dot(SampleNormal)) < 0)
                return (Direction.dot(SampleNormal)) * -2;
            else return 0;
        } else if (Actor.effect === LightEffect_T.LE_Cylinder) {
            // Cylindrical light.

            const LightVector = Position.sub(SamplePosition);
            const DistanceSquared = LightVector.lengthSq(), Distance = Math.sqrt(DistanceSquared);

            if (Distance < Radius)
                return Math.max(0, 1 - ((LightVector.x ** 2) + (LightVector.y ** 2)) / (Radius ** 2)) * 2;
            else return 0;
        } else if (Actor.effect === LightEffect_T.LE_NonIncidence) {
            // Non incidence light.

            const LightVector = Position.sub(SamplePosition);
            const DistanceSquared = LightVector.lengthSq(), Distance = Math.sqrt(DistanceSquared);

            if ((LightVector.dot(SampleNormal)) > 0 && Distance < Radius)
                return Math.sqrt(1.02 - Distance / Radius) * 2;
            else return 0;
        } else if (Actor.effect === LightEffect_T.LE_QuadraticNonIncidence) {
            // Quadratic non incidence light.

            const LightVector = Position.sub(SamplePosition);
            const DistanceSquared = LightVector.lengthSq(), RadiusSquared = (Radius ** 2);

            if ((LightVector.dot(SampleNormal)) > 0 && DistanceSquared < RadiusSquared)
                return (1.02 - DistanceSquared / RadiusSquared) * 2;
            else return 0;
        } else if (Actor.effect == LightEffect_T.LE_Spotlight || Actor.effect === LightEffect_T.LE_StaticSpot) {
            // Spot light.
            const dx = Position.x - SamplePosition.x;
            const dy = Position.y - SamplePosition.y;
            const dz = Position.z - SamplePosition.z;
            const DistanceSquared = dx * dx + dy * dy + dz * dz;
            const Distance = Math.sqrt(DistanceSquared);
            const BaseAttenuation = UnrealAttenuation(Distance, Radius, dx, dy, dz, SampleNormal.x, SampleNormal.y, SampleNormal.z);

            if (BaseAttenuation > 0) {
                const Sine = 1.0 - Actor.cone / 256.0;
                const RSine = 1.0 / (1.0 - Sine);
                const SineRSine = Sine * RSine;
                const SineSq = Sine * Sine;
                const VDotV = -(dx * Direction.x + dy * Direction.y + dz * Direction.z);

                if (VDotV > 0.0 && (VDotV ** 2) > SineSq * DistanceSquared)
                    return Math.pow(VDotV * RSine / Distance - SineRSine, 2) * BaseAttenuation;
            }

            return 0;
        } else {
            // Point light.
            const dx = Position.x - SamplePosition.x;
            const dy = Position.y - SamplePosition.y;
            const dz = Position.z - SamplePosition.z;
            const Distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            return UnrealAttenuation(Distance, Radius, dx, dy, dz, SampleNormal.x, SampleNormal.y, SampleNormal.z);
        }
    }
}

function UnrealAttenuation(Distance: number, Radius: number, dx: number, dy: number, dz: number, nx: number, ny: number, nz: number) {
    const dot = dx * nx + dy * ny + dz * nz;
    if (dot > 0 && Distance <= Radius) {
        const A = Distance / Radius;                    // Unreal's lighting model.
        const B = (2 * A * A * A - 3 * A * A + 1);
        const C = Math.abs(dot / Radius);

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

    public getRenderInfo(envManager: GA.UL2NEnvManager) { return new FDynamicLight(this, envManager); }

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
            hsv: [this.hue, this.saturation, this.brightness],
            dynamic: this.isDynamic,
            cone: this.cone,
            lightType: this.type.valueOf(),
            lightEffect: this.effect.valueOf(),
            directional: this.isDirectional,
            radius: this.radius,
            name: this.objectName,
            isSunlightColor: this.isSunlightColor,
            position: this.location.getVectorElements(),
            scale: this.scale.getVectorElements(),
            quaternion: this.rotation.getQuaternionElements() || [0, 0, 0, 1],
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


