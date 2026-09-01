import UObject from "./un-object";

export enum PolyFlags_T {
    // Regular in-game flags.
    PF_Invisible = 0x00000001,	// Poly is invisible.
    PF_Masked = 0x00000002,	// Poly should be drawn masked.
    PF_Translucent = 0x00000004,	// Poly is transparent.
    PF_NotSolid = 0x00000008,	// Poly is not solid, doesn't block.
    PF_Environment = 0x00000010,	// Poly should be drawn environment mapped.
    PF_Semisolid = 0x00000020,	// Poly is semi-solid = collision solid, Csg nonsolid.
    PF_Modulated = 0x00000040,	// Modulation transparency.
    PF_FakeBackdrop = 0x00000080,	// Poly looks exactly like backdrop. (skybox)
    PF_TwoSided = 0x00000100,	// Poly is visible from both sides.
    PF_NoSmooth = 0x00000800,	// Don't smooth textures.
    PF_AlphaTexture = 0x00001000,	// Honor texture alpha (reuse BigWavy and SpecialPoly flags)
    PF_Flat = 0x00004000,	// Flat surface.
    PF_NoMerge = 0x00010000,	// Don't merge poly's nodes before lighting when rendering.
    PF_NoZTest = 0x00020000,	// Don't test Z buffer
    PF_Additive = 0x00040000,	// sjs - additive blending, (Aliases PF_DirtyShadows).
    PF_SpecialLit = 0x00100000,	// Only speciallit lights apply to this poly.
    PF_Wireframe = 0x00200000,	// Render as wireframe
    PF_Unlit = 0x00400000,	// Unlit.
    PF_Portal = 0x04000000,	// Portal between iZones.
    PF_AntiPortal = 0x08000000,	// Antiportal
    PF_Mirrored = 0x20000000,   // Mirrored BSP surface.

    // Editor flags.
    PF_Memorized = 0x01000000,	// Editor: Poly is remembered.
    PF_Selected = 0x02000000,	// Editor: Poly is selected.
    PF_Subtractive = 0x20000000,	// sjs - subtractive blending
    PF_FlatShaded = 0x40000000,	// FPoly has been split by SplitPolyWithPlane.   

    // Unused flags.
    PF_Unused0 = 0x00000200,
    PF_Unused1 = 0x00000400,
    PF_Unused2 = 0x00002000,
    PF_Unused3 = 0x00008000,
    PF_Unused4 = 0x00040000,
    PF_Unused5 = 0x00080000,

    // Internal.
    PF_EdProcessed = 0x40000000,	// FPoly was already processed in editorBuildFPolys.
    PF_EdCut = 0x80000000,	// FPoly has been split by SplitPolyWithPlane.  
    PF_Occlude = 0x80000000,	// Occludes even if PF_NoOcclude.

    // Combinations of flags.
    PF_NoOcclude = PF_Masked | PF_Translucent | PF_Invisible | PF_Modulated | PF_AlphaTexture,
    PF_NoEdit = PF_Memorized | PF_Selected | PF_EdProcessed | PF_NoMerge | PF_EdCut,
    PF_NoImport = PF_NoEdit | PF_NoMerge | PF_Memorized | PF_Selected | PF_EdProcessed | PF_EdCut,
    PF_AddLast = PF_Semisolid | PF_NotSolid,
    PF_NoAddToBSP = PF_EdCut | PF_EdProcessed | PF_Selected | PF_Memorized,
    PF_NoShadows = PF_Unlit | PF_Invisible | PF_Environment | PF_FakeBackdrop
};


abstract class FPoly extends UObject {
    // public base: FVector = new FVector();
    // public normal: FVector = new FVector();
    // public textureU: FVector = new FVector();
    // public textureV: FVector = new FVector();
    // public vertices: FVector[];
    // public flags: number;
    // public actor: UObject = null;
    // public texture: UMaterial = null;
    // public link: number;
    // public brushPoly: number;
    // public name: string;
    // public panU: number;
    // public panV: number;

    // public load(pkg: UPackage): this {
    //     const vcount = pkg.read("compat32");

    //     debugger;

    //     console.assert(vcount >= 0);

    //     this.base.load(pkg);
    //     this.normal.load(pkg);
    //     this.textureU.load(pkg);
    //     this.textureV.load(pkg);

    //     this.vertices = new Array(vcount);

    //     for (let i = 0; i < vcount; i++)
    //         this.vertices[i] = new FVector().load(pkg);

    //     this.flags = pkg.read("uint32");

