import FColor from "./un-color";
import { BufferValue } from "@l2js/core";
import FArray from "@l2js/core/src/unreal/un-array";

class FRawColorStream implements C.IConstructable {
    declare public color: FArray<FColor>;
    declare public revision: number;

    public load(pkg: GA.UPackage): this {
        this.color = new FArray(FColor.class());
        this.color.load(pkg);
        this.revision = pkg.read(new BufferValue(BufferValue.int32)).value;

        return this;
    }

}

export default FRawColorStream;
export { FRawColorStream };