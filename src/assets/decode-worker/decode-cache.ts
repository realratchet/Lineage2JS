import { serializeLibrary, deserializeLibrary } from "./library-serializer";

/**
 * OPFS-backed cache of fully decoded (and sanitized) sector libraries, mirroring how
 * packages are cached. A warm hit skips deserialization, decode-info generation and
 * batch merging entirely.
 *
 * Invalidation: the cache version (settings.cache.version - bump when decode logic
 * changes) and the load-settings hash are baked into the filename; entries older than
 * CACHE_TTL_DAYS are swept on init. settings.cache.enabled toggles the cache entirely.
 *
 * Libraries are cached before DXT->RGBA conversion (DDS is 4-8x smaller); the worker
 * re-runs the conversion after a hit. Blob URLs in the library are session-scoped, so
 * refreshSoundBlobUris() re-mints them from the raw bytes after a hit.
 */

const CACHE_TTL_DAYS = 7;
const CACHE_DIR = "decode-cache";

const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

function isCacheEnabled(settings: GD.LoadSettings_T): boolean {
    return settings.cache?.enabled !== false;
}

function hashSettings(settings: GD.LoadSettings_T): string {
    /* the cache config must not affect the content hash; texture mode neither -
       conversion happens after the cache, which always stores DDS */
    const json = JSON.stringify({ ...settings, cache: undefined, textures: undefined, rgbaTextures: undefined });
    let hash = 5381;

    for (let i = 0; i < json.length; i++)
        hash = ((hash * 33) ^ json.charCodeAt(i)) >>> 0;

    return hash.toString(16).padStart(8, "0");
}

function cacheFileName(sectorName: string, settings: GD.LoadSettings_T): string {
    return `${sectorName}.v${settings.cache?.version ?? 1}.${hashSettings(settings)}.bin`;
}

async function getCacheDir(create: boolean): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();

    return root.getDirectoryHandle(CACHE_DIR, { create });
}

async function loadCachedLibrary(sectorName: string, settings: GD.LoadSettings_T): Promise<any | null> {
    if (!isCacheEnabled(settings)) return null;

    try {
        const dir = await getCacheDir(false);
        const handle = await dir.getFileHandle(cacheFileName(sectorName, settings));
        const file = await handle.getFile();

        if (Date.now() - file.lastModified > CACHE_TTL_MS) {
            try { await dir.removeEntry(handle.name); } catch (e) { }
            return null;
        }

        return deserializeLibrary(await file.arrayBuffer());
    } catch (e) {
        if (!(e instanceof DOMException && e.name === "NotFoundError"))
            console.warn(`[decode-cache] failed to read cached sector '${sectorName}', re-decoding:`, e);

        return null;
    }
}

/**
 * Serializes synchronously (must happen before postMessage detaches the buffers), then
 * writes to OPFS in the background - a failed write only costs the next warm load.
 */
function storeCachedLibrary(sectorName: string, settings: GD.LoadSettings_T, library: any): void {
    if (!isCacheEnabled(settings)) return;

    let bytes: Uint8Array;

    try {
        bytes = serializeLibrary(library);
    } catch (e) {
        console.warn(`[decode-cache] sector '${sectorName}' is not cacheable:`, e);
        return;
    }

    void writeCacheFile(cacheFileName(sectorName, settings), sectorName, bytes);
}

async function writeCacheFile(fileName: string, sectorName: string, bytes: Uint8Array): Promise<void> {
    try {
        const dir = await getCacheDir(true);
        const handle = await dir.getFileHandle(fileName, { create: true });
        const writable = await handle.createWritable();

        await writable.write(bytes);
        await writable.close();

        console.log(`[decode-cache] cached sector '${sectorName}' (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
    } catch (e) {
        console.warn(`[decode-cache] failed to write cached sector '${sectorName}':`, e);
    }
}

/**
 * Deletes entries from other cache versions and entries past the TTL. Fire-and-forget.
 */
async function sweepDecodeCache(settings: GD.LoadSettings_T): Promise<void> {
    let dir: FileSystemDirectoryHandle;

    try {
        dir = await getCacheDir(false);
    } catch (e) {
        return; // no cache directory yet
    }

    const currentVersion = `.v${settings.cache?.version ?? 1}.`;
    const doomed: string[] = [];

    for await (const [name, handle] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
        if (handle.kind !== "file") continue;

        if (!name.includes(currentVersion)) {
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
        console.log(`[decode-cache] swept ${doomed.length} stale cache entries`);
}

/**
 * Blob URLs are scoped to the session that created them - a cached library carries
 * stale ones. Re-mint them from the raw audio bytes kept in soundBlobCache.
 */
function refreshSoundBlobUris(library: any): void {
    const soundCache = library.soundBlobCache as Map<string, { uri: string, data: Uint8Array, mimeType: string }>;

    if (!soundCache) return;

    for (const entry of soundCache.values()) {
        if (!entry?.data) continue;

        entry.uri = URL.createObjectURL(new Blob([entry.data], { type: entry.mimeType }));
    }

    for (const info of library.ambientSounds ?? []) {
        const entry = soundCache.get(info.soundName);

        if (entry?.uri) info.soundDataUri = entry.uri;
    }
}

export { loadCachedLibrary, storeCachedLibrary, sweepDecodeCache, refreshSoundBlobUris };
