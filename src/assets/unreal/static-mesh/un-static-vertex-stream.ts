import FVector from "../un-vector";
import { BufferValue } from "@l2js/core";
import FArray from "@l2js/core/src/unreal/un-array";

class FStaticMeshVertexStream implements C.IConstructable {
    declare public vert: FArray<FStaticMeshVertex>;
    declare public revision: number;

    public load(pkg: GA.UPackage): this {
        this.vert = new FArray(FStaticMeshVertex);

        this.vert.load(pkg);

        this.revision = pkg.read(new BufferValue(BufferValue.int32)).value as number;

        return this;
    }
}

class FStaticMeshVertex implements C.IConstructable {
    declare public position: FVector;
    declare public normal: FVector;

    public load(pkg: GA.UPackage): this {
        this.position = FVector.make();
        this.normal = FVector.make();

        this.position.load(pkg);
        this.normal.load(pkg);

        return this;
    }
}

export default FStaticMeshVertexStream;
export { FStaticMeshVertexStream };