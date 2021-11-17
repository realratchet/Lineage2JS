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

        for (let ax of ["r", "g", "b", "a"])
            this[ax as ("r" | "g" | "b" | "a")] = await pkg.read(b).value as number;

        return this;
    }
}

export default FColor;
export { FColor };