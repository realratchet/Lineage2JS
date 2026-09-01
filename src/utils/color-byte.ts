export class ColorByte {
    public r: number = 0;
    public g: number = 0;
    public b: number = 0;
    public a: number = 255;

    constructor(r: number = 0, g: number = 0, b: number = 0, a: number = 255) {
        this.set(r, g, b, a);
    }

    public set(r: number, g: number, b: number, a: number = 255): this {
        this.r = Math.max(0, r | 0);
        this.g = Math.max(0, g | 0);
        this.b = Math.max(0, b | 0);
        this.a = Math.max(0, a | 0);
        return this;
    }

    public copy(other: ColorByte): this {
        this.r = other.r;
        this.g = other.g;
        this.b = other.b;
        this.a = other.a;
        return this;
    }

    public static fromFloats(r: number, g: number, b: number, a: number = 1.0): ColorByte {
        return new ColorByte(
            Math.floor(r * 255),
            Math.floor(g * 255),
            Math.floor(b * 255),
            Math.floor(a * 255)
        );
    }

    public setFromFloats(r: number, g: number, b: number, a: number = 1.0): this {
        return this.set(
            r * 255,
            g * 255,
            b * 255,
            a * 255
        );
    }

    public toFloats(target: { r: number, g: number, b: number, a?: number }): typeof target {
        target.r = this.r / 255;
        target.g = this.g / 255;
        target.b = this.b / 255;
        if (target.a !== undefined) target.a = this.a / 255;
        return target;
    }

    public shr(bits: number): this {
        this.r >>= bits;
        this.g >>= bits;
        this.b >>= bits;
        this.a >>= bits;
        return this;
    }

    public addColors(a: ColorByte, b: ColorByte): this {
        return this.set(a.r + b.r, a.g + b.g, a.b + b.b, a.a + b.a);
    }

    public add(other: ColorByte): this {
        return this.set(this.r + other.r, this.g + other.g, this.b + other.b, this.a + other.a);
    }

    public addByte(r: number, g: number, b: number, a: number = 0): this {
        return this.set(this.r + r, this.g + g, this.b + b, this.a + a);
    }

    public multiplyScalar(s: number): this {
        return this.set(this.r * s, this.g * s, this.b * s, this.a * s);
    }

    public multiplyByte(b: number): this {
        return this.set((this.r * b / 255) | 0, (this.g * b / 255) | 0, (this.b * b / 255) | 0, (this.a * b / 255) | 0);
    }

    public multiply(other: ColorByte): this {
        this.r = (this.r * other.r / 255) | 0;
        this.g = (this.g * other.g / 255) | 0;
        this.b = (this.b * other.b / 255) | 0;
        this.a = (this.a * other.a / 255) | 0;
        return this;
    }

    public lerp(other: ColorByte, alpha: number): this {
        this.r += (other.r - this.r) * alpha;
        this.g += (other.g - this.g) * alpha;
        this.b += (other.b - this.b) * alpha;
        this.a += (other.a - this.a) * alpha;
        return this.set(this.r, this.g, this.b, this.a);
    }

    // L2-style HSV, v is brightness (0-255, can exceed): Final = ((1.0 - HueRGB) * Saturation/255 + HueRGB) * Lightness
    // multiplier 1.5/255.0 per common L2 engine revisions
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
        let lightness = v * 0.005490196; // Updated multiplier: 1.4 / 255.0

        const sqrLightness = Math.sqrt(lightness);
        lightness = (lightness / (sqrLightness + 0.01)) * 0.7;

        if (lightness > 1.0) lightness = 1.0;
        else if (lightness < 0.0) lightness = 0.0;

        const x = (((1.0 - r) * saturation + r) * lightness);
        const y = (((1.0 - g) * saturation + g) * lightness);
        const z = (((1.0 - b) * saturation + b) * lightness);

        return this.set(x * 255, y * 255, z * 255, 255); // Alpha 255 for HSV
    }

    public equals(other: ColorByte): boolean {
        return this.r === (other.r | 0) && this.g === (other.g | 0) && this.b === (other.b | 0) && this.a === (other.a | 0);
    }

    public clone() {
        return new ColorByte(this.r, this.g, this.b, this.a);
    }

    public toHex(): string {
        const r = Math.min(255, Math.max(0, this.r | 0)).toString(16).padStart(2, "0");
        const g = Math.min(255, Math.max(0, this.g | 0)).toString(16).padStart(2, "0");
        const b = Math.min(255, Math.max(0, this.b | 0)).toString(16).padStart(2, "0");
        return `#${r}${g}${b}`;
    }
}

export default ColorByte;