import type { ILazyAssetHandle, IReadyAssetHandle } from "@l2js/core";
import fetchAsset, { getAssetSourceId, isServedAsset } from "../asset-source";
import requestWebLock from "../web-lock";

type FileSystemSyncAccessHandle_T = {
    read(buffer: BufferSource, options?: { at: number }): number;
    write(buffer: BufferSource, options?: { at: number }): number;
    getSize(): number;
    truncate(newSize: number): void;
    flush(): void;
    close(): void;
};

type SyncFileSystemFileHandle_T = FileSystemFileHandle & { createSyncAccessHandle?(options?: { mode: "read-only" }): Promise<FileSystemSyncAccessHandle_T> };

const cacheWindows = new Map<string, ArrayBuffer>();
let sourceId = 0;

async function fetchCached(path: string): Promise<LazyFileSystemHandle> {
    const root = await navigator.storage.getDirectory();

    const cachePath = `asset-cache/${getAssetSourceId()}/${path}`;
    const parts = cachePath.split("/").filter(Boolean);
    const baseName = parts.pop()!;

    let dir: FileSystemDirectoryHandle = root;
    for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create: true });
    }

    const fh = await dir.getFileHandle(baseName, { create: true });

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
    });

    return new LazyFileSystemHandle(fh, path);
}

async function uncachedFetch(path: string): Promise<IReadyAssetHandle> {
    const response = await fetchAsset(path);

    if (!response.ok) throw new Error(`${path}: ${response.statusText}`);

    const buffer = await response.arrayBuffer();

    return new ReadAssetHandle(buffer);
}

export async function fetchAssetHandle(path: string): Promise<ILazyAssetHandle> {
    if (isServedAsset(path)) return uncachedFetch(path) as unknown as ILazyAssetHandle;

    if (globalThis.isSecureContext && navigator.storage?.getDirectory && navigator.locks)
        return fetchCached(path);

    return uncachedFetch(path) as unknown as ILazyAssetHandle;
}

export async function fetchPackageSource(path: string): Promise<FileAssetSource> {
    if (isServedAsset(path)) return null;

    if (!globalThis.isSecureContext || !(globalThis as any).WorkerGlobalScope || !navigator.storage?.getDirectory || !navigator.locks) return null;

    return (await fetchCached(path)).getSource();
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

    public constructor(file: FileSystemSyncAccessHandle_T | File) {
        this.file = file;
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
            const nextOffset = Math.floor(offset / 262144) * 262144;
            const cacheKey = `${this.cachePrefix}${nextOffset}`;
            const cached = cacheWindows.get(cacheKey);

            cacheWindows.delete(cacheKey);

            if (this.buffer.byteLength && this.buffer.byteLength <= 262144) {
                const previousKey = `${this.cachePrefix}${this.offset}`;

                cacheWindows.delete(previousKey);
                cacheWindows.set(previousKey, this.buffer);
                if (cacheWindows.size > 64) cacheWindows.delete(cacheWindows.keys().next().value);
            }

            this.offset = nextOffset;

            if (cached && offset + length <= nextOffset + cached.byteLength) this.buffer = cached;
            else {
                const size = Math.min(this.size - this.offset, Math.max(262144, offset - this.offset + length));
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

    public close(): void {
        this.clearWindows();
        if (!(this.file instanceof File)) this.file.close();
        this.file = null;
        this.reader = null;
        this.buffer = new ArrayBuffer(0);
        this.window.view = new DataView(this.buffer);
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

class LazyFileSystemHandle implements ILazyAssetHandle {
    public readonly isReadable = false;

    protected readonly fh: SyncFileSystemFileHandle_T;
    protected readonly path: string;

    public constructor(fh: FileSystemFileHandle, path: string) {
        this.fh = fh as SyncFileSystemFileHandle_T;
        this.path = path;
    }

    public async getReadable(): Promise<IReadyAssetHandle> {
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
        // Firefox has exclusive sync handles; file slices keep package reads bounded across workers.
        if (/Firefox\//.test(navigator.userAgent)) return new FileAssetSource(await this.fh.getFile());

        if (!this.fh.createSyncAccessHandle) return null;

        return requestWebLock(`asset-cache:${this.path}`, async () => {
            let isReadOnly = false;
            const access = await this.fh.createSyncAccessHandle({ get mode() { isReadOnly = true; return "read-only" as const; } });

            if (isReadOnly) return new FileAssetSource(access);

            access.close();
            return null;
        });
    }

}

export default fetchAssetHandle;
