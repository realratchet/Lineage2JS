import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import UMaterial, { UMaterialContainer, UShader } from "../un-material";
import { FPlane } from "../un-plane";
import BufferValue from "../../buffer-value";
import UBrush from "../un-brush";
import FArray from "../un-array";
import { PolyFlags_T } from "../un-polys";

class FBSPSurf extends FConstructable {
    public static readonly typeSize = 1;

    public material: UShader;

    public flags: PolyFlags_T;            // 4 bytes polygon flags.
    public pBase: number;            // 4 bytes polygon & texture base poINT index (where U,V==0,0).
    public vNormal: number;          // 4 bytes index to polygon normal.
    public vTextureU: number;        // 4 bytes texture U-vector index.
    public vTextureV: number;        // 4 bytes texture V-vector index.
    public iLightMap: number;        // 4 bytes light mesh.
    public iBrushPoly: number;       // 4 bytes editor brush polygon index.
    public panU: number;             // 2 bytes u-panning value.
    public panV: number;             // 2 bytes v-panning value.
    public lightMapScale: number;

    public plane: FPlane = new FPlane();

    protected actor: UBrush;            // 4 bytes brush actor owning this Bsp surface.
    // protected nodes: FArray<BufferValue.; // TArray // 12 Nodes which make up this surface

    public load(pkg: UPackage, tag?: PropertyTag): this {
        const uint64 = new BufferValue(BufferValue.uint64);
        const float = new BufferValue(BufferValue.float);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint8 = new BufferValue(BufferValue.uint8);

        const materialId = pkg.read(compat32).value as number;

        this.flags = pkg.read(uint32).value as number;
        this.pBase = pkg.read(compat32).value as number;
        this.vNormal = pkg.read(compat32).value as number;
        this.vTextureU = pkg.read(compat32).value as number;
        this.vTextureV = pkg.read(compat32).value as number;

        this.iLightMap = -1;

        this.iBrushPoly = pkg.read(compat32).value as number;

        const ownerId = pkg.read(compat32).value as number;

        this.plane.load(pkg);

        this.lightMapScale = pkg.read(float).value as number;

        this.unkInt32 = pkg.read(BufferValue.allocBytes(4));

        this.panU = this.panV = 0;

        const offset = pkg.tell();

        this.promisesLoading.push(new Promise<void>(async resolve => {
            this.material = await pkg.fetchObject<UShader>(materialId);
            resolve();
        }));

        this.promisesLoading.push(new Promise<void>(async resolve => {
            this.actor = await pkg.fetchObject<UBrush>(ownerId);
            resolve();
        }));
        pkg.seek(offset, "set");

        return this;
    }



}

export default FBSPSurf;
export { FBSPSurf };