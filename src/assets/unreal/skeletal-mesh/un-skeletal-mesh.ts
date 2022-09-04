import BufferValue from "@client/assets/buffer-value";
import FArray, { FArrayLazy, FPrimitiveArray, FPrimitiveArrayLazy } from "../un-array";
import FConstructable from "../un-constructable";
import FCoords from "../un-coords";
import ULodMesh from "../un-lod-mesh";
import FNumber from "../un-number";
import UPackage from "../un-package";
import FQuaternion from "../un-quaternion";
import FRawIndexBuffer from "../un-raw-index-buffer";
import FVector from "../un-vector";

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

class FJointPos extends FConstructable {
    rotation = new FQuaternion();
    position = new FVector();
    scale = new FVector();
    length: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);

        this.rotation.load(pkg);
        this.position.load(pkg);
        this.length = pkg.read(float).value as number;
        this.scale.load(pkg);

        return this;
    }

}

class FMeshBone extends FConstructable {
    public boneName: string;
    public flags: number;
    public bonePos = new FJointPos();
    public numChildren: number;
    public parentIndex: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);

        const nameIndex = pkg.read(compat).value as number;
        this.boneName = pkg.nameTable[nameIndex].name.value as string;

        this.flags = pkg.read(uint32).value as number;

        this.bonePos.load(pkg);

        this.numChildren = pkg.read(uint32).value as number;
        this.parentIndex = pkg.read(uint32).value as number;

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

class FMeshWedge extends FConstructable {
    public iVertex: number;
    public texU: number;
    public texV: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);
        const uint16 = new BufferValue(BufferValue.uint16);

        this.iVertex = pkg.read(uint16).value as number;
        this.texU = pkg.read(float).value as number;
        this.texV = pkg.read(float).value as number;

        return this;
    }
}

class FTriangle extends FConstructable {
    public indices: [number, number, number] = new Array(3) as [number, number, number];
    public materialIndex: number;
    public materialIndex2: number;
    public smoothingGroups: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);
        const uint8 = new BufferValue(BufferValue.uint8);

        this.indices[0] = pkg.read(uint16).value as number;
        this.indices[1] = pkg.read(uint16).value as number;
        this.indices[2] = pkg.read(uint16).value as number;

        this.materialIndex = pkg.read(uint8).value as number;
        this.materialIndex2 = pkg.read(uint8).value as number;
        this.smoothingGroups = pkg.read(uint32).value as number;

        return this;
    }
}


class FVertexInfluence extends FConstructable {
    public weight: number;
    public iPoint: number;
    public iBone: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);
        const uint16 = new BufferValue(BufferValue.uint16);

        this.weight = pkg.read(float).value as number;
        this.iPoint = pkg.read(uint16).value as number;
        this.iBone = pkg.read(uint16).value as number;

        return this;
    }
}

class USkeletalMesh extends ULodMesh {

    protected points2 = new FArray(FVector);
    protected refSkeleton = new FArray(FMeshBone);
    protected animationId: number;
    protected skeletalDepth: number;
    protected weightIndices = new FArray(FUnknownStruct2);
    protected boneInluences = new FArray(FUnknownStruct3);
    protected attachAliases: string[];
    protected attachBoneNames: string[];
    protected attachCoords = new FArray(FCoords);
    protected lodModels = new FArray(FLikelySubmesh);
    protected sk_unkIndex1: number;
    protected points = new FArrayLazy(FVector);
    protected wedges = new FArrayLazy(FMeshWedge);
    protected faces = new FArrayLazy(FTriangle);
    protected vertexInfluences = new FArrayLazy(FVertexInfluence);
    protected collapseWedge = new FPrimitiveArrayLazy(BufferValue.uint16);
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

        this.points2.load(pkg);
        this.refSkeleton.load(pkg);

        this.animationId = pkg.read(compat).value as number;

        this.skeletalDepth = pkg.read(uint32).value as number;
        this.weightIndices.load(pkg);
        this.boneInluences.load(pkg);
        this.attachAliases = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg).map(v => pkg.nameTable[v.value].name.value as string);
        this.attachBoneNames = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg).map(v => pkg.nameTable[v.value].name.value as string);
        this.attachCoords.load(pkg);

        if (this.version >= 2) {
            this.lodModels.load(pkg);
            this.sk_unkIndex1 = pkg.read(compat).value as number;

            if (this.sk_unkIndex1 !== 0)
                debugger;

            this.points.load(pkg);
            this.wedges.load(pkg);
            this.faces.load(pkg);
            this.vertexInfluences.load(pkg);
            this.collapseWedge.load(pkg);
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

        console.assert(this.readHead === this.readTail, "Should be zero");

        debugger;
    }
}

export default USkeletalMesh;
export { USkeletalMesh };