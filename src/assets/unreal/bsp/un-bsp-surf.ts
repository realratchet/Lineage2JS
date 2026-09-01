import { FPlane } from "../un-plane";
import { BufferValue, type APackage, type Constructable_T, type FlagDict_T, flagBitsToDict } from "@l2js/core";
import { PolyFlags_T } from "../un-polys";
import type { UShader } from "../un-material";
import type { UBrush } from "../un-brush";

export class FBSPSurf implements Constructable_T {
    public material: UShader;

    public flags: number;       // 4 bytes polygon flags.
    public polyFlags: FlagDict_T<keyof typeof PolyFlags_T>;
    public pBase: number;            // 4 bytes polygon & texture base poINT index (where U,V==0,0).
    public vNormal: number;          // 4 bytes index to polygon normal.
    public vTextureU: number;        // 4 bytes texture U-vector index.
    public vTextureV: number;        // 4 bytes texture V-vector index.
    public iBrushPoly: number;       // 4 bytes editor brush polygon index.
    public lightMapScale: number;

    public plane: FPlane;

    public actor: UBrush;            // 4 bytes brush actor owning this Bsp surface.
    // protected nodes: FArray<BufferValue.; // TArray // 12 Nodes which make up this surface

    public unkInt32: number;

    public load(pkg: APackage): this {
        this.plane = FPlane.make();

        const materialId = pkg.read("compat32");

        this.flags = pkg.read("uint32");
        this.polyFlags = flagBitsToDict(this.flags, PolyFlags_T);

        this.pBase = pkg.read("compat32");
        this.vNormal = pkg.read("compat32");
        this.vTextureU = pkg.read("compat32");
        this.vTextureV = pkg.read("compat32");

        this.iBrushPoly = pkg.read("compat32");

        const ownerId = pkg.read("compat32");

        this.plane.load(pkg);

        this.lightMapScale = pkg.read("float");

        // l2 addition, stock-format maps (older chronicles) end at lightMapScale
        if (pkg.header.getLicenseeVersion() >= 23)
            this.unkInt32 = pkg.read("int32");

        const offset = pkg.tell();

        this.material = pkg.fetchObject<UShader>(materialId);
        this.actor = pkg.fetchObject<UBrush>(ownerId);

        pkg.seek(offset, "set");

        return this;
    }
}

export default FBSPSurf;
