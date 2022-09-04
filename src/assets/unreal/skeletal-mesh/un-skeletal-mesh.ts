import BufferValue from "@client/assets/buffer-value";
import FArray, { FArrayLazy, FPrimitiveArray, FPrimitiveArrayLazy } from "../un-array";
import FConstructable from "../un-constructable";
import FCoords from "../un-coords";
import ULodMesh from "../un-lod-mesh";
import FNumber from "../un-number";
import FRawIndexBuffer from "../un-raw-index-buffer";
import FVector from "../un-vector";

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
    public unkArr: FPrimitiveArray<"uint16"> = new FPrimitiveArray(BufferValue.uint16);
    public unkInt32: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);

        this.unkArr.load(pkg);
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
    public unkArr = new FArray(FSkinVertexStreamSubtype);

    public load(pkg: UPackage): this {

        const float = new BufferValue(BufferValue.float);

        this.x = pkg.read(float).value as number;
        this.y = pkg.read(float).value as number;
        this.z = pkg.read(float).value as number;
        this.unkArr.load(pkg);

        return this;
    }
}

class FUnknownSubmeshType4 extends FConstructable {
    public a: number;
    public b: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);
        const uint32 = new BufferValue(BufferValue.uint32);

        this.a = pkg.read(float).value as number;
        this.b = pkg.read(uint32).value as number;

        return this;
    }
}

class FUnknownSubmeshType5 extends FConstructable {
    public a: number;
    public b: number;
    public c: number;
    public d: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);
        const uint8 = new BufferValue(BufferValue.uint8);

        this.a = pkg.read(float).value as number;
        this.c = pkg.read(uint8).value as number;

        this.b = pkg.read(float).value as number;
        this.d = pkg.read(uint8).value as number;

        return this;
    }
}

class FUnknownSubmeshType6 extends FConstructable {
    public a: number;
    public b: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);
        const uint32 = new BufferValue(BufferValue.uint32);

        this.a = pkg.read(float).value as number;
        this.b = pkg.read(uint32).value as number;

        return this;
    }
}

class FLikelySubmesh extends FConstructable {
    public unkArr0 = new FPrimitiveArray(BufferValue.float);
    public unkArr1 = new FArray(FUnknownSubmeshType1);
    public unkVar0: number;
    public unkArr2 = new FArray(FUnknownSubmeshType2);
    public unkArr3 = new FArray(FUnknownSubmeshType2);
    public indexBuffer1 = new FRawIndexBuffer();
    public indexBuffer2 = new FRawIndexBuffer();
    public skinVertexStream = new FSkinVertexStream();
    public unkLazyArr0 = new FArrayLazy(FUnknownSubmeshType4);
    public unkLazyArr1 = new FArrayLazy(FUnknownSubmeshType5);
    public unkLazyArr2 = new FArrayLazy(FUnknownSubmeshType6);
    public unkLazyArr3 = new FArrayLazy(FVector);
    public unkArr4: number[];

    public load(pkg: UPackage): this {

        const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const float = new BufferValue(BufferValue.float);

        this.unkArr0.load(pkg);
        this.unkArr1.load(pkg);
        this.unkVar0 = pkg.read(int32).value as number;
        this.unkArr2.load(pkg);
        this.unkArr3.load(pkg);

        this.indexBuffer1.load(pkg);
        this.indexBuffer2.load(pkg);
        this.skinVertexStream.load(pkg);

        this.unkLazyArr0.load(pkg);
        this.unkLazyArr1.load(pkg);
        this.unkLazyArr2.load(pkg);
        this.unkLazyArr3.load(pkg);

        this.unkArr4 = new Array(6).fill(1).map(() => pkg.read(float).value as number);

        return this;
    }
}

class USkeletalMeshSubtype1 extends FConstructable {
    public a: number;
    public b: number;
    public c: number;
    public d: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);
        const uint8 = new BufferValue(BufferValue.uint8);

        this.a = pkg.read(float).value as number;
        this.b = pkg.read(float).value as number;
        this.c = pkg.read(uint8).value as number;
        this.d = pkg.read(uint8).value as number;

        return this;
    }
}

