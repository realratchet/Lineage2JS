import FConstructable from "../un-constructable";
import FArray from "../un-array";
import BufferValue from "@client/assets/buffer-value";

class FBspSection extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        this.bspVertices = new FArray(FBSPVertex).load(pkg, null);
        this.unk1 = pkg.read(int32).value as number;
        const textureId = pkg.read(compat).value as number;
        this.unk2 = pkg.read(int32).value as number;
        this.unk3 = pkg.read(int32).value as number;
        this.unk4 = pkg.read(int32).value as number;

        this.promisesLoading.push(new Promise(async resolve => {
            this.texture = await pkg.fetchObject<UObject>(textureId);
            resolve();
        }));

        return this;
    }
}

class FBSPVertex extends FConstructable {
    public static readonly typeSize = 24;

    public load(pkg: UPackage, tag: PropertyTag): this {

        const ver = pkg.header.getArchiveFileVersion();

        const arr1 = pkg.read(BufferValue.allocBytes(4 * 7));
        const farr1 = new Float32Array(arr1.bytes.buffer);

        this.unk1 = farr1;

        if (0x6c < ver) {
            const arr2 = pkg.read(BufferValue.allocBytes(4 * 3));
            const farr2 = new Float32Array(arr2.bytes.buffer);

            this.unk2 = farr2;
        }


        return this;
    }
}

export default FBspSection;
export { FBspSection };
