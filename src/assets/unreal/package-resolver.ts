import { BufferValue, ObjectFlags_T, UExport, UImport, UName, type APackage } from "@l2js/core";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";
import { isAssetSourceRetained } from "./asset-handle";
import { getAssetFiles, getServedAssets, isServedAsset } from "../asset-source";
import { loadCachedPackage } from "../decode-worker/decode-cache";
import { hydrateLibraryFile, hydrateLibraryFileSync, type SeekableLibrary_T } from "../decode-worker/library-serializer";

export function packageIdentity(packages: APackage[]): string {
    return JSON.stringify(packages.filter(pkg => !!pkg.header).map(pkg => ({ path: pkg.path, version: pkg.header.version, guid: Array.from(new Uint8Array(pkg.header.guid.bytes.buffer, pkg.header.guid.bytes.byteOffset, pkg.header.guid.bytes.byteLength)), exports: pkg.header.exportCount, imports: pkg.header.importCount, generations: pkg.header.generations })).sort((a, b) => a.path.localeCompare(b.path)));
}

function isPackageFallback(pkg: APackage, entry: any): boolean {
    const kind = pkg.getPackageName(entry.idClass);
    if (kind === "Palette") return true;
    if (kind !== "Package" || entry._flags & ObjectFlags_T.RF_HasStack) return false;
    const cursor = pkg.asReadable();
    cursor.seek(entry.offset, "set");
    const name = cursor.read("compat32");
    return pkg.nameTable[name]?.name === "None" && cursor.tell() === entry.offset + entry.size;
}

