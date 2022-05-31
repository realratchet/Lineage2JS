import FArray from "../un-array";
import FVector from "../un-vector";
import BufferValue from "../../buffer-value";
import FConstructable from "../un-constructable";

class FStaticMeshVertexStream extends FConstructable {
    public readonly vert: FArray<FStaticMeshVertex> = new FArray(FStaticMeshVertex);
    public revision: number;

    public load(pkg: UPackage): this {
        this.vert.load(pkg);

        this.revision = pkg.read(new BufferValue(BufferValue.int32)).value as number;

        return this;
    }
}

class FStaticMeshVertex extends FConstructable {
    public readonly position = new FVector();
    public readonly normal = new FVector();

    public load(pkg: UPackage): this {
        this.position.load(pkg);
        this.normal.load(pkg);

        return this;
    }
}

export default FStaticMeshVertexStream;
export { FStaticMeshVertexStream };