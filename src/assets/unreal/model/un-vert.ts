class FVert implements C.IConstructable {
    public pVertex: number;
    public side: number;

    public load(pkg: C.APackage): this {

        this.pVertex = pkg.read("compat32");
        this.side = pkg.read("compat32");

        return this;
    }
}

export default FVert;
export { FVert };