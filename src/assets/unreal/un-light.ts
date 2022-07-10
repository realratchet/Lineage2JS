import hsvToRgb, { saturationToBrightness } from "@client/utils/hsv-to-rgb";
import { generateUUID } from "three/src/math/MathUtils";
import BufferValue from "../buffer-value";
import UAActor from "./un-aactor";
import { FPrimitiveArray } from "./un-array";
import FVector from "./un-vector";

class ULight extends UAActor {
    public effect: LightEffect_T;
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
    public skins: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);

    protected isIgnoredRange: boolean;

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
        });
    }

    protected getRegionLineHelper(library: IDecodeLibrary, color: [number, number, number] = [1, 0, 1], ignoreDepth: boolean = false) {
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

    public getColor() {
        const [x, y, z] = hsvToRgb(this.hue, this.saturation, 255);
        const w = 1;
        const brightness = saturationToBrightness(this.lightness);

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

    public async getDecodeInfo(library: IDecodeLibrary): Promise<ILightDecodeInfo> {
        await this.onLoaded();

        return {
            type: "Light",
            color: this.getColor(),
            cone: this.cone,
            lightType: this.type,
            lightEffect: this.effect,
            directional: this.isDirectional,
            radius: /*(this.radius + 1) * 25*/this.radius,
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

function FUN_10740ab4(): any {
    debugger;
    //     ulonglong uVar1;
    //     uint uVar2;
    //     bool bVar3;
    //     float fVar4;
    //     float10 in_ST0;
    //     uint local_20;
    //     float fStack28;

    //     uVar1 = (ulonglong)ROUND(in_ST0);
    //     local_20 = (uint)uVar1;
    //     fStack28 = (float)(uVar1 >> 0x20);
    //     fVar4 = (float)in_ST0;
    //     if ((local_20 != 0x0) || (fVar4 = fStack28, (uVar1 & 0x7fffffff00000000) != 0x0)) {
    //       if ((int)fVar4 < 0x0) {
    //         uVar2 = (uint)(0x80000000 < ((uint)(float)(in_ST0 - (float10)uVar1) ^ 0x80000000));
    //         bVar3 = CARRY4(local_20,uVar2);
    //         local_20 = local_20 + uVar2;
    //         fStack28 = (float)((int)fStack28 + (uint)bVar3);
    //       }
    //       else {
    //         uVar2 = (uint)(0x80000000 < (uint)(float)(in_ST0 - (float10)uVar1));
    //         bVar3 = local_20 < uVar2;
    //         local_20 = local_20 - uVar2;
    //         fStack28 = (float)((int)fStack28 - (uint)bVar3);
    //       }
    //     }
    //     return CONCAT44(fStack28,local_20);
}
