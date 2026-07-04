import type { ILazyAssetHandle, IReadyAssetHandle } from "@l2js/core";

async function fetchCached(path: string): Promise<ILazyAssetHandle> {
    const root = await navigator.storage.getDirectory();

    const parts = path.split('/').filter(Boolean);
    const baseName = parts.pop()!;

    let dir: FileSystemDirectoryHandle = root;
    for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create: true });
    }

    const fh = await dir.getFileHandle(baseName, { create: true });
    const existingFile = await fh.getFile();

    if (existingFile.size === 0) {
        const response = await fetch(path);

        if (!response.ok) throw new Error(response.statusText);

        const writable = await fh.createWritable();
        await response.body!.pipeTo(writable);
    }

    return new LazyFileSystemHandle(fh);
}

async function uncachedFetch(path: string): Promise<IReadyAssetHandle> {
    const response = await fetch(path);

    if (!response.ok) throw new Error(response.statusText);

    const buffer = await response.arrayBuffer();

    return new ReadAssetHandle(buffer);
}

async function fetchAssetHandle(path: string): Promise<ILazyAssetHandle> {
    if (navigator.storage) return fetchCached(path);

    return uncachedFetch(path) as unknown as ILazyAssetHandle;
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

    protected readonly fh: FileSystemFileHandle;

    public constructor(fh: FileSystemFileHandle) {
        this.fh = fh;
    }

    public async getReadable(): Promise<IReadyAssetHandle> {
        if ("createSyncAccessHandle" in this.fh) { // this will be used in future when decoding is in a webworker
            const accessHandle = await this.fh.createSyncAccessHandle();
            const size = accessHandle.getSize();
            const buffer = new ArrayBuffer(size);
            accessHandle.read(new Uint8Array(buffer), { at: 0 });
            accessHandle.close();

            return new ReadAssetHandle(buffer);
        }

        const f = await this.fh.getFile();
        const b = await f.arrayBuffer();

        return new ReadAssetHandle(b);
    }

}

export default fetchAssetHandle;
export { fetchAssetHandle };