import type { APackage } from "@l2js/core";
import DecodeLibrary from "@l2js/engine/decode-library";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";
import requestWebLock from "../web-lock";
import { getAssetSourceId } from "../asset-source";
import { capturePackageResolver, packageIdentity, validatePackageResolver, canReleasePackageSource } from "../unreal/package-resolver";
import { queueConvertedAssetRelease } from "../unreal/asset-handle";
import { convertDDSTextureInfo } from "@l2js/engine/dds/dxt-decode";
import DecodeLibraryBuilder from "@l2js/engine/decode-library-builder";
import { hydrateLibraryFile, hydrateLibraryFileSync, type SeekableLibrary_T } from "./library-serializer";
import { loadCachedPackage, getCachedPackageFile, storeCachedPackage, isCacheEnabled } from "./decode-cache";

type PackageEntry_T = { result: any, dependencies: string[], assets: Record<string, Record<string, any>> };
type PackageData_T = { path: string, identity: string, complete: boolean, unsupported?: Record<string, number>, resolver?: any, sourcePixels?: { data: Uint8Array, paletteRed: Uint8Array }[], entries: Record<string, PackageEntry_T> };
type Recording_T = { key: string, uuid: string, dependencies: Set<string>, before: Record<string, Set<string>> };
const materialTypes = new Set(["Texture", "Cubemap", "WetTexture", "Shader", "Combiner", "FinalBlend", "ConstantColor", "FadeColor", "ColorModifier", "TexEnvMap", "TexRotator", "TexOscillator", "TexOscillatorTriggered", "TexCoordSource", "VertexColor", "TexPanner", "StaticMeshMaterial"]);
const assetKeys = ["geometries", "geometryInstances", "materials", "materialModifiers", "sounds", "scriptClasses", "scriptFunctions", "scriptStates", "scriptObjects", "soundBlobCache"];

function dictionary(library: any, key: string): Record<string, any> {
    return key === "soundBlobCache" ? Object.fromEntries(library.soundBlobCache) : library[key];
}

export class PackageCache {
    protected readonly pending = new Map<string, Promise<void>>();
    protected readonly packages = new Map<string, PackageData_T>();
    protected readonly entries = new Map<string, PackageEntry_T>();
    protected readonly owners = new Map<string, string>();
    protected readonly dirty = new Set<string>();
    protected readonly stack: Recording_T[] = [];
    protected readonly used = new WeakMap<DecodeLibrary, Set<string>>();
    protected readonly claimed = new WeakMap<DecodeLibrary, Map<string, string>>();
    protected readonly seekable = new Map<string, SeekableLibrary_T>();
    protected readonly published = new Map<string, SeekableLibrary_T>();
    protected readonly settings: LoadSettings_T;
    public hits = 0;
    public misses = 0;

    public constructor(settings: LoadSettings_T) { this.settings = settings; }

    public isEnabled(): boolean { return isCacheEnabled(this.settings) && this.settings._packageCache !== false; }

    public async open(packages: APackage[]): Promise<void> {
        if (!isCacheEnabled(this.settings) || this.settings._packageCache === false) return;

        await Promise.all(packages.map(async pkg => {
            if (this.packages.has(pkg.path) || !/\.(usx|utx|uax)$/i.test(pkg.path)) return;

            let pending = this.pending.get(pkg.path);
            if (!pending) this.pending.set(pkg.path, pending = this.openPackage(pkg));
            try {
                await pending;
            } finally {
                if (this.pending.get(pkg.path) === pending) this.pending.delete(pkg.path);
            }
        }));
    }

    protected async openPackage(pkg: APackage): Promise<void> {
        if (!pkg.header) return;
        const dependencies = pkg.loader.getDependencies(pkg).filter(path => path !== pkg.loader.getNativePackage().path).map(path => pkg.loader.getPackage(path)).filter(dependency => !!dependency.header);
        const identity = packageIdentity(dependencies);
        const cached = await loadCachedPackage(pkg.path, this.settings);
        const data: PackageData_T = cached && cached.library.complete && cached.library.identity === identity ? cached.library : { path: pkg.path, identity, complete: false, entries: {} };
        if (data === cached?.library) {
            if (typeof (globalThis as any).FileReaderSync === "function") this.seekable.set(pkg.path, cached);
            else await hydrateLibraryFile(cached);
        }

        this.packages.set(pkg.path, data);
        for (const [key, entry] of Object.entries(data.entries)) {
            this.entries.set(key, entry);
            this.owners.set(key, pkg.path);
        }
    }

