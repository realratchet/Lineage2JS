import FConstructable from "../un-constructable";
import FArray, { FPrimitiveArray, FPrimitiveArrayLazy } from "../un-array";
import BufferValue from "@client/assets/buffer-value";

class FSubStructure extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        const uint8 = new BufferValue(BufferValue.uint8);
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        // debugger;

        this.unkIndex0 = pkg.read(compat).value as number;
        const light = pkg.exports[this.unkIndex0 - 1];

        // debugger;

        // const offset = pkg.tell();
        // const size = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        // pkg.seek(offset, "set");
        
        // debugger;

        this.unkArr = new FPrimitiveArray(BufferValue.uint8).load(pkg, tag).getTypedArray();

        // debugger;

        this.unkInts0 = new Array(2).fill(1).map(_ => pkg.read(int32).value as number);
        
        this.unk0 = pkg.read(int32).value as number;

        this.unkInts1 = new Array(4).fill(1).map(_ => pkg.read(int32).value as number);

        // debugger;

        return this;
    }
}

class FMultiLightMapTexture extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        /* some 7 indices */
        this.unkIndices = new Array(7).fill(1).map(_ => pkg.read(compat).value as number);

        // debugger;

        this.unkFunInts = new Array(16).fill(1).map(_ => pkg.read(int32).value as number);

        this.unkInts = new Array(9).fill(1).map(_ => pkg.read(int32).value as number);

        // debugger;

        const offset = pkg.tell();
        const size = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        pkg.seek(offset, "set");


        const ver = pkg.header.getArchiveFileVersion();

        // debugger;

        this.unkSubstructure = new FArray(FSubStructure).load(pkg);

        this.unkIndex0 = pkg.read(compat).value as number;
        this.unk0 = pkg.read(int32).value as number;

        // const ver = pkg.header.getArchiveFileVersion();

        // debugger;



        return this;
    }
}

export default FMultiLightMapTexture;
export { FMultiLightMapTexture };

function saveFile(content: Blob, name: string) {
    const link = document.createElement("a"); // Or maybe get it from the current document
    link.href = URL.createObjectURL(content);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
}

class FLightmapTexture extends FConstructable {
    public load(pkg: UPackage, tag: PropertyTag): this {
        // debugger;
        const int32 = new BufferValue(BufferValue.int32);
        const compat = new BufferValue(BufferValue.compat32);

        // debugger;

        // // const unIndex = pkg.read(compat).value as number;

        // // debugger;

        // this.unkBytes = new FPrimitiveArray(BufferValue.uint32).load(pkg, tag);

        // debugger;

        // this.unk1 = pkg.read(int32).value as number; // pow2 size?
        // this.unk2 = pkg.read(int32).value as number; // ??? read together with unk1
        // this.unk3 = pkg.read(int32).value as number;

        // // FArchive::ByteOrderSerialize(pFVar1,param_2 + 4,8);
        // // FArchive::ByteOrderSerialize(pFVar1,param_2 + 0x68,4);

        // debugger;

        if (0x73 < pkg.header.getArchiveFileVersion()) {
            // debugger;
            let startOffset = pkg.tell();
            for (let i = 0; i < 500; i++) {
                // debugger;
                try {
                    pkg.seek(startOffset + i, "set");
                    const data = new FPrimitiveArray(BufferValue.uint8).load(pkg, tag)

                    if (data.getElemCount() <= 0) continue;

                    // const buff = data.array.buffer.slice(data.array.byteOffset, data.array.byteOffset + data.array.byteLength);
                    // const blob = new Blob([buff], { type: "application/octet-stream" });
                    // saveFile(blob, `dump_${startOffset}_${i}.data`)

                    console.log(i, data.getElemCount(), data.getElemCount() ** 0.5);
                    // debugger;
                } catch (e) {

                }
            }

            // this.primitiveTexture = new FStaticLightMapTexture().load(pkg, tag);
            debugger;
        }

        debugger;

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