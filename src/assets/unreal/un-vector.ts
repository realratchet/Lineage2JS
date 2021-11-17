import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import { Vector3 } from "three";
import BufferValue from "../buffer-value";

class FVector extends FConstructable {
    public static readonly typeSize = 12;
    public readonly vector = new Vector3();

    public async load(pkg: UPackage): Promise<this> {
        const f = new BufferValue(BufferValue.float);

        for (let ax of ["x", "y", "z"]) {
            this.vector[ax as "x" | "y" | "z"] = await pkg.read(f).value as number;
        }

        return this;
    }

    public constructor(x = 0, y = 0, z = 0) {
        super();
        this.vector.set(x, y, z);
    }

    public multiplyScalar(scalar: number): FVector {
        return new FVector(this.vector.x * scalar, this.vector.y * scalar, this.vector.z * scalar)
    }

    public divideScalar(scalar: number) { return this.multiplyScalar(1 / scalar); }

    public add(other: FVector) { return wrapOperation(this, other, "addVectors"); }
    public sub(other: FVector) { return wrapOperation(this, other, "subVectors"); }

    /**
     * operator ^
     * @param other 
     */
    public cross(other: FVector) { return wrapOperation(this, other, "crossVectors"); }

    /**
     * operator |
     * @param other 
     */
    public dot(other: FVector) { return this.vector.dot(other.vector); }
}

export default FVector;
export { FVector };

type ValidOps_T = "addVectors" | "subVectors" | "crossVectors";

function wrapOperation(a: FVector, b: FVector, operation: ValidOps_T) {
    const out = new FVector();

    out.vector[operation](a.vector, b.vector);

    return out;
}