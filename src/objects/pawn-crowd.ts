import { BufferAttribute, BufferGeometry, CompressedArrayTexture, CompressedTexture, DataTexture, DoubleSide, FloatType, Mesh, Object3D, RGBAFormat, SRGBColorSpace, Texture, Vector3, WebGLRenderer } from "three";
import MeshStaticMaterial, { MAX_HARDWARE_LIGHTS } from "../materials/mesh-static-material/mesh-static-material";
import { copyTextureFiltering, copyTextureLOD, getTextureLODBounds } from "../materials/texture-settings";
import RangeAllocator from "../utils/range-allocator";
import boneAtlas from "./bone-atlas";
import { canBatchPawnMaterial, getPawnTextures, packPawnMaterial, type PawnMesh } from "./pawn-mesh";
import type LitSkinnedMesh from "./lit-skinned-mesh";

const DATA_WIDTH = 1024;
const STATIC_TEXELS = 12;
const DRAW_TEXELS = 10;
const LIGHT_TEXELS = 2 + MAX_HARDWARE_LIGHTS * 4;
const STATIC_PARTS = 256;
const ARRAY_LAYERS = 4096;
const PLAIN_SLOTS = 4;
const arrPoolAttributes: [string, number, Float32ArrayConstructor | Uint16ArrayConstructor, boolean][] = [["position", 3, Float32Array, true], ["normal", 3, Float32Array, true], ["uv", 2, Float32Array, true], ["skinIndex", 4, Uint16Array, true], ["skinWeight", 4, Float32Array, true], ["skinIndex2", 4, Uint16Array, false], ["skinWeight2", 4, Float32Array, false]];
const tmpWhite = new Vector3(1, 1, 1);
const tmpMaps = [0, 0, 0, 0];

type PawnCrowdRange_T = { vertexStart: number, vertexCount: number, indexStart: number, indexCount: number, references: number };
type PawnCrowdLayer_T = { array: PawnTextureArray, layer: number, references: number };
type PawnCrowdPart_T = PawnCrowdEntry_T & { material: MeshStaticMaterial };
export type PawnCrowdEntry_T = { crowd: PawnCrowd, group: PawnCrowdMesh, staticStart: number, partCount: number, drawCapacity: number, textures: Texture[], maps: number[], geometries: BufferGeometry[], ranges: PawnCrowdRange_T[], materialVersion: number };

function createDataTexture(data: Float32Array): DataTexture {
    const texture = new DataTexture(data, DATA_WIDTH, data.length / 4 / DATA_WIDTH, RGBAFormat, FloatType);

    texture.needsUpdate = true;
    return texture;
}

function writeMatrix(target: Float32Array, offset: number, e: ArrayLike<number>, source: number = 0): void {
    target[offset] = e[source]; target[offset + 1] = e[source + 4]; target[offset + 2] = e[source + 8]; target[offset + 3] = e[source + 12];
    target[offset + 4] = e[source + 1]; target[offset + 5] = e[source + 5]; target[offset + 6] = e[source + 9]; target[offset + 7] = e[source + 13];
    target[offset + 8] = e[source + 2]; target[offset + 9] = e[source + 6]; target[offset + 10] = e[source + 10]; target[offset + 11] = e[source + 14];
}

function isPoolable(geometry: BufferGeometry): boolean {
    if (!geometry.index || Object.keys(geometry.morphAttributes).length > 0) return false;
    if (geometry.drawRange.start !== 0 || geometry.drawRange.count < geometry.index.count) return false;

    for (const [name, size, _array, isRequired] of arrPoolAttributes) {
        const attribute = geometry.getAttribute(name) as BufferAttribute;

        if (!attribute) { if (isRequired) return false; continue; }
        if (attribute.itemSize !== size || attribute.normalized || (attribute as any).isInterleavedBufferAttribute) return false;
    }

    return true;
}

function isArrayable(texture: Texture): boolean {
    const compressed = texture as CompressedTexture;

    return compressed.isCompressedTexture && !(texture as any).isCompressedArrayTexture && !(texture as any).isCubeTexture && !(texture as any).isUpdatable && texture.format !== RGBAFormat && texture.colorSpace !== SRGBColorSpace && compressed.mipmaps.length > 0 && compressed.mipmaps.every(mip => mip.data);
}

