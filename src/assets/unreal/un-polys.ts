import UObject from "./un-object";
import BufferValue from "../buffer-value";
import FConstructable from "./un-constructable";
import { PropertyTag } from "./un-property";
import FVector from "./un-vector";
import UTexture from "./un-texture";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class FPoly extends FConstructable {
    public static readonly typeSize = 1;
    public base: FVector = new FVector();
    public normal: FVector = new FVector();
    public textureU: FVector = new FVector();
    public textureV: FVector = new FVector();
    public vertices: FVector[];
    public flags: number;
    public actor: UObject;
    public texture: UTexture;
    public link: number;
    public brushPoly: number;
    public name: string;
    public panU: number;
    public panV: number;

    public async load(pkg: UPackage): Promise<this> {
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);
        const int16 = new BufferValue(BufferValue.int16);
        
        const vcount = await pkg.read(compat).value as number;

        if (vcount < 0)
            debugger;

        await this.base.load(pkg);
        await this.normal.load(pkg);
        await this.textureU.load(pkg);
        await this.textureV.load(pkg);

        this.vertices = new Array(vcount);

        for (let i = 0; i < vcount; i++)
            this.vertices[i] = await new FVector().load(pkg);

        this.flags = await pkg.read(uint32).value as number;

        const actorId = await pkg.read(compat).value as number;
        const textureId = await pkg.read(compat).value as number;
        const nameId = await pkg.read(compat).value as number;

        this.name = pkg.nameTable[nameId].name.value as string;
        this.link = await pkg.read(compat).value as number;
        this.brushPoly = await pkg.read(compat).value as number;

        this.panU = await pkg.read(int16).value as number;
        this.panV = await pkg.read(int16).value as number;

        pkg.seek(4);

        // debugger;

        const offset = pkg.tell();
        this.actor = await pkg.fetchObject(actorId);
        this.texture = await pkg.fetchObject(textureId) as UTexture;
        pkg.seek(offset, "set");

        // debugger;

        return this;
    }

}

class UPolys extends UObject {
    protected polyList: FPoly[];

    public async load(pkg: UPackage, exp: UExport) {
        // this.readHead = pkg.tell();
        // this.readTail = (exp.offset.value as number) + (exp.size.value as number);

        this.setReadPointers(exp);
        pkg.seek(this.readHead, "set");

        const startOffset = pkg.tell();

        // debugger;

        await this.readNamedProps(pkg);

        console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);


        // super.load(pkg, exp);

        const int32 = new BufferValue(BufferValue.int32);

        const dbNum = pkg.read(int32).value as number;
        const dbMax = pkg.read(int32).value as number;

        console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);

        this.polyList = new Array(dbMax);

        // debugger;

        for (let i = 0; i < dbMax; i++) {
            this.polyList[i] = await new FPoly().load(pkg);
            console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);
        }

        console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);

        // debugger;

        return this;
    }
}

export default UPolys;
export { UPolys };