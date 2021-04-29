import UPackage from "./un-package";
import UObject from "./un-object";
import UBox from "./un-box";
import BufferValue from "../buffer-value";
import { PropertyTag } from "./un-property";

type UExport = import("./un-export").UExport;

class UTerrainSector extends UObject {
    protected boundingBox: UBox = new UBox();
    protected offsetX: number;
    protected offsetY: number;

    public async load(pkg: UPackage, exp: UExport) {
        // pkg.dump(32);

        debugger;

        // await super.load(pkg, exp);
        this.setReadPointers(exp);

        do {
            const tag = await PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid())
                break;

            await this.loadProperty(pkg, tag);

            this.readHead = pkg.tell();

        } while (this.readHead < this.readTail);

        const int32 = new BufferValue(BufferValue.int32);

        this.offsetX = pkg.read(int32).value as number;
        this.offsetY = pkg.read(int32).value as number;

        debugger;

        return this;
    }
}

export default UTerrainSector;
export { UTerrainSector };