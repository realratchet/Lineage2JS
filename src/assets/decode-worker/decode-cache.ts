import { serializeLibrary, isSerializedLibrary, openLibraryFile, hydrateLibraryFile, type SeekableLibrary_T } from "./library-serializer";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";

const CACHE_TTL_DAYS = 7;
const CACHE_DIR = "decode-cache";

const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

function isCacheEnabled(settings: LoadSettings_T): boolean {
    return settings.cache === false ? false : settings.cache?.enabled ?? true;
}

function getCacheVersion(settings: LoadSettings_T): number {
    return settings.cache === false ? 0 : settings.cache?.version ?? 0;
}

function hashSettings(settings: LoadSettings_T): string {
    const json = JSON.stringify({ ...settings, loadExtendedBoneInfluences: settings.loadExtendedBoneInfluences !== false, cache: undefined, textures: undefined, rgbaTextures: undefined, decodeWorkerPoolSize: undefined });
    let hash = 5381;

    for (let i = 0; i < json.length; i++)
        hash = ((hash * 33) ^ json.charCodeAt(i)) >>> 0;

    return hash.toString(16).padStart(8, "0");
}

function cacheFileName(sectorName: string, settings: LoadSettings_T): string {
    return `${sectorName}.v${getCacheVersion(settings)}.${hashSettings(settings)}.bin`;
}

async function getCacheDir(create: boolean): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();

    return root.getDirectoryHandle(CACHE_DIR, { create });
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

        if (!isSerializedLibrary(await file.slice(0, 5).arrayBuffer())) {
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

async function hasCachedLibrary(sectorName: string, settings: LoadSettings_T): Promise<boolean> {
    return (await getCachedFile(sectorName, settings)) !== null;
}

async function loadCachedLibrary(sectorName: string, settings: LoadSettings_T): Promise<any | null> {
    const seekable = await openCachedLibrary(sectorName, settings);

    if (!seekable) return null;

    try {
        return await hydrateLibraryFile(seekable);
    } catch (e) {
        console.warn(`[decode-cache] failed to read cached sector '${sectorName}', re-decoding:`, e);
        return null;
    }
}

async function openCachedLibrary(sectorName: string, settings: LoadSettings_T): Promise<SeekableLibrary_T | null> {
    const file = await getCachedFile(sectorName, settings);

    if (!file) return null;

    try {
        return await openLibraryFile(file);
    } catch (e) {
        console.warn(`[decode-cache] failed to open cached sector '${sectorName}', re-decoding:`, e);
        return null;
    }
}

async function loadCachedLibraryBuffer(sectorName: string, settings: LoadSettings_T): Promise<ArrayBuffer | null> {
    const file = await getCachedFile(sectorName, settings);

    return file ? file.arrayBuffer() : null;
}

function storeCachedLibrary(sectorName: string, settings: LoadSettings_T, library: any): void {
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

async function storeCachedLibraryDurable(sectorName: string, settings: LoadSettings_T, library: any): Promise<number> {
    if (!isCacheEnabled(settings)) return 0;

    const bytes = serializeLibrary(library);

    await writeCacheFile(cacheFileName(sectorName, settings), sectorName, bytes);

    return bytes.length;
}

async function storeCachedLibraryBufferDurable(sectorName: string, settings: LoadSettings_T, buffer: ArrayBuffer): Promise<void> {
    if (!isCacheEnabled(settings)) return;

    await writeCacheFile(cacheFileName(sectorName, settings), sectorName, new Uint8Array(buffer));
}

async function writeCacheFile(fileName: string, sectorName: string, bytes: Uint8Array): Promise<void> {
    const dir = await getCacheDir(true);
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();

    await writable.write(bytes);
    await writable.close();

    console.log(`[decode-cache] cached sector '${sectorName}' (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
}

async function writeCacheFileSafe(fileName: string, sectorName: string, bytes: Uint8Array): Promise<void> {
    try {
        await writeCacheFile(fileName, sectorName, bytes);
    } catch (e) {
        console.warn(`[decode-cache] failed to write cached sector '${sectorName}':`, e);
    }
}

async function sweepDecodeCache(settings: LoadSettings_T): Promise<void> {
    let dir: FileSystemDirectoryHandle;

    try {
        dir = await getCacheDir(false);
    } catch (e) {
        return; // no cache directory yet
    }

    const currentVersion = `.v${getCacheVersion(settings)}.`;
    const enabled = isCacheEnabled(settings);
    const doomed: string[] = [];

    for await (const [name, handle] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
        if (handle.kind !== "file") continue;

        if (!enabled || !name.includes(currentVersion)) {
            doomed.push(name);
            continue;
        }

        try {
            const file = await (handle as FileSystemFileHandle).getFile();

            if (Date.now() - file.lastModified > CACHE_TTL_MS) doomed.push(name);
        } catch (e) { } // unreadable entry - leave it alone
    }

    for (const name of doomed) {
        try { await dir.removeEntry(name); } catch (e) { }
    }

    if (doomed.length > 0)
        console.log(`[decode-cache] ${enabled ? "swept" : "cleared"} ${doomed.length} cache entries`);
}

// Blob URLs are scoped to the thread owning the library.
function refreshSoundBlobUris(library: any): void {
    const soundCache = library.soundBlobCache as Map<string, { uri: string, data: Uint8Array, mimeType: string }>;

    if (!soundCache) return;

    for (const entry of soundCache.values()) {
        if (!entry?.data) continue;

        if (entry.uri) URL.revokeObjectURL(entry.uri);

        entry.uri = URL.createObjectURL(new Blob([entry.data], { type: entry.mimeType }));
    }
}

export type { SeekableLibrary_T };
export { hasCachedLibrary, loadCachedLibrary, openCachedLibrary, hydrateLibraryFile, loadCachedLibraryBuffer, storeCachedLibrary, storeCachedLibraryDurable, storeCachedLibraryBufferDurable, sweepDecodeCache, refreshSoundBlobUris };
