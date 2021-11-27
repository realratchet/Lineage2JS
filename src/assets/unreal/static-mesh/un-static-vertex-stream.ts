import FConstructable from "../un-constructable";
import FArray from "../un-array";
import BufferValue from "../../buffer-value";
import FVector from "../un-vector";

class FStaticMeshVertexStream extends FConstructable {
    public static readonly typeSize = 24;

    public readonly vert: FArray<FStaticMeshVertex> = new FArray(FStaticMeshVertex);
    public revision: number;

    public load(pkg: UPackage, tag: PropertyTag): this {
        this.vert.load(pkg, null);

        this.revision = pkg.read(new BufferValue(BufferValue.int32)).value as number;

        return this;
    }
}

class FStaticMeshVertex extends FConstructable {
    public static readonly typeSize = 24;

    public readonly position = new FVector();
    public readonly normal = new FVector();

    public load(pkg: UPackage, tag: PropertyTag): this {
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