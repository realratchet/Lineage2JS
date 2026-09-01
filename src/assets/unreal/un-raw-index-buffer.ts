import { BufferValue, type APackage, type Constructable_T, type PropertyTag, FPrimitiveArray } from "@l2js/core";

export class FRawIndexBuffer implements Constructable_T {
    public readonly indices = new FPrimitiveArray(BufferValue.uint16);
    public revision: number;

    public load(pkg: APackage, tag?: PropertyTag): this {
        this.indices.load(pkg, tag);

        this.revision = pkg.read("int32");

        return this;
    }
}

export default FRawIndexBuffer;
