import UObject from "./un-object";
import BufferValue from "../buffer-value";
import FConstructable from "./un-constructable";
import FVector from "./un-vector";
import UTexture from "./un-texture";
import { Group, Mesh, BufferGeometry, MeshBasicMaterial, Float32BufferAttribute, DoubleSide, TriangleFanDrawMode, BackSide } from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils";
import UMaterial from "./un-material";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

enum PolyFlags_T {
    // Regular in-game flags.
    PF_Invisible = 0x00000001,      // Poly is invisible.
    PF_NotSolid = 0x00000008,       // Poly is not solid, doesn't block.
    PF_Semisolid = 0x00000020,      // Poly is semi-solid = collision solid, Csg nonsolid.
    PF_GeomMarked = 0x00000040,     // Geometry mode sometimes needs to mark polys for processing later.
    PF_TwoSided = 0x00000100,       // Poly is visible from both sides.
    PF_Unk1 = 0x00002000,           // pf on bounding bsp, invisible
    PF_Unk2 = 0x00008000,           // pf on bounding bsp
    PF_Unk3 = 0x00400000,           // pf on bounding bsp
    PF_Portal = 0x04000000,         // Portal between iZones.
    PF_Unk4 = 0x08000000,           // pf on Ant Nest's invisible bsp
    PF_Mirrored = 0x20000000,       // Mirrored BSP surface.

    // Editor flags.
    PF_Memorized = 0x01000000,      // Editor: Poly is remembered.
    PF_Selected = 0x02000000,       // Editor: Poly is selected.

    // Internal.
    PF_EdProcessed = 0x40000000,    // FPoly was already processed in editorBuildFPolys.
    PF_EdCut = 0x80000000,          // FPoly has been split by SplitPolyWithPlane.

    // Combinations of flags.
    PF_NoEdit = PF_Memorized | PF_Selected | PF_EdProcessed | PF_EdCut,
    PF_NoImport = PF_NoEdit | PF_Memorized | PF_Selected | PF_EdProcessed | PF_EdCut,
    PF_AddLast = PF_Semisolid | PF_NotSolid,
    PF_NoAddToBSP = PF_EdCut | PF_EdProcessed | PF_Selected | PF_Memorized
};


class FPoly extends FConstructable {
    public static readonly typeSize = 1;
    public base: FVector = new FVector();
    public normal: FVector = new FVector();
    public textureU: FVector = new FVector();
    public textureV: FVector = new FVector();
    public vertices: FVector[];
    public flags: number;
    public actor: UObject;
    public texture: UMaterial;
    public link: number;
    public brushPoly: number;
    public name: string;
    public panU: number;
    public panV: number;

    public async load(pkg: UPackage): Promise<this> {
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);
        const int16 = new BufferValue(BufferValue.int16);

        const vcount = await pkg.read(compat).value as number;

        console.assert(vcount >= 0);

        await this.base.load(pkg);
        await this.normal.load(pkg);
        await this.textureU.load(pkg);
        await this.textureV.load(pkg);

        this.vertices = new Array(vcount);

        for (let i = 0; i < vcount; i++)
            this.vertices[i] = await new FVector().load(pkg);

        this.flags = await pkg.read(uint32).value as number;

        const actorId = await pkg.read(compat).value as number;
        const textureId = await pkg.read(compat).value as number;
        const nameId = await pkg.read(compat).value as number;

        this.name = pkg.nameTable[nameId].name.value as string;
        this.link = await pkg.read(compat).value as number;
        this.brushPoly = await pkg.read(compat).value as number;

        this.panU = await pkg.read(int16).value as number;
        this.panV = await pkg.read(int16).value as number;

        pkg.seek(4);

        // debugger;

        if (actorId !== 0) debugger;

        const offset = pkg.tell();
        this.actor = await pkg.fetchObject(actorId);
        this.texture = await pkg.fetchObject(textureId) as UTexture;
        pkg.seek(offset, "set");

        // debugger;

        return this;
    }

    public async decodeMesh(): Promise<Mesh> {

        const flags = this.flags;

        const isInvisible = flags & PolyFlags_T.PF_Invisible;
        const isNotSolid = flags & PolyFlags_T.PF_NotSolid;
        const isUnk0 = flags & 0x00000080;
        const isUnk1 = flags & PolyFlags_T.PF_Unk1;
        const isUnk2 = flags & PolyFlags_T.PF_Unk2;
        const isSheet = this.name === "Sheet";
        const vcount = this.vertices.length;

        if (isInvisible || isNotSolid || isUnk0 || isUnk1 || isUnk2 || isSheet || vcount === 0) return null;

        const uvs = [], normals = [], positions = [];

        for (let vertex of this.vertices) {
            const [tu, tv] = [this.textureU, this.textureV].map(vtex => vertex.sub(this.base).dot(vtex) / 128);

            uvs.push(tu, tv);
            normals.push(this.normal.vector.x, this.normal.vector.z, this.normal.vector.y);
            positions.push(vertex.vector.x, vertex.vector.z, vertex.vector.y);
        }

        const attrUvs = new Float32BufferAttribute(uvs, 2);
        const attrNormals = new Float32BufferAttribute(normals, 3);
        const attrPositions = new Float32BufferAttribute(positions, 3);
        const geometry = new BufferGeometry();

        geometry.setAttribute("uv", attrUvs);
        geometry.setAttribute("normal", attrNormals);
        geometry.setAttribute("position", attrPositions);

        const fanGeo = BufferGeometryUtils.toTrianglesDrawMode(geometry, TriangleFanDrawMode);
        const materials = await this.texture?.decodeMaterial();

        const mesh = new Mesh(fanGeo, materials);

        mesh.name = this.name || "";

        return mesh;
    }

}

class UPolys extends UObject {
    protected polyList: FPoly[];

    public async load(pkg: UPackage, exp: UExport) {
        // this.readHead = pkg.tell();
        // this.readTail = (exp.offset.value as number) + (exp.size.value as number);

        this.setReadPointers(exp);
        pkg.seek(this.readHead, "set");

        // const startOffset = pkg.tell();

        // debugger;

        await this.readNamedProps(pkg);

        // console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);


        // super.load(pkg, exp);

        const int32 = new BufferValue(BufferValue.int32);

        const dbNum = pkg.read(int32).value as number;
        const dbMax = pkg.read(int32).value as number;

        // console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);

        this.polyList = new Array(dbMax);

        // debugger;

        for (let i = 0; i < dbMax; i++) {
            this.polyList[i] = await new FPoly().load(pkg);
            // console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);
        }

        // console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size.value as number - (pkg.tell() - startOffset)}`);

        // console.assert((exp.size.value as number - (pkg.tell() - startOffset)) === 0);

        // debugger;

        return this;
    }

    public async decodePolys(): Promise<Group> {
        const group = new Group();

        for (let poly of this.polyList) {
            const mesh = await poly.decodeMesh();

            if (mesh) group.add(mesh);

            if (poly.actor)
                debugger;
        }

        return group;
    }
}

export default UPolys;
export { UPolys, PolyFlags_T };