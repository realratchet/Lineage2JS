import FConstructable from "../un-constructable";
import FArray, { FPrimitiveArray } from "../un-array";
import BufferValue from "@client/assets/buffer-value";

class FSubStructure extends FConstructable {
    public lightIndex: number;
    public lightExp: import("../un-export").UExport;
    public bitmap = new FPrimitiveArray(BufferValue.uint8);

    public unkIntArr0: number[];
    public unkInt0: number;
    public unkIntArr1: number[];

    public load(pkg: UPackage, tag: PropertyTag): this {
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        this.lightIndex = pkg.read(compat).value as number;
        this.lightExp = pkg.exports[this.lightIndex - 1];

        this.bitmap = this.bitmap.load(pkg, tag).getTypedArray();

        this.unkIntArr0 = new Array(2).fill(1).map(_ => pkg.read(int32).value as number);
        this.unkInt0 = pkg.read(int32).value as number;
        this.unkIntArr1 = new Array(4).fill(1).map(_ => pkg.read(int32).value as number);

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

        this.unkSubstructure.load(pkg);

        this.levelId = pkg.read(compat).value as number;

        this.unkIndex1 = pkg.read(int32).value as number;

        return this;
    }
}

export default FLightmapTexture;
export { FLightmapTexture };