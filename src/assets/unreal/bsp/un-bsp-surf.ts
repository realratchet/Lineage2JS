import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import UMaterial, { UMaterialContainer, UShader } from "../un-material";
import { FPlane } from "../un-plane";
import BufferValue from "../../buffer-value";
import UBrush from "../un-brush";
import FArray from "../un-array";

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
    protected lightMapScale: number;

    protected plane: FPlane = new FPlane();

    protected actor: UBrush;            // 4 bytes brush actor owning this Bsp surface.
    // protected nodes: FArray<BufferValue.; // TArray // 12 Nodes which make up this surface

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        const uint64 = new BufferValue(BufferValue.uint64);
        const float = new BufferValue(BufferValue.float);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint8 = new BufferValue(BufferValue.uint8);

        const materialId = await pkg.read(compat32).value as number;

        this.polyFlags = await pkg.read(uint32).value as number;
        this.pBase = await pkg.read(compat32).value as number;
        this.vNormal = await pkg.read(compat32).value as number;
        this.vTextureU = await pkg.read(compat32).value as number;
        this.vTextureV = await pkg.read(compat32).value as number;

        this.iLightMap = -1;

        this.iBrushPoly = await pkg.read(compat32).value as number;

        const ownerId = await pkg.read(compat32).value as number;

        this.plane.load(pkg);

        this.lightMapScale = await pkg.read(float).value as number;

        const unkInt32 = await pkg.read(uint32).value as number;

        this.panU = this.panV = 0;

        const offset = pkg.tell();
        this.material = await pkg.fetchObject(materialId) as UShader;
        this.actor = await pkg.fetchObject(ownerId) as UBrush;
        pkg.seek(offset, "set");

        // debugger;

        return this;
    }

}

export default FBSPSurf;
export { FBSPSurf };