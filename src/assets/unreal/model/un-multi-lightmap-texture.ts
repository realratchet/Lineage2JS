import FConstructable from "../un-constructable";
import FArray, { FPrimitiveArray, FPrimitiveArrayLazy } from "../un-array";
import BufferValue from "@client/assets/buffer-value";

class FSubStructure extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        const uint8 = new BufferValue(BufferValue.uint8);
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        // debugger;

        this.unkIndex0 = pkg.read(compat).value as number;
        const light = pkg.exports[this.unkIndex0 - 1];

        // debugger;

        // const offset = pkg.tell();
        // const size = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        // pkg.seek(offset, "set");

        // debugger;

        this.unkArr = new FPrimitiveArray(BufferValue.uint8).load(pkg, tag).getTypedArray();

        // debugger;

        this.unkInts0 = new Array(2).fill(1).map(_ => pkg.read(int32).value as number);

        this.unk0 = pkg.read(int32).value as number;

        this.unkInts1 = new Array(4).fill(1).map(_ => pkg.read(int32).value as number);

        // debugger;

        return this;
    }
}

class FLightmapTexture extends FConstructable {
    public lightmapTextureIndex: number;
    public surfaceIndex: number;
    public unkIndex0: number;
    public offsetX: number;
    public offsetY: number;
    public sizeX: number;
    public sizeY: number;

    public unkFloatGroup1: number[];
    public unkFloatGroup2: number[];

    public levelId: number;
    public unkSubstructure = new FArray(FSubStructure);
    public unkIndex1: number;

    public load(pkg: UPackage, tag: PropertyTag): this {
        const float = new BufferValue(BufferValue.float);
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        /* some 7 indices */
        ([
            this.lightmapTextureIndex,
            this.surfaceIndex,
            this.unkIndex0,
            this.offsetX,
            this.offsetY,
            this.sizeX,
            this.sizeY
        ] = new Array(7).fill(1).map(_ => pkg.read(compat).value as number));

        this.unkFloatGroup1 = new Array(16).fill(1).map(_ => pkg.read(float).value as number);
        this.unkFloatGroup2 = new Array(9).fill(1).map(_ => pkg.read(float).value as number);

        debugger;

        const offset = pkg.tell();
        const size = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        pkg.seek(offset, "set");


        const ver = pkg.header.getArchiveFileVersion();

        // debugger;

        this.unkSubstructure.load(pkg);

        this.levelId = pkg.read(compat).value as number;
        this.unk0 = pkg.read(int32).value as number;

        // const ver = pkg.header.getArchiveFileVersion();

        debugger;



        return this;
    }
}

export default FLightmapTexture;
export { FLightmapTexture };