export function capturePackageResolver(pkg: APackage, converted: Set<number>): any {
    const header = { ...pkg.header, generations: pkg.header.generations.map(generation => ({ exportCount: generation.exportCount, nameCount: generation.nameCount })), guid: Array.from(new Uint8Array(pkg.header.guid.bytes.buffer, pkg.header.guid.bytes.byteOffset, pkg.header.guid.bytes.byteLength)) };
    const exports = pkg.exports.map(entry => ({ ...entry, object: null }));
    const bodies = [];
    const rawSafe = exports.every(entry => !entry.size || converted.has(entry.index) || isPackageFallback(pkg, entry));
    for (const entry of exports) {
        if (!entry.size || converted.has(entry.index) || !isPackageFallback(pkg, entry)) continue;
        const data = new Uint8Array(entry.size + 4);
        const bytes = pkg.readPrimitive(entry.offset, entry.size);
        data.set(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
        bodies.push({ index: entry.index, data });
    }
    return { header, exports, rawSafe, converted: [...converted], imports: pkg.imports.map(entry => ({ ...entry })), names: pkg.nameTable.map(entry => ({ ...entry })), size: Math.max(...exports.filter(entry => entry.size > 0).map(entry => entry.offset + entry.size), 0) + 4, bodies };
}

export function validatePackageResolver(data: any): void {
    const resolver = data.resolver;
    if (!data.complete || !resolver || resolver.exports.length < resolver.header.exportCount || resolver.imports.length < resolver.header.importCount || resolver.names.length < resolver.header.nameCount || resolver.header.guid.length !== 16)
        throw new Error(`Incomplete resolver tables for '${data.path}'.`);
    const converted = new Set(resolver.converted);
    const entries = new Set(Object.keys(data.entries).filter(key => !key.endsWith(":frame")).map(key => key.slice(0, key.lastIndexOf(":"))));
    const bodies = new Map(resolver.bodies.map(body => [body.index, body]));
    for (const entry of resolver.exports) {
        if (!entry.size) continue;
        if (converted.has(entry.index)) {
            if (!entries.has(`${data.path}:${entry.index}`)) throw new Error(`Missing converted export '${data.path}:${entry.index}'.`);
            if (data.entries[`${data.path}:${entry.index}:material`]?.result.source && !data.entries[`${data.path}:${entry.index}:frame`]) throw new Error(`Missing physical texture frame '${data.path}:${entry.index}'.`);
        } else if (resolver.rawSafe && (bodies.get(entry.index) as any)?.data?.byteLength !== entry.size + 4)
            throw new Error(`Missing fallback export '${data.path}:${entry.index}'.`);
    }
}

export async function canReleasePackageSource(data: any): Promise<boolean> {
    if (!data.complete || data.resolver?.rawSafe !== true || !(isServedAsset(data.path) ? !!getServedAssets().version : !!getAssetFiles())) return false;
    return !await isAssetSourceRetained(data.path);
}

export async function restorePackageResolver(pkg: APackage, settings: LoadSettings_T): Promise<any> {
    if (!/\.(usx|utx|uax)$/i.test(pkg.path)) return null;
    const cached = await loadCachedPackage(pkg.path, settings);
    if (!cached || !cached.library.complete || !cached.library.resolver) return null;
    const data = cached.library;
    if (data.path !== pkg.path) throw new Error(`Package resolver path mismatch: '${data.path}' / '${pkg.path}'.`);
    if (data.resolver.rawSafe === false) (pkg as any).requiresRawDependencies = true;
    if (!await canReleasePackageSource(data)) return null;
    const resolver = data.resolver;
    validatePackageResolver(data);
    if (typeof (globalThis as any).FileReaderSync !== "function") await hydrateLibraryFile(cached, resolver.bodies);
    const prototype = pkg.loader.getEnginePackage().header;
    if (!prototype) throw new Error(`Engine must be loaded before package resolver '${pkg.path}'.`);
    const header = Object.assign(Object.create(Object.getPrototypeOf(prototype)), resolver.header);
    header.guid = new BufferValue(BufferValue.guid);
    new Uint8Array(header.guid.bytes.buffer, header.guid.bytes.byteOffset, header.guid.bytes.byteLength).set(resolver.header.guid);
    pkg.header = header;
    pkg.exports = resolver.exports.map(entry => Object.assign(new UExport(), entry, { object: null }));
    pkg.imports = resolver.imports.map(entry => Object.assign(new UImport(), entry));
    pkg.nameTable = resolver.names.map(entry => Object.assign(new UName(), entry));
    pkg.nameHash = new Map(pkg.nameTable.map((entry, index) => [entry.name, index]));
    pkg.exportGroups = {};
    pkg.exports.forEach((entry, index) => {
        const kind = pkg.getPackageName(entry.idClass) || "Class";
        if (!pkg.exportGroups[kind]) pkg.exportGroups[kind] = [];
        pkg.exportGroups[kind].push({ index, export: entry });
    });
    pkg.importGroups = {};
    pkg.imports.forEach((entry, index) => {
        if (!pkg.importGroups[entry.className]) pkg.importGroups[entry.className] = [];
        pkg.importGroups[entry.className].push({ index: -index - 1, import: entry });
    });
    return { identity: data.identity, version: settings.cache === false ? 0 : settings.cache?.version ?? 0, source: new PackageExportSource(pkg, cached), cache: cached };
}

class PackageExportSource {
    public readonly size: number;
    protected readonly pkg: APackage;
    protected readonly cached: SeekableLibrary_T;
    protected readonly bodies: Map<number, any>;

    public constructor(pkg: APackage, cached: SeekableLibrary_T) {
        this.pkg = pkg;
        this.cached = cached;
        this.size = cached.library.resolver.size;
        this.bodies = new Map(cached.library.resolver.bodies.map(body => [body.index, body]));
    }

    public read(offset: number, length: number): DataView {
        const window = this.readWindow(offset, length);
        return new DataView(window.view.buffer, window.view.byteOffset + offset - window.offset, length);
    }

    public readWindow(offset: number, length: number): { offset: number, view: DataView } {
        const entry = this.pkg.exports.find(entry => entry.size > 0 && offset >= entry.offset && offset < entry.offset + entry.size && offset + length <= entry.offset + entry.size + 4);
        const body = entry ? this.bodies.get(entry.index) : null;
        if (!body) throw new Error(`Unexpected raw read in converted package '${this.pkg.path}', export '${entry?.objectName}', ${offset}+${length}.`);
        if (body.data.isLibraryChunk) hydrateLibraryFileSync(this.cached, body);
        return { offset: entry.offset, view: new DataView(body.data.buffer, body.data.byteOffset, body.data.byteLength) };
    }

    public getMemorySize(): number {
        const buffers = new Set<ArrayBuffer>();
        for (const value of this.cached.values.values()) buffers.add(ArrayBuffer.isView(value) ? value.buffer as ArrayBuffer : value);
        let size = 0;
        for (const buffer of buffers) size += buffer.byteLength;
        return size;
    }

    public decrypt(): void { throw new Error(`Decoded package exports cannot be decrypted.`); }
    public close(): void { }
}
