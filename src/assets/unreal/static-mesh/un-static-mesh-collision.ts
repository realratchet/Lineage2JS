import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import BufferValue from "../../buffer-value";

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

        for (let i = 0; i < 16; i++)
            this.f1[i] = await pkg.read(float).value as number;

        for (let i = 0; i < 4; i++)
            this.f2[i] = await pkg.read(compat32).value as number;

        return this;
    }

}

export { FStaticMeshCollisionNode, FStaticMeshCollisionTriangle };