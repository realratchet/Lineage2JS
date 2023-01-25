import { v5 as seededUuid } from "uuid";
import FArray, { FPrimitiveArray } from "./un-array";
import { FMipmap } from "./un-mipmap";
import decompressDDS from "../dds/dds-decode";
import UObject from "./un-object";
import ETextureFormat, { ETexturePixelFormat } from "./un-tex-format";
import FColor from "./un-color";
import BufferValue from "../buffer-value";
import StringSet from "@client/utils/string-set";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import FVector from "./un-vector";
import { generateUUID } from "three/src/math/MathUtils";
import UMaterial from "./un-material";

/*

    1000000000 (512)
    0100000000 (256)
    0010000000 (128)
    0001000000 ( 64)
    0000100000 ( 32)
*/

class UTexture extends UMaterial {
    protected palette: UPlatte;
    protected internalTime: number[] = new Array(2);
    protected format: ETextureFormat = ETextureFormat.TEXF_RGBA8;

    public width: number;
    public height: number;
    protected bitsW: number; // texture size log2 (number of bits in size value)
    protected bitsH: number;
    protected wrapS: number;
    protected wrapT: number;

    protected maxColor: FColor;
    protected mipZero: FColor;

    protected minFrameRate: number;
    protected maxFrameRate: number;
    protected totalFrameNum: number;
    protected animNext: UTexture;

    protected isTwoSided: boolean;
    protected isAlphaTexture: boolean;
    protected isMasked: boolean;

    protected clampModeU: number;
    protected clampModeV: number;


    protected lodSet: number;

    public readonly mipmaps: FArray<FMipmap> = new FArray(FMipmap);
    public readonly _mips: FPrimitiveArray<"uint32">;

    protected _lossDetail: any;

    protected _detailTexture: any;
    protected _environmentMap: any;
    protected _envMapTransformType: any;
    protected _specular: any;
    protected _bHighColorQuality: any;
    protected _bHighTextureQuality: any;
    protected _bRealtime: any;
    protected _bParametric: any;
    protected _bRealtimeChanged: any;
    protected _bHasComp: any;
    protected _normalLOD: any;
    protected _minLOD: any;
    protected _maxLOD: any;
    protected _animCurrent: any;
    protected _primeCount: any;
    protected _primeCurrent: any;
    protected _accumulator: any;
    protected _compFormat: any;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Palette": "palette",
            "Mips": "_mipmaps",

            "Format": "format",
            "InternalTime": "internalTime",

            "VSize": "height",
            "USize": "width",

            "UBits": "bitsW",
            "VBits": "bitsH",
            "UClamp": "wrapS",
            "VClamp": "wrapT",

            "UClampMode": "clampModeU",
            "VClampMode": "clampModeV",

            "MaxColor": "maxColor",

            "MipZero": "mipZero",

            "MinFrameRate": "minFrameRate",
            "MaxFrameRate": "maxFrameRate",
            "TotalFrameNum": "totalFrameNum",
            "AnimNext": "animNext",

            "bTwoSided": "isTwoSided",
            "bAlphaTexture": "isAlphaTexture",
            "bMasked": "isMasked",


            "LODSet": "lodSet",

            "LossDetail": "_lossDetail",

