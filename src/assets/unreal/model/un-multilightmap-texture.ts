import { generateUUID } from "three/src/math/MathUtils";
import BufferValue from "../../buffer-value";
import FArray, { FPrimitiveArray, FPrimitiveArrayLazy } from "../un-array";
import FConstructable from "../un-constructable";
import decompressDDS from "../../dds/dds-decode";
import ETextureFormat, { ETexturePixelFormat } from "../un-tex-format";

class FStaticLightmapTexture extends FConstructable {
    public unkArr0 = new FPrimitiveArrayLazy(BufferValue.uint8);
    public unkArr1 = new FPrimitiveArrayLazy(BufferValue.uint8);

    public format: ETextureFormat;
    public width: number;
    public height: number;
    public unkInt0: number;

    public readonly uuid = generateUUID();

    public load(pkg: UPackage, tag: PropertyTag): this {
        const uint8 = new BufferValue(BufferValue.uint8);
        const int32 = new BufferValue(BufferValue.int32);

        this.unkArr0.load(pkg, tag);
        this.unkArr1.load(pkg, tag);

        this.format = pkg.read(uint8).value as number;
        this.width = pkg.read(int32).value as number;
        this.height = pkg.read(int32).value as number;
        this.unkInt0 = pkg.read(int32).value as number;

        // debugger;

        return this;
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<string> {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = null;

        const firstMipmap = this.unkArr0;
        const mipCount = 1;

        let imSize = firstMipmap.getByteLength();

        const data = new Uint8Array(imSize);

        data.set(firstMipmap.getTypedArray() as Uint8Array, 0);

        const { width, height } = this;
        const format = this.getTexturePixelFormat();

        let decodedBuffer: ArrayBuffer;
        let textureType: DecodableTexture_T;

        switch (format) {
            case ETexturePixelFormat.TPF_DXT1:
            case ETexturePixelFormat.TPF_DXT3:
            case ETexturePixelFormat.TPF_DXT5:
                textureType = "dds";
                decodedBuffer = await decompressDDS(format, mipCount, width, height, data);
                break;
            default: throw new Error(`Unsupported texture format: ${format}`);
        }

        const wrapS = 1024, wrapT = wrapS;

        library.materials[this.uuid] = {
            materialType: "texture",
            textureType,
            buffer: decodedBuffer,
            width,
            height,
            wrapS: wrapS,
            wrapT: wrapT,
            useMipmaps: mipCount > 0
        } as ITextureDecodeInfo;

        return this.uuid;
    }

    getTexturePixelFormat() {
        switch (this.format) {
            case ETextureFormat.TEXF_DXT1: return ETexturePixelFormat.TPF_DXT1;
            case ETextureFormat.TEXF_DXT3: return ETexturePixelFormat.TPF_DXT3;
            case ETextureFormat.TEXF_DXT5: return ETexturePixelFormat.TPF_DXT5;
            default: throw new Error(`Unknown format: '${this.format}'`);
        }
    }
}

class FLightmapTexture extends FConstructable {
    public levelIndex: number;
    public levelExp: UExport;

    public unkIntArr0 = new FPrimitiveArray(BufferValue.int32);
    public unkLong0: BigInt;
    public unkInt0: number;
    public staticLightmap = new FStaticLightmapTexture();

    public load(pkg: UPackage, tag: PropertyTag): this {
        const int32 = new BufferValue(BufferValue.int32);
        const int64 = new BufferValue(BufferValue.int64);
        const compat = new BufferValue(BufferValue.compat32);

        this.levelIndex = pkg.read(compat).value as number;
        this.levelExp = pkg.exports[this.levelIndex - 1];

        this.unkIntArr0.load(pkg, tag);

        this.unkLong0 = pkg.read(int64).value as BigInt
        this.unkInt0 = pkg.read(int32).value as number

        this.staticLightmap.load(pkg, tag);

        return this;
    }
}

class FMultiLightmapTexture extends FConstructable {
    public textures = new FArray(FLightmapTexture);
    public unkArray0 = new FPrimitiveArray(BufferValue.int32);

    public load(pkg: UPackage, tag: PropertyTag): this {
        this.textures.load(pkg, tag);
        this.unkArray0.load(pkg, tag);

        // debugger;

        return this;
    }
}

export default FMultiLightmapTexture;
export { FMultiLightmapTexture };