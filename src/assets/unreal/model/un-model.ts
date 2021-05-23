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

class UModel extends UPrimitive {
    protected vectors = new FArray(FVector);
    protected points = new FArray(FVector);
    protected vertices = new FArray(FVert);
    protected bspNodes = new FArray(FBSPNode);
    protected bspSurfs = new FArray(FBSPSurf);
    protected numSharedSides: number;
    protected polys: UPolys = new UPolys();
    protected zones: FZoneProperties[];

    public async load(pkg: UPackage, exp: UExport) {
        const uint32 = new BufferValue(BufferValue.uint32);

        pkg.seek(exp.offset.value as number, "set");
        const endPos = (exp.offset.value as number) + (exp.size.value as number);

        console.log("offset:", endPos - pkg.tell());

        await super.load(pkg, exp);

        console.log("offset:", endPos - pkg.tell());

        await this.vectors.load(pkg);

        console.log("offset:", endPos - pkg.tell());

        await this.points.load(pkg);

        console.log("offset:", endPos - pkg.tell());

        await this.bspNodes.load(pkg);

        console.log("offset:", endPos - pkg.tell());

        await this.bspSurfs.load(pkg);

        console.log("offset:", endPos - pkg.tell());

        await this.vertices.load(pkg);

        console.log("offset:", endPos - pkg.tell());

        this.numSharedSides = pkg.read(uint32).value as number;
        console.log("offset:", endPos - pkg.tell());
        const numZones = pkg.read(uint32).value as number;

        this.zones = new Array(numZones);

        for (let i = 0; i < numZones; i++)
            this.zones[i] = await new FZoneProperties().load(pkg);

        await this.polys.load(pkg, exp);

        debugger;

        return this;
    }
}

export default UModel;
export { UModel };