    //     const actorId = pkg.read("compat32");
    //     const textureId = pkg.read("compat32");
    //     const nameId = pkg.read("compat32");

    //     this.name = pkg.nameTable[nameId].name as string;
    //     this.link = pkg.read("compat32");
    //     this.brushPoly = pkg.read("compat32");

    //     this.panU = pkg.read("int16");
    //     this.panV = pkg.read("int16");

    //     pkg.seek(4);

    //     // debugger;

    //     if (actorId !== 0) debugger;

    //     const offset = pkg.tell();
    //     if (actorId !== 0) this.promisesLoading.push(new Promise<void>(async resolve => {
    //         this.actor = await pkg.fetchObject<UObject>(actorId);
    //         resolve();
    //     }));
    //     if (textureId !== 0) this.promisesLoading.push(new Promise<void>(async resolve => {
    //         this.texture = await pkg.fetchObject<UMaterial>(textureId);
    //         resolve();
    //     }));
    //     pkg.seek(offset, "set");

    //     // debugger;

    //     return this;
    // }

    // // public async decodeMesh(): Promise<Mesh> {

    // //     const flags = this.flags;

    // //     const isInvisible = flags & PolyFlags_T.PF_Invisible;
    // //     const isNotSolid = flags & PolyFlags_T.PF_NotSolid;
    // //     const isUnk0 = flags & 0x00000080;
    // //     const isUnk1 = flags & PolyFlags_T.PF_Unk1;
    // //     const isUnk2 = flags & PolyFlags_T.PF_Unk2;
    // //     const isSheet = this.name === "Sheet";
    // //     const vcount = this.vertices.length;

    // //     if (isInvisible || isNotSolid || isUnk0 || isUnk1 || isUnk2 || isSheet || vcount === 0) return null;

    // //     const uvs = [], normals = [], positions = [];

    // //     for (let vertex of this.vertices) {
    // //         const [tu, tv] = [this.textureU, this.textureV].map(vtex => vertex.sub(this.base).dot(vtex) / 128);

    // //         uvs.push(tu, tv);
    // //         normals.push(this.normal.vector.x, this.normal.vector.z, this.normal.vector.y);
    // //         positions.push(vertex.vector.x, vertex.vector.z, vertex.vector.y);
    // //     }

    // //     const attrUvs = new Float32BufferAttribute(uvs, 2);
    // //     const attrNormals = new Float32BufferAttribute(normals, 3);
    // //     const attrPositions = new Float32BufferAttribute(positions, 3);
    // //     const geometry = new BufferGeometry();

    // //     geometry.setAttribute("uv", attrUvs);
    // //     geometry.setAttribute("normal", attrNormals);
    // //     geometry.setAttribute("position", attrPositions);

    // //     const fanGeo = BufferGeometryUtils.toTrianglesDrawMode(geometry, TriangleFanDrawMode);
    // //     const materials = await this.texture?.decodeMaterial();

    // //     const mesh = new Mesh(fanGeo, materials);

    // //     mesh.name = this.name || "";

    // //     return mesh;
    // // }
}

export abstract class UPolys extends UObject {
    // protected polyList: FPoly[];

    // protected doLoad(pkg: UPackage, exp: UExport): this {
    //     pkg.seek(this.readHead, "set");


    //     super.doLoad(pkg, exp);

    //     // console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size - (pkg.tell() - startOffset)}`);


    //     // super.load(pkg, exp);

    //     const dbNum = pkg.read("int32");
    //     const dbMax = pkg.read("int32");

    //     // console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size - (pkg.tell() - startOffset)}`);

    //     this.polyList = new Array(dbMax);

    //     // debugger;

    //     for (let i = 0; i < dbMax; i++) {
    //         // this.polyList[i] = await new FPoly().load(pkg);
    //         // console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size - (pkg.tell() - startOffset)}`);
    //     }

    //     // console.log(`offset: ${pkg.tell() - startOffset}, left: ${exp.size - (pkg.tell() - startOffset)}`);

    //     // console.assert((exp.size - (pkg.tell() - startOffset)) === 0);

    //     // debugger;

    //     return this;
    // }

    // // public async decodePolys(): Promise<Group> {
    // //     const group = new Group();

    // //     for (let poly of this.polyList) {
    // //         const mesh = await poly.decodeMesh();

    // //         if (mesh) group.add(mesh);

    // //         if (poly.actor)
    // //             debugger;
    // //     }

    // //     return group;
    // // }
}

export default UPolys;
