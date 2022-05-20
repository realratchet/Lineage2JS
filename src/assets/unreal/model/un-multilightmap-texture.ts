import BufferValue from "@client/assets/buffer-value";
import FArray, { FPrimitiveArray, FPrimitiveArrayLazy } from "../un-array";
import FConstructable from "../un-constructable";

class FStaticLightmapTexture extends FConstructable {
    public unkArr0 = new FPrimitiveArrayLazy(BufferValue.uint8);
    public unkArr1 = new FPrimitiveArrayLazy(BufferValue.uint8);

    public unkUshort0: number;
    public unkInt0: number;
    public unkInt1: number;
    public unkInt2: number;

    public load(pkg: UPackage, tag: PropertyTag): this {
        const float = new BufferValue(BufferValue.float);
        const uint8 = new BufferValue(BufferValue.uint8);
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        // const size1 = pkg.read(compat).value as number;
        // const size2 = pkg.read(compat).value as number;

        this.unkArr0.load(pkg, tag).getTypedArray();
        this.unkArr1.load(pkg, tag).getTypedArray();

        this.unkUshort0 = pkg.read(uint8).value as number;
        this.unkInt0 = pkg.read(int32).value as number;
        this.unkInt1 = pkg.read(int32).value as number;
        this.unkInt2 = pkg.read(int32).value as number;

        // debugger;

        // this.unkInt0 = pkg.read(int32).value as number

        // this.unkIndex0 = pkg.read(compat).value as number;
        // this.unkIndex1 = pkg.read(compat).value as number;

        // debugger;

        return this;
    }
}

class FLightmapTexture extends FConstructable {
    public levelIndex: number;
    public levelExp: import("../un-export").UExport;

    public unkIntArr0 = new FPrimitiveArray(BufferValue.int32);
    public unkLong0: BigInt;
    public unkInt0: number;
    public staticLightmap = new FStaticLightmapTexture();

    public load(pkg: UPackage, tag: PropertyTag): this {
        const float = new BufferValue(BufferValue.float);
        const int32 = new BufferValue(BufferValue.int32);
        const int64 = new BufferValue(BufferValue.int64);
        const compat = new BufferValue(BufferValue.compat32);

        this.levelIndex = pkg.read(compat).value as number;
        this.levelExp = pkg.exports[this.levelIndex - 1];

        this.unkIntArr0.load(pkg, tag);

        // debugger;

        // this.unkIntArr0 = new Array(2).fill(1).map(_ => pkg.read(int32).value as number);
        this.unkLong0 = pkg.read(int64).value as BigInt
        this.unkInt0 = pkg.read(int32).value as number

        // debugger;

        this.staticLightmap.load(pkg, tag);

        // debugger;

        return this;
    }
}

class FMultiLightmapTexture extends FConstructable {
    public textures = new FArray(FLightmapTexture);

    public load(pkg: UPackage, tag: PropertyTag): this {
        const float = new BufferValue(BufferValue.float);
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);


        this.textures.load(pkg, tag);

        debugger;

        return this;
    }
}

export default FMultiLightmapTexture;
export { FMultiLightmapTexture };