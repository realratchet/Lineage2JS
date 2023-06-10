import { BufferValue } from "@l2js/core";
import FConstructable from "./un-constructable";

class FScale extends FConstructable {
    public x: number;
    public y: number;
    public z: number;

    public sheerRate: number;
    public sheerAxis: number;

    public unk0: BufferValue;

    public load(pkg: UPackage): this {

        const float = new BufferValue(BufferValue.float);
        const int8 = new BufferValue(BufferValue.int8);

        this.x = pkg.read(float).value as number;
        this.y = pkg.read(float).value as number;
        this.z = pkg.read(float).value as number;

        this.sheerRate = pkg.read(float).value as number;
        this.sheerAxis = pkg.read(int8).value as number;

        this.unk0 = pkg.read(BufferValue.allocBytes(8));

        return this;
    }
}

export default FScale;
export { FScale };