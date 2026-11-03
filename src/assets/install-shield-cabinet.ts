import inflateCabinetBlock from "./cabinet-inflate";
import CabinetFileReader, { storeCabinetIndex } from "./cabinet-file-reader";

// layout from unshield (libunshield), InstallShield 6+ cabinets
const COMMON_HEADER_SIZE = 20;
const FILE_DESCRIPTOR_SIZE = 0x57;

const FILE_SPLIT = 1;
const FILE_OBFUSCATED = 2;
const FILE_COMPRESSED = 4;
const FILE_INVALID = 8;

const LINK_PREV = 1;

type CabinetFile_T = {
    index: number;
    path: string;
    flags: number;
    expandedSize: number;
    compressedSize: number;
    dataOffset: number;
    volume: number;
};

type VolumeHeader_T = {
    dataOffset: number;
    firstFileIndex: number;
    lastFileIndex: number;
    firstFileOffset: number;
    firstFileSizeCompressed: number;
    lastFileOffset: number;
    lastFileSizeCompressed: number;
};

const decoderLatin1 = new TextDecoder("latin1");

function readString(bytes: Uint8Array, offset: number) {
    let end = offset;

    while (bytes[end] !== 0) end++;

    return decoderLatin1.decode(bytes.subarray(offset, end));
}

function readUint64(view: DataView, offset: number) {
    return view.getUint32(offset, true) + view.getUint32(offset + 4, true) * 0x100000000;
}

async function readCabinetBytes(blob: Blob, name: string): Promise<ArrayBuffer> {
    try {
        return await blob.arrayBuffer();
    } catch (e) {
        throw new Error(`Cannot read '${name}'. Select the installer folder again. ${(e as Error).message}`);
    }
}

function deobfuscate(bytes: Uint8Array, seed: number) {
    for (let i = 0; i < bytes.length; i++, seed++) {
        const x = bytes[i] ^ 0xd5;
        bytes[i] = ((x >> 2) | (x << 6)) - (seed % 0x47);
    }

    return seed;
}

export class InstallShieldCabinet {
    public readonly files: CabinetFile_T[] = [];

    protected readonly volumes: Map<number, Blob>;
    protected readonly volumeHeaders = new Map<number, VolumeHeader_T>();

    protected constructor(volumes: Map<number, Blob>) {
        this.volumes = volumes;
    }

    public static async open(header: Blob, volumes: Map<number, Blob>) {
        const cabinet = new InstallShieldCabinet(volumes);

        cabinet.readFileTable(new Uint8Array(await readCabinetBytes(header, "data1.hdr")));

        const required = new Set(cabinet.files.map(file => file.volume));
        const missing = [...required].filter(volume => !volumes.has(volume));

        if (missing.length) throw new Error(`Missing installer files: ${missing.map(volume => `data${volume}.cab`).join(", ")}. Select the folder containing data1.hdr and all CAB volumes.`);

        for (const volume of required) await cabinet.getVolumeHeader(volume);

        for (const file of cabinet.files) {
            const size = file.flags & FILE_COMPRESSED ? file.compressedSize : file.expandedSize;

            if (!(file.flags & FILE_SPLIT) && file.dataOffset + size > volumes.get(file.volume).size)
                throw new Error(`Installer file 'data${file.volume}.cab' is incomplete: missing data for '${file.path}'.`);
        }

        return cabinet;
    }

    protected readFileTable(bytes: Uint8Array) {
        if (bytes.byteLength < COMMON_HEADER_SIZE) throw new Error(`Installer file 'data1.hdr' is incomplete.`);

        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        if (view.getUint32(0, true) !== 0x28635349) throw new Error(`'data1.hdr' is not an InstallShield cabinet header.`);

        const version = view.getUint32(4, true);
        const majorVersion = version >>> 24 === 1 ? (version >>> 12) & 0xf : (version & 0xffff) / 100;

        if (majorVersion < 6) throw new Error(`InstallShield cabinet version ${majorVersion} not supported.`);

        const cabDescriptor = view.getUint32(12, true);
        const fileTable = cabDescriptor + view.getUint32(cabDescriptor + 0x0c, true);
        const directoryCount = view.getUint32(cabDescriptor + 0x1c, true);
        const fileCount = view.getUint32(cabDescriptor + 0x28, true);
        const fileTableOffset2 = view.getUint32(cabDescriptor + 0x2c, true);
        const directories = new Array<string>(directoryCount);

        for (let i = 0; i < directoryCount; i++)
            directories[i] = readString(bytes, fileTable + view.getUint32(fileTable + i * 4, true));

        for (let i = 0; i < fileCount; i++) {
            const p = fileTable + fileTableOffset2 + i * FILE_DESCRIPTOR_SIZE;
            const name = readString(bytes, fileTable + view.getUint32(p + 0x3a, true));
            const directory = directories[view.getUint16(p + 0x3e, true)];
            const d = bytes[p + 0x54] & LINK_PREV ? fileTable + fileTableOffset2 + view.getUint32(p + 0x4c, true) * FILE_DESCRIPTOR_SIZE : p;
            const flags = view.getUint16(d, true);

            if (flags & FILE_INVALID) continue;

            this.files.push({
                index: (d - fileTable - fileTableOffset2) / FILE_DESCRIPTOR_SIZE,
                path: (directory ? `${directory}\\${name}` : name).replace(/\\/g, "/"),
                flags,
                expandedSize: readUint64(view, d + 0x02),
                compressedSize: readUint64(view, d + 0x0a),
                dataOffset: readUint64(view, d + 0x12),
                volume: view.getUint16(d + 0x55, true)
            });
        }
    }

