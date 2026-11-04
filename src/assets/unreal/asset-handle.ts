import type { ILazyAssetHandle, IReadyAssetHandle } from "@l2js/core";
import fetchAsset, { getAssetFiles, getAssetFile, openAssetReader, getRawAssetSourceId, isServedAsset } from "../asset-source";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";
import requestWebLock from "../web-lock";
import { isFirefox } from "../../browser";

type FileSystemSyncAccessHandle_T = {
    read(buffer: BufferSource, options?: { at: number }): number;
    getSize(): number;
    close(): void;
};

type SyncFileSystemFileHandle_T = FileSystemFileHandle & { createSyncAccessHandle?(options?: { mode: "read-only" }): Promise<FileSystemSyncAccessHandle_T> };

const cacheWindows = new Map<string, ArrayBuffer>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let cacheDatabase: Promise<IDBDatabase> = null;
let sourceId = 0;
const retainedAssets = new Set<string>();
const convertedAssets = new Map<string, { settings: LoadSettings_T, identity: string }>();

export function queueConvertedAssetRelease(path: string, settings: LoadSettings_T, identity: string): void {
    if (!/\.(usx|utx|uax)$/i.test(path)) throw new Error(`Cannot release unconverted package '${path}'.`);
    if (!retainedAssets.has(path)) convertedAssets.set(path, { settings, identity });
}

export async function retainAssetSource(path: string): Promise<void> {
    convertedAssets.delete(path);
    if (retainedAssets.has(path)) return;
    await touchCachedFile(`native:asset-cache/${getRawAssetSourceId()}/${path.toLowerCase()}`);
    retainedAssets.add(path);
}

export async function isAssetSourceRetained(path: string): Promise<boolean> {
    if (retainedAssets.has(path)) return true;
    const database = await getCacheDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction("files");
        const request = transaction.objectStore("files").get(`native:asset-cache/${getRawAssetSourceId()}/${path.toLowerCase()}`);
        transaction.oncomplete = () => resolve(request.result !== undefined);
        transaction.onabort = () => reject(transaction.error);
    });
}

async function releaseConvertedAssets(): Promise<void> {
    if (!convertedAssets.size) return;
    await requestWebLock("asset-cache-work", async lock => {
        if (lock) await releaseConvertedFiles();
    }, { ifAvailable: true });
}

async function releaseConvertedFiles(): Promise<void> {
    const { loadCachedPackage } = await import("../decode-worker/decode-cache");
    const { validatePackageResolver, canReleasePackageSource } = await import("./package-resolver");
    for (const [path, converted] of convertedAssets) {
        const cachePath = `asset-cache/${getRawAssetSourceId()}/${path.toLowerCase()}`;
        await requestWebLock(`asset-reader:${cachePath}`, async lock => {
            if (!lock) return;
            const cached = await loadCachedPackage(path, converted.settings);
            if (!cached?.library.complete || cached.library.identity !== converted.identity || !await canReleasePackageSource(cached.library)) {
                convertedAssets.delete(path);
                return;
            }
            validatePackageResolver(cached.library);
            await requestWebLock("asset-cache-tree", async () => {
                const parts = cachePath.split("/");
                const name = parts.pop();
                let dir = await navigator.storage.getDirectory();
                try {
                    for (const part of parts) dir = await dir.getDirectoryHandle(part);
                    await dir.removeEntry(name);
                    await touchCachedFile(cachePath, null);
                } catch (error) {
                    if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
                }
                convertedAssets.delete(path);
            }, { mode: "shared" });
        }, { ifAvailable: true });
    }
}

async function getCacheDatabase(): Promise<IDBDatabase> {
    if (!cacheDatabase) cacheDatabase = new Promise((resolve, reject) => {
        const request = indexedDB.open("asset-cache-access", 1);

        request.onupgradeneeded = () => request.result.createObjectStore("files");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const database = request.result;

            database.onversionchange = () => { database.close(); cacheDatabase = null; };
            resolve(database);
        };
    });

    return cacheDatabase;
}

async function touchCachedFile(path: string, touched: number = Date.now()): Promise<void> {
    const database = await getCacheDatabase();

    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("files", "readwrite");
        const store = transaction.objectStore("files");

        if (touched === null) store.delete(path);
        else store.put(touched, path);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
    });
}