    public async build(packages: APackage[]): Promise<void> {
        if (!isCacheEnabled(this.settings) || this.settings._packageCache === false) return;
        packages = packages.filter(pkg => /\.(usx|utx|uax)$/i.test(pkg.path) && !!pkg.exportGroups && Object.keys(pkg.exportGroups).some(kind => kind === "StaticMesh" || kind === "Sound" || materialTypes.has(kind)));
        if (packages.every(pkg => !this.packages.has(pkg.path) || this.packages.get(pkg.path).complete)) return;
        await requestWebLock(`package-conversion:${getAssetSourceId()}`, async () => {
            for (const pkg of packages) if (!this.packages.get(pkg.path)?.complete) this.packages.delete(pkg.path);
            await this.open(packages);
            for (const pkg of packages) {
                const data = this.packages.get(pkg.path);
                if (!data || data.complete) continue;
                data.unsupported = {};
                let count = 0;
                const converted = new Set<number>();
                for (const [kind, entries] of Object.entries(pkg.exportGroups)) {
                    if (kind !== "StaticMesh" && kind !== "Sound" && !materialTypes.has(kind)) {
                        data.unsupported[kind] = entries.length;
                        continue;
                    }
                    for (const entry of entries) {
                        const library = new DecodeLibrary();
                        const builder = new DecodeLibraryBuilder(library, this.settings, this);
                        try {
                            const object = pkg.fetchObject(entry.index + 1);
                            if (kind === "StaticMesh") builder.pullStaticMesh(object as any);
                            else if (kind === "Sound") builder.pullSound(object as any);
                            else builder.pullMaterial(object as any);
                        } catch (error) {
                            throw new Error(`Package '${pkg.path}', export '${pkg.getObjectPath(entry.export)}' (${kind}, #${entry.index + 1}, ${entry.export.size} bytes): ${error.message}`, { cause: error });
                        }
                        const cacheKind = kind === "StaticMesh" ? "mesh" : kind === "Sound" ? "sound" : "material";
                        if (!data.entries[`${pkg.path}:${entry.index}:${cacheKind}`]) throw new Error(`Package '${pkg.path}' export '${entry.export.objectName}' has no converted entry.`);
                        converted.add(entry.index);
                        count++;
                        if (count % 16 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
                    }
                }
                data.resolver = capturePackageResolver(pkg, converted);
                if (!data.resolver.rawSafe) {
                    (pkg as any).requiresRawDependencies = true;
                    await (pkg.loader as any).retainPackageSources(pkg);
                }
                data.complete = true;
                if (count) this.dirty.add(pkg.path);
            }
            await this.flush();
            for (const pkg of packages) if (this.packages.get(pkg.path)?.complete && !(pkg as any).keepRawSource) (pkg as any).rawOnly = false;
        });
    }

    public key(object: any, kind: string): string | null { return object.pkg && this.packages.has(object.pkg.path) && object.exportIndex !== null && object.exportIndex !== undefined && object.exportIndex >= 0 ? `${object.pkg.path}:${object.exportIndex}:${kind}` : null; }

    public read(object: any, kind: string, library: DecodeLibrary): any {
        const key = this.key(object, kind);
        if (!key) return undefined;
        const parent = this.stack[this.stack.length - 1];
        if (parent) parent.dependencies.add(key);
        if (!this.entries.has(key)) { this.misses++; return undefined; }
        if (!this.used.get(library)?.has(key) && !this.available(key, new Set())) { this.misses++; return undefined; }

        this.restore(key, library);
        this.hits++;
        return this.entries.get(key).result;
    }

    public readTextureFrame(object: any, library: DecodeLibrary): any {
        const result = this.read(object, "frame", library);
        if (!result) return null;
        const seekable = this.seekable.get(object.pkg.path);
        if (seekable) hydrateLibraryFileSync(seekable, result.info);
        return { info: { ...result.info }, next: result.next ? object.pkg.loader.getPackage(result.next.path).fetchObject(result.next.index + 1) : null };
    }

    public readTextureSource(object: any, pixels: boolean = true): any {
        const key = this.key(object, "material");
        const entry = key ? this.entries.get(key) : null;
        if (!entry || !entry.result.source) return null;
        const source = entry.result.source;
        const owner = this.owners.get(key);
        const stored = source.pixelIndex === undefined ? source : this.packages.get(owner).sourcePixels[source.pixelIndex];
        if (!stored) throw new Error(`Missing source pixels for '${key}'.`);
        const seekable = this.seekable.get(owner);
        if (seekable && pixels) hydrateLibraryFileSync(seekable, stored);
        return { ...source, data: stored.data, paletteRed: stored.paletteRed };
    }

    protected available(key: string, seen: Set<string>): boolean {
        if (seen.has(key)) return true;
        seen.add(key);
        const entry = this.entries.get(key);
        return !!entry && entry.dependencies.every(dependency => this.available(dependency, seen));
    }

    protected restore(key: string, library: DecodeLibrary): void {
        let used = this.used.get(library);
        if (!used) this.used.set(library, used = new Set());
        if (used.has(key)) return;
        used.add(key);
        const entry = this.entries.get(key);
        const seekable = this.seekable.get(this.owners.get(key));
        if (seekable) hydrateLibraryFileSync(seekable, entry.assets);
        let claimed = this.claimed.get(library);
        if (!claimed) this.claimed.set(library, claimed = new Map());
        for (const dependency of entry.dependencies) this.restore(dependency, library);
        for (const [name, assets] of Object.entries(entry.assets)) for (const [uuid, value] of Object.entries(assets)) {
            if (name === "soundBlobCache") library.soundBlobCache.set(uuid, { ...value, uri: null });
            else (library as any)[name][uuid] = name === "materials" ? { ...value } : value;
            claimed.set(`${name}:${uuid}`, key);
        }
    }

    public addMaterialDependency(uuid: string, library: DecodeLibrary): void {
        if (!uuid) return;
        const recording = this.stack[this.stack.length - 1];
        if (!recording) return;
        const owner = this.claimed.get(library)?.get(`materials:${uuid}`);
        if (owner) { recording.dependencies.add(owner); return; }
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const parent = this.stack[i];
            if (parent.uuid === uuid && parent.key?.endsWith(":material")) { recording.dependencies.add(parent.key); return; }
        }
    }

