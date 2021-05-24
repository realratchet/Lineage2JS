import FConstructable from "./unreal/un-constructable";
import UPackage from "./unreal/un-package";
import { PropertyTag } from "./unreal/un-property";
import BufferValue from "./buffer-value";

class FScale extends FConstructable {
    public static readonly typeSize = 25;

    public x: number;
    public y: number;
    public z: number;

    public sheerRate: number;
    public sheerAxis: number;

    public unk0: BufferValue;

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {

        const float = new BufferValue(BufferValue.float);
        const int32 = new BufferValue(BufferValue.int32);
        const int8 = new BufferValue(BufferValue.int8);

        this.x = pkg.read(float).value as number;
        this.y = pkg.read(float).value as number;
        this.z = pkg.read(float).value as number;

        this.sheerRate = pkg.read(int32).value as number;
        this.sheerAxis = pkg.read(int8).value as number;

        this.unk0 = pkg.read(BufferValue.allocBytes(8));

        return this;
    }
}

export default FScale;
export { FScale };