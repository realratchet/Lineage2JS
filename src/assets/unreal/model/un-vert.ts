import type { APackage, Constructable_T } from "@l2js/core";

export class FVert implements Constructable_T {
    public pVertex: number;
    public side: number;

    public load(pkg: APackage): this {

        this.pVertex = pkg.read("compat32");
        this.side = pkg.read("compat32");

        return this;
    }
}

export default FVert;
