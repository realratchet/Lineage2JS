import { DDSConstants } from "@l2js/engine/dds/dds-constants";
import { WebGLRenderer, CompressedTexture, LinearFilter, NearestFilter, RepeatWrapping, ClampToEdgeWrapping, Vector2, DataTexture, RGBAFormat, RGFormat, FloatType, RedFormat, LinearMipmapLinearFilter, NearestMipmapNearestFilter, RGB_S3TC_DXT1_Format, RGBA_S3TC_DXT1_Format } from "three";
import { DDSLoader } from "three/examples/jsm/loaders/DDSLoader";
import type { DecodeLibrary } from "@l2js/engine";
import type { TextureClampMode_T, DataTextureFormats_T, IDataTextureDecodeInfo, ITextureDecodeInfo, MapData_T } from "@l2js/engine/contracts/texture";
import { releaseSharedTextureBuffer, restoreSharedTextureBuffer } from "../decode-worker/decode-worker-client";
import WetWaterTexture from "../../materials/wet-water-texture";
import { dxt1ToRgba, dxt3ToRgba, dxt5ToRgba } from "@l2js/engine/dds/dxt-decode";

type TextureSource_T = { key: string, info: ITextureDecodeInfo };

const cacheTextureSources = new WeakMap<THREE.Texture, TextureSource_T>();
const cacheTextureFilters = new WeakMap<THREE.Texture, [THREE.MinificationTextureFilter, THREE.MagnificationTextureFilter]>();
const cacheTextureReferences = new Set<WeakRef<THREE.Texture>>();
const textureFinalizer = new FinalizationRegistry<WeakRef<THREE.Texture>>(texture => cacheTextureReferences.delete(texture));
const cacheTextureLOD = new WeakMap<THREE.Texture, [number, number]>();
let textureRenderer: WebGLRenderer = null;
let textureDetail = 0;
let useTrilinear = true;

export function setUseTrilinear(enabled: boolean) {
    if (useTrilinear === enabled) return;

    useTrilinear = enabled;
    for (const reference of cacheTextureReferences) {
        const texture = reference.deref();
        if (texture) updateTextureFiltering(texture);
        else cacheTextureReferences.delete(reference);
    }
}

export function updateTextureFiltering(texture: THREE.Texture, minFilter: THREE.MinificationTextureFilter = null): void {
    if (texture.isRenderTargetTexture || (texture as any).isCanvasTexture) return;

    let filters = cacheTextureFilters.get(texture);
    if (!filters) {
        const originalMin = minFilter ?? texture.minFilter;
        if (texture.magFilter !== LinearFilter || originalMin !== LinearFilter && originalMin !== LinearMipmapLinearFilter) return;

        filters = [originalMin, texture.magFilter];
        cacheTextureFilters.set(texture, filters);
        const reference = new WeakRef(texture);

        cacheTextureReferences.add(reference);
        textureFinalizer.register(texture, reference);
    } else if (minFilter !== null) filters[0] = minFilter;

    const nextMin = useTrilinear ? filters[0] : filters[0] === LinearFilter ? NearestFilter : NearestMipmapNearestFilter;
    const magFilter = useTrilinear ? filters[1] : NearestFilter;
    if (texture.minFilter === nextMin && texture.magFilter === magFilter) return;

    texture.minFilter = nextMin;
    texture.magFilter = magFilter;
    texture.needsUpdate = true;
}

export function copyTextureFiltering(source: THREE.Texture, target: THREE.Texture): void {
    const filters = cacheTextureFilters.get(source);

    target.minFilter = filters ? filters[0] : source.minFilter;
    target.magFilter = filters ? filters[1] : source.magFilter;
    updateTextureFiltering(target);
}

export function setTextureDetail(renderer: WebGLRenderer, detail: number): void {
    if (textureRenderer === renderer && textureDetail === detail) return;

    textureRenderer = renderer;
    textureDetail = detail;
    for (const reference of cacheTextureReferences) {
        const texture = reference.deref();
        if (texture) updateTextureLOD(texture);
        else cacheTextureReferences.delete(reference);
    }
}

function updateTextureLOD(texture: THREE.Texture): void {
    const bounds = cacheTextureLOD.get(texture);
    if (!bounds || !textureRenderer) return;

    const object = textureRenderer.properties.get(texture).__webglTexture;
    if (!object) return;

    const gl = textureRenderer.getContext() as WebGL2RenderingContext;
    const target = (texture as any).isCubeTexture ? gl.TEXTURE_CUBE_MAP : (texture as any).isCompressedArrayTexture ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
    const binding = target === gl.TEXTURE_CUBE_MAP ? gl.TEXTURE_BINDING_CUBE_MAP : target === gl.TEXTURE_2D_ARRAY ? gl.TEXTURE_BINDING_2D_ARRAY : gl.TEXTURE_BINDING_2D;
    const previous = gl.getParameter(binding);

    gl.bindTexture(target, object);
    gl.texParameteri(target, gl.TEXTURE_BASE_LEVEL, Math.max(bounds[0], Math.min(bounds[1], textureDetail)));
    gl.bindTexture(target, previous);
}

