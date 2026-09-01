import { ColorHSV } from "../objects/dynamic-light";

type EnvColorInfo = {
    sky: TimeColor[];
    indexHaze: ArrayLike<number>;
    haze: TimeColor[];
    indexCloud: ArrayLike<number>;
    cloud1: TimeColor[];
    cloud2: TimeColor[];
    cloud3: TimeColor[];
    sun: TimeColor[];
    moon: TimeColor[];
};

type EnvLightInfo = {
    terrain: TimeHSV[];
    actor: TimeHSV[];
    staticMesh: TimeHSV[];
    bsp: TimeHSV[];
}

type EnvAmbientInfo = {
    terrain: TimeColor[];
    actor: TimeColor[];
    staticMesh: TimeColor[];
    bsp: TimeColor[];
};

type EnvScaleInfo = { sun: TimeScale[]; moon: TimeScale[]; }

export class EnvColor {
    public readonly type: 0 | 1 | 2;
    public readonly light: EnvLightInfo;
    public readonly color: EnvColorInfo;
    public readonly ambient: EnvAmbientInfo;
    public readonly scale: EnvScaleInfo;

    public constructor(type: 0 | 1 | 2, light: EnvLightInfo, color: EnvColorInfo, ambient: EnvAmbientInfo, scale: EnvScaleInfo) {
        this.type = type;
        this.light = light;
        this.color = color;
        this.ambient = ambient;
        this.scale = scale;
    }
}

export class TimeColor {
    public readonly time: number;
    public readonly r: number;
    public readonly g: number;
    public readonly b: number;
    public readonly a: number;

    public constructor(time: number, r: number, g: number, b: number, a: number = 255) {
        this.time = time;
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
}

export class TimeHSV extends ColorHSV {
    public readonly time: number;

    public constructor(time: number, h: number, s: number, v: number) {
        super(h, s, v);
        this.time = time;
    }
}

export class TimeScale {
    public readonly time: number;
    public readonly scale: number;

    public constructor(time: number, scale: number) {
        this.time = time;
        this.scale = scale;
    }
}

export default EnvColor;