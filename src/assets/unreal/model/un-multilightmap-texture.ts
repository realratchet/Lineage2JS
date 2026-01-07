import { generateUUID } from "three/src/math/MathUtils";
import { BufferValue, UObject } from "@l2js/core";
import decompressDDS from "../../dds/dds-decode";
import ETextureFormat, { ETexturePixelFormat } from "../un-tex-format";
import FArray, { FPrimitiveArray, FPrimitiveArrayLazy } from "@l2js/core/src/unreal/un-array";

class FStaticLightmapTexture implements C.IConstructable {
    public data = new FPrimitiveArrayLazy(BufferValue.uint8);
    public dataHalfRes = new FPrimitiveArrayLazy(BufferValue.uint8);

    public format: ETextureFormat;
    public width: number;
    public height: number;
    public unkInt0: number;

    public readonly uuid = generateUUID();

    public load(pkg: C.APackage): this {
        this.data.load(pkg);
        this.dataHalfRes.load(pkg);

        this.format = pkg.read("uint8");
        this.width = pkg.read("int32");
        this.height = pkg.read("int32");
        this.unkInt0 = pkg.read("int32");

        return this;
    }

    public async getDecodeInfo(library: GD.DecodeLibrary): Promise<string> {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = null;

        const firstMipmap = this.data;
        const mipCount = 1;

        let imSize = firstMipmap.getByteLength();

        const data = new Uint8Array(imSize);

        data.set(firstMipmap.getTypedArray(), 0);

        const { width, height } = this;
        const format = this.getTexturePixelFormat();

        let decodedBuffer: ArrayBuffer;
        let textureType: GD.DecodableTexture_T;

        switch (format) {
            case ETexturePixelFormat.TPF_DXT1:
            case ETexturePixelFormat.TPF_DXT3:
            case ETexturePixelFormat.TPF_DXT5:
                textureType = "dds";
                decodedBuffer = decompressDDS(format, mipCount, width, height, data);
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
        } as GD.ITextureDecodeInfo;

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

class FLightmapTexture implements C.IConstructable {
    public levelIndex: number;
    public levelExp: C.UExport;

    public iLightmaps = new FPrimitiveArray(BufferValue.int32);
    public internalTime: number[];
    public unkInt0: number;
    public staticLightmap = new FStaticLightmapTexture();

    public load(pkg: C.APackage): this {
        this.levelIndex = pkg.read("compat32");
        this.levelExp = pkg.exports[this.levelIndex - 1];

        this.iLightmaps = this.iLightmaps.load(pkg);

        this.internalTime = new Array(2).fill(1).map(_ => pkg.read("int32"));
        this.unkInt0 = pkg.read("int32")

        this.staticLightmap.load(pkg);

        return this;
    }
}

class FMultiLightmapTexture implements C.IConstructable {
    public textures = new FArray(FLightmapTexture);
    public iLightmaps = new FPrimitiveArray(BufferValue.int32);

    public load(pkg: C.APackage): this {
        this.textures.load(pkg);
        this.iLightmaps.load(pkg);

        return this;
    }
}

export default FMultiLightmapTexture;
export { FMultiLightmapTexture, FStaticLightmapTexture };