import { BufferValue } from "@l2js/core";
import FArray from "@l2js/core/src/unreal/un-array";

class FBSPSection implements C.IConstructable {
    public bspVertices = new FArray(FBSPVertex);
    public textureId: number;
    public texture: GA.UTexture;

    public unkInt0: number;
    public unkInt1: number;
    public unkInt2: number;
    public unkInt3: number;

    public load(pkg: C.APackage): this {
        this.bspVertices.load(pkg);
        this.unkInt0 = pkg.read("int32");

        this.textureId = pkg.read("compat32");

        this.unkInt1 = pkg.read("int32");
        this.unkInt2 = pkg.read("int32");
        this.unkInt3 = pkg.read("int32");


        this.texture = pkg.fetchObject<GA.UTexture>(this.textureId);

        return this;
    }
}

class FBSPVertex implements C.IConstructable {
    public unkArr0: number[];
    public unkArr1: number[];

    public load(pkg: C.APackage): this {

        const ver = pkg.header.getArchiveFileVersion();

        this.unkArr0 = new Array(7).fill(1).map(_ => pkg.read("float"));

        if (0x6c < ver)
            this.unkArr1 = new Array(3).fill(1).map(_ => pkg.read("float"));

        return this;
    }
}

export default FBSPSection;
export { FBSPSection, FBSPVertex };
