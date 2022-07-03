import hsvToRgb from "@client/utils/hsv-to-rgb";
import BufferValue from "../buffer-value";
import FConstructable from "./un-constructable";
import { FPlane } from "./un-plane";

class FNTimeColor extends FConstructable {
    public time: number;
    public r: number;
    public g: number;
    public b: number;

    public load(pkg: UPackage): this {
        const int8 = new BufferValue(BufferValue.int8);
        const int32 = new BufferValue(BufferValue.int32);

        this.time = pkg.read(int32).value as number;

        this.r = pkg.read(int8).value as number;
        this.g = pkg.read(int8).value as number;
        this.b = pkg.read(int8).value as number;

        return this;
    }
};

class FNTimeHSV extends FConstructable {
    public time: number;
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

    public load(pkg: UPackage): this {
        const int8 = new BufferValue(BufferValue.int8);
        const int32 = new BufferValue(BufferValue.int32);
        const float = new BufferValue(BufferValue.float);

        this.time = pkg.read(int32).value as number;

        this.hue = pkg.read(int8).value as number;
        this.saturation = pkg.read(int8).value as number;
        this.lightness = pkg.read(float).value as number;

        return this;
    }

    public toColorPlane() { return new FPlane(...hsvToRgb(this.hue, this.saturation, this.lightness), 1); }
};

class FNTimeScale extends FConstructable {
    public time: number;
    public scale: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);

        this.time = pkg.read(float).value as number;
        this.scale = pkg.read(float).value as number;

        return this;
    }
};

export { FNTimeColor, FNTimeHSV, FNTimeScale };