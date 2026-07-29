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

    // multiple decode workers can race to populate the same shared package (native/core/
    // engine.u) on a cold cache - a named lock serializes the fetch+write so only one
    // context does it; the rest just wait, then see the now-populated file below
    await navigator.locks.request(`asset-cache:${path}`, async () => {
        const existingFile = await fh.getFile();

        if (existingFile.size === 0) {
            const response = await fetch(path);

            if (!response.ok) throw new Error(response.statusText);

            const writable = await fh.createWritable();
            await response.body!.pipeTo(writable);
        }
    });

    return new LazyFileSystemHandle(fh, path);
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
    protected readonly path: string;

    public constructor(fh: FileSystemFileHandle, path: string) {
        this.fh = fh;
        this.path = path;
    }

    public async getReadable(): Promise<IReadyAssetHandle> {
        if ("createSyncAccessHandle" in this.fh) {
            // sync access handles are exclusive per file across the whole origin - a
            // shared package (e.g. referenced by sectors on different decode workers)
            // can get read by more than one worker at once, so this needs the same lock
            // fetchCached uses for the write, not just a same-worker guard
            return navigator.locks.request(`asset-cache:${this.path}`, async () => {
                const accessHandle = await this.fh.createSyncAccessHandle();
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

}

export default fetchAssetHandle;
export { fetchAssetHandle };