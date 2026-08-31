import { BufferValue, type APackage, type Constructable_T, type FlagDict_T, flagBitsToDict } from "@l2js/core";
import { FPlane } from "../un-plane";

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

class FBSPNode implements Constructable_T {
    public plane: FPlane;                // 16 byte plane the node falls into (X, Y, Z, W).
    public zoneMask: bigint;                // 8  byte mask for all zones at or below this node (up to 64).
    public iVertPool: number;               // 4  byte index of first vertex in vertex pool, =iTerrain if NumVertices==0 and NF_TerrainFront.
    public iSurf: number;                   // 4  byte index to surface information.

    public iBack: number;                            // 4  byte index to node in front (in direction of Normal).
    public iFront: number;                           // 4  byte index to node in back  (opposite direction as Normal).
    public iPlane: number;                           // 4  byte index to next coplanar poly in coplanar list.

    public iCollisionBound: number;                 // 4  byte collision bound.
    public iRenderBound: number;                    // 4  byte rendering bound.
    public readonly iZone: number[] = new Array(2); // 2  byte visibility zone in 1=front, 0=back.
    public numVertices: number;                     // 1  byte number of vertices in node.
    public flags: number;                           // 1  byte node flags.
    public bspNodeFlags: FlagDict_T<keyof typeof BspNodeFlags_T>;
    public readonly iLeaf: number[] = new Array(2); // 8  byte leaf in back and front, INDEX_NONE=not a leaf.

    public iVertexIndex: number;
    public iLightmapIndex: number;

    public iSection: number;                        // 4 bytes, static between same surface nodes
    public iFirstVertex: number;                    // 4 bytes, change between same surface nodes

    declare exclusiveSphereBound: FPlane;           // 16 Bounding sphere excluding child nodes.
    declare inclusiveSphereBound: FPlane;           // 16 Bounding sphere excluding child nodes.

    public getChildren() { return [this.iBack, this.iFront, this.iPlane]; }

    public load(pkg: APackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();

        this.plane = FPlane.make();
        this.exclusiveSphereBound = FPlane.make();
        this.inclusiveSphereBound = FPlane.make();

        this.plane.load(pkg);

        this.zoneMask = pkg.read("uint64");
        this.flags = pkg.read("uint8");
        this.bspNodeFlags = flagBitsToDict(this.flags, BspNodeFlags_T);
        this.iVertPool = pkg.read("compat32");
        this.iSurf = pkg.read("compat32");

        this.iBack = pkg.read("compat32");
        this.iFront = pkg.read("compat32");
        this.iPlane = pkg.read("compat32");

        this.iCollisionBound = pkg.read("compat32");
        this.iRenderBound = pkg.read("compat32");

        if (verArchive >= 70) {
            this.exclusiveSphereBound.load(pkg);
            this.inclusiveSphereBound.load(pkg);
        }

        this.iZone[0] = pkg.read("uint8");
        this.iZone[1] = pkg.read("uint8");

        this.numVertices = pkg.read("uint8");

        this.iLeaf[0] = pkg.read("int32");
        this.iLeaf[1] = pkg.read("int32");

        if (verArchive < 92) {
            debugger;
            throw new Error("not yet implemented");
        } else if (verArchive < 93) {
            debugger;
            throw new Error("not yet implemented");
        } else if (verArchive < 101) {
            debugger;
            throw new Error("not yet implemented");
        } else {
            this.iSection = pkg.read("int32");
            this.iFirstVertex = pkg.read("int32");
            this.iLightmapIndex = pkg.read("int32");
        }

        return this;
    }

    public getBSPDecodeInfo(surfFlags: number): Omit<GD.IBSPNodeDecodeInfo_T, "sectionIndex" | "collision" | "zoneMask"> {
        return {
            children: [this.iFront, this.iBack],
            plane: [this.plane.x, this.plane.y, this.plane.z, this.plane.w] as GD.Vector4Arr,
            leaves: [this.iLeaf[0], this.iLeaf[1]],
            zones: [this.iZone[0], this.iZone[1]],
            surfFlags,
            iPlane: this.iPlane,
            iRenderBound: this.iRenderBound !== -1 ? this.iRenderBound : undefined, // INDEX_NONE = -1
            spheres: {
                exclusive: [this.exclusiveSphereBound.x, this.exclusiveSphereBound.y, this.exclusiveSphereBound.z, this.exclusiveSphereBound.w],
                inclusive: [this.inclusiveSphereBound.x, this.inclusiveSphereBound.y, this.inclusiveSphereBound.z, this.inclusiveSphereBound.w]
            }
        };
    }
}

export default FBSPNode;
export { FBSPNode, BspNodeFlags_T };
