type BufferValue<T extends ValueTypeNames_T = ValueTypeNames_T> = import("../buffer-value").BufferValue<T>;

class FConstructable {
    public static readonly fieldCount: number;
    public static readonly fieldSize: number;
}

class FColor extends FConstructable {
    public static readonly fieldCount: number = 4;
    public static readonly fieldSize: number = 1;
    protected value: number;

    public r: number = 0;
    public g: number = 0;
    public b: number = 0;
    public a: number = 0;

    constructor(buff: BufferValue<"buffer">) {
        super();

        this.r = buff.bytes.getUint8(0);
        this.g = buff.bytes.getUint8(1);
        this.b = buff.bytes.getUint8(2);
        this.a = buff.bytes.getUint8(3);
    }
}

class FMipmap extends FConstructable {
    public static readonly fieldCount: number = 9;
    public static readonly fieldSize: number = 32;

    constructor(buff: BufferValue<"buffer">) {
        super();

        debugger;
    }
}

export { FConstructable, FColor, FMipmap };