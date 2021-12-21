import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import { FPrimitiveArray } from "./un-array";
import BufferValue from "../buffer-value";
import UObject from "./un-object";

class FTIntMap extends UObject {
    public time: number;
    public intensity = new FPrimitiveArray(BufferValue.uint8)

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

    public preLoad(pkg: UPackage, exp: UExport) {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + this.size;
    }

    public doLoad(pkg: UPackage, exp: UExport): this {

        this.readNamedProps(pkg);

        pkg.seek(this.readTail, "set");

        const buff = this.intensity.array.buffer.slice(this.intensity.array.byteOffset, this.intensity.array.byteOffset + this.intensity.array.byteLength); // (@8306076 128x128)
        const blob = new Blob([buff], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);

        window.open(url, "_blank");

        return this;
    }

}

export default FTIntMap;
export { FTIntMap };