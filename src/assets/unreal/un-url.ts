import { type APackage, type Constructable_T, FStringArray } from "@l2js/core";

export class FURL implements Constructable_T {
    public protocol: string;
    public host: string;
    public map: string;
    public portal: string;
    public options = new FStringArray();
    public port: number;
    public isValid: boolean;

    public load(pkg: APackage): this {
        this.protocol = pkg.read("char");
        this.host = pkg.read("char");
        this.map = pkg.read("char");
        this.portal = pkg.read("char");
        this.options = new FStringArray().load(pkg);
        this.port = pkg.read("int32");
        this.isValid = pkg.read("int32") === 1;

        return this;
    }
}

export default FURL;
