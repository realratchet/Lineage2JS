import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property-tag";
import { BufferValue } from "@l2js/core";
import { FPlane } from "../un-plane";
import FVector from "../un-vector";

// Flags associated with a Bsp node.
enum BspNodeFlags_T {
    // Flags.
    NF_NotCsg = 0x01,           // Node is not a Csg splitter, i.e. is a transparent poly.
    NF_NotVisBlocking = 0x04,   // Node does not block visibility, i.e. is an invisible collision hull.
    NF_BrightCorners = 0x10,    // Temporary.
    NF_IsNew = 0x20,            // Editor: Node was newly-added.
    NF_IsFront = 0x40,          // Filter operation bounding-sphere precomputed and guaranteed to be front.
    NF_IsBack = 0x80,           // Guaranteed back.
};

class FBSPNode extends FConstructable {
    public readonly plane = new FPlane();    // 16 byte plane the node falls into (X, Y, Z, W).
    public zoneMask: number;                 // 8  byte mask for all zones at or below this node (up to 64).
    public iVertPool: number;                // 4  byte index of first vertex in vertex pool, =iTerrain if NumVertices==0 and NF_TerrainFront.
    public iSurf: number;                    // 4  byte index to surface information.

    public iBack: number;                    // 4  byte index to node in front (in direction of Normal).
    public iFront: number;                   // 4  byte index to node in back  (opposite direction as Normal).
    public iPlane: number;                   // 4  byte index to next coplanar poly in coplanar list.

    public iCollisionBound: number;          // 4  byte collision bound.
    public iRenderBound: number;             // 4  byte rendering bound.
    public readonly iZone: number[] = new Array(2);   // 2  byte visibility zone in 1=front, 0=back.
    public numVertices: number;              // 1  byte number of vertices in node.
    public flags: BspNodeFlags_T;            // 1  byte node flags.
    public readonly iLeaf: number[] = new Array(2);   // 8  byte leaf in back and front, INDEX_NONE=not a leaf.

    public iVertexIndex: number;
    public iLightmapIndex: number;

    public unkInt0: number;                  // 4 bytes, static between same surface nodes
    public unkInt1: number;                  // 4 bytes, change between same surface nodes

    public plane2 = new FPlane();                 // 12 bytes, origin of the bsp surface node
    public unkFloat: number;
    public unkBytes = BufferValue.allocBytes(16) // 16 bytes, usually 0?

    public load(pkg: UPackage, tag?: PropertyTag): this {
        const uint64 = new BufferValue(BufferValue.uint64);
        const float = new BufferValue(BufferValue.float);
        const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint8 = new BufferValue(BufferValue.uint8);

        this.plane.load(pkg);

        this.zoneMask = pkg.read(uint64).value as number;
        this.flags = pkg.read(uint8).value as number;
        this.iVertPool = pkg.read(compat32).value as number;
        this.iSurf = pkg.read(compat32).value as number;

        this.iBack = pkg.read(compat32).value as number;
        this.iFront = pkg.read(compat32).value as number;
        this.iPlane = pkg.read(compat32).value as number;

        this.iCollisionBound = pkg.read(compat32).value as number;
        this.iRenderBound = pkg.read(compat32).value as number;

        this.plane2.load(pkg);

        pkg.read(this.unkBytes);

        // const unkId = pkg.read(uint32).value as number;
        // const unkConnZones = pkg.read(uint64).value as number;
        // const unkVisZones = pkg.read(uint64).value as number;

        this.iZone[0] = pkg.read(compat32).value as number;
        this.iZone[1] = pkg.read(compat32).value as number;

        this.numVertices = pkg.read(uint8).value as number;

        this.iLeaf[0] = pkg.read(int32).value as number;
        this.iLeaf[1] = pkg.read(int32).value as number;

        this.unkInt0 = pkg.read(uint32).value as number;
        this.unkInt1 = pkg.read(uint32).value as number;

        this.iLightmapIndex = pkg.read(int32).value as number;
    

        // debugger;

        return this;
    }

    public getBSPDecodeInfo(): IBSPNodeDecodeInfo_T {
        return {
            children: [this.iFront, this.iBack],
            // plane: this.plane.toArray() as Vector4Arr,
            plane: [this.plane.x, this.plane.z, this.plane.y, this.plane.w] as Vector4Arr,
            leaves: [this.iLeaf[0], this.iLeaf[1]],
            zones: [this.iZone[0], this.iZone[1]]
        };
    }

}

export default FBSPNode;
export { FBSPNode, BspNodeFlags_T };