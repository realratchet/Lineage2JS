import FBox from "@client/assets/unreal/un-box";
import FPlane from "@client/assets/unreal/un-plane";
import UObject from "@l2js/core";

abstract class UPrimitive extends UObject {
    declare protected boundingBox: GA.FBox;
    declare protected boundingSphere: GA.FPlane;

    protected preLoad(pkg: GA.UPackage, exp: C.UExport): void {
        super.preLoad(pkg, exp);

        this.boundingBox = FBox.make();
        this.boundingSphere = FPlane.make();
    }

    protected doLoad(pkg: GA.UPackage, exp: C.UExport) {
        super.doLoad(pkg, exp);

        this.boundingBox = FBox.make();
        this.boundingSphere = FPlane.make();

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