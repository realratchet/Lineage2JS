import FConstructable from "../un-constructable";
import FArray, { FPrimitiveArray } from "../un-array";
import BufferValue from "@client/assets/buffer-value";

class FMultiLightMapTexture extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        this.lightmap = new FArray(FLightmapTexture).load(pkg, tag);

        debugger;

        return this;
    }
}

export default FMultiLightMapTexture;
export { FMultiLightMapTexture };

class FLightmapTexture extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        debugger;
        // pFVar1 = (FArchive *)(**(code **)(*(int *)param_1 + 0x18))(piVar3,param_2 + 0x10);
        this.bytes = new FPrimitiveArray(BufferValue.uint32).load(pkg, tag);
        // FArchive::ByteOrderSerialize(pFVar1,param_2 + 4,8);
        // FArchive::ByteOrderSerialize(pFVar1,param_2 + 0x68,4);

        if (0x73 < pkg.header.getArchiveFileVersion()) {
            debugger;
            //   operator<<(param_1,(FStaticLightMapTexture *)(param_2 + 0x1c));
        }

        debugger;

        return this;
    }
}