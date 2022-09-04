import BufferValue from "../buffer-value";
import FArray, { FPrimitiveArray } from "./un-array";
import FConstructable from "./un-constructable";
import UMesh from "./un-mesh";
import FNumber from "./un-number";
import UPackage from "./un-package";

class FUnknownStruct1 extends FConstructable {
    public a: number;
    public b: number;
    public c: number;
    public d: number;

    public load(pkg: UPackage): this {
        const uint16 = new BufferValue(BufferValue.uint16);

        this.a = pkg.read(uint16).value as number;
        this.b = pkg.read(uint16).value as number;
        this.c = pkg.read(uint16).value as number;
        this.d = pkg.read(uint16).value as number;

        return this;
    }

}

class FUnknownStruct2 extends FConstructable {
    public unkInt16: number;
    public unkInt32_0: number;
    public unkInt32_1: number;

    public load(pkg: UPackage): this {
        const uint16 = new BufferValue(BufferValue.uint16);
        const uint32 = new BufferValue(BufferValue.uint32);

        this.unkInt16 = pkg.read(uint16).value as number;
        this.unkInt32_0 = pkg.read(uint32).value as number;
        this.unkInt32_1 = pkg.read(uint32).value as number;

        return this;
    }
}

class FUnknownStruct3 extends FConstructable {
    public unkInt32_0: number;
    public unkInt32_1: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);

        this.unkInt32_0 = pkg.read(uint32).value as number;
        this.unkInt32_1 = pkg.read(uint32).value as number;

        return this;
    }
}

class ULodMesh extends UMesh {
    protected maybeLodCount: number;
    protected maybeVertexCount: number;
    protected unkArr0 = new FPrimitiveArray(BufferValue.uint32);

    protected unkArr1: number[];
    protected unkArr2 = new FPrimitiveArray(BufferValue.uint16);
    protected unkArr3 = new FArray(FUnknownStruct1);
    protected unkArr4 = new FPrimitiveArray(BufferValue.uint16);
    protected unkArr5: FArray<FUnknownStruct2> = new FArray(FUnknownStruct2);
    protected unkArr6: FArray<FUnknownStruct3> = new FArray(FUnknownStruct3);
    protected unkArr7: number[];
    protected unkVar0: number;
    protected unkArr9: number[];
    protected unkIndex0: number;
    protected unkArr10: number[];
    protected unkArr11: number[];
    protected unkVar1: number;
    protected unkVar2: number;
    protected materialsIds = new FArray(FNumber.forType(BufferValue.compat32) as any);

    public doLoad(pkg: UPackage, exp: UExport) {
        super.doLoad(pkg, exp);

        const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);
        const uint8 = new BufferValue(BufferValue.uint8);
        const float = new BufferValue(BufferValue.float);

        this.maybeLodCount = pkg.read(uint32).value as number;
        this.maybeVertexCount = pkg.read(uint32).value as number;

        this.unkArr0.load(pkg);

        if (this.maybeLodCount < 2) {
            debugger;
        }

        this.materialsIds.load(pkg);

        this.unkArr1 = new Array(9).fill(1).map(() => pkg.read(float).value as number);

        if (this.maybeLodCount < 2) {
            debugger;
        }

        this.unkArr2.load(pkg);
        this.unkArr3.load(pkg);
        this.unkArr4.load(pkg);
        this.unkArr5.load(pkg);
        this.unkArr6.load(pkg);

        this.unkArr7 = new Array(6).fill(1).map(() => pkg.read(float).value as number);

        if (this.maybeLodCount >= 3) {
            this.unkVar0 = pkg.read(uint32).value as number;

            this.unkIndex0 = pkg.read(compat).value as number;
            this.unkArr9 = new Array(9).fill(1).map(() => pkg.read(int32).value as number);
            this.unkArr10 = new Array(4).fill(1).map(() => pkg.read(uint8).value as number);
            this.unkArr11 = new Array(3).fill(1).map(() => pkg.read(int32).value as number);
        }

        if (this.maybeLodCount >= 4) {
            this.unkVar1 = pkg.read(uint32).value as number;
        }

        if (this.maybeLodCount >= 5) {
            this.unkVar2 = pkg.read(uint32).value as number;
        }
    }
}

export default ULodMesh;
export { ULodMesh };