class USkeletalMeshSubtype2 extends FConstructable {
    public a: number;
    public b: number;
    public c: number;

    public load(pkg: UPackage): this {
        const int32 = new BufferValue(BufferValue.int32);

        this.a = pkg.read(int32).value as number;
        this.b = pkg.read(int32).value as number;
        this.c = pkg.read(int32).value as number;

        return this;
    }
}


class USkeletalMeshSubtype3 extends FConstructable {
    public a: number;
    public b: number;

    public load(pkg: UPackage): this {
        const int32 = new BufferValue(BufferValue.int32);

        this.a = pkg.read(int32).value as number;
        this.b = pkg.read(int32).value as number;

        return this;
    }
}

class USkeletalMesh extends ULodMesh {

    protected sk_unkArr0 = new FArray(FUnknownStruct1);
    protected likelyBoneArray = new FArray(FLikelyBone);
    protected likelyIdleAnimId: number;
    protected sk_unkVar0: number;
    protected sk_unkArr2 = new FArray(FUnknownStruct2);
    protected sk_unkArr3 = new FArray(FUnknownStruct3);
    protected sk_unkNames0: string[];
    protected sk_unkNames1: string[];
    protected sk_coordArr0 = new FArray(FCoords);
    protected likelySubmeshes = new FArray(FLikelySubmesh);
    protected sk_unkIndex1: number;
    protected sk_unkArr5 = new FArrayLazy(FVector);
    protected sk_unkArr6 = new FArrayLazy(USkeletalMeshSubtype1);
    protected sk_unkArr7 = new FArrayLazy(USkeletalMeshSubtype2);
    protected sk_unkArr8 = new FArrayLazy(USkeletalMeshSubtype3);
    protected sk_unkArr9 = new FPrimitiveArrayLazy(BufferValue.uint16);
    protected sk_unkArr10 = new FPrimitiveArrayLazy(BufferValue.uint16);
    protected sk_unkVar1: number;
    protected sk_unkArr11 = new FPrimitiveArray(BufferValue.uint32);
    protected sk_unkVar2: number;

    public doLoad(pkg: UPackage, exp: UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        super.doLoad(pkg, exp);

        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);

        this.sk_unkArr0.load(pkg);
        this.likelyBoneArray.load(pkg);
        
        this.likelyIdleAnimId = pkg.read(compat).value as number;

        this.sk_unkVar0 = pkg.read(uint32).value as number;
        this.sk_unkArr2.load(pkg);
        this.sk_unkArr3.load(pkg);
        this.sk_unkNames0 = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg).map(v => pkg.nameTable[v.value].name.value as string);
        this.sk_unkNames1 = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg).map(v => pkg.nameTable[v.value].name.value as string);
        this.sk_coordArr0.load(pkg);

        if (this.maybeLodCount >= 2) {
            this.likelySubmeshes.load(pkg);
            this.sk_unkIndex1 = pkg.read(compat).value as number;
            this.sk_unkArr5.load(pkg);
            this.sk_unkArr6.load(pkg);
            this.sk_unkArr7.load(pkg);
            this.sk_unkArr8.load(pkg);
            this.sk_unkArr9.load(pkg);
            this.sk_unkArr10.load(pkg);

            if (verArchive >= 118 && verLicense >= 3)
                this.sk_unkVar1 = pkg.read(uint32).value as number;

            if (verArchive >= 123 && verLicense >= 18) {
                this.sk_unkArr11.load(pkg);
            }

            if (verArchive >= 120) {
                this.sk_unkVar2 = pkg.read(uint32).value as number;
            }

            this.readHead = pkg.tell();

        } else {
            debugger;
        }

        debugger;
    }
}

export default USkeletalMesh;
export { USkeletalMesh };