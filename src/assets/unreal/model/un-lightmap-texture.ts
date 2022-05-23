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

    public unkMatrix4: number[];
    public unkFloatGroup0: number[];

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

        // 18430.568359375 110065 -9380 27.42898941040039 0 0 0 64 0

        this.unkMatrix4 = new Array(16).fill(1).map(_ => pkg.read(float).value as number);

        const unkArray = pkg.read(BufferValue.allocBytes(9 * 4)) as BufferValue;

        this.unkArrAsFloats = new Array(9);
        this.unkArrAsInts = new Array(9);

        for (let i = 0; i < 9; i++) {
            try {
                this.unkArrAsFloats[i] = (unkArray.value as DataView).getFloat32(i * 4, unkArray.endianess === "little");
                this.unkArrAsInts[i] = (unkArray.value as DataView).getInt32(i * 4, unkArray.endianess === "little")

            } catch (e) {
                debugger;
            }
        }

        // this.unkFloatGroup2 = new Array(9).fill(1).map(_ => pkg.read(float).value as number);

        this.unkSubstructure.load(pkg);

        this.levelId = pkg.read(compat).value as number;

        this.unkIndex1 = pkg.read(int32).value as number;

        return this;
    }
}

export default FLightmapTexture;
export { FLightmapTexture };