function registerTextureLOD(texture: THREE.Texture, bounds: [number, number]): void {
    if (!Number.isInteger(bounds[0]) || !Number.isInteger(bounds[1]) || bounds[0] < 0 || bounds[1] < 0) throw new Error(`Invalid texture LOD bounds for '${texture.name}'.`);

    cacheTextureLOD.set(texture, bounds);
    const onUpdate = texture.onUpdate;

    texture.onUpdate = function () {
        if (onUpdate) onUpdate.call(this, texture);
        updateTextureLOD(texture);
    };
    updateTextureLOD(texture);
}

export function getTextureLODBounds(texture: THREE.Texture): [number, number] { return cacheTextureLOD.get(texture); }

export function copyTextureLOD(source: THREE.Texture, target: THREE.Texture): void {
    const bounds = cacheTextureLOD.get(source);
    if (bounds) registerTextureLOD(target, bounds);
}

export function retainSharedTextureBuffer(texture: THREE.Texture): void {
    const source = cacheTextureSources.get(texture);

    if (source) source.info.buffer = restoreSharedTextureBuffer(source.key, source.info.buffer);
}

function getClamping(mode: TextureClampMode_T): THREE.Wrapping {
    return mode === "clamp" ? ClampToEdgeWrapping : RepeatWrapping;
}

function getFormat(type: DataTextureFormats_T) {
    if (typeof type !== "string")
        return RGBAFormat;

    // const RGBFormat = 1022;

    switch (type) {
        case "r": return RedFormat;
        case "rg": return RGFormat;
        case "rgb": return RGBAFormat;
        case "rgba": return RGBAFormat;
        default: throw new Error(`Unsupported texture format: ${type}`);
    }
}

// Uploads the DDS mip chain as an S3TC CompressedTexture. Our DDS header never sets
// the alpha flag so DDSLoader reports DXT1 as RGB - force the RGBA variant which
// decodes DXT1's 1-bit alpha correctly (identical block data).
function decodeCompressedDDS(buffer: ArrayBuffer): THREE.Texture {
    const dds = new DDSLoader().parse(buffer, true);
    const format = dds.format === RGB_S3TC_DXT1_Format ? RGBA_S3TC_DXT1_Format : dds.format;
    const texture = new CompressedTexture(dds.mipmaps as ImageData[], dds.width, dds.height, format as THREE.CompressedPixelFormat);

    texture.minFilter = dds.mipmapCount === 1 ? LinearFilter : LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.flipY = false;
    texture.needsUpdate = true;

    return texture;
}

// Replaced CompressedTexture with DataTexture (Software Decode) to fix Alpha Issues
function decodeDDS(buffer: ArrayBuffer, preferCompressed: boolean = false): THREE.Texture {
    if (preferCompressed) {
        try {
            return decodeCompressedDDS(buffer);
        } catch (e) {
            console.warn("[decodeDDS] compressed upload failed, falling back to software decode:", e);
        }
    }

    // 1. Try Manual Software Decompression (Matches B64 Export Logic)
    try {
        const header = new Int32Array(buffer, 0, 31);
        const height = header[3];
        const width = header[4];
        const fourCC = header[21];
        const dataOffset = 128; // DDS header size

        let rgbaData: Uint8Array | null = null;
        const input = new Uint8Array(buffer, dataOffset);

        if (fourCC === DDSConstants.FOURCC_DXT1) { // DXT1
            rgbaData = dxt1ToRgba(width, height, input);
        } else if (fourCC === DDSConstants.FOURCC_DXT3) { // DXT3
            rgbaData = dxt3ToRgba(width, height, input);
        } else if (fourCC === DDSConstants.FOURCC_DXT5) { // DXT5
            rgbaData = dxt5ToRgba(width, height, input);
        }

        if (rgbaData) {
            const texture = new DataTexture(rgbaData, width, height, RGBAFormat);
            texture.flipY = false;
            texture.generateMipmaps = true;
            texture.minFilter = LinearMipmapLinearFilter;
            texture.magFilter = LinearFilter;
            texture.needsUpdate = true;
            return texture;
        }
    } catch (e) {
        console.warn("[decodeDDS] Software Decode Failed, falling back to DDSLoader", e);
    }

    // 2. Fallback to Original DDSLoader (CompressedTexture)
    const ddsLoader = new DDSLoader();
    const dds = ddsLoader.parse(buffer, true);
    const { mipmaps, width, height, format: _format, mipmapCount } = dds;
    const texture = new CompressedTexture(mipmaps as ImageData[], width, height, _format as THREE.CompressedPixelFormat);

    if (mipmapCount === 1) texture.minFilter = LinearFilter;

    texture.needsUpdate = true;
    texture.flipY = false;

    return texture;
}

