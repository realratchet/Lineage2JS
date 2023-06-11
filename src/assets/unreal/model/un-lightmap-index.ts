import { BufferValue } from "@l2js/core";
import FArray, { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";

class FSubStructure implements C.IConstructable {
    public lightIndex: number;
    public lightExp: C.UExport;
    public bitmap = new FPrimitiveArray(BufferValue.uint8);

    public unkIntArr0: number[];
    public unkInt0: number;
    public unkIntArr1: number[];

    public load(pkg: GA.UPackage): this {
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        this.lightIndex = pkg.read(compat).value;
        this.lightExp = pkg.exports[this.lightIndex - 1];

        this.bitmap = this.bitmap.load(pkg);

        this.unkIntArr0 = new Array(2).fill(1).map(_ => pkg.read(int32).value);
        this.unkInt0 = pkg.read(int32).value;
        this.unkIntArr1 = new Array(4).fill(1).map(_ => pkg.read(int32).value);

        return this;
    }
}

class FLightmapIndex implements C.IConstructable {
    public iLightmapTexture: number;
    public surfaceIndex: number;
    public unkIndex0: number;
    public offsetX: number;
    public offsetY: number;
    public sizeX: number;
    public sizeY: number;

    public uvMatrix: GA.FMatrix;
    public unkFloatGroup0: number[];

    public levelId: number;
    public unkSubstructure = new FArray(FSubStructure);
    public unkInt0: number;

    public load(pkg: GA.UPackage): this {
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        this.uvMatrix = pkg.makeCoreStruct("Matrix");


        this.iLightmapTexture = pkg.read(compat).value;
        this.surfaceIndex = pkg.read(compat).value;
        this.unkIndex0 = pkg.read(compat).value;
        this.offsetX = pkg.read(compat).value;
        this.offsetY = pkg.read(compat).value;
        this.sizeX = pkg.read(compat).value;
        this.sizeY = pkg.read(compat).value;

        // 18430.568359375 110065 -9380 27.42898941040039 0 0 0 64 0

        this.uvMatrix.load(pkg);

        const unkArray = pkg.read(BufferValue.allocBytes(9 * 4));

        this.unkArrAsFloats = new Array(9);
        this.unkArrAsInts = new Array(9);

        for (let i = 0; i < 9; i++) {
            this.unkArrAsFloats[i] = (unkArray.value as DataView).getFloat32(i * 4, unkArray.endianess === "little");
            this.unkArrAsInts[i] = (unkArray.value as DataView).getInt32(i * 4, unkArray.endianess === "little")
        }

        this.unkSubstructure.load(pkg); // these might be individual lights?
        this.levelId = pkg.read(compat).value;
        this.unkInt0 = pkg.read(int32).value;

        return this;
    }
}

export default FLightmapIndex;
export { FLightmapIndex };