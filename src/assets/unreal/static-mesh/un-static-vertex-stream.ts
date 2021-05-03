import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import FArray from "../un-array";
import { Vector3 } from "three";
import BufferValue from "../../buffer-value";

class FStaticMeshVertexStream extends FConstructable {
    public static readonly typeSize = 24;

    public readonly vert: FArray<FStaticMeshVertex> = new FArray(FStaticMeshVertex);
    public revision: number;

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        await this.vert.load(pkg, null);

        this.revision = pkg.read(new BufferValue(BufferValue.int32)).value as number;

        return this;
    }
}

class FStaticMeshVertex extends FConstructable {
    public static readonly typeSize = 24;

    public readonly position = new Vector3();
    public readonly normal = new Vector3();

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        const f = new BufferValue(BufferValue.float);

        [this.position, this.normal].forEach(vec => {
            ["x", "y", "z"].forEach((ax: "x" | "y" | "z") => {
                vec[ax] = pkg.read(f).value as number;
            });
        });

        return this;
    }
}

export default FStaticMeshVertexStream;
export { FStaticMeshVertexStream };