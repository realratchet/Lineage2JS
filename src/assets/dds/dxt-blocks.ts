class Color16 {
    public readonly u: number;

    public get b() { return (this.u & 0x001F) << 3; }
    public get g() { return (this.u & 0x07E0) >> 3; }
    public get r() { return (this.u & 0xF800) >> 8; }

    constructor(u: number) { this.u = u; }
}

class BlockDXT1 {
    protected col0: Color16;
    protected col1: Color16;
    protected indices: number[];

    public read(offset: number, dataview: DataView) {
        this.col0 = new Color16(dataview.getUint16(offset, true));
        this.col1 = new Color16(dataview.getUint16(offset + 2, true));
        this.indices = new Array(4).fill(1).map((_, i) => dataview.getUint8(offset + 4 + i));

        return offset + 8;
    }

    protected evalPalette() {
        const data = new DataView(new ArrayBuffer(4 * 4));

        const { r: r0, g: g0, b: b0 } = this.col0;
        const { r: r1, g: g1, b: b1 } = this.col1;

        // color 0
        data.setUint8(0 * 4 + 0, b0);
        data.setUint8(0 * 4 + 1, g0);
        data.setUint8(0 * 4 + 2, r0);
        data.setUint8(0 * 4 + 3, 0xFF);

        // color 1
        data.setUint8(1 * 4 + 0, b1);
        data.setUint8(1 * 4 + 1, g1);
        data.setUint8(1 * 4 + 2, r1);
        data.setUint8(1 * 4 + 3, 0xFF);

        if (this.col0.u > this.col1.u) {
            // Four-color block: derive the other two colors.
            data.setUint8(2 * 4 + 0, Math.round((2 * b0 + b1) / 3));
            data.setUint8(2 * 4 + 1, Math.round((2 * g0 + g1) / 3));
            data.setUint8(2 * 4 + 2, Math.round((2 * r0 + r1) / 3));
            data.setUint8(2 * 4 + 3, 0xFF);

            data.setUint8(3 * 4 + 0, Math.round((2 * b1 + b0) / 3));
            data.setUint8(3 * 4 + 1, Math.round((2 * g1 + g0) / 3));
            data.setUint8(3 * 4 + 2, Math.round((2 * r1 + r0) / 3));
            data.setUint8(3 * 4 + 3, 0xFF);
        } else {
            // Three-color block: derive the other color.
            data.setUint8(2 * 4 + 0, Math.round((r0 + r1) / 2));
            data.setUint8(2 * 4 + 1, Math.round((g0 + g1) / 2));
            data.setUint8(2 * 4 + 2, Math.round((b0 + b1) / 2));
            data.setUint8(2 * 4 + 3, 0xFF);

            // Set all components to 0 to match DXT specs.
            data.setUint8(3 * 4 + 0, 0x00);
            data.setUint8(3 * 4 + 1, 0x00);
            data.setUint8(3 * 4 + 2, 0x00);
            data.setUint8(3 * 4 + 3, 0x00);
        }

        return new Uint8Array(data.buffer);
    }

    public decodeBlock(rgba: Uint8Array) {
        const colArray = this.evalPalette();

        // Write color block.
        for (let j = 0; j < 4; j++) {
            for (let i = 0; i < 4; i++) {
                const idx = ((this.indices[j] >> (2 * i)) & 3) * 4;
                const slice = colArray.slice(idx, idx + 4);

                rgba.set(slice, (j * 4 + i) * 4);
            }
        }
    }
}

export default BlockDXT1;
export { BlockDXT1 };