import UPrimitive from "../un-primitive";
import FArray from "../un-array";
import FVert from "./un-vert";
import FVector from "../un-vector";
import FBSPNode, { BspNodeFlags_T } from "../bsp/un-bsp-node";
import FBSPSurf from "../bsp/un-bsp-surf";
import UPolys, { PolyFlags_T } from "../un-polys";
import BufferValue from "../../buffer-value";
import FZoneProperties from "../un-zone-properties";
import { Float32BufferAttribute, BufferGeometry, TriangleFanDrawMode, BackSide, Mesh, MeshBasicMaterial } from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils";

type UPackage = import("../un-package").UPackage;
type UExport = import("../un-export").UExport;

const MAX_NODE_VERTICES = 16;       // Max vertices in a Bsp node, pre clipping.
const MAX_FINAL_VERTICES = 24;      // Max vertices in a Bsp node, post clipping.
const MAX_ZONES = 64;               // Max zones per level.

class UModel extends UPrimitive {
    protected vectors = new FArray(FVector);
    protected points = new FArray(FVector);
    protected vertices = new FArray(FVert);
    protected bspNodes = new FArray(FBSPNode);
    protected bspSurfs = new FArray(FBSPSurf);
    protected numSharedSides: number;
    protected polys: UPolys;
    protected zones: FZoneProperties[];

    public async load(pkg: UPackage, exp: UExport) {
        const int32 = new BufferValue(BufferValue.int32);

        await super.load(pkg, exp);
        await this.vectors.load(pkg);
        await this.points.load(pkg);
        await this.bspNodes.load(pkg);
        await this.bspSurfs.load(pkg);
        await this.vertices.load(pkg);

        this.numSharedSides = pkg.read(int32).value as number;

        const numZones = pkg.read(int32).value as number;

        console.assert(numZones <= MAX_ZONES);

        this.zones = new Array(numZones);

        for (let i = 0; i < numZones; i++)
            this.zones[i] = await new FZoneProperties().load(pkg);

        this.readHead = pkg.tell();
        const polysId = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        const polyExp = pkg.exports[polysId - 1];
        const className = pkg.getPackageName(polyExp.idClass.value as number)

        console.assert(className === "Polys");

        this.readHead = pkg.tell();

        // console.log(exp.objectName, "->", polyExp.objectName);

        this.polys = await pkg.fetchObject(polysId) as UPolys;

        pkg.seek(this.readHead, "set");

        return this;
    }

    public async decodeMesh() {
        const polyGroup = await this.polys.decodePolys();

        for (let i = 0, ncount = this.bspNodes.getElemCount(); i < ncount; i++) {
            const node = this.bspNodes.getElem(i);
            const surf = this.bspSurfs.getElem(node.iSurf);

            const polyFlags = surf.flags;
            const nodeFlags = node.flags;

            const isInvisible = polyFlags & PolyFlags_T.PF_Invisible;
            const isNotCsg = nodeFlags & BspNodeFlags_T.NF_NotCsg;

            if (isInvisible || isNotCsg) continue;

            const vertex = this.points.getElem(this.vertices.getElem(node.iVertPool + 0).vertex).vector;

            // if (
            //     vertex.z <= -16000 || vertex.z >= 16000 ||
            //     vertex.x <= -327680.00 || vertex.x >= 327680.00 ||
            //     vertex.y <= -262144.00 || vertex.y >= 262144.00
            // ) throw new Error(`Vertex out of bounds: '${vertex}'`);

            const uvs = [], normals = [], positions = [];

            for (let j = 0, vcount = node.numVertices; j < vcount; j++) {
                const nIndex = surf.vNormal;
                const vIndex = this.vertices.getElem(node.iVertPool + j).vertex;

                const texBase = this.points.getElem(surf.pBase);
                const texU = this.vectors.getElem(surf.vTextureU);
                const texV = this.vectors.getElem(surf.vTextureV);

                const point = this.points.getElem(vIndex);
                const [tu, tv] = [texU, texV].map(uv => point.sub(texBase).dot(uv) / 128. / 4.);

                const normal = this.vectors.getElem(nIndex).vector;
                const position = this.points.getElem(vIndex).vector;

                uvs.push(tu, tv);
                normals.push(normal.x, normal.z, normal.x);
                positions.push(position.x, position.z, position.y);
            }

            const attrUvs = new Float32BufferAttribute(uvs, 2);
            const attrNormals = new Float32BufferAttribute(normals, 3);
            const attrPositions = new Float32BufferAttribute(positions, 3);
            const geometry = new BufferGeometry();

            geometry.setAttribute("uv", attrUvs);
            geometry.setAttribute("normal", attrNormals);
            geometry.setAttribute("position", attrPositions);

            const fanGeo = BufferGeometryUtils.toTrianglesDrawMode(geometry, TriangleFanDrawMode);

            const texture = await surf.material.diffuse?.decodeMipmap(0) || null;
            const opacity = await surf.material.opacity?.decodeMipmap(0) || null;

            const mesh = new Mesh(fanGeo, new MeshBasicMaterial({
                side: BackSide,
                transparent: true,
                map: texture,
                alphaMap: opacity
            }));

            polyGroup.add(mesh);

            // debugger;
        }

        // debugger;

        return polyGroup;
    }
}

export default UModel;
export { UModel };
