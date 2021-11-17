import UObject from "./un-object";
import FArray from "./un-array";
import { UMaterialContainer } from "./un-material";
import FBox from "./un-box";
import USphere from "./un-sphere";
import { Sphere, Box3 } from "three";

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

    public async load(pkg: UPackage, exp: UExport) {
        await super.load(pkg, exp);

        await this.boundingBox.load(pkg);
        await this.boundingSphere.load(pkg);

        return this;
    }
}

export default UPrimitive;
export { UPrimitive };