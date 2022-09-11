import { Euler, Quaternion } from "three";
import { DEG2RAD } from "three/src/math/MathUtils";
import BufferValue from "../buffer-value";
import FConstructable from "./un-constructable";

class FQuaternion extends FConstructable {
    public x: number;
    public y: number;
    public z: number;
    public w: number;

    constructor(x = 0, y = 0, z = 0, w = 1) {
        super();

        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);

        this.x = pkg.read(float).value as number;
        this.y = pkg.read(float).value as number;
        this.z = pkg.read(float).value as number;
        this.w = pkg.read(float).value as number;

        return this;
    }

    public toQuatElements(): QuaternionArr {
        return [-this.x, -this.z, this.y, this.w];
    }
}

export default FQuaternion;
export { FQuaternion };