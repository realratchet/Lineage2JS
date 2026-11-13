import { serializeLibraryBlob, openLibraryFile, type LibraryBytes_T } from "./library-serializer";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";
import { getAssetSourceId } from "../asset-source";
import requestWebLock from "../web-lock";
import { startLoadingStep } from "../../loading-profile";
import { isFirefox } from "../../browser";

const CACHE_TTL_DAYS = 7;
const CACHE_DIR = "decode-cache";
export const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

export function isCacheEnabled(settings: LoadSettings_T): boolean {
    return !!globalThis.isSecureContext && !!navigator.storage?.getDirectory && (settings.cache === false ? false : settings.cache?.enabled ?? true);
}

export function getCacheVersion(settings: LoadSettings_T): number {
    return settings.cache === false ? 0 : settings.cache?.version ?? 0;
}

export function hashSettings(settings: LoadSettings_T): string {
    const json = JSON.stringify({ ...settings, loadExtendedBoneInfluences: settings.loadExtendedBoneInfluences !== false, cache: undefined, textures: undefined, rgbaTextures: settings.rgbaTextures !== false, decodeWorkerPoolSize: undefined });
    let hash = 5381;

    for (let i = 0; i < json.length; i++)
        hash = ((hash * 33) ^ json.charCodeAt(i)) >>> 0;

    return hash.toString(16).padStart(8, "0");
}

export async function getCacheDir(create: boolean): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();

    const dir = await root.getDirectoryHandle(CACHE_DIR, { create });

    return dir.getDirectoryHandle(getAssetSourceId(), { create });
}

export async function writeCacheBytes(writable: FileSystemWritableFileStream, bytes: Uint8Array | Blob | LibraryBytes_T): Promise<void> {
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

    await writable.write(bytes as FileSystemWriteChunkType);
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
