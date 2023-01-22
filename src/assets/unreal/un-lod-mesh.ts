import BufferValue from "../buffer-value";
import FArray, { FPrimitiveArray } from "./un-array";
import FColor from "./un-color";
import FConstructable from "./un-constructable";
import UMesh from "./un-mesh";
import FNumber from "./un-number";
import FRotator from "./un-rotator";
import FVector from "./un-vector";

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
    protected lodMeshMaterials: UMaterial[];

    public doLoad(pkg: UPackage, exp: UExport) {
        super.doLoad(pkg, exp);

        const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);
        const uint8 = new BufferValue(BufferValue.uint8);
        const float = new BufferValue(BufferValue.float);

        this.version = pkg.read(uint32).value as number;
        this.vertexCount = pkg.read(uint32).value as number;

        this.unkArr0.load(pkg);

        if (this.version < 2) {
            debugger;
        }

        const lodMeshMaterialsIds = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg);

        this.unkArr1 = new Array(9).fill(1).map(() => pkg.read(float).value as number);

        if (this.version < 2) {
            debugger;
        }

        this.unkArr2.load(pkg);
        this.unkArr3.load(pkg);
        this.unkArr4.load(pkg);
        this.unkArr5.load(pkg);
        this.unkArr6.load(pkg);

        this.unkArr7 = new Array(6).fill(1).map(() => pkg.read(float).value as number);

        if (this.version >= 3) {
            const maybeHasImpostor = pkg.read(uint32).value as number;

            if (maybeHasImpostor !== 0 && maybeHasImpostor !== 1) {
                debugger;
            }

            this.hasImpostor = maybeHasImpostor !== 0;
            this.impostor.load(pkg);
        }

        if (this.version >= 4) {
            this.skinTesselationFactor = pkg.read(uint32).value as number;
        }

        if (this.version >= 5) {
            this.unkVar2 = pkg.read(uint32).value as number;
        }

        this.promisesLoading.push(new Promise<void>(async resolve => {
            this.lodMeshMaterials = await Promise.all(
                lodMeshMaterialsIds.map(async (index: FNumber) => {
                    return await pkg.fetchObject<UMaterial>(index.value);
                })
            );

            resolve();
        }));
    }
}

export default ULodMesh;
export { ULodMesh };

class MeshImpostor extends FConstructable {
    public location: FVector;
    public rotation: FRotator;
    public scale: FVector;
    public color: FColor;
    public spaceMode: number;
    public drawMode: number;
    public lightMode: number;
    public materialId: number;
    public material: UMaterial;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);

        this.materialId = pkg.read(compat).value as number;

        this.location = new FVector().load(pkg);
        this.rotation = new FRotator().load(pkg);
        this.scale = new FVector().load(pkg);
        this.color = new FColor().load(pkg);
        this.spaceMode = pkg.read(uint32).value as number;
        this.drawMode = pkg.read(uint32).value as number;
        this.lightMode = pkg.read(uint32).value as number;

        if (this.materialId !== 0) {
            this.promisesLoading.push(new Promise<void>(async resolve => {
                this.material = await pkg.fetchObject<UMaterial>(this.materialId);

                resolve();
            }));
        }

        return this;
    }
}