import hsvToRgb, { saturationToBrightness } from "@client/utils/hsv-to-rgb";
import { generateUUID, RAD2DEG } from "three/src/math/MathUtils";
import BufferValue from "../buffer-value";
import UAActor from "./un-aactor";
import FArray from "./un-array";
import FNumber from "./un-number";
import FVector from "./un-vector";

class ULight extends UAActor {
    public effect: LightEffect_T = 0;
    public lightness: number = 255;
    public radius: number;
    public hue: number = 0;
    public saturation: number = 127;
    public isDirectional: boolean = false;
    public type: LightType_T = 1;
    public hasCorona: boolean = false;
    public period: number = 0;
    public phase: number = 0;
    public cone: number = 0;
    public isDynamic: boolean = false;
    public lightOnTime: number;
    public lightOffTime: number;
    public skins: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);

    public style: number;

    protected isIgnoredRange: boolean;
    protected isCastingShadow: boolean;
    protected isStaticLighting: boolean;

    protected forcedRegionTag: string;
    protected maxCoronaSize: number;

    protected getSignedMap() {
        return Object.assign({}, super.getSignedMap(), {
            "LightHue": false,
            "LightSaturation": false
        });
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "LightEffect": "effect",
            "LightRadius": "radius",
            "LightBrightness": "lightness",
            "LightHue": "hue",
            "LightSaturation": "saturation",
            "bDirectional": "isDirectional",
            "LightType": "type",
            "bCorona": "hasCorona",
            "Skins": "skins",
            "LightPeriod": "period",
            "LightPhase": "phase",
            "LightCone": "cone",
            "bDynamicLight": "isDynamic",
            "bIgnoredRange": "isIgnoredRange",
            "LightOnTime": "lightOnTime",
            "LightOffTime": "lightOffTime",

            "Style": "style",
            "bShadowCast": "isCastingShadow",
            "bStaticLighting": "isStaticLighting",
            "ForcedRegionTag": "forcedRegionTag",

            "MaxCoronaSize": "maxCoronaSize"
        });
    }

    protected getRegionLineHelper(library: DecodeLibrary, color: [number, number, number] = [1, 0, 1], ignoreDepth: boolean = false) {
        const lineGeometryUuid = generateUUID();
        const _a = this.region.getZone().location;
        const _b = this.location;

        const a = new FVector(_a.x, _a.z, _a.y);
        const b = new FVector(_b.x, _b.z, _b.y);

        const geoPosition = a.sub(b);
        const regionHelper = {
            type: "Edges",
            geometry: lineGeometryUuid,
            color,
            ignoreDepth
        } as IEdgesObjectDecodeInfo;

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
        const brightness = saturationToBrightness(this.lightness);

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

    public async getDecodeInfo(library: DecodeLibrary): Promise<ILightDecodeInfo> {
        await this.onDecodeReady();

        // debugger;

        return {
            uuid: this.uuid,
            type: "Light",
            color: this.getColor(),
            cone: this.cone,
            lightType: this.type,
            lightEffect: this.effect,
            directional: this.isDirectional,
            radius: this.radius,
            name: this.objectName,
            position: this.location.getVectorElements(),
            scale: this.scale.getVectorElements(),
            rotation: this.rotation.getEulerElements(),
            children: [/*this.getRegionLineHelper(library, [1, 0, 0])*/]
        };
    }
}

export default ULight;
export { ULight };

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

