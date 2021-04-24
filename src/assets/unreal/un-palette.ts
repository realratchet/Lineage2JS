import UObject from "./un-object";
import { PropertyTag } from "./un-property";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UPlatte extends UObject {

    public async load(pkg: UPackage, exp: UExport) {
        let curOffset = exp.offset.value as number;
        const endOffset = curOffset + (exp.size.value as number);

        do {
            const tag = await PropertyTag.from(pkg, curOffset);

            if (!tag.isValid())
                break;

            await this.loadProperty(pkg, tag);

            curOffset = pkg.tell();

            debugger;

        } while (curOffset < endOffset);

        return this;
    }
}

export default UPlatte;
export { UPlatte };