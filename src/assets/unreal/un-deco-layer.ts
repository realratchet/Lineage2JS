import { FConstructable } from "./un-constructable";
import UPackage from "./un-package";
import BufferValue from "../buffer-value";

class FDecoLayer extends FConstructable {
    public static readonly typeSize: number = 1;

    public async load(pkg: UPackage): Promise<this> {
        debugger;

        pkg.read(BufferValue.allocBytes(182));

        return this;
    }
}

export default FDecoLayer;
export { FDecoLayer };