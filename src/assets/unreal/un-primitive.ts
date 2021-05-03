import UObject from "./un-object";
import FArray from "./un-array";
import { UMaterialContainer } from "./un-material";
import UBox from "./un-box";
import USphere from "./un-sphere";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UPrimitive extends UObject {
    protected materials: FArray<UMaterialContainer> = new FArray(UMaterialContainer);
    protected swayObject: boolean;
    protected boundingBox: UBox = new UBox();
    protected boundingSphere: USphere = new USphere();

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Materials": "materials",
            "bSwayObject": "swayObject"
        });
    }

    public async load(pkg: UPackage, exp: UExport) {
        await super.load(pkg, exp);

        await this.boundingBox.load(pkg, null);
        await this.boundingSphere.load(pkg, null);

        return this;
    }
}

export default UPrimitive;
export { UPrimitive };