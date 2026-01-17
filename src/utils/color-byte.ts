class ColorByte {
    public r: number = 0;
    public g: number = 0;
    public b: number = 0;

    constructor(r: number = 0, g: number = 0, b: number = 0) {
        this.set(r, g, b);
    }

    public set(r: number, g: number, b: number): this {
        this.r = Math.max(0, r | 0);
        this.g = Math.max(0, g | 0);
        this.b = Math.max(0, b | 0);
        return this;
    }

    public copy(other: ColorByte): this {
        this.r = other.r;
        this.g = other.g;
        this.b = other.b;
        return this;
    }

    public static fromFloats(r: number, g: number, b: number): ColorByte {
        return new ColorByte(
            Math.floor(r * 255),
            Math.floor(g * 255),
            Math.floor(b * 255)
        );
    }

    public setFromFloats(r: number, g: number, b: number): this {
        return this.set(
            r * 255,
            g * 255,
            b * 255
        );
    }

    public toFloats(target: { r: number, g: number, b: number }): typeof target {
        target.r = this.r / 255;
        target.g = this.g / 255;
        target.b = this.b / 255;
        return target;
    }

    public shr(bits: number): this {
        this.r >>= bits;
        this.g >>= bits;
        this.b >>= bits;
        return this;
    }

    public addColors(a: ColorByte, b: ColorByte): this {
        return this.set(a.r + b.r, a.g + b.g, a.b + b.b);
    }

    public add(other: ColorByte): this {
        return this.set(this.r + other.r, this.g + other.g, this.b + other.b);
    }

    public addByte(r: number, g: number, b: number): this {
        return this.set(this.r + r, this.g + g, this.b + b);
    }

    public multiplyScalar(s: number): this {
        return this.set(this.r * s, this.g * s, this.b * s);
    }

    public multiplyByte(b: number): this {
        return this.set((this.r * b / 255) | 0, (this.g * b / 255) | 0, (this.b * b / 255) | 0);
    }

    public lerp(other: ColorByte, alpha: number): this {
        this.r += (other.r - this.r) * alpha;
        this.g += (other.g - this.g) * alpha;
        this.b += (other.b - this.b) * alpha;
        return this.set(this.r, this.g, this.b);
    }

    /**
     * Set from L2-style HSV.
     * v is Brightness (0-255, can be higher).
     * Formula: Final = ((1.0 - HueRGB) * Saturation/255 + HueRGB) * Lightness
     * Multiplier updated to 1.5/255.0 per common L2 engine revisions.
     */
    public setFromHSV(h: number, s: number, v: number): this {
        h &= 0xFF;
        let r: number, g: number, b: number;

        if (h < 86) {
            b = 0.0;
            r = (85 - h) * 0.01176471;
            g = h * 0.01176471;
        } else if (h < 171) {
            r = 0.0;
            g = (170 - h) * 0.01176471;
            b = (h - 85) * 0.01176471;
        } else {
            r = (h - 170) * 0.01176471;
            g = 0.0;
            b = (255 - h) * 0.01190476;
        }

        const saturation = (s & 0xff) * 0.003921569;
        let lightness = v * 0.005882353; // Updated multiplier: 1.5 / 255.0

        const sqrLightness = Math.sqrt(lightness);
        lightness = (lightness / (sqrLightness + 0.01)) * 0.7;

        if (lightness > 1.0) lightness = 1.0;
        else if (lightness < 0.0) lightness = 0.0;

        const x = (((1.0 - r) * saturation + r) * lightness);
        const y = (((1.0 - g) * saturation + g) * lightness);
        const z = (((1.0 - b) * saturation + b) * lightness);

        return this.set(x * 255, y * 255, z * 255);
    }

    public equals(other: ColorByte): boolean {
        return this.r === (other.r | 0) && this.g === (other.g | 0) && this.b === (other.b | 0);
    }

    public clone() {
        return new ColorByte(this.r, this.g, this.b);
    }
}

export default ColorByte;
export { ColorByte };