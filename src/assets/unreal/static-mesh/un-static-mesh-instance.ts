import UObject from "../un-object";
import BufferValue from "../../buffer-value";
import FArray, { FPrimitiveArray } from "../un-array";
import FRawColorStream from "../un-raw-color-stream";
import FConstructable from "../un-constructable";


class FUnkStruct extends FConstructable {
    public unkIndex0: number;
    public unkArray0 = new FPrimitiveArray(BufferValue.uint8);
    public unkInt0: number;

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const int32 = new BufferValue(BufferValue.int32);

        this.unkIndex0 = pkg.read(compat32).value as number;
        this.unkArray0 = this.unkArray0.load(pkg).getTypedArray();
        this.unkInt0 = pkg.read(int32).value as number;

        return this;
    }
}

class UStaticMeshInstance extends UObject {
    protected colorStream = new FRawColorStream();

    protected unkArray0 = new FArray(FUnkStruct);
    protected unkArray1 = new FArray(FUnkStruct);

    protected unkArrIndex: number[];

    protected doLoad(pkg: UPackage, exp: UExport): this {
        // basemodel id 7364 -> export 7363
        // level id 5 -> export 4
        // umodel has 1888 lightmap sufraces with 9 textures
        // 1888 x 9
        // vertices 238
        // faces 390
        // material 18

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();
        const compat32 = new BufferValue(BufferValue.compat32);

        super.doLoad(pkg, exp);

        if (verArchive < 0x70) {
            console.warn("Unsupported yet");
            debugger;
        } else this.colorStream.load(pkg, null);

        if (0x6D < verArchive) this.unkArray0.load(pkg, null);
        if (0x03 < verLicense) this.unkArray1.load(pkg, null);
        if (0x0B < verLicense) this.unkArrIndex = new Array(2).fill(1).map(_ => pkg.read(compat32).value as number);

        this.readHead = pkg.tell();

        console.assert(this.readHead === this.readTail, "Should be zero");

        // debugger;

        return this;
    }
}

export default UStaticMeshInstance;
export { UStaticMeshInstance };