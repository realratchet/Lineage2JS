import UObject from "./un-object";
import UTexture from "./un-texture";
import FArray from "./un-array";
import { UMaterialContainer } from "./un-material";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UStaticMesh extends UObject {
    protected materials: FArray<UMaterialContainer> = new FArray(UMaterialContainer);
    protected swayObject: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Materials": "materials",
            "bSwayObject": "swayObject"
        });
    }
}

export default UStaticMesh;
export { UStaticMesh };