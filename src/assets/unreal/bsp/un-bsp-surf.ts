import { FPlane } from "../un-plane";
import { BufferValue, UObject } from "@l2js/core";
import { flagBitsToDict } from "@l2js/core/src/utils/flags";
import { PolyFlags_T } from "../un-polys";

class FBSPSurf implements C.IConstructable {
    declare public material: GA.UShader;

    declare public flags: number;       // 4 bytes polygon flags.
    declare public polyFlags: C.FlagDict<keyof typeof PolyFlags_T>;
    declare public pBase: number;            // 4 bytes polygon & texture base poINT index (where U,V==0,0).
    declare public vNormal: number;          // 4 bytes index to polygon normal.
    declare public vTextureU: number;        // 4 bytes texture U-vector index.
    declare public vTextureV: number;        // 4 bytes texture V-vector index.
    declare public iBrushPoly: number;       // 4 bytes editor brush polygon index.
    declare public lightMapScale: number;

    declare public plane: FPlane;

    declare public actor: GA.UBrush;            // 4 bytes brush actor owning this Bsp surface.
    // protected nodes: FArray<BufferValue.; // TArray // 12 Nodes which make up this surface

    declare public unkInt32: number;

    public load(pkg: GA.UPackage): this {
        this.plane = pkg.makeCoreStruct("Plane");

        const float = new BufferValue(BufferValue.float);
        const uint32 = new BufferValue(BufferValue.uint32);
        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

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