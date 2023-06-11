import { BufferValue, } from "@l2js/core";

class FVert implements C.IConstructable {
    public pVertex: number;
    public side: number;

    public load(pkg: GA.UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);

        this.pVertex = pkg.read(compat32).value as number;
        this.side = pkg.read(compat32).value as number;

        return this;
    }
}

export default FVert;
export { FVert };