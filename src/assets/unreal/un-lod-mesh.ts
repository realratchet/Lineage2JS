import { BufferValue } from "@l2js/core";
import FArray, { FObjectArray, FPrimitiveArray } from "@l2js/core/unreal/un-array";
import FColor from "./un-color";
import UMesh from "./un-mesh";
import FRotator from "./un-rotator";
import FVector from "./un-vector";

class FUnknownStruct1 implements C.IConstructable {
    public a: number;
    public b: number;
    public c: number;
    public d: number;

    public load(pkg: GA.UPackage): this {


        this.a = pkg.read("uint16");
        this.b = pkg.read("uint16");
        this.c = pkg.read("uint16");
        this.d = pkg.read("uint16");

        return this;
    }

}

class FUnknownStruct2 implements C.IConstructable {
    public unkInt16: number;
    public unkInt32_0: number;
    public unkInt32_1: number;

    public load(pkg: C.APackage): this {
        this.unkInt16 = pkg.read("uint16");
        this.unkInt32_0 = pkg.read("uint32");
        this.unkInt32_1 = pkg.read("uint32");

        return this;
    }
}

class FUnknownStruct3 implements C.IConstructable {
    public unkInt32_0: number;
    public unkInt32_1: number;

    public load(pkg: C.APackage): this {
        this.unkInt32_0 = pkg.read("uint32");
        this.unkInt32_1 = pkg.read("uint32");

        return this;
    }
}

abstract class ULodMesh extends UMesh {
    protected version: number;
    protected vertexCount: number;
    protected unkArr0 = new FPrimitiveArray(BufferValue.uint32);

    protected unkArr1: number[];
    protected unkArr2 = new FPrimitiveArray(BufferValue.uint16);
    protected unkArr3 = new FArray(FUnknownStruct1);
    protected unkArr4 = new FPrimitiveArray(BufferValue.uint16);
    protected unkArr5: FArray<FUnknownStruct2> = new FArray(FUnknownStruct2);
    protected unkArr6: FArray<FUnknownStruct3> = new FArray(FUnknownStruct3);
    protected unkArr7: number[];
    protected hasImpostor: boolean;
    protected skinTesselationFactor: number;
    protected unkVar2: number;
    protected impostor = new MeshImpostor();
    protected lodMeshMaterials = new FObjectArray<GA.UMaterial>();

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        super.doLoad(pkg, exp);

        this.version = pkg.read("uint32");
        this.vertexCount = pkg.read("uint32");

        this.unkArr0.load(pkg);

        if (this.version < 2) {
            debugger;
        }

        this.lodMeshMaterials.load(pkg);

        this.unkArr1 = new Array(9).fill(1).map(() => pkg.read("float"));

        if (this.version < 2) {
            debugger;
        }

        this.unkArr2.load(pkg);
        this.unkArr3.load(pkg);
        this.unkArr4.load(pkg);
        this.unkArr5.load(pkg);
        this.unkArr6.load(pkg);

        this.unkArr7 = new Array(6).fill(1).map(() => pkg.read("float"));

        if (this.version >= 3) {
            const maybeHasImpostor = pkg.read("uint32");

            if (maybeHasImpostor !== 0 && maybeHasImpostor !== 1) {
                debugger;
            }

            this.hasImpostor = maybeHasImpostor !== 0;
            this.impostor.load(pkg);
        }

        if (this.version >= 4) {
            this.skinTesselationFactor = pkg.read("uint32");
        }

        if (this.version >= 5) {
            this.unkVar2 = pkg.read("uint32");
        }
    }
}

export default ULodMesh;
export { ULodMesh };



class MeshImpostor implements C.IConstructable {
    public location: FVector;
    public rotation: FRotator;
    public scale: FVector;
    public color: FColor;
    public spaceMode: number;
    public drawMode: number;
    public lightMode: number;
    public materialId: number;
    public material: GA.UMaterial;

    public load(pkg: C.APackage): this {
        this.materialId = pkg.read("compat32");

        this.location = FVector.make().load(pkg);
        this.rotation = FRotator.make().load(pkg);
        this.scale = FVector.make().load(pkg);
        this.color = FColor.make().load(pkg);
        this.spaceMode = pkg.read("uint32");
        this.drawMode = pkg.read("uint32");
        this.lightMode = pkg.read("uint32");

        this.material = pkg.fetchObject<GA.UMaterial>(this.materialId);

        return this;
    }
}