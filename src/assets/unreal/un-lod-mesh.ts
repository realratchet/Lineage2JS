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
    maybeLodCount: number;
    maybeVertexCount: number;
    unkArr0: FPrimitiveArray<"uint32">;
    materialsIds: FArray<FConstructable | import("/home/ratchet/Documents/lineage-js/src/assets/unreal/un-object").default>;
    unkArr1: number[];
    unkArr2: FPrimitiveArray<"uint16">;
    unkArr3: FArray<FUnknownStruct1>;
    unkArr4: FPrimitiveArray<"uint16">;
    unkArr5: FArray<FUnknownStruct2>;
    unkArr6: FArray<FUnknownStruct3>;
    unkArr7: number[];
    unkVar0: number;
    unkArr9: number[];
    unkIndex0: number;
    unkArr10: number[];
    unkArr11: number[];
    unkVar1: number;
    unkVar2: number;
    public doLoad(pkg: UPackage, exp: UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        super.doLoad(pkg, exp);

        const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);
        const uint8 = new BufferValue(BufferValue.uint8);

        this.maybeLodCount = pkg.read(uint32).value as number;
        this.maybeVertexCount = pkg.read(uint32).value as number;

        this.unkArr0 = new FPrimitiveArray(BufferValue.uint32).load(pkg);

        if (this.maybeLodCount < 2) {
            debugger;
        }

        this.materialsIds = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg);

        this.unkArr1 = new Array(9).fill(1).map(() => pkg.read(int32).value as number);

        if (this.maybeLodCount < 2) {
            debugger;
        }

        // debugger;

        this.unkArr2 = new FPrimitiveArray(BufferValue.uint16).load(pkg);
        this.unkArr3 = new FArray(FUnknownStruct1).load(pkg);
        this.unkArr4 = new FPrimitiveArray(BufferValue.uint16).load(pkg);
        this.unkArr5 = new FArray(FUnknownStruct2).load(pkg);
        this.unkArr6 = new FArray(FUnknownStruct3).load(pkg);
        this.unkArr7 = new Array(6).fill(1).map(() => pkg.read(int32).value as number);

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