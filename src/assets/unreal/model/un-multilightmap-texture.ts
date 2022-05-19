import BufferValue from "@client/assets/buffer-value";
import { FPrimitiveArray } from "../un-array";
import FConstructable from "../un-constructable";

class FMultiLightmapTexture extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        const float = new BufferValue(BufferValue.float);
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);
        
        debugger;

        // const index = pkg.read(compat).value as number;

        // const arr = new FPrimitiveArray(BufferValue.int32).load(pkg, tag);//.getTypedArray();

        debugger;

        return this;
    }
}

export default FMultiLightmapTexture;
export { FMultiLightmapTexture };