function getArrayKey(texture: CompressedTexture): string {
    return JSON.stringify([texture.image.width, texture.image.height, texture.format, texture.type, texture.mipmaps.length, texture.wrapS, texture.wrapT, texture.minFilter, texture.magFilter, texture.anisotropy, texture.colorSpace, texture.flipY, texture.premultiplyAlpha, getTextureLODBounds(texture)]);
}

function isPlain(texture: Texture): boolean { return !(texture as any).isCubeTexture && !(texture as any).isDataArrayTexture && !(texture as any).isCompressedArrayTexture && !(texture as any).isData3DTexture && !(texture as any).isUpdatable; }

function createMaterial(slots: number): MeshStaticMaterial {
    const material = new MeshStaticMaterial();

    material.side = DoubleSide;
    material.setActorLit();
    material.setExtendedBoneInfluences();
    Object.assign(material.defines, { USE_PAWN_MATERIALS: "", USE_PAWN_CROWD: "", PAWN_CROWD_DRAW_TEXELS: DRAW_TEXELS, USE_SKINNING: "", USE_UV: "", USE_ENVMAP: "", ENVMAP_MODE_REFLECTION: "" });
    Object.assign(material.uniforms, {
        pawnArrays: { value: new Array(slots).fill(null) },
        pawnTextures: { value: new Array(PLAIN_SLOTS).fill(null) },
        pawnBones: { value: boneAtlas.getTexture() },
        pawnCrowdStatic: { value: null },
        pawnCrowdDynamic: { value: null },
        pawnCrowdDrawBase: { value: 0 },
        pawnSilhouette: { value: false }
    });

    material.vertexShader = material.vertexShader.replace("#include <skinning_pars_vertex>", `
        uniform highp sampler2D pawnBones;
        mat4 bindMatrix;
        mat4 bindMatrixInverse;
        mat4 getBoneMatrix(float index) {
            int size = textureSize(pawnBones, 0).x;
            int j = (pawnCrowdBoneOffset + int(index)) * 4;
            int x = j % size;
            int y = j / size;
            return mat4(texelFetch(pawnBones, ivec2(x, y), 0), texelFetch(pawnBones, ivec2(x + 1, y), 0), texelFetch(pawnBones, ivec2(x + 2, y), 0), texelFetch(pawnBones, ivec2(x + 3, y), 0));
        }
    `);
    material.fragmentShader = `
        uniform highp sampler2DArray pawnArrays[${slots}];
        uniform sampler2D pawnTextures[${PLAIN_SLOTS}];
        vec4 samplePawnTexture(int index, vec2 uv) {
            int slot = index / ${ARRAY_LAYERS};
            vec3 coords = vec3(uv, float(index - slot * ${ARRAY_LAYERS}));
            ${Array.from({ length: slots }, (_value, i) => `if (slot == ${i}) return texture(pawnArrays[${i}], coords);`).join("\n")}
            ${Array.from({ length: PLAIN_SLOTS }, (_value, i) => `if (slot == ${slots + i}) return texture2D(pawnTextures[${i}], uv);`).join("\n")}
            return vec4(1.0);
        }
    ` + material.fragmentShader;

    return material;
}

class PawnTextureArray {
    public readonly key: string;
    public texture: CompressedArrayTexture;
    protected depth: number;
    protected readonly limit: number;
    protected readonly sources: CompressedTexture[] = [];
    protected readonly arrPending: number[] = [];

    public constructor(key: string, source: CompressedTexture, limit: number) {

        this.key = key;
        this.limit = limit;
        this.depth = Math.min(16, limit);
        this.texture = this.createTexture(source);
    }

    protected createTexture(source: CompressedTexture): CompressedArrayTexture {
        const texture = new CompressedArrayTexture(source.mipmaps.map(mip => ({ width: mip.width, height: mip.height, data: null })) as any, source.image.width, source.image.height, this.depth, source.format, source.type);

        texture.source.dataReady = false; // three only allocates the storage, layers are uploaded one by one
        texture.wrapS = source.wrapS;
        texture.wrapT = source.wrapT;
        copyTextureFiltering(source, texture);
        copyTextureLOD(source, texture);
        texture.anisotropy = source.anisotropy;
        texture.colorSpace = source.colorSpace;
        texture.flipY = source.flipY;
        texture.premultiplyAlpha = source.premultiplyAlpha;
        texture.needsUpdate = true;
        return texture;
    }