            "DetailTexture": "_detailTexture",
            "EnvironmentMap": "_environmentMap",
            "EnvMapTransformType": "_envMapTransformType",
            "Specular": "_specular",
            "bHighColorQuality": "_bHighColorQuality",
            "bHighTextureQuality": "_bHighTextureQuality",
            "bRealtime": "_bRealtime",
            "bParametric": "_bParametric",
            "bRealtimeChanged": "_bRealtimeChanged",
            "bHasComp": "_bHasComp",
            "NormalLOD": "_normalLOD",
            "MinLOD": "_minLOD",
            "MaxLOD": "_maxLOD",
            "AnimCurrent": "_animCurrent",
            "PrimeCount": "_primeCount",
            "PrimeCurrent": "_primeCurrent",
            "Accumulator": "_accumulator",
            "CompFormat": "_compFormat"
        });
    }

    public doLoad(pkg: UPackage, exp: UExport) {    // 2785
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        // debugger;

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        let someFlag = 0;

        if (verArchive >= 123 && verLicense >= 16) {
            someFlag = pkg.read(new BufferValue(BufferValue.uint32)).value as number;

            if (someFlag !== 0)
                debugger;
        }

        if (verArchive < 84) {
            debugger;
            throw new Error("Don't know what to do");
        }

        if ((someFlag & 0x100) !== 0)
            debugger;

        this.mipmaps.load(pkg);
        this.readHead = pkg.tell();

        console.assert(this.readTail === this.readHead);

        return this;
    }

    public postLoad(pkg: UPackage, exp: UExport) {
        this.readHead = pkg.tell();
    }

    protected getTexturePixelFormat(): ETexturePixelFormat {
        switch (this.format.valueOf()) {
            // case ETextureFormat.TEXF_P8: return ETexturePixelFormat.TPF_P8;
            case ETextureFormat.TEXF_DXT1: return ETexturePixelFormat.TPF_DXT1;
            // case ETextureFormat.TEXF_RGB8: return ETexturePixelFormat.TPF_RGB8;
            case ETextureFormat.TEXF_RGBA8: return ETexturePixelFormat.TPF_BGRA8;
            case ETextureFormat.TEXF_DXT3: return ETexturePixelFormat.TPF_DXT3;
            case ETextureFormat.TEXF_DXT5: return ETexturePixelFormat.TPF_DXT5;
            // case ETextureFormat.TEXF_L8: return ETexturePixelFormat.TPF_G8;
            // case ETextureFormat.TEXF_CxV8U8: return ETexturePixelFormat.TPF_V8U8_2;
            // case ETextureFormat.TEXF_DXT5N: return ETexturePixelFormat.TPF_DXT5N;
            // case ETextureFormat.TEXF_3DC: return ETexturePixelFormat.TPF_BC5;
            case ETextureFormat.TEXF_G16: return ETexturePixelFormat.TPF_G16;
            default: throw new Error(`Unknown UE2 pixel format: ${this.format}`);
        }
    }

    protected decodeTexture(library: DecodeLibrary) {
        const totalMipCount = this.mipmaps.length;

        if (totalMipCount === 0) return null;

        const loadMipmaps = library.loadMipmaps && totalMipCount > 1;

        const firstMipmap = this.mipmaps[0] as FMipmap;
        const lastMipmap = loadMipmaps ? this.mipmaps[totalMipCount - 1] as FMipmap : firstMipmap;
        const insertMipmap = loadMipmaps ? lastMipmap.sizeW !== 1 || lastMipmap.sizeH !== 1 : false;
        const levelsToInsert = loadMipmaps ? Math.log2(Math.max(lastMipmap.sizeW, lastMipmap.sizeH)) : 0;

        const embededMipCount = loadMipmaps ? totalMipCount : 1;
        const mipCount = loadMipmaps ? totalMipCount + levelsToInsert : 1;

        const format = this.getTexturePixelFormat();

        let blockSize;

        switch (format) {
            case ETexturePixelFormat.TPF_DXT1: blockSize = 8; break;
            case ETexturePixelFormat.TPF_DXT3: blockSize = 16; break;
            case ETexturePixelFormat.TPF_DXT5: blockSize = 16; break;
            case ETexturePixelFormat.TPF_DXT5N: blockSize = 16; break;
            default: blockSize = 4; break;
        }

        let byteOffset = 0;
        let imSize = firstMipmap.getByteLength();

        for (let i = 1; i < embededMipCount; i++) {
            imSize += (this.mipmaps[i] as FMipmap).getByteLength();
        }

        for (let i = levelsToInsert - 1, w = lastMipmap.sizeW, h = lastMipmap.sizeH; i >= 0; i--) {
            w = Math.max(1, w / 2);
            h = Math.max(1, h / 2);

            const dataLength = Math.max(4, w) / 4 * Math.max(4, h) / 4 * blockSize;

            imSize += dataLength;
        }

        const data = new Uint8Array(imSize);

        firstMipmap.getImageBuffer(data, 0);
        byteOffset += firstMipmap.getByteLength();

        for (let i = 1, len = embededMipCount; i < len; i++) {
            const mipmap = this.mipmaps[i] as FMipmap;

            mipmap.getImageBuffer(data, byteOffset);
            byteOffset += mipmap.getByteLength();
        }

        if (insertMipmap) {
            const lastSliceSize = lastMipmap.getByteLength();
            const pixelCount = lastSliceSize / 4;

            const color = new Uint8Array(4);

            for (let i = byteOffset - lastSliceSize; i < byteOffset; i += 4) {
                color[0] += data[i + 0];
                color[1] += data[i + 1];
                color[2] += data[i + 2];
                color[3] += data[i + 3];
            }

            color[0] = Math.round(color[0] / pixelCount);
            color[1] = Math.round(color[1] / pixelCount);
            color[2] = Math.round(color[2] / pixelCount);
            color[3] = Math.round(color[3] / pixelCount);

            for (let j = levelsToInsert - 1, w = lastMipmap.sizeW, h = lastMipmap.sizeH; j >= 0; j--) {
                w = Math.max(1, w / 2);
                h = Math.max(1, h / 2);

                const dataLength = Math.max(4, w) / 4 * Math.max(4, h) / 4 * blockSize;

                for (let i = 0; i < blockSize; i += 4) {
                    data[byteOffset + i + 0] = color[0];
                    data[byteOffset + i + 1] = color[1];
                    data[byteOffset + i + 2] = color[2];
                    data[byteOffset + i + 3] = color[3];
                }

                byteOffset = byteOffset + dataLength;
            }
        }

        const width = firstMipmap.sizeW, height = firstMipmap.sizeH;
        let decodedBuffer: ArrayBuffer;
        let textureType: DecodableTexture_T;

        switch (format) {
            case ETexturePixelFormat.TPF_DXT1:
            case ETexturePixelFormat.TPF_DXT3:
            case ETexturePixelFormat.TPF_DXT5:
            case ETexturePixelFormat.TPF_DXT5N:
                textureType = "dds";
                decodedBuffer = decompressDDS(format, mipCount, width, height, data);
                break;
            case ETexturePixelFormat.TPF_G16:
                textureType = "g16";
                decodedBuffer = data.buffer;
                break;
            case ETexturePixelFormat.TPF_BGRA8:
            case ETexturePixelFormat.TPF_RGBA8: {
                textureType = "rgba";
                if (!this.palette) {
                    decodedBuffer = data.buffer;
                } else {
                    const buff = new Uint8Array(imSize * 4);

                    for (let i = 0, len = imSize; i < len; i++) {
                        const c = this.palette.loadSelf().colors.getElem(data[i]);
                        const ii = i * 4;

                        buff[ii + 0] = c.r;
                        buff[ii + 1] = c.g;
                        buff[ii + 2] = c.b;
                        buff[ii + 3] = c.a;
                    }

                    decodedBuffer = buff.buffer;
                }
            } break;
            default: throw new Error(`Unsupported texture format: ${format}`);
        }

        return {
            materialType: "texture",
            textureType,
            name: this.objectName,
            buffer: decodedBuffer,
            width,
            height,
            wrapS: this.wrapS,
            wrapT: this.wrapT,
            useMipmaps: mipCount > 0
        } as ITextureDecodeInfo;
    }

    public getDecodeInfo(library: DecodeLibrary): string {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = null;

        if (typeof this.totalFrameNum === "number" && this.totalFrameNum > 1) {
            const sprites: ITextureDecodeInfo[] = [];

            let tex: UTexture = this;

            for (let i = 0, len = this.totalFrameNum; i < len && tex; i++) {
                sprites.push(tex.loadSelf().decodeTexture(library));
                tex = tex.animNext;
            }

            library.materials[this.uuid] = {
                name: `Sprite_${this.objectName}`,
                materialType: "sprite",
                sprites,
                framerate: 1000 / this.maxFrameRate
            } as IAnimatedSpriteDecodeInfo;
        } else {
            library.materials[this.uuid] = this.decodeTexture(library);
        }

        return this.uuid;
    }

    public toString() { return `Texture=${this.objectName}`; }
}

