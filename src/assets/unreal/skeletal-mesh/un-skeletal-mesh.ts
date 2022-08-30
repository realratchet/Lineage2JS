import BufferValue from "@client/assets/buffer-value";
import FArray, { FPrimitiveArray } from "../un-array";
import FConstructable from "../un-constructable";
import FCoords from "../un-coords";
import ULodMesh from "../un-lod-mesh";
import FNumber from "../un-number";
import FRawIndexBuffer from "../un-raw-index-buffer";

class FUnknownStruct1 extends FConstructable {
    public unkInt32_0: number;
    public unkInt32_1: number;
    public unkInt32_2: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);

        this.unkInt32_0 = pkg.read(uint32).value as number;
        this.unkInt32_1 = pkg.read(uint32).value as number;
        this.unkInt32_2 = pkg.read(uint32).value as number;

        return this;
    }
}

class FUnknownStruct2 extends FConstructable {
    public unkArr: FPrimitiveArray<"uint16">;
    public unkInt32: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);

        this.unkArr = new FPrimitiveArray(BufferValue.uint16).load(pkg);
        this.unkInt32 = pkg.read(uint32).value as number;

        return this;
    }
}

class FUnknownStruct3 extends FConstructable {
    public unkInt16_0: number;
    public unkInt16_1: number;

    public load(pkg: UPackage): this {
        const uint16 = new BufferValue(BufferValue.uint16);

        this.unkInt16_0 = pkg.read(uint16).value as number;
        this.unkInt16_1 = pkg.read(uint16).value as number;

        return this;
    }
}

class FLikelyBone extends FConstructable {
    public boneName: string;
    public unkNum0: number;
    public unkArr: number[];
    public unkNum1: number;
    public unkNum2: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);

        const nameIndex = pkg.read(compat).value as number;
        this.boneName = pkg.nameTable[nameIndex].name.value as string;

        this.unkNum0 = pkg.read(uint32).value as number;

        this.unkArr = new Array(11).fill(1).map(() => pkg.read(float).value as number);

        this.unkNum1 = pkg.read(uint32).value as number;
        this.unkNum2 = pkg.read(uint32).value as number;

        return this;
    }
}

class FUnknownSubmeshType1 extends FConstructable {
    public a: number;
    public b: number;
    public c: number;
    public d: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);

        this.a = pkg.read(float).value as number;
        this.b = pkg.read(float).value as number;
        this.c = pkg.read(float).value as number;
        this.d = pkg.read(float).value as number;

        return this;
    }
}

class FUnknownSubmeshType2 extends FConstructable {
    public unkArr: number[];

    public load(pkg: UPackage): this {
        const int16 = new BufferValue(BufferValue.int16);

        this.unkArr = new Array(9).fill(1).map(() => pkg.read(int16).value as number);

        return this;
    }
}

class FSkinVertexStreamSubtype extends FConstructable {
    public unkArr: number[];

    public load(pkg: UPackage): this {

        const float = new BufferValue(BufferValue.float);

        this.unkArr = new Array(8).fill(1).map(() => pkg.read(float).value as number);

        debugger;
        
        return this;
    }
}

class FSkinVertexStream extends FConstructable {
    public x: number;
    public y: number;
    public z: number;
    public unkArr: FArray<FSkinVertexStreamSubtype>;

    public load(pkg: UPackage): this {

        const float = new BufferValue(BufferValue.float);

        this.x = pkg.read(float).value as number;
        this.y = pkg.read(float).value as number;
        this.z = pkg.read(float).value as number;
        this.unkArr = new FArray(FSkinVertexStreamSubtype).load(pkg);

        debugger;

        return this;
    }
}

class FLikelySubmesh extends FConstructable {

    public load(pkg: UPackage): this {

        const int32 = new BufferValue(BufferValue.int32);

        this.unkArr0 = new FPrimitiveArray(BufferValue.float).load(pkg);
        this.unkArr1 = new FArray(FUnknownSubmeshType1).load(pkg);
        this.unkVar0 = pkg.read(int32).value as number;
        this.unkArr2 = new FArray(FUnknownSubmeshType2).load(pkg);
        this.unkArr3 = new FArray(FUnknownSubmeshType2).load(pkg);

        this.indexBuffer1 = new FRawIndexBuffer().load(pkg);
        this.indexBuffer2 = new FRawIndexBuffer().load(pkg);
        this.skinVertexStream = new FSkinVertexStream().load(pkg);

        debugger;


        return this;
    }
}

class USkeletalMesh extends ULodMesh {

    sk_unkArr0: FArray<FUnknownStruct1>;
    sk_unkArr1: FArray<FLikelyBone>;
    sk_unkIndex0: number;
    sk_unkVar0: number;
    sk_unkArr2: FArray<FUnknownStruct2>;
    sk_unkArr3: FArray<FUnknownStruct3>;
    sk_unkNames0: string[];
    sk_unkNames1: string[];
    sk_coordArr0: FArray<FCoords>;

    public doLoad(pkg: UPackage, exp: UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        super.doLoad(pkg, exp);

        const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);
        const uint8 = new BufferValue(BufferValue.uint8);

        this.sk_unkArr0 = new FArray(FUnknownStruct1).load(pkg);
        this.sk_unkArr1 = new FArray(FLikelyBone).load(pkg);
        this.sk_unkIndex0 = pkg.read(compat).value as number;
        this.sk_unkVar0 = pkg.read(uint32).value as number;
        this.sk_unkArr2 = new FArray(FUnknownStruct2).load(pkg);
        this.sk_unkArr3 = new FArray(FUnknownStruct3).load(pkg);
        this.sk_unkNames0 = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg).map(v => pkg.nameTable[v.value].name.value as string);
        this.sk_unkNames1 = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg).map(v => pkg.nameTable[v.value].name.value as string);
        this.sk_coordArr0 = new FArray(FCoords).load(pkg);
        this.sk_unkArr4 = new FArray(FLikelySubmesh).load(pkg);

        if (this.maybeLodCount >= 2) {
        } else {
            debugger;
        }

        debugger;
    }
}

export default USkeletalMesh;
export { USkeletalMesh };