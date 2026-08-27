import FMatrix from "../un-matrix";
import { BufferValue } from "@l2js/core";
import FArray, { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";
import FVector from "../un-vector";


class FLightBitmap implements C.IConstructable {
    public lightIndex: number;
    public lightExp: C.UExport;
    public bitmap = new FPrimitiveArray(BufferValue.uint8);

    public sizeX: number;
    public sizeY: number;
    public stride: number;
    public minX: number;
    public minY: number;
    public maxX: number;
    public maxY: number;

    public load(pkg: C.APackage): this {
        this.lightIndex = pkg.read("compat32");
        this.lightExp = pkg.exports[this.lightIndex - 1];

        this.bitmap = this.bitmap.load(pkg);

        this.sizeX = pkg.read("int32");
        this.sizeY = pkg.read("int32");
        this.stride = pkg.read("int32");
        this.minX = pkg.read("int32");
        this.minY = pkg.read("int32");
        this.maxX = pkg.read("int32");
        this.maxY = pkg.read("int32");

        return this;
    }
}


class FLightmapIndex implements C.IConstructable {
    public iLightmapTexture: number;
    public surfaceIndex: number;
    public zoneIndex: number;
    public offsetX: number;
    public offsetY: number;
    public sizeX: number;
    public sizeY: number;

    public uvMatrix: GA.FMatrix;
    public unkFloatGroup0: number[];

    public levelId: number;
    public bitmaps = new FArray(FLightBitmap);
    public revision: number;

    public lightmapBase: FVector;
    public lightmapX: FVector;
    public lightmapY: FVector;

    public load(pkg: C.APackage): this {
        // pkg.addDependencies(
        //     pkg,
        //     ["Struct", "Matrix"],
        // );

        this.uvMatrix = FMatrix.make();

        this.iLightmapTexture = pkg.read("compat32");
        this.surfaceIndex = pkg.read("compat32");
        this.zoneIndex = pkg.read("compat32");
        this.offsetX = pkg.read("compat32");
        this.offsetY = pkg.read("compat32");
        this.sizeX = pkg.read("compat32");
        this.sizeY = pkg.read("compat32");

        // 18430.568359375 110065 -9380 27.42898941040039 0 0 0 64 0

        this.uvMatrix.load(pkg);

        this.lightmapBase = FVector.make().load(pkg);
        this.lightmapX = FVector.make().load(pkg);
        this.lightmapY = FVector.make().load(pkg);

        this.bitmaps.load(pkg);
        this.levelId = pkg.read("compat32");
        this.revision = pkg.read("int32");

        return this;
    }
}

export default FLightmapIndex;
export { FLightmapIndex };
