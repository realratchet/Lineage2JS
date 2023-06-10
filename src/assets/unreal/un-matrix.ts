import { APackage, UExport } from "@l2js/core";
import UObject from "@l2js/core";
import { UPlane } from "./un-plane";
import PropertyTag from "@l2js/core/src/unreal/un-property/un-property-tag";

class UMatrix extends UObject {
    public planeX: UPlane;
    public planeY: UPlane;
    public planeZ: UPlane;
    public planeW: UPlane;

    public load(pkg: APackage): this;
    public load(pkg: APackage, info: UExport<UObject>): this;
    public load(pkg: APackage, info: PropertyTag): this;
    public load(pkg: APackage, info?: any): this {
        throw new Error("not implemented");
    }

    public getElements3x3() {
        return [
            this.planeX.x, this.planeX.y, this.planeX.z,
            this.planeY.x, this.planeY.y, this.planeY.z,
            this.planeZ.x, this.planeZ.y, this.planeZ.z
        ];
    }

    public getElements4x4() {
        return [
            this.planeX.x, this.planeX.y, this.planeX.z, this.planeX.w,
            this.planeY.x, this.planeY.y, this.planeY.z, this.planeY.w,
            this.planeZ.x, this.planeZ.y, this.planeZ.z, this.planeZ.w,
            this.planeW.x, this.planeW.y, this.planeW.z, this.planeW.w
        ];
    }

    public getMatrix3(output: THREE.Matrix3): THREE.Matrix3 {
        return output.set(
            this.planeX.x, this.planeY.x, this.planeZ.x,
            this.planeX.y, this.planeY.y, this.planeZ.y,
            this.planeX.z, this.planeY.z, this.planeZ.z
        );
    }

    public getMatrix4(output: THREE.Matrix4): THREE.Matrix4 {
        return output.set(
            this.planeX.x, this.planeY.x, this.planeZ.x, this.planeW.x,
            this.planeX.y, this.planeY.y, this.planeZ.y, this.planeW.y,
            this.planeX.z, this.planeY.z, this.planeZ.z, this.planeW.z,
            this.planeX.w, this.planeY.w, this.planeZ.w, this.planeW.w
        );
    }
}

export default UMatrix;
export { UMatrix };