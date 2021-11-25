import BufferValue from "../buffer-value";
import UAActor from "./un-aactor";
import FArray from "./un-array";
import FNumber from "./un-number";

type Color = import("three").Color;

class ULight extends UAActor {
    public static readonly typeSize: number = 1;

    public effect: number;
    public lightness: number = 255;
    public radius: number;
    public hue: number = 0;
    public saturation: number = 127;
    public isDirectional: boolean = false;
    public type: number;
    public hasCorona: boolean;
    public period: number;
    public phase: number;
    public cone: number;
    public isDynamic: number;
    public skins: FArray<number> = new FArray(FNumber.forType(BufferValue.uint8) as any);

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "LightEffect": "effect",
            "LightBrightness": "lightness",
            "LightRadius": "radius",
            "LightHue": "hue",
            "LightSaturation": "saturation",
            "bDirectional": "isDirectional",
            "LightType": "type",
            "bCorona": "hasCorona",
            "Skins": "skins",
            "LightPeriod": "period",
            "LightPhase": "phase",
            "LightCone": "cone",
            "bDynamicLight": "isDynamic"
        });
    }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        await super.load(pkg, exp);

        // debugger;

        return this;
    }

    public getColor(color: Color): Color {
        let h = this.hue, s = this.saturation, l = this.lightness;

        if (h === undefined || s === undefined || l === undefined)
            debugger;

        let offsetLightness;
        let offsetSaturation;

        if (h < 0) h = (240 - h) % 240;
        else h = h % 240;

        if (h < 80) color.r = Math.min(255, 255 * (80 - h) / 40);
        else if (h > 160) color.r = Math.min(255, 255 * (h - 160) / 40);

        if (h < 160) color.g = Math.min(255, 255 * (80 - Math.abs(h - 80)) / 40);
        if (h > 80) color.b = Math.min(255, 255 * (80 - Math.abs(h - 160)) / 40);

        if (s < 240) {
            color.multiplyScalar(s / 240);
            offsetSaturation = 128 * (240 - s) / 240;
            color.r += offsetSaturation;
            color.g += offsetSaturation;
            color.b += offsetSaturation;
        }

        l = Math.min(240, l);
        color.multiplyScalar((120 - Math.abs(l - 120)) / 120);

        if (l > 120) {
            offsetLightness = 256 * (l - 120) / 120;
            color.r += offsetLightness;
            color.g += offsetLightness;
            color.b += offsetLightness;
        }

        return color.multiplyScalar(1 / 255);
    }
}

export default ULight;
export { ULight };