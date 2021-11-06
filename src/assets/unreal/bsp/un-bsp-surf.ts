import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import UMaterial, { UMaterialContainer, UShader } from "../un-material";
import FPlane from "../un-plane";
import BufferValue from "../../buffer-value";

class FBSPSurf extends FConstructable {
    public static readonly typeSize = 1;

    protected material: UShader;

    protected polyFlags: number;        // 4 bytes polygon flags.
    protected pBase: number;            // 4 bytes polygon & texture base poINT index (where U,V==0,0).
    protected vNormal: number;          // 4 bytes index to polygon normal.
    protected vTextureU: number;        // 4 bytes texture U-vector index.
    protected vTextureV: number;        // 4 bytes texture V-vector index.
    protected iLightMap: number;        // 4 bytes light mesh.
    protected iBrushPoly: number;       // 4 bytes editor brush polygon index.
    protected panU: number;             // 2 bytes u-panning value.
    protected panV: number;             // 2 bytes v-panning value.

    protected plane: FPlane;

    // AActor /*ABrush**/		*Actor;			// 4 Brush actor owning this Bsp surface.
    // //jfArray<UDecal, uint32>	Decals; // TArray // 12 Array decals on this surface
    // jfArray2<int32, uint32>	Nodes; // TArray // 12 Nodes which make up this surface

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        const uint64 = new BufferValue(BufferValue.uint64);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint8 = new BufferValue(BufferValue.uint8);

        const materialId = await pkg.read(compat32).value as number;

        this.material = await pkg.fetchObject(materialId) as UShader;

        this.polyFlags = await pkg.read(uint32).value as number;
        this.pBase = await pkg.read(compat32).value as number;
        this.vNormal = await pkg.read(compat32).value as number;
        this.vTextureU = await pkg.read(compat32).value as number;
        this.vTextureV = await pkg.read(compat32).value as number;

        this.iLightMap = -1;

        this.iBrushPoly = await pkg.read(compat32).value as number;

        debugger;

        return this;
    }

}

export default FBSPSurf;
export { FBSPSurf };