import FBox from "./un-box";
import FPlane from "./un-plane";
import FVector from "./un-vector";
import { type APackage, type UExport } from "@l2js/core";
import UObject from "./un-object";
import type { UAActor } from "./un-aactor";
import type { Vector3Arr } from "./library-types";
import type { ISphereDecodeInfo } from "./un-sphere";

type IBoundsDecodeInfo = {
    sphere?: ISphereDecodeInfo,
    box: { min: Vector3Arr, max: Vector3Arr } | null
};

abstract class UPrimitive extends UObject {
    declare protected boundingBox: FBox;
    declare protected boundingSphere: FPlane;

    protected preLoad(pkg: APackage, exp: UExport): void {
        super.preLoad(pkg, exp);

        this.boundingBox = FBox.make();
        this.boundingSphere = FPlane.make();
    }

    protected doLoad(pkg: APackage, exp: UExport) {
        // (UObject.prototype as any).doLoad.call(this, pkg, exp);
        super.doLoad(pkg, exp);

        this.boundingBox = FBox.make();
        this.boundingSphere = FPlane.make();

        this.boundingBox.load(pkg);
        this.boundingSphere.load(pkg);

        this.readHead = pkg.tell();
    }

    public decodeBoundsInfo(): IBoundsDecodeInfo {
        return {
            sphere: {
                center: [this.boundingSphere.x, this.boundingSphere.y, this.boundingSphere.z],
                radius: this.boundingSphere.w
            },
            box: this.boundingBox.isValid ? {
                min: [this.boundingBox.min.x, this.boundingBox.min.y, this.boundingBox.min.z],
                max: [this.boundingBox.max.x, this.boundingBox.max.y, this.boundingBox.max.z]
            } : null
        };
    }

    public getRenderBoundingBox(owner?: UAActor): FBox {
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
export type { IBoundsDecodeInfo };
