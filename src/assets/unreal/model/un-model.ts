import UPrimitive from "../un-primitive";
import FArray from "../un-array";
import FVert from "./un-vert";
import FVector from "../un-vector";
import FBSPNode from "../bsp/un-bsp-node";
import FBSPSurf from "../bsp/un-bsp-surf";
import UPolys from "../un-polys";
import BufferValue from "../../buffer-value";
import FZoneProperties from "../un-zone-properties";

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
        const polys = await this.polys.decodePolys();


        // debugger;

        return polys;
    }
}

export default UModel;
export { UModel };