async function getCacheAccess(): Promise<Map<string, number>> {
    const database = await getCacheDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction("files"), store = transaction.objectStore("files");
        const keys = store.getAllKeys(), values = store.getAll();

        transaction.oncomplete = () => resolve(new Map(keys.result.map((key, index) => [key as string, values.result[index]])));
        transaction.onabort = () => reject(transaction.error);
    });
}

function fetchCached(path: string, create: boolean = true): Promise<LazyFileSystemHandle> {
    return new Promise((resolve, reject) => { void holdCachedFile(path, create, resolve, reject); });
}

async function holdCachedFile(path: string, create: boolean, resolve: (handle: LazyFileSystemHandle) => void, reject: (error: any) => void): Promise<void> {
    const cachePath = `asset-cache/${getRawAssetSourceId()}/${path.toLowerCase()}`;

    try {
        await requestWebLock(`asset-reader:${cachePath}`, async () => {
            let release: () => void;
            const closed = new Promise<void>(resolve => release = resolve);
            const handle = await requestWebLock("asset-cache-tree", () => populateCachedFile(path, cachePath, release, create), { mode: "shared" });

            resolve(handle);
            if (handle) {
                await closed;
                await requestWebLock("asset-cache-tree", () => touchCachedFile(cachePath), { mode: "shared" });
            }
        }, { mode: "shared" });
    } catch (error) {
        if (!create && error instanceof DOMException && error.name === "NotFoundError") resolve(null);
        else reject(error);
    } finally {
        try {
            await requestWebLock("asset-cache-work", async work => {
                if (!work) return;

                await requestWebLock(`asset-reader:${cachePath}`, async lock => {
                    if (!lock) return;

                    const parts = cachePath.split("/").filter(Boolean);
                    const name = parts.pop();
                    let dir = await navigator.storage.getDirectory();

                    for (const part of parts) dir = await dir.getDirectoryHandle(part);
                    if (!(await (await dir.getFileHandle(name)).getFile()).size) await dir.removeEntry(name);
                }, { ifAvailable: true });
            }, { ifAvailable: true });
        } catch (error) {
            if (!(error instanceof DOMException && error.name === "NotFoundError"))
                console.warn(`[asset-cache] failed to release '${path}':`, error);
        }
    }
}

export async function sweepAssetCache(force: boolean = false): Promise<void> {
    if (!globalThis.isSecureContext || !navigator.storage?.getDirectory || !navigator.locks) return;

    await requestWebLock("asset-cache-work", async lock => {
        if (lock) await sweepCachedTree(force);
    }, { ifAvailable: true });
}

async function sweepCachedTree(force: boolean): Promise<void> {
    await requestWebLock("asset-cache-tree", async () => {
        const access = await getCacheAccess();

        if (!force && Date.now() - (access.get("sweep") || 0) < 60 * 60 * 1000) return;

        const root = await navigator.storage.getDirectory();
        let dir: FileSystemDirectoryHandle;

        try { dir = await root.getDirectoryHandle("asset-cache"); }
        catch (error) {
            if (error instanceof DOMException && error.name === "NotFoundError") return;
            throw error;
        }

        if (await sweepCachedFiles(dir, "asset-cache", access)) await root.removeEntry("asset-cache");
        await touchCachedFile("sweep");
    });
}

async function sweepCachedFiles(dir: FileSystemDirectoryHandle, path: string, access: Map<string, number>): Promise<boolean> {
    let empty = true;

    for await (const [name, handle] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
        const cachePath = `${path}/${name}`;

        if (handle.kind === "directory") {
            if (await sweepCachedFiles(handle as FileSystemDirectoryHandle, cachePath, access)) await dir.removeEntry(name);
            else empty = false;
            continue;
        }

        const removed = await requestWebLock(`asset-reader:${cachePath}`, async lock => {
            if (!lock) return false;

            try {
                const file = await (handle as FileSystemFileHandle).getFile();

                if (file.size && Date.now() - (access.get(cachePath) ?? file.lastModified) < CACHE_TTL_MS) return false;

                await dir.removeEntry(name);
                await touchCachedFile(cachePath, null);
            } catch (error) {
                if (error instanceof DOMException && error.name === "NotFoundError") return true;
                if (error instanceof DOMException && error.name === "NoModificationAllowedError") return false;
                throw error;
            }
            return true;
        }, { ifAvailable: true });

        if (!removed) empty = false;
    }

    return empty;
}

