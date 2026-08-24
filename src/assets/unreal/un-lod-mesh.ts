import { BufferValue } from "@l2js/core";
import FArray, { FObjectArray, FPrimitiveArray } from "@l2js/core/unreal/un-array";
import FColor from "./un-color";
import UMesh from "./un-mesh";
import FRotator from "./un-rotator";
import FVector from "./un-vector";

class FMeshFace implements C.IConstructable {
    public wedgeIndices: [number, number, number] = new Array(3) as [number, number, number];
    public meshMaterialIndex: number;

    public load(pkg: GA.UPackage): this {
        this.wedgeIndices[0] = pkg.read("uint16");
        this.wedgeIndices[1] = pkg.read("uint16");
        this.wedgeIndices[2] = pkg.read("uint16");
        this.meshMaterialIndex = pkg.read("uint16");

        return this;
    }

}

class FMeshWedge implements C.IConstructable {
    public vertexIndex: number;
    public texU: number;
    public texV: number;

    public load(pkg: C.APackage): this {
        this.vertexIndex = pkg.read("uint16");
        this.texU = pkg.read("float");
        this.texV = pkg.read("float");

        return this;
    }
}

class FMeshMaterial implements C.IConstructable {
    public polyFlags: number;
    public materialIndex: number;

    public load(pkg: C.APackage): this {
        this.polyFlags = pkg.read("uint32");
        this.materialIndex = pkg.read("int32");

        return this;
    }
}

abstract class ULodMesh extends UMesh {
    protected version: number;
    protected vertexCount: number;
    protected verts = new FPrimitiveArray(BufferValue.uint32);

    protected meshScale: FVector;
    protected meshOrigin: FVector;
    protected meshRotOrigin: FRotator;
    protected faceLevel = new FPrimitiveArray(BufferValue.uint16);
    protected faces = new FArray(FMeshFace);
    protected collapseWedgeThus = new FPrimitiveArray(BufferValue.uint16);
    protected wedges: FArray<FMeshWedge> = new FArray(FMeshWedge);
    protected meshMaterials: FArray<FMeshMaterial> = new FArray(FMeshMaterial);
    protected meshScaleMax: number;
    protected lodHysteresis: number;
    protected lodStrength: number;
    protected lodMinVerts: number;
    protected lodMorph: number;
    protected lodZDisplace: number;
    protected hasImpostor: boolean;
    protected skinTesselationFactor: number;
    protected authenticationKey: number;
    protected impostor = new MeshImpostor();
    protected lodMeshMaterials = new FObjectArray<GA.UMaterial>();

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        super.doLoad(pkg, exp);

        this.version = pkg.read("uint32");
        this.vertexCount = pkg.read("uint32");

        this.verts.load(pkg);

        if (this.version < 2) {
            debugger;
        }

        this.lodMeshMaterials.load(pkg);

        this.meshScale = FVector.make(pkg.read("float"), pkg.read("float"), pkg.read("float"));
        this.meshOrigin = FVector.make(pkg.read("float"), pkg.read("float"), pkg.read("float"));
        this.meshRotOrigin = FRotator.make(pkg.read("int32"), pkg.read("int32"), pkg.read("int32"));

        if (this.version < 2) {
            debugger;
        }

        this.faceLevel.load(pkg);
        this.faces.load(pkg);
        this.collapseWedgeThus.load(pkg);
        this.wedges.load(pkg);
        this.meshMaterials.load(pkg);

        this.meshScaleMax = pkg.read("float");
        this.lodHysteresis = pkg.read("float");
        this.lodStrength = pkg.read("float");
        this.lodMinVerts = pkg.read("int32");
        this.lodMorph = pkg.read("float");
        this.lodZDisplace = pkg.read("float");

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
            this.authenticationKey = pkg.read("uint32");
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
