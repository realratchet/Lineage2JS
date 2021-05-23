import UObject from "./un-object";
import BufferValue from "../buffer-value";
import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import FVector from "./un-vector";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class FPoly extends FConstructable {
    public static readonly typeSize = 1;
    public base: FVector = new FVector();
    public normal: FVector = new FVector();
    public textureU: FVector = new FVector();
    public textureV: FVector = new FVector();
    public vertices: FVector[];

    public async load(pkg: UPackage): Promise<this> {
        const compat = new BufferValue(BufferValue.compat32);
        const vcount = pkg.read(compat).value as number;

        debugger;

        await this.base.load(pkg);
        await this.normal.load(pkg);
        await this.textureU.load(pkg);
        await this.textureV.load(pkg);

        this.vertices = new Array(vcount);

        for (let i = 0; i < vcount; i++) 
            this.vertices[i] = await new FVector().load(pkg);

        debugger;

        return this;
    }

}

class UPolys extends UObject {
    protected polyList: FPoly[];

    public async load(pkg: UPackage, exp: UExport) {
        this.readHead = pkg.tell();
        this.readTail = (exp.offset.value as number) + (exp.size.value as number);

        await this.readNamedProps(pkg);

        const int32 = new BufferValue(BufferValue.int32);

        const dbNum = pkg.read(int32).value as number;
        const dbMax = pkg.read(int32).value as number;

        this.polyList = new Array(dbMax);

        for (let i = 0; i < dbMax; i++)
            this.polyList[i] = await new FPoly().load(pkg);

        return this;
    }
}

export default UPolys;
export { UPolys };