import { UObject } from "@l2js/core";
import FArray from "./un-array";
import { FStaticMeshMaterial } from "./un-material";
import FBox from "./un-box";
import USphere from "./un-sphere";
import UExport from "./un-export";
import UPackage from "./un-package";

class UPrimitive extends UObject {
    protected static getConstructorName() { return "Primitive"; }

    protected materials: FArray<FStaticMeshMaterial> = new FArray(FStaticMeshMaterial);
    protected swayObject: boolean;
    protected boundingBox: FBox = new FBox();
    protected boundingSphere: USphere = new USphere();

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Materials": "materials",
            "bSwayObject": "swayObject"
        });
    }

    protected doLoad(pkg: UPackage, exp: UExport) {
        super.doLoad(pkg, exp);

        this.boundingBox.load(pkg);
        this.boundingSphere.load(pkg);

        this.readHead = pkg.tell();
    }

    public decodeBoundsInfo(): IBoundsDecodeInfo {
        return {
            sphere: {
                center: [this.boundingSphere.center.x, this.boundingSphere.center.z, this.boundingSphere.center.y],
                radius: this.boundingSphere.radius
            },
            box: this.boundingBox.isValid ? {
                min: [this.boundingBox.min.x, this.boundingBox.min.z, this.boundingBox.min.y],
                max: [this.boundingBox.max.x, this.boundingBox.max.z, this.boundingBox.max.y]
            } : null
        };
    }
}

export default UPrimitive;
export { UPrimitive };