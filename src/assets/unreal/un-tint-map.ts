import UObject from "./un-object";
import BufferValue from "../buffer-value";
import { FPrimitiveArray } from "./un-array";

class FTIntMap extends UObject {
    public time: number;
    public intensity = new FPrimitiveArray(BufferValue.uint8);

    protected size: number;

    public constructor(size: number) {
        super();

        this.size = size;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Time": "time",
            "Intensity": "intensity"
        });
    }

    public preLoad(pkg: UPackage) {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + this.size;
    }

    public doLoad(pkg: UPackage): this {

        this.readNamedProps(pkg);

        pkg.seek(this.readTail, "set");

        return this;
    }

}

export default FTIntMap;
export { FTIntMap };