    public begin(object: any, kind: string, library: DecodeLibrary): void {
        const before: Record<string, Set<string>> = {};
        for (const name of assetKeys) before[name] = new Set(Object.keys(dictionary(library, name)));
        this.stack.push({ key: this.key(object, kind), uuid: object.uuid, dependencies: new Set(), before });
    }

    public end(object: any, library: DecodeLibrary, result: any): void {
        const recording = this.stack.pop();
        if (!recording.key) {
            const parent = this.stack[this.stack.length - 1];
            if (parent) for (const key of recording.dependencies) parent.dependencies.add(key);
            return;
        }
        const data = this.packages.get(object.pkg.path);
        if (!data || data.complete) return;
        const previous = recording.key.endsWith(":frame") ? this.entries.get(recording.key) : null;
        const assets: PackageEntry_T["assets"] = previous ? Object.fromEntries(Object.entries(previous.assets).map(([name, values]) => [name, { ...values }])) : {};
        let claimed = this.claimed.get(library);
        if (!claimed) this.claimed.set(library, claimed = new Map());
        for (const name of assetKeys) {
            for (const [uuid, value] of Object.entries(dictionary(library, name))) {
                if (recording.before[name].has(uuid) || claimed.has(`${name}:${uuid}`)) continue;
                if (!assets[name]) assets[name] = {};
                assets[name][uuid] = name === "soundBlobCache" ? { ...value, uri: null } : name === "materials" ? { ...value } : value;
                claimed.set(`${name}:${uuid}`, recording.key);
            }
        }
        const entry = { result, dependencies: [...recording.dependencies], assets };
        data.entries[recording.key] = entry;
        this.entries.set(recording.key, entry);
        this.owners.set(recording.key, object.pkg.path);
        let used = this.used.get(library);
        if (!used) this.used.set(library, used = new Set());
        used.add(recording.key);
        this.dirty.add(object.pkg.path);
    }

