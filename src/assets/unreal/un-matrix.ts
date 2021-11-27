import UObject from "./un-object";
import { UPlane } from "./un-plane";

class UMatrix extends UObject {
    public planeX: UPlane;
    public planeY: UPlane;
    public planeZ: UPlane;
    public planeW: UPlane;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "XPlane": "planeX",
            "YPlane": "planeY",
            "ZPlane": "planeZ",
            "WPlane": "planeW",
        });
    }

    public load(pkg: UPackage, tag: PropertyTag): this {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;

        this.readNamedProps(pkg);

        return this;
    }

    public getElements3x3() {
        return [
            this.planeX.x, this.planeY.x, this.planeZ.x,
            this.planeX.y, this.planeY.y, this.planeZ.y,
            this.planeX.z, this.planeY.z, this.planeZ.z
        ];
    }

    public getElements4x4() {
        return [
            this.planeX.x, this.planeY.x, this.planeZ.x, this.planeW.x,
            this.planeX.y, this.planeY.y, this.planeZ.y, this.planeW.y,
            this.planeX.z, this.planeY.z, this.planeZ.z, this.planeW.z,
            this.planeX.w, this.planeY.w, this.planeZ.w, this.planeW.w
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