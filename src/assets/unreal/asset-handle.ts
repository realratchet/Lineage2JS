import type { ILazyAssetHandle, IReadyAssetHandle } from "@l2js/core";
import fetchAsset, { getAssetSourceId } from "../asset-source";

type FileSystemSyncAccessHandle_T = {
    read(buffer: BufferSource, options?: { at: number }): number;
    write(buffer: BufferSource, options?: { at: number }): number;
    getSize(): number;
    truncate(newSize: number): void;
    flush(): void;
    close(): void;
};

type SyncFileSystemFileHandle_T = FileSystemFileHandle & { createSyncAccessHandle?(options?: { mode: "read-only" }): Promise<FileSystemSyncAccessHandle_T> };

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
    await navigator.locks.request(`asset-cache:${cachePath}`, async () => {
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
    if (globalThis.isSecureContext && navigator.storage?.getDirectory && navigator.locks)
        return fetchCached(path);

    return uncachedFetch(path) as unknown as ILazyAssetHandle;
}

export async function fetchPackageSource(path: string): Promise<FileAssetSource> {
    if (!globalThis.isSecureContext || !(globalThis as any).WorkerGlobalScope || !navigator.storage?.getDirectory || !navigator.locks) return null;

    return (await fetchCached(path)).getSource();
}

class FileAssetSource {
    public readonly size: number;
    protected readonly file: FileSystemSyncAccessHandle_T;
    protected buffer = new ArrayBuffer(0);
    protected offset = 0;
    protected key: number = undefined;
    protected contentOffset = 0;

    public constructor(file: FileSystemSyncAccessHandle_T) {
        this.file = file;
        this.size = file.getSize();
    }

    public read(offset: number, length: number): DataView {
        if (offset < 0 || length < 0 || offset + length > this.size) throw new Error(`Asset read outside file: ${offset}+${length}/${this.size}`);

        if (offset < this.offset || offset + length > this.offset + this.buffer.byteLength) {
            this.offset = offset;
            this.buffer = new ArrayBuffer(Math.min(this.size - offset, Math.max(262144, length)));
            const bytes = new Uint8Array(this.buffer);

            if (this.file.read(bytes, { at: offset }) !== bytes.length) throw new Error(`Short asset read at ${offset}.`);

            if (this.key !== undefined)
                for (let i = Math.max(0, this.contentOffset - offset); i < bytes.length; i++) bytes[i] ^= this.key;
        }

        return new DataView(this.buffer, offset - this.offset, length);
    }

    public decrypt(key: number, offset: number): void {
        this.key = key;
        this.contentOffset = offset;
        this.buffer = new ArrayBuffer(0);
    }

    public close(): void {
        this.file.close();
        this.buffer = new ArrayBuffer(0);
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
            return navigator.locks.request(`asset-cache:${this.path}`, async () => {
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
        if (!this.fh.createSyncAccessHandle) return null;

        return new FileAssetSource(await this.fh.createSyncAccessHandle({ mode: "read-only" }));
    }

}

export default fetchAssetHandle;
