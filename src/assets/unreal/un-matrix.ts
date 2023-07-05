import UPackage from "@client/assets/unreal/un-package";
import UObject, { APackage, UExport } from "@l2js/core";
import PropertyTag from "@l2js/core/src/unreal/un-property/un-property-tag";

abstract class FMatrix extends UObject {
    declare public readonly planeX: GA.FPlane;
    declare public readonly planeY: GA.FPlane;
    declare public readonly planeZ: GA.FPlane;
    declare public readonly planeW: GA.FPlane;

    // public nativeClone(): FMatrix {
    //     debugger;

    //     const clone = super.nativeClone() as FMatrix;

    //     debugger;

    //     return clone;
    // }

    
    // public load(pkg: UPackage, info?: any): this {
    //     debugger;

    //     super.load(pkg, info);

    //     debugger;

    //     return this;
    // }

    // protected loadProperty(pkg: APackage, tag: PropertyTag): void {
    //     debugger;

    //     super.loadProperty(pkg, tag)

    //     debugger;
    // }

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

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "XPlane": "planeX",
            "YPlane": "planeY",
            "ZPlane": "planeZ",
            "WPlane": "planeW",
        });
    }
}

export default FMatrix;
export { FMatrix };