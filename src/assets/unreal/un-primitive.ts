import UObject from "@l2js/core";

class UPrimitive extends UObject {
    declare protected boundingBox: GA.FBox;
    declare protected boundingSphere: GA.FPlane;


    protected preLoad(pkg: GA.UPackage, exp: C.UExport): void {
        this.boundingBox = pkg.makeCoreStruct("Box");
        this.boundingSphere = pkg.makeCoreStruct("Plane");
    }

    protected doLoad(pkg: GA.UPackage, exp: C.UExport) {
        super.doLoad(pkg, exp);

        this.boundingBox = pkg.makeCoreStruct("Box");
        this.boundingSphere = pkg.makeCoreStruct("Plane");

        this.boundingBox.load(pkg);
        this.boundingSphere.load(pkg);

        this.readHead = pkg.tell();
    }

    // public decodeBoundsInfo(): IBoundsDecodeInfo {
    //     return {
    //         sphere: {
    //             center: [this.boundingSphere.center.x, this.boundingSphere.center.z, this.boundingSphere.center.y],
    //             radius: this.boundingSphere.radius
    //         },
    //         box: this.boundingBox.isValid ? {
    //             min: [this.boundingBox.min.x, this.boundingBox.min.z, this.boundingBox.min.y],
    //             max: [this.boundingBox.max.x, this.boundingBox.max.z, this.boundingBox.max.y]
    //         } : null
    //     };
    // }
}

export default UPrimitive;
export { UPrimitive };