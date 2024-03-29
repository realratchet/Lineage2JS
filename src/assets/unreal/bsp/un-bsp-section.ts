import FArray from "../un-array";
import FConstructable from "../un-constructable";
import BufferValue from "@client/assets/buffer-value";

class FBSPSection extends FConstructable {
    public bspVertices = new FArray(FBSPVertex);
    public textureId: number;
    public texture: UTexture;

    public unkInt0: number;
    public unkInt1: number;
    public unkInt2: number;
    public unkInt3: number;

    public load(pkg: UPackage): this {
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        this.bspVertices.load(pkg);
        this.unkInt0 = pkg.read(int32).value as number;

        this.textureId = pkg.read(compat).value as number;

        this.unkInt1 = pkg.read(int32).value as number;
        this.unkInt2 = pkg.read(int32).value as number;
        this.unkInt3 = pkg.read(int32).value as number;


        this.texture = pkg.fetchObject<UObject>(this.textureId) as UTexture;

        return this;
    }
}

class FBSPVertex extends FConstructable {
    public unkArr0: number[];
    public unkArr1: number[];

    public load(pkg: UPackage): this {

        const ver = pkg.header.getArchiveFileVersion();
        const f = new BufferValue(BufferValue.float);

        this.unkArr0 = new Array(7).fill(1).map(_ => pkg.read(f).value as number);

        if (0x6c < ver)
            this.unkArr1 = new Array(3).fill(1).map(_ => pkg.read(f).value as number);

        return this;
    }
}

export default FBSPSection;
export { FBSPSection, FBSPVertex };
