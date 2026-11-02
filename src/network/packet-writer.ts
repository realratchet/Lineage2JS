export class PacketWriter {
    protected bytes = new Uint8Array(64);
    protected view = new DataView(this.bytes.buffer);
    protected offset = 0;

    protected grow(size: number) {
        if (this.offset + size <= this.bytes.length) return;

        const bytes = new Uint8Array(Math.max(this.bytes.length * 2, this.offset + size));

        bytes.set(this.bytes);
        this.bytes = bytes;
        this.view = new DataView(bytes.buffer);
    }

    public c(value: number): this { this.grow(1); this.view.setUint8(this.offset, value); this.offset += 1; return this; }
    public h(value: number): this { this.grow(2); this.view.setUint16(this.offset, value, true); this.offset += 2; return this; }
    public d(value: number): this { this.grow(4); this.view.setInt32(this.offset, value, true); this.offset += 4; return this; }
    public f(value: number): this { this.grow(8); this.view.setFloat64(this.offset, value, true); this.offset += 8; return this; }

    public b(value: Uint8Array): this {
        this.grow(value.length);
        this.bytes.set(value, this.offset);
        this.offset += value.length;

        return this;
    }

    public S(value: string): this {
        for (let i = 0; i < value.length; i++) this.h(value.charCodeAt(i));

        return this.h(0);
    }

    public toBytes(): Uint8Array { return this.bytes.slice(0, this.offset); }
}

export default PacketWriter;
