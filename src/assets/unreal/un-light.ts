import BufferValue from "../buffer-value";
import UAActor from "./un-aactor";
import FArray, { FPrimitiveArray } from "./un-array";
import FNumber from "./un-number";

enum LightType_T {
    None,
    Steady,
    Pulse,
    Blink,
    Flicker,
    Strobe,
    SubtlePulse,
    TexturePaletteOnce,
    TexturePaletteLoop
};

enum LightEffect_T {
    TorchWaver,
    FireWaver,
    WateryShimmer,
    SearchLight,
    SlowWave,
    FastWave,
    Shock,
    Disco,
    Spotlight,
    NonIncidence,
    ShellOnly,
    OmniBumpMap,
    Interference,
    Cylinder,
    Rotor,
    Unused
};

class ULight extends UAActor {
    public static readonly typeSize: number = 1;

    public effect: number;
    public lightness: number = 255;
    public radius: number;
    public hue: number = 0;
    public saturation: number = 127;
    public isDirectional: boolean = false;
    public type: number = 1;
    public hasCorona: boolean;
    public period: number;
    public phase: number;
    public cone: number = 0;
    public isDynamic: number;
    public skins: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);

    protected isIgnoredRange: boolean;

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
            "bDynamicLight": "isDynamic",
            "bIgnoredRange": "isIgnoredRange"
        });
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<ILightDecodeInfo> {
        await this.onLoaded();

        return {
            type: "Light",
            color: this.getColor(),
            lightType: this.type,
            cone: this.cone,
            radius: this.radius,
            name: this.objectName,
            position: [this.location.x, this.location.z, this.location.y],
            scale: [this.scale.x, this.scale.z, this.scale.y],
            rotation: this.rotation.getEulerElements(),
        };
    }

    public getColor(): [number, number, number] {
        let h = this.hue, s = this.saturation, l = this.lightness;
        let r: number, g: number, b: number;
        let offsetLightness: number, offsetSaturation: number;

        if (h === undefined || s === undefined || l === undefined)
            debugger;

        if (h < 0) h = (240 - h) % 240;
        else h = h % 240;

        if (h < 80) r = Math.min(255, 255 * (80 - h) / 40);
        else if (h > 160) r = Math.min(255, 255 * (h - 160) / 40);

        if (h < 160) g = Math.min(255, 255 * (80 - Math.abs(h - 80)) / 40);
        if (h > 80) b = Math.min(255, 255 * (80 - Math.abs(h - 160)) / 40);

        if (s < 240) {
            const r0 = s / 240;

            r = r * r0;
            g = g * r0;
            b = b * r0;

            offsetSaturation = 128 * (240 - s) / 240;
            r += offsetSaturation;
            g += offsetSaturation;
            b += offsetSaturation;
        }

        l = Math.min(240, l);

        const r1 = (120 - Math.abs(l - 120)) / 120;

        r = r * r1;
        g = g * r1;
        b = b * r1;

        if (l > 120) {
            offsetLightness = 256 * (l - 120) / 120;
            r += offsetLightness;
            g += offsetLightness;
            b += offsetLightness;
        }

        const r2 = 1 / 255;

        r = r * r2;
        g = g * r2;
        b = b * r2;

        return [r, g, b];
    }
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