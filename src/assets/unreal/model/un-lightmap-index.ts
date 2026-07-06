import FMatrix from "@client/assets/unreal/un-matrix";
import { BufferValue } from "@l2js/core";
import FArray, { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";


class FSubStructure implements C.IConstructable {
    public lightIndex: number;
    public lightExp: C.UExport;
    public bitmap = new FPrimitiveArray(BufferValue.uint8);

    public unkIntArr0: DataView;
    public unkInt0: number;
    public unkIntArr1: DataView;

    public load(pkg: C.APackage): this {
        this.lightIndex = pkg.read("compat32");
        this.lightExp = pkg.exports[this.lightIndex - 1];

        this.bitmap = this.bitmap.load(pkg);

        this.unkIntArr0 = pkg.read(2 * 4); // two ints
        this.unkInt0 = pkg.read("int32");
        this.unkIntArr1 = pkg.read(4 * 4); // four ints

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

    public unkArrAsFloats: Array<number> = new Array(9);
    public unkArrAsInts: Array<number> = new Array(9);

    public load(pkg: C.APackage): this {
        // pkg.addDependencies(
        //     pkg,
        //     ["Struct", "Matrix"],
        // );

        this.uvMatrix = FMatrix.make();

        this.iLightmapTexture = pkg.read("compat32");
        this.surfaceIndex = pkg.read("compat32");
        this.unkIndex0 = pkg.read("compat32");
        this.offsetX = pkg.read("compat32");
        this.offsetY = pkg.read("compat32");
        this.sizeX = pkg.read("compat32");
        this.sizeY = pkg.read("compat32");

        // 18430.568359375 110065 -9380 27.42898941040039 0 0 0 64 0

        this.uvMatrix.load(pkg);

        const unkArray = pkg.read(9 * 4);

        for (let i = 0; i < 9; i++) {
            this.unkArrAsFloats[i] = unkArray.getFloat32(i * 4, true);
            this.unkArrAsInts[i] = unkArray.getInt32(i * 4, true);
        }

        this.unkSubstructure.load(pkg); // these might be individual lights?
        this.levelId = pkg.read("compat32");
        this.unkInt0 = pkg.read("int32");

        return this;
    }
}

export default FLightmapIndex;
export { FLightmapIndex };