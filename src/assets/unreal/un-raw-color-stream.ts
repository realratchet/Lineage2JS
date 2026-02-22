class FRawColorStream implements C.IConstructable {
    declare private elementCount: number;
    declare private data: DataView;
    declare private revision: number;

    public getColor(index: number): [number, number, number, number] {
        const off = index << 2;

        return [
            this.data.getUint8(off),
            this.data.getUint8(off + 1),
            this.data.getUint8(off + 2),
            this.data.getUint8(off + 3)
        ];
    }

    public getElemCount() { return this.elementCount };
    public toTypedArray() { return new Uint8Array(this.data.buffer, this.data.byteOffset, this.data.byteLength) };

    public load(pkg: C.APackage): this {
        this.elementCount = pkg.read("compat32");
        this.data = pkg.read(this.elementCount * 4);

        this.revision = pkg.read("int32");

        return this;
    }

}

export default FRawColorStream;
export { FRawColorStream };