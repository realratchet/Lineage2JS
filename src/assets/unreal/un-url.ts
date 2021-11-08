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

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        this.isValid = true;

        const uint32 = new BufferValue(BufferValue.uint32);

        this.protocol = await pkg.read(new BufferValue(BufferValue.char)).value as string;
        this.host = await pkg.read(new BufferValue(BufferValue.char)).value as string;

        if (this.host.length > 0)
            this.port = await pkg.read(uint32).value as number;

        this.map = await pkg.read(new BufferValue(BufferValue.char)).value as string;

        await this.op.load(pkg, tag);

        this.portal = await pkg.read(new BufferValue(BufferValue.char)).value as string;

        return this;
    }
}

export default FURL;
export { FURL };