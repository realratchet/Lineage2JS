import type { APackage, UExport } from "@l2js/core";
import FBox from "./un-box";
import FPlane from "./un-plane";
import UPrimitive from "./un-primitive";
import FVector from "./un-vector";

export abstract class UConvexVolume extends UPrimitive {
    declare public faces: { plane: FPlane, vertices: FVector[] }[];
    declare public edges: [number, number, number, number][];
    declare protected box: FBox;

    protected doLoad(pkg: APackage, exp: UExport): void {
        super.doLoad(pkg, exp);

        this.faces = [];
        for (let i = 0, count = pkg.read("compat32"); i < count; i++) {
            const plane = FPlane.make().load(pkg);
            const vertices: FVector[] = [];

            for (let j = 0, count = pkg.read("compat32"); j < count; j++)
                vertices.push(FVector.make().load(pkg));

            this.faces.push({ plane, vertices });
        }

        this.edges = [];
        for (let i = 0, count = pkg.read("compat32"); i < count; i++)
            this.edges.push([pkg.read("int32"), pkg.read("int32"), pkg.read("int32"), pkg.read("int32")]);

        this.box = FBox.make().load(pkg);
        this.readHead = pkg.tell();
    }

    public getRenderBoundingBox(): FBox { return this.box; }
}

export default UConvexVolume;
