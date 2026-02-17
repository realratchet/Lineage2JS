class FStaticMeshSection implements C.IConstructable {
    declare public isStrip: boolean;  // Whether this section is stripped.
    declare public firstIndex: number;      // The first index in the index buffer used by this section.
    declare public firstVertex: number;     // The smallest vertex index used by this section.
    declare public lastVertex: number;      // The largest vertex used by this section.
    declare public numTriangles: number;    // The number of raw triangles in this section.
    declare public numFaces: number;        // The number of primitives to render, including degenerate triangles used in stripping.

    public load(pkg: C.APackage): this {

        const verArchive = pkg.header.getArchiveFileVersion();

        if (verArchive < 92) {
            debugger;
            throw new Error("not implemented")
        } else if (verArchive < 112) {
            debugger;
            throw new Error("not implemented")
        }

        this.isStrip = pkg.read("uint32") !== 0;

        if (this.isStrip !== false)
            debugger;

        this.firstIndex = pkg.read("uint16");
        this.firstVertex = pkg.read("uint16");
        this.lastVertex = pkg.read("uint16");
        this.numTriangles = pkg.read("uint16");
        this.numFaces = pkg.read("uint16");

        return this;
    }
}

export default FStaticMeshSection;
export { FStaticMeshSection };