function decodeRGBA(info: IDataTextureDecodeInfo): DataTexture {
    const byteLength = info.width * info.height * 4;

    if (info.buffer.byteLength < byteLength) {
        // bad/unsupported texture data must not kill the whole sector
        console.warn(`Texture '${info.name}' has ${info.buffer.byteLength} bytes, expected ${byteLength} - using placeholder`);

        const placeholder = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1);

        placeholder.needsUpdate = true;

        return placeholder;
    }

    const image = new Uint8Array(info.buffer, 0, byteLength);
    const texture = new DataTexture(image, info.width, info.height, getFormat(info.format));

    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;

    texture.flipY = false;
    texture.needsUpdate = true;

    return texture;
}

function decodeG16(info: IDataTextureDecodeInfo): DataTexture {
    const buff = new Uint16Array(info.buffer);
    const image = new Uint8Array(info.width * info.height * 4);
    const texture = new DataTexture(image, info.width, info.height, getFormat(info.format));

    debugger;

    for (let i = 0, len = info.width * info.height; i < len; i++) {
        image[i * 4 + 0] = image[i * 4 + 1] = image[i * 4 + 2] = buff[i] / 255;
        image[i * 4 + 3] = 255;
    }

    texture.flipY = false;

    return texture;
}

function decodeFloat(info: IDataTextureDecodeInfo): DataTexture {
    const texture = new DataTexture(
        info.buffer,
        info.width, info.height,
        getFormat(info.format),
        FloatType,
    );

    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;

    // debugger;

    texture.flipY = false;
    texture.needsUpdate = true;

    return texture;
}

export function decodeTexture(library: DecodeLibrary, info: ITextureDecodeInfo): MapData_T {
    let texture: THREE.Texture;

    switch (info.textureType) {
        case "dds": texture = decodeDDS(info.buffer, (library as any).preferCompressedTextures === true); break;
        case "wet": texture = new WetWaterTexture(info as any); break;
        case "rgba": texture = decodeRGBA(info); break;
        case "g16": texture = decodeG16(info); break;
        case "float": texture = decodeFloat(info); break;
        default: throw new Error(`Unsupported texture format: ${info.textureType}`);
    }

    if (info.buffer) {
        const key = (info as any).sharedTextureKey || (info.name ? `${info.name.toLowerCase()}:${info.textureType}:${info.buffer.byteLength}` : null);
        const source = { key, info };

        if (key) cacheTextureSources.set(texture, source);
        texture.addEventListener("dispose", () => releaseSharedTextureBuffer(source.info.buffer));
    }

    texture.wrapS = info.wrapS ? getClamping(info.wrapS) : RepeatWrapping;
    texture.wrapT = info.wrapT ? getClamping(info.wrapT) : RepeatWrapping;

    if (info.name) texture.name = info.name;
    if (library.anisotropy >= 0) texture.anisotropy = library.anisotropy;

    const width = texture.image?.width ?? (texture as any).width ?? 1;
    const height = texture.image?.height ?? (texture as any).height ?? 1;

    updateTextureFiltering(texture);
    if (info.minLOD !== undefined && info.maxLOD !== undefined) registerTextureLOD(texture, [info.minLOD, info.maxLOD]);

    return { texture, size: new Vector2(width, height) };
}


export function decodeTextureAsB64(info: ITextureDecodeInfo): string | null {
    let rgbaData: Uint8Array | null = null;
    let width = 1, height = 1;

    try {
        if (info.textureType === "dds") {
            const header = new Int32Array(info.buffer, 0, 31);
            height = header[3];
            width = header[4];
            const fourCC = header[21];

            const dataOffset = 128; // DDS header size
            const input = new Uint8Array(info.buffer, dataOffset);

            if (fourCC === DDSConstants.FOURCC_DXT1) { // DXT1
                rgbaData = dxt1ToRgba(width, height, input);
            } else if (fourCC === DDSConstants.FOURCC_DXT3) { // DXT3
                rgbaData = dxt3ToRgba(width, height, input);
            } else if (fourCC === DDSConstants.FOURCC_DXT5) { // DXT5
                rgbaData = dxt5ToRgba(width, height, input);
            } else {
                console.warn(`Unsupported DDS FourCC for B64 decode: ${fourCC}`);
                return null;
            }

        } else if (info.textureType === "rgba") {
            const dataInfo = info as IDataTextureDecodeInfo;
            if (dataInfo.format === 'rgba' || !dataInfo.format) {
                width = dataInfo.width;
                height = dataInfo.height;
                rgbaData = new Uint8Array(info.buffer);
            }
        }

        if (rgbaData) {
            if (typeof document === 'undefined') return "no-document-context";

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            const imageData = ctx.createImageData(width, height);
            imageData.data.set(rgbaData);
            ctx.putImageData(imageData, 0, 0);

            return canvas.toDataURL();
        }

    } catch (e) {
        console.error("Failed to decode texture to B64", e);
    }
    return null;
}

export default decodeTexture;
