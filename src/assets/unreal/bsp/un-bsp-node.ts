import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import BufferValue from "../../buffer-value";
import { FPlane } from "../un-plane";
import FVector from "../un-vector";

class FBSPNode extends FConstructable {
    public static readonly typeSize = 1;

    protected readonly plane = new FPlane();    // 16 byte plane the node falls into (X, Y, Z, W).
    protected zoneMask: number;                 // 8  byte mask for all zones at or below this node (up to 64).
    protected iVertPool: number;                // 4  byte index of first vertex in vertex pool, =iTerrain if NumVertices==0 and NF_TerrainFront.
    protected iSurf: number;                    // 4  byte index to surface information.

    protected iBack: number;                    // 4  byte index to node in front (in direction of Normal).
    protected iFront: number;                   // 4  byte index to node in back  (opposite direction as Normal).
    protected iPlane: number;                   // 4  byte index to next coplanar poly in coplanar list.

    protected iCollisionBound: number;          // 4  byte collision bound.
    protected iRenderBound: number;             // 4  byte rendering bound.
    protected iZone: number[] = new Array(2);   // 2  byte visibility zone in 1=front, 0=back.
    protected numVertices: number;              // 1  byte number of vertices in node.
    protected nodeFlags: number;                // 1  byte node flags.
    protected iLeaf: number[] = new Array(2);   // 8  byte leaf in back and front, INDEX_NONE=not a leaf.

    protected baseIndex: number;

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        const uint64 = new BufferValue(BufferValue.uint64);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint8 = new BufferValue(BufferValue.uint8);

        this.plane.load(pkg);
        this.zoneMask = pkg.read(uint64).value as number;
        this.nodeFlags = pkg.read(uint8).value as number;
        this.iVertPool = pkg.read(compat32).value as number;
        this.iSurf = pkg.read(compat32).value as number;

        this.iBack = pkg.read(compat32).value as number;
        this.iFront = pkg.read(compat32).value as number;
        this.iPlane = pkg.read(compat32).value as number;

        this.iCollisionBound = pkg.read(compat32).value as number;
        this.iRenderBound = pkg.read(compat32).value as number;

        {
            const unkVec = new FVector();

            unkVec.load(pkg);
            const unkId = pkg.read(uint32).value as number;
            const unkConnZones = pkg.read(uint64).value as number;
            const unkVisZones = pkg.read(uint64).value as number;

            // debugger;
        }

        this.iZone[0] = pkg.read(compat32).value as number;
        this.iZone[1] = pkg.read(compat32).value as number;

        this.numVertices = pkg.read(uint8).value as number;

        this.iLeaf[0] = pkg.read(uint32).value as number;
        this.iLeaf[1] = pkg.read(uint32).value as number;

        {
            pkg.seek(0xC);
        }

        // debugger;

        return this;
    }

}

export default FBSPNode;
export { FBSPNode };