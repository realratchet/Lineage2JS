import { BufferValue } from "@l2js/core";
import { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";

class FURL implements C.IConstructable {
    public protocol: string;
    public host: string;
    public port: number = 0;
    public map: string;
    public portal: string;
    public op = new FPrimitiveArray(BufferValue.uint32);
    public isValid: boolean = false;

    public load(pkg: C.APackage): this {
        this.isValid = true;

        const uint32 = new BufferValue(BufferValue.uint32);

        this.protocol = pkg.read(new BufferValue(BufferValue.char)).value as string;

        this.host = pkg.read(new BufferValue(BufferValue.char)).value as string;

        if (this.host.length > 0)
            this.port = pkg.read(uint32).value as number;

        this.map = pkg.read(new BufferValue(BufferValue.char)).value as string;

        this.op.load(pkg);


        this.portal = pkg.read(new BufferValue(BufferValue.char)).value as string;
        // debugger;

        return this;
    }
}

export default FURL;
export { FURL };