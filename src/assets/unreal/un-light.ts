import { clamp, euclideanModulo } from "three/src/math/MathUtils";
import BufferValue from "../buffer-value";
import UAActor from "./un-aactor";
import { FPrimitiveArray } from "./un-array";

function hue2rgb(p: number, q: number, t: number) {

    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);

    return p;
}

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
            "LightOffTime": "lightOffTime"
        });
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
            radius: this.radius,
            name: this.objectName,
            position: this.location.getVectorElements(),
            scale: this.scale.getVectorElements(),
            rotation: this.rotation.getEulerElements(),
            children: [this.getRegionLineHelper(library, [1, 0, 0])]
        };
    }

    public getColor(): [number, number, number] {
        let h = this.hue / 255, s = this.saturation / 255, l = this.lightness / (this.isDirectional ? 255 : (this.radius * 8));
        let r: number = 0, g: number = 0, b: number = 0;

        // h,s,l ranges are in 0.0 - 1.0
        h = euclideanModulo(h, 1);
        s = clamp(s, 0, 1);
        l = clamp(l, 0, 1);

        if (s === 0) r = g = b = l;
        else {
            const p = l <= 0.5 ? l * (1 + s) : l + s - (l * s);
            const q = (2 * l) - p;

            r = hue2rgb(q, p, h + 1 / 3);
            g = hue2rgb(q, p, h);
            b = hue2rgb(q, p, h - 1 / 3);
        }

        return [r, g, b];
    }

    // public getColor(): [number, number, number] {
    //     let h = this.hue, s = this.saturation, l = this.lightness;
    //     let r: number = 0, g: number = 0, b: number = 0;
    //     let offsetLightness: number, offsetSaturation: number;

    //     if (h === undefined || s === undefined || l === undefined)
    //         debugger;

    //     if (h < 0) h = (240 - h) % 240;
    //     else h = h % 240;

    //     if (h < 80) r = Math.min(255, 255 * (80 - h) / 40);
    //     else if (h > 160) r = Math.min(255, 255 * (h - 160) / 40);

    //     if (h < 160) g = Math.min(255, 255 * (80 - Math.abs(h - 80)) / 40);
    //     if (h > 80) b = Math.min(255, 255 * (80 - Math.abs(h - 160)) / 40);

    //     if (s < 240) {
    //         const r0 = s / 240;

    //         r = r * r0;
    //         g = g * r0;
    //         b = b * r0;

    //         offsetSaturation = 128 * (240 - s) / 240;
    //         r += offsetSaturation;
    //         g += offsetSaturation;
    //         b += offsetSaturation;
    //     }

    //     l = Math.min(240, l);

    //     const r1 = (120 - Math.abs(l - 120)) / 120;

    //     r = r * r1;
    //     g = g * r1;
    //     b = b * r1;

    //     if (l > 120) {
    //         offsetLightness = 256 * (l - 120) / 120;
    //         r += offsetLightness;
    //         g += offsetLightness;
    //         b += offsetLightness;
    //     }

    //     const r2 = 1 / 255;

    //     r = r * r2;
    //     g = g * r2;
    //     b = b * r2;

    //     debugger;

    //     return [r, g, b];
    // }
}

class FLight extends ULight {

    public load(pkg: UPackage, exp: UExport): this {
        debugger;
        this.readStart = this.readHead = pkg.tell() + this.readHeadOffset;
        this.readTail = this.readHead + Infinity;

        debugger;

        this.readNamedProps(pkg);

        // debugger;

        return this;
    }
}

export default ULight;
export { ULight, FLight };