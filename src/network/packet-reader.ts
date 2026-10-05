export class PacketReader {
    protected readonly view: DataView;
    protected readonly bytes: Uint8Array;
    protected offset = 0;

    public constructor(bytes: Uint8Array) {
        this.bytes = bytes;
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }

    public getRemaining() { return this.bytes.length - this.offset; }
    public getOffset() { return this.offset; }

    protected need(size: number) {
        if (this.offset + size > this.bytes.length) throw new Error(`Packet underflow: need ${size} bytes at ${this.offset}, packet has ${this.bytes.length}.`);
    }

    public c(): number { this.need(1); return this.view.getUint8(this.offset++); }
    public h(): number { this.need(2); const value = this.view.getUint16(this.offset, true); this.offset += 2; return value; }
    public d(): number { this.need(4); const value = this.view.getInt32(this.offset, true); this.offset += 4; return value; }
    public f(): number { this.need(8); const value = this.view.getFloat64(this.offset, true); this.offset += 8; return value; }

    public b(size: number): Uint8Array {
        this.need(size);

        const value = this.bytes.slice(this.offset, this.offset + size);

        this.offset += size;

        return value;
    }

    public S(): string {
        let text = "";

        for (let code = this.h(); code !== 0; code = this.h()) text += String.fromCharCode(code);

        return text;
    }

    public skip(size: number) { this.need(size); this.offset += size; }
}

export default PacketReader;
