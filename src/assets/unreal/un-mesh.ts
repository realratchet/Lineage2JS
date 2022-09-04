import UPrimitive from "./un-primitive";

class UMesh extends UPrimitive {
    public doLoad(pkg: UPackage, exp: UExport) {
        super.doLoad(pkg, exp);
    }
}

export default UMesh;
export { UMesh };