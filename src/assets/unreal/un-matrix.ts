import { PropertyTag } from "./un-property";
import UPackage from "./un-package";
import UObject from "./un-object";
import { UPlane } from "./un-plane";

class UMatrix extends UObject {
    protected planeX: UPlane;
    protected planeY: UPlane;
    protected planeZ: UPlane;
    protected planeW: UPlane;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "XPlane": "planeX",
            "YPlane": "planeY",
            "ZPlane": "planeZ",
            "WPlane": "planeW",
        });
    }

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;

        await this.readNamedProps(pkg);

        return this;
    }
}

export default UMatrix;
export { UMatrix };