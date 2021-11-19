import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import BufferValue from "../../buffer-value";
import FVector from "../un-vector";

class FStaticMeshCollisionNode extends FConstructable {
    public static readonly typeSize: number = 4 * 4 + 4 * 6 + 1;

    public f1: number[] = new Array(4);
    public f2: number[] = new Array(6);
    public f3: number;

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        const compat32 = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);
        const int8 = new BufferValue(BufferValue.int8);

        for (let i = 0; i < 4; i++)
            this.f1[i] = await pkg.read(compat32).value as number;

        for (let i = 0; i < 4; i++)
            this.f2[i] = await pkg.read(float).value as number;

        this.f3 = await pkg.read(int8).value as number;

        return this;
    }
}

class FStaticMeshCollisionTriangle extends FConstructable {
    public static readonly typeSize: number = 4 * 16 + 2 * 4;

    public f1: number[] = new Array(16);
    public f2: number[] = new Array(4);

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        const compat32 = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);

        const nx = await new FVector().load(pkg);
        const x = await pkg.read(float).value as number;

        const ny = await new FVector().load(pkg);
        const y = await pkg.read(float).value as number;

        const nz = await new FVector().load(pkg);
        const z = await pkg.read(float).value as number;

        const unk = new Float32Array((await pkg.read(BufferValue.allocBytes(128)).value as DataView).buffer);

        // debugger;

        // for (let i = 0; i < 4 * 4; i++)
        //     this.f1[i] = await pkg.read(float).value as number;

        // await pkg.read(float)
        // await pkg.read(float)
        // await pkg.read(float)
        // await pkg.read(float)

        for (let i = 0; i < 4; i++)
            this.f2[i] = await pkg.read(compat32).value as number;

        return this;
    }

}

export { FStaticMeshCollisionNode, FStaticMeshCollisionTriangle };