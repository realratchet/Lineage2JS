import FConstructable from "../un-constructable";
import FArray, { FPrimitiveArray, FPrimitiveArrayLazy } from "../un-array";
import BufferValue from "@client/assets/buffer-value";

class FMultiLightMapTexture extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        // debugger;

        this.lightmap = new FArray(FLightmapTexture).load(pkg, tag);

        // debugger;

        this.unk1 = new FPrimitiveArray(BufferValue.uint32).load(pkg, tag);

        if (pkg.header.getLicenseeVersion() < 0x18) {
            // debugger;   // i don't think this branch does anything in this version
        }

        // debugger;

        return this;
    }
}

export default FMultiLightMapTexture;
export { FMultiLightMapTexture };

class FLightmapTexture extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        // debugger;
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        debugger;

        // const unIndex = pkg.read(compat).value as number;

        // debugger;

        this.unkBytes = new FPrimitiveArray(BufferValue.uint32).load(pkg, tag);

        debugger;

        this.unk1 = pkg.read(BufferValue.allocBytes(8)).value as number;
        this.unk2 = pkg.read(int32).value as number;

        // FArchive::ByteOrderSerialize(pFVar1,param_2 + 4,8);
        // FArchive::ByteOrderSerialize(pFVar1,param_2 + 0x68,4);

        // debugger;

        if (0x73 < pkg.header.getArchiveFileVersion()) {
            for (let i = 0; i < 500; i++) {
                // debugger;
                try {
                    const data = new FPrimitiveArrayLazy(BufferValue.uint32).load(pkg, tag)

                    if (data.getElemCount() === 0) continue;

                    const buff = data.array.buffer.slice(data.array.byteOffset, data.array.byteOffset + data.array.byteLength);
                    const blob = new Blob([buff], { type: "application/octet-stream" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");

                    debugger;
                } catch (e) {

                }
            }

            debugger;
            // this.primitiveTexture = new FStaticLightMapTexture().load(pkg, tag);
        }

        // debugger;

        return this;
    }
}

class FStaticLightMapTexture extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {

        const compat = new BufferValue(BufferValue.compat32);
        const unIndex = pkg.read(compat).value as number;
        const int32 = new BufferValue(BufferValue.int32);

        this.unkArr1 = new FPrimitiveArrayLazy(BufferValue.uint32).load(pkg, tag);
        this.unkArr2 = new FPrimitiveArrayLazy(BufferValue.uint32).load(pkg, tag);

        this.unkIndex = pkg.read(unIndex).value as number;

        this.unk1 = pkg.read(int32).value as number;
        this.unk2 = pkg.read(int32).value as number;
        this.unk3 = pkg.read(int32).value as number;

        if (this.unkArr1.getElemCount() > 0 || this.unkArr2.getElemCount())
            debugger;

        // debugger;

        // piVar1 = thunk_FUN_10377730((int *)param_1,(undefined4 *)(param_2 + 0xc));
        // piVar1 = thunk_FUN_10377730(piVar1,puVar2);
        // (**(code **)(*piVar1 + 4))(param_2 + 0x3c,1);
        // FArchive::ByteOrderSerialize((FArchive *)piVar1,param_2 + 0x40,4);
        // FArchive::ByteOrderSerialize((FArchive *)piVar1,param_2 + 0x44,4);
        // FArchive::ByteOrderSerialize((FArchive *)piVar1,param_2 + 0x48,4)

        return this;
    }
}