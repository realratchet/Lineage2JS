import inflateCabinetBlock from "./cabinet-inflate";

let tmpBlock = new Uint8Array(32768);
let cacheDatabase: Promise<IDBDatabase> = null;

async function accessCabinetIndex(key: string, index: Float64Array = null): Promise<Float64Array> {
    if (!cacheDatabase) cacheDatabase = new Promise((resolve, reject) => {
        const request = indexedDB.open("cabinet-index", 1);

        request.onupgradeneeded = () => request.result.createObjectStore("files");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const database = request.result;

            database.onversionchange = () => { database.close(); cacheDatabase = null; };
            resolve(database);
        };
    });

    const database = await cacheDatabase;

    return new Promise((resolve, reject) => {
        const transaction = database.transaction("files", index ? "readwrite" : "readonly");
        const store = transaction.objectStore("files");
        const request = index ? store.put(index, key) : store.get(key);

        transaction.oncomplete = () => resolve(index || request.result);
        transaction.onabort = () => reject(transaction.error);
    });
}

export async function storeCabinetIndex(key: string, index: Float64Array): Promise<void> {
    if (!globalThis.isSecureContext || !navigator.storage?.getDirectory || !navigator.locks) return;

    await accessCabinetIndex(key, index);
}

export class CabinetFileReader {
    protected readonly stored: Blob;
    protected readonly size: number;
    protected readonly compressed: boolean;
    protected readonly obfuscated: boolean;
    protected readonly reader = new (globalThis as any).FileReaderSync();
    protected index: Float64Array;
    protected offset = 0;
    protected buffer = new Uint8Array(0);

    public constructor(stored: Blob, size: number, compressed: boolean, obfuscated: boolean) {
        this.stored = stored;
        this.size = size;
        this.compressed = compressed;
        this.obfuscated = obfuscated;
    }

    public getSize(): number { return this.size; }

    public async loadIndex(key: string): Promise<this> {
        if (!this.compressed) return this;
        if (!globalThis.isSecureContext || !navigator.storage?.getDirectory || !navigator.locks) return null;

        this.index = await accessCabinetIndex(key);
        if (this.index) this.validateIndex();
        return this.index ? this : null;
    }

    protected validateIndex(): void {
        const index = this.index;

        if (index.length < 2 || index.length % 2 || index[0] !== 0 || index[1] !== 0 || index[index.length - 2] !== this.stored.size || index[index.length - 1] !== this.size)
            throw new Error(`Invalid cabinet block index.`);

        for (let i = 2; i < index.length; i += 2)
            if (!Number.isSafeInteger(index[i]) || !Number.isSafeInteger(index[i + 1]) || index[i] <= index[i - 2] + 2 || index[i + 1] < index[i - 1])
                throw new Error(`Invalid cabinet block offset ${i / 2}.`);
    }

    protected readStored(offset: number, length: number): Uint8Array {
        if (offset < 0 || length < 0 || offset + length > this.stored.size) throw new Error(`Cabinet read outside file: ${offset}+${length}/${this.stored.size}`);

        if (offset < this.offset || offset + length > this.offset + this.buffer.length) {
            this.offset = offset;
            const size = Math.min(this.stored.size - offset, Math.max(262144, length));

            this.buffer = new Uint8Array(this.reader.readAsArrayBuffer(this.stored.slice(offset, offset + size)));
            if (this.buffer.length !== size) throw new Error(`Short cabinet read at ${offset}.`);

            if (this.obfuscated)
                for (let i = 0; i < this.buffer.length; i++) {
                    const value = this.buffer[i] ^ 0xd5;

                    this.buffer[i] = ((value >> 2) | (value << 6)) - ((offset + i) % 0x47);
                }
        }

        return this.buffer.subarray(offset - this.offset, offset - this.offset + length);
    }

    public read(buffer: BufferSource, options: { at: number }): number {
        const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const offset = options.at;

        if (offset < 0 || offset + bytes.length > this.size) throw new Error(`Cabinet read outside file: ${offset}+${bytes.length}/${this.size}`);

        if (!this.compressed) {
            bytes.set(this.readStored(offset, bytes.length));
            return bytes.length;
        }

        let low = 0, high = this.index.length / 2 - 1;

        while (low + 1 < high) {
            const mid = (low + high) >>> 1;

            if (this.index[mid * 2 + 1] <= offset) low = mid;
            else high = mid;
        }

        let written = 0;
        for (let i = low * 2; written < bytes.length; i += 2) {
            const storedOffset = this.index[i] + 2;
            const expandedOffset = this.index[i + 1];
            const expandedLength = this.index[i + 3] - expandedOffset;

            if (tmpBlock.length < expandedLength) tmpBlock = new Uint8Array(expandedLength);
            if (inflateCabinetBlock(this.readStored(storedOffset, this.index[i + 2] - storedOffset), tmpBlock, 0, expandedLength) !== expandedLength)
                throw new Error(`Cabinet block size changed at ${storedOffset}.`);

            const start = offset + written - expandedOffset;
            const length = Math.min(bytes.length - written, expandedLength - start);

            bytes.set(tmpBlock.subarray(start, start + length), written);
            written += length;
        }
        return written;
    }

    public close(): void {
        this.buffer = new Uint8Array(0);
        this.index = null;
    }
}

export default CabinetFileReader;