    public async externalize(library: DecodeLibrary): Promise<any> {
        const claimed = this.claimed.get(library);
        if (!claimed) return library;
        const stored: any = { ...library };
        for (const name of assetKeys) stored[name] = name === "soundBlobCache" ? new Map(library.soundBlobCache) : { ...(library as any)[name] };
        for (const [id, entryKey] of claimed) {
            const separator = id.indexOf(":");
            const name = id.slice(0, separator), uuid = id.slice(separator + 1);
            const path = this.owners.get(entryKey);
            const data = this.packages.get(path);
            if (!data.complete) continue;
            const value = name === "soundBlobCache" ? stored[name].get(uuid) : stored[name][uuid];
            if (!value || typeof value !== "object") continue;
            const base = this.entries.get(entryKey).assets[name][uuid];
            const overrides: Record<string, any> = {};
            const rgba: number[] = [];
            let compared = value;
            if (name === "materials") {
                const textures = value.materialType === "sprite" ? value.sprites : [value];
                const originals = base.materialType === "sprite" ? base.sprites : [base];
                const copies = textures.map((texture, index) => {
                    if (texture.textureType !== "rgba" || originals[index]?.textureType !== "dds") return texture;
                    rgba.push(index);
                    return { ...texture, buffer: originals[index].buffer };
                });
                compared = value.materialType === "sprite" ? { ...value, sprites: copies } : copies[0];
            }
            for (const key of Object.keys(compared)) if (!equalAsset(compared[key], base[key])) overrides[key] = compared[key];
            if (value.materialType === "sprite" && overrides.sprites) overrides.sprites = value.sprites.map((texture, index) => {
                const changes: Record<string, any> = {};
                for (const key of Object.keys(texture)) {
                    if (key === "buffer" && rgba.includes(index)) continue;
                    if (!equalAsset(texture[key], base.sprites[index][key])) changes[key] = texture[key];
                }
                return changes;
            });
            const reference = { isPackageAssetReference: true, path, identity: data.identity, entry: entryKey, name, uuid, overrides, rgba };
            let cached = this.published.get(path);
            if (!cached) {
                cached = await loadCachedPackage(path, this.settings);
                if (!cached || cached.library.identity !== data.identity) throw new Error(`Package '${path}' changed while storing '${library.name}'.`);
                this.published.set(path, cached);
            }
            (reference as any).plan = makePackageAssetPlan(cached, cached.library.entries[entryKey].assets[name][uuid]);
            if (name === "soundBlobCache") stored[name].set(uuid, reference);
            else stored[name][uuid] = reference;
        }
        return stored;
    }

    public async flush(): Promise<void> {
        for (const path of this.dirty) {
            const data = this.packages.get(path);
            if (!data.complete) continue;
            await storeCachedPackage(path, this.settings, data);
            const stored = await loadCachedPackage(path, this.settings);
            if (!stored?.library.complete || stored.library.identity !== data.identity || !stored.library.resolver) throw new Error(`Package '${path}' was not durably published.`);
            validatePackageResolver(stored.library);
            this.published.set(path, stored);
            if (await canReleasePackageSource(stored.library)) queueConvertedAssetRelease(path, this.settings, data.identity);
        }
        this.dirty.clear();
    }
}

export default PackageCache;

function equalAsset(a: any, b: any): boolean {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    if (a instanceof ArrayBuffer || b instanceof ArrayBuffer || ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
        if (a.constructor !== b.constructor || a.byteLength !== b.byteLength) return false;
        const left = a instanceof ArrayBuffer ? new Uint8Array(a) : new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
        const right = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
        for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
        return true;
    }
    if (a instanceof Blob || b instanceof Blob) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => equalAsset(a[key], b[key]));
}

function makePackageAssetPlan(cached: SeekableLibrary_T, asset: any): any {
    const chunks = [], copied = new Map();

    function copy(value: any): any {
        if (!value || typeof value !== "object") return value;
        if (copied.has(value)) return copied.get(value);
        if (value.isLibraryChunk) {
            const chunk = { index: value.index, kind: value.kind, byteLength: value.byteLength, offset: cached.entries[value.index].offset };
            copied.set(value, chunk);
            chunks.push(chunk);
            return chunk;
        }
        const result: any = Array.isArray(value) ? [] : value instanceof Map ? new Map() : value instanceof Set ? new Set() : {};
        copied.set(value, result);
        if (value instanceof Map) for (const [key, entry] of value) result.set(copy(key), copy(entry));
        else if (value instanceof Set) for (const entry of value) result.add(copy(entry));
        else for (const key of Object.keys(value)) result[key] = copy(value[key]);
        return result;
    }

    return { size: cached.file.size, modified: (cached.file as File).lastModified, asset: copy(asset), chunks };
}

