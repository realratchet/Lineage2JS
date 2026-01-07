import { FPlane } from "../un-plane";
import { BufferValue } from "@l2js/core";
import { flagBitsToDict } from "@l2js/core/src/utils/flags";
import { PolyFlags_T } from "../un-polys";

const float = new BufferValue(BufferValue.float);
const uint32 = new BufferValue(BufferValue.uint32);
const int32 = new BufferValue(BufferValue.int32);
const compat32 = new BufferValue(BufferValue.compat32);

class FBSPSurf implements C.IConstructable {
    public material: GA.UShader;

    public flags: number;       // 4 bytes polygon flags.
    public polyFlags: C.FlagDict<keyof typeof PolyFlags_T>;
    public pBase: number;            // 4 bytes polygon & texture base poINT index (where U,V==0,0).
    public vNormal: number;          // 4 bytes index to polygon normal.
    public vTextureU: number;        // 4 bytes texture U-vector index.
    public vTextureV: number;        // 4 bytes texture V-vector index.
    public iBrushPoly: number;       // 4 bytes editor brush polygon index.
    public lightMapScale: number;

    public plane: FPlane;

    public actor: GA.UBrush;            // 4 bytes brush actor owning this Bsp surface.
    // protected nodes: FArray<BufferValue.; // TArray // 12 Nodes which make up this surface

    public unkInt32: number;

    public load(pkg: C.APackage): this {
        this.plane = FPlane.make();

        const materialId = pkg.read(compat32).value;

        this.flags = pkg.read(uint32).value;
        this.polyFlags = flagBitsToDict(this.flags, PolyFlags_T);

        this.pBase = pkg.read(compat32).value;
        this.vNormal = pkg.read(compat32).value;
        this.vTextureU = pkg.read(compat32).value;
        this.vTextureV = pkg.read(compat32).value;

        this.iBrushPoly = pkg.read(compat32).value;

        const ownerId = pkg.read(compat32).value;

        this.plane.load(pkg);

        this.lightMapScale = pkg.read(float).value;

        this.unkInt32 = pkg.read(int32).value;

        const offset = pkg.tell();

        this.material = pkg.fetchObject<GA.UShader>(materialId);
        this.actor = pkg.fetchObject<GA.UBrush>(ownerId);

        pkg.seek(offset, "set");

        return this;
    }
}

export default FBSPSurf;
export { FBSPSurf };