async function populateCachedFile(path: string, cachePath: string, release: () => void, create: boolean): Promise<LazyFileSystemHandle> {
    const root = await navigator.storage.getDirectory();

    const parts = cachePath.split("/").filter(Boolean);
    const baseName = parts.pop()!;

    let dir: FileSystemDirectoryHandle = root;
    for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create });
    }

    const fh = await dir.getFileHandle(baseName, { create });

    if (!create && !(await fh.getFile()).size) return null;

    // multiple decode workers can race to populate the same shared package (native/core/
    // engine.u) on a cold cache - a named lock serializes the fetch+write so only one
    // context does it; the rest just wait, then see the now-populated file below
    await requestWebLock(`asset-cache:${cachePath}`, async () => {
        const existingFile = await fh.getFile();

        if (existingFile.size === 0) {
            const response = await fetchAsset(path);

            if (!response.ok) throw new Error(`${path}: ${response.statusText}`);

            const writable = await fh.createWritable();
            await response.body!.pipeTo(writable);
        }
        await touchCachedFile(cachePath);
    });

    return new LazyFileSystemHandle(fh, path, release);
}

async function uncachedFetch(path: string): Promise<IReadyAssetHandle> {
    const response = await fetchAsset(path);

    if (!response.ok) throw new Error(`${path}: ${response.statusText}`);

    const buffer = await response.arrayBuffer();

    return new ReadAssetHandle(buffer);
}

export async function fetchAssetHandle(path: string): Promise<ILazyAssetHandle> {
    if (isServedAsset(path)) return uncachedFetch(path) as unknown as ILazyAssetHandle;

    const file = getAssetFile(path);

    if (file) return new ReadFileHandle(file);
    if (getAssetFiles()) return uncachedFetch(path) as unknown as ILazyAssetHandle;

    if (globalThis.isSecureContext && navigator.storage?.getDirectory && navigator.locks)
        return fetchCached(path);

    return uncachedFetch(path) as unknown as ILazyAssetHandle;
}

export async function fetchPackageSource(path: string): Promise<FileAssetSource> {
    if (isServedAsset(path)) return null;

    if (!(globalThis as any).WorkerGlobalScope) return null;

    const file = getAssetFile(path);

    if (file) return new FileAssetSource(file);

    if (globalThis.isSecureContext && navigator.storage?.getDirectory && navigator.locks)
        return (await fetchCached(path)).getSource();

    const reader = await openAssetReader(path);

    return reader ? new FileAssetSource(reader) : null;
}

export async function withAssetSources(callback: () => Promise<void>): Promise<void> {
    if (!globalThis.isSecureContext || !navigator.locks) return callback();

    await requestWebLock("asset-cache-work", callback, { mode: "shared" });
}

export async function releaseAssetSources(): Promise<void> {
    if (!globalThis.isSecureContext || !navigator.storage?.getDirectory || !navigator.locks) return;

    await releaseConvertedAssets();
    await sweepAssetCache();
}

class FileAssetSource {
    public readonly size: number;
    protected readonly cachePrefix = `${sourceId++}:`;
    protected file: FileSystemSyncAccessHandle_T | File;
    protected reader: { readAsArrayBuffer(blob: Blob): ArrayBuffer };
    protected buffer = new ArrayBuffer(0);
    protected offset = 0;
    protected window = { offset: 0, view: new DataView(this.buffer) };
    protected key: number = undefined;
    protected contentOffset = 0;
    protected release: () => void;

    public constructor(file: FileSystemSyncAccessHandle_T | File, release: () => void = null) {
        this.file = file;
        this.release = release;
        this.size = file instanceof File ? file.size : file.getSize();
        if (file instanceof File) this.reader = new (globalThis as any).FileReaderSync();
    }

    public read(offset: number, length: number): DataView {
        const window = this.readWindow(offset, length);
        return new DataView(window.view.buffer, offset - window.offset, length);
    }

