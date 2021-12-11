import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import BufferValue from "../buffer-value";
import FArray from "./un-array";
import FNumber from "./un-number";

class FURL extends FConstructable {
    public protocol: string;
    public host: string;
    public port: number = 0;
    public map: string;
    public portal: string;
    public op: FArray = new FArray(FNumber.forType(BufferValue.uint32) as any);
    public isValid: boolean = false;

    public load(pkg: UPackage, tag?: PropertyTag): this {
        this.isValid = true;

        const uint32 = new BufferValue(BufferValue.uint32);

        this.protocol = pkg.read(new BufferValue(BufferValue.char)).value as string;
        this.host = pkg.read(new BufferValue(BufferValue.char)).value as string;

        if (this.host.length > 0)
            this.port = pkg.read(uint32).value as number;

        this.map = pkg.read(new BufferValue(BufferValue.char)).value as string;

        this.op.load(pkg, tag);

        this.portal = pkg.read(new BufferValue(BufferValue.char)).value as string;

        return this;
    }
}

export default FURL;
export { FURL };