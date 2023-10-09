import FBox from "@client/assets/unreal/un-box";
import FPlane from "@client/assets/unreal/un-plane";
import FVector from "@client/assets/unreal/un-vector";
import UObject from "@l2js/core";

abstract class UPrimitive extends UObject {
    declare protected boundingBox: GA.FBox;
    declare protected boundingSphere: GA.FPlane;
    declare protected readonly materials: C.FArray<GA.UStaticMeshMaterial>;
    declare protected readonly swayObject: boolean;

    public static getUnserializedProperties(): C.UnserializedProperty_T[] {
        return [
            ["Materials", "ArrayProperty", ["Class", "StaticMeshMaterial"]],
            ["bSwayObject", "BoolProperty"]
        ];
    }

    protected preLoad(pkg: GA.UPackage, exp: C.UExport): void {
        super.preLoad(pkg, exp);

        this.boundingBox = FBox.make();
        this.boundingSphere = FPlane.make();
    }

    protected doLoad(pkg: GA.UPackage, exp: C.UExport) {
        // (UObject.prototype as any).doLoad.call(this, pkg, exp);
        super.doLoad(pkg, exp);

        this.boundingBox = FBox.make();
        this.boundingSphere = FPlane.make();

        this.boundingBox.load(pkg);
        this.boundingSphere.load(pkg);

        this.readHead = pkg.tell();
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Materials": "materials",
            "bSwayObject": "swayObject"
        });
    }

    public decodeBoundsInfo(): GD.IBoundsDecodeInfo {
        return {
            sphere: {
                center: [this.boundingSphere.x, this.boundingSphere.z, this.boundingSphere.y],
                radius: this.boundingSphere.w
            },
            box: this.boundingBox.isValid ? {
                min: [this.boundingBox.min.x, this.boundingBox.min.z, this.boundingBox.min.y],
                max: [this.boundingBox.max.x, this.boundingBox.max.z, this.boundingBox.max.y]
            } : null
        };
    }

    public getRenderBoundingBox(owner?: GA.AActor): FBox {
        if (owner) {
            const extents = FVector.make(owner.collisionRadius + 1, owner.collisionRadius + 1, owner.collisionHeight + 1);
            const box = FBox.make(extents.negate(), extents, 1);

            return box;
        }

        return this.boundingBox;
    }
}

export default UPrimitive;
export { UPrimitive };