    public readWindow(offset: number, length: number) {
        if (offset < 0 || length < 0 || offset + length > this.size) throw new Error(`Asset read outside file: ${offset}+${length}/${this.size}`);

        if (offset < this.offset || offset + length > this.offset + this.buffer.byteLength) {
            const nextOffset = Math.floor(offset / 65536) * 65536;
            const cacheKey = `${this.cachePrefix}${nextOffset}`;
            const cached = cacheWindows.get(cacheKey);

            cacheWindows.delete(cacheKey);

            if (this.buffer.byteLength && this.buffer.byteLength <= 65536) {
                const previousKey = `${this.cachePrefix}${this.offset}`;

                cacheWindows.delete(previousKey);
                cacheWindows.set(previousKey, this.buffer);
                if (cacheWindows.size > 256) cacheWindows.delete(cacheWindows.keys().next().value);
            }

            this.offset = nextOffset;

            if (cached && offset + length <= nextOffset + cached.byteLength) this.buffer = cached;
            else {
                const size = Math.min(this.size - this.offset, Math.max(65536, offset - this.offset + length));
                this.buffer = this.file instanceof File ? this.reader.readAsArrayBuffer(this.file.slice(this.offset, this.offset + size)) : new ArrayBuffer(size);
                const bytes = new Uint8Array(this.buffer);

                if (this.file instanceof File ? bytes.length !== size : this.file.read(bytes, { at: this.offset }) !== bytes.length) throw new Error(`Short asset read at ${this.offset}.`);

                if (this.key !== undefined)
                    for (let i = Math.max(0, this.contentOffset - this.offset); i < bytes.length; i++) bytes[i] ^= this.key;
            }

            this.window.offset = this.offset;
            this.window.view = new DataView(this.buffer);
        }

        return this.window;
    }

    public decrypt(key: number, offset: number): void {
        this.clearWindows();
        this.key = key;
        this.contentOffset = offset;
        this.buffer = new ArrayBuffer(0);
        this.window.view = new DataView(this.buffer);
    }

    public getMemorySize(): number { return this.buffer.byteLength; }

    public close(): void {
        this.clearWindows();
        if (!(this.file instanceof File)) this.file.close();
        this.file = null;
        this.reader = null;
        this.buffer = new ArrayBuffer(0);
        this.window.view = new DataView(this.buffer);
        if (this.release) this.release();
        this.release = null;
    }

    protected clearWindows(): void {
        for (const key of cacheWindows.keys())
            if (key.startsWith(this.cachePrefix)) cacheWindows.delete(key);
    }
}

class ReadAssetHandle implements IReadyAssetHandle {
    public readonly isReadable = true;
    public readonly buffer: ArrayBuffer;

    public async getReadable(): Promise<this> {
        return this;
    }

    public constructor(buffer: ArrayBuffer) {
        this.buffer = buffer;
    }
}

class ReadFileHandle implements ILazyAssetHandle {
    public readonly isReadable = false;
    protected readonly file: File;

    public constructor(file: File) { this.file = file; }

    public async getReadable(): Promise<IReadyAssetHandle> {
        return new ReadAssetHandle(await this.file.arrayBuffer());
    }
}

class LazyFileSystemHandle implements ILazyAssetHandle {
    public readonly isReadable = false;

    protected readonly fh: SyncFileSystemFileHandle_T;
    protected readonly path: string;
    protected readonly release: () => void;

    public constructor(fh: FileSystemFileHandle, path: string, release: () => void) {
        this.fh = fh as SyncFileSystemFileHandle_T;
        this.path = path;
        this.release = release;
    }

    public async getReadable(): Promise<IReadyAssetHandle> {
        try {
            return await this.readFile();
        } finally {
            this.release();
        }
    }

    protected async readFile(): Promise<IReadyAssetHandle> {
        if ("createSyncAccessHandle" in this.fh) {
            return requestWebLock(`asset-cache:${this.path}`, async () => {
                const accessHandle = await this.fh.createSyncAccessHandle({ mode: "read-only" });
                const size = accessHandle.getSize();
                const buffer = new ArrayBuffer(size);
                accessHandle.read(new Uint8Array(buffer), { at: 0 });
                accessHandle.close();

                return new ReadAssetHandle(buffer);
            });
        }

        const f = await this.fh.getFile();
        const b = await f.arrayBuffer();

        return new ReadAssetHandle(b);
    }

    public async getSource(): Promise<FileAssetSource> {
        try {
            const source = await this.openSource();

            if (!source) this.release();
            return source;
        } catch (error) {
            this.release();
            throw error;
        }
    }

    protected async openSource(): Promise<FileAssetSource> {
        // Firefox has exclusive sync handles; file slices keep package reads bounded across workers.
        if (isFirefox) return new FileAssetSource(await this.fh.getFile(), this.release);

        if (!this.fh.createSyncAccessHandle) return null;

        return requestWebLock(`asset-cache:${this.path}`, async () => {
            let isReadOnly = false;
            const access = await this.fh.createSyncAccessHandle({ get mode() { isReadOnly = true; return "read-only" as const; } });

            if (isReadOnly) return new FileAssetSource(access, this.release);

            access.close();
            return null;
        });
    }

}

export default fetchAssetHandle;
