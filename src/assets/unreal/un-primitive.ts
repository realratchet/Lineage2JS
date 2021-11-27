import UObject from "./un-object";
import FArray from "./un-array";
import { UMaterialContainer } from "./un-material";
import FBox from "./un-box";
import USphere from "./un-sphere";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UPrimitive extends UObject {
    protected materials: FArray<UMaterialContainer> = new FArray(UMaterialContainer);
    protected swayObject: boolean;
    protected boundingBox: FBox = new FBox();
    protected boundingSphere: USphere = new USphere();

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Materials": "materials",
            "bSwayObject": "swayObject"
        });
    }

    public load(pkg: UPackage, exp: UExport): this {
        super.load(pkg, exp);

        this.boundingBox.load(pkg);
        this.boundingSphere.load(pkg);

        return this;
    }
}

export default UPrimitive;
export { UPrimitive };