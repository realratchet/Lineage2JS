import UObject from "./un-object";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UTexture extends UObject {
    protected maxColor: number;
    protected width: number;
    protected height: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap()), {
            "MaxColor": "maxColor",
            "VSize": "height",
            "USize": "width",
        }
    };

    public async load(pkg: UPackage, exp: UExport): Promise<this> {

        let curOffset = exp.offset.value as number;
        const endOffset = curOffset + (exp.size.value as number);

        do {
            const prop = await this.loadProperty(pkg, curOffset);

            console.log(`Byte step: ${pkg.tell() - curOffset}`);

            curOffset = pkg.tell();

            if (!prop)
                break;

        } while (curOffset < endOffset);

        if (curOffset < endOffset)
            throw new Error(`Unread bytes: ${endOffset - curOffset}`);

        return this;
    }
}

export default UTexture;
export { UTexture };