export default UTexture;
export { UTexture };

function createPlane(width: number, height: number, widthSegments: number, heightSegments: number) {
    const width_half = width / 2;
    const height_half = height / 2;

    const gridX = Math.floor(widthSegments);
    const gridY = Math.floor(heightSegments);

    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;

    const segment_width = width / gridX;
    const segment_height = height / gridY;

    //

    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];

    for (let iy = 0; iy < gridY1; iy++) {

        const y = iy * segment_height - height_half;

        for (let ix = 0; ix < gridX1; ix++) {

            const x = ix * segment_width - width_half;

            vertices.push(x, - y, 0);

            normals.push(0, 0, 1);

            uvs.push(ix / gridX);
            uvs.push(1 - (iy / gridY));

        }

    }

    for (let iy = 0; iy < gridY; iy++) {

        for (let ix = 0; ix < gridX; ix++) {

            const a = ix + gridX1 * iy;
            const b = ix + gridX1 * (iy + 1);
            const c = (ix + 1) + gridX1 * (iy + 1);
            const d = (ix + 1) + gridX1 * iy;

            indices.push(a, b, d);
            indices.push(b, c, d);

        }
    }

    const TypedIndicesArray = getTypedArrayConstructor(indices.length / 3);

    return {
        indices: new TypedIndicesArray(indices),
        positions: new Float32Array(vertices),
        uvs: new Float32Array(uvs),
        normals: new Float32Array(normals)
    };
}