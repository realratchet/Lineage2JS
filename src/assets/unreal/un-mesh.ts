import UPrimitive from "./un-primitive";

class UMesh extends UPrimitive {
    public doLoad(pkg: UPackage, exp: UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        super.doLoad(pkg, exp);

        // do i need to read compat here?

        // debugger;
    }
}

export default UMesh;
export { UMesh };