    public allocate(source: CompressedTexture): number {
        let layer = this.sources.indexOf(null);

        if (layer < 0) layer = this.sources.length;
        if (layer >= this.depth) {
            if (this.depth >= this.limit) return -1;

            this.depth = Math.min(this.depth * 2, this.limit);
            this.texture.dispose();
            this.texture = this.createTexture(source);
        }

        this.sources[layer] = source;
        this.arrPending.push(layer);
        return layer;
    }

    public free(layer: number): void { this.sources[layer] = null; }

    public upload(renderer: WebGLRenderer): void {
        const properties = renderer.properties.get(this.texture) as { __webglTexture: WebGLTexture };

        if (!properties.__webglTexture) { // first use, array growth or a restored context
            renderer.initTexture(this.texture);
            this.arrPending.length = 0;
            for (let i = 0; i < this.sources.length; i++) if (this.sources[i]) this.arrPending.push(i);
        }
        if (this.arrPending.length === 0) return;

        const gl = renderer.getContext() as WebGL2RenderingContext;

        (renderer.state as any).bindTexture(gl.TEXTURE_2D_ARRAY, properties.__webglTexture);
        for (const layer of this.arrPending) {
            const source = this.sources[layer];

            if (!source) continue;
            for (let level = 0; level < source.mipmaps.length; level++) {
                const mip = source.mipmaps[level];

                gl.compressedTexSubImage3D(gl.TEXTURE_2D_ARRAY, level, 0, 0, layer, mip.width, mip.height, 1, this.texture.format, mip.data as unknown as Uint8Array);
            }
        }
        this.arrPending.length = 0;
    }
}

export class PawnCrowdMesh extends Mesh {
    declare public readonly isPawnCrowdMesh: boolean;
    public readonly arrays: PawnTextureArray[];
    public readonly references: number[];
    public readonly textures: Texture[] = new Array(PLAIN_SLOTS).fill(null);
    public readonly textureReferences: number[] = new Array(PLAIN_SLOTS).fill(0);
    public capacity: number = 0;
    public drawBase: number = 0;
    public drawCount: number = 0;
    public starts = new Int32Array(64);
    public counts = new Int32Array(64);

    public constructor(geometry: BufferGeometry, material: MeshStaticMaterial, slots: number) {
        super(geometry, material);

        (this as any).isPawnCrowdMesh = true;
        (this as any).isBatchedMesh = true; // three submits _multiDrawStarts/_multiDrawCounts through WEBGL_multi_draw for this flag
        (this as any)._colorsTexture = null;
        (this as any)._multiDrawStarts = this.starts;
        (this as any)._multiDrawCounts = this.counts;
        (this as any)._multiDrawCount = 0;
        this.name = "PawnCrowdMesh";
        this.arrays = new Array(slots).fill(null);
        this.references = new Array(slots).fill(0);
        this.frustumCulled = false;
        this.matrixAutoUpdate = false;
        this.renderOrder = 1e6;
    }

    public countMissing(arrays: Set<PawnTextureArray>, textures: Set<Texture>): number {
        let missing = 0, free = 0, missingTextures = 0, freeTextures = 0;

        for (const array of arrays) if (!this.arrays.includes(array)) missing++;
        for (const count of this.references) if (count === 0) free++;
        for (const texture of textures) if (!this.textures.includes(texture)) missingTextures++;
        for (const count of this.textureReferences) if (count === 0) freeTextures++;

        return missing <= free && missingTextures <= freeTextures ? missing + missingTextures : -1;
    }

    public retainTexture(texture: Texture): number {
        let slot = this.textures.indexOf(texture);

        if (slot < 0) {
            slot = this.textureReferences.indexOf(0);
            this.textures[slot] = texture;
        }

        this.textureReferences[slot]++;
        return slot;
    }

    public releaseTexture(texture: Texture): void {
        const slot = this.textures.indexOf(texture);

        if (--this.textureReferences[slot] === 0) this.textures[slot] = null;
    }

    public retainArray(array: PawnTextureArray): number {
        let slot = this.arrays.indexOf(array);

        if (slot < 0) {
            slot = this.references.indexOf(0);
            this.arrays[slot] = array;
        }

        this.references[slot]++;
        return slot;
    }

