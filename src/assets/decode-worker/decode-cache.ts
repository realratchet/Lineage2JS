import { serializeLibraryBlob, serializeLibraryParts, isSerializedLibrary, openLibraryFile, hydrateLibraryFile, type LibraryBytes_T, type SeekableLibrary_T } from "./library-serializer";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";
import { openAssetCatalog, storeAssetCatalog } from "./asset-catalog";
import { restorePackageAssets } from "./package-cache";
import requestWebLock from "../web-lock";
import { startLoadingStep } from "../../loading-profile";
import { isFirefox } from "../../browser";
import { CACHE_TTL_MS, isCacheEnabled, getCacheVersion, hashSettings, getCacheDir, writeCacheBytes } from "./cache-storage";

function isAssetCatalog(sectorName: string): boolean {
    return ["npc_runtime", "skill_visuals", "effect_templates", "character_effects", "character_sounds", "character_equipment", "character_parts"].includes(sectorName);
}

function cacheFileName(sectorName: string, settings: LoadSettings_T): string {
    return `${sectorName}.v${getCacheVersion(settings)}.${hashSettings(settings)}${isAssetCatalog(sectorName) ? ".a1" : /^\d+_\d+$/.test(sectorName) ? ".p1" : ""}.bin`;
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
