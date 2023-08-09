import { BufferValue } from "@l2js/core";
import { FStringArray } from "@l2js/core/src/unreal/un-array";

class FURL implements C.IConstructable {
    public protocol: string;
    public host: string;
    public map: string;
    public portal: string;
    public options = new FStringArray();
    public port: number;
    public isValid: boolean;

    public load(pkg: C.APackage): this {
        const char = new BufferValue(BufferValue.char);
        const int32 = new BufferValue(BufferValue.int32);

        this.protocol = pkg.read(char).value;
        this.host = pkg.read(char).value;
        this.map = pkg.read(char).value;
        this.portal = pkg.read(char).value;
        this.options = new FStringArray().load(pkg);
        this.port = pkg.read(int32).value;
        this.isValid = pkg.read(int32).value === 1;

        return this;
    }
}

export default FURL;
export { FURL };