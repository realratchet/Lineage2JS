import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import BufferValue from "../buffer-value";

type PropertyTag = import("./un-property").PropertyTag;

class FColor extends FConstructable {
    public static readonly typeSize: number = 4;

    public r: number = 0;
    public g: number = 0;
    public b: number = 0;
    public a: number = 0;

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        const b = new BufferValue(BufferValue.uint8);

        ["r", "g", "b", "a"].forEach((ch: "r" | "g" | "b" | "a") => {
            pkg.read(b);
            this[ch] = b.value as number;
        });

        return this;
    }
}

export default FColor;
export { FColor };