    public releaseArray(array: PawnTextureArray): void {
        const slot = this.arrays.indexOf(array);

        if (--this.references[slot] === 0) this.arrays[slot] = null;
    }

    public setCapacity(capacity: number): void {
        this.capacity = capacity;
        if (this.starts.length >= capacity) return;

        let length = this.starts.length;
        while (length < capacity) length *= 2;

        (this as any)._multiDrawStarts = this.starts = new Int32Array(length);
        (this as any)._multiDrawCounts = this.counts = new Int32Array(length);
    }
}

export class PawnCrowd extends Object3D {
    public isEnabled: boolean = true;
    protected readonly slots: number;
    protected readonly layerLimit: number;
    protected readonly groups: PawnCrowdMesh[] = [];
    protected readonly entries = new Set<PawnCrowdEntry_T>();
    protected readonly arrJoining: PawnMesh[] = [];
    protected readonly arrJoiningParts: [LitSkinnedMesh, number][] = [];
    protected readonly cacheParts = new Map<LitSkinnedMesh, PawnCrowdPart_T[]>();
    protected readonly cacheRanges = new Map<BufferGeometry, PawnCrowdRange_T>();
    protected readonly cacheLayers = new Map<Texture, PawnCrowdLayer_T>();
    protected readonly arrays = new Map<string, PawnTextureArray[]>();
    protected readonly vertices = new RangeAllocator(1 << 17);
    protected readonly indices = new RangeAllocator(1 << 19);
    protected readonly statics = new RangeAllocator(STATIC_PARTS * 4);
    protected pool: Record<string, Float32Array | Uint16Array> = {};
    protected poolIndex: Uint32Array;
    protected geometry: BufferGeometry;
    protected staticData: Float32Array;
    protected staticTexture: DataTexture;
    protected dynamicData: Float32Array;
    protected dynamicTexture: DataTexture;
    protected lightBase: number = 0;
    protected lightCount: number = 0;
    protected isFlushed: boolean = false;
    protected isLayoutDirty: boolean = false;
    protected isStaticDirty: boolean = false;

    public constructor(renderer: WebGLRenderer) {
        super();

        const gl = renderer.getContext() as WebGL2RenderingContext;

        this.name = "PawnCrowd";
        this.matrixAutoUpdate = false;
        this.slots = Math.min(renderer.capabilities.maxTextures - 4, 28) - PLAIN_SLOTS;
        this.layerLimit = Math.min(gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS), ARRAY_LAYERS);

        for (const [name, size, ArrayType] of arrPoolAttributes) this.pool[name] = new ArrayType(this.vertices.getCapacity() * size);
        this.poolIndex = new Uint32Array(this.indices.getCapacity());
        this.geometry = this.createGeometry();