    protected async getVolumeHeader(volume: number) {
        if (this.volumeHeaders.has(volume)) return this.volumeHeaders.get(volume);

        const blob = this.volumes.get(volume);

        if (!blob) throw new Error(`Missing cabinet volume data${volume}.cab`);

        const bytes = await readCabinetBytes(blob.slice(0, COMMON_HEADER_SIZE + 0x40), `data${volume}.cab`);

        if (bytes.byteLength < COMMON_HEADER_SIZE + 0x40) throw new Error(`Installer file 'data${volume}.cab' is incomplete.`);
        if (new DataView(bytes).getUint32(0, true) !== 0x28635349) throw new Error(`'data${volume}.cab' is not an InstallShield cabinet.`);

        const view = new DataView(bytes, COMMON_HEADER_SIZE);
        const header: VolumeHeader_T = {
            dataOffset: view.getUint32(0x00, true),
            firstFileIndex: view.getUint32(0x08, true),
            lastFileIndex: view.getUint32(0x0c, true),
            firstFileOffset: readUint64(view, 0x10),
            firstFileSizeCompressed: readUint64(view, 0x20),
            lastFileOffset: readUint64(view, 0x28),
            lastFileSizeCompressed: readUint64(view, 0x38)
        };

        this.volumeHeaders.set(volume, header);

        return header;
    }

    protected async readStored(file: CabinetFile_T) {
        const size = file.flags & FILE_COMPRESSED ? file.compressedSize : file.expandedSize;

        if (!(file.flags & FILE_SPLIT))
            return new Uint8Array(await readCabinetBytes(this.volumes.get(file.volume).slice(file.dataOffset, file.dataOffset + size), `data${file.volume}.cab`));

        const stored = new Uint8Array(size);
        let volume = file.volume, offset = file.dataOffset, written = 0;

        while (written < size) {
            const header = await this.getVolumeHeader(volume);
            let available = size - written;

            if (file.index === header.lastFileIndex && header.lastFileOffset !== 0x7FFFFFFF) available = header.lastFileSizeCompressed;
            if (written > 0 && file.index === header.firstFileIndex) {
                offset = header.firstFileOffset;
                available = header.firstFileSizeCompressed;
            }

            const length = Math.min(available, size - written);

            stored.set(new Uint8Array(await readCabinetBytes(this.volumes.get(volume).slice(offset, offset + length), `data${volume}.cab`)), written);
            written += length;
            volume++;
        }

        return stored;
    }

    public async openFile(file: CabinetFile_T, key: string): Promise<CabinetFileReader> {
        const parts: Blob[] = [];
        const size = file.flags & FILE_COMPRESSED ? file.compressedSize : file.expandedSize;
        let volume = file.volume, offset = file.dataOffset, written = 0;

        while (written < size) {
            let available = size - written;

            if (file.flags & FILE_SPLIT) {
                const header = await this.getVolumeHeader(volume);

                if (file.index === header.lastFileIndex && header.lastFileOffset !== 0x7FFFFFFF) available = header.lastFileSizeCompressed;
                if (written > 0 && file.index === header.firstFileIndex) {
                    offset = header.firstFileOffset;
                    available = header.firstFileSizeCompressed;
                }
            }

            const length = Math.min(available, size - written);
            const blob = this.volumes.get(volume);

            if (length <= 0 || !blob || offset + length > blob.size) throw new Error(`Incomplete cabinet segment for '${file.path}'.`);

            parts.push(blob.slice(offset, offset + length));
            written += length;
            volume++;
        }

        return new CabinetFileReader(new Blob(parts), file.expandedSize, !!(file.flags & FILE_COMPRESSED), !!(file.flags & FILE_OBFUSCATED)).loadIndex(key);
    }

    public async extract(file: CabinetFile_T, indexKey: string = null, offsets: number[] = null): Promise<Uint8Array> {
        const stored = await this.readStored(file);

        if (file.flags & FILE_OBFUSCATED) deobfuscate(stored, 0);
        if (!(file.flags & FILE_COMPRESSED)) return stored;

        const view = new DataView(stored.buffer);
        const output = new Uint8Array(file.expandedSize);
        if (indexKey && !offsets) offsets = [];
        let offset = 0, written = 0;

        while (offset < stored.length) {
            const length = view.getUint16(offset, true);
            if (offsets) offsets.push(offset, written);
            written += inflateCabinetBlock(stored.subarray(offset + 2, offset + 2 + length), output, written);
            offset += 2 + length;
        }

        if (written !== file.expandedSize) throw new Error(`Cabinet file '${file.path}' inflated to ${written}/${file.expandedSize} bytes.`);

        if (offsets) {
            offsets.push(offset, written);
            if (indexKey) await storeCabinetIndex(indexKey, new Float64Array(offsets));
        }

        return output;
    }
}

export default InstallShieldCabinet;
