import BufferValue from "@client/assets/buffer-value";
import FArray, { FPrimitiveArray } from "../un-array";
import FConstructable from "../un-constructable";

class FStaticLightmapTexture extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        const float = new BufferValue(BufferValue.float);
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        this.unkInt0 = pkg.read(int32).value as number

        this.unkIndex0 = pkg.read(compat).value as number;
        this.unkIndex1 = pkg.read(compat).value as number;

        debugger;

        return this;
    }
}

class FLightmapTexture extends FConstructable {
    public lightIndex: number;
    public lightExp: import("../un-export").UExport;

    public load(pkg: UPackage, tag: PropertyTag): this {
        const float = new BufferValue(BufferValue.float);
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        this.lightIndex = pkg.read(compat).value as number;
        this.lightExp = pkg.exports[this.lightIndex - 1];

        this.unkIntArr0 = new Array(2).fill(1).map(_ => pkg.read(int32).value as number);
        this.unkInt0 = pkg.read(int32).value as number

        this.staticLightmap = new FStaticLightmapTexture().load(pkg, tag);

        return this;
    }
}

class FMultiLightmapTexture extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        const float = new BufferValue(BufferValue.float);
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        // debugger;

        // const index = pkg.read(compat).value as number;

        // const arr = new FPrimitiveArray(BufferValue.int32).load(pkg, tag);//.getTypedArray();
        this.texture = new FArray(FLightmapTexture).load(pkg, tag);

        debugger;

        return this;
    }
}

export default FMultiLightmapTexture;
export { FMultiLightmapTexture };