        this.staticData = new Float32Array(this.statics.getCapacity() * STATIC_TEXELS * 4);
        this.staticTexture = createDataTexture(this.staticData);
        this.dynamicData = new Float32Array(DATA_WIDTH * 16 * 4);
        this.dynamicTexture = createDataTexture(this.dynamicData);
    }

    protected createGeometry(): BufferGeometry {
        const geometry = new BufferGeometry();

        for (const [name, size] of arrPoolAttributes) geometry.setAttribute(name, new BufferAttribute(this.pool[name], size));
        geometry.setIndex(new BufferAttribute(this.poolIndex, 1));
        return geometry;
    }

    protected growPool(vertexCount: number, indexCount: number): void {
        let vertices = this.vertices.getCapacity(), indices = this.indices.getCapacity();

        while (vertices - this.vertices.getCapacity() < vertexCount) vertices *= 2;
        while (indices - this.indices.getCapacity() < indexCount) indices *= 2;

        if (vertices > this.vertices.getCapacity()) {
            for (const [name, size, ArrayType] of arrPoolAttributes) {
                const array = new ArrayType(vertices * size);

                array.set(this.pool[name]);
                this.pool[name] = array;
            }
            this.vertices.grow(vertices);
        }

        if (indices > this.indices.getCapacity()) {
            const index = new Uint32Array(indices);

            index.set(this.poolIndex);
            this.poolIndex = index;
            this.indices.grow(indices);
        }

        this.geometry.dispose();
        this.geometry = this.createGeometry();
        for (const group of this.groups) group.geometry = this.geometry;
    }

    protected retainGeometry(source: BufferGeometry): PawnCrowdRange_T {
        let range = this.cacheRanges.get(source);

        if (range) {
            range.references++;
            return range;
        }

        const vertexCount = source.getAttribute("position").count, indexCount = source.index.count;
        let vertexStart = this.vertices.allocate(vertexCount), indexStart = this.indices.allocate(indexCount);

        if (vertexStart < 0 || indexStart < 0) {
            if (vertexStart >= 0) this.vertices.free(vertexStart, vertexCount);
            if (indexStart >= 0) this.indices.free(indexStart, indexCount);
            this.growPool(vertexStart < 0 ? vertexCount : 0, indexStart < 0 ? indexCount : 0);
            vertexStart = this.vertices.allocate(vertexCount);
            indexStart = this.indices.allocate(indexCount);
        }

        for (const [name, size] of arrPoolAttributes) {
            const attribute = source.getAttribute(name) as BufferAttribute, target = this.geometry.getAttribute(name) as BufferAttribute;

            if (attribute) this.pool[name].set(attribute.array, vertexStart * size);
            else this.pool[name].fill(0, vertexStart * size, (vertexStart + vertexCount) * size);

            target.addUpdateRange(vertexStart * size, vertexCount * size);
            target.needsUpdate = true;
        }

        const index = source.index.array;
        for (let i = 0; i < indexCount; i++) this.poolIndex[indexStart + i] = index[i] + vertexStart;
        this.geometry.index.addUpdateRange(indexStart, indexCount);
        this.geometry.index.needsUpdate = true;

        range = { vertexStart, vertexCount, indexStart, indexCount, references: 1 };
        this.cacheRanges.set(source, range);
        return range;
    }

    protected releaseGeometry(source: BufferGeometry): void {
        const range = this.cacheRanges.get(source)!;

        if (--range.references > 0) return;

        this.vertices.free(range.vertexStart, range.vertexCount);
        this.indices.free(range.indexStart, range.indexCount);
        this.cacheRanges.delete(source);
    }

    protected retainLayer(texture: Texture): PawnCrowdLayer_T {
        let entry = this.cacheLayers.get(texture);

        if (entry) {
            entry.references++;
            return entry;
        }

        const source = texture as CompressedTexture, key = getArrayKey(source);
        let arrays = this.arrays.get(key);

        if (!arrays) this.arrays.set(key, arrays = []);

        for (const array of arrays) {
            const layer = array.allocate(source);

            if (layer >= 0) { entry = { array, layer, references: 1 }; break; }
        }

        if (!entry) {
            const array = new PawnTextureArray(key, source, this.layerLimit);

            arrays.push(array);
            entry = { array, layer: array.allocate(source), references: 1 };
        }

        this.cacheLayers.set(texture, entry);
        return entry;
    }

    protected releaseLayer(texture: Texture): void {
        const entry = this.cacheLayers.get(texture)!;

        if (--entry.references > 0) return;

        entry.array.free(entry.layer);
        this.cacheLayers.delete(texture);
    }

    protected createEntry(textures: Texture[], geometries: BufferGeometry[], drawCapacity: number): PawnCrowdEntry_T {
        if (!textures.every(texture => isArrayable(texture) || isPlain(texture)) || !geometries.every(isPoolable)) return null;

        const layers = textures.map(texture => isArrayable(texture) ? this.retainLayer(texture) : null);
        const arrays = new Set(layers.filter(layer => layer).map(layer => layer.array)), plains = new Set(textures.filter(texture => !isArrayable(texture)));
        let group: PawnCrowdMesh = null, missing = Infinity;

        if (arrays.size > this.slots || plains.size > PLAIN_SLOTS) {
            for (const texture of textures) if (isArrayable(texture)) this.releaseLayer(texture);
            return null;
        }

        for (const candidate of this.groups) {
            const count = candidate.countMissing(arrays, plains);

            if (count >= 0 && count < missing) { group = candidate; missing = count; }
        }

        if (!group) {
            group = new PawnCrowdMesh(this.geometry, createMaterial(this.slots), this.slots);
            group.onBeforeRender = renderer => this.flush(renderer, group);
            this.groups.push(group);
            this.add(group);
        }

        let staticStart = this.statics.allocate(geometries.length);

        if (staticStart < 0) {
            const data = this.staticData;

            this.statics.grow(this.statics.getCapacity() * 2);
            this.staticData = new Float32Array(this.statics.getCapacity() * STATIC_TEXELS * 4);
            this.staticData.set(data);
            this.staticTexture.dispose();
            this.staticTexture = createDataTexture(this.staticData);
            staticStart = this.statics.allocate(geometries.length);
        }

        const entry: PawnCrowdEntry_T = { crowd: this, group, staticStart: staticStart * STATIC_TEXELS, partCount: geometries.length, drawCapacity, textures, maps: layers.map((layer, i) => layer ? group.retainArray(layer.array) * ARRAY_LAYERS + layer.layer : (this.slots + group.retainTexture(textures[i])) * ARRAY_LAYERS), geometries, ranges: geometries.map(geometry => this.retainGeometry(geometry)), materialVersion: -1 };

        group.setCapacity(group.capacity + entry.drawCapacity);
        this.entries.add(entry);
        this.isLayoutDirty = true;
        return entry;
    }

    protected releaseEntry(entry: PawnCrowdEntry_T): void {
        for (const texture of entry.textures) {
            if (!isArrayable(texture)) { entry.group.releaseTexture(texture); continue; }

            entry.group.releaseArray(this.cacheLayers.get(texture)!.array);
            this.releaseLayer(texture);
        }
        for (const geometry of entry.geometries) this.releaseGeometry(geometry);
        this.statics.free(entry.staticStart / STATIC_TEXELS, entry.partCount);
        entry.group.setCapacity(entry.group.capacity - entry.drawCapacity);
        this.entries.delete(entry);
        this.isLayoutDirty = true;
    }

    public unregister(mesh: PawnMesh): void {
        if (mesh.crowdEntry) this.releaseEntry(mesh.crowdEntry);
    }

    public unregisterParts(mesh: LitSkinnedMesh): void {
        const parts = this.cacheParts.get(mesh);

        if (!parts) return;

        for (const part of parts) {
            if (!part) continue;

            this.releaseEntry(part);
            mesh.skeleton.releaseAtlas();
        }
        this.cacheParts.delete(mesh);
        for (let i = this.arrJoiningParts.length - 1; i >= 0; i--)
            if (this.arrJoiningParts[i][0] === mesh) this.arrJoiningParts.splice(i, 1);
    }

    protected registerPart(mesh: LitSkinnedMesh, index: number): void {
        const material = (Array.isArray(mesh.material) ? mesh.material[index] : mesh.material) as MeshStaticMaterial;
        const parts = this.cacheParts.get(mesh);

        parts[index] = null;
        if (!material || !canBatchPawnMaterial(material) || !material.uniforms.actorLights) return;

        const drawCapacity = Array.isArray(mesh.material) ? mesh.geometry.groups.filter(group => group.materialIndex === index).length : 1;
        const part = this.createEntry(getPawnTextures(material).filter(texture => texture), [mesh.geometry], drawCapacity) as PawnCrowdPart_T;

        if (!part) return;

        mesh.skeleton.retainAtlas();
        part.material = material;
        parts[index] = part;
        this.writePartStatic(mesh, part);
    }

    protected updateLayout(): void {
        let base = 0;

        for (const group of this.groups) {
            group.drawBase = base;
            base += group.capacity * DRAW_TEXELS;
        }

        this.lightBase = base;
        this.isLayoutDirty = false;

        const texels = base + base / DRAW_TEXELS * LIGHT_TEXELS;
        let rows = this.dynamicData.length / 4 / DATA_WIDTH;

        if (rows * DATA_WIDTH >= texels) return;
        while (rows * DATA_WIDTH < texels) rows *= 2;

        this.dynamicData = new Float32Array(DATA_WIDTH * rows * 4);
        this.dynamicTexture.dispose();
        this.dynamicTexture = createDataTexture(this.dynamicData);
    }

    public begin(): void {
        this.isFlushed = false;
        this.lightCount = 0;

        for (const mesh of this.arrJoining) {
            if (mesh.crowdEntry !== undefined || !mesh.parent) continue;

            mesh.crowdEntry = this.createEntry(mesh.textures, mesh.parts.map(part => part.mesh.geometry), mesh.parts.length);
        }
        this.arrJoining.length = 0;

        for (const [mesh, index] of this.arrJoiningParts) if (mesh.parent && this.cacheParts.has(mesh)) this.registerPart(mesh, index);
        this.arrJoiningParts.length = 0;

        if (this.isLayoutDirty) this.updateLayout();
        for (const group of this.groups) {
            group.drawCount = 0;
            group.visible = group.capacity > 0;
        }
    }

    protected writeStatic(mesh: PawnMesh, entry: PawnCrowdEntry_T): void {
        const uniforms = (mesh.material as MeshStaticMaterial).uniforms, data = this.staticData;
        const binds = uniforms.pawnBindMatrices.value as Float32Array, inverses = uniforms.pawnBindInverses.value as Float32Array;
        const materials = uniforms.pawnMaterialData.value as Float32Array, bones = uniforms.pawnBoneOffsets.value as Int32Array;

        for (let i = 0; i < mesh.parts.length; i++) {
            const offset = (entry.staticStart + i * STATIC_TEXELS) * 4;

            writeMatrix(data, offset, binds, i * 16);
            writeMatrix(data, offset + 12, inverses, i * 16);
            for (let j = 0; j < 16; j++) data[offset + 24 + j] = materials[i * 16 + j];
            for (let j = 4; j < 8; j++) if (materials[i * 16 + j] >= 0) data[offset + 24 + j] = entry.maps[materials[i * 16 + j]];
            data[offset + 40] = bones[i];
        }

        entry.materialVersion = mesh.materialVersion;
        this.isStaticDirty = true;
    }

    protected writePartStatic(mesh: LitSkinnedMesh, part: PawnCrowdPart_T): void {
        const data = this.staticData, offset = part.staticStart * 4, textures = getPawnTextures(part.material);

        for (let i = 0; i < 4; i++) tmpMaps[i] = textures[i] ? part.maps[part.textures.indexOf(textures[i])] : -1;

        writeMatrix(data, offset, mesh.bindMatrix.elements);
        writeMatrix(data, offset + 12, mesh.bindMatrixInverse.elements);
        packPawnMaterial(part.material, tmpMaps, data, offset + 24);
        data[offset + 38] = 1;
        data[offset + 40] = mesh.skeleton.atlasOffset;
        this.isStaticDirty = true;
    }

    protected writeLights(uniforms: Record<string, THREE.IUniform>, modifier: Vector3): number {
        const data = this.dynamicData, light = this.lightBase + this.lightCount++ * LIGHT_TEXELS, count = uniforms.numActorLights.value as number;
        const ambient = uniforms.actorAmbient.value;
        const positions = uniforms.actorLightPositions.value, directions = uniforms.actorLightDirections.value, colors = uniforms.actorLightColors.value;
        const parameters = uniforms.actorLightParameters.value, attenuations = uniforms.actorLightAttenuations.value;
        let offset = light * 4;

        data[offset] = ambient.r; data[offset + 1] = ambient.g; data[offset + 2] = ambient.b; data[offset + 3] = uniforms.actorScaledGlow.value;
        data[offset + 4] = count; data[offset + 5] = modifier.x; data[offset + 6] = modifier.y; data[offset + 7] = modifier.z;

        for (let i = 0; i < count; i++) {
            offset = (light + 2 + i * 4) * 4;
            data[offset] = positions[i * 3]; data[offset + 1] = positions[i * 3 + 1]; data[offset + 2] = positions[i * 3 + 2]; data[offset + 3] = parameters[i * 4];
            data[offset + 4] = directions[i * 3]; data[offset + 5] = directions[i * 3 + 1]; data[offset + 6] = directions[i * 3 + 2]; data[offset + 7] = parameters[i * 4 + 1];
            data[offset + 8] = colors[i * 3]; data[offset + 9] = colors[i * 3 + 1]; data[offset + 10] = colors[i * 3 + 2]; data[offset + 11] = parameters[i * 4 + 2];
            data[offset + 12] = parameters[i * 4 + 3]; data[offset + 13] = attenuations[i * 2]; data[offset + 14] = attenuations[i * 2 + 1];
        }

        return light;
    }

    protected writeDraw(entry: PawnCrowdEntry_T, index: number, source: LitSkinnedMesh, light: number, start: number, count: number, side: number): void {
        const data = this.dynamicData, group = entry.group, draw = group.drawCount++, normal = source.normalMatrix.elements;
        if (draw >= group.capacity) throw new Error(`Pawn crowd draw capacity exceeded.`);

        const offset = (group.drawBase + draw * DRAW_TEXELS) * 4;

        writeMatrix(data, offset, source.modelViewMatrix.elements);
        writeMatrix(data, offset + 12, source.matrixWorld.elements);
        data[offset + 24] = normal[0]; data[offset + 25] = normal[1]; data[offset + 26] = normal[2];
        data[offset + 28] = normal[3]; data[offset + 29] = normal[4]; data[offset + 30] = normal[5];
        data[offset + 32] = normal[6]; data[offset + 33] = normal[7]; data[offset + 34] = normal[8];
        data[offset + 36] = entry.staticStart + index * STATIC_TEXELS;
        data[offset + 37] = light;
        data[offset + 38] = side;
        group.starts[draw] = (entry.ranges[index].indexStart + start) * 4;
        group.counts[draw] = count;
    }

    public accept(mesh: PawnMesh): boolean {
        if (!this.isEnabled || this.isFlushed) return false;

        const entry = mesh.crowdEntry;

        if (entry === undefined) {
            if (!this.arrJoining.includes(mesh)) this.arrJoining.push(mesh);
            return false;
        }
        if (entry === null) return false;
        if (entry.materialVersion !== mesh.materialVersion) this.writeStatic(mesh, entry);

        const uniforms = (mesh.material as MeshStaticMaterial).uniforms, materials = uniforms.pawnMaterialData.value as Float32Array;
        const light = this.writeLights(uniforms, mesh.actorRenderable.texModifierColor);

        for (let i = 0; i < mesh.parts.length; i++) {
            if (materials[i * 16 + 14] === 0) continue;

            this.writeDraw(entry, i, mesh.parts[i].mesh, light, mesh.parts[i].start, mesh.parts[i].count, materials[i * 16 + 11]);
        }

        return true;
    }

    public acceptPart(mesh: LitSkinnedMesh, material: MeshStaticMaterial, group: THREE.GeometryGroup): boolean {
        if (!this.isEnabled || this.isFlushed || material.transparent) return false;

        const index = group ? group.materialIndex : 0;
        let parts = this.cacheParts.get(mesh);

        if (!parts) this.cacheParts.set(mesh, parts = []);

        const part = parts[index];

        if (part === undefined) {
            parts[index] = null;
            this.arrJoiningParts.push([mesh, index]);
            return false;
        }
        if (part === null || part.material !== material || material.uniforms.texModifierAlpha.value >= 0) return false;

        const start = group ? group.start : 0, count = Math.min(group ? group.count : Infinity, mesh.geometry.index.count - start);

        if (count <= 0) return false;

        const light = this.writeLights(material.uniforms, mesh.actorRenderable ? mesh.actorRenderable.texModifierColor : tmpWhite);

        this.writeDraw(part, 0, mesh, light, start, count, material.side);
        return true;
    }

    protected flush(renderer: WebGLRenderer, group: PawnCrowdMesh): void {
        if (!this.isFlushed) {
            this.isFlushed = true;
            boneAtlas.upload(renderer);
            for (const arrays of this.arrays.values()) for (const array of arrays) array.upload(renderer);
            this.dynamicTexture.needsUpdate = true;
            if (this.isStaticDirty) {
                this.staticTexture.needsUpdate = true;
                this.isStaticDirty = false;
            }
        }

        const material = group.material as MeshStaticMaterial, uniforms = material.uniforms;

        for (let i = 0; i < group.arrays.length; i++) uniforms.pawnArrays.value[i] = group.arrays[i] ? group.arrays[i].texture : null;
        for (let i = 0; i < PLAIN_SLOTS; i++) uniforms.pawnTextures.value[i] = group.textures[i];
        uniforms.pawnBones.value = boneAtlas.getTexture();
        uniforms.pawnCrowdStatic.value = this.staticTexture;
        uniforms.pawnCrowdDynamic.value = this.dynamicTexture;
        uniforms.pawnCrowdDrawBase.value = group.drawBase;
        material.uniformsNeedUpdate = true;
        (group as any)._multiDrawCount = group.drawCount;
    }

    public dispose(): void {
        for (const group of this.groups) (group.material as MeshStaticMaterial).dispose();
        for (const arrays of this.arrays.values()) for (const array of arrays) array.texture.dispose();
        this.geometry.dispose();
        this.staticTexture.dispose();
        this.dynamicTexture.dispose();
    }
}

export default PawnCrowd;