export async function restorePackageAssets(library: any, settings: LoadSettings_T, prepareAsset: (value: any, name: string, uuid: string) => any = null, buffers: Set<ArrayBuffer> = null): Promise<boolean> {
    const packages = new Map<string, { identity: string, references: { name: string, uuid: string, reference: any }[] }>();
    for (const name of assetKeys) {
        const assets = name === "soundBlobCache" ? library[name] : Object.entries(library[name] || {});
        if (!assets) continue;
        for (const [uuid, reference] of assets) {
            if (!reference?.isPackageAssetReference) continue;
            let group = packages.get(reference.path);
            if (!group) packages.set(reference.path, group = { identity: reference.identity, references: [] });
            if (group.identity !== reference.identity) throw new Error(`Conflicting package identities for '${reference.path}'.`);
            group.references.push({ name, uuid, reference });
        }
    }

    for (const [path, group] of packages) {
        const planned = group.references.every(({ reference }) => !!reference.plan);
        const file = planned ? await getCachedPackageFile(path, settings) : null;
        const usePlan = file && group.references.every(({ reference }) => reference.plan.size === file.size && reference.plan.modified === file.lastModified);
        const seekable: SeekableLibrary_T = usePlan ? { file, library: null, entries: [], values: new Map() } : await loadCachedPackage(path, settings);
        if (!seekable || !usePlan && (!seekable.library.complete || seekable.library.identity !== group.identity)) return false;
        const conversions: { target: any, source: any }[] = [];
        const roots = group.references.map(({ name, uuid, reference }) => {
            let base;
            if (usePlan) {
                base = reference.plan.asset;
                for (const chunk of reference.plan.chunks) {
                    if (!Number.isSafeInteger(chunk.index) || chunk.index < 0 || !Number.isSafeInteger(chunk.offset) || chunk.offset < 0 || !Number.isSafeInteger(chunk.byteLength) || chunk.byteLength < 0 || chunk.offset + chunk.byteLength > file.size)
                        throw new Error(`Invalid package chunk '${path}:${chunk.index}'.`);
                    const entry = seekable.entries[chunk.index];
                    if (entry && (entry.offset !== chunk.offset || entry.length !== chunk.byteLength)) throw new Error(`Conflicting package chunk '${path}:${chunk.index}'.`);
                    seekable.entries[chunk.index] = { offset: chunk.offset, length: chunk.byteLength };
                    chunk.isLibraryChunk = true;
                }
            } else {
                const entry = seekable.library.entries[reference.entry];
                if (!entry || !(uuid in entry.assets[name])) throw new Error(`Missing package asset '${reference.entry}:${name}:${uuid}'.`);
                base = entry.assets[name][uuid];
            }
            let value = { ...base, ...reference.overrides };
            if (base.materialType === "sprite" && reference.overrides.sprites) value.sprites = base.sprites.map((texture, index) => ({ ...texture, ...reference.overrides.sprites[index] }));
            if (reference.rgba?.length) {
                if (value.materialType === "sprite") value.sprites = value.sprites.map(texture => ({ ...texture }));
                const textures = value.materialType === "sprite" ? value.sprites : [value];
                for (const index of reference.rgba) textures[index].buffer = { isPackageRGBATexture: true, byteLength: textures[index].width * textures[index].height * 4 };
            }
            value = prepareAsset ? prepareAsset(value, name, uuid) : value;
            if (value && reference.rgba?.length) {
                const textures = value.materialType === "sprite" ? value.sprites : [value];
                const originals = base.materialType === "sprite" ? base.sprites : [base];
                for (const index of reference.rgba) {
                    const texture = textures[index];
                    if (!texture.buffer?.isPackageRGBATexture) continue;
                    texture.buffer = null;
                    conversions.push({ target: texture, source: { ...originals[index] } });
                }
            }
            return value;
        });
        await hydrateLibraryFile(seekable, [roots, conversions.map(conversion => conversion.source)]);
        for (const conversion of conversions) {
            if (!convertDDSTextureInfo(conversion.source)) throw new Error(`Package RGBA conversion failed for '${conversion.source.name}'.`);
            conversion.target.buffer = conversion.source.buffer;
            if (buffers) buffers.add(conversion.target.buffer);
        }
        if (buffers)
            for (const value of seekable.values.values()) buffers.add(ArrayBuffer.isView(value) ? value.buffer as ArrayBuffer : value);
        for (let i = 0; i < group.references.length; i++) {
            const { name, uuid } = group.references[i];
            if (name === "soundBlobCache") library[name].set(uuid, roots[i]);
            else library[name][uuid] = roots[i];
        }
    }
    return true;
}
