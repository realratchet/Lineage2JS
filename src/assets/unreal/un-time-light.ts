import hsvToRgb from "@client/utils/hsv-to-rgb";
import { BufferValue } from "@l2js/core";
import { FPlane } from "./un-plane";

abstract class FNBaseTimedConstructable implements C.IConstructable, GD.IBaseTimedConstructable {
    public time: number;

    abstract load(pkg: GA.UPackage): this;
}

class FNTimeColor extends FNBaseTimedConstructable {
    public r: number;
    public g: number;
    public b: number;

    constructor(t = 0, r = 0, g = 0, b = 0) {
        super();

        this.time = t;
        this.r = r;
        this.g = g;
        this.b = b;
    }

    public getColor(): [number, number, number] { return [this.r / 255, this.g / 255, this.b / 255]; }

    public load(pkg: GA.UPackage): this {
        const int8 = new BufferValue(BufferValue.int8);
        const int32 = new BufferValue(BufferValue.int32);

        this.time = pkg.read(int32).value as number;

        this.r = pkg.read(int8).value as number;
        this.g = pkg.read(int8).value as number;
        this.b = pkg.read(int8).value as number;

        return this;
    }
};

class FNTimeHSV extends FNBaseTimedConstructable {
    public hue: number;
    public saturation: number;
    public lightness: number;

    constructor(t = 0, h = 0, s = 0, v = 0) {
        super();

        this.time = t;
        this.hue = h;
        this.saturation = s;
        this.lightness = v;
    }

    public load(pkg: GA.UPackage): this {
        const int8 = new BufferValue(BufferValue.int8);
        const int32 = new BufferValue(BufferValue.int32);
        const float = new BufferValue(BufferValue.float);

        this.time = pkg.read(int32).value as number;

        this.hue = pkg.read(int8).value as number;
        this.saturation = pkg.read(int8).value as number;
        this.lightness = pkg.read(float).value as number;

        return this;
    }

    public getColor(): [number, number, number] { return hsvToRgb(this.hue, this.saturation, this.lightness); }
    public toColorPlane() { return new FPlane(...this.getColor(), 1); }
};

class FNTimeScale extends FNBaseTimedConstructable {
    public scale: number;

    public load(pkg: GA.UPackage): this {
        const float = new BufferValue(BufferValue.float);

        this.time = pkg.read(float).value as number;
        this.scale = pkg.read(float).value as number;

        return this;
    }
};

export { FNTimeColor, FNTimeHSV, FNTimeScale };