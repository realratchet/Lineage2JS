import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import BufferValue from "../buffer-value";
import UObject from "./un-object";
import { PropertyTag } from "./un-property";

class FPlane extends FConstructable {
    public static readonly typeSize: number = 16;

    public x: number;
    public y: number;
    public z: number;
    public w: number;

    public async load(pkg: UPackage): Promise<this> {
        const f = new BufferValue(BufferValue.float);

        ["x", "y", "z", "w"].forEach((ax: "x" | "y" | "z" | "w") => {
            this[ax] = pkg.read(f).value as number;
        });

        return this;
    }
}

class UPlane extends UObject {
    public x: number;
    public y: number;
    public z: number;
    public w: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "X": "x",
            "Y": "y",
            "Z": "z",
            "W": "w",
        });
    }

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {

        this.readHead = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;


        await this.readNamedProps(pkg);

        return this;
    }
}

export { FPlane, UPlane };