import { FORMAT_VERSION, serializeLibrary, serializeLibraryBlob, serializeLibraryParts, isSerializedLibrary, openLibraryFile, hydrateLibraryFile, type LibraryBytes_T, type SeekableLibrary_T } from "./library-serializer";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";
import { getAssetSourceId } from "../asset-source";
import { openAssetCatalog, storeAssetCatalog } from "./asset-catalog";
import { restorePackageAssets } from "./package-cache";
import requestWebLock from "../web-lock";
import { startLoadingStep } from "../../loading-profile";
import { isFirefox } from "../../browser";

const CACHE_TTL_DAYS = 7;
const CACHE_DIR = "decode-cache";
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

export function isCacheEnabled(settings: LoadSettings_T): boolean {
    return !!globalThis.isSecureContext && !!navigator.storage?.getDirectory && (settings.cache === false ? false : settings.cache?.enabled ?? true);
}

function getCacheVersion(settings: LoadSettings_T): number {
    return settings.cache === false ? 0 : settings.cache?.version ?? 0;
}

function hashSettings(settings: LoadSettings_T): string {
    const json = JSON.stringify({ ...settings, formatVersion: FORMAT_VERSION, scriptVersion: 14, packageVersion: 8, loadExtendedBoneInfluences: settings.loadExtendedBoneInfluences !== false, cache: undefined, textures: undefined, rgbaTextures: settings.rgbaTextures !== false, decodeWorkerPoolSize: undefined });
    let hash = 5381;

    for (let i = 0; i < json.length; i++)
        hash = ((hash * 33) ^ json.charCodeAt(i)) >>> 0;

    return hash.toString(16).padStart(8, "0");
}

function isAssetCatalog(sectorName: string): boolean {
    return ["npc_runtime", "skill_visuals", "effect_templates", "character_effects", "character_sounds", "character_equipment", "character_parts"].includes(sectorName);
}

function cacheFileName(sectorName: string, settings: LoadSettings_T): string {
    return `${sectorName}.v${getCacheVersion(settings)}.${hashSettings(settings)}${isAssetCatalog(sectorName) ? ".a1" : /^\d+_\d+$/.test(sectorName) ? ".p1" : ""}.bin`;
}

async function getCacheDir(create: boolean): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();

    const dir = await root.getDirectoryHandle(CACHE_DIR, { create });

    return dir.getDirectoryHandle(getAssetSourceId(), { create });
}

async function getCachedFile(sectorName: string, settings: LoadSettings_T): Promise<File | null> {
    if (!isCacheEnabled(settings)) return null;

    try {
        const dir = await getCacheDir(false);
        const handle = await dir.getFileHandle(cacheFileName(sectorName, settings));
        const file = await handle.getFile();

        if (Date.now() - file.lastModified > CACHE_TTL_MS) {
            try { await dir.removeEntry(handle.name); } catch (e) { }
            return null;
        }

        if (!isAssetCatalog(sectorName) && !isSerializedLibrary(await file.slice(0, 5).arrayBuffer())) {
            try { await dir.removeEntry(handle.name); } catch (e) { }
            return null;
        }

        return file;
    } catch (e) {
        if (!(e instanceof DOMException && e.name === "NotFoundError"))
            console.warn(`[decode-cache] failed to inspect cached sector '${sectorName}', re-decoding:`, e);

        return null;
    }
}

export async function hasCachedLibrary(sectorName: string, settings: LoadSettings_T): Promise<boolean> {
    return (await getCachedFile(sectorName, settings)) !== null;
}

export async function loadCachedLibrary(sectorName: string, settings: LoadSettings_T): Promise<any | null> {
    const seekable = await openCachedLibrary(sectorName, settings);

    if (!seekable) return null;

    try {
        return await hydrateLibraryFile(seekable);
    } catch (e) {
        console.warn(`[decode-cache] failed to read cached sector '${sectorName}', re-decoding:`, e);
        return null;
    }
}

export async function openCachedLibrary(sectorName: string, settings: LoadSettings_T, preparePackageAsset: (value: any, name: string, uuid: string) => any = null): Promise<SeekableLibrary_T | null> {
    if (!isCacheEnabled(settings)) return null;

    return requestWebLock(cacheFileName(sectorName, settings), async () => {
        const file = await getCachedFile(sectorName, settings);

        if (!file) return null;

        try {
            const seekable = isAssetCatalog(sectorName) ? await openAssetCatalog(file) : await openLibraryFile(file);
            seekable.packageBuffers = new Set();
            if (!await restorePackageAssets(seekable.library, settings, preparePackageAsset, seekable.packageBuffers)) return null;
            return seekable;
        } catch (e) {
            if (isAssetCatalog(sectorName)) {
                const dir = await getCacheDir(false);

                await dir.removeEntry(cacheFileName(sectorName, settings));
            }
            console.warn(`[decode-cache] failed to open cached sector '${sectorName}', re-decoding:`, e);
            return null;
        }
    });
}

export async function loadCachedLibraryBuffer(sectorName: string, settings: LoadSettings_T): Promise<ArrayBuffer | null> {
    const file = await getCachedFile(sectorName, settings);

    return file ? file.arrayBuffer() : null;
}

export async function readCachedLibrary<T>(sectorName: string, settings: LoadSettings_T, read: (file: File) => Promise<T>): Promise<T> {
    return requestWebLock(cacheFileName(sectorName, settings), async () => {
        const file = await getCachedFile(sectorName, settings);

        if (!file) throw new Error(`Missing cached library '${sectorName}'.`);

        return read(file);
    }, { mode: "shared" });
}

export function storeCachedLibrary(sectorName: string, settings: LoadSettings_T, library: any): void {
    if (!isCacheEnabled(settings)) return;

    let bytes: Uint8Array;

    try {
        bytes = serializeLibrary(library);
    } catch (e) {
        console.warn(`[decode-cache] sector '${sectorName}' is not cacheable:`, e);
        return;
    }

    void writeCacheFileSafe(cacheFileName(sectorName, settings), sectorName, bytes);
}

export async function storeCachedLibraryDurable(sectorName: string, settings: LoadSettings_T, library: any, seekable: SeekableLibrary_T = null): Promise<number> {
    if (!isCacheEnabled(settings)) return 0;
    const finish = startLoadingStep("cache", sectorName);
    try {

        if (isAssetCatalog(sectorName)) {
            const dir = await getCacheDir(true);
            const handle = await dir.getFileHandle(cacheFileName(sectorName, settings), { create: true });

            return await requestWebLock(cacheFileName(sectorName, settings), () => storeAssetCatalog(handle, library.entries, seekable));
        }

        return await requestWebLock(cacheFileName(sectorName, settings), async () => {
            if ((sectorName === "npc_npcs" || sectorName === "npc_monsters" || /^character_\d+_/.test(sectorName)) && await getCachedFile(sectorName, settings)) return 0;

            const bytes = isFirefox ? serializeLibraryParts(library, seekable) : serializeLibraryBlob(library, seekable);

            await writeCacheFile(cacheFileName(sectorName, settings), sectorName, bytes, seekable);

            return bytes instanceof Blob ? bytes.size : bytes.byteLength;
        });
    } finally {
        finish();
    }
}

export async function storeCachedLibraryBufferDurable(sectorName: string, settings: LoadSettings_T, buffer: ArrayBuffer): Promise<void> {
    if (!isCacheEnabled(settings)) return;

    await writeCacheFile(cacheFileName(sectorName, settings), sectorName, new Uint8Array(buffer));
}

async function writeCacheFile(fileName: string, sectorName: string, bytes: Uint8Array | Blob | LibraryBytes_T, seekable: SeekableLibrary_T = null): Promise<void> {
    const dir = await getCacheDir(true);
    const temporaryName = `${fileName}.tmp`;

    if (seekable) {
        const temporary = await dir.getFileHandle(temporaryName, { create: true });
        const writable = await temporary.createWritable();

        await writeCacheBytes(writable, bytes);
        await writable.close();
        if (typeof (temporary as any).move === "function") {
            await (temporary as any).move(fileName);
            return;
        }
        bytes = await temporary.getFile();
    }

    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();

    await writeCacheBytes(writable, bytes);
    await writable.close();
    if (seekable) await dir.removeEntry(temporaryName);

    console.log(`[decode-cache] cached sector '${sectorName}' (${((bytes instanceof Blob ? bytes.size : bytes.byteLength) / 1024 / 1024).toFixed(1)} MB)`);
}

async function writeCacheBytes(writable: FileSystemWritableFileStream, bytes: Uint8Array | Blob | LibraryBytes_T): Promise<void> {
    if ("parts" in bytes) {
        const buffer = new Uint8Array(Math.min(bytes.byteLength, 4 * 1024 * 1024));
        let used = 0;

        for (const part of bytes.parts) {
            const size = part instanceof Blob ? part.size : part.byteLength;

            for (let offset = 0; offset < size;) {
                const length = Math.min(size - offset, buffer.length - used);
                const value = part instanceof Blob ? new Uint8Array(await part.slice(offset, offset + length).arrayBuffer()) : part.subarray(offset, offset + length);

                buffer.set(value, used);
                used += length;
                offset += length;
                if (used === buffer.length) {
                    await writable.write(buffer);
                    used = 0;
                }
            }
        }

        if (used) await writable.write(buffer.subarray(0, used));
        return;
    }

    if (bytes instanceof Blob && isFirefox) {
        for (let offset = 0; offset < bytes.size; offset += 4 * 1024 * 1024)
            await writable.write(await bytes.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer());
        return;
    }

    await writable.write(bytes);
}

async function writeCacheFileSafe(fileName: string, sectorName: string, bytes: Uint8Array): Promise<void> {
    try {
        await writeCacheFile(fileName, sectorName, bytes);
    } catch (e) {
        console.warn(`[decode-cache] failed to write cached sector '${sectorName}':`, e);
    }
}

export async function sweepDecodeCache(settings: LoadSettings_T): Promise<void> {
    if (!isCacheEnabled(settings)) return;

    let dir: FileSystemDirectoryHandle;

    try {
        dir = await getCacheDir(false);
    } catch (e) {
        return; // no cache directory yet
    }

    const doomed: string[] = [];

    for await (const [name, handle] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
        if (handle.kind !== "file") continue;

        try {
            const file = await (handle as FileSystemFileHandle).getFile();

            if (Date.now() - file.lastModified > CACHE_TTL_MS) doomed.push(name);
        } catch (e) { } // unreadable entry - leave it alone
    }

    for (const name of doomed) {
        try { await dir.removeEntry(name); } catch (e) { }
    }

    if (doomed.length > 0)
        console.log(`[decode-cache] swept ${doomed.length} cache entries`);
}

// Blob URLs are scoped to the thread owning the library, minted on first read so loading never pays for unplayed sounds.
export function refreshSoundBlobUris(library: any): void {
    const soundCache = library.soundBlobCache as Map<string, { uri: string, data: Uint8Array | Blob, mimeType: string }>;

    if (!soundCache) return;

    for (const entry of soundCache.values()) {
        if (!entry?.data) continue;

        if (entry.uri) URL.revokeObjectURL(entry.uri);

        let uri: string = null;

        Object.defineProperty(entry, "uri", { configurable: true, enumerable: true, get: () => uri ?? (uri = URL.createObjectURL(new Blob([entry.data], { type: entry.mimeType }))), set: (value: string) => { uri = value; } });
        Object.defineProperty(entry, "mintedUri", { configurable: true, get: () => uri });
    }
}

export function getMintedSoundUri(entry: any): string | null { return "mintedUri" in entry ? entry.mintedUri : entry.uri || null; }

export function revokeSoundUri(entry: any): void {
    const uri = getMintedSoundUri(entry);

    if (uri) URL.revokeObjectURL(uri);
}

function hashPackageSettings(settings: LoadSettings_T): string {
    return hashSettings({ cache: settings.cache, textures: "auto", rgbaTextures: false });
}

export async function getPackageCacheDir(settings: LoadSettings_T, create: boolean, path: string): Promise<FileSystemDirectoryHandle> {
    const dir = await getCacheDir(create);
    const packages = await dir.getDirectoryHandle(`packages.v${getCacheVersion(settings)}.${hashPackageSettings(settings)}`, { create });
    return packages.getDirectoryHandle(path.slice(path.lastIndexOf(".") + 1).toLowerCase(), { create });
}

function packageFileName(path: string): string {
    return path.slice(path.lastIndexOf("/") + 1).replace(/\.[^.]+$/, ".bin").toLowerCase();
}

export async function loadCachedPackage(path: string, settings: LoadSettings_T): Promise<any> {
    return readCachedPackage(path, settings, openLibraryFile);
}

export async function getCachedPackageFile(path: string, settings: LoadSettings_T): Promise<File | null> {
    return readCachedPackage(path, settings, file => file);
}

async function readCachedPackage(path: string, settings: LoadSettings_T, read: (file: File) => any): Promise<any> {
    if (!isCacheEnabled(settings) || settings._packageCache === false) return null;
    try {
        const dir = await getPackageCacheDir(settings, false, path);
        const handle = await dir.getFileHandle(packageFileName(path));
        return await requestWebLock(`package:${path}:${hashPackageSettings(settings)}`, async () => {
            const file = await handle.getFile();
            return file.size ? read(file) : null;
        }, { mode: "shared" });
    } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") return null;
        throw error;
    }
}

export async function storeCachedPackage(path: string, settings: LoadSettings_T, data: any): Promise<void> {
    if (!isCacheEnabled(settings) || settings._packageCache === false) return;
    const finish = startLoadingStep("cache", path);
    try {
        const sourcePixels = [];
        const entries: Record<string, any> = {};
        for (const [key, entry] of Object.entries(data.entries) as [string, any][]) {
            const source = entry.result?.source;
            if (!source) { entries[key] = entry; continue; }
            const pixelIndex = sourcePixels.length;
            const pixels = source.pixelIndex === undefined ? source : data.sourcePixels[source.pixelIndex];
            sourcePixels.push({ data: pixels.data, paletteRed: pixels.paletteRed });
            entries[key] = { ...entry, result: { ...entry.result, source: { ...source, data: null, paletteRed: null, pixelIndex } } };
        }
        const stored = { ...data, entries, sourcePixels };
        const bytes = serializeLibraryBlob(stored);
        await requestWebLock(`package:${path}:${hashPackageSettings(settings)}`, async () => {
            const dir = await getPackageCacheDir(settings, true, path);
            const name = packageFileName(path);
            const handle = await dir.getFileHandle(name, { create: true });
            const writable = await handle.createWritable();
            try {
                await writeCacheBytes(writable, bytes);
                await writable.close();
            } catch (error) {
                try { await writable.abort(); } catch { }
                throw error;
            }
        });
    } finally